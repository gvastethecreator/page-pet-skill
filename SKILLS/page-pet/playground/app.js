import '../runtime/page-pet.js';
import { validateManifest, validateImages, decodeImage, sheetNames } from '../runtime/manifest.js';
import { drawPose } from '../runtime/puppet.js';
import { inspectPack, renderInspection, hashBytes } from './review.js';

const $ = selector => document.querySelector(selector);
const mascot = $('#mascot');
const stage = $('#stage');
const packs = [];
const motionControls = [
  ['physics', 'motion', 45], ['jelly', 'drag-jelly', 65], ['inertia', 'drag-inertia', 35],
  ['bounce', 'motion-bounce', 40], ['weight', 'motion-weight', 45], ['damping', 'motion-damping', 55],
  ['reactionMotion', 'reaction-motion', 70], ['reactionSpeed', 'reaction-speed', 100],
  ['clickResponse', 'click-response', 35],
];
const motionPresets = {
  soft: Object.fromEntries(motionControls.map(([key, , value]) => [key, value])),
  jelly: { physics: 75, jelly: 100, inertia: 45, bounce: 65, weight: 65, damping: 35, reactionMotion: 80, reactionSpeed: 90, clickResponse: 35 },
  elastic: { physics: 70, jelly: 45, inertia: 75, bounce: 75, weight: 30, damping: 30, reactionMotion: 90, reactionSpeed: 110, clickResponse: 35 },
};
const defaults = { size: 320, x: 50, y: 53, surface: 'paper', tracking: true, idle: true, paused: false, guides: false, onion: false, placement: 'free', neck: 0, ...motionPresets.soft, clickReaction: 'cycle', bodyPose: 'auto' };
let settings = { ...defaults }, selected = null, kind = 'gaze', reactionPage = 0;
const dockStack = [];
const labels = { blink: 'Blink', happy: 'Happy', love: 'Love', surprised: 'Surprise', sleep: 'Sleep', laugh: 'Laugh', wink: 'Wink', kiss: 'Kiss', shrug: 'Shrug', offer: 'Offer', hug: 'Hug', shy: 'Shy', dance: 'Dance', idle: 'Idle', think: 'Think', wave: 'Wave', celebrate: 'Celebrate' };
let noticeTimer;
const notice = text => {
  clearTimeout(noticeTimer); $('#notice').textContent = text;
  noticeTimer = setTimeout(() => { $('#notice').textContent = ''; }, 5000);
};
Object.assign(labels, { worried: 'Worried', annoyed: 'Annoyed', smug: 'Smug', confused: 'Confused', excited: 'Excited', point: 'Point', clap: 'Clap', proud: 'Proud', stretch: 'Stretch', shush: 'Shush', rest: 'Rest', calm: 'Calm' });
try {
  const saved = JSON.parse(localStorage.getItem('mascot-atelier-settings'));
  if (saved) {
    for (const key of ['size', 'x', 'y', 'neck', ...motionControls.map(([key]) => key)]) if (Number.isFinite(saved[key])) settings[key] = saved[key];
    for (const key of ['tracking', 'idle', 'paused', 'guides', 'onion']) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
    if (['paper', 'lilac', 'night', 'alpha'].includes(saved.surface)) settings.surface = saved.surface;
    for (const key of ['clickReaction', 'bodyPose']) if (typeof saved[key] === 'string') settings[key] = saved[key];
    if (saved.placement === 'free' || /^\d,\d$/.test(saved.placement)) settings.placement = saved.placement;
  }
} catch { /* Storage is optional. The live editor still works. */ }

function save() {
  try { localStorage.setItem('mascot-atelier-settings', JSON.stringify(settings)); } catch { notice('Settings work for this session. Local storage is unavailable.'); }
}

function applySettings() {
  settings.size = Math.max(100, Math.min(360, settings.size));
  settings.x = Math.max(0, Math.min(100, settings.x)); settings.y = Math.max(0, Math.min(100, settings.y));
  const displaySize = Math.min(settings.size, stage.clientWidth - 20, stage.clientHeight - 20);
  mascot.setAttribute('size', displaySize);
  mascot.setAttribute('tracking', settings.tracking ? 'on' : 'off');
  mascot.setAttribute('idle', settings.idle ? 'on' : 'off');
  mascot.toggleAttribute('paused', settings.paused);
  if (selected) settings.neck = Math.max(mascot.neckRange[0], Math.min(mascot.neckRange[1], settings.neck));
  mascot.setAttribute('neck-offset', settings.neck);
  for (const [key, attribute] of motionControls) {
    settings[key] = Math.max(key === 'reactionSpeed' ? 50 : 0, Math.min(key === 'reactionSpeed' ? 150 : 100, settings[key]));
    mascot.setAttribute(attribute, settings[key] / 100);
    $(`#${key}`).value = settings[key]; $(`#${key}-value`).textContent = `${settings[key]} %`;
  }
  $('#motion-preset').value = Object.keys(motionPresets).find(name => motionControls.every(([key]) => settings[key] === motionPresets[name][key])) || 'custom';
  mascot.setAttribute('click-reaction', settings.clickReaction);
  mascot.setAttribute('body-pose', settings.bodyPose);
  $('#neck').value = settings.neck; $('#neck-value').textContent = `${settings.neck > 0 ? '+' : ''}${settings.neck} px`;
  $('#click-reaction').value = settings.clickReaction; $('#body-pose').value = settings.bodyPose;
  if (!settings.tracking) mascot.center();
  $('#size').value = settings.size; $('#size-value').textContent = `${settings.size} px`;
  for (const key of ['tracking', 'idle', 'paused', 'guides', 'onion']) $(`#${key}`).checked = settings[key];
  $('#neutral-overlay').hidden = !settings.onion;
  if (selected && settings.onion) {
    const overlay = $('#neutral-overlay');
    drawPose(overlay.getContext('2d'), selected.manifest, selected.images, selected.manifest.frames.find(f => f.id === selected.manifest.neutral), overlay.width, undefined, mascot.neckOffset);
  }
  $('#anchor-guides').hidden = !settings.guides;
  const pivot = selected?.manifest.layers?.neck || selected?.manifest.pivot;
  $('#anchor-guides').style.setProperty('--pivot-x', `${(pivot?.[0] ?? .5) * 100}%`);
  $('#anchor-guides').style.setProperty('--pivot-y', `${((pivot?.[1] ?? .9) - mascot.neckOffset / (selected?.manifest.layers?.size || 256)) * 100}%`);
  applyPosition();
  stage.dataset.surface = settings.surface;
  document.querySelectorAll('.swatch').forEach(button => {
    const active = button.dataset.surface === settings.surface;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  updateCode();
  updateMode();
}

function applyPosition() {
  settings.x = Math.max(0, Math.min(100, settings.x)); settings.y = Math.max(0, Math.min(100, settings.y));
  const width = Math.max(0, stage.clientWidth - mascot.offsetWidth), height = Math.max(0, stage.clientHeight - mascot.offsetHeight);
  $('#mascot-position').style.left = `${width * settings.x / 100}px`;
  $('#mascot-position').style.top = `${height * settings.y / 100}px`;
  $('#position-x').value = settings.x; $('#position-y').value = settings.y; $('#placement').value = settings.placement;
}

function updateMode() {
  $('#mode-label').textContent = settings.paused ? 'Paused' : mascot.locked ? 'Held pose'
    : matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Reduced motion'
      : settings.tracking ? selected?.manifest.layers ? 'Two layers · live' : 'Follows pointer' : 'Idle';
}

function updateCode() {
  if (!selected) return;
  const packPath = selected.imported ? 'my-mascot' : selected.slug;
  const behavior = selected.manifest.layers
    ? `\n  neck-offset="${settings.neck}" click-reaction="${settings.clickReaction}" body-pose="${settings.bodyPose}"`
    : `\n  click-reaction="${settings.clickReaction}"`;
  const movement = motionControls.map(([key, attribute]) => `  ${attribute}="${settings[key] / 100}"`).join('\n');
  const flags = `${settings.tracking ? '' : '\n  tracking="off"'}${settings.idle ? '' : '\n  idle="off"'}${settings.paused ? '\n  paused' : ''}`;
  $('#embed-code').textContent = `<script type="module" src="/mascot/runtime/page-pet.js"></script>\n<page-pet\n  src="/mascot/${packPath}/manifest.json"\n  size="${settings.size}"${behavior}\n${movement}${flags}\n  label="Page pet: click to react">\n</page-pet>`;
}

function thumbnail(pack, frame) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 180;
  drawPose(canvas.getContext('2d'), pack.manifest, pack.images, frame, 180);
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function syncCollectionScroll() {
  const scroller = $('#collection');
  const overflow = scroller.scrollWidth > scroller.clientWidth + 8;
  $('#collection-pager').hidden = !overflow;
  $('#collection-prev').disabled = scroller.scrollLeft <= 2;
  $('#collection-next').disabled = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
}

function revealActivePet() {
  const scroller = $('#collection');
  const active = scroller.querySelector('.collection-card.active');
  if (!active) return;
  const start = active.offsetLeft - 8;
  const end = start + active.offsetWidth + 16;
  if (start < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, start);
  else if (end > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = end - scroller.clientWidth;
}

function collection() {
  $('#collection').replaceChildren();
  $('#collection-count').textContent = String(packs.length).padStart(2, '0');
  for (const pack of packs) {
    const button = document.createElement('button');
    button.className = `collection-card${pack === selected ? ' active' : ''}`;
    button.title = pack.manifest.name;
    button.setAttribute('aria-label', `Select ${pack.manifest.name}`);
    button.setAttribute('aria-pressed', pack === selected);
    const art = document.createElement('div'); art.className = 'collection-art';
    if (pack.thumb) {
      const image = document.createElement('img');
      image.src = pack.thumb; image.alt = ''; image.width = 72; image.height = 72;
      art.append(image);
    } else if (pack.images) art.append(thumbnail(pack, pack.manifest.frames.find(f => f.id === pack.manifest.neutral)));
    const meta = document.createElement('div'); meta.className = 'collection-meta';
    const title = document.createElement('strong'); title.textContent = pack.manifest.name;
    meta.append(title); button.append(art, meta);
    button.addEventListener('click', () => selectPack(pack)); $('#collection').append(button);
  }
  requestAnimationFrame(() => { revealActivePet(); syncCollectionScroll(); });
}

const loader = $('#loader');
let loadSerial = 0;
let loadAbort = null;

function showLoader(pack, received, total) {
  stage.dataset.loading = 'true';
  loader.hidden = false;
  const src = pack.thumb || '';
  if ($('#loader-ghost').getAttribute('src') !== src) {
    $('#loader-ghost').src = src;
    $('#loader-fill').src = src;
  }
  const ratio = total > 0 ? Math.min(1, received / total) : 0;
  $('#loader-fill').style.setProperty('--load', `${Math.round(ratio * 100)}%`);
  $('#loader-readout').textContent = total
    ? `${pack.manifest.name} · ${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`
    : received ? `${pack.manifest.name} · ${(received / 1e6).toFixed(1)} MB` : `Loading ${pack.manifest.name}`;
}

function hideLoader() {
  delete stage.dataset.loading;
  loader.hidden = true;
}

async function fetchBlob(url, signal, onProgress) {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(received, total);
  }
  return new Blob(chunks, { type: response.headers.get('content-type') || '' });
}

async function loadPack(pack) {
  const serial = ++loadSerial;
  loadAbort?.abort();
  const abort = new AbortController();
  loadAbort = abort;
  try {
    const names = sheetNames(pack.manifest);
    const parts = names.map(() => ({ got: 0, total: 0 }));
    const report = () => {
      if (serial !== loadSerial) return;
      const got = parts.reduce((sum, part) => sum + part.got, 0);
      const total = parts.every(part => part.total) ? parts.reduce((sum, part) => sum + part.total, 0) : 0;
      showLoader(pack, got, total);
    };
    report();
    const images = new Map();
    const sheetHashes = {};
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      const blob = await fetchBlob(new URL(name, pack.base), abort.signal, (got, total) => {
        parts[index].got = got;
        parts[index].total = total;
        report();
      });
      sheetHashes[name] = await hashBytes(await blob.arrayBuffer());
      const imageUrl = URL.createObjectURL(blob);
      try { images.set(name, await decodeImage(imageUrl)); }
      finally { URL.revokeObjectURL(imageUrl); }
    }
    if (serial !== loadSerial) return;
    validateImages(pack.manifest, images);
    pack.images = images;
    pack.sheetHashes = sheetHashes;
    if (selected === pack) selectPack(pack);
  } catch (error) {
    if (error.name === 'AbortError' || serial !== loadSerial) return;
    hideLoader();
    notice(`Unable to load ${pack.manifest.name}. Select it again.`);
  }
}

function selectPack(pack) {
  selected = pack;
  reactionPage = 0;
  $('#stage-name').textContent = `${pack.manifest.name.toUpperCase()} / ${String(packs.indexOf(pack) + 1).padStart(3, '0')}`;
  mascot.setAttribute('label', `${pack.manifest.name}: click to react. Use the arrow keys to move it.`);
  collection();
  if (!pack.images) { showLoader(pack, 0, 0); loadPack(pack); return; }
  hideLoader();
  mascot.setPack(pack.manifest, pack.images);
  const neutral = pack.manifest.frames.find(f => f.id === pack.manifest.neutral);
  const overlay = $('#neutral-overlay');
  overlay.width = overlay.height = neutral.rect[2];
  drawPose(overlay.getContext('2d'), pack.manifest, pack.images, neutral, overlay.width);
  const gaze = pack.manifest.frames.filter(f => f.kind === 'gaze').length;
  const reactions = pack.manifest.frames.filter(f => f.kind === 'reaction');
  $('#gaze-count').textContent = gaze; $('#reaction-count').textContent = reactions.length;
  $('#pose-count').textContent = pack.manifest.layers ? `${gaze} head turns · 2 sprite layers.` : `${gaze} gaze views. ${reactions.length} reactions.`;
  document.querySelector('[data-kind="reaction"]').hidden = false;
  document.querySelector('[data-kind="gaze"]').firstChild.textContent = 'Gaze ';
  const hasIdle = pack.manifest.frames.some(f => ['blink', 'sleep'].includes(f.id));
  $('#idle').disabled = !hasIdle;
  $('#idle').closest('label').style.display = hasIdle ? '' : 'none';
  $('#layer-controls').hidden = !pack.manifest.layers;
  for (const layer of ['body', 'head']) { $(`#show-${layer}`).checked = true; mascot.removeAttribute(`data-hide-${layer}`); }
  $('#neck-control').hidden = !pack.manifest.layers; $('#body-control').hidden = !pack.manifest.layers;
  $('#neck').min = mascot.neckRange[0]; $('#neck').max = mascot.neckRange[1];
  $('#click-reaction').replaceChildren(new Option('Cycle reactions', 'cycle'), new Option('No reaction', 'off'));
  $('#reaction-preview').replaceChildren();
  for (const frame of reactions) {
    const label = labels[frame.id] || frame.id;
    $('#reaction-preview').add(new Option(label, frame.id));
    if (!['blink','sleep'].includes(frame.id)) $('#click-reaction').add(new Option(label, frame.id));
  }
  $('#body-pose').replaceChildren(new Option('Automatic', 'auto'));
  for (const body of pack.manifest.layers?.bodyFrames || []) $('#body-pose').add(new Option(labels[body.id.replace('body-', '')] || body.id, body.id));
  if (![...$('#body-pose').options].some(o => o.value === settings.bodyPose)) settings.bodyPose = 'auto';
  if (![...$('#click-reaction').options].some(o => o.value === settings.clickReaction)) settings.clickReaction = 'cycle';
  collection(); gallery(); applySettings();
}

function scrollCollection(direction) {
  const scroller = $('#collection');
  const amount = Math.max(180, Math.round(scroller.clientWidth * 0.8));
  scroller.scrollBy({ left: direction * amount, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
$('#collection-prev').addEventListener('click', () => scrollCollection(-1));
$('#collection-next').addEventListener('click', () => scrollCollection(1));
$('#collection').addEventListener('scroll', syncCollectionScroll, { passive: true });
new ResizeObserver(syncCollectionScroll).observe($('#collection'));

function gallery() {
  $('#poses').replaceChildren();
  if (!selected) return;
  $('#poses').classList.toggle('gaze-grid', kind === 'gaze');
  $('#poses').style.setProperty('--gaze-cols', Math.min(5, new Set(selected.manifest.frames.filter(f => f.kind === 'gaze').map(f => f.gaze[0])).size));
  const visibleFrames = selected.manifest.frames.filter(f => f.kind === kind);
  if (kind === 'gaze') visibleFrames.sort((a, b) => a.gaze[1] - b.gaze[1] || a.gaze[0] - b.gaze[0]);
  const pages = kind === 'reaction' ? Math.ceil(visibleFrames.length / 12) : 1;
  reactionPage = Math.max(0, Math.min(reactionPage, pages - 1));
  $('#pose-pager').hidden = pages <= 1;
  $('#pose-page').textContent = `${reactionPage + 1} / ${pages}`;
  $('#pose-prev').disabled = reactionPage === 0;
  $('#pose-next').disabled = reactionPage >= pages - 1;
  const pageFrames = kind === 'reaction' ? visibleFrames.slice(reactionPage * 12, (reactionPage + 1) * 12) : visibleFrames;
  for (const frame of pageFrames) {
    const button = document.createElement('button'); button.className = 'pose-card'; button.dataset.frame = frame.id;
    const label = frame.kind === 'gaze' ? gazeLabel(frame.gaze) : labels[frame.id] || frame.id;
    button.title = frame.kind === 'gaze' ? `Head: x=${frame.gaze[0]}, y=${frame.gaze[1]}` : frame.id;
    button.setAttribute('aria-label', `View pose ${label}`);
    const caption = document.createElement('span'); caption.textContent = label;
    button.append(thumbnail(selected, frame), caption);
    button.addEventListener('click', () => { mascot.pose(frame.id); updateMode(); });
    $('#poses').append(button);
  }
}

function gazeLabel([x, y]) {
  const horizontal = x === 0 ? 'Center' : `${Math.abs(x) < .75 ? 'Slight ' : ''}${x < 0 ? 'left' : 'right'}`;
  return y === 0 ? horizontal : `${Math.abs(y) < .75 ? 'Slight ' : ''}${y < 0 ? 'up' : 'down'} · ${horizontal.toLowerCase()}`;
}

function download(blob, name) {
  if (!blob) { notice('Unable to create the file.'); return; }
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

for (const layer of ['body', 'head']) $(`#show-${layer}`).addEventListener('change', event => {
  mascot.toggleAttribute(`data-hide-${layer}`, !event.target.checked);
});
const rowNames = ['Top', 'Center', 'Bottom'], colNames = ['left', 'mid-left', 'center', 'mid-right', 'right'];
for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) {
  const option = document.createElement('option'); option.value = `${x},${y}`;
  option.textContent = `${rowNames[y]} · ${colNames[x]}`; $('#placement').append(option);
}
$('#placement').addEventListener('change', event => {
  settings.placement = event.target.value;
  if (settings.placement !== 'free') {
    const [x, y] = settings.placement.split(',').map(Number); settings.x = x * 25; settings.y = y * 50;
  }
  applySettings(); save();
});
for (const key of ['size', 'neck', ...motionControls.map(([key]) => key), 'tracking', 'idle', 'paused', 'guides', 'onion']) $(`#${key}`).addEventListener('input', event => {
  settings[key] = event.target.type === 'range' ? Number(event.target.value) : event.target.checked; applySettings(); save();
});
$('#motion-preset').addEventListener('change', event => {
  if (!motionPresets[event.target.value]) return;
  Object.assign(settings, motionPresets[event.target.value]); applySettings(); save();
});
for (const key of ['x', 'y']) $(`#position-${key}`).addEventListener('input', event => {
  settings[key] = Number(event.target.value); settings.placement = 'free'; applySettings(); save();
});
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => {
  settings.surface = button.dataset.surface; applySettings(); save();
}));
document.querySelectorAll('.pose-tabs button').forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  document.querySelectorAll('.pose-tabs button').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  gallery();
}));
$('#pose-prev').addEventListener('click', () => { reactionPage--; gallery(); });
$('#pose-next').addEventListener('click', () => { reactionPage++; gallery(); });
let movementSave;
mascot.addEventListener('page-pet-move', event => {
  const rect = mascot.getBoundingClientRect();
  const width = stage.clientWidth - rect.width, height = stage.clientHeight - rect.height;
  settings.x += width > 0 ? event.detail.dx / width * 100 : 0;
  settings.y += height > 0 ? event.detail.dy / height * 100 : 0;
  settings.placement = 'free'; applyPosition();
  clearTimeout(movementSave); movementSave = setTimeout(save, 180);
});
mascot.addEventListener('page-pet-frame', event => {
  updateMode();
  $('#frame-status').textContent = selected?.manifest.layers ? `Body: ${event.detail.body} · ${event.detail.id}` : event.detail.id;
  document.querySelectorAll('.pose-card').forEach(button => {
    const active = button.dataset.frame === event.detail.id || button.dataset.frame === event.detail.reaction;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
});
mascot.addEventListener('page-pet-error', event => notice(event.detail.message));
$('#live').addEventListener('click', () => { mascot.unlock(); settings.paused = false; applySettings(); save(); });
$('#reset').addEventListener('click', () => { settings = { ...defaults }; mascot.unlock(); applySettings(); save(); notice('Settings reset. The collection is still here.'); });
$('#export-png').addEventListener('click', async () => {
  if (!selected) return;
  const frame = mascot.currentFrame.id;
  download(await mascot.toBlob(), `${frame}.png`); notice(`Exported transparent PNG: ${frame}.`);
});
$('#export-settings').addEventListener('click', () => {
  if (!selected) return;
  const exported = { version: 1, mascot: selected.manifest.name, ...settings };
  if (!selected.manifest.layers) { delete exported.neck; delete exported.bodyPose; }
  download(new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }), 'mascot-settings.json');
  notice('Settings saved. The pack files stay in the pet folder.');
});
$('#copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#embed-code').textContent); notice('Code copied. Also copy the runtime folder and the pack into your project.'); }
  catch { notice('Unable to use the clipboard. Select the code and copy it.'); }
});
$('#import-button').addEventListener('click', () => $('#import-files').click());
$('#import-files').addEventListener('change', async event => {
  const files = [...event.target.files], urls = [];
  try {
    if (new Set(files.map(f => f.name)).size !== files.length) throw new Error('Import one pack. File names must be unique.');
    const source = files.find(f => f.name === 'manifest.json');
    if (!source) throw new Error('Select manifest.json and every sheet together.');
    if (files.some(f => f.size > 32 * 1024 * 1024) || files.reduce((sum, f) => sum + f.size, 0) > 128 * 1024 * 1024)
      throw new Error('Pack is too large. Keep each file under 32 MB and the set under 128 MB.');
    const manifest = validateManifest(JSON.parse(await source.text()));
    const images = new Map();
    for (const name of sheetNames(manifest)) {
      const file = files.find(f => f.name === name);
      if (!file) throw new Error(`Missing ${name}. Select every file in the pack together.`);
      const url = URL.createObjectURL(file); urls.push(url); images.set(name, await decodeImage(url));
    }
    validateImages(manifest, images);
    for (const frame of manifest.frames) {
      const probe = document.createElement('canvas'); probe.width = probe.height = 64;
      const ctx = probe.getContext('2d', { willReadFrequently: true });
      drawPose(ctx, manifest, images, frame, 64);
      const pixels = ctx.getImageData(0, 0, 64, 64).data;
      let clear = 0, solid = 0;
      for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) clear++; if (pixels[i] > 128) solid++; }
      if (clear < 328 || solid < 32) throw new Error(`${frame.id}: needs a visible character and real transparency.`);
    }
    const pack = { manifest, images, imported: true, readFile: async (name, optional = false) => {
      const file = files.find(f => f.name === name);
      if (!file && !optional) throw new Error(`Missing ${name}`);
      return file ? file.arrayBuffer() : null;
    } }; packs.push(pack); selectPack(pack);
    notice(`${manifest.name} imported. It stays for this session. Keep its files.`);
  } catch (error) { notice(`Unable to import the pack: ${error.message}`); }
  finally { urls.forEach(url => URL.revokeObjectURL(url)); event.target.value = ''; }
});
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function motionNote() { $('#motion-note').hidden = !motion.matches; updateMode(); }
motion.addEventListener('change', motionNote); motionNote();
new ResizeObserver(applySettings).observe(stage);
applySettings();
try {
  const response = await fetch('../assets/catalog.json');
  if (!response.ok) throw new Error(`Catalog request failed: HTTP ${response.status}`);
  for (const entry of await response.json()) {
    const url = new URL(entry, response.url);
    if (url.origin !== location.origin) throw new Error('The catalog only loads packs from this site.');
    const result = await fetch(url);
    if (!result.ok) throw new Error(`Pack: HTTP ${result.status}`);
    const manifestBytes = await result.arrayBuffer();
    const manifest = validateManifest(JSON.parse(new TextDecoder().decode(manifestBytes)));
    packs.push({ manifest, manifestBytes, images: null, sheetHashes: null, slug: new URL('.', url).pathname.split('/').filter(Boolean).at(-1), thumb: new URL('thumb.webp', url).href, base: url, readFile: async (name, optional = false) => {
      if (name === 'manifest.json') return manifestBytes;
      const response = await fetch(new URL(name, url));
      if (optional && response.status === 404) return null;
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return response.arrayBuffer();
    } });
  }
  if (!packs.length) throw new Error('The catalog is empty. Import a pack to start.');
  selectPack(packs[0]);
} catch (error) { notice(error.message); $('#frame-status').textContent = 'No pack'; }

$('#open-integration').addEventListener('click', () => $('#integration-dialog').showModal());
$('#close-integration').addEventListener('click', () => $('#integration-dialog').close());

$('#open-workflow').addEventListener('click', () => $('#workflow-dialog').showModal());
$('#close-workflow').addEventListener('click', () => $('#workflow-dialog').close());
let inspection = null;
let inspectionRun = 0;
$('#open-review').addEventListener('click', async () => {
  if (!selected) return notice('Wait for the pack to finish loading.');
  const pack = selected;
  const run = ++inspectionRun;
  inspection = null; $('#download-review').disabled = true;
  $('#review-title').textContent = `Review · ${pack.manifest.name}`;
  $('#review-results').textContent = 'Measuring alpha and checking files…';
  $('#review-dialog').showModal();
  try {
    const result = await inspectPack(pack);
    if (run !== inspectionRun) return;
    inspection = result;
    renderInspection($('#review-results'), inspection);
    $('#download-review').disabled = false;
  } catch (error) { if (run === inspectionRun) $('#review-results').textContent = `Unable to review: ${error.message}`; }
});
$('#close-review').addEventListener('click', () => $('#review-dialog').close());
$('#download-review').addEventListener('click', () => {
  if (inspection) download(new Blob([JSON.stringify(inspection, null, 2)], {type:'application/json'}), 'pack-inspection.json');
});
$('#compare-neutral').addEventListener('click', () => {
  settings.guides = true; settings.onion = true;
  applySettings(); $('#review-dialog').close();
  notice('Anchors and the neutral pose are on. Choose poses to compare. Turn them off in Scene.');
});

for (const [id,key] of [['click-reaction','clickReaction'],['body-pose','bodyPose']]) {
  $(`#${id}`).addEventListener('change', event => { settings[key] = event.target.value; applySettings(); save(); });
}
$('#try-reaction').addEventListener('click', () => { mascot.react($('#reaction-preview').value); updateMode(); });
$('#try-motion').addEventListener('click', () => { mascot.react($('#reaction-preview').value); updateMode(); });
function setDock(button, panel, open) {
  const was = panel.classList.contains('open');
  panel.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
  const index = dockStack.indexOf(panel);
  if (open && !was) dockStack.push(panel);
  if (!open && index !== -1) dockStack.splice(index, 1);
  if (!open && was) button.focus();
}
function toggleDock(button, panel) {
  setDock(button, panel, !panel.classList.contains('open'));
}
$('#open-poses').addEventListener('click', () => toggleDock($('#open-poses'), $('.pose-section')));
$('#open-settings').addEventListener('click', () => toggleDock($('#open-settings'), $('.inspector')));
$('#close-poses').addEventListener('click', () => setDock($('#open-poses'), $('.pose-section'), false));
$('#close-settings').addEventListener('click', () => setDock($('#open-settings'), $('.inspector'), false));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
  const panel = dockStack.at(-1);
  if (!panel) return;
  event.preventDefault();
  setDock(panel.classList.contains('inspector') ? $('#open-settings') : $('#open-poses'), panel, false);
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
}
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-panel]').forEach(tab => {
    const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', active);
    $(`#${tab.dataset.panel}-controls`).hidden = !active;
  });
}));
