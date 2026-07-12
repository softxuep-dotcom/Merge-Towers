from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source" / "enemies" / "generated-chatgpt-v5"
SOURCE_SHEET = SOURCE_DIR / "boss-sheet-alpha.png"
OUTPUT_DIR = ROOT / "public" / "assets" / "enemies"
FRAME_SIZE = 160
PADDING = 2
DIRECTIONS = ("front", "left", "front_left")


def row_bounds(height: int) -> list[int]:
    # The generated sheet keeps clear horizontal gutters, but its three visual rows are
    # not mathematically equal-height. Slice through the empty gutters so crystals from
    # the next row are never mistaken for part of the current frame.
    return [0, round(height * 0.331), round(height * 0.636), height]


def sprite_runs(row_image: Image.Image) -> list[tuple[int, int]]:
    mask = row_image.getchannel("A").point(lambda alpha: 255 if alpha >= 48 else 0)
    occupied = []
    for x in range(mask.width):
        column = mask.crop((x, 0, x + 1, mask.height))
        occupied.append(column.getbbox() is not None)
    runs: list[tuple[int, int]] = []
    start = None
    for x, on in enumerate(occupied + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start > 40:
                runs.append((start, x))
            start = None
    if len(runs) != 5:
        raise RuntimeError(f"Expected five isolated sprites, found {len(runs)}: {runs}")
    return runs


def extract_frames() -> dict[str, list[Image.Image]]:
    source = Image.open(SOURCE_SHEET).convert("RGBA")
    frames: dict[str, list[Image.Image]] = {direction: [] for direction in DIRECTIONS}
    ys = row_bounds(source.height)
    for row, direction in enumerate(DIRECTIONS):
        row_image = source.crop((0, ys[row], source.width, ys[row + 1]))
        for col, (left, right) in enumerate(sprite_runs(row_image)):
            tile = row_image.crop((max(0, left - 2), 0, min(row_image.width, right + 2), row_image.height))
            bbox = tile.getchannel("A").point(lambda alpha: 255 if alpha >= 48 else 0).getbbox()
            if not bbox:
                raise RuntimeError(f"{direction} frame {col + 1} is empty")
            frames[direction].append(tile.crop(bbox))
    return frames


def fit_frames(frames: dict[str, list[Image.Image]]) -> dict[str, list[Image.Image]]:
    all_frames = [frame for row in frames.values() for frame in row]
    scale = min(150 / max(frame.width for frame in all_frames), 151 / max(frame.height for frame in all_frames))
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
            y = FRAME_SIZE - resized.height - 4
            cell.alpha_composite(resized, (x, y))
            bbox = cell.getchannel("A").getbbox()
            if not bbox or bbox[0] < 3 or bbox[2] > FRAME_SIZE - 3 or bbox[1] < 3 or bbox[3] > FRAME_SIZE - 2:
                raise RuntimeError(f"Packed {direction} frame exceeds safe bounds: {bbox}")
            fitted[direction].append(cell)
    return fitted


def write_review_strips(frames: dict[str, list[Image.Image]]) -> None:
    for direction, row in frames.items():
        strip = Image.new("RGBA", (FRAME_SIZE * 5, FRAME_SIZE), (0, 0, 0, 0))
        for index, frame in enumerate(row):
            strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
        strip.save(SOURCE_DIR / f"boss-{direction}-alpha.png", optimize=True)


def write_atlas(frames: dict[str, list[Image.Image]]) -> None:
    atlas_w = PADDING + 5 * (FRAME_SIZE + PADDING)
    atlas_h = PADDING + 3 * (FRAME_SIZE + PADDING)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
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

    image_name = "enemy-boss-smooth-v5.png"
    atlas.save(OUTPUT_DIR / image_name, optimize=True)
    data["meta"] = {
        "app": "Merge Towers corrupted crystal Boss packer",
        "version": "5.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": atlas_w, "h": atlas_h},
        "scale": "1",
    }
    (OUTPUT_DIR / "enemy-boss-smooth-v5.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    frames = fit_frames(extract_frames())
    write_review_strips(frames)
    write_atlas(frames)


if __name__ == "__main__":
    main()
