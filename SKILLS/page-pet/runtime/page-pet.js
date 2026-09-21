import { validateManifest, validateImages, nearestGaze, decodeImage, sheetNames } from './manifest.js';
import { drawPose, bodyFrame, measureNeckRange } from './puppet.js';
import { MascotMotion } from './motion.js';

export class PagePet extends HTMLElement {
  static observedAttributes = ['src', 'size', 'paused', 'tracking', 'idle', 'draggable', 'label', 'neck-offset', 'motion', 'click-reaction', 'body-pose',
    'drag-jelly', 'drag-inertia', 'motion-bounce', 'motion-weight', 'motion-damping', 'reaction-motion', 'reaction-speed', 'click-response'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;width:var(--mascot-size,180px);height:var(--mascot-size,180px);position:relative;flex:none}
      button{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer;border-radius:28%;-webkit-tap-highlight-color:transparent}
      button:focus-visible{outline:2px solid #9367e8;outline-offset:3px}
      canvas{width:100%;height:100%;display:block;pointer-events:none;transform-origin:50% 90%}
      .head{position:absolute;inset:0}.head[hidden]{display:none}
      :host([data-hide-body]) canvas:not(.head),:host([data-hide-head]) .head{visibility:hidden}
      :host([draggable]) button{touch-action:none;cursor:grab}
      :host([data-dragging]) button{cursor:grabbing}
      button{transform-origin:50% 92%}
    </style><button type="button" aria-label="Mascot: click to react"><canvas width="256" height="256"></canvas><canvas class="head" width="256" height="256" hidden></canvas></button>`;
    this.button = this.shadowRoot.querySelector('button');
    this.canvas = this.shadowRoot.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.headCanvas = this.shadowRoot.querySelector('.head');
    this.headCtx = this.headCanvas.getContext('2d');
    this.images = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.fine = matchMedia('(any-pointer: fine)');
    this.sequence = 0;
    this.lastActivity = performance.now();
    this.nextBlink = this.lastActivity + 3500;
    this.reactionUntil = 0;
    this.gaze = null;
    this.locked = false;
    this.neckRange = [0, 0]; this.neckOffset = 0;
    this.motionEngine = new MascotMotion(this.button, () => this.motionOptions,
      () => this.active && !this.reduced.matches && this.motionStrength > 0,
      (dx, dy) => this.emitMove(dx, dy, 'inertia'));
    this.clickIndex = 0; this.lastClick = -Infinity;
  }
  connectedCallback() {
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    window.addEventListener('pointermove', e => this.track(e), options);
    document.documentElement.addEventListener('pointerleave', () => this.center(), options);
    document.addEventListener('visibilitychange', () => this.schedule(), options);
    this.reduced.addEventListener('change', () => { this.center(); this.schedule(); }, options);
    this.button.addEventListener('click', e => {
      if (this.suppressClick && e.detail !== 0) { this.suppressClick = false; return; }
      this.suppressClick = false;
      if (e.detail === 0 || !this.drag) this.clickReaction(e);
    }, options);
    this.button.addEventListener('pointerdown', e => this.startDrag(e), options);
    this.button.addEventListener('pointermove', e => this.moveDrag(e), options);
    this.button.addEventListener('pointerup', e => this.endDrag(e), options);
    this.button.addEventListener('pointercancel', e => this.endDrag(e), options);
    this.button.addEventListener('lostpointercapture', e => this.endDrag(e), options);
    this.button.addEventListener('keydown', e => {
      if (e.key === 'Escape') { this.unlock(); this.center(); }
      const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
      if (delta && this.active && this.hasAttribute('draggable')) {
        e.preventDefault(); this.resetMotion(); this.emitMove(delta[0], delta[1], 'keyboard');
      }
    }, options);
    this.observer = new IntersectionObserver(([entry]) => { this.offscreen = !entry.isIntersecting; this.schedule(); });
    this.observer.observe(this);
    this.updateAttributes();
    if (this.hasAttribute('src')) this.load(this.getAttribute('src'));
    this.schedule();
  }
  disconnectedCallback() {
    this.cancelDrag();
    this.events?.abort(); this.observer?.disconnect(); clearInterval(this.clock); cancelAnimationFrame(this.raf); this.raf = 0; this.resetMotion();
    this.request?.abort(); this.sequence++;
  }
  attributeChangedCallback(name, before, after) {
    if (before === after) return;
    if (name === 'src' && this.isConnected) this.load(after);
    else {
      this.updateAttributes();
      if (['motion', 'drag-jelly', 'drag-inertia', 'motion-bounce', 'motion-weight', 'motion-damping', 'reaction-motion', 'reaction-speed', 'click-response'].includes(name)) this.resetMotion();
      if (name === 'draggable' && after === null) this.resetMotion();
      if (this.isConnected) this.schedule();
    }
  }
  updateAttributes() {
    const size = Number(this.getAttribute('size') || 180);
    this.style.setProperty('--mascot-size', `${Number.isFinite(size) ? Math.max(40, Math.min(600, size)) : 180}px`);
    const requested = Number(this.getAttribute('neck-offset') || 0);
    const neck = Math.max(this.neckRange[0], Math.min(this.neckRange[1], Number.isFinite(requested) ? requested : 0));
    const changed = this.neckOffset !== neck || this.baseBody !== this.getAttribute('body-pose');
    this.neckOffset = neck; this.baseBody = this.getAttribute('body-pose');
    if (changed && this.currentFrame) this.draw(this.currentFrame);
    this.button.setAttribute('aria-label', this.getAttribute('label') || `${this.pack?.name || 'Mascot'}: click to react`);
  }
  async load(src) {
    const sequence = ++this.sequence;
    this.request?.abort(); this.request = new AbortController();
    try {
      const url = new URL(src, document.baseURI);
      if (url.origin !== location.origin) throw new Error('Mascot packs must use the same origin.');
      const response = await fetch(url, { signal: this.request.signal });
      if (!response.ok) throw new Error(`Mascot pack: HTTP ${response.status}`);
      const pack = validateManifest(await response.json());
      const images = new Map(await Promise.all(sheetNames(pack).map(async file =>
        [file, await decodeImage(new URL(file, url))])));
      if (sequence !== this.sequence) return;
      this.setPack(pack, images);
    } catch (error) {
      if (error.name !== 'AbortError' && sequence === this.sequence)
        this.dispatchEvent(new CustomEvent('page-pet-error', { detail: error, bubbles: true }));
    }
  }
  setPack(pack, images) {
    validateManifest(pack); validateImages(pack, images);
    this.sequence++; this.request?.abort();
    this.pack = pack; this.images = images;
    this.cancelDrag(); this.resetMotion(); this.clickIndex = 0; this.neckRange = measureNeckRange(pack, images);
    this.currentFrame = null; this.updateAttributes();
    this.bodyOverride = null; this.layerReaction = null; this.expressionFrame = null;
   
    this.gazes = pack.frames.filter(f => f.kind === 'gaze');
    this.locked = false; this.reactionUntil = 0; this.gaze = pack.frames.find(f => f.id === pack.neutral);
    this.lastActivity = performance.now(); this.nextBlink = this.lastActivity + 3500;
    this.draw(this.gaze); this.updateAttributes();
    this.dispatchEvent(new CustomEvent('page-pet-ready', { detail: { name: pack.name, frames: pack.frames.length }, bubbles: true }));
  }
  draw(frame) {
    if (!frame) return;
    frame = this.expressionFrame || frame;
    this.currentFrame = frame;
    const [, , width, height] = frame.rect;
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.ctx.clearRect(0, 0, width, height);
    this.headCanvas.hidden = !this.pack.layers;
    if (this.pack.layers) {
      const body = bodyFrame(this.pack, frame, this.selectedBody(frame));
      this.ctx.drawImage(this.images.get(body.sheet), ...body.rect, 0, 0, width, height);
      this.headCanvas.width = width; this.headCanvas.height = height;
      this.headCtx.drawImage(this.images.get(frame.sheet), ...frame.rect, 0, -this.neckOffset, width, height);
    } else this.ctx.drawImage(this.images.get(frame.sheet), ...frame.rect, 0, 0, width, height);
    this.dataset.frame = frame.id;
    if (this.layerReaction || frame.kind === 'reaction') this.dataset.reaction = this.layerReaction || frame.id;
    else delete this.dataset.reaction;
    this.dispatchEvent(new CustomEvent('page-pet-frame', { detail: { id: frame.id, kind: frame.kind, body: this.selectedBody(frame), reaction: this.layerReaction }, bubbles: true }));
  }
  get active() { return this.isConnected && !document.hidden && !this.offscreen && !this.hasAttribute('paused'); }
  schedule() {
    clearInterval(this.clock);
    if (!this.active || !this.hasAttribute('draggable')) this.cancelDrag();
    if (!this.active || this.reduced.matches || !this.motionStrength) this.resetMotion();
    if (this.active) this.clock = setInterval(() => this.tick(), 160);
  }
  tick() {
    if (!this.pack || this.locked) return;
    const now = performance.now();
    if (this.reactionUntil) {
      if (now < this.reactionUntil) return;
      this.reactionUntil = 0; this.bodyOverride = null; this.layerReaction = null; this.expressionFrame = null; this.draw(this.gaze);
    }
    if (this.reduced.matches || this.getAttribute('idle') === 'off') return;
    const sleep = this.pack.frames.find(f => f.id === 'sleep');
    if (now - this.lastActivity > 14000 && sleep) {
      if (sleep && this.currentFrame !== sleep) this.draw(sleep);
    } else if (now > this.nextBlink) {
      // The generic blink is front-facing. Do not snap a turned head forward
      // for a 160ms blink when no matching directional blink exists.
      if (this.gaze.id === this.pack.neutral) this.react('blink', 160, false);
      this.nextBlink = now + 3500 + Math.random() * 2500;
    }
  }
  track(event) {
    if (!this.active || this.locked || !this.pack || !this.fine.matches || event.pointerType === 'touch'
        || this.reduced.matches || this.getAttribute('tracking') === 'off' || this.drag) return;
    this.lastActivity = performance.now();
    const rect = this.getBoundingClientRect();
    const radius = Math.max(120, rect.width * 1.3);
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const x = Math.abs(dx) < 16 ? 0 : Math.max(-1, Math.min(1, dx / radius));
    const y = Math.abs(dy) < 16 ? 0 : Math.max(-1, Math.min(1, dy / radius));
    const previous = this.gaze;
    this.gaze = nearestGaze(this.gazes, x, y);
    if (previous !== this.gaze && !this.expressionFrame && !this.reactionUntil) this.motionEngine.nudge(0, (this.gaze.gaze[0] - previous.gaze[0]) * 9);
    if (!this.raf) this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.active && !this.locked && (!this.reactionUntil || this.pack.layers) && this.currentFrame !== this.gaze)
        this.draw(this.gaze);
    });
  }
  center() {
    if (!this.pack || this.locked) return;
    this.gaze = this.pack.frames.find(f => f.id === this.pack.neutral);
    if (!this.reactionUntil || this.pack.layers) this.draw(this.gaze);
  }
  react(id, duration = 1100, activity = true, origin = null) {
    const frame = this.pack?.frames.find(f => f.id === id && f.kind === 'reaction');
    if (!frame || !this.active) return false;
    this.locked = false;
    if (activity) this.lastActivity = performance.now();
    this.reactionUntil = performance.now() + Math.max(160, Math.min(30000, Number(duration) || 1100));
    if (this.pack.layers) {
      if (this.currentFrame.kind === 'gaze') this.gaze = this.currentFrame;
      this.bodyOverride = id === "blink" ? null : frame.body; this.layerReaction = frame.id;
      this.expressionFrame = frame.expression ? frame : null; this.draw(this.gaze);
    } else this.draw(frame);
    if (activity && id !== 'blink') {
      const motionDuration = this.motionEngine.reaction(id, origin);
      this.reactionUntil = Math.max(this.reactionUntil, performance.now() + motionDuration);
    }
    return true;
  }
  pose(id) {
    const frame = this.pack?.frames.find(f => f.id === id);
    if (!frame) return false;
    this.resetMotion(); this.locked = true; this.reactionUntil = 0; this.bodyOverride = null; this.layerReaction = null; this.expressionFrame = null; this.draw(frame); return true;
  }
  unlock() { this.locked = false; this.reactionUntil = 0; this.bodyOverride = null; this.layerReaction = null; this.expressionFrame = null; this.lastActivity = performance.now(); this.center(); }
  startDrag(event) {
    if (!this.active || !this.pack || !this.hasAttribute('draggable') || event.button !== 0 || this.drag) return;
    this.suppressClick = false;
    const rect = this.getBoundingClientRect();
    this.drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
      id: event.pointerId, time: performance.now(), vx: 0, vy: 0 };
    this.lastActivity = performance.now();
    this.motionEngine.grab((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
    this.button.setPointerCapture(event.pointerId);
  }
  moveDrag(event) {
    if (!this.drag || this.drag.id !== event.pointerId || !this.active) return;
    const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
    const now = performance.now(), dt = Math.max(1 / 240, Math.min(.1, (now - this.drag.time) / 1000));
    const blend = 1 - Math.exp(-dt / .025);
    this.drag.vx += (Math.max(-2200, Math.min(2200, dx / dt)) - this.drag.vx) * blend;
    this.drag.vy += (Math.max(-2200, Math.min(2200, dy / dt)) - this.drag.vy) * blend;
    this.drag.time = now; this.lastActivity = now;
    if (Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 4) this.suppressClick = true;
    if (this.suppressClick) {
      this.setAttribute('data-dragging', '');
      this.motionEngine.drag(this.drag.vx, this.drag.vy);
      this.emitMove(dx, dy, 'drag');
    }
    this.drag.x = event.clientX; this.drag.y = event.clientY;
  }
  endDrag(event) {
    if (this.drag?.id !== event.pointerId) return;
    const { vx, vy, time } = this.drag;
    const fresh = performance.now() - time < 90;
    this.drag = null;
    if (this.button.hasPointerCapture(event.pointerId)) this.button.releasePointerCapture(event.pointerId);
    this.motionEngine.release(fresh ? vx : 0, fresh ? vy : 0, this.suppressClick, event.type !== 'pointerup');
    this.removeAttribute('data-dragging');
  }
  cancelDrag() {
    if (this.drag) this.endDrag({ pointerId: this.drag.id, type: 'pointercancel' });
  }
  emitMove(dx, dy, phase) {
    const before = this.getBoundingClientRect();
    this.dispatchEvent(new CustomEvent('page-pet-move', { detail: { dx, dy, phase }, bubbles: true }));
    const after = this.getBoundingClientRect();
    return { dx: after.left - before.left, dy: after.top - before.top };
  }
  selectedBody(frame = this.currentFrame) {
    const manual = this.pack?.layers?.bodyFrames.find(f => f.id === this.baseBody);
    return this.bodyOverride || manual?.id || frame?.body;
  }
  clickReaction(event) {
    const now = performance.now();
    if (!this.active || now - this.lastClick < 250) return;
    this.lastClick = now;
    const choice = this.getAttribute('click-reaction') || 'cycle';
    if (choice === 'off') return;
    const frames = this.pack?.frames.filter(f => f.kind === 'reaction' && !['blink','sleep'].includes(f.id)) || [];
    const id = choice === 'cycle' ? frames[this.clickIndex++ % frames.length]?.id : choice;
    let origin = null;
    if (event?.detail > 0) {
      const rect = this.getBoundingClientRect();
      origin = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    }
    if (id) this.react(id, 1100, true, origin);
  }
  get motionStrength() {
    const n = Number(this.getAttribute('motion') ?? .45);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : .45;
  }
  get motionOptions() {
    const value = (name, fallback, max = 1, min = 0) => {
      const number = Number(this.getAttribute(name) ?? fallback);
      return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
    };
    return { strength: this.motionStrength, jelly: value('drag-jelly', .65), inertia: value('drag-inertia', .35),
      bounce: value('motion-bounce', .4), weight: value('motion-weight', .45), damping: value('motion-damping', .55),
      reaction: value('reaction-motion', .7), speed: value('reaction-speed', 1, 1.5, .5), click: value('click-response', .35) };
  }
  resetMotion() { this.motionEngine?.stop(); }
  toBlob() {
    const snapshot = document.createElement('canvas'); snapshot.width = snapshot.height = this.currentFrame.rect[2];
    drawPose(snapshot.getContext('2d'), this.pack, this.images, this.currentFrame, snapshot.width, this.selectedBody(this.currentFrame), this.neckOffset);
    return new Promise(resolve => snapshot.toBlob(resolve, 'image/png'));
  }

}

if (!customElements.get('page-pet')) customElements.define('page-pet', PagePet);
