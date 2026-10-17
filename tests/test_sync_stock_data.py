"""Offline contract tests for quote validation and safe snapshot replacement."""

import copy
import importlib.util
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync-stock-data.py"
SPEC = importlib.util.spec_from_file_location("sync_stock_data", SCRIPT)
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


def today_utc():
    return datetime.now(timezone.utc).date()


def payload(count=240, end=None):
    """Synthetic daily observations, anchored to UTC today without external I/O."""
    end = end or today_utc()
    rows = []
    for index in range(count):
        day = end - timedelta(days=count - index - 1)
        close = 250 + index / 10
        rows.append([day.isoformat(), str(close - 1), str(close), str(close + 1), str(close - 2), "1000"])
    return {"code": 0, "data": {"usMCD.N": {"qfqday": rows}}}


def rows(data):
    return data["data"]["usMCD.N"]["qfqday"]


class PriceValidationTests(unittest.TestCase):
    def test_complete_adjusted_mcd_history_uses_closing_column(self):
        source = payload()
        original = copy.deepcopy(source)
        parsed = sync.parse_prices(source)
        self.assertEqual(len(parsed), 240)
        self.assertEqual(parsed[0], {"date": rows(source)[0][0], "close": 250.0})
        self.assertEqual(parsed[-1], {"date": today_utc().isoformat(), "close": 273.9})
        self.assertEqual(source, original)

    def test_both_history_length_limits_are_inclusive(self):
        for count in (200, 400):
            with self.subTest(count=count):
                self.assertEqual(len(sync.parse_prices(payload(count=count))), count)
        for count in (0, 199, 401):
            with self.subTest(count=count), self.assertRaises(ValueError):
                sync.parse_prices(payload(count=count))

    def test_upstream_errors_missing_symbol_and_unadjusted_data_are_rejected(self):
        failures = [
            {"code": 1, "data": payload()["data"]},
            {"code": "0", "data": payload()["data"]},
            {"code": 0, "data": {}},
            {"code": 0, "data": {"usOTHER.N": {"qfqday": rows(payload())}}},
            {"code": 0, "data": {"usMCD.N": {"day": rows(payload())}}},
            {"code": 0, "data": {"usMCD.N": {"qfqday": None}}},
        ]
        for index, source in enumerate(failures):
            with self.subTest(case=index), self.assertRaises(ValueError):
                sync.parse_prices(source)

    def test_non_positive_non_finite_and_unparseable_closes_are_rejected(self):
        for close in ("0", "-0.1", "NaN", "Infinity", "-Infinity", "not-a-price", None):
            source = payload()
            rows(source)[100][2] = close
            with self.subTest(close=close), self.assertRaises((ValueError, TypeError)):
                sync.parse_prices(source)

    def test_rows_must_contain_a_closing_column(self):
        for bad_row in ([], ["2026-01-01", "300"], {"date": "2026-01-01", "close": 300}):
            source = payload()
            rows(source)[100] = bad_row
            with self.subTest(row=bad_row), self.assertRaises(ValueError):
                sync.parse_prices(source)

    def test_unordered_and_duplicate_dates_are_rejected(self):
        for mode in ("unordered", "duplicate"):
            source = payload()
            observations = rows(source)
            if mode == "unordered":
                observations[100], observations[101] = observations[101], observations[100]
            else:
                observations[101][0] = observations[100][0]
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                sync.parse_prices(source)

    def test_only_real_canonical_iso_dates_are_accepted(self):
        for invalid in ("2025-02-29", "2026-02-30", "2026-13-01", "2026-1-02",
                        "20260102", "2026-01-02T00:00:00Z", "not-a-date"):
            source = payload()
            rows(source)[0][0] = invalid
            with self.subTest(date=invalid), self.assertRaises(ValueError):
                sync.parse_prices(source)
        source = payload()
        # A real leap day is valid even when older observations have a large gap.
        rows(source)[0][0] = "2024-02-29"
        self.assertEqual(sync.parse_prices(source)[0]["date"], "2024-02-29")

    def test_future_and_stale_last_dates_are_rejected(self):
        for offset in (1, -11):
            with self.subTest(offset=offset), self.assertRaises(ValueError):
                sync.parse_prices(payload(end=today_utc() + timedelta(days=offset)))
        self.assertEqual(
            sync.parse_prices(payload(end=today_utc() - timedelta(days=10)))[-1]["date"],
            (today_utc() - timedelta(days=10)).isoformat(),
        )


class SnapshotWriteTests(unittest.TestCase):
    def test_new_snapshot_contains_only_expected_metadata_and_parsed_points(self):
        points = sync.parse_prices(payload())
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "nested" / "stock.json"
            self.assertTrue(sync.write_snapshot(points, target))
            public = json.loads(target.read_text(encoding="utf-8"))
            self.assertEqual(set(public), {
                "schemaVersion", "symbol", "currency", "source", "sourceURL", "priceType", "points", "syncedAt",
            })
            self.assertEqual(public["symbol"], "NYSE:MCD")
            self.assertEqual(public["currency"], "USD")
            self.assertEqual(public["priceType"], "qfq")
            self.assertEqual(public["points"], points)
            self.assertTrue(public["syncedAt"].endswith("Z"))
            self.assertIsNotNone(datetime.fromisoformat(public["syncedAt"]))
            self.assertEqual(list(target.parent.iterdir()), [target])

    def test_unchanged_data_preserves_bytes_mtime_and_original_sync_date(self):
        points = sync.parse_prices(payload())
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock.json"
            sync.write_snapshot(points, target)
            public = json.loads(target.read_text(encoding="utf-8"))
            public["syncedAt"] = "2000-01-01T00:00:00Z"
            target.write_text(json.dumps(public), encoding="utf-8")
            # A deliberately old mtime detects a rewrite without a timing/sleep race.
            os.utime(target, ns=(946684800000000000, 946684800000000000))
            previous_bytes = target.read_bytes()
            previous_mtime = target.stat().st_mtime_ns
            self.assertIs(sync.write_snapshot(copy.deepcopy(points), target), False)
            self.assertEqual(target.read_bytes(), previous_bytes)
            self.assertEqual(target.stat().st_mtime_ns, previous_mtime)
            self.assertEqual(json.loads(target.read_text())["syncedAt"], "2000-01-01T00:00:00Z")
            self.assertEqual(list(target.parent.iterdir()), [target])

    def test_price_or_metadata_changes_trigger_a_new_snapshot(self):
        for changed in ("price", "metadata"):
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / "stock.json"
                points = sync.parse_prices(payload())
                sync.write_snapshot(points, target)
                public = json.loads(target.read_text(encoding="utf-8"))
                public["syncedAt"] = "2000-01-01T00:00:00Z"
                if changed == "metadata":
                    public["currency"] = "CNY"
                else:
                    points[-1]["close"] += 1
                target.write_text(json.dumps(public), encoding="utf-8")
                self.assertIs(sync.write_snapshot(points, target), True)
                updated = json.loads(target.read_text(encoding="utf-8"))
                self.assertEqual(updated["currency"], "USD")
                self.assertEqual(updated["points"], points)
                self.assertNotEqual(updated["syncedAt"], "2000-01-01T00:00:00Z")

    def test_failed_atomic_replace_preserves_old_file_and_removes_temporary_file(self):
        points = sync.parse_prices(payload())
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stock.json"
            sync.write_snapshot(points, target)
            previous_bytes = target.read_bytes()
            previous_mtime = target.stat().st_mtime_ns
            points[-1]["close"] += 1
            with patch.object(sync.os, "replace", side_effect=OSError("simulated replacement failure")):
                with self.assertRaises(OSError):
                    sync.write_snapshot(points, target)
            self.assertEqual(target.read_bytes(), previous_bytes)
            self.assertEqual(target.stat().st_mtime_ns, previous_mtime)
            self.assertEqual(list(target.parent.iterdir()), [target])


if __name__ == "__main__":
    unittest.main()
