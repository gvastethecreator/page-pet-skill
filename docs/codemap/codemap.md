# Code map: page-mascot-local

Generated: 2026-09-21T06:39:44Z | Commit: `6f4670974ceb` | Schema: 2
Generation: `020382d553b6cb987df2f9a1cad3a58e68629acf286891e9eac0ed2f6d501a6f`
Scope: SKILLS/page-pet/playground, SKILLS/page-pet/runtime, SKILLS/page-pet/scripts, scripts | Inventory: working-tree
Nodes: 41 | Edges: 123 | Flows: 5

## Coverage

- Analysis: **partial**; 18 analyzed of 18 included files.
- Configuration files: 0; omitted untracked files: 0.
- Unresolved references and analysis limits: 74.
- Static references and call paths do not prove runtime execution or test coverage.

## Modules

- `SKILLS/page-pet/playground/app.js` | module | Playground | callers: none | callees: SKILLS/page-pet/playground/review.js, SKILLS/page-pet/playground/review.js, SKILLS/page-pet/runtime/manifest.js, SKILLS/page-pet/runtime/manifest.js | tests: 0 | entry: none
- `SKILLS/page-pet/playground/review.js` | module | Playground | callers: SKILLS/page-pet/playground/app.js, SKILLS/page-pet/playground/app.js | callees: none | tests: 0 | entry: none
- `SKILLS/page-pet/runtime/manifest.js` | module | Runtime | callers: SKILLS/page-pet/playground/app.js, SKILLS/page-pet/playground/app.js, SKILLS/page-pet/runtime/page-pet.js, SKILLS/page-pet/runtime/page-pet.js | callees: none | tests: 0 | entry: none
- `SKILLS/page-pet/runtime/motion.js` | module | Runtime | callers: SKILLS/page-pet/runtime/page-pet.js | callees: none | tests: 0 | entry: none
- `SKILLS/page-pet/runtime/page-pet.js` | module | Runtime | callers: SKILLS/page-pet/playground/app.js | callees: SKILLS/page-pet/runtime/manifest.js, SKILLS/page-pet/runtime/manifest.js, SKILLS/page-pet/runtime/motion.js, SKILLS/page-pet/runtime/puppet.js | tests: 0 | entry: none
- `SKILLS/page-pet/runtime/puppet.js` | module | Runtime | callers: SKILLS/page-pet/playground/app.js, SKILLS/page-pet/playground/app.js, SKILLS/page-pet/runtime/page-pet.js, SKILLS/page-pet/runtime/page-pet.js | callees: none | tests: 0 | entry: none
- `SKILLS/page-pet/scripts/build_layered_pack.py` | module | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:build_pack | tests: 0 | entry: none
- `SKILLS/page-pet/scripts/build_pack.py` | interface | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:json | tests: 0 | entry: SKILLS/page-pet/scripts/build_pack.py:main
- `SKILLS/page-pet/scripts/check_color_leveling.py` | interface | Builders | callers: none | callees: external:python:PIL, external:python:json, external:python:json, external:python:level_colors | tests: 0 | entry: SKILLS/page-pet/scripts/check_color_leveling.py:main
- `SKILLS/page-pet/scripts/isolate_strip.py` | interface | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:numpy | tests: 0 | entry: SKILLS/page-pet/scripts/isolate_strip.py:isolate
- `SKILLS/page-pet/scripts/level_colors.py` | module | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:hashlib | tests: 0 | entry: none
- `SKILLS/page-pet/scripts/prepare_four_pose_source.py` | interface | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:json | tests: 0 | entry: SKILLS/page-pet/scripts/prepare_four_pose_source.py:main
- `SKILLS/page-pet/scripts/prepare_layout.py` | module | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:hashlib | tests: 0 | entry: none
- `SKILLS/page-pet/scripts/review_gaze.py` | interface | Builders | callers: none | callees: external:python:PIL, external:python:argparse, external:python:argparse, external:python:hashlib | tests: 0 | entry: SKILLS/page-pet/scripts/review_gaze.py:main
- `SKILLS/page-pet/scripts/serve.py` | module | Builders | callers: none | callees: external:python:argparse, external:python:argparse, external:python:functools, external:python:functools | tests: 0 | entry: none
- `SKILLS/page-pet/scripts/verify_master.py` | module | Builders | callers: none | callees: external:python:PIL, external:python:build_pack, external:python:build_pack, external:python:json | tests: 0 | entry: none
- `external:javascript:node:child_process` | external | External | callers: scripts/validate-skill-pack.mjs, scripts/validate-skill-pack.mjs | callees: none | tests: 0 | entry: none
- `external:javascript:node:fs` | external | External | callers: scripts/validate-skill-pack.mjs | callees: none | tests: 0 | entry: none
- `external:javascript:node:path` | external | External | callers: scripts/validate-skill-pack.mjs | callees: none | tests: 0 | entry: none
- `external:javascript:node:url` | external | External | callers: scripts/validate-skill-pack.mjs, scripts/validate-skill-pack.mjs | callees: none | tests: 0 | entry: none
- Showing 20 of 41 nodes. Query `impact --module <path>` or open the HTML hierarchy for the rest.

## Edges

- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/playground/review.js` | calls
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/playground/review.js` | imports
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/runtime/manifest.js` | calls
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/runtime/manifest.js` | imports
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/runtime/page-pet.js` | imports
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/runtime/puppet.js` | calls
- `SKILLS/page-pet/playground/app.js` -> `SKILLS/page-pet/runtime/puppet.js` | imports
- `SKILLS/page-pet/runtime/page-pet.js` -> `SKILLS/page-pet/runtime/manifest.js` | calls
- `SKILLS/page-pet/runtime/page-pet.js` -> `SKILLS/page-pet/runtime/manifest.js` | imports
- `SKILLS/page-pet/runtime/page-pet.js` -> `SKILLS/page-pet/runtime/motion.js` | imports
- `SKILLS/page-pet/runtime/page-pet.js` -> `SKILLS/page-pet/runtime/puppet.js` | calls
- `SKILLS/page-pet/runtime/page-pet.js` -> `SKILLS/page-pet/runtime/puppet.js` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:PIL` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:argparse` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:argparse` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:build_pack` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:build_pack` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:json` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:json` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:math` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:math` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:pathlib` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:prepare_layout` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:prepare_layout` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:re` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:re` | imports
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:verify_master` | calls
- `SKILLS/page-pet/scripts/build_layered_pack.py` -> `external:python:verify_master` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:PIL` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:argparse` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:argparse` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:json` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:json` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:level_colors` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:math` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:math` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:pathlib` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:prepare_layout` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:prepare_layout` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:re` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:re` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:review_gaze` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:review_gaze` | imports
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:statistics` | calls
- `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:statistics` | imports
- `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:PIL` | imports
- `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:json` | calls
- `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:json` | imports
- `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:level_colors` | calls
- `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:level_colors` | imports
- Showing 50 of 123 edges; JSON contains every edge and its evidence.

## Unknown

- `SKILLS/page-pet/runtime/motion.js:1`: unresolved-local-import (./vendor/gsap/index.js)
- `SKILLS/page-pet/scripts/build_layered_pack.py:52`: object-member-call-not-resolved (ImageFilter)
- `SKILLS/page-pet/scripts/build_layered_pack.py:53`: object-member-call-not-resolved (ImageChops)
- `SKILLS/page-pet/scripts/build_layered_pack.py:54`: object-member-call-not-resolved (ImageChops)
- `SKILLS/page-pet/scripts/build_layered_pack.py:94`: object-member-call-not-resolved (Image)
- `SKILLS/page-pet/scripts/build_layered_pack.py:117`: object-member-call-not-resolved (Image)
- `SKILLS/page-pet/scripts/build_layered_pack.py:117`: object-member-call-not-resolved (ImageDraw)
- `SKILLS/page-pet/scripts/build_layered_pack.py:125`: object-member-call-not-resolved (Image)
- `SKILLS/page-pet/scripts/build_layered_pack.py:125`: object-member-call-not-resolved (ImageDraw)
- `SKILLS/page-pet/scripts/build_pack.py:58`: object-member-call-not-resolved (Image)
- `SKILLS/page-pet/scripts/build_pack.py:64`: object-member-call-not-resolved (Image)
- `SKILLS/page-pet/scripts/build_pack.py:65`: object-member-call-not-resolved (ImageDraw)

## Flows

- Python __main__: `SKILLS/page-pet/scripts/isolate_strip.py` -> `external:python:numpy` | Static call path reaches external:python:numpy:array
- Python __main__: `SKILLS/page-pet/scripts/review_gaze.py` -> `external:python:argparse` | Static call path reaches external:python:argparse:ArgumentParser
- Python __main__: `SKILLS/page-pet/scripts/build_pack.py` -> `external:python:math` | Static call path reaches external:python:math:ceil
- Python __main__: `SKILLS/page-pet/scripts/check_color_leveling.py` -> `external:python:level_colors` | Static call path reaches external:python:level_colors:run
- Python __main__: `SKILLS/page-pet/scripts/prepare_four_pose_source.py` -> `external:python:prepare_layout` | Static call path reaches external:python:prepare_layout:cuts

## Architecture changes

- Nodes: +41 / -0; edges: +123 / -0.
- Boundary changes: 0; new cycles: 0.

## Read next

- Use `status` before relying on this generation.
- Use `impact --changed` for possible impact and related test evidence.
- Use `diff --before <model> --after <model>` for architecture changes.
