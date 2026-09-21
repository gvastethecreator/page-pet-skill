"""Review small material color drift, then write new masked sRGB source sheets."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Public-domain Oklab matrices by Bjorn Ottosson:
# https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
M1 = np.array([[.4122214708,.5363325363,.0514459929], [.2119034982,.6806995451,.1073969566], [.0883024619,.2817188376,.6299787005]])
M2 = np.array([[.2104542553,.7936177850,-.0040720468], [1.9779984951,-2.4285922050,.4505937099], [.0259040371,.7827717662,-.8086757660]])


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def to_lab(rgb):
    rgb = np.asarray(rgb, dtype=np.float64) / 255
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    return np.cbrt(linear @ M1.T) @ M2.T


def to_linear(lab):
    return ((lab @ np.linalg.inv(M2).T) ** 3) @ np.linalg.inv(M1).T


def to_rgb(linear):
    linear = np.clip(linear, 0, 1)
    return np.rint(255 * np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)).astype(np.uint8)


def bound_image(base, entry, mask=False):
    path = (base / entry['path']).resolve()
    if digest(path) != entry['sha256']:
        raise ValueError(f'Stale input hash: {path.name}')
    with Image.open(path) as im:
        if im.width * im.height > 20_000_000:
            raise ValueError('Use source strips of at most 20 million pixels')
        if mask:
            if im.mode != 'L':
                raise ValueError('Material masks must be grayscale L PNGs, not alpha masks')
        elif im.mode != 'RGBA' or im.info.get('icc_profile'):
            raise ValueError('Use reviewed RGBA sRGB PNGs without an embedded ICC profile')
        return np.array(im), path


def sample(image, rect, mask=None):
    if len(rect) != 4 or any(type(v) is not int for v in rect):
        raise ValueError('Sample rect must contain four integer pixel coordinates [left,top,right,bottom]')
    x,y,r,b = rect
    if not (0 <= x < r <= image.shape[1] and 0 <= y < b <= image.shape[0]):
        raise ValueError('Sample rectangle outside image')
    crop = image[y:b,x:r]
    valid = crop[:,:,3] >= 240
    if mask is not None:
        valid &= mask[y:b,x:r] >= 240
    values = to_lab(crop[:,:,:3][valid])
    if len(values) < 32:
        raise ValueError('Need at least 32 opaque material sample pixels')
    center = np.median(values, axis=0)
    if np.quantile(np.linalg.norm(values-center, axis=1), .9) > .06:
        raise ValueError('Mixed sample: choose a smaller flat midtone region of one material')
    return center


def correct(image, mask, delta):
    result = image.copy()
    selected = (mask > 0) & (image[:,:,3] > 0)
    lab = to_lab(image[:,:,:3][selected])
    shift = mask[selected,None] / 255 * delta
    # Reduce the requested shift near gamut edges rather than clip the color.
    amount = np.ones((len(lab),1))
    for _ in range(12):
        linear = to_linear(lab + shift * amount)
        outside = np.any((linear < -1e-7) | (linear > 1+1e-7), axis=1)
        if not outside.any():
            break
        amount[outside] *= .5
    linear = to_linear(lab + shift * amount)
    outside = np.any((linear < -1e-7) | (linear > 1+1e-7), axis=1)
    linear[outside] = to_linear(lab[outside])
    result[:,:,:3][selected] = to_rgb(linear)
    return result, int(np.count_nonzero(amount < 1))


def run(recipe_path, out, apply=False):
    if out.exists():
        raise ValueError('Output must be a new directory; originals and prior evidence stay intact')
    recipe = json.loads(recipe_path.read_text(encoding='utf-8'))
    if recipe.get('version') != 1 or not recipe.get('sheets'):
        raise ValueError('Need a version 1 recipe with sheets')
    base = recipe_path.parent
    reference, ref_path = bound_image(base, recipe['reference'])
    materials = recipe['materials']
    anchors = {name:sample(reference,m['referenceSample']) for name,m in materials.items()}
    limit = float(recipe.get('maxDelta', .035))
    if not .001 <= limit <= .06:
        raise ValueError('maxDelta must be 0.001–0.06 Oklab units; large drift needs new art')
    report = {'version':1, 'recipeSha256':digest(recipe_path), 'referenceSha256':digest(ref_path),
              'space':'Oklab D65 / sRGB', 'maxDelta':limit, 'applied':False,
              'visualReview':'pending', 'sheets':[]}
    staged = []
    names = set()
    pixel_budget = 0
    for entry in recipe['sheets']:
        original, path = bound_image(base, entry)
        pixel_budget += original.shape[0] * original.shape[1]
        if pixel_budget > 32_000_000:
            raise ValueError('Batch exceeds 32 million source pixels; split the recipe')
        if path.name in names:
            raise ValueError('Source sheet basenames must be unique')
        names.add(path.name)
        result = original.copy()
        used = np.zeros(original.shape[:2], dtype=bool)
        sheet = {'source':str(path), 'sourceSha256':digest(path), 'materials':[]}
        if not entry.get('regions'):
            raise ValueError('Every sheet needs at least one reviewed material region')
        for region in entry['regions']:
            name = region['material']
            mask, mask_path = bound_image(base, region['mask'], mask=True)
            if mask.shape != used.shape or np.any(used & (mask > 0)):
                raise ValueError('Material masks must match the source size and must not overlap')
            used |= mask > 0
            before = sample(original,region['sample'],mask)
            difference = anchors[name]-before
            distance = float(np.linalg.norm(difference))
            delta = difference.copy()
            if not materials[name].get('levelLightness', False):
                delta[0] = 0
            blocked = distance > limit or abs(delta[0]) > .02
            status = 'regenerate' if blocked else 'unchanged' if np.linalg.norm(delta) < .002 else 'candidate'
            reduced = 0
            if status == 'candidate':
                result, reduced = correct(result,mask,delta)
            after = sample(result,region['sample'],mask)
            sheet['materials'].append({'material':name, 'maskSha256':digest(mask_path),
                'sample':region['sample'], 'before':before.tolist(), 'reference':anchors[name].tolist(),
                'after':after.tolist(), 'deltaBefore':distance, 'deltaAfter':float(np.linalg.norm(anchors[name]-after)),
                'requestedShift':delta.tolist(), 'gamutReducedPixels':reduced, 'status':status})
        assert np.array_equal(original[:,:,3],result[:,:,3])
        assert np.array_equal(original[~used],result[~used])
        sheet['alphaUnchanged'] = True
        sheet['outsideMasksUnchanged'] = True
        report['sheets'].append(sheet)
        staged.append((path.name,original,result,used))
    blocked = any(m['status']=='regenerate' for s in report['sheets'] for m in s['materials'])
    report['status'] = 'blocked' if blocked else 'within-limits'
    out.mkdir(parents=True)
    for (name,before,after,mask), sheet in zip(staged,report['sheets']):
        if apply and not blocked:
            Image.fromarray(after).save(out/name)
            sheet['outputSha256'] = digest(out/name)
        # One bounded, labeled comparison per strip, on light and dark surfaces.
        contact = Image.new('RGB',(1200,600),'#292630')
        draw = ImageDraw.Draw(contact)
        for row,bg in enumerate(['#eee9e3','#292630']):
            for col,(label,data) in enumerate([('BEFORE',before),('CANDIDATE',after)]):
                im = Image.fromarray(data); im.thumbnail((580,250),Image.Resampling.LANCZOS)
                x,y=col*600,row*300
                draw.rectangle((x,y,x+600,y+300),fill=bg)
                contact.paste(im,(x+(600-im.width)//2,y+35+(250-im.height)//2),im)
                draw.text((x+12,y+10),label,fill='black' if row==0 else 'white')
        contact.save(out/(Path(name).stem+'-comparison.jpg'),quality=94)
        Image.fromarray(mask.astype(np.uint8)*255).save(out/(Path(name).stem+'-coverage.png'))
    report['applied'] = bool(apply and not blocked)
    (out/'color-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    return report


def verify_reports(provenance, base, sources):
    """Bind reviewed color candidates to the actual build inputs."""
    reports = provenance.get('colorLeveling', [])
    if not isinstance(reports, list):
        raise ValueError('colorLeveling must be an array of report path/hash records')
    known_references = {provenance['referenceSha256'], *provenance.get('additionalReferences', {}).values()}
    actual = {digest(path) for _,path,_ in sources}
    for item in reports:
        path = base / item['path']
        if digest(path) != item['sha256']:
            raise ValueError('Color review report changed since provenance review')
        report = json.loads(path.read_text(encoding='utf-8'))
        if (report.get('version') != 1 or report.get('applied') is not True
                or report.get('visualReview') != 'pass' or not str(report.get('reviewer','')).strip()
                or report.get('status') != 'within-limits'
                or report.get('referenceSha256') not in known_references):
            raise ValueError('Color correction needs a named visual review and the same character reference')
        if not report.get('sheets') or any(s.get('outputSha256') not in actual
                or not s.get('alphaUnchanged') or not s.get('outsideMasksUnchanged')
                or any(m.get('status') == 'regenerate' for m in s.get('materials',[])) for s in report['sheets']):
            raise ValueError('Color review does not match the corrected build sources')
    return reports


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--apply',action='store_true',help='Write candidate PNGs only if every region is within the small-drift limit')
    args=parser.parse_args()
    try:
        result=run(args.recipe,args.out,args.apply)
        print(f"{result['status']}: {args.out/'color-report.json'}; visual review remains pending")
        if result['status']=='blocked':
            raise SystemExit(2)
    except (ValueError,KeyError,TypeError,OSError) as exc:
        parser.error(str(exc))
