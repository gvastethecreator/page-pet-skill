import { gsap } from './vendor/gsap/index.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const channels = ['x', 'y', 'angle', 'skew', 'squash'];
const zero = () => Object.fromEntries(channels.map(key => [key, 0]));

// One transform owner: spring deformation and GSAP reaction envelopes compose here.
export class MascotMotion {
  constructor(element, options, enabled, move) {
    this.element = element; this.options = options; this.enabled = enabled; this.move = move;
    this.state = zero(); this.velocity = zero(); this.target = zero(); this.gesture = zero();
    this.throwX = this.throwY = 0;
    this.tick = (_, delta) => this.step(delta);
    this.setters = Object.fromEntries(['x', 'y', 'rotation', 'skewX', 'scaleX', 'scaleY']
      .map(key => [key, gsap.quickSetter(element, key, ['x', 'y'].includes(key) ? 'px' : ['rotation', 'skewX'].includes(key) ? 'deg' : undefined)]));
  }
  wake() {
    if (!this.running) { this.running = true; gsap.ticker.add(this.tick); }
  }
  stop() {
    gsap.ticker.remove(this.tick); this.running = false;
    this.timeline?.kill(); this.timeline = null; this.dragging = false;
    this.state = zero(); this.velocity = zero(); this.target = zero(); this.gesture = zero();
    this.throwX = this.throwY = 0;
    this.render(); gsap.set(this.element, { transformOrigin: '50% 90%' });
    this.element.style.willChange = '';
  }
  grab(x, y) {
    this.stop();
    if (!this.enabled()) return;
    this.dragging = true;
    gsap.set(this.element, { transformOrigin: `${clamp(x, 20, 80)}% ${clamp(y, 20, 85)}%` });
  }
  drag(vx, vy) {
    if (!this.enabled()) return;
    this.dragging = true; this.lastMove = performance.now();
    const amount = this.options().jelly * this.options().strength;
    this.target = {
      x: -clamp(vx * .014, -18, 18) * amount,
      y: -clamp(vy * .011, -15, 15) * amount,
      angle: clamp(vx / 160, -8, 8) * amount,
      skew: -clamp(vx / 220, -6, 6) * amount,
      squash: clamp((Math.abs(vx) - Math.abs(vy)) * .00012, -.16, .16) * amount,
    };
    this.wake();
  }
  release(vx, vy, moved, cancelled = false) {
    this.dragging = false; this.target = zero();
    if (cancelled || !moved || !this.enabled()) { this.stop(); return; }
    const o = this.options();
    this.throwX = clamp(vx, -1200, 1200) * o.inertia * o.strength;
    this.throwY = clamp(vy, -1200, 1200) * o.inertia * o.strength;
    this.velocity.squash += (.32 + Math.min(1, Math.hypot(vx, vy) / 900) * .6) * o.bounce * o.strength;
    this.velocity.y += 36 * o.bounce * o.strength;
    this.wake();
  }
  nudge(y, angle) {
    if (!this.enabled() || this.dragging) return;
    const amount = this.options().strength;
    this.velocity.y = clamp(this.velocity.y + y * amount, -70, 70);
    this.velocity.angle = clamp(this.velocity.angle + angle * amount, -45, 45);
    this.wake();
  }
  reaction(id, origin = null) {
    if (!this.enabled() || this.dragging) return 0;
    const o = this.options(), amount = o.strength * o.reaction;
    this.timeline?.kill(); this.timeline = null;
    if (!amount) { this.gesture = zero(); this.render(); return 0; }
    this.throwX = this.throwY = 0;
    const local = o.click && origin && Number.isFinite(origin.x) && Number.isFinite(origin.y);
    const point = local ? { x: clamp(origin.x, 0, 1), y: clamp(origin.y, 0, 1) } : { x: .5, y: .9 };
    gsap.set(this.element, { transformOrigin: `${point.x * 100}% ${point.y * 100}%` });
    const impact = local ? o.click * amount : 0;
    const side = point.x - .5, height = point.y - .55;
    const poses = {
      surprised: [-17, -3, -.10], laugh: [-9, 3, .065], kiss: [-4, 5, -.025],
      wink: [-4, -5, .035], excited: [-20, 4, -.11], celebrate: [-20, 4, -.11],
      worried: [3, -3, .025], confused: [-2, -6, .025], annoyed: [2, 4, .045],
      proud: [-5, 2, -.04], calm: [2, 0, .02], sleep: [2, -2, .025],
      wave: [-7, 6, -.025], dance: [-12, 7, -.06], shy: [3, -4, .04],
    };
    const [y, angle, squash] = poses[id] || [-8, 3, -.05];
    const speed = o.speed;
    this.element.style.willChange = 'transform';
    this.timeline = gsap.timeline({ onUpdate: () => this.render(), onComplete: () => {
      this.timeline = null; this.gesture = zero(); this.render();
      if (!this.running) { this.element.style.willChange = ''; gsap.set(this.element, { transformOrigin: '50% 90%' }); }
    } });
    this.timeline.to(this.gesture, { x: -side * 2 * impact, y: 3 * amount + height * 3 * impact,
      squash: .045 * amount + .012 * impact, angle: -angle * .25 * amount + side * 3 * impact,
      duration: .11 / speed, ease: 'power2.out' });
    this.timeline.to(this.gesture, { x: -side * 4 * impact, y: y * amount + height * 2 * impact,
      angle: angle * amount + side * 3 * impact, squash: squash * amount,
      duration: .19 / speed, ease: 'power2.out' });
    if (id === 'laugh') this.timeline.to(this.gesture, { y: -3 * amount, squash: -.025 * amount,
      duration: .11 / speed, repeat: 1, yoyo: true, ease: 'sine.inOut' });
    this.timeline.to(this.gesture, { ...zero(), duration: (.45 + o.bounce * .3) / speed,
      ease: o.bounce ? `elastic.out(1,${.55 - o.bounce * .25})` : 'power3.out' });
    return this.timeline.duration() * 1000;
  }
  step(delta) {
    if (!this.enabled()) { this.stop(); return; }
    const o = this.options(), dt = Math.min(.05, Math.max(0, delta / 1000));
    if (this.dragging && performance.now() - this.lastMove > 70) {
      for (const key of channels) this.target[key] *= Math.exp(-12 * dt);
    }
    if (!this.dragging && Math.hypot(this.throwX, this.throwY) > 3) {
      const dx = this.throwX * dt, dy = this.throwY * dt;
      const actual = this.move(dx, dy);
      if (Math.abs(actual.dx - dx) > .7) {
        this.throwX *= -o.bounce * .6;
        this.velocity.angle += clamp(dx * 8, -35, 35) * o.bounce;
        this.velocity.squash -= .6 * o.bounce * o.strength;
      }
      if (Math.abs(actual.dy - dy) > .7) {
        this.throwY *= -o.bounce * .6;
        this.velocity.squash += .8 * o.bounce * o.strength;
      }
      const friction = Math.exp(-(5 + o.damping * 7) * dt);
      this.throwX *= friction; this.throwY *= friction;
    } else this.throwX = this.throwY = 0;
    const stiffness = 300 - o.weight * 210;
    const damping = 2 * Math.sqrt(stiffness) * (.3 + o.damping * .8);
    const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
    for (let i = 0; i < steps; i++) for (const key of channels) {
      this.velocity[key] += (stiffness * (this.target[key] - this.state[key]) - damping * this.velocity[key]) * h;
      this.state[key] += this.velocity[key] * h;
    }
    this.render();
    const settled = channels.every(key => Math.abs(this.state[key]) < (key === 'squash' ? .0003 : .025)
      && Math.abs(this.velocity[key]) < (key === 'squash' ? .003 : .1)
      && Math.abs(this.target[key]) < (key === 'squash' ? .0003 : .025));
    if (!this.throwX && !this.throwY && settled) {
      gsap.ticker.remove(this.tick); this.running = false; this.state = zero(); this.velocity = zero(); this.target = zero(); this.render();
      if (!this.dragging && !this.timeline) gsap.set(this.element, { transformOrigin: '50% 90%' });
      if (!this.timeline) this.element.style.willChange = '';
    }
  }
  render() {
    const s = this.state, g = this.gesture;
    const squash = clamp(s.squash + g.squash, -.18, .18);
    this.setters.x(clamp(s.x + g.x, -20, 20)); this.setters.y(clamp(s.y + g.y, -26, 26));
    this.setters.rotation(clamp(s.angle + g.angle, -10, 10)); this.setters.skewX(clamp(s.skew + g.skew, -7, 7));
    this.setters.scaleX(1 + squash); this.setters.scaleY(1 / (1 + squash));
    if (this.running) this.element.style.willChange = 'transform';
  }
}
