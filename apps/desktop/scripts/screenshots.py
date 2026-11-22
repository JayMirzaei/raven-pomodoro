"""Renders docs/widget.png: the widget in its main states, for the README.

It loads the real built renderer (out/renderer/widget/index.html, from
`npm run build`) in headless Chromium and replaces the preload bridge
(window.raven) with a stub that returns a fixed timer state, so no Electron
main process, account or network is needed. Only the timer state is stubbed;
the HTML, CSS and sprites are the app's own.

Run from apps/desktop after building:
    uv run --with playwright --with pillow python scripts/screenshots.py
"""

import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
RENDERER = HERE.parent / "out" / "renderer"
WIDGET = RENDERER / "widget" / "index.html"
OUT = HERE.parent.parent.parent / "docs" / "widget.png"

SIZE = 192
SCALE = 2
WORK, BREAK = 25 * 60, 5 * 60

# (caption, timer state, hover?)
STATES = [
    ("Paused: click to start", {"phase": "work", "remainingSeconds": WORK, "paused": True}, False),
    ("Working", {"phase": "work", "remainingSeconds": 15 * 60 + 42, "paused": False}, False),
    ("Hover shows the time", {"phase": "work", "remainingSeconds": 15 * 60 + 42, "paused": False}, True),
    ("Break", {"phase": "break", "remainingSeconds": 3 * 60 + 10, "paused": False}, False),
]

STUB = """
window.raven = {
  getState: () => Promise.resolve(STATE),
  togglePause: () => Promise.resolve(STATE),
  skipPhase: () => Promise.resolve(STATE),
  onState: () => () => {},
  dragStart() {}, dragMove() {}, dragEnd() {},
  signIn: () => Promise.resolve(),
};
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve_renderer():
    """Serves out/renderer on a free localhost port (Chromium refuses module scripts over file://)."""
    handler = functools.partial(QuietHandler, directory=str(RENDERER))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def render(page, url, state, hover):
    full = {**state, "counts": {"today": 3, "week": 11, "allTime": 42}}
    page.add_init_script(STUB.replace("STATE", json.dumps(full)))
    page.goto(url)
    # Freeze the sprite animation on its first frame and skip the ring easing.
    page.add_style_tag(content=".sprite{animation:none!important}.ring-progress{transition:none!important}")
    page.wait_for_timeout(200)
    # The viewport is a little larger than the widget so the pointer can rest
    # outside it; the screenshot is clipped back to the widget.
    if hover:
        page.hover("#raven")
    else:
        page.mouse.move(SIZE + 7, SIZE + 7)
    page.wait_for_timeout(300)
    clip = {"x": 0, "y": 0, "width": SIZE, "height": SIZE}
    return Image.open(BytesIO(page.screenshot(omit_background=True, clip=clip)))


def main():
    if not WIDGET.exists():
        raise SystemExit(f"{WIDGET} not found: run `npm run build` in apps/desktop first")

    server = serve_renderer()
    url = f"http://127.0.0.1:{server.server_address[1]}/widget/index.html"
    shots = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for caption, state, hover in STATES:
            page = browser.new_page(viewport={"width": SIZE + 8, "height": SIZE + 8}, device_scale_factor=SCALE)
            shots.append((caption, render(page, url, state, hover)))
            page.close()
        browser.close()
    server.shutdown()

    cell, pad, label_h = SIZE * SCALE, 24, 44
    sheet = Image.new("RGB", (len(shots) * (cell + pad) + pad, cell + label_h + pad), (63, 68, 82))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    for i, (caption, img) in enumerate(shots):
        x = pad + i * (cell + pad)
        sheet.paste(img, (x, pad), img)
        width = draw.textlength(caption, font=font)
        draw.text((x + (cell - width) / 2, pad + cell + 6), caption, fill=(235, 235, 240), font=font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
