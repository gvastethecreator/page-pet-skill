# Page Pet

Codex skill pack for transparent full-character page pets. Live workflow: `SKILLS/page-pet/SKILL.md`.

## Agent skills

### Issue tracker

GitHub Issues and the linked GitHub Project hold live state. `.scratch/` holds synchronized local mirrors. See [issue tracker](docs/agents/issue-tracker.md).

### Triage labels

`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See [triage labels](docs/agents/triage-labels.md).

### Domain docs

Single-context. See [domain docs](docs/agents/domain.md).

## Commands

From the repository root:

```powershell
python ./SKILLS/page-pet/scripts/serve.py
pnpm run check
```

Playground: http://127.0.0.1:4177/playground/

Invoke the skill as `$page-pet`. Embed with `<page-pet>` from `SKILLS/page-pet/runtime/page-pet.js`.

Do not commit `.scratch/`, `.local/`, `art-source/`, or retired packs listed in `.gitignore`.
