# Domain docs

How engineering skills consume this repo's domain docs when exploring.

## Before exploring, read these

- **`SKILLS/page-pet/SKILL.md`**: live pack, playground, and publication workflow.
- **`CONTEXT.md`** at the repo root, if it exists.
- **`docs/adr/`**: ADRs that touch the area you are about to work in.

If `CONTEXT.md` or `docs/adr/` do not exist, **proceed silently**. Do not flag absence or suggest creating them. `/grill-with-docs` creates them lazily when terms or decisions resolve.

## Public vs local

Tickets, task lists, and in-flight architecture spikes never live under `docs/`. Local tickets: `.scratch/page-pet/issues/`. Operator architecture: `.scratch/architecture/`. `docs/adr/` is the published decision log only when README, CONTRIBUTING, or this contract treats it as public/contributor docs.

## File structure

Single-context repo:

```
/
├── SKILLS/page-pet/
├── docs/agents/
└── docs/codemap/
```

## Vocabulary

Use the repo's terms: page pet, complete-character pack, gaze view, reaction, atlas, playground, `<page-pet>`. Do not revive layered head/body compositing as the default workflow.

If output contradicts the complete-character contract in `SKILL.md`, surface it; do not silently override.
