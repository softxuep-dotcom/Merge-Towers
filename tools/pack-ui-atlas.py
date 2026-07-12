from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UI_DIR = ROOT / "public" / "assets" / "ui"
SOURCE_IMAGE = ROOT / "art-source" / "ui" / "ui-components-v1-source.png"
OUTPUT_IMAGE = UI_DIR / "ui-components-v1.webp"
OUTPUT_JSON = UI_DIR / "ui-components-v1.json"
PADDING = 2
ROW_NAMES = (
    ("button_primary", "button_secondary", "button_danger", "button_disabled"),
    ("tab_cyan", "resource_pill", "title_ribbon", "tooltip"),
    ("panel_9slice", "card_portrait", "modal_panel", "boss_bar"),
    ("progress_bar", "tower_slot", "level_badge", "corner_brackets"),
)


def main() -> None:
    source = Image.open(SOURCE_IMAGE).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
    cropped: dict[str, Image.Image] = {}

    for row_index, row in enumerate(ROW_NAMES):
        for col_index, name in enumerate(row):
            tile = source.crop((col_index * 256, row_index * 256, (col_index + 1) * 256, (row_index + 1) * 256))
            bbox = tile.getchannel("A").getbbox()
            if not bbox:
                raise RuntimeError(f"Empty UI component: {name}")
            cropped[name] = tile.crop(bbox)

    row_widths = [sum(cropped[name].width + PADDING for name in row) + PADDING for row in ROW_NAMES]
    row_heights = [max(cropped[name].height for name in row) + PADDING for row in ROW_NAMES]
    atlas_w = max(row_widths)
    atlas_h = PADDING + sum(row_heights)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    out = {"frames": {}, "meta": {}}

    y = PADDING
    for row, row_h in zip(ROW_NAMES, row_heights):
        x = PADDING
        for name in row:
            image = cropped[name]
            cell_y = y + round((row_h - PADDING - image.height) / 2)
            atlas.alpha_composite(image, (x, cell_y))
            out["frames"][name] = {
                "frame": {"x": x, "y": cell_y, "w": image.width, "h": image.height},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": image.width, "h": image.height},
                "sourceSize": {"w": image.width, "h": image.height},
            }
            x += image.width + PADDING
        y += row_h

    out["meta"] = {
        "app": "Merge Towers trimmed UI component packer",
        "version": "1.1",
        "image": OUTPUT_IMAGE.name,
        "format": "RGBA8888",
        "size": {"w": atlas.width, "h": atlas.height},
        "scale": "1",
    }

    temp_image = OUTPUT_IMAGE.with_suffix(".tmp.webp")
    temp_json = OUTPUT_JSON.with_suffix(".tmp.json")
    atlas.save(temp_image, "WEBP", quality=92, alpha_quality=100, method=6, exact=True)
    temp_json.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_image.replace(OUTPUT_IMAGE)
    temp_json.replace(OUTPUT_JSON)


if __name__ == "__main__":
    main()
