# Small color drift

Run this branch after generation, before layout hashes and packing, when the same material changes color slightly between sheets or frames. Compare the accepted neutral and source sheets first. Record either no correction needed, correction reviewed, or regenerate in the task's working record. Do not alter every published pack by default.

## Scope

`scripts/level_colors.py` compares opaque midtone samples of the same material in Oklab and shifts only explicit grayscale material masks. Inputs are RGBA sRGB PNGs without embedded ICC profiles; convert tagged images to sRGB explicitly before this step. Pillow and NumPy are required. The runtime has no new dependencies.

Use one immutable accepted neutral PNG as the color reference for every sheet. Sample the same material under comparable lighting, not the whole image average. Skin, lips, eyes, clothing, outlines and highlights are separate materials. Keep color differences caused by pose lighting or intentional emotion. A color-distance threshold cannot identify skin or certify the mask.

Default correction changes chroma coordinates only and preserves Oklab lightness. `levelLightness: true` also permits a small constant lightness offset (at most 0.02). It does not flatten shading. Default maximum sample distance is 0.035 Oklab units; the hard ceiling is 0.06. These are conservative project limits, not universal perceptual tolerances. Larger drift blocks PNG output and requires regeneration or better sample selection. Mixed or tiny samples also fail.

## Recipe

Create a grayscale `L` mask with the exact source dimensions: white selects the material, black protects it, gray feathers the boundary. Inspect the mask on every pose. Exclude other materials, outlines and highlights; color similarity alone is not segmentation. For per-frame deviations use separate, non-overlapping masks and samples. Regions on the same sheet may name the same material. Preserve original sources and masks.

All paths are relative to the recipe file. Every image and mask is SHA-256 bound. Rectangles are `[left, top, right, bottom]` pixel coordinates, exclusive right/bottom. Replace the example rectangles and hash placeholders with inspected values.

```json
{
  "version": 1,
  "reference": {"path": "neutral.png", "sha256": "REFERENCE_HASH"},
  "materials": {"skin": {"referenceSample": [80, 100, 110, 125], "levelLightness": false}},
  "maxDelta": 0.035,
  "sheets": [{
    "path": "up.png", "sha256": "SOURCE_HASH",
    "regions": [{"material": "skin", "sample": [75, 95, 105, 120],
      "mask": {"path": "up-skin-mask.png", "sha256": "MASK_HASH"}}]
  }]
}
```

```powershell
python <skill>/scripts/level_colors.py --recipe <source>/color-recipe.json --out <source>/color-check-v1
python <skill>/scripts/level_colors.py --recipe <source>/color-recipe.json --out <source>/color-candidate-v1 --apply
```

Each run requires a new output directory. Diagnostic mode writes the measured report, coverage masks and light/dark comparisons. `--apply` also writes candidate PNGs only when every region is within limits. Alpha, geometry and pixels outside masks remain unchanged. Gamut-bound pixels receive a reduced shift; inspect residual `deltaAfter` rather than assuming full convergence. No global histogram matching, palette quantization, automatic skin detection or painted-over features.

## Accept and bind

Inspect the full-resolution candidate, mask coverage and comparison: skin consistency, shading, edges, eyes, lips and clothing. The small contact is navigation, not sufficient proof of individual frames. If accepted, add a named `reviewer` and set `visualReview: "pass"` in `color-report.json`. Keep `status` as the measured technical result. A low delta alone does not authorize visual approval.

Re-run layout inspection on corrected PNGs, point source paths to the accepted candidates and update every changed source hash. Add the color reference to `additionalReferences` if it is the accepted pilot rather than the original user reference. In build provenance add:

```json
"colorLeveling": [{"path": "color-candidate-v1/color-report.json", "sha256": "REVIEWED_REPORT_HASH"}]
```

The builder checks report hashes, named review, reference identity and corrected output hashes against its actual source sheets. Build a new pack, inspect scale and color again, then perform the normal gaze and pointer review. Any changed atlas invalidates its prior gaze approval. The playground's technical diagnosis does not approve color or replace these source-level checks.

Color conversion uses [Björn Ottosson's Oklab definition and public-domain matrices](https://bottosson.github.io/posts/oklab/). The masked correction policy and thresholds above are specific to this workflow.
