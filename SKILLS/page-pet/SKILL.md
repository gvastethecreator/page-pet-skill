---
name: page-pet
description: "Create transparent full-character page-pet spritesheets with Codex, 25 gaze poses and 12 reactions, and preview local packs."
---

# Page Pet

Create an interactive page pet from **one complete-character sprite per pose**. Head and body are drawn together in each frame. Source art can span several generations; pack accepted frames into one transparent runtime atlas. Browser runtime, build scripts, and playground run locally with no API keys, remote fonts, or telemetry. New art uses Codex's built-in image tool, which needs connectivity.

## Workflow

1. Identify the character, source reference, target page, and useful behaviors. Read [references/generation.md](references/generation.md). Keep each character in its own source directory and image-generation call. Record the reference and generated-source hashes; never pass another character's reference or output into the pack. Select one complete neutral character as the immutable identity and color reference. Every direction and reaction must draw the full character at the same apparent scale, palette, lighting, and foot baseline. Real gaze changes rotate the head and change perspective; moving only pupils does not qualify.
   - Record the anatomical side of every asymmetric feature using the [identity-side map](references/generation.md#lock-asymmetric-features). Do not write profile prompts until the near/far side is resolved from the frontal reference.
   - Done when the character, reference hashes, identity-side map, and complete-character contract are recorded.

2. Generate a small complete-character yaw/pitch pilot first. Check the neutral, neighboring directions, and one reaction before expanding. Prefer coherent small strips when the image tool does not return enough native pixels per cell. For a reviewed 2×2 pilot (neutral, left, right, reaction), `scripts/prepare_four_pose_source.py` preserves source pixels in separate gaze/reaction sheets and records their hashes. Replace a repeated or wrong neutral before building. Record actual dimensions and alpha; a requested resolution is not proof of received detail. Keep rejected generations for diagnosis, outside the published pack.
   - Stop expansion when a pilot fails identity, direction, or near/far occlusion. A failed sheet cannot become an identity anchor.
   - Done when a visually accepted pilot exists with measured size and alpha, including correct asymmetric features in both profiles.

3. Generate intermediate directions and expressions in separate source sheets using the same accepted reference. Check each pose for correct head direction, natural neck/body continuity, identity, material colors, and a distinct expression. The entire character stays in every cell. Compare material colors to the accepted neutral before cutting. For small drift, follow [references/color.md](references/color.md): explicit material masks, bounded leveling, before/after review, and new source hashes. For large drift, regenerate. Record whether correction was unnecessary, accepted, or rejected.
   - Preserve accepted source files and reuse their actual crops in the atlas. Passing an image as a generation reference does not preserve its pixels. Generate replacements as versioned sheets; review each replacement before accepting it.
   - Done when all source sheets retain the same identity and reviewed colors.

4. Run `scripts/prepare_layout.py` on each source and visually inspect every numbered extraction box. If independently drawn characters overlap in horizontal extent and no full-height alpha gutter exists, use `scripts/isolate_strip.py` to separate connected silhouettes without scaling or losing pixels, then inspect the new layout. Never impose an equal-width cut on overlapping art. Build with `scripts/build_pack.py --single-atlas` using reviewed layouts and explicit gaze/reaction IDs. Pass `--reference` and `--provenance` for both pilots and full packs; a full-pack record lists the SHA-256 of every source sheet by sheet key. Mismatched character inputs fail before output. Use `--color-limit` only for ivory characters with a suitable torso sample. Choose `--gaze-scale neutral-height` for separate pitch strips whose front-pose standing height is stable; otherwise review the default body-width policy for perspective-driven size drift. Choose `--reaction-scale head-core` when that measured feature is stable, `full-height` when reaction sheets have a different native character size, or `neutral` when no stable feature exists. Inspect the result in each case. The builder registers feet, keeps one scale per gaze sheet, and rejects clipping, unowned pixels, stale source hashes, and duplicate gaze coordinates. A wide arm pose must get more transparent cell room, never force the whole pack to shrink. Read the scale checks in [references/alignment.md](references/alignment.md).
   - Done when the builder wrote a complete-character atlas and the numbered overlays were inspected.

5. Use the packaged skill playground: its flow guide explains the stages; import `manifest.json`, all sheets, and `gaze-review.json` when available. Use **Review pack** for coverage, alpha, duplicate art, and review-record freshness, then **Compare neutral pose** for visual scale/anchor checks. Inspect all adjacent yaw/pitch changes, reactions, color, alpha edges, click/idle behavior, and PNG export at actual display size on light and dark backgrounds. The head/body transition is part of each original drawing; no runtime neck adjustment is required. The browser diagnosis never approves or publishes art.
   - Done when both technical evidence and visual checks pass.

6. Complete the mandatory [gaze review](references/generation.md#mandatory-gaze-publication-gate). The builder creates `gaze-review.png` sorted as a true target grid and a pending `gaze-review.json`. Observe every frame independently of its label; record the visible head/eye direction and concrete feature evidence. Check all 25 cursor targets in the browser. Publish only with `scripts/review_gaze.py publish <pack> --catalog <assets/catalog.json>`. Missing, failed, or stale reviews block that command. This validates evidence records, not visual semantics automatically; never fill approval fields merely because a build or frame count passed.
   - Done when `publish` accepted the pack and the catalog lists it.

7. Include the build report, sorted contact, and completed gaze and identity reviews with the published pack. `identity-review.json` must cover every asymmetric landmark in all 25 directions and 12 reactions; publication blocks missing or stale records. Counts, hashes, alignment, and RGB samples are technical gates; they do not prove artistic continuity. Record remaining differences for human review.
   - Done when the pack is self-contained and remaining visual limits are recorded.

The active `assets/catalog.json` is the collection authority. It currently contains 23 reviewed pets. Each has 25 complete gaze poses and 12 complete reactions in one 3200×5120 atlas of 640px cells. `assets/moklo-single/manifest.json` is the default. Keep character sources, reviewed layouts, and provenance beside the work that produced them. For characters based on multiple reference views, preserve and hash every reference in `additionalReferences` alongside the primary `referenceSha256`. Historical layered and four-pose pilot packs may still load in the runtime; they are not in the active catalog or this workflow.

## Resources

- [references/generation.md](references/generation.md): prompts, native resolution, semantic gaze and reaction review.
- [references/alignment.md](references/alignment.md): transparent source cutting, registration, color, and visual checks.
- [references/color.md](references/color.md): load when materials show small color drift; masked correction, limits, and reviewed provenance.
- [references/troubleshooting.md](references/troubleshooting.md): load when generation, cropping, scale, directions, or review fail; corrections from actual rejected work.
- [references/integration.md](references/integration.md): embed and control the runtime.
- `scripts/prepare_layout.py`: source-hashed extraction boxes and numbered overlays.
- `scripts/isolate_strip.py`: lossless separation of distinct connected characters whose horizontal bounds overlap; requires NumPy and SciPy when used.
- `scripts/prepare_four_pose_source.py`: reviewed four-pose pilot split with single-reference provenance.
- `scripts/assemble_reviewed_strip.py`: lossless assembly of accepted crops from several reviewed sheets; records source and layout hashes and never mirrors or resamples.
- `scripts/build_pack.py`: full-character registration and optional one-atlas packing.
- `scripts/level_colors.py`: local masked material leveling and before/after reports; requires Pillow and NumPy; preserves alpha and original files.
- `scripts/serve.py`: loopback-only playground server.
- `runtime/page-pet.js`: custom element `<page-pet>` for gaze, clicks, idle, and transparent export.
- `scripts/review_gaze.py`: sorted target contact, per-frame review record, and guarded local catalog publication.
- `runtime/motion.js` and `runtime/vendor/gsap/`: locally bundled GSAP, configurable jelly drag, inertial release, bounded springs, and reaction sequences. Preserve reduced-motion, pause, pointer cancellation, and cleanup when changing behavior.

Keep published packs self-contained. Copy the runtime and selected assets into the target project. For product events, call the named reactions from the application's own handlers. Do not infer application state by scraping forms. Preserve the original generated art and reviewed layouts for later revisions.
