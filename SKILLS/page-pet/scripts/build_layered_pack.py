"""Build body/head spritesheet layers from reviewed, source-hashed layouts."""
import argparse
import json
import math
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from build_pack import extract
from prepare_layout import digest
from verify_master import verify_master


def assemble(config_path, output):
    config = json.loads(config_path.read_text(encoding='utf-8'))
    if 'master' not in config: raise ValueError('Master full-character reference required; review the combined character and separated layers first')
    size = config.get('size', 512)
    if not isinstance(size, int) or not 64 <= size <= 1024: raise ValueError('Invalid canvas size')
    config['size'] = size
    columns = config.get('atlasColumns', 5)
    if not isinstance(columns, int) or not 1 <= columns <= 16: raise ValueError('Invalid atlasColumns')
    neck = config['neck']; feet = config['feet']
    if any(len(p)!=2 or any(not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<v<size for v in p) for p in [neck,feet]):
        raise ValueError('Anchors must be inside the cell')
    compiled = []; head_entries = []; expression_entries = []; body_entries = []; reports = {}; rendered = {}; keys = set()
    for source in config['sources']:
        key = source['name']
        if not re.fullmatch(r'[a-z][a-z0-9-]*', key) or key in keys: raise ValueError('Unique sheet names required')
        keys.add(key)
        path = config_path.parent / source['image']; layout_path = config_path.parent / source['layout']
        layout = json.loads(layout_path.read_text(encoding='utf-8'))
        if layout.get('version') != 1 or layout.get('frameSemantics') != 'variants': raise ValueError('Expected reviewed variants layout')
        shape = tuple(source['grid']); layout_sheet = layout['sheets']['directions']
        if len(shape)!=2 or any(not isinstance(n,int) or n<1 for n in shape) or math.prod(shape)*size*size>64_000_000:
            raise ValueError('Invalid sheet grid')
        cells = extract(path, shape, layout_sheet)
        if 'take' in source:
            take = source['take']
            if not take or len(set(take))!=len(take) or any(not isinstance(i,int) or i<0 or i>=len(cells) for i in take): raise ValueError('Invalid source cell selection')
            cells = [cells[i] for i in take]
        poses = source['poses']
        if len(poses) != len(cells): raise ValueError('One pose per reviewed source box required')
        scale = source['scale']
        if not isinstance(scale,(int,float)) or not math.isfinite(scale) or not 0<scale<=4: raise ValueError('Invalid shared sheet scale')
        layer = source['layer']
        if layer not in ['head','body','expression']: raise ValueError('Expected head, body or expression layer')
        measures=[]
        for i,(cell,pose) in enumerate(zip(cells,poses)):
            # Some native-alpha outputs contain faint disconnected background
            # specks. Keep every edge within 12 source pixels of alpha > 16;
            # remove only distant alpha <= 16 and report the exact loss.
            clean = cell['image'].copy(); alpha = clean.getchannel('A')
            envelope = alpha.point(lambda a: 255 if a > 16 else 0).filter(ImageFilter.MaxFilter(25))
            clean_alpha = ImageChops.multiply(alpha, envelope)
            removed = ImageChops.subtract(alpha, clean_alpha)
            cleanup = {'pixels':sum(removed.histogram()[1:]),'maxAlpha':removed.getextrema()[1],'edgeGuard':12}
            clean.putalpha(clean_alpha)
            # Feet use the stable mass-band anchor from the sprite workflow.
            # Detached heads use a reviewed chin/neck anchor, not body geometry.
            if layer != 'body' and 'anchor' not in pose: raise ValueError(f'{key}/{i}: explicit anatomical head anchor required')
            anchor = pose.get('anchor', cell['anchor'])
            if len(anchor)!=2 or any(not isinstance(n,(int,float)) or not math.isfinite(n) for n in anchor):
                raise ValueError('Invalid authored anchor')
            if not (0<=anchor[0]<=cell['image'].width and 0<=anchor[1]<=cell['image'].height): raise ValueError('Anchor outside source cell')
            target = feet if layer=='body' else neck
            left,top = [target[j]-anchor[j]*scale for j in range(2)]
            l,t,r,b = clean_alpha.getbbox()
            if min(left+l*scale,top+t*scale,size-left-r*scale,size-top-b*scale)<2: raise ValueError(f'{key}/{i}: layer clips output')
            image = clean.transform((size,size),Image.Transform.AFFINE,
                (1/scale,0,-left/scale,0,1/scale,-top/scale),resample=Image.Resampling.BICUBIC)
            x,y = i%shape[0]*size,i//shape[0]*size
            entry = {'id':pose['id'],'sheet':key+'.png','rect':[x,y,size,size]}
            if layer=='head':
                gaze = pose['gaze']
                if len(gaze)!=2 or any(not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>1 for n in gaze): raise ValueError('Invalid gaze')
                entry.update(kind='gaze',gaze=gaze,body=config['neutralBody']); head_entries.append(entry)
            elif layer=='expression':
                entry.update(kind='reaction',body=pose.get('body',config['neutralBody']),expression=True); expression_entries.append(entry)
            else: body_entries.append(entry)
            if entry['id'] in rendered: raise ValueError('Layer frame IDs must be globally unique')
            rendered[entry['id']] = image
            measures.append({'id':entry['id'],'sourceBox':cell['sourceBox'],'sourceBounds':cell['bounds'],'sourceAnchor':anchor,'targetAnchor':target,'scale':scale,'outputBounds':image.getchannel('A').getbbox(),'distantAlphaCleanup':cleanup})
        reports[key] = {'sourceSha256':digest(path),'sourceSize':layout_sheet['sourceSize'],'layoutSha256':digest(layout_path),'frames':measures}
    if len({tuple(f['gaze']) for f in head_entries}) != len(head_entries): raise ValueError('Duplicate gaze coordinates')
    neutral = next(f for f in head_entries if f['gaze']==[0,0])
    if config['neutralBody'] not in {f['id'] for f in body_entries}: raise ValueError('Neutral body missing')
    master_report, master_preview = verify_master(config_path, config, rendered, neutral['id'], reports)
    head_entries.sort(key=lambda f:(f['gaze'][1],f['gaze'][0]))
    # Pack by rendered layer, independent of source-sheet layout.
    compiled = []
    for name,entries in [('heads',head_entries),('expressions',expression_entries),('bodies',body_entries)]:
        if not entries: continue
        cols = min(columns,len(entries)); rows=math.ceil(len(entries)/cols)
        if not isinstance(cols,int) or cols<1 or cols>16 or cols*rows*size*size>64_000_000: raise ValueError('Invalid packed atlas geometry')
        atlas=Image.new('RGBA',(cols*size,rows*size))
        for i,entry in enumerate(entries):
            x,y=i%cols*size,i//cols*size; atlas.alpha_composite(rendered[entry['id']],(x,y))
            entry.update(sheet=name+'.png',rect=[x,y,size,size])
        compiled.append((name,atlas))
    frames = head_entries[:] + expression_entries
    if any(f['body'] not in {b['id'] for b in body_entries} for f in expression_entries): raise ValueError('Unknown expression body')
    for reaction in config.get('reactions',[]):
        if reaction['body'] not in {f['id'] for f in body_entries}: raise ValueError('Unknown reaction body')
        head = next(f for f in head_entries if f['id']==reaction.get('head',neutral['id']))
        frames.append({**head,'id':reaction['id'],'kind':'reaction','body':reaction['body']})
        del frames[-1]['gaze']
    if len({f['id'] for f in frames})!=len(frames): raise ValueError('Duplicate pose IDs')
    manifest = {'version':1,'name':config['name'],'neutral':neutral['id'],'pivot':[n/size for n in feet],
        'layers':{'size':size,'neck':[n/size for n in neck],'bodyFrames':body_entries},'frames':frames}
    output.mkdir(parents=True)
    master_preview.save(output/'master-review.png')
    for key,atlas in compiled: atlas.save(output/(key+'.png'),optimize=True)
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    (output/'build-report.json').write_text(json.dumps({'configSha256':digest(config_path),'sources':reports,'master':master_report},indent=2)+'\n',encoding='utf-8')
    # Spatial contact proof is separate from the two independently rendered layers.
    ordered=sorted(head_entries,key=lambda f:(f['gaze'][1],f['gaze'][0]))
    cols=len({f['gaze'][0] for f in ordered}); rows=math.ceil(len(ordered)/cols)
    contact=Image.new('RGBA',(cols*size,rows*(size+20)),'#eeeae2'); draw=ImageDraw.Draw(contact)
    for i,f in enumerate(ordered):
        image=rendered[f['body']].copy(); image.alpha_composite(rendered[f['id']])
        x,y=i%cols*size,i//cols*(size+20);contact.alpha_composite(image,(x,y));draw.text((x+6,y+size+2),str(f['gaze']),fill='#333333')
    contact.convert('RGB').save(output/'layer-contact.png')
    reactions = [f for f in frames if f['kind']=='reaction']
    if reactions:
        tile=256; cols=6
        contact=Image.new('RGBA',(cols*tile,math.ceil(len(reactions)/cols)*(tile+20)),'#c9b4aa'); draw=ImageDraw.Draw(contact)
        for i,f in enumerate(reactions):
            image=rendered[f['body']].copy()
            head_id=f['id'] if f.get('expression') else next(r.get('head',neutral['id']) for r in config['reactions'] if r['id']==f['id'])
            image.alpha_composite(rendered[head_id])
            x,y=i%cols*tile,i//cols*(tile+20)
            contact.alpha_composite(image.resize((tile,tile),Image.Resampling.LANCZOS),(x,y));draw.text((x+6,y+tile+2),f['id'],fill='#302b33')
        contact.convert('RGB').save(output/'reaction-contact.png')
    print(f'Built {len(head_entries)} head poses, {len(expression_entries)} expressions and {len(body_entries)} body frames: {output.resolve()}')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    if args.out.exists(): parser.error('Output exists; use a new directory')
    try: assemble(args.config,args.out)
    except (ValueError,KeyError,TypeError,StopIteration,OSError) as exc: parser.error(str(exc))
