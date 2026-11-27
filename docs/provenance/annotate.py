"""Annotate the Aeon detail-page screenshot with numbered extraction regions.

Input:  shot-full.png (1440x2230, devicePixelRatio 1 — CSS px == image px)
Output: annotated crops + full map in docs/provenance/

Coordinates were measured live in the browser with getBoundingClientRect()
(+ scroll offsets) — see the eval snippet in the session log.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent

GEO = json.loads((HERE / "geo.json").read_text())

FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
FONT = ImageFont.truetype(FONT_PATH, 17, index=1)       # bold-ish face
FONT_BIG = ImageFont.truetype(FONT_PATH, 22, index=1)

YELLOW = (255, 214, 10, 255)
BLACK = (20, 20, 20, 255)
WHITE = (255, 255, 255, 255)


def chip(draw: ImageDraw.ImageDraw, x: float, y: float, num, font=FONT):
    """Numbered badge straddling the top-left border of the target box —
    sits mostly ABOVE the box so it never covers the annotated content."""
    label = str(num)
    pad = 4
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    w, h = tw + pad * 2, th + pad * 2 + 1
    cy = y - h + 3  # bottom edge slightly overlaps the box border
    draw.rectangle([x, cy, x + w, cy + h], fill=YELLOW, outline=BLACK, width=1)
    draw.text((x + pad - bbox[0], cy + pad - bbox[1]), label, font=font, fill=BLACK)


def box(draw, rect, width=3, color=YELLOW):
    x, y, w, h = rect["x"], rect["y"], rect["w"], rect["h"]
    draw.rectangle([x, y, x + w, y + h], outline=color, width=width)


def annotate(base: Image.Image, items, crop=None, scale=1.0) -> Image.Image:
    """items: list of (num, rect). crop: (x0,y0,x1,y1) window in page px."""
    img = base.copy().convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    for num, rect in items:
        box(draw, rect)
        chip(draw, rect["x"] - 1, rect["y"], num)
    if crop:
        img = img.crop(tuple(int(v) for v in crop))
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    return img


def main():
    base = Image.open(HERE / "shot-full.png")
    g = GEO

    def shift(rect, dx=0, dy=0):
        return {"x": rect["x"] + dx, "y": rect["y"] + dy, "w": rect["w"], "h": rect["h"]}

    # ---- global numbering scheme ----------------------------------------
    header_items = [
        (1, g["breadcrumbs"]),
        (2, g["logo"]),
        (3, g["h1"]),
        (4, g["byline"]),
        (5, g["action_visit"]),
        (6, g["action_github"]),
        (7, g["summary"]),
    ]
    body_items = [
        (8, g["overview"]),
        (9, g["features"]),
    ]
    row_order = ["Website", "Company", "Category", "Source", "Repository", "License",
                 "Commercial offering", "Topics", "Listed", "Last verified"]
    rows = {r["label"]: r for r in g["detail_rows"]}
    details_items = [(10 + i, rows[label]) for i, label in enumerate(row_order)]
    similar_items = [
        (20, g["similar_card_1"]),
        (21, g["more_link"]),
    ]

    # ---- full-page macro map: section blocks only -------------------------
    img = base.copy().convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    for num, rect in header_items + body_items + details_items + similar_items:
        box(draw, rect, width=2)
    for num, rect in header_items + body_items + details_items + similar_items:
        chip(draw, rect["x"] - 1, rect["y"], num)
    img.save(HERE / "annotated-full.png")

    # ---- crops ------------------------------------------------------------
    crops = [
        # (filename, items, crop window, scale)
        ("crop-header.png", header_items, (260, 95, 1190, 340), 1.6),
        ("crop-body.png", body_items, (260, 420, 1190, 835), 1.6),
        ("crop-details.png", details_items, (260, 855, 1190, 1265), 1.6),
        ("crop-similar.png", similar_items, (260, 1290, 1190, 1655), 1.6),
    ]
    for fname, items, window, scale in crops:
        x0, y0, x1, y1 = window
        # annotate at native res, then crop, then upscale
        annotated = annotate(base, items)
        cropped = annotated.crop((int(x0), int(y0), int(x1), int(y1)))
        if scale != 1.0:
            cropped = cropped.resize((int(cropped.width * scale), int(cropped.height * scale)), Image.LANCZOS)
        cropped.save(HERE / fname)
        print(fname, cropped.size)

    print("annotated-full.png", img.size)


if __name__ == "__main__":
    main()
