"""Prepare and validate a hash-bound visual gaze review; never infer approval from counts."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(pack):
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    frames = [f for f in manifest['frames'] if f['kind'] == 'gaze']
    return manifest, frames


def binding(pack, manifest):
    return {'manifest': digest(pack / 'manifest.json'), 'sheets': {
        name: digest(pack / name) for name in sorted({f['sheet'] for f in manifest['frames']})}}


def prepare(pack):
    manifest, frames = load(pack)
    xs = sorted({f['gaze'][0] for f in frames})
    ys = sorted({f['gaze'][1] for f in frames})
    canvas = Image.new('RGB', (len(xs) * 320, len(ys) * 350), '#ece9e3')
    draw = ImageDraw.Draw(canvas)
    images = {name: Image.open(pack / name).convert('RGBA') for name in {f['sheet'] for f in frames}}
    for f in frames:
        x, y, w, h = f['rect']
        sprite = images[f['sheet']].crop((x, y, x+w, y+h))
        sprite.thumbnail((310, 310), Image.Resampling.LANCZOS)
        left, top = xs.index(f['gaze'][0]) * 320, ys.index(f['gaze'][1]) * 350
        canvas.paste(sprite, (left+(320-sprite.width)//2, top+28), sprite)
        draw.text((left+8, top+5), f"target x={f['gaze'][0]:g} y={f['gaze'][1]:g}", fill='black')
        draw.text((left+8, top+332), f['id'], fill='black')
    canvas.save(pack / 'gaze-review.png')
    target = pack / 'gaze-review.json'
    if not target.exists():
        record = {'version': 1, 'binding': binding(pack, manifest), 'reviewer': '',
                  'neighborContinuity': 'pending', 'runtimeTracking': 'pending',
                  'frames': {f['id']: {'expected': f['gaze'], 'observed': None,
                      'status': 'pending', 'evidence': ''} for f in frames}}
        target.write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
    print(f"Review every cell of {pack / 'gaze-review.png'}; pending entries are NOT approval.")


def check(pack, publication=False):
    manifest, frames = load(pack)
    if publication and (len(frames) != 25 or sum(f['kind']=='reaction' for f in manifest['frames']) != 12 or manifest.get('layers')):
        raise ValueError('Catalog publication requires 25 gaze views and 12 reactions, with one complete-character sprite per pose')
    review = json.loads((pack / 'gaze-review.json').read_text(encoding='utf-8'))
    if review.get('version') != 1 or review.get('binding') != binding(pack, manifest):
        raise ValueError('Stale gaze review: manifest or atlas changed; inspect the new pixels and mapping')
    if not str(review.get('reviewer', '')).strip():
        raise ValueError('A named visual reviewer is required')
    if review.get('neighborContinuity') != 'pass' or review.get('runtimeTracking') != 'pass':
        raise ValueError('Neighbor progression and actual pointer tracking must both be reviewed')
    points = [tuple(f['gaze']) for f in frames]
    if len(set(points)) != len(points):
        raise ValueError('Duplicate gaze coordinates')
    if len(frames) == 25 and set(points) != {(x, y) for x in [-1, -.5, 0, .5, 1] for y in [-1, -.5, 0, .5, 1]}:
        raise ValueError('A 25-view pack must cover the complete 5x5 target grid')
    if set(review.get('frames', {})) != {f['id'] for f in frames}:
        raise ValueError('Every gaze frame requires its own review entry')
    pixels = set()
    images = {name: Image.open(pack / name).convert('RGBA') for name in {f['sheet'] for f in frames}}
    for frame in frames:
        entry = review['frames'][frame['id']]
        if (entry.get('status') != 'pass' or entry.get('observed') != frame['gaze']
                or entry.get('expected') != frame['gaze'] or not str(entry.get('evidence', '')).strip()):
            raise ValueError(f"Unresolved or mismatched visual direction: {frame['id']}")
        x, y, w, h = frame['rect']
        pixel_hash = hashlib.sha256(images[frame['sheet']].crop((x,y,x+w,y+h)).tobytes()).hexdigest()
        if pixel_hash in pixels:
            raise ValueError('Exact duplicate gaze art cannot establish distinct directions')
        pixels.add(pixel_hash)
    print(f"{manifest['name']}: {len(frames)} gaze review entries valid (record validation, not automatic vision)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['prepare', 'check', 'publish'])
    parser.add_argument('pack', type=Path)
    parser.add_argument('--catalog', type=Path, help='Local catalog to update only after a passing visual review')
    args = parser.parse_args()
    try:
        if args.mode == 'prepare':
            prepare(args.pack)
        else:
            check(args.pack, publication=args.mode == 'publish')
        if args.mode == 'publish':
            if args.catalog is None:
                raise ValueError('publish requires --catalog')
            relative = args.pack.resolve().relative_to(args.catalog.parent.resolve())
            entry = './' + (relative / 'manifest.json').as_posix()
            entries = json.loads(args.catalog.read_text(encoding='utf-8'))
            name = load(args.pack)[0]['name']
            matches = [i for i,p in enumerate(entries) if json.loads(
                (args.catalog.parent/p).read_text(encoding='utf-8'))['name'] == name]
            if len(matches) > 1:
                raise ValueError('Catalog has ambiguous duplicate character names')
            if matches:
                entries[matches[0]] = entry
            else:
                entries.append(entry)
            args.catalog.write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
            print(f'Published reviewed local pack: {entry}')
    except (ValueError, KeyError, OSError, TypeError) as exc:
        parser.error(str(exc))


if __name__ == '__main__':
    main()
