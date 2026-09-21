"""Split a reviewed transparent 2x2 pilot into three gaze poses and one reaction.

Source order: neutral, left, right, reaction. Gaze output order: left, neutral, right.
This only copies source pixels into padded cells; it does not redraw the art.
"""
import argparse
import json
import os
from pathlib import Path
from PIL import Image
from prepare_layout import cuts, digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--neutral', type=Path, help='Reviewed replacement front pose when generated neutral is not front-facing')
    parser.add_argument('--left-cell', type=int, choices=(0, 1, 2), default=1)
    parser.add_argument('--right-cell', type=int, choices=(0, 1, 2), default=2)
    args = parser.parse_args()
    if args.left_cell == args.right_cell:
        parser.error('Left and right must use distinct source cells')
    if not args.neutral and 0 in (args.left_cell, args.right_cell):
        parser.error('Cell 0 is the neutral pose unless --neutral replaces it')
    if args.out.exists():
        parser.error('Output exists; choose a new source directory')
    image = Image.open(args.source).convert('RGBA')
    if image.getchannel('A').getextrema()[0] != 0:
        parser.error('Source has no transparent alpha')
    try:
        xs = cuts(image, 2, 'x')
        cells = [None] * 4
        boxes = [None] * 4
        for column in range(2):
            ys = cuts(image.crop((xs[column], 0, xs[column + 1], image.height)), 2, 'y')
            for row in range(2):
                index = row * 2 + column
                box = (xs[column], ys[row], xs[column + 1], ys[row + 1])
                boxes[index] = list(box)
                cells[index] = image.crop(box)
        if any(cell.getchannel('A').getbbox() is None for cell in cells):
            raise ValueError('One pilot cell is empty')
    except ValueError as exc:
        parser.error(str(exc))
    if args.neutral:
        new_neutral = Image.open(args.neutral).convert('RGBA')
        bounds = new_neutral.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        if not bounds:
            parser.error('Replacement neutral is empty')
        new_neutral = new_neutral.crop(bounds)
        heights = []
        for index in (args.left_cell, args.right_cell):
            l, t, r, b = cells[index].getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
            heights.append(b - t)
        target_height = round(sum(heights) / len(heights))
        new_neutral = new_neutral.resize((round(new_neutral.width * target_height / new_neutral.height), target_height), Image.Resampling.LANCZOS)
        cells[0] = new_neutral
    width = max(cell.width for cell in cells) + 48
    height = max(cell.height for cell in cells) + 48
    directions = Image.new('RGBA', (width * 3, height))
    reaction = Image.new('RGBA', (width, height))
    for column, index in enumerate((args.left_cell, 0, args.right_cell)):
        cell = cells[index]
        directions.alpha_composite(cell, (column * width + (width - cell.width) // 2, (height - cell.height) // 2))
    cell = cells[3]
    reaction.alpha_composite(cell, ((width - cell.width) // 2, (height - cell.height) // 2))
    args.out.mkdir(parents=True)
    directions.save(args.out / 'directions.png')
    reaction.save(args.out / 'reactions.png')
    (args.out / 'source.json').write_text(json.dumps({
        'reference': os.path.relpath(args.reference, args.out), 'referenceSha256': digest(args.reference),
        'generatedSource': os.path.relpath(args.source, args.out), 'generatedSourceSha256': digest(args.source),
        'generatedSourceSize': list(image.size), 'sourceBoxes': boxes,
        'directionSourceCells': [args.left_cell, 'replacement' if args.neutral else 0, args.right_cell],
        'replacementNeutral': os.path.relpath(args.neutral, args.out) if args.neutral else None,
        'replacementNeutralSha256': digest(args.neutral) if args.neutral else None,
        'reactionSourceCells': [3],
        'directionsSha256': digest(args.out / 'directions.png'),
        'reactionsSha256': digest(args.out / 'reactions.png'),
    }, indent=2) + '\n', encoding='utf-8')
    print(f'Prepared 3 gaze poses and 1 reaction: {args.out.resolve()}')


if __name__ == '__main__':
    main()
