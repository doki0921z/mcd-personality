#!/usr/bin/env python3
"""Refresh the site's public nutrition/calendar snapshot from McDonald's MCP.

Set MCD_MCP_TOKEN in the process environment, then run this script. The token,
MCP envelopes, coupon data and account data are never written to disk. Both
read-only tools must succeed before the previous public snapshot is replaced.
"""

import csv
import io
import json
import math
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ENDPOINT = "https://mcp.mcd.cn"
ALLOWED_TOOLS = frozenset(("list-nutrition-foods", "campaign-calendar"))
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "mcd-public-data.json"
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
PROFILE_PRODUCTS = {
    "bigmac": ("巨无霸", "1个"),
    "fries": ("中薯条", "中份"),
    "nuggets": ("麦乐鸡5块", "5块"),
    "spicy": ("麦辣鸡腿汉堡", "1个"),
    "mcflurry": ("奥利奥麦旋风", "1份"),
    "pie": ("香芋派", "1个"),
    "cola": ("可乐中杯", "中杯"),
    "coffee": ("冰美式中杯", "中杯"),
}
NUTRIENTS = ("energyKcal", "protein", "fat", "carbohydrate", "sodium", "calcium")


class SyncError(Exception):
    """A validation or transport failure, without raw server/account details."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Authorization must only ever reach the fixed official HTTPS endpoint.
        raise SyncError("MCP endpoint redirected")


def read_rpc_response(response, request_id):
    """Read a JSON response or the matching JSON-RPC message in an SSE stream."""
    content_type = response.headers.get("Content-Type", "")
    if "text/event-stream" not in content_type.lower():
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise SyncError("MCP response too large")
        try:
            message = json.loads(raw)
        except (ValueError, UnicodeError):
            raise SyncError("Invalid MCP JSON") from None
        if not isinstance(message, dict) or message.get("id") != request_id:
            raise SyncError("Unexpected MCP response")
        return message

    chunks = []
    byte_count = 0
    started = time.monotonic()

    def decode_event():
        try:
            message = json.loads("\n".join(chunks))
        except ValueError:
            raise SyncError("Invalid MCP SSE data") from None
        if isinstance(message, dict) and message.get("id") == request_id:
            return message
        return None

    for raw in response:
        byte_count += len(raw)
        if byte_count > MAX_RESPONSE_BYTES or time.monotonic() - started > 60:
            raise SyncError("MCP stream exceeded limits")
        try:
            line = raw.decode("utf-8").rstrip("\r\n")
        except UnicodeError:
            raise SyncError("Invalid MCP stream encoding") from None
        if line.startswith("data:"):
            chunks.append(line[5:].lstrip(" "))
        elif not line and chunks:
            message = decode_event()
            chunks.clear()
            if message is not None:
                return message
    if chunks:
        message = decode_event()
        if message is not None:
            return message
    raise SyncError("MCP stream ended without response")


class McpClient:
    def __init__(self):
        token = os.environ.get("MCD_MCP_TOKEN", "").strip()
        if not token or "\r" in token or "\n" in token:
            raise SyncError("MCD_MCP_TOKEN is missing or invalid")
        self._token = token
        self._session = None
        self._protocol = "2025-03-26"
        self._sequence = 0
        self._opener = urllib.request.build_opener(NoRedirect())

    def _headers(self):
        headers = {
            "Authorization": "Bearer " + self._token,
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": self._protocol,
        }
        if self._session:
            headers["Mcp-Session-Id"] = self._session
        return headers

    def _rpc(self, method, params=None, notification=False):
        if method not in ("initialize", "notifications/initialized", "tools/call"):
            raise SyncError("MCP method is not allowed")
        if method == "tools/call" and (
            not isinstance(params, dict) or params.get("name") not in ALLOWED_TOOLS
        ):
            raise SyncError("MCP tool is not allowed")
        self._sequence += 1
        message = {"jsonrpc": "2.0", "method": method}
        if not notification:
            message["id"] = self._sequence
        if params is not None:
            message["params"] = params
        request = urllib.request.Request(
            ENDPOINT,
            data=json.dumps(message).encode("utf-8"),
            headers=self._headers(),
            method="POST",
        )
        try:
            with self._opener.open(request, timeout=35) as response:
                session = response.headers.get("Mcp-Session-Id", self._session)
                if session is not None:
                    if not isinstance(session, str) or len(session) > 1024 or any(
                        char in session for char in "\r\n"
                    ):
                        raise SyncError("Invalid MCP session")
                    self._session = session
                if notification:
                    return None
                data = read_rpc_response(response, message["id"])
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
            raise SyncError("MCP request failed") from None
        if data.get("error") is not None or not isinstance(data.get("result"), dict):
            raise SyncError("MCP request was unsuccessful")
        return data["result"]

    def initialize(self):
        result = self._rpc("initialize", {
            "protocolVersion": self._protocol,
            "capabilities": {},
            "clientInfo": {"name": "mcd-personality-public-data", "version": "1.0.0"},
        })
        protocol = result.get("protocolVersion")
        if protocol not in ("2024-11-05", "2025-03-26", "2025-06-18"):
            raise SyncError("Unsupported MCP protocol")
        self._protocol = protocol
        self._rpc("notifications/initialized", notification=True)

    def call_tool(self, name):
        if name not in ALLOWED_TOOLS:
            raise SyncError("MCP tool is not allowed")
        return self._rpc("tools/call", {"name": name, "arguments": {}})

    def close(self):
        if not self._session:
            return
        request = urllib.request.Request(ENDPOINT, headers=self._headers(), method="DELETE")
        try:
            with self._opener.open(request, timeout=8):
                pass
        except (SyncError, urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
            pass


def tool_payload(result):
    """Use structured data, or decode the official text-envelope JSON fallback."""
    if not isinstance(result, dict) or result.get("isError"):
        raise SyncError("Tool response failed")
    payload = result.get("structuredContent")
    if not isinstance(payload, dict):
        payload = None
        for item in result.get("content", []):
            if not isinstance(item, dict) or not isinstance(item.get("text"), str):
                continue
            text = item["text"].split("## Original Response", 1)[-1]
            start = text.find("{")
            if start < 0:
                continue
            try:
                candidate, _ = json.JSONDecoder().raw_decode(text[start:])
            except ValueError:
                continue
            if isinstance(candidate, dict) and "data" in candidate:
                payload = candidate
                break
    if not isinstance(payload, dict) or payload.get("code") != 200 or payload.get("success") is False:
        raise SyncError("Tool payload was unsuccessful")
    if "data" not in payload:
        raise SyncError("Tool payload data is missing")
    return payload["data"]


def parse_nutrition(result):
    data = tool_payload(result)
    if not isinstance(data, str):
        raise SyncError("Nutrition table is missing")
    lines = data.strip().splitlines()
    header = re.fullmatch(r"\[(\d+)\]\{([^{}]+)\}:\s*", lines[0]) if lines else None
    if not header:
        raise SyncError("Invalid nutrition table header")
    fields = [field.strip() for field in header[2].split(",")]
    required = {"productName", *NUTRIENTS}
    if not required.issubset(fields) or len(set(fields)) != len(fields):
        raise SyncError("Nutrition columns are missing or ambiguous")
    try:
        rows = list(csv.reader(io.StringIO("\n".join(lines[1:])), skipinitialspace=True, strict=True))
    except csv.Error:
        raise SyncError("Invalid nutrition CSV") from None
    if len(rows) != int(header[1]) or any(len(row) != len(fields) for row in rows):
        raise SyncError("Nutrition row count or columns changed")
    products = {}
    wanted = {name for name, _ in PROFILE_PRODUCTS.values()}
    for row in rows:
        record = dict(zip(fields, (value.strip() for value in row)))
        name = record["productName"]
        if name not in wanted:
            continue
        if name in products:
            raise SyncError("A selected nutrition product is ambiguous")
        selected = {"productName": name}
        for nutrient in NUTRIENTS + (("energyKj",) if "energyKj" in fields else ()):
            try:
                number = float(record[nutrient])
            except ValueError:
                raise SyncError("A selected nutrient is missing") from None
            if not math.isfinite(number) or number < 0:
                raise SyncError("A selected nutrient is invalid")
            selected[nutrient] = int(number) if number.is_integer() else number
        products[name] = selected
    if products.keys() != wanted:
        raise SyncError("A selected nutrition product is missing")
    return {
        profile: {**products[name], "serving": serving}
        for profile, (name, serving) in PROFILE_PRODUCTS.items()
    }


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked = None

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "iframe", "object"):
            self.blocked = tag
        elif not self.blocked and tag in ("br", "p", "div", "li"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == self.blocked:
            self.blocked = None
        elif not self.blocked and tag in ("p", "div", "li"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)


def plain_text(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise SyncError("Calendar text is invalid")
    parser = PlainText()
    parser.feed(value)
    parser.close()
    text = "".join(parser.parts).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"(?i)\b[a-z][a-z0-9+.-]*://[^\s<>]+", "", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = "\n".join(re.sub(r"[^\S\n]+", " ", line).strip() for line in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def parse_calendar(result):
    data = tool_payload(result)
    if not isinstance(data, dict) or not isinstance(data.get("dailyList"), list):
        raise SyncError("Calendar days are missing")
    try:
        current = datetime.fromisoformat(data["currentTime"])
    except (KeyError, TypeError, ValueError):
        raise SyncError("Calendar date is invalid") from None
    month = current.strftime("%Y-%m")
    days = {}
    for day in data["dailyList"]:
        if not isinstance(day, dict) or not isinstance(day.get("events"), list):
            raise SyncError("Calendar events are missing")
        try:
            day_date = date.fromisoformat(day["date"]).isoformat()
        except (KeyError, TypeError, ValueError):
            raise SyncError("Calendar day is invalid") from None
        if not day_date.startswith(month + "-"):
            continue
        events = days.setdefault(day_date, [])
        for event in day["events"]:
            if not isinstance(event, dict):
                raise SyncError("Calendar event is invalid")
            article = event.get("articleDto") or {}
            if not isinstance(article, dict):
                raise SyncError("Calendar article is invalid")
            # Explicit allowlist: never copy couponInfo/subscribedEvents/IDs/links.
            title = plain_text(event.get("activityTitle")) or plain_text(article.get("title"))
            if not title:
                raise SyncError("Calendar event title is missing")
            public_event = {
                "title": title,
                "subtitle": plain_text(event.get("activitySubTitle")),
                "content": plain_text(article.get("content")),
            }
            if public_event not in events:
                events.append(public_event)
    if not days:
        raise SyncError("Calendar has no days in its reported month")
    return {"month": month, "days": [{"date": key, "events": days[key]} for key in sorted(days)]}


def build_public_snapshot(nutrition_result, calendar_result, synced_at=None):
    return {
        "schemaVersion": 1,
        "syncedAt": synced_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": ENDPOINT,
        "nutrition": parse_nutrition(nutrition_result),
        "calendar": parse_calendar(calendar_result),
    }


def write_snapshot(snapshot, output):
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=output.parent,
                                         prefix=".mcd-public-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(snapshot, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, output)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def sync_to_file(output=OUTPUT, client_factory=McpClient):
    client = client_factory()
    try:
        client.initialize()
        nutrition = client.call_tool("list-nutrition-foods")
        calendar = client.call_tool("campaign-calendar")
        snapshot = build_public_snapshot(nutrition, calendar)
    finally:
        client.close()
    write_snapshot(snapshot, output)
    return snapshot


def main():
    try:
        sync_to_file()
    except Exception:
        # Never print an exception/response that might contain authorization data.
        print("Sync failed; existing public snapshot preserved.", file=sys.stderr)
        return 1
    print("Updated public nutrition and calendar data.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
