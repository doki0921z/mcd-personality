"""Build static WeChat-friendly result pages and ordinary HTTPS poster images.

Run from any directory with Python 3.12 and Node on PATH. Optional packages live
only in .build/vendor; the deployed site remains dependency-free.
Original sprite rectangles, profile copy, and the licensed HappyPixel font are
read directly from the site. Existing third-party license files are untouched.
"""
from __future__ import annotations

import html
import io
import json
from pathlib import Path
import re
import subprocess
import sys

WORK = Path(__file__).resolve().parent
ROOT = WORK.parent
sys.path.insert(0, str(ROOT / ".build" / "vendor"))

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
import qrcode

PUBLIC = "https://doki0921z.github.io/mcd-personality/"
INK = "#59362b"


def source_data() -> dict:
    # Import real ES modules rather than maintaining a second set of profiles.
    script = (
        f"const data=await import({json.dumps((ROOT / 'data.js').as_uri())});"
        f"const art=await import({json.dumps((ROOT / 'art.js').as_uri())});"
        "process.stdout.write(JSON.stringify({profiles:data.profiles,sprites:art.sprites}));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        capture_output=True, check=True, encoding="utf-8",
    )
    return json.loads(result.stdout)


def load_font() -> bytes:
    font = TTFont(ROOT / "assets" / "happy-pixel.woff2")
    font.flavor = None
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def make_poster(profile: dict, sprite: list, font_bytes: bytes, target: Path) -> None:
    image = Image.new("RGB", (1080, 1440), "#fff6dc")
    draw = ImageDraw.Draw(image)
    fonts = {}

    def font(size):
        if size not in fonts:
            fonts[size] = ImageFont.truetype(io.BytesIO(font_bytes), size)
        return fonts[size]

    def rect(x, y, width, height, color):
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=color)

    def text(value, x, baseline, size, color, align="center"):
        anchor = {"left": "ls", "center": "ms", "right": "rs"}[align]
        draw.text((x, baseline), value, font=font(size), fill=color, anchor=anchor)

    def wrap(value, x, baseline, size, color, max_width, line_height):
        line = ""
        for character in value:
            if line and draw.textlength(line + character, font=font(size)) > max_width:
                text(line, x, baseline, size, color)
                line, baseline = character, baseline + line_height
            else:
                line += character
        if line:
            text(line, x, baseline, size, color)

    for x in range(12, 1080, 16):
        for y in range(12, 1440, 16):
            rect(x, y, 2, 2, "#eddfbe")
    rect(54, 54, 978, 1332, INK)
    rect(42, 42, 978, 1332, "#fffdf3")
    rect(46, 46, 970, 96, "#ffdc7a")
    rect(46, 140, 970, 4, INK)
    text("麦麦人格研究所", 78, 105, 32, INK, "left")
    text("HAPPINESS.EXE", 981, 103, 24, INK, "right")
    text("叮！我的快乐人格是", 540, 207, 28, "#a28765")
    for x in range(234, 846, 24):
        for y in range(241, 601, 24):
            color = "#fbf1da" if ((x - 234) // 24 + (y - 241) // 24) % 2 == 0 else "#fff9e9"
            rect(x, y, 24, 24, color)
    for x, y, width, height, color in sprite:
        rect(348 + x * 12, 225 + y * 12, width * 12, height * 12, color)
    text(profile["name"], 540, 680, 60, "#e95141")
    text(profile["role"], 540, 738, 36, INK)
    widths = [draw.textlength("# " + tag, font=font(24)) + 34 for tag in profile["tags"]]
    tag_x = (1080 - sum(widths) - 24) / 2
    for tag, width in zip(profile["tags"], widths):
        rect(tag_x, 774, width, 49, "#ffefc2")
        draw.rectangle((tag_x - 1, 773, tag_x + width, 823), outline="#e3c997", width=2)
        text("# " + tag, tag_x + width / 2, 807, 24, "#95714f")
        tag_x += width + 12
    text("“", 540, 885, 60, "#e95141")
    wrap(profile["quote"], 540, 928, 32, INK, 810, 46)
    wrap(profile["recipe"], 540, 1030, 25, "#a58c70", 810, 38)
    for x in range(77, 985, 18):
        draw.line((x, 1090, min(x + 10, 985), 1090), fill="#d7c4a6", width=3)
    text("你是哪一款快乐？", 88, 1171, 34, INK, "left")
    text("扫码看看我的人格，也测测你的", 88, 1220, 24, "#a38a70", "left")
    text("5 道题 · 8 款人格 · 约 1 分钟", 88, 1259, 24, "#a38a70", "left")
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
    qr.add_data(f"{PUBLIC}share/{profile['id']}.html", optimize=0)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    unit = 208 // len(matrix)
    qr_size = len(matrix) * unit
    qr_x, qr_y = 981 - qr_size, 1120
    rect(qr_x, qr_y, qr_size, qr_size, "#ffffff")
    for row, modules in enumerate(matrix):
        for col, dark in enumerate(modules):
            if dark:
                rect(qr_x + col * unit, qr_y + row * unit, unit, unit, INK)
    text("非官方趣味创作 · 仅供娱乐 · 快乐没有标准答案", 540, 1340, 20, "#b09b82")
    image.save(target, "PNG", optimize=True)


def result_html(source: str, profile: dict) -> str:
    # Re-clone the current root HTML on every run so application fixes propagate.
    page = re.sub(r"<base\b[^>]*>\s*", "", source, flags=re.I)
    page = re.sub(r"\s*<meta\b[^>]*charset\s*=[^>]*>", "", page, flags=re.I)
    page = re.sub(r"\s*<title\b[^>]*>.*?</title>", "", page, flags=re.I | re.S)
    page = re.sub(
        r"\s*<meta\b(?=[^>]*(?:name|property)\s*=\s*['\"](?:description|og:[^'\"]*|twitter:[^'\"]*)['\"])[^>]*>",
        "", page, flags=re.I,
    )
    page = re.sub(
        r"\s*<link\b(?=[^>]*rel\s*=\s*['\"]canonical['\"])[^>]*>",
        "", page, flags=re.I,
    )
    title = f"我是{profile['name']}｜麦麦人格研究所"
    description = f"{profile['role']}：{profile['quote']} 5 道题，测测你是哪一款麦麦快乐。"
    url = f"{PUBLIC}share/{profile['id']}.html"
    poster = f"{PUBLIC}assets/cards/{profile['id']}.png"
    escaped = lambda value: html.escape(str(value), quote=True)
    tags = [
        '  <base href="../">',
        '  <meta charset="UTF-8">',
        f"  <title>{escaped(title)}</title>",
        f'  <meta name="description" content="{escaped(description)}">',
        f'  <link rel="canonical" href="{escaped(url)}">',
        '  <meta property="og:type" content="website">',
        f'  <meta property="og:title" content="{escaped(title)}">',
        f'  <meta property="og:description" content="{escaped(description)}">',
        f'  <meta property="og:url" content="{escaped(url)}">',
        f'  <meta property="og:image" content="{escaped(poster)}">',
        '  <meta property="og:image:type" content="image/png">',
        '  <meta property="og:image:width" content="1080">',
        '  <meta property="og:image:height" content="1440">',
        f'  <meta property="og:image:alt" content="{escaped(profile["name"] + "像素快乐人格卡")}">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{escaped(title)}">',
        f'  <meta name="twitter:description" content="{escaped(description)}">',
        f'  <meta name="twitter:image" content="{escaped(poster)}">',
    ]
    return re.sub(r"<head\b[^>]*>", lambda match: match.group(0) + "\n" + "\n".join(tags), page, count=1, flags=re.I)


def main():
    data = source_data()
    font_bytes = load_font()
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    cards = ROOT / "assets" / "cards"
    pages = ROOT / "share"
    cards.mkdir(parents=True, exist_ok=True)
    pages.mkdir(parents=True, exist_ok=True)
    summary = []
    for profile in data["profiles"]:
        poster = cards / f"{profile['id']}.png"
        page = pages / f"{profile['id']}.html"
        make_poster(profile, data["sprites"][profile["id"]], font_bytes, poster)
        page.write_text(result_html(source, profile), encoding="utf-8", newline="\n")
        summary.append({"id": profile["id"], "image": str(poster), "dimensions": [1080, 1440], "bytes": poster.stat().st_size, "html_bytes": page.stat().st_size})
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
