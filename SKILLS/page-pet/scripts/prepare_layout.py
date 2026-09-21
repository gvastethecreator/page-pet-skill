"""Propose source boxes from real alpha gutters; review overlays before building."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def grid(value):
    try:
        cols, rows = map(int, value.lower().split('x'))
        if not (1 <= cols <= 64 and 1 <= rows <= 64):
            raise ValueError()
        return cols, rows
    except ValueError:
        raise argparse.ArgumentTypeError('Use columns x rows, each from 1 to 64')


def cuts(image, count, axis):
    alpha = image.getchannel("A")
    w, h = image.size
    p = alpha.load()
    profile = ([sum(p[x, y] for y in range(h) if p[x, y] > 16) for x in range(w)] if axis == "x"
               else [sum(p[x, y] for x in range(w) if p[x, y] > 16) for y in range(h)])
    length = len(profile)
    boundaries = [0]
    for index in range(1, count):
        ideal, radius = index * length / count, length / count * .35
        candidates = [v for v in range(max(boundaries[-1] + 1, int(ideal - radius)), min(length, int(ideal + radius))) if profile[v] == 0]
        if not candidates:
            raise ValueError(f"No clear alpha gutter on {axis} near slot {index}; author source boxes or repair source. No grid fallback.")
        runs = []
        for v in candidates:
            if not runs or v > runs[-1][-1] + 1:
                runs.append([v])
            else:
                runs[-1].append(v)
        run = min(runs, key=lambda group: abs((group[0] + group[-1]) / 2 - ideal))
        boundaries.append((run[0] + run[-1]) // 2)
    return [*boundaries, length]


def inspect(source, shape, output):
    image = Image.open(source).convert("RGBA")
    if image.getchannel("A").getextrema()[0] != 0:
        raise ValueError("Source has no transparent alpha")
    cols, rows = shape
    xs = cuts(image, cols, "x")
    boxes = [None] * (cols * rows)
    for col in range(cols):
        ys = cuts(image.crop((xs[col], 0, xs[col+1], image.height)), rows, "y")
        for row in range(rows):
            boxes[row * cols + col] = [xs[col], ys[row], xs[col+1], ys[row+1]]
    preview = Image.new("RGBA", image.size, "#f3f1e9")
    preview.alpha_composite(image)
    draw = ImageDraw.Draw(preview)
    for index, (l, t, r, b) in enumerate(boxes):
        draw.rectangle((l, t, r-1, b-1), outline="#d76131", width=2)
        draw.text((l+4, t+4), str(index), fill="#164947")
    preview.convert("RGB").save(output)
    return {"sourceSha256": digest(source), "sourceSize": list(image.size), "grid": list(shape),
            "method": "adaptive-alpha-gutters", "boxes": boxes}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directions", type=Path, required=True)
    parser.add_argument("--grid", type=grid, required=True)
    parser.add_argument("--reactions", type=Path)
    parser.add_argument("--reaction-grid", type=grid)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        parser.error("Output already exists; use a new inspection directory")
    if bool(args.reactions) != bool(args.reaction_grid):
        parser.error("Supply reactions and reaction-grid together")
    args.out.mkdir(parents=True)
    try:
        sheets = {"directions": inspect(args.directions, args.grid, args.out / "directions-boxes.png")}
        if args.reactions:
            sheets["reactions"] = inspect(args.reactions, args.reaction_grid, args.out / "reactions-boxes.png")
        (args.out / "layout.json").write_text(json.dumps({"version": 1, "frameSemantics": "variants", "sheets": sheets}, indent=2) + "\n", encoding="utf-8")
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    print(f"Review overlays in {args.out.resolve()}; pass the reviewed layout.json to build_pack.py --layout.")
