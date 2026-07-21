"""
Screen capture + JPEG encoding for on-demand teacher screen-viewing.
Captures the PRIMARY monitor only (multi-monitor explicitly out of scope
for this phase). Uses PIL.ImageGrab rather than adding mss as a second
dependency: Pillow is needed anyway to encode JPEG, so ImageGrab.grab()
covers capture AND encode with one new dependency instead of two.
"""
import io

from PIL import ImageGrab

MAX_WIDTH = 1280  # this is a ~1-2s snapshot feed, not video -- no need for native res
JPEG_QUALITY = 55


def capture_jpeg() -> bytes:
    img = ImageGrab.grab(all_screens=False)  # primary monitor only
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()
