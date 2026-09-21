"""Separate visually distinct sprites whose horizontal bounds overlap in a strip."""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, label


def isolate(source, output, count=5, columns=None):
    rgba = np.array(Image.open(source).convert('RGBA'))
    alpha = rgba[:, :, 3]
    components, total = label(alpha > 16)
    sizes = np.bincount(components.ravel())
    sizes[0] = 0
    ranked = np.argsort(sizes)[-count:]
    if total < count or any(sizes[i] < alpha.size * (.125 / count) for i in ranked):
        raise ValueError('Expected distinct full-character components; review source manually')
    columns = columns or count
    if count % columns:
        raise ValueError('Component count must divide into complete rows')
    if columns == count:
        ranked = sorted(ranked, key=lambda i: np.where(components == i)[1].mean())
    else:
        by_row = sorted(ranked, key=lambda i: np.where(components == i)[0].mean())
        ranked = [i for start in range(0,count,columns)
                  for i in sorted(by_row[start:start+columns], key=lambda j: np.where(components == j)[1].mean())]
    major = np.isin(components, ranked)
    nearest = distance_transform_edt(~major, return_distances=False, return_indices=True)
    owners = components[tuple(nearest)]
    boxes = []
    for component in ranked:
        ys, xs = np.where((owners == component) & (alpha > 0))
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    cell = max(r-l for l, _, r, _ in boxes) + 48
    cell_height = max(b-t for _,t,_,b in boxes) + 48 if columns != count else rgba.shape[0]
    result = np.zeros((cell_height * (count // columns), cell * columns, 4), dtype=np.uint8)
    for index, (component, (l,t,r,b)) in enumerate(zip(ranked, boxes)):
        sprite = rgba[t:b,l:r].copy()
        sprite[owners[t:b,l:r] != component] = 0
        x = index % columns * cell + (cell - (r-l)) // 2
        y = index // columns * cell_height + ((cell_height - (b-t)) // 2 if columns != count else t)
        result[y:y+b-t,x:x+r-l] = sprite
    if int(result[:,:,3].sum()) != int(alpha.sum()):
        raise ValueError('Pixel ownership failed; original source was preserved')
    Image.fromarray(result).save(output)
    print(f'Isolated {count} sprites without scaling: {Path(output).resolve()}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--count', type=int, default=5)
    parser.add_argument('--columns', type=int)
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Output exists; choose a new inspected source path')
    isolate(args.source,args.out,args.count,args.columns)
