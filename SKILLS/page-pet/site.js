const pet = document.querySelector('#pet');
const nameEl = document.querySelector('#pet-name');
const roster = document.querySelector('#roster');
const stage = document.querySelector('.stage');
const placeholder = document.querySelector('#pet-placeholder');
const hint = document.querySelector('.hint');

pet.addEventListener('page-pet-ready', () => {
  stage.setAttribute('aria-busy', 'false');
  placeholder.hidden = true;
  pet.inert = false;
  hint.textContent = 'Move to look. Click to react.';
});
pet.addEventListener('page-pet-error', () => {
  stage.setAttribute('aria-busy', 'false');
  stage.dataset.error = 'true';
  hint.textContent = 'Preview unavailable. Select the pet to retry.';
});

const catalog = await fetch('./assets/catalog.json').then(response => response.json());
const packs = await Promise.all(catalog.map(async entry => {
  const manifestUrl = new URL(entry, new URL('./assets/catalog.json', location.href));
  const manifest = await fetch(manifestUrl).then(response => response.json());
  const folder = new URL('.', manifestUrl);
  return { name: manifest.name, manifestUrl: manifestUrl.href, thumb: new URL('thumb.webp', folder).href };
}));

function select(pack, button) {
  if (pet.getAttribute('src') === pack.manifestUrl && !stage.hasAttribute('data-error')) return;
  stage.removeAttribute('data-error');
  stage.setAttribute('aria-busy', 'true');
  placeholder.src = pack.thumb;
  placeholder.hidden = false;
  pet.inert = true;
  hint.textContent = 'Loading interactive preview…';
  pet.removeAttribute('src');
  pet.setAttribute('src', pack.manifestUrl);
  pet.setAttribute('label', `${pack.name}: click to react`);
  nameEl.textContent = pack.name;
  for (const card of roster.querySelectorAll('button')) {
    const active = card === button;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
  }
}

for (const pack of packs) {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = pack.name;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', pack.name);
  const image = document.createElement('img');
  image.src = pack.thumb;
  image.alt = '';
  image.width = 128;
  image.height = 128;
  const label = document.createElement('span');
  label.textContent = pack.name;
  button.append(image, label);
  button.addEventListener('click', () => select(pack, button));
  roster.append(button);
}

select(packs[0], roster.firstElementChild);
