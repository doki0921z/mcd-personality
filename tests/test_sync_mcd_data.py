"""Offline checks for public-data filtering, tool policy and atomic refreshes."""

import importlib.util
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync-mcd-data.py"
SPEC = importlib.util.spec_from_file_location("sync_mcd_data", SCRIPT)
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)

TABLE = """[8]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
  巨无霸,null,2146,513,27,26,42,961,171
  中薯条,null,1210,289,4,12,38,165,18
  麦乐鸡5块,null,890,213,12,12,13,422,9
  麦辣鸡腿汉堡,null,2029,485,24,24,42,1208,154
  奥利奥麦旋风,null,1115,266,5,9,40,116,185
  香芋派,null,971,232,2,12,28,159,7
  可乐中杯,null,616,147,0,0,36,0,10
  冰美式中杯,null,54,13,1,0,2,0,7"""


def envelope(data):
    return {"isError": False, "structuredContent": {
        "success": True, "code": 200, "traceId": "PRIVATE_TRACE", "data": data,
    }}


def calendar():
    return envelope({
        "currentTime": "2026-10-15 19:30:31",
        "userId": "PRIVATE_USER",
        "subscribedEvents": [{"activityTitle": "PRIVATE_SUBSCRIPTION"}],
        "dailyList": [{"date": "2026-10-15", "dateText": "PRIVATE_DATE_TEXT", "events": [{
            "activityCode": "PRIVATE_CODE", "resourceId": "PRIVATE_ID",
            "activityTitle": "", "activitySubTitle": "<b>公开副标题</b>",
            "couponInfo": {"couponCode": "PRIVATE_COUPON", "couponId": "PRIVATE_COUPON_ID"},
            "activityBgImg": "https://private.invalid/image.png",
            "articleDto": {
                "title": "<b>公开活动</b>",
                "content": "<p>快乐吃麦<br>今日上新</p><script>PRIVATE_SCRIPT</script>"
                           "[查看](https://private.invalid/path) mcdapp://private/deep-link",
                "imgList": ["PRIVATE_IMAGE"], "appJumpUrl": "PRIVATE_DEEP_LINK",
            },
        }]}],
    })


class PublicDataTests(unittest.TestCase):
    def test_exact_product_mapping_and_portions(self):
        nutrition = sync.parse_nutrition(envelope(TABLE))
        self.assertEqual(set(nutrition), set(sync.PROFILE_PRODUCTS))
        self.assertEqual(nutrition["nuggets"]["productName"], "麦乐鸡5块")
        self.assertEqual(nutrition["nuggets"]["serving"], "5块")
        self.assertEqual(nutrition["nuggets"]["energyKcal"], 213)
        self.assertEqual(nutrition["fries"]["serving"], "中份")
        self.assertEqual(nutrition["cola"]["serving"], "中杯")
        self.assertEqual(nutrition["coffee"]["productName"], "冰美式中杯")
        self.assertEqual(nutrition["coffee"]["energyKcal"], 13)
        self.assertEqual(nutrition["bigmac"]["sodium"], 961)
        self.assertEqual(nutrition["mcflurry"]["calcium"], 185)

    def test_missing_product_or_nutrient_is_rejected(self):
        missing_product = "\n".join(TABLE.splitlines()[:-1]).replace("[8]", "[7]", 1)
        missing_nutrient = TABLE.replace("sodium,", "removed,", 1)
        for table in (missing_product, missing_nutrient, TABLE.replace("2146,513", "2146,null", 1),
                      TABLE.replace("2146,513", "2146,NaN", 1), TABLE.replace("[8]", "[9]", 1)):
            with self.subTest(table=table[:80]), self.assertRaises(sync.SyncError):
                sync.parse_nutrition(envelope(table))

    def test_text_json_envelope_fallback(self):
        fallback = {"content": [{"type": "text", "text": "## Original Response\n\n" + json.dumps({
            "code": 200, "success": True, "data": TABLE,
        })}]}
        self.assertEqual(sync.parse_nutrition(fallback), sync.parse_nutrition(envelope(TABLE)))

    def test_private_fields_images_and_links_cannot_reach_public_snapshot(self):
        snapshot = sync.build_public_snapshot(envelope(TABLE), calendar(), "2026-10-15T11:30:31Z")
        serialized = json.dumps(snapshot, ensure_ascii=False)
        self.assertNotIn("PRIVATE", serialized)
        self.assertNotIn("private.invalid", serialized)
        self.assertNotIn("mcdapp://", serialized)
        self.assertNotIn("<", serialized)
        self.assertEqual(set(snapshot), {"schemaVersion", "syncedAt", "source", "nutrition", "calendar"})
        self.assertEqual(snapshot["calendar"], {"month": "2026-10", "days": [{
            "date": "2026-10-15", "events": [{
                "title": "公开活动", "subtitle": "公开副标题", "content": "快乐吃麦\n今日上新\n查看",
            }],
        }]})

    def test_missing_calendar_is_rejected(self):
        for data in ({}, {"dailyList": []}, {"currentTime": "bad", "dailyList": []}):
            with self.subTest(data=data), self.assertRaises(sync.SyncError):
                sync.parse_calendar(envelope(data))

    def test_failed_refresh_preserves_old_file_and_closes_client(self):
        class FailedClient:
            closed = False

            def initialize(self):
                pass

            def call_tool(self, name):
                if name == "list-nutrition-foods":
                    return envelope(TABLE)
                raise sync.SyncError("calendar unavailable")

            def close(self):
                self.closed = True

        client = FailedClient()
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "data.json"
            previous = b'{"old":"must survive"}\n'
            target.write_bytes(previous)
            with self.assertRaises(sync.SyncError):
                sync.sync_to_file(target, lambda: client)
            self.assertEqual(target.read_bytes(), previous)
            self.assertEqual(len(list(Path(temporary).iterdir())), 1)
        self.assertTrue(client.closed)

    def test_invalid_success_payload_also_preserves_old_file(self):
        class InvalidClient:
            def initialize(self):
                pass

            def call_tool(self, name):
                return envelope(TABLE) if name == "list-nutrition-foods" else envelope({})

            def close(self):
                pass

        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "data.json"
            target.write_bytes(b"old data")
            with self.assertRaises(sync.SyncError):
                sync.sync_to_file(target, InvalidClient)
            self.assertEqual(target.read_bytes(), b"old data")

    def test_successful_refresh_writes_only_public_json(self):
        class PublicClient:
            calls = []

            def initialize(self):
                pass

            def call_tool(self, name):
                self.calls.append(name)
                return envelope(TABLE) if name == "list-nutrition-foods" else calendar()

            def close(self):
                pass

        client = PublicClient()
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "data.json"
            snapshot = sync.sync_to_file(target, lambda: client)
            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), snapshot)
            self.assertNotIn("PRIVATE", target.read_text(encoding="utf-8"))
            self.assertEqual(len(list(Path(temporary).iterdir())), 1)
        self.assertEqual(client.calls, ["list-nutrition-foods", "campaign-calendar"])


class TransportTests(unittest.TestCase):
    def test_json_and_multiline_sse_with_other_messages(self):
        expected = {"jsonrpc": "2.0", "id": 3, "result": {"ok": True}}
        response = io.BytesIO(json.dumps(expected).encode())
        response.headers = {"Content-Type": "application/json"}
        self.assertEqual(sync.read_rpc_response(response, 3), expected)
        stream = io.BytesIO(b': ping\n\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n'
                            b'data: {"jsonrpc":"2.0","id":3,\n'
                            b'data: "result":{"ok":true}}')
        stream.headers = {"Content-Type": "text/event-stream"}
        self.assertEqual(sync.read_rpc_response(stream, 3), expected)

    def test_missing_auth_and_non_public_tools_are_rejected(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(sync.SyncError):
            sync.McpClient()
        with patch.dict(os.environ, {"MCD_MCP_TOKEN": "TEST_ONLY_NOT_A_REAL_TOKEN"}, clear=True):
            client = sync.McpClient()
        for name in ("query-user", "create-order", "tools/list", "claim-coupon"):
            with self.subTest(name=name), self.assertRaises(sync.SyncError):
                client.call_tool(name)
        with self.assertRaises(sync.SyncError):
            client._rpc("tools/list")

    def test_redirects_are_rejected(self):
        with self.assertRaises(sync.SyncError):
            sync.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.invalid")

    def test_main_does_not_print_raw_errors_or_tokens(self):
        secret = "NEVER_PRINT_THIS_TEST_SECRET"
        with patch.object(sync, "sync_to_file", side_effect=RuntimeError(secret)), \
                patch("sys.stderr", new_callable=io.StringIO) as output:
            self.assertEqual(sync.main(), 1)
            self.assertNotIn(secret, output.getvalue())
            self.assertIn("preserved", output.getvalue())


if __name__ == "__main__":
    unittest.main()
