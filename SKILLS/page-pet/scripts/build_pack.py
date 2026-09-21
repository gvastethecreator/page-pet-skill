"""Compile reviewed transparent source boxes into registered mascot atlases."""
import argparse
import json
import math
import re
import statistics
from pathlib import Path
from PIL import Image, ImageDraw
from prepare_layout import digest, grid
from review_gaze import prepare as prepare_gaze_review


def body_metrics(cell):
    alpha = cell.getchannel('A')
    bounds = alpha.point(lambda a: 255 if a > 16 else 0).getbbox()
    if not bounds:
        raise ValueError('Empty sprite')
    l, t, r, b = bounds
    y0, y1 = t + round((b-t)*.82), t + round((b-t)*.96)
    p = alpha.load()
    mass = [sum(p[x,y] for y in range(y0,y1) if p[x,y]>16) for x in range(cell.width)]
    total = sum(mass)
    if not total:
        raise ValueError('No stable lower-body band')
    center = sum((x+.5)*v for x,v in enumerate(mass))/total
    cumulative = 0
    low = None
    for x, weight in enumerate(mass):
        cumulative += weight
        if low is None and cumulative >= total*.05:
            low = x
        if cumulative >= total*.95:
            high = x+1
            break
    return {'bounds':list(bounds),'anchor':[center,b],'bodyWidth':high-low}


def head_width(cell, bounds):
    """Median central head silhouette, excluding hands and transparent fringe."""
    l,t,r,b=bounds
    alpha=cell.getchannel('A').load()
    center=(l+r)//2
    widths=[]
    for y in range(t+round((b-t)*.03),t+round((b-t)*.35)):
        x=next((candidate for distance in range(max(2,cell.width//5)+1)
            for candidate in (center-distance,center+distance)
            if 0<=candidate<cell.width and alpha[candidate,y]>16),None)
        if x is None: continue
        left=right=x
        while left>0 and alpha[left-1,y]>16: left-=1
        while right+1<cell.width and alpha[right+1,y]>16: right+=1
        widths.append(right-left+1)
    if not widths: raise ValueError('No stable head silhouette; review source art')
    return statistics.median(widths)


def extract(source, shape, layout, measure_head=True):
    image = Image.open(source).convert('RGBA')
    if layout['sourceSha256'] != digest(source) or layout['sourceSize'] != list(image.size):
        raise ValueError(f'{source.name}: source changed since layout inspection')
    boxes = layout['boxes']
    if layout['grid'] != list(shape) or len(boxes) != math.prod(shape):
        raise ValueError('Layout grid/count mismatch')
    ownership = Image.new('1',image.size)
    draw = ImageDraw.Draw(ownership)
    frames = []
    for index, box in enumerate(boxes):
        if len(box)!=4 or any(not isinstance(n,int) for n in box):
            raise ValueError('Source boxes must be integer [left,top,right,bottom]')
        l,t,r,b = box
        if not (0<=l<r<=image.width and 0<=t<b<=image.height):
            raise ValueError(f'Source box {index} is out of bounds')
        if ownership.crop(box).getbbox():
            raise ValueError(f'Source box {index} overlaps another box')
        draw.rectangle((l,t,r-1,b-1),fill=1)
        cell = image.crop(box)
        if cell.getchannel('A').histogram()[0]/(cell.width*cell.height)<.08:
            raise ValueError(f'{source.name} frame {index}: missing transparent background')
        metrics = body_metrics(cell)
        metrics['headWidth'] = head_width(cell,metrics['bounds']) if measure_head else None
        metrics['measurementAnchor'] = metrics['anchor'][:]
        bounds = metrics['bounds']
        if bounds[0]==0 or bounds[1]==0 or bounds[2]==cell.width or bounds[3]==cell.height:
            raise ValueError(f'{source.name} frame {index}: silhouette touches source box; inspect clipping')
        override = layout.get('anchors',{}).get(str(index))
        if override is not None:
            if (not isinstance(override,list) or len(override)!=2
                or any(not isinstance(n,(float,int)) or not math.isfinite(n) for n in override)
                or not (0<=override[0]<=cell.width and 0<=override[1]<=cell.height)):
                raise ValueError(f'Frame {index}: invalid explicit anchor')
            metrics['anchor']=override
        frames.append({'image':cell,'sourceBox':box,**metrics})
    uncovered = image.getchannel('A').copy()
    uncovered.paste(0,mask=ownership)
    if uncovered.getbbox():
        raise ValueError('Layout leaves alpha pixels unassigned')
    return frames


def compile_pack(groups,size,occupancy=.75,reaction_scale='head-core',gaze_scale='body-width'):
    target = [size/2,round(size*.9)]
    ref = statistics.median(f['bodyWidth'] for f in groups[0][2])
    neutral=groups[0][2][len(groups[0][2])//2]
    reference_head=neutral['headWidth']
    ratios = {}
    for key,_,frames in groups:
        if key.startswith('reactions'):
            for index,f in enumerate(frames):
                if reaction_scale=='neutral':
                    ratio=1
                elif reaction_scale=='full-height':
                    ratio=(neutral['anchor'][1]-neutral['bounds'][1])/(f['anchor'][1]-f['bounds'][1])
                    if not .75<=ratio<=1.55:
                        raise ValueError(f'{key} frame {index}: full-body size differs too much from neutral; review art')
                else:
                    ratio=reference_head/f['headWidth']
                if reaction_scale=='head-core' and not .8<=ratio<=1.25:
                    raise ValueError(f'{key} frame {index}: head size differs too much from neutral; review art')
                ratios[(key,index)]=ratio
        else:
            if gaze_scale == 'neutral-height':
                center = frames[len(frames)//2]
                ratio = (neutral['anchor'][1]-neutral['bounds'][1])/(center['anchor'][1]-center['bounds'][1])
            else:
                ratio=ref/statistics.median(f['bodyWidth'] for f in frames)
            for index in range(len(frames)): ratios[(key,index)]=ratio
    # Size comes from the accepted neutral, never from the widest gesture.
    # An extended limb needs a larger common cell or lower occupancy, not a
    # smaller character across the entire atlas.
    base=size*occupancy/(neutral['anchor'][1]-neutral['bounds'][1])
    compiled=[]
    for key,shape,frames in groups:
        cols,rows=shape
        atlas=Image.new('RGBA',(cols*size,rows*size))
        entries=[]; report=[]; rendered=[]
        for index,f in enumerate(frames):
            scale=base*ratios[(key,index)]
            ax,ay=f['anchor'];l,t,r,b=f['bounds']
            margins=[target[0]-(ax-l)*scale,target[1]-(ay-t)*scale,
                size-target[0]-(r-ax)*scale,size-target[1]-(b-ay)*scale]
            if min(margins)<8:
                raise ValueError(f'{key} frame {index}: pose needs a larger common cell or lower occupancy; never shrink to fit its arms')
            left=target[0]-f['anchor'][0]*scale; top=target[1]-f['anchor'][1]*scale
            registered=f['image'].transform((size,size),Image.Transform.AFFINE,
                (1/scale,0,-left/scale,0,1/scale,-top/scale),resample=Image.Resampling.BICUBIC)
            measured=body_metrics(registered); bounds=measured['bounds']
            if min(bounds[0],bounds[1],size-bounds[2],size-bounds[3])<3:
                raise ValueError(f'{key} frame {index}: insufficient output padding')
            expected=[target[j]+(f['measurementAnchor'][j]-f['anchor'][j])*scale for j in range(2)]
            drift=[round(measured['anchor'][j]-expected[j],3) for j in range(2)]
            if abs(drift[0])>1.5 or abs(drift[1])>1:
                raise ValueError(f'{key} frame {index}: registration drift {drift}')
            x,y=index%cols*size,index//cols*size
            atlas.alpha_composite(registered,(x,y)); rendered.append(registered)
            entries.append({'rect':[x,y,size,size]})
            report.append({'cell':index,'sourceBox':f['sourceBox'],'sourceBounds':f['bounds'],
                'sourceAnchor':f['anchor'],'scale':round(scale,6),'outputBounds':bounds,
                'targetAnchor':target,'anchorDrift':drift,'bodyWidth':measured['bodyWidth'],
                'sourceHeadWidth':f['headWidth'],'outputHeadWidth':head_width(registered,bounds) if reaction_scale=='head-core' else None,
                'referenceHeadWidth':reference_head,'minimumMargin':round(min(margins),2)})
        compiled.append((key,atlas,entries,report,rendered))
    return compiled,target


def qa_images(compiled,target,size,output):
    pairs=[(entry,frame) for _,_,entries,_,items in compiled for entry,frame in zip(entries,items)]
    pairs.sort(key=lambda pair: (0,*reversed(pair[0]['gaze'])) if pair[0]['kind']=='gaze' else (1,0,0))
    frames=[frame for _,frame in pairs]
    contact=Image.new('RGB',(size*8,math.ceil(len(frames)/8)*(size+22)),'#eeeae2')
    d=ImageDraw.Draw(contact)
    for i,frame in enumerate(frames):
        x,y=i%8*size,i//8*(size+22)
        contact.paste(frame,(x,y),frame)
        d.line((x,y+target[1],x+size,y+target[1]),fill='#d76131')
        d.line((x+target[0],y,x+target[0],y+size),fill='#429990')
        entry=pairs[i][0]
        label=f"{entry['id']} {entry.get('gaze','')}"
        d.text((x+6,y+size+3),label,fill='#333333')
    contact.save(output/'alignment-contact.png')
    onion=Image.new('RGBA',(size*2,size),'#292f32')
    gaze_frames=[frame for _,_,entries,_,items in compiled for entry,frame in zip(entries,items) if entry['kind']=='gaze']
    reaction_frames=[frame for _,_,entries,_,items in compiled for entry,frame in zip(entries,items) if entry['kind']=='reaction']
    for side,items in enumerate([gaze_frames,reaction_frames]):
        layer=Image.new('RGBA',(size,size))
        for frame in items:
            ghost=frame.copy(); ghost.putalpha(ghost.getchannel('A').point(lambda a:round(a*.12)))
            layer.alpha_composite(ghost)
        onion.alpha_composite(layer,(side*size,0))
    d=ImageDraw.Draw(onion)
    for side in range(2):
        d.line((side*size,target[1],(side+1)*size,target[1]),fill='#e99e66')
        d.line((side*size+target[0],0,side*size+target[0],size),fill='#79c9bf')
    onion.save(output/'alignment-onion.png')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directions',type=Path,required=True)
    parser.add_argument('--grid',type=grid,required=True)
    parser.add_argument('--reactions',type=Path)
    parser.add_argument('--reaction-grid',type=grid)
    parser.add_argument('--layout',type=Path,required=True,help='Reviewed source-hashed layout from prepare_layout.py')
    parser.add_argument('--extras',type=Path,help='JSON array of extra direction sheets with explicit gaze coordinates')
    parser.add_argument('--names',default='blink,happy,love,surprised,sleep,think,wave,celebrate')
    parser.add_argument('--name',required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--size',type=int,default=256)
    parser.add_argument('--single-atlas',action='store_true',help='Pack all complete-character frames into one PNG')
    parser.add_argument('--color-limit',type=int,help='Maximum RGB channel drift of the torso sample from neutral')
    parser.add_argument('--occupancy',type=float,default=.75,help='Neutral full-body height as fraction of cell; larger gestures require more canvas room')
    parser.add_argument('--gaze-scale',choices=('body-width','neutral-height'),default='body-width',help='One common scale per source sheet, measured from body width or its central front pose height')
    parser.add_argument('--reaction-scale',choices=('head-core','full-height','neutral'),default='head-core',help='Use a reviewed head feature, full-character height, or the neutral scale')
    parser.add_argument('--reference',type=Path,help='Character reference used for this source batch')
    parser.add_argument('--provenance',type=Path,help='Source record from prepare_four_pose_source.py')
    args=parser.parse_args()
    if bool(args.reference)!=bool(args.provenance): parser.error('Supply reference and provenance together')
    if args.provenance and not args.reactions: parser.error('Pilot provenance requires a reaction source')
    if not 64<=args.size<=1024: parser.error('--size must be 64..1024')
    if args.color_limit is not None and not 0<=args.color_limit<=255: parser.error('--color-limit must be 0..255')
    if not .5<=args.occupancy<=.85: parser.error('--occupancy must be 0.5..0.85')
    if bool(args.reactions)!=bool(args.reaction_grid): parser.error('Supply reactions and reaction-grid together')
    if args.out.exists(): parser.error('Output exists; choose a new pack directory')
    sources=[('directions',args.directions,args.grid)]
    if args.reactions: sources.append(('reactions',args.reactions,args.reaction_grid))
    if any(math.prod(shape)*args.size**2>64_000_000 for _,_,shape in sources): parser.error('Each sheet must stay under 64 million pixels')
    names=args.names.split(',')
    if args.reactions and (len(names)!=math.prod(args.reaction_grid) or len(set(names))!=len(names)
        or any(not n or not all(c.isalnum() or c=='-' for c in n) for n in names)):
        parser.error('Reaction names must be unique identifiers, one per cell')
    try:
        provenance=None
        if args.provenance:
            provenance=json.loads(args.provenance.read_text(encoding='utf-8'))
            provenance_dir=args.provenance.parent
            if provenance.get('referenceSha256')!=digest(args.reference):
                raise ValueError('Reference does not match the reviewed provenance record')
            additional=provenance.get('additionalReferences',{})
            if (not isinstance(additional,dict) or any(
                not isinstance(name,str) or not isinstance(expected,str)
                or digest(provenance_dir/name)!=expected for name,expected in additional.items())):
                raise ValueError('Additional character reference differs from the reviewed provenance')
            if 'sources' not in provenance:
                expected={'generatedSourceSha256':digest(provenance_dir/provenance['generatedSource']),
                    'directionsSha256':digest(args.directions),
                    'reactionsSha256':digest(args.reactions)}
                if any(provenance.get(key)!=value for key,value in expected.items()):
                    raise ValueError('Source does not match the reviewed provenance record')
                if provenance.get('replacementNeutralSha256') and digest(provenance_dir/provenance['replacementNeutral'])!=provenance['replacementNeutralSha256']:
                    raise ValueError('Replacement neutral changed since source review')
        layout=json.loads(args.layout.read_text(encoding='utf-8'))
        if layout.get('version')!=1 or layout.get('frameSemantics')!='variants': raise ValueError('Expected a v1 variants layout')
        source_layouts={key:layout['sheets'][key] for key,_,_ in sources}
        gaze_points={}; reaction_ids={}
        layout_hashes={'primary':digest(args.layout)}
        if args.extras:
            extras=json.loads(args.extras.read_text(encoding='utf-8'))
            if not isinstance(extras,list): raise ValueError('Extras must be an array')
            for extra in extras:
                key=extra['sheet']
                kind=extra.get('kind','gaze')
                prefix='reactions-' if kind=='reaction' else 'directions-'
                if kind not in ['gaze','reaction'] or not re.fullmatch(prefix+r'[a-z0-9-]+',key) or key in source_layouts:
                    raise ValueError('Extra sheet name must match its kind and be unique')
                shape=grid('x'.join(map(str,extra['grid'])))
                if math.prod(shape)*args.size**2>64_000_000: raise ValueError('Extra sheet exceeds 64 million pixels')
                if kind=='gaze':
                    points=extra['gaze']
                    if len(points)!=math.prod(shape) or any(len(p)!=2 or any(not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>1 for n in p) for p in points):
                        raise ValueError('Each extra gaze cell needs a normalized point')
                else:
                    ids=extra['ids']
                    if len(ids)!=math.prod(shape) or len(set(ids))!=len(ids) or any(not re.fullmatch(r'[a-z][a-z0-9-]*',ident) for ident in ids):
                        raise ValueError('Each extra reaction cell needs a unique ID')
                source=args.extras.parent/extra['source']
                layout_path=args.extras.parent/extra['layout']
                extra_layout=json.loads(layout_path.read_text(encoding='utf-8'))
                if extra_layout.get('frameSemantics')!='variants': raise ValueError('Extras must be non-temporal variants')
                source_layouts[key]=extra_layout['sheets']['directions']
                layout_hashes[key]=digest(layout_path)
                if kind=='gaze':
                    gaze_points[key]=points
                    sources.insert(next((i for i,(name,_,_) in enumerate(sources) if name=='reactions'),len(sources)),(key,source,shape))
                else:
                    reaction_ids[key]=ids
                    sources.append((key,source,shape))
        if provenance and 'sources' in provenance:
            recorded=provenance['sources']
            if (not isinstance(recorded,dict) or set(recorded)!={key for key,_,_ in sources}
                or any(recorded[key]!=digest(source) for key,source,_ in sources)):
                raise ValueError('One or more source sheets differ from the reviewed character provenance')
        color_reviews=[]
        if provenance and 'colorLeveling' in provenance:
            from level_colors import verify_reports
            color_reviews=verify_reports(provenance,provenance_dir,sources)
        groups=[(key,shape,extract(source,shape,source_layouts[key],args.reaction_scale=='head-core')) for key,source,shape in sources]
        compiled,target=compile_pack(groups,args.size,args.occupancy,args.reaction_scale,args.gaze_scale)
        frames=[]
        for (key,_,entries,_,_),(_,shape,_) in zip(compiled,groups):
            cols,rows=shape
            for i,frame in enumerate(entries):
                frame['sheet']=key+'.png'
                if key in gaze_points:
                    frame.update(id=f'gaze-{key}-{i}',kind='gaze',gaze=gaze_points[key][i])
                elif key in reaction_ids:
                    frame.update(id=reaction_ids[key][i],kind='reaction')
                elif key=='directions':
                    frame.update(id=f'gaze-{i%cols}-{i//cols}',kind='gaze',
                        gaze=[0 if cols==1 else round(i%cols/(cols-1)*2-1,4),0 if rows==1 else round(i//cols/(rows-1)*2-1,4)])
                else: frame.update(id=names[i],kind='reaction')
                frames.append(frame)
        if len({f['id'] for f in frames})!=len(frames): raise ValueError('Duplicate frame IDs')
        gazes=[tuple(frame['gaze']) for frame in frames if frame['kind']=='gaze']
        if len(set(gazes))!=len(gazes): raise ValueError('Duplicate gaze coordinates across sheets')
        neutral=min((f for f in frames if f['kind']=='gaze'),key=lambda f:sum(v*v for v in f['gaze']))['id']
        color_samples={}
        if args.color_limit is not None:
            for _,_,entries,_,images in compiled:
                for entry,image in zip(entries,images):
                    l,t,r,b=image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
                    pixels=image.load();values=[]
                    for y in range(round(t+(b-t)*.53),round(t+(b-t)*.8),4):
                        for x in range(round((l+r)/2-(r-l)*.11),round((l+r)/2+(r-l)*.11),4):
                            red,green,blue,alpha=pixels[x,y]
                            if alpha>=240 and red>190 and green>180 and blue>150 and 0<=red-green<=30 and 0<=green-blue<=35:
                                values.append((red,green,blue))
                    if len(values)<20: raise ValueError(f'No stable ivory torso sample in {entry["id"]}; review colors manually')
                    color_samples[entry['id']]=[round(statistics.median(pixel[channel] for pixel in values)) for channel in range(3)]
            baseline=color_samples[neutral]
            drifts={name:max(abs(rgb[i]-baseline[i]) for i in range(3)) for name,rgb in color_samples.items()}
            bad=[name for name,drift in drifts.items() if drift>args.color_limit]
            if bad: raise ValueError(f'Torso color drift exceeds {args.color_limit} RGB levels: {bad}; review source art')
        single_atlas=None
        if args.single_atlas:
            cols=5; rows=math.ceil(len(frames)/cols)
            if cols*rows*args.size**2>64_000_000: raise ValueError('Packed atlas exceeds 64 million pixels')
            single_atlas=Image.new('RGBA',(cols*args.size,rows*args.size))
            ordered=[(entry,image) for _,_,entries,_,images in compiled for entry,image in zip(entries,images)]
            for i,(entry,image) in enumerate(ordered):
                x,y=i%cols*args.size,i//cols*args.size
                single_atlas.alpha_composite(image,(x,y));entry.update(sheet='mascot.webp',rect=[x,y,args.size,args.size])
        manifest={'version':1,'name':args.name,'neutral':neutral,'pivot':[n/args.size for n in target],'frames':frames}
    except (ValueError,OSError,KeyError,TypeError) as exc: parser.error(str(exc))
    args.out.mkdir(parents=True)
    if single_atlas: single_atlas.save(args.out/'mascot.webp', lossless=True, method=4)
    else:
        for key,atlas,_,_,_ in compiled: atlas.save(args.out/(key+'.png'),optimize=True)
    report={'sourceLayoutSha256':digest(args.layout),'sourceLayoutHashes':layout_hashes,'sourceHashes':{key:digest(source) for key,source,_ in sources},
        'referenceSha256':digest(args.reference) if args.reference else None,
        'sourceProvenanceSha256':digest(args.provenance) if args.provenance else None,
        'anchor':'lower-body-bottom','scalePolicy':f'neutral-height-and-reaction-{args.reaction_scale}-v1',
        'gazeScalePolicy':args.gaze_scale,'targetAnchor':target,'frameSemantics':'variants',
        'packedAtlasSize':list(single_atlas.size) if single_atlas else None,'occupancy':args.occupancy,
        'torsoColorSamples':color_samples,'torsoColorLimit':args.color_limit,'colorLeveling':color_reviews,
        'frames':{key:measures for key,_,_,measures,_ in compiled}}
    (args.out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    (args.out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    qa_images(compiled,target,args.size,args.out)
    prepare_gaze_review(args.out)
    print(f'Built {len(frames)} registered frames: {args.out.resolve()}')
    print('Draft only: review every gaze and runtime tracking, then use review_gaze.py publish.')


if __name__=='__main__':
    main()
