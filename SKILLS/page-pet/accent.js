(() => {
  const palette = [
    { name: 'red', value: '#ff7166', hover: '#ff887d' },
    { name: 'orange', value: '#ff9b55', hover: '#ffaf72' },
    { name: 'yellow', value: '#e8c64f', hover: '#f1d36e' },
    { name: 'green', value: '#61c784', hover: '#7ad69a' },
    { name: 'cyan', value: '#47c4ba', hover: '#62d4ca' },
    { name: 'blue', value: '#73a9ff', hover: '#8bb8ff' },
    { name: 'violet', value: '#a39afc', hover: '#b5adff' },
    { name: 'pink', value: '#ee82c0', hover: '#f19bd0' },
  ];
  const storageKey = 'page-pet-accent';
  const cookieKey = 'page-pet-accent';
  const root = document.documentElement;
  let timer;
  let index;
  let stored;

  function hueOf(hex) {
    const value = hex.slice(1);
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    const hue = max === r
      ? 60 * (((g - b) / delta) % 6)
      : max === g
        ? 60 * ((b - r) / delta + 2)
        : 60 * ((r - g) / delta + 4);
    return (hue + 360) % 360;
  }

  function surfaceColor(hue) {
    return 'hsl(' + Math.round(hue) + ' 44% 79%)';
  }
  try {
    stored = Number(localStorage.getItem(storageKey));
  } catch { /* The loopback preview may restrict local storage. */ }
  if (!Number.isInteger(stored) || stored < 0 || stored >= palette.length) {
    const savedCookie = document.cookie.match(new RegExp('(?:^|;\\s*)' + cookieKey + '=(\\d+)'));
    stored = savedCookie ? Number(savedCookie[1]) : NaN;
  }
  index = Number.isInteger(stored) && stored >= 0 && stored < palette.length
    ? stored
    : Math.floor(Math.random() * palette.length);

  function updateColor(next, animate = false) {
    index = (next + palette.length) % palette.length;
    const color = palette[index];
    root.style.setProperty('--accent', color.value);
    root.style.setProperty('--accent-hover', color.hover);
    const hue = hueOf(color.value);
    root.style.setProperty('--stage-clay', surfaceColor(hue));
    root.style.setProperty('--stage-lilac', surfaceColor((hue + 180) % 360));
    root.dataset.accent = color.name;
    try { localStorage.setItem(storageKey, String(index)); } catch { /* Use the shared loopback cookie below. */ }
    try { document.cookie = cookieKey + '=' + index + '; Path=/; Max-Age=31536000; SameSite=Lax'; } catch { /* The palette still works for this page. */ }

    const mark = document.querySelector('.brand-mark');
    const status = document.querySelector('#accent-status');
    if (mark) {
      mark.setAttribute('aria-label', 'Change accent color. Current color: ' + color.name + '.');
      mark.title = 'Accent: ' + color.name + ' · click for the next color';
    }
    if (status && animate) status.textContent = 'Accent color changed to ' + color.name + '.';
    if (!animate) return;

    root.classList.add('accent-changing');
    clearTimeout(timer);
    timer = setTimeout(() => root.classList.remove('accent-changing'), 340);
    if (mark && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      mark.classList.remove('is-animating');
      void mark.offsetWidth;
      mark.classList.add('is-animating');
    }
  }

  updateColor(index);
  document.addEventListener('DOMContentLoaded', () => {
    const mark = document.querySelector('.brand-mark');
    if (mark) {
      const color = palette[index];
      mark.setAttribute('aria-label', 'Change accent color. Current color: ' + color.name + '.');
      mark.title = 'Accent: ' + color.name + ' · click for the next color';
      mark.addEventListener('click', () => updateColor(index + 1, true));
    }
  }, { once: true });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey || event.newValue === null) return;
    const next = Number(event.newValue);
    if (Number.isInteger(next) && next >= 0 && next < palette.length && next !== index) updateColor(next, true);
  });
})();
