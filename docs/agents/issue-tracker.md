# Project tracker: GitHub plus local mirrors

GitHub Issues and the linked GitHub Project hold live work state. Local Markdown files hold synchronized briefs, decisions, evidence, and handoffs.

## Identity

- Repository: `gvastethecreator/page-pet-skill`
- Project owner: `gvastethecreator`
- Project number: `32`
- Project title: `Page Pet`
- Project URL: `https://github.com/users/gvastethecreator/projects/32`
- Local root: `.scratch/page-pet/`

## Authority

- GitHub owns open or closed state, assignees, comments, native dependencies, labels, and Project field values.
- Local files own expanded task context, decisions, verification evidence, and offline handoff notes.
- Shared fields must match: title, category, triage state, execution state, source, dependencies, acceptance criteria, and outcome.
- Do not copy the full GitHub comment history into local files. Add durable decisions and proof to `## Sync log`.

## Local layout

- Spec: `.scratch/page-pet/spec.md` (`PRD.md` remains compatible).
- Ticket mirrors: `.scratch/page-pet/issues/<NN>-<slug>.md`. Never under `docs/`.
- Rejected requests: `.scratch/page-pet/out-of-scope/<concept>.md`.
- Execution state: `.scratch/planning/`.
- Wayfinding mirrors: `.scratch/wayfinder/<effort-slug>/`.
- Hygiene archive: `.scratch/archive/<YYYY-MM-DD>-<slug>/`. Unique leftover docs, not tickets.

Each mirrored ticket starts with these fields:

```markdown
# <NN>: <title>

GitHub issue: <url-or-pending>
GitHub project: https://github.com/users/gvastethecreator/projects/32
Sync: pending | synced | conflict
Last synced: <ISO-8601-or-never>
Remote updated: <ISO-8601-or-unknown>
Category: bug | enhancement
Status: needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix
Project status: Todo | In Progress | Done
Execution: queued | active | blocked | finished
Type: AFK | HITL
Source: <spec path, issue URL, or conversation>
Blocked by: <GitHub issue numbers or None>
```

## Sync protocol

1. Read the Issue, Project item, and local mirror before a mutation.
2. If both surfaces changed after `Last synced`, set `Sync: conflict` and stop.
3. Write the local draft with `Sync: pending` before remote creation.
4. Create or update the GitHub Issue. Use native parent and blocking relationships when available.
5. Add the Issue to Project `32` under `gvastethecreator`.
6. Set the Project `Status` field to the configured value.
7. Update the local identifiers, shared fields, timestamps, and `Sync: synced`.
8. If a step fails, record the failed step under `## Sync log`. Retry from the stored Issue URL.

Never create a second Issue because Project insertion, field editing, or local patching failed.

## GitHub commands

Use exact identities from this document.

```powershell
gh issue view <number> -R gvastethecreator/page-pet-skill --json number,title,state,body,labels,assignees,comments,updatedAt,url
gh project view 32 --owner gvastethecreator --format json
gh project field-list 32 --owner gvastethecreator --format json
gh project item-list 32 --owner gvastethecreator --limit 200 --format json --field Status
gh project item-add 32 --owner gvastethecreator --url <issue-url>
gh project item-edit 32 --owner gvastethecreator --url <issue-url> --field Status --value <Todo|In Progress|Done>
gh issue create -R gvastethecreator/page-pet-skill --title <title> --body-file <path> --parent <parent-number> --blocked-by <number,number>
gh issue edit <issue-number> -R gvastethecreator/page-pet-skill --parent <parent-number> --add-blocked-by <number>
```

Omit `--parent` or `--blocked-by` when that relationship does not apply. If the installed CLI lacks these flags, write the relationships in the body and record the fallback.

If a GitHub write fails, keep the successful local or remote write. Mark the local file `Sync: pending` with the failed step. On retry, use the stored Issue URL. Never create a replacement Issue.

## Triage and implementation

- Triage changes update one category label, one triage label, and their local fields.
- Starting implementation assigns the Issue, sets Project status and local `Execution:` to active, and updates the local mirror.
- Verified completion posts proof, closes the Issue, sets Project status and local `Execution:` to finished, and updates the local mirror.
- A blocker keeps the Issue open. Record the blocker on GitHub and set local `Execution: blocked`.

## Wayfinding operations

- Create the map as a GitHub Issue with `wayfinder:map`. Mirror it at `.scratch/wayfinder/<effort-slug>/map.md`.
- Create decision tickets as native sub-issues. Mirror them under `.scratch/wayfinder/<effort-slug>/tickets/`.
- Use native blocked-by relationships. Mirror the same Issue numbers in `Blocked by:`.
- Claim a ticket with an assignee, active Project status, and local `Execution: active`.
- Resolve a ticket with a GitHub comment and close, finished Project status, and a local `## Answer` plus sync log.
