# Generate complete-character spritesheets

Use Codex's built-in image tool with its exposed arguments. The new art tool is connected; cropping, registration, runtime and playground are local. Do not require an API key or another provider.

## Lock identity, color and scale

Use one complete neutral reference per character. Describe its body, head or main form, palette, material, camera, lighting and foot baseline. Make one image-generation call per character or variant; do not include other characters' references in that call. Save the exact reference, generated source and prompt beside that character's reviewed layouts. Every generated cell must contain the full character. Make turns change silhouette and visible features, not just pupil position. Distinct labels alone are not evidence of distinct poses.

Generate a small pilot with neutral and neighboring directions first. Inspect the actual images at native and displayed size. Then expand in coherent yaw rows or pitch groups from the accepted source. Do not redraw a separate head or body for later compositing. Whole-character perspective may change the torso; review the neighboring frames as a continuous character and reject disproportionate jumps.

Keep foot position, apparent height, character-specific colors, materials and lighting stable within and across generations. Check that no feature, prop, palette or texture from another character appears. The color of a preview background can mislead: measure PNG alpha and view sprites on light and dark backgrounds. Compare opaque samples of each material to the neutral. For small drift, run the [masked leveling branch](color.md) before layouts and packing. The builder's `--color-limit` sampler only checks Moklo's ivory torso; it neither corrects colors nor approves other palettes.

## Budget actual source pixels

Ask for a large transparent source sheet, then read the returned PNG dimensions. If a requested 4096px sheet arrives at about 1254px, reduce cells per generation instead of enlarging it and claiming extra detail. Leave real transparent gutters between complete silhouettes, including protruding hands and lips. Use multiple high-detail source strips and assemble them into one large runtime atlas.

Each additional character uses five complete-pose strips for 25 directions and two 3x2 sheets for 12 reactions. The final 3200x5120 atlas has 640px cells with room for extended arms. Source size, final atlas size and CSS display size are separate measures. Do not treat an enlarged final canvas as proof of increased native detail.

## Review directions and reactions

Use normalized viewer coordinates: negative x is left; negative y is up. On each row, inspect left profile, left three-quarter, front, right three-quarter and right profile. Compare neighboring pitch rows at each yaw. Check the character's defining features and connected body. Reject repeated directions, reversed labels, crossed eyes, detached joints and palette/material drift. A four-pose pilot has three horizontal gaze points and one reaction; do not describe it as a full 25-direction set.

Reaction sheets contain complete characters too. Draw actual expressions and gestures in the same camera and scale. Keep blink and sleep distinct from user click reactions. Reject a duplicated face rather than counting its name as another expression. A reaction may move arms; its torso and feet should remain consistent with the neutral.

## Mandatory gaze publication gate

`build_pack.py` produces a draft, a sorted `gaze-review.png` and a pending `gaze-review.json`. For an existing pack run `python <skill-dir>/scripts/review_gaze.py prepare <pack>`. Inspect the full grid at readable size, then the character at normal display size. Counts, unique pixel hashes and correct labels cannot prove the character looks at its target.

- Describe the observed direction before accepting the label. Negative x means the viewer's left, never the character's anatomical left. A left-facing CRT has its screen toward image-left and its rear casing toward image-right. A nose or muzzle must project toward its target. Check pupils separately; head orientation alone cannot excuse crossed or opposing eyes.
- Compare each five-cell horizontal sweep for monotonic rotation: profile, three-quarter, front, three-quarter, profile. Compare every vertical column for strong up, slight up, level, slight down and strong down. Use exposed chin/underside and crown/top panel as pitch cues. Tilting the camera, changing eyelids or redrawing the same head does not establish a new pitch.
- For spherical multi-eye characters, identify one stable dominant eye and surrounding eye pattern. Track them over the head surface in both axes; random eye rearrangements do not qualify as rotation.
- A sly or half-lidded identity can retain its expression, but its neutral pupils must still face the viewer. Inspect intermediate columns individually: a generator can swap the second and fourth poses while the outer profiles remain correct. For blocks and slabs, an exposed top panel indicates downward pitch; upward-looking pupils cannot excuse a downward-tilted body. Compare the top and underside before accepting either upper row.
- If correct poses are mislabeled, remap their coordinates without mirroring or redrawing their pixels. If a direction is missing, repeated or ambiguous, regenerate the affected cells from the accepted character. Inspect them again; never relabel a wrong pose merely to reach 25.
- For every frame record `observed`, `status` and visible `evidence` in `gaze-review.json`. Record the reviewer and neighbor-continuity result. Never generate these observations by copying `expected` without visually inspecting the frame. Fail ambiguous frames. Import draft files through the playground and move the physical pointer to all 25 target positions; record `runtimeTracking` only after the selected frame matches each target and its drawing agrees.

Run `python <skill-dir>/scripts/review_gaze.py check <pack>`, then `python <skill-dir>/scripts/review_gaze.py publish <pack> --catalog <skill-dir>/assets/catalog.json`. Use this command instead of editing the catalog directly. Publication requires exactly 25 gaze views and 12 reactions with complete-character sprites; pilots remain drafts. It rejects missing/failed observations, incomplete 5x5 coverage, duplicate pixels and stale manifest/atlas hashes. It cannot detect a dishonest or mistaken visual approval. Any pixel, rectangle or gaze mapping change requires a fresh visual review; do not refresh hashes to reuse old approval. `prepare` preserves an existing record, so explicitly archive a stale record before starting its replacement.

Keep rejected source rows outside the accepted mapping. Remap only correctly drawn poses; regenerate missing, repeated, or reversed directions.

## Cut, pack and preview

Read [alignment.md](alignment.md). Prepare each source with `prepare_layout.py`, inspect all numbered boxes and provide the reviewed layout path to `build_pack.py`. Supply an extras JSON file for additional gaze and reaction sheets. Each gaze entry has `sheet`, `source`, `layout`, `grid` and a row-major `gaze` array. Each extra reaction entry uses `kind: "reaction"` and row-major `ids` instead of `gaze`. Sheet keys use `directions-<id>` or `reactions-<id>` respectively.

```powershell
python <skill-dir>/scripts/prepare_layout.py --directions <source>/level.png --grid 5x1 --reactions <source>/reactions-a.png --reaction-grid 3x2 --out <source>/layout-main
# Review directions-boxes.png and reactions-boxes.png, plus every extra source overlay.
python <skill-dir>/scripts/build_pack.py --directions <source>/level.png --grid 5x1 --reactions <source>/reactions-a.png --reaction-grid 3x2 --layout <source>/layout-main/layout.json --extras <source>/extras.json --names laugh,surprised,wink,kiss,blink,sleep --size 640 --single-atlas --occupancy 0.65 --reaction-scale full-height --reference <character>/reference.png --provenance <source>/provenance.json --name <character> --out <new-pack>
```

The full-pack provenance JSON contains `referenceSha256` and `sources`, an object mapping each primary and extra sheet key to its SHA-256. Additional character reference views belong in `additionalReferences` and are verified by the builder. Keep those records in the character's source directory. The `22` RGB limit used for Moklo is not a universal palette rule. `--occupancy` controls the neutral's apparent height; the builder does not reduce that scale to accommodate raised arms. Use a larger common cell or lower occupancy if a gesture fails the margin gate. Inspect `alignment-contact.png`, `alignment-onion.png`, `build-report.json`, decoded browser frames and the transparent PNG export. A source/rectangle/anchor change requires new evidence. Do not publish a failed visual candidate because numeric checks pass.

For a transparent 2×2 pilot, run `prepare_four_pose_source.py --source <character>/generated.png --reference <character>/reference.png --out <character>/pilot-v1`, then run `prepare_layout.py` on its `directions.png` (3x1) and `reactions.png` (1x1). The pilot script expects neutral, left, right and reaction in row-major order. If a turn is mislabeled, use `--left-cell` and `--right-cell` after visual review; if neutral repeats a side pose, generate a corrected front and pass `--neutral`. Build with `--reference` and `--provenance <character>/pilot-v1/source.json` to bind the accepted source hashes to that reference. Use a new versioned source/output directory for each revision.
