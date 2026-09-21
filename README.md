<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/document.svg?title=Page+Pet&subtitle=Complete-character+gaze+and+reactions.&logo=sparkles&theme=purple&align=center&mode=dark" />
    <img alt="Page Pet — complete-character gaze and reactions" src="https://shieldcn.dev/header/document.svg?title=Page+Pet&subtitle=Complete-character+gaze+and+reactions.&logo=sparkles&theme=purple&align=center&mode=light" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/gvastethecreator/page-pet-skill/actions/workflows/ci.yml"><img alt="CI status" src="https://shieldcn.dev/github/ci/gvastethecreator/page-pet-skill.svg?workflow=CI&branch=main&variant=secondary&size=xs" /></a>
  <a href="https://gvastethecreator.github.io/page-pet-skill/"><img alt="Project site" src="https://shieldcn.dev/badge/site-playground-7652a7.svg?logo=githubpages&variant=branded&size=xs" /></a>
  <a href="https://www.python.org/"><img alt="Python 3" src="https://shieldcn.dev/badge/Python-3-3776ab.svg?logo=python&variant=secondary&size=xs" /></a>
  <a href="https://skills.sh/gvastethecreator/page-pet-skill/page-pet"><img alt="Skills CLI" src="https://shieldcn.dev/badge/install-Skills%20CLI-343434.svg?variant=secondary&size=xs" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://shieldcn.dev/github/license/gvastethecreator/page-pet-skill.svg?variant=secondary&size=xs" /></a>
</p>

# Page Pet

Transparent full-character page pets with gaze tracking, reactions, and a local playground.

Install the Codex skill, generate 25 complete-character gaze views and 12 reactions into one transparent atlas, then preview the pack in the packaged playground. The runtime is a custom element you copy into a host page. New art uses Codex's built-in image tool. Cropping, packing, motion, and the playground run locally with no API key, CDN, remote font, telemetry, or npm install.

[Live site](https://gvastethecreator.github.io/page-pet-skill/) · [Playground](https://gvastethecreator.github.io/page-pet-skill/playground/) · [Skill workflow](SKILLS/page-pet/SKILL.md) · [Generation](SKILLS/page-pet/references/generation.md) · [Alignment](SKILLS/page-pet/references/alignment.md) · [Integration](SKILLS/page-pet/references/integration.md) · [Contributing](CONTRIBUTING.md) · [Sponsor](https://github.com/sponsors/gvastethecreator) · [Ko-fi](https://ko-fi.com/gvaste)

## Quick start

```powershell
npx skills add gvastethecreator/page-pet-skill --skill page-pet
```

Or clone this repository and install `SKILLS/page-pet` through your client's skill workflow.

Serve the playground from the repository root:

```powershell
python ./SKILLS/page-pet/scripts/serve.py
```

Open http://127.0.0.1:4177/ for the 23-pet collection and http://127.0.0.1:4177/playground/ for the atelier. The server binds to loopback. GitHub Pages serves the same files at https://gvastethecreator.github.io/page-pet-skill/. Push to `main` deploys `SKILLS/page-pet/` through `.github/workflows/pages.yml`.

The collection has 23 reviewed pets. Each pack is one lossless `mascot.webp` atlas (3200×5120) with 640px cells: 25 gaze positions and 12 reactions. Default pack: `assets/moklo-single`. Pose export from the playground remains a transparent PNG.

## Usage

Copy `runtime/` and a pack into your app's public directory, then load the custom element:

```html
<script type="module" src="/mascot/runtime/page-pet.js"></script>
<page-pet src="/mascot/moklo-single/manifest.json" size="180"
  label="Moklo: click to react"></page-pet>
```

See [integration](SKILLS/page-pet/references/integration.md) for attributes, methods, and events.

Invoke the skill:

```text
$page-pet create a page pet with 25 gaze views and 12 reactions; each pose must include the complete character in a transparent PNG and appear in the playground.
```

Python 3 with Pillow assembles assets. Optional material color harmonization uses NumPy; connected-component isolation uses NumPy and SciPy. The runtime uses a modern browser.

## Documentation

- Workflow: `SKILLS/page-pet/SKILL.md`
- Generation and gaze gate: `SKILLS/page-pet/references/generation.md`
- Cutting and registration: `SKILLS/page-pet/references/alignment.md`
- Color drift: `SKILLS/page-pet/references/color.md`
- Failure corrections: `SKILLS/page-pet/references/troubleshooting.md`
- Embed contract: `SKILLS/page-pet/references/integration.md`

Selected extraction and registration processes were adapted from [spritesheet-expert](https://github.com/gvastethecreator/spritesheet-expert-skill). The full upstream production workflow was not invoked.

## Status

- Complete-character packs are the live workflow. Historical two-layer manifests still load.
- Publication requires a completed visual gaze review. Frame counts and hashes do not approve art.
- Playground chrome is Spanish. Public docs are American English.
- Source dumps and retired packs stay on the maintainer machine; they are not in git.

## License

[MIT](LICENSE) · [Security reports](SECURITY.md)

GSAP 3.15.0 is vendored under `SKILLS/page-pet/runtime/vendor/gsap/` with its upstream notices.
