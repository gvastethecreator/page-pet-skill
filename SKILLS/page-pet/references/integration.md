# Runtime and pack contract

Copy the entire `runtime/` directory, including `motion.js` and `vendor/gsap/`, and the selected asset pack into your application's public directory. Serve them with the application's existing server. The browser makes only same-origin static file requests. GSAP 3.15.0 is bundled locally; no package installation or framework wrapper is required. Its upstream notices and license link are in `runtime/vendor/gsap/NOTICE.md`.

```html
<script type="module" src="/mascot/runtime/page-pet.js"></script>
<page-pet src="/mascot/moklo-single/manifest.json" size="180"
  label="Moklo: click to react"></page-pet>
```

For React/Vue, load the module once and render the custom element; use the element ref for methods. The packaged runtime has no server-rendering dependency. Load it on the client where `HTMLElement` and `customElements` exist.

## Attributes and methods

| Member | Behavior |
| --- | --- |
| `src` | Same-origin manifest URL; all images decode before the new pack replaces the current one. Load failures emit `page-pet-error`. |
| `size` | Square display size in pixels, clamped to 40–600. Does not alter export resolution. |
| `label` | Accessible button label. Click, Enter, and Space use `click-reaction`. |
| `neck-offset="0"` | Legacy two-layer packs only: lift the separate head within an alpha-derived safe range. Complete-character packs do not use it. |
| `motion="0.45"` | Master motion intensity, 0–1. Zero disables transforms and release inertia while retaining direct dragging and drawn reactions. |
| `drag-jelly="0.65"` | Velocity-driven drag stretch, skew, and lag, 0–1. Zero disables drag deformation. The grab point is the transform origin; x/y scale preserve area. |
| `drag-inertia="0.35"` | Release glide, 0–1. Zero stops layout movement at pointer release. Releasing after holding still does not fling the pet. |
| `motion-bounce="0.4"` | Drop, boundary, and reaction rebound, 0–1. Zero removes those rebounds. |
| `motion-weight="0.45"` | Spring weight, 0–1. Higher values make deformation slower and softer. |
| `motion-damping="0.55"` | Spring damping and glide friction, 0–1. Higher values settle sooner. |
| `reaction-motion="0.7"` | Reaction gesture strength, 0–1, multiplied by master intensity. Each expression has its own movement. |
| `reaction-speed="1"` | Reaction animation speed, 0.5–1.5. Slower gestures extend the reaction hold when needed. |
| `click-response="0.35"` | Local click response, 0–1. Pointer clicks use their contact point as the reaction origin, plus a subtle directional impulse. Zero uses the normal foot pivot. Keyboard and programmatic reactions keep the normal pivot. |
| `click-reaction="cycle"` | Cycle through available reactions without repeating consecutively; blink/sleep are excluded. Use a reaction ID for a fixed choice or `off`. Repeated clicks have a 250ms cooldown. |
| `body-pose="auto"` | Legacy two-layer packs only: persistent body frame ID or automatic pose. Complete-character reactions replace the whole pose. |
| `tracking="off"` | Disable pointer tracking. When enabled, select the nearest declared drawn full-character gaze pose with a central dead zone. |
| `idle="off"` | Disable automatic blink and sleep when those drawn frames exist. Blink occurs every 3.5–6 seconds when facing front and sleep after 14 seconds of inactivity. |
| `paused` | Stop automatic processing, clicks, drag initiation, and spring motion. Explicit `pose` still displays a frame for inspection; `react` returns false while paused. |
| `draggable` | Enable pointer capture and `page-pet-move` delta events; arrow keys also emit 10px deltas. The host page owns layout and applies/clamps movement synchronously. Release inertia uses the same event; actual element displacement tells the spring when it reaches a boundary. |
| `react(id, duration=1100)` | Show a named complete-character reaction, then return to gaze tracking. Returns false if unsupported or inactive. Legacy layered packs retain their own gesture behavior. |
| `pose(id)` | Hold an exact frame until unlocked. Returns false if absent. |
| `unlock()` | Resume live behavior; Escape also unlocks. |
| `center()` | Return gaze to the neutral frame when no held pose/reaction is active. |
| `toBlob()` | Transparent PNG of the current complete-character sprite frame. Legacy layered packs composite their body/head frames. Transient spring motion and playground backgrounds are not baked in. |
| `setPack(manifest, images)` | Load an already decoded local pack, as used by playground file import. `images` is a Map from sheet filename to HTMLImageElement. |

Events: `page-pet-ready` has `{name, frames}`; `page-pet-frame` has `{id, kind, body, reaction}` (`body` is used by legacy layered packs); `page-pet-move` has `{dx, dy, phase}` with `phase` equal to `drag`, `inertia`, or `keyboard`; `page-pet-error` carries an Error. Events bubble from the element. Unknown reactions remain optional: a gaze-only pack works.

Reduced motion disables automatic gaze, idle expressions, jelly deformation, reaction animation, and release inertia. Direct drag, explicit pose selection, and user-triggered drawn reactions remain available. Touch can activate reactions and drag; it does not drive hover gaze. Springs and GSAP timelines stop when the document is hidden, the element is outside the viewport, paused, or disconnected. Pointer cancellation releases capture without a throw. A settled spring removes its GSAP ticker listener; no permanent animation loop is kept for a resting pet. Reaction and spring transforms share one owner and never enter PNG exports.

Keep the host movement handler synchronous. Clamp the element's untransformed layout rectangle to the stage, then update its parent position immediately. Do not animate those coordinates a second time: delayed feedback would look like a blocked edge to the inertia solver. Debounce persistence, not visual movement. The playground implements this in `applyPosition()` and its `page-pet-move` handler. Visual transform limits are ±20px horizontally, −26…26px vertically, ±10° rotation, and ±18% x deformation; proportional y deformation preserves area.

For product events, call reactions from the real application's success/waiting handlers. Provide descriptive accessible status in the application; the decorative pet does not announce every blink or gaze change.

## Manifest v1

The current pack has no `layers` object. Each frame points to a complete sprite within `assets/moklo-single/mascot.webp`; gaze coordinates select the whole drawn character. Historical packs with `layers` still load, but new packs use the complete-character workflow in [generation.md](generation.md). The runtime accepts local `.png`, `.webp`, and `.avif` sheet filenames. New complete-character packs ship lossless WebP.

```json
{
  "version": 1,
  "name": "My pet",
  "neutral": "center",
  "frames": [
    {"id":"center","kind":"gaze","gaze":[0,0],"sheet":"mascot.webp","rect":[0,0,640,640]},
    {"id":"left","kind":"gaze","gaze":[-1,0],"sheet":"mascot.webp","rect":[640,0,640,640]},
    {"id":"happy","kind":"reaction","sheet":"mascot.webp","rect":[1280,0,640,640]}
  ]
}
```

The optional `pivot` is a normalized `[x,y]` anchor in each frame; generated packs declare it for guide overlays. Frame IDs must be unique. Each rectangle is `[x,y,width,height]` in source pixels, square, nonempty, and within its decoded sheet. Sheet names are plain local `.png`, `.webp`, or `.avif` filenames; paths and remote URLs are rejected. Every gaze point is in `[-1,1]²` and unique across all sheets. Neutral must identify a gaze frame. Any number of frames and sheets can be described; runtime cost and image size still increase with asset volume. The builder's grid input allows up to 64 rows/columns per sheet as a resource guard, not a runtime nine-pose limit.

## Placement and playground

The playground provides 15 presets (five columns × three rows), plus free normalized x/y positions over the available stage area. Dragging and arrow keys keep the entire element inside the stage. On small screens the displayed size shrinks to fit; exports retain atlas resolution.

The **Show anchors** and **Show neutral pose** switches in **Scene** expose root drift while selecting head poses. The gaze gallery keeps a spatial grid and names the intended direction. These overlays never enter PNG exports.

In an application use the page's layout, for example:

```css
.page-companion {
  position: fixed;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
}
```

Choose a location that keeps essential content and controls accessible. Do not automatically attach draggable positioning or a high z-index to all integrations.

The **Character** tab exposes size, click behavior, and reaction preview. Neck and body-layer controls appear only for historical layered packs. **Motion** contains nine movement controls, Soft/Jelly/Elastic presets, and a reaction preview. **Scene** contains positioning, tracking, pause, and inspection overlays. The desktop layout fits at 1280×720.

Playground settings persist in localStorage. Its configuration export and embed snippet include only controls that apply to the selected pack; complete-character packs omit neck and separate-body settings. Imported packs stay in memory for the current session; the UI states this. To retain a creation, copy its pack into `assets/<id>/` and add `./<id>/manifest.json` to `assets/catalog.json`. Config export records settings only; PNG export captures the current pose. Retain original source sheets and the pack separately.

Import selects `manifest.json` and every referenced sheet together. Invalid manifests, missing images, out-of-bounds frames, empty cells, and opaque backgrounds are rejected before replacing the active pet. Imported text is inserted as text, never HTML. Import has a 32MB per-file and 128MB total input size guard.

Reaction thumbnails use pages of 12 when needed; the full reaction selector remains available. Complete-character packs need no neck calibration.
