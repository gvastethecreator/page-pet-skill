# Failure-driven corrections

Use the row that matches the observed failure. Preserve the rejected source and make a versioned replacement. Rebuild layouts, provenance, atlas and visual evidence after any pixel, anchor, scale or coordinate change.

| Observed failure | Required correction | Evidence before continuing |
|---|---|---|
| Small skin/material color drift | Use the masked [color branch](color.md); keep a fixed neutral reference | Same material samples, reviewed masks, light/dark comparison and bound report |
| Major palette, shape or material drift | Regenerate from the accepted identity; color leveling cannot fix anatomy | Original reference beside pilot and replacement |
| Features borrowed from another mascot | One character per generation context; references and pilot hashes checked before each call | Reference contact and all source hashes |
| Too few blocks, limbs or defining features | Reject the pilot before expanding; state the exact feature count | Identity checklist against the user's reference |
| Whole pack generated at low native detail | Split into five gaze strips and two reaction sheets | Actual source dimensions, alpha and readable faces; atlas dimensions do not prove detail |
| Same gaze repeated or sideways neutral pupils | Regenerate affected cells; check head and pupils separately | True 5x5 target grid, each cell described before accepting its label |
| Intermediate columns reversed | Remap only correctly drawn poses; never mirror as a shortcut | Monotonic left/front/right sweep including columns two and four |
| Upward pupils on downward-facing head/block | Regenerate actual pitch; inspect crown/top and chin/underside | Distinct adjacent pitch rows at all five yaws |
| Wide arm gesture becomes smaller | Keep an anatomical scale proxy and common cell size; add canvas room | Neutral overlay, stable body size, margin report and feet |
| Pitch rows change character size | Compare body-width vs central-front-height scale policy | Cross-row contact; do not normalize a real crouch as if standing |
| Crop cuts arms or neighboring sprites | Review alpha gutters; isolate connected silhouettes when bounds overlap | Numbered boxes, preserved alpha mass and no lost detached details |
| One pose floats above the baseline | Inspect stray alpha and measured foot root before overriding anchors | Full-resolution alpha bounds; remove only proven contamination, retain original |
| Head/body seam or color mismatch in two layers | Generate complete-character sprites | One complete drawing per pose; no independently drawn body/head assembly |
| Browser selects wrong targets near scene edge | Move mascot inward; make targets fit inside stage; temporarily disable motion | All 25 physical-pointer selections and drawings agree; restore prior motion settings |
| Counts pass but art is wrong | Treat structural checks as diagnostics | Named per-frame visual observations and runtime review |
| Approval survives modified art | Never refresh only hashes to reuse an approval | Fresh review bound to final manifest and atlas bytes |
| Imported candidate mistaken for published pack | Imported packs are session-only drafts | Guarded `review_gaze.py publish`, then browser reload from catalog |

Complete generation jobs before replacing their output files; a late job must not overwrite a reviewed correction. Keep one working record with accepted paths, rejected candidates, valid evidence and the next action. Record actual limitations instead of describing a mechanical pass as visual proof.
