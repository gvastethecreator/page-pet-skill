# Contributing

Keep changes focused on the complete-character pack contract, the local playground, and the `<page-pet>` runtime. Public documentation uses American English.

## Check a change

Use the pnpm version declared in `package.json`. From the repository root run one sufficient gate:

- `pnpm run check`: skill package structure, catalog files, Python compile, and JavaScript syntax.

The [VS Code tasks](.vscode/tasks.json) run these commands with the workspace root as their working directory. They do not install dependencies. Add a focused regression only for a meaningful failure that existing coverage does not protect.

Python builders need Pillow. Masked color leveling needs NumPy. Connected-component isolation needs NumPy and SciPy. The runtime and playground do not install npm packages; GSAP is vendored under `runtime/vendor/gsap/`.

## Preserve the contracts

- New packs are one complete character per pose: 25 gaze views and 12 reactions in a transparent atlas.
- Counts, hashes, and alignment reports are technical gates. They do not prove artistic continuity.
- Publish only through `scripts/review_gaze.py publish` after a completed visual review.
- Keep private source dumps, retired packs, and operator notes outside the tracked tree.
- Preserve reduced-motion, pause, pointer cancellation, and cleanup when changing motion.

## Navigate the source

The generated [code map](docs/codemap/codemap.md) links modules and direct calls. Its [interactive view](docs/codemap/codemap.html) exposes the same source evidence. Static reachability does not prove runtime behavior.

When module boundaries or dependencies change, refresh `codemap.json`, `codemap.md`, `codemap.html`, and `codemap.lock` together with the `maintain-code-map` tool. Keep review/staging files ignored. The map is contributor documentation; it is not part of the installable skill or the product test gate.
