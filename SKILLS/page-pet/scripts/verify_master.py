"""Compare registered neutral layers with their complete-character master."""
import json
from PIL import Image, ImageChops, ImageDraw
from build_pack import extract, body_metrics
from prepare_layout import digest


def verify_master(config_path, config, rendered, neutral, reports):
    spec = config['master']; root = config_path.parent; size = config['size']
    path = root / spec['image']; layout_path = root / spec['layout']
    layout = json.loads(layout_path.read_text(encoding='utf-8'))['sheets']['directions']
    cells = extract(path, tuple(layout['grid']), layout)
    if not isinstance(spec['index'], int) or not 0 <= spec['index'] < len(cells): raise ValueError('Invalid master cell index')
    cell = cells[spec['index']]
    scale = spec['scale']; ax, ay = spec['anchor']; tx, ty = config['feet']
    if not 0 < scale <= 4 or not 0 <= ax <= cell['image'].width or not 0 <= ay <= cell['image'].height:
        raise ValueError('Invalid master scale or anchor')
    sha = digest(path)
    for ident in [neutral, config['neutralBody']]:
        source = next(r for r in reports.values() if any(f['id']==ident for f in r['frames']))
        if source['sourceSha256'] != sha:
            raise ValueError('Neutral head and body must come from the same master sheet as the complete character')
    full = cell['image'].transform((size,size), Image.Transform.AFFINE,
        (1/scale,0,ax-tx/scale,0,1/scale,ay-ty/scale),resample=Image.Resampling.BICUBIC)
    body = rendered[config['neutralBody']]; head = rendered[neutral]
    composite = body.copy(); composite.alpha_composite(head)
    a = full.getchannel('A').point(lambda v:255 if v>128 else 0)
    b = composite.getchannel('A').point(lambda v:255 if v>128 else 0)
    intersection = sum(ImageChops.multiply(a,b).histogram()[1:])
    union = sum(ImageChops.lighter(a,b).histogram()[1:])
    iou = intersection / max(1,union)
    fb, cb = a.getbbox(), b.getbbox()
    if not fb or not cb: raise ValueError('Empty master or neutral reconstruction')
    bounds_drift = max(abs(x-y) for x,y in zip(fb,cb)) / size
    nx,ny = map(round,config['neck'])
    connected = head.getpixel((nx,ny))[3]>128 and body.getpixel((nx,ny))[3]>128
    drift = []
    # Horizontal silhouette width detects scale drift without fitting each frame.
    reference_width = head.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
    reference_width = reference_width[2]-reference_width[0]
    body_width = body_metrics(body)['bodyWidth']
    body_ids = {pose['id'] for source in config['sources'] if source['layer']=='body' for pose in source['poses']}
    detached = [ident for ident,image in rendered.items() if image.getpixel((nx,ny))[3]<=128]
    for ident,image in rendered.items():
        if ident in body_ids:
            ratio = body_metrics(image)['bodyWidth']/body_width
        else:
            bounds=image.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
            ratio=(bounds[2]-bounds[0])/reference_width
        drift.append({'id':ident,'widthRatio':round(ratio,4)})
    report={'sourceSha256':sha,'layoutSha256':digest(layout_path),'silhouetteIoU':round(iou,5),
        'boundsDriftFraction':round(bounds_drift,5),'neckOverlap':connected,'detachedLayers':detached,'proportions':drift,
        'limits':{'minimumIoU':.93,'maximumBoundsDriftFraction':.025,'maximumWidthDrift':.12}}
    preview=Image.new('RGBA',(size*3,size+30),'#d1c3b6'); draw=ImageDraw.Draw(preview)
    for i,(label,image) in enumerate([('Complete master',full),('Registered layers',composite),('50% overlay',Image.blend(full,composite,.5))]):
        preview.alpha_composite(image,(i*size,0)); draw.text((i*size+10,size+8),label,fill='#302b33')
    # Keep failed evidence beside sources, never publish a rejected live pack.
    preview.convert('RGB').save(root/'master-review-latest.png')
    (root/'master-review-latest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    if iou<.93 or bounds_drift>.025 or not connected:
        raise ValueError(f'Master reconstruction failed: IoU={iou:.3f}, bounds drift={bounds_drift:.3f}, neck overlap={connected}; inspect master-review-latest.png')
    bad=[m['id'] for m in drift if abs(m['widthRatio']-1)>.12]
    if bad: raise ValueError(f'Proportion drift beyond 12%: {bad}; repair source/registration, do not resize individual frames')
    if detached: raise ValueError(f'Layers miss the neck docking point: {detached}')
    return report, preview.convert('RGB')
