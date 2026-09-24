"""Assemble reviewed source crops into one transparent strip without resampling."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--gutter', type=int, default=32)
    args = parser.parse_args()
    recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    if recipe.get('version') != 1 or not recipe.get('poses'):
        parser.error('recipe version 1 with at least one pose is required')
    crops, records = [], []
    for index, pose in enumerate(recipe['poses']):
        source = (args.recipe.parent / pose['source']).resolve()
        layout_path = (args.recipe.parent / pose['layout']).resolve()
        layout = json.loads(layout_path.read_text(encoding='utf-8'))
        sheet = layout['sheets'][pose.get('sheet', 'directions')]
        image = Image.open(source).convert('RGBA')
        if sheet['sourceSha256'] != digest(source) or sheet['sourceSize'] != list(image.size):
            parser.error(f'stale layout for pose {index}: {source}')
        cell = int(pose['cell'])
        if cell < 0 or cell >= len(sheet['boxes']):
            parser.error(f'invalid cell for pose {index}: {cell}')
        left, top, right, bottom = sheet['boxes'][cell]
        crop = image.crop((left, top, right, bottom))
        alpha = crop.getchannel('A')
        visible = alpha.getbbox()
        if visible is None:
            parser.error(f'empty pose {index}')
        crop = crop.crop(visible)
        crops.append(crop)
        records.append({'source': pose['source'], 'sourceSha256': digest(source),
                        'layout': pose['layout'], 'layoutSha256': digest(layout_path),
                        'cell': cell, 'visibleBox': list(visible)})
    cell_width = max(c.width for c in crops) + args.gutter * 2
    height = max(c.height for c in crops) + args.gutter * 2
    strip = Image.new('RGBA', (cell_width * len(crops), height), (0, 0, 0, 0))
    placements = []
    for index, crop in enumerate(crops):
        x = index * cell_width + (cell_width - crop.width) // 2
        y = height - args.gutter - crop.height
        strip.alpha_composite(crop, (x, y))
        placements.append([x, y, crop.width, crop.height])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(args.out)
    record = {'version': 1, 'recipeSha256': digest(args.recipe),
              'outputSha256': digest(args.out), 'outputSize': list(strip.size),
              'cellWidth': cell_width, 'gutter': args.gutter,
              'poses': records, 'placements': placements,
              'resampling': False}
    args.out.with_suffix('.assembly.json').write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
    print(f'Wrote {args.out} from {len(crops)} reviewed crops without resampling')


if __name__ == '__main__':
    main()
