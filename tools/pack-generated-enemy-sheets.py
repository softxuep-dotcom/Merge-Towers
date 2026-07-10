from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "art-source" / "enemies" / "generated-chatgpt-v2"
FRAME_OUT = ROOT / "art-source" / "enemies" / "smooth-3dir-v2"
ATLAS_OUT = ROOT / "assets" / "enemies"
PREVIEW_OUT = ROOT / "art-source" / "enemies" / "enemy-smooth-3dir-v2-preview.png"
PADDING = 2


SHEETS = {
    "slime": {"target": 72, "full": SRC / "slime-sheet-alpha.png"},
    "mini": {"target": 52, "full": SRC / "mini-sheet-alpha.png"},
    "runner": {"target": 72, "full": SRC / "runner-sheet-alpha.png"},
    "tank": {"target": 96, "full": SRC / "tank-sheet-alpha.png"},
    "flyer": {"target": 96, "full": SRC / "flyer-sheet-alpha.png"},
    "splitter": {"target": 88, "full": SRC / "splitter-sheet-alpha.png"},
    "boss": {"target": 136, "full": SRC / "boss-sheet-alpha.png"},
}

DIRECTIONS = ["front", "left", "front_left"]


def grid_box(width: int, height: int, cols: int, rows: int, col: int, row: int) -> tuple[int, int, int, int]:
    xs = [round(width * i / cols) for i in range(cols + 1)]
    ys = [round(height * i / rows) for i in range(rows + 1)]
    return xs[col], ys[row], xs[col + 1], ys[row + 1]


def green_to_alpha(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            green_score = g - max(r, b)
            if g > 120 and green_score > 34:
                if green_score > 80:
                    px[x, y] = (r, g, b, 0)
                else:
                    alpha = max(0, min(255, round((80 - green_score) / 46 * 255)))
                    px[x, y] = (r, g, b, alpha)
            elif a > 0 and g > 80 and green_score > 8:
                px[x, y] = (r, min(g, max(r, b) + 6), b, a)
    return img


def prepare_tile(tile: Image.Image, source_path: Path) -> Image.Image:
    if source_path.name.endswith("-alpha.png"):
        return tile.convert("RGBA")
    return green_to_alpha(tile)


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    return img.getchannel("A").getbbox()


def fit_cell(img: Image.Image, size: int, scale: float | None = None, baseline_pad: float = 0.04) -> Image.Image:
    bbox = alpha_bbox(img)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if not bbox:
        return out

    crop = img.crop(bbox)
    max_w = int(size * 0.92)
    max_h = int(size * 0.92)
    if scale is None:
        scale = min(max_w / crop.width, max_h / crop.height, 1)
    resized = crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = round((size - resized.width) / 2)
    y = round(size - resized.height - size * baseline_pad)
    out.alpha_composite(resized, (x, y))
    return out


def fit_row(tiles: list[Image.Image], size: int) -> list[Image.Image]:
    boxes = [alpha_bbox(tile) for tile in tiles]
    crops = [tile.crop(box) for tile, box in zip(tiles, boxes) if box]
    if not crops:
        return [Image.new("RGBA", (size, size), (0, 0, 0, 0)) for _ in tiles]

    max_crop_w = max(crop.width for crop in crops)
    max_crop_h = max(crop.height for crop in crops)
    common_scale = min((size * 0.92) / max_crop_w, (size * 0.92) / max_crop_h, 1)
    return [fit_cell(tile, size, scale=common_scale) for tile in tiles]


def fit_all(frames: dict[str, list[Image.Image]], size: int) -> dict[str, list[Image.Image]]:
    boxes = [
        alpha_bbox(tile)
        for direction_frames in frames.values()
        for tile in direction_frames
    ]
    crops = [
        tile.crop(box)
        for direction_frames in frames.values()
        for tile, box in zip(direction_frames, boxes[:len(direction_frames)])
        if box
    ]
    crops = []
    for direction_frames in frames.values():
        for tile in direction_frames:
            box = alpha_bbox(tile)
            if box:
                crops.append(tile.crop(box))
    if not crops:
        return {
            direction: [Image.new("RGBA", (size, size), (0, 0, 0, 0)) for _ in direction_frames]
            for direction, direction_frames in frames.items()
        }

    max_crop_w = max(crop.width for crop in crops)
    max_crop_h = max(crop.height for crop in crops)
    common_scale = min((size * 0.92) / max_crop_w, (size * 0.92) / max_crop_h, 1)
    return {
        direction: [fit_cell(tile, size, scale=common_scale) for tile in direction_frames]
        for direction, direction_frames in frames.items()
    }


def slice_full_sheet(path: Path, size: int) -> dict[str, list[Image.Image]]:
    source = Image.open(path).convert("RGBA")
    frames: dict[str, list[Image.Image]] = {direction: [] for direction in DIRECTIONS}
    for row, direction in enumerate(DIRECTIONS):
        row_tiles = []
        for col in range(5):
            tile = source.crop(grid_box(source.width, source.height, 5, 3, col, row))
            row_tiles.append(prepare_tile(tile, path))
        frames[direction] = row_tiles
    return frames


def slice_strip(path: Path, size: int) -> list[Image.Image]:
    source = Image.open(path).convert("RGBA")
    tiles = []
    for col in range(5):
        tile = source.crop(grid_box(source.width, source.height, 5, 1, col, 0))
        tiles.append(prepare_tile(tile, path))
    return tiles


def write_frames(enemy: str, frames: dict[str, list[Image.Image]]) -> None:
    FRAME_OUT.mkdir(parents=True, exist_ok=True)
    for direction, direction_frames in frames.items():
        for index, img in enumerate(direction_frames, start=1):
            img.save(FRAME_OUT / f"{enemy}_{direction}_{index}.png")


def write_atlas(enemy: str, frames: dict[str, list[Image.Image]], size: int) -> None:
    ATLAS_OUT.mkdir(parents=True, exist_ok=True)
    atlas_w = PADDING + 5 * (size + PADDING)
    atlas_h = PADDING + 3 * (size + PADDING)
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))
    data = {"frames": {}, "meta": {}}

    for row, direction in enumerate(DIRECTIONS):
        for col, img in enumerate(frames[direction]):
            x = PADDING + col * (size + PADDING)
            y = PADDING + row * (size + PADDING)
            atlas.alpha_composite(img, (x, y))
            name = f"{enemy}_{direction}_{col + 1}"
            data["frames"][name] = {
                "frame": {"x": x, "y": y, "w": size, "h": size},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": size, "h": size},
                "sourceSize": {"w": size, "h": size},
            }

    image_name = f"enemy-{enemy}-smooth-v2.png"
    atlas.save(ATLAS_OUT / image_name)
    data["meta"] = {
        "app": "Codex ChatGPT five-frame three-direction enemy sheet packer",
        "version": "2.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": atlas_w, "h": atlas_h},
        "scale": "1",
    }
    (ATLAS_OUT / f"enemy-{enemy}-smooth-v2.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def make_preview(all_frames: dict[str, dict[str, list[Image.Image]]]) -> None:
    max_size = max(img.width for frames in all_frames.values() for row in frames.values() for img in row)
    label_w = 92
    header_h = 28
    cell_w = max_size + 12
    cell_h = max_size + 12
    sheet_w = label_w + len(DIRECTIONS) * 5 * cell_w + 20
    sheet_h = header_h + len(SHEETS) * cell_h + 20
    preview = Image.new("RGBA", (sheet_w, sheet_h), (35, 40, 43, 255))

    checker = Image.new("RGBA", preview.size, (0, 0, 0, 0))
    for y in range(0, sheet_h, 16):
        for x in range(0, sheet_w, 16):
            shade = 43 if (x // 16 + y // 16) % 2 == 0 else 51
            tile = Image.new("RGBA", (16, 16), (shade, shade + 4, shade + 6, 255))
            checker.alpha_composite(tile, (x, y))
    preview = Image.alpha_composite(preview, checker)
    draw = ImageDraw.Draw(preview)

    for direction_index, direction in enumerate(DIRECTIONS):
        x = label_w + direction_index * 5 * cell_w
        draw.text((x, 7), direction, fill=(220, 230, 234, 255))

    for enemy_index, (enemy, frames) in enumerate(all_frames.items()):
        y = header_h + enemy_index * cell_h
        draw.text((10, y + cell_h // 2), enemy.upper(), fill=(244, 247, 248, 255))
        for direction_index, direction in enumerate(DIRECTIONS):
            for frame_index, img in enumerate(frames[direction]):
                x = label_w + (direction_index * 5 + frame_index) * cell_w
                preview.alpha_composite(img, (x + (max_size - img.width) // 2, y + max_size - img.height))

    PREVIEW_OUT.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(PREVIEW_OUT, optimize=True)


def main() -> None:
    all_frames = {}
    for enemy, spec in SHEETS.items():
        frames = slice_full_sheet(spec["full"], spec["target"])
        frames = fit_all(frames, spec["target"])
        write_frames(enemy, frames)
        write_atlas(enemy, frames, spec["target"])
        all_frames[enemy] = frames
    make_preview(all_frames)


if __name__ == "__main__":
    main()
