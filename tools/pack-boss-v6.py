from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source" / "enemies" / "generated-chatgpt-v5"
OUTPUT_DIR = ROOT / "public" / "assets" / "enemies"
FRAME_SIZE = 160
PADDING = 2
BASELINE = 156
TARGET_HEIGHT = 146
DIRECTIONS = ("front", "left", "front_left")


def solid_alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda alpha: 255 if alpha >= 32 else 0).getbbox()


def split_packed_strip(path: Path) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    if source.width != FRAME_SIZE * 5 or source.height != FRAME_SIZE:
        raise RuntimeError(f"Expected an 800x160 packed strip: {path.name} is {source.size}")
    return [source.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE)) for index in range(5)]


def sprite_runs(image: Image.Image) -> list[tuple[int, int]]:
    mask = image.getchannel("A").point(lambda alpha: 255 if alpha >= 32 else 0)
    occupied = [mask.crop((x, 0, x + 1, mask.height)).getbbox() is not None for x in range(mask.width)]
    runs: list[tuple[int, int]] = []
    start: int | None = None
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


def normalize_front_left(path: Path) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    normalized: list[Image.Image] = []
    for index, (left, right) in enumerate(sprite_runs(source), start=1):
        isolated = source.crop((left, 0, right, source.height))
        bbox = solid_alpha_bbox(isolated)
        if not bbox:
            raise RuntimeError(f"front_left frame {index} is empty")
        sprite = isolated.crop(bbox)
        scale = min(TARGET_HEIGHT / sprite.height, 150 / sprite.width)
        resized = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
        cell = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        x = round((FRAME_SIZE - resized.width) / 2)
        y = BASELINE - resized.height
        cell.alpha_composite(resized, (x, y))
        packed_bbox = solid_alpha_bbox(cell)
        if not packed_bbox or packed_bbox[0] < 3 or packed_bbox[2] > FRAME_SIZE - 3:
            raise RuntimeError(f"front_left frame {index} exceeds horizontal safe bounds: {packed_bbox}")
        normalized.append(cell)
    return normalized


def build_frames() -> dict[str, list[Image.Image]]:
    return {
        "front": split_packed_strip(SOURCE_DIR / "boss-front-alpha.png"),
        "left": split_packed_strip(SOURCE_DIR / "boss-left-alpha.png"),
        "front_left": normalize_front_left(SOURCE_DIR / "boss-front_left-alpha.png"),
    }


def write_direction_strip(name: str, frames: list[Image.Image]) -> None:
    strip = Image.new("RGBA", (FRAME_SIZE * 5, FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    strip.save(SOURCE_DIR / f"boss-{name}-v6-normalized.png", optimize=True)


def write_review(frames: dict[str, list[Image.Image]]) -> None:
    review = Image.new("RGB", (FRAME_SIZE * 5, FRAME_SIZE * 3), (28, 31, 39))
    draw = ImageDraw.Draw(review)
    for y in range(0, review.height, 16):
        for x in range(0, review.width, 16):
            if (x // 16 + y // 16) % 2 == 0:
                draw.rectangle((x, y, x + 15, y + 15), fill=(36, 40, 50))
    for row_index, direction in enumerate(DIRECTIONS):
        for frame_index, frame in enumerate(frames[direction]):
            review.paste(frame, (frame_index * FRAME_SIZE, row_index * FRAME_SIZE), frame)
    review.save(SOURCE_DIR / "enemy-boss-smooth-v6-review.png", optimize=True)


def write_atlas(frames: dict[str, list[Image.Image]]) -> None:
    atlas_w = PADDING + 5 * (FRAME_SIZE + PADDING)
    atlas_h = PADDING + 3 * (FRAME_SIZE + PADDING)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    data: dict[str, object] = {"frames": {}, "meta": {}}
    frame_data = data["frames"]
    assert isinstance(frame_data, dict)
    for row_index, direction in enumerate(DIRECTIONS):
        for frame_index, frame in enumerate(frames[direction]):
            x = PADDING + frame_index * (FRAME_SIZE + PADDING)
            y = PADDING + row_index * (FRAME_SIZE + PADDING)
            atlas.alpha_composite(frame, (x, y))
            frame_data[f"boss_{direction}_{frame_index + 1}"] = {
                "frame": {"x": x, "y": y, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_SIZE, "h": FRAME_SIZE},
                "sourceSize": {"w": FRAME_SIZE, "h": FRAME_SIZE},
            }

    image_name = "enemy-boss-smooth-v6.png"
    atlas.save(OUTPUT_DIR / image_name, optimize=True)
    data["meta"] = {
        "app": "Merge Towers Boss v6 normalized direction packer",
        "version": "6.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": atlas_w, "h": atlas_h},
        "scale": "1",
    }
    (OUTPUT_DIR / "enemy-boss-smooth-v6.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    frames = build_frames()
    write_direction_strip("front_left", frames["front_left"])
    write_review(frames)
    write_atlas(frames)


if __name__ == "__main__":
    main()
