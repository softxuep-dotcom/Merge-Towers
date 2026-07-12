from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source/enemies/generated-chatgpt-spore-priest-v1"
OUTPUT_DIR = ROOT / "public/assets/enemies"
FRAME_SIZE = 128
PADDING = 2
KEY = "priest"
DIRECTIONS = ("front", "left", "front_left")


def split_strip(path: Path) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A")
    active_columns = []
    for x in range(source.width):
        occupied = sum(1 for y in range(source.height) if alpha.getpixel((x, y)) > 32)
        active_columns.append(occupied > 4)
    runs = []
    start = None
    for x, active in enumerate(active_columns + [False]):
        if active and start is None:
            start = x
        elif not active and start is not None:
            if x - start > 10:
                runs.append((start, x))
            start = None
    if len(runs) != 5:
        raise RuntimeError(f"{path.name}: expected 5 isolated sprites, found {len(runs)}")

    frames = []
    for index, (left, right) in enumerate(runs):
        tile = source.crop((left, 0, right, source.height))
        bbox = tile.getchannel("A").getbbox()
        if not bbox:
            raise RuntimeError(f"{path.name}: empty frame {index + 1}")
        frames.append(tile.crop(bbox))
    return frames


def fit_frames(frames: dict[str, list[Image.Image]]) -> dict[str, list[Image.Image]]:
    all_frames = [frame for row in frames.values() for frame in row]
    scale = min(116 / max(frame.width for frame in all_frames), 119 / max(frame.height for frame in all_frames))
    fitted = {}
    for direction, row in frames.items():
        fitted[direction] = []
        for frame in row:
            resized = frame.resize(
                (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
                Image.Resampling.LANCZOS,
            )
            cell = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            x = round((FRAME_SIZE - resized.width) / 2)
            y = FRAME_SIZE - resized.height - 4
            cell.alpha_composite(resized, (x, y))
            bbox = cell.getchannel("A").getbbox()
            if not bbox or min(bbox[0], bbox[1]) < 3 or bbox[2] > FRAME_SIZE - 3 or bbox[3] > FRAME_SIZE - 2:
                raise RuntimeError(f"Packed {direction} frame exceeds safe bounds: {bbox}")
            fitted[direction].append(cell)
    return fitted


def write_compact_sources(frames: dict[str, list[Image.Image]]) -> None:
    for direction, row in frames.items():
        strip = Image.new("RGBA", (FRAME_SIZE * 5, FRAME_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(row):
            strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
        strip.save(SOURCE_DIR / f"spore_priest-{direction}-alpha.png", optimize=True)


def write_atlas(frames: dict[str, list[Image.Image]]) -> None:
    width = PADDING + 5 * (FRAME_SIZE + PADDING)
    height = PADDING + 3 * (FRAME_SIZE + PADDING)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    data = {"frames": {}, "meta": {}}
    for row_index, direction in enumerate(DIRECTIONS):
        for frame_index, frame in enumerate(frames[direction]):
            x = PADDING + frame_index * (FRAME_SIZE + PADDING)
            y = PADDING + row_index * (FRAME_SIZE + PADDING)
            atlas.alpha_composite(frame, (x, y))
            name = f"{KEY}_{direction}_{frame_index + 1}"
            data["frames"][name] = {
                "frame": {"x": x, "y": y, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "sourceSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
            }

    image_name = "enemy-priest-smooth-v1.png"
    atlas.save(OUTPUT_DIR / image_name, optimize=True)
    data["meta"] = {
        "app": "Codex ChatGPT Spore Priest packer",
        "version": "1.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": width, "h": height},
        "scale": "1",
    }
    (OUTPUT_DIR / "enemy-priest-smooth-v1.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    frames = {
        direction: split_strip(SOURCE_DIR / f"spore_priest-{direction}-alpha.png")
        for direction in DIRECTIONS
    }
    fitted = fit_frames(frames)
    write_compact_sources(fitted)
    write_atlas(fitted)


if __name__ == "__main__":
    main()
