from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source/enemies/generated-chatgpt-v4"
OUTPUT_DIR = ROOT / "public/assets/enemies"
FRAME_SIZE = 136
PADDING = 2
DIRECTIONS = ("front", "left", "front_left")


def split_strip(path: Path) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    frames = []
    for index in range(5):
        left = round(source.width * index / 5)
        right = round(source.width * (index + 1) / 5)
        tile = source.crop((left, 0, right, source.height))
        bbox = tile.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"{path.name}: frame {index + 1} is empty")
        if bbox[0] <= 2 or bbox[2] >= tile.width - 2 or bbox[1] <= 2 or bbox[3] >= tile.height - 2:
            raise RuntimeError(f"{path.name}: frame {index + 1} touches its source boundary")
        frames.append(tile.crop(bbox))
    return frames


def fit_frames(frames: dict[str, list[Image.Image]]) -> dict[str, list[Image.Image]]:
    all_crops = [frame for row in frames.values() for frame in row]
    scale = min(122 / max(frame.width for frame in all_crops), 123 / max(frame.height for frame in all_crops))
    fitted: dict[str, list[Image.Image]] = {}
    for direction, row in frames.items():
        fitted[direction] = []
        for frame in row:
            resized = frame.resize(
                (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
                Image.Resampling.LANCZOS,
            )
            cell = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            x = round((FRAME_SIZE - resized.width) / 2)
            y = FRAME_SIZE - resized.height - 5
            cell.alpha_composite(resized, (x, y))
            bbox = cell.getchannel("A").getbbox()
            if not bbox or bbox[0] < 4 or bbox[2] > FRAME_SIZE - 4 or bbox[1] < 4 or bbox[3] > FRAME_SIZE - 3:
                raise RuntimeError(f"Packed {direction} frame exceeds safe bounds: {bbox}")
            fitted[direction].append(cell)
    return fitted


def write_compact_sources(frames: dict[str, list[Image.Image]]) -> None:
    for direction, row in frames.items():
        strip = Image.new("RGBA", (FRAME_SIZE * 5, FRAME_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(row):
            strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
        strip.save(SOURCE_DIR / f"boss-{direction}-alpha.png", optimize=True)


def write_atlas(frames: dict[str, list[Image.Image]]) -> None:
    atlas_width = PADDING + 5 * (FRAME_SIZE + PADDING)
    atlas_height = PADDING + 3 * (FRAME_SIZE + PADDING)
    atlas = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    data = {"frames": {}, "meta": {}}
    for row_index, direction in enumerate(DIRECTIONS):
        for frame_index, frame in enumerate(frames[direction]):
            x = PADDING + frame_index * (FRAME_SIZE + PADDING)
            y = PADDING + row_index * (FRAME_SIZE + PADDING)
            atlas.alpha_composite(frame, (x, y))
            key = f"boss_{direction}_{frame_index + 1}"
            data["frames"][key] = {
                "frame": {"x": x, "y": y, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "sourceSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
            }

    image_name = "enemy-boss-smooth-v4.png"
    atlas.save(OUTPUT_DIR / image_name, optimize=True)
    data["meta"] = {
        "app": "Codex ChatGPT Boss v4 packer",
        "version": "4.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": atlas_width, "h": atlas_height},
        "scale": "1",
    }
    (OUTPUT_DIR / "enemy-boss-smooth-v4.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    frames = {
        direction: split_strip(SOURCE_DIR / f"boss-{direction}-alpha.png")
        for direction in DIRECTIONS
    }
    fitted = fit_frames(frames)
    write_compact_sources(fitted)
    write_atlas(fitted)


if __name__ == "__main__":
    main()
