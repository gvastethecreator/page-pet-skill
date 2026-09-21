"""Focused preservation check: small material drift, protected pixels and fail-closed inputs."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image
from level_colors import digest, run, to_lab, to_linear, to_rgb, verify_reports


def main():
    with TemporaryDirectory() as folder:
        root = Path(folder)
        ref = np.zeros((32,32,4),dtype=np.uint8)
        ref[4:28,4:28] = [215,198,168,255]
        ref[8:12,8:12] = [35,40,50,255]  # Protected eyes.
        mask = np.zeros((32,32),dtype=np.uint8)
        mask[14:26,5:27] = 255
        source = ref.copy(); source[mask>0,:3] = [218,197,162]
        # Preserve a nontrivial alpha edge exactly, including RGB of alpha-zero pixels.
        source[4,4:28,3] = np.arange(24)*10
        Image.fromarray(ref).save(root/'neutral.png')
        Image.fromarray(source).save(root/'source.png')
        Image.fromarray(mask).save(root/'mask.png')
        bind=lambda name:{'path':name,'sha256':digest(root/name)}
        recipe={'version':1,'reference':bind('neutral.png'),'materials':{'skin':{'referenceSample':[6,16,16,23]}},
                'sheets':[{**bind('source.png'),'regions':[{'material':'skin','sample':[6,16,16,23],'mask':bind('mask.png')}]}]}
        recipe_path=root/'recipe.json'
        recipe_path.write_text(json.dumps(recipe))
        report=run(recipe_path,root/'small',True)
        result=np.array(Image.open(root/'small/source.png'))
        assert report['applied'] and report['visualReview']=='pending'
        assert np.array_equal(result[:,:,3],source[:,:,3])
        assert np.array_equal(result[mask==0],source[mask==0])
        material=report['sheets'][0]['materials'][0]
        assert material['deltaAfter'] < material['deltaBefore']
        assert np.max(np.abs(to_lab(result[:,:,:3][mask>0])[:,0]-to_lab(source[:,:,:3][mask>0])[:,0])) < .002
        colors=np.array([[0,0,0],[255,255,255],[255,0,0],[24,182,95],[215,198,168]])
        assert np.array_equal(to_rgb(to_linear(to_lab(colors))),colors)
        prov={'referenceSha256':recipe['reference']['sha256'], 'colorLeveling':[
            {'path':'small/color-report.json','sha256':digest(root/'small/color-report.json')}]}
        try:
            verify_reports(prov,root,[('directions',root/'small/source.png',(1,1))])
        except ValueError:
            pass
        else:
            raise AssertionError('An unreviewed color candidate passed the build gate')
        source[mask>0,:3]=[130,170,225]
        Image.fromarray(source).save(root/'source.png')
        try:
            run(recipe_path,root/'stale',True)
        except ValueError:
            pass
        else:
            raise AssertionError('A stale source hash was accepted')
        recipe['sheets'][0].update(bind('source.png'));recipe_path.write_text(json.dumps(recipe))
        report=run(recipe_path,root/'large',True)
        assert report['status']=='blocked' and not (root/'large/source.png').exists()
        print('PASS: drift reduced; lightness, alpha and protected pixels preserved; large drift, stale sources and pending review blocked.')


if __name__=='__main__':
    main()
