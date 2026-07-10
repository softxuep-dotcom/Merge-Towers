from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art-source" / "enemies" / "front-left-v1"
FRAME_OUT_DIR = ROOT / "art-source" / "enemies" / "smooth-3dir-v1"
ATLAS_OUT_DIR = ROOT / "assets" / "enemies"
PREVIEW_OUT = ROOT / "art-source" / "enemies" / "enemy-smooth-3dir-v1-preview.png"

ENEMIES = ["slime", "mini", "runner", "tank", "flyer", "splitter", "boss"]
SOURCE_DIRECTIONS = ["front", "left", "front_left"]
FRAME_COUNT = 5
PADDING = 2

BASE_FRAME = {
    "slime": {"front": 2, "left": 2},
    "mini": {"front": 2, "left": 2},
    "runner": {"front": 2, "left": 2},
    "tank": {"front": 2, "left": 3},
    "flyer": {"front": 2, "left": 2},
    "splitter": {"front": 2, "left": 2},
    "boss": {"front": 2, "left": 2},
}

MOTION = {
    "slime": {"bob": 1.4, "squash": 0.030, "stride": 0.0},
    "mini": {"bob": 1.2, "squash": 0.035, "stride": 0.0},
    "runner": {"bob": 2.1, "squash": 0.018, "stride": 1.4},
    "tank": {"bob": 0.8, "squash": 0.010, "stride": 0.7},
    "flyer": {"bob": 3.0, "squash": 0.008, "stride": 0.8},
    "splitter": {"bob": 1.2, "squash": 0.018, "stride": 0.4},
    "boss": {"bob": 1.0, "squash": 0.010, "stride": 0.5},
}

SOURCE_SEQUENCE = {
    "slime": [1, 2, 3, 4, 1],
    "mini": [1, 2, 3, 4, 1],
    "runner": [1, 2, 3, 4, 1],
    "tank": [2, 3, 4, 3, 2],
    "flyer": [2, 1, 4, 1, 2],
    "splitter": [1, 2, 3, 4, 1],
    "boss": [2, 3, 4, 3, 2],
}

def load_base(enemy: str, direction: str) -> Image.Image:
    frame = BASE_FRAME.get(enemy, {}).get(direction, 2)
    path = SOURCE_DIR / f"{enemy}_{direction}_{frame}.png"
    if not path.exists() and direction == "front_left":
        path = SOURCE_DIR / f"{enemy}_left_{BASE_FRAME.get(enemy, {}).get('left', 2)}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def load_source_frame(enemy: str, direction: str, frame: int) -> Image.Image:
    source_direction = "left" if direction == "front_left" else direction
    path = SOURCE_DIR / f"{enemy}_{source_direction}_{frame}.png"
    if not path.exists():
        path = SOURCE_DIR / f"{enemy}_{source_direction}_{BASE_FRAME.get(enemy, {}).get(source_direction, 2)}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    return img.getchannel("A").getbbox() or (0, 0, img.width, img.height)


def paste_bottom_center(canvas: Image.Image, sprite: Image.Image, dx: float = 0, dy: float = 0) -> Image.Image:
    bbox = alpha_bbox(sprite)
    cropped = sprite.crop(bbox)
    out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    x = round(canvas.width / 2 - cropped.width / 2 + dx)
    y = round(canvas.height - (sprite.height - bbox[3]) - cropped.height + dy)
    out.alpha_composite(cropped, (x, y))
    return out


def stabilized_pose(base: Image.Image, source: Image.Image, enemy: str) -> Image.Image:
    return paste_bottom_center(base, source)


def transform_frame(base: Image.Image, enemy: str, direction: str, frame_index: int, source: Image.Image) -> Image.Image:
    base = stabilized_pose(base, source, enemy)
    motion = MOTION[enemy]
    phase = frame_index / FRAME_COUNT * math.tau
    bob = -math.sin(phase) * motion["bob"]
    squash = math.cos(phase) * motion["squash"]
    stride = math.sin(phase) * motion["stride"]
    if direction == "front":
        stride *= 0.35
    elif direction == "front_left":
        stride *= 0.65

    bbox = alpha_bbox(base)
    sprite = base.crop(bbox)
    scaled_w = max(1, round(sprite.width * (1 + squash * 0.55)))
    scaled_h = max(1, round(sprite.height * (1 - squash)))
    sprite = sprite.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

    if frame_index in (1, 3):
        sprite = ImageEnhance.Brightness(sprite).enhance(1.015)

    return paste_bottom_center(base, sprite, stride, bob)


def build_frames(enemy: str) -> dict[str, list[Image.Image]]:
    frames: dict[str, list[Image.Image]] = {}
    for direction in SOURCE_DIRECTIONS:
        base = load_base(enemy, direction)
        direction_frames = []
        for index in range(FRAME_COUNT):
            source = load_source_frame(enemy, direction, SOURCE_SEQUENCE[enemy][index])
            direction_frames.append(transform_frame(base, enemy, direction, index, source))
        frames[direction] = direction_frames
    return frames


def write_source_frames(enemy: str, frames: dict[str, list[Image.Image]]) -> None:
    FRAME_OUT_DIR.mkdir(parents=True, exist_ok=True)
    for direction, direction_frames in frames.items():
        for index, img in enumerate(direction_frames, start=1):
            img.save(FRAME_OUT_DIR / f"{enemy}_{direction}_{index}.png")


def pack_atlas(enemy: str, frames: dict[str, list[Image.Image]]) -> None:
    ATLAS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    cell_w = max(img.width for direction_frames in frames.values() for img in direction_frames)
    cell_h = max(img.height for direction_frames in frames.values() for img in direction_frames)
    atlas_w = PADDING + FRAME_COUNT * (cell_w + PADDING)
    atlas_h = PADDING + len(SOURCE_DIRECTIONS) * (cell_h + PADDING)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    atlas_frames = {}

    for row, direction in enumerate(SOURCE_DIRECTIONS):
      for col, img in enumerate(frames[direction]):
        x = PADDING + col * (cell_w + PADDING)
        y = PADDING + row * (cell_h + PADDING)
        atlas.alpha_composite(img, (x, y))
        frame_name = f"{enemy}_{direction}_{col + 1}"
        atlas_frames[frame_name] = {
            "frame": {"x": x, "y": y, "w": cell_w, "h": cell_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": cell_w, "h": cell_h},
            "sourceSize": {"w": cell_w, "h": cell_h},
        }

    image_name = f"enemy-{enemy}-smooth-v1.png"
    atlas.save(ATLAS_OUT_DIR / image_name)
    data = {
        "frames": atlas_frames,
        "meta": {
            "app": "Codex smooth enemy atlas builder",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }
    (ATLAS_OUT_DIR / f"enemy-{enemy}-smooth-v1.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def make_preview(all_frames: dict[str, dict[str, list[Image.Image]]]) -> None:
    cell_w = max(img.width for frames in all_frames.values() for rows in frames.values() for img in rows)
    cell_h = max(img.height for frames in all_frames.values() for rows in frames.values() for img in rows)
    label_w = 88
    header_h = 24
    row_h = cell_h + 32
    col_w = cell_w + 8
    sheet_w = label_w + len(SOURCE_DIRECTIONS) * FRAME_COUNT * col_w + 24
    sheet_h = header_h + len(ENEMIES) * row_h + 16
    bg = Image.new("RGBA", (sheet_w, sheet_h), (35, 40, 43, 255))

    checker = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    for y in range(0, sheet_h, 16):
        for x in range(0, sheet_w, 16):
            shade = 42 if (x // 16 + y // 16) % 2 == 0 else 50
            tile = Image.new("RGBA", (16, 16), (shade, shade + 4, shade + 6, 255))
            checker.alpha_composite(tile, (x, y))
    bg = Image.alpha_composite(bg, checker)
    draw = ImageDraw.Draw(bg)

    for direction_index, direction in enumerate(SOURCE_DIRECTIONS):
        x = label_w + direction_index * FRAME_COUNT * col_w
        draw.text((x, 4), direction, fill=(215, 225, 230, 255))

    for enemy_index, enemy in enumerate(ENEMIES):
        y = header_h + enemy_index * row_h
        draw.text((10, y + cell_h // 2), enemy.upper(), fill=(240, 245, 246, 255))
        for direction_index, direction in enumerate(SOURCE_DIRECTIONS):
            for frame_index, img in enumerate(all_frames[enemy][direction]):
                x = label_w + (direction_index * FRAME_COUNT + frame_index) * col_w
                preview_cell = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
                preview_cell.alpha_composite(img, ((cell_w - img.width) // 2, cell_h - img.height))
                bg.alpha_composite(preview_cell, (x, y + 24))

    PREVIEW_OUT.parent.mkdir(parents=True, exist_ok=True)
    bg.convert("RGB").save(PREVIEW_OUT)


def main() -> None:
    all_frames = {}
    for enemy in ENEMIES:
        frames = build_frames(enemy)
        write_source_frames(enemy, frames)
        pack_atlas(enemy, frames)
        all_frames[enemy] = frames
    make_preview(all_frames)


if __name__ == "__main__":
    main()
