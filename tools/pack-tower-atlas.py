from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source" / "towers" / "sources-v1"
OUTPUT_DIR = ROOT / "public" / "assets" / "towers"
IMAGE_NAME = "towers-painted-v1.webp"
JSON_NAME = "towers-painted-v1.json"

ELEMENTS = ["fire", "ice", "lightning", "poison", "light"]
VARIANTS = ["base", "a", "b"]
SOURCE_NAMES = {
    "fire": {"base": "fire_base", "a": "fire_explosive_a", "b": "fire_molten_core_b"},
    "ice": {"base": "ice_base", "a": "ice_glacier_a", "b": "ice_shatter_b"},
    "lightning": {"base": "lightning_base", "a": "lightning_storm_a", "b": "lightning_stun_node_b"},
    "poison": {"base": "poison_base", "a": "poison_plague_a", "b": "poison_corrosion_b"},
    "light": {"base": "light_base", "a": "light_judgement_a", "b": "light_radiance_b"},
}

CELL_W = 256
CELL_H = 300
PADDING = 2


def fit_cell(source: Image.Image) -> Image.Image:
    source = source.convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Tower source has no visible pixels")

    crop = source.crop(bbox)
    max_w = CELL_W - 8
    max_h = CELL_H - 8
    scale = min(max_w / crop.width, max_h / crop.height, 1)
    if scale < 1:
        crop = crop.resize(
            (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
            Image.Resampling.LANCZOS,
        )

    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    x = round((CELL_W - crop.width) / 2)
    y = CELL_H - crop.height - 4
    cell.alpha_composite(crop, (x, y))
    return cell


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas_w = PADDING + len(ELEMENTS) * (CELL_W + PADDING)
    atlas_h = PADDING + len(VARIANTS) * (CELL_H + PADDING)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    frames: dict[str, dict] = {}

    for row, variant in enumerate(VARIANTS):
        for col, element in enumerate(ELEMENTS):
            frame_name = SOURCE_NAMES[element][variant]
            source_path = SOURCE_DIR / f"{frame_name}.png"
            if not source_path.exists():
                raise FileNotFoundError(source_path)
            cell = fit_cell(Image.open(source_path))
            x = PADDING + col * (CELL_W + PADDING)
            y = PADDING + row * (CELL_H + PADDING)
            atlas.alpha_composite(cell, (x, y))
            frames[frame_name] = {
                "frame": {"x": x, "y": y, "w": CELL_W, "h": CELL_H},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": CELL_W, "h": CELL_H},
                "sourceSize": {"w": CELL_W, "h": CELL_H},
            }

    # WebP keeps the alpha channel while cutting the initial-download cost far
    # below the original PNG. Quality 92 retains the painted detail at runtime
    # display sizes; alpha_quality=100 prevents halos around tower silhouettes.
    atlas.save(
        OUTPUT_DIR / IMAGE_NAME,
        "WEBP",
        quality=92,
        alpha_quality=100,
        method=6,
        exact=True,
    )
    data = {
        "frames": frames,
        "meta": {
            "app": "Codex painted tower atlas packer",
            "version": "1.0",
            "image": IMAGE_NAME,
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }
    (OUTPUT_DIR / JSON_NAME).write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_DIR / IMAGE_NAME}")
    print(f"Wrote {OUTPUT_DIR / JSON_NAME}")


if __name__ == "__main__":
    main()
