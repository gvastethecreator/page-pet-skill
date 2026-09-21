// Read-only pack evidence. This never creates a visual approval or publishes art.
export const hashBytes = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(n => n.toString(16).padStart(2, '0')).join('');

export async function inspectPack(pack) {
  const { manifest, images } = pack;
  const gaze = manifest.frames.filter(f => f.kind === 'gaze');
  const reactions = manifest.frames.filter(f => f.kind === 'reaction');
  const expected = new Set([-1,-.5,0,.5,1].flatMap(y => [-1,-.5,0,.5,1].map(x => `${x},${y}`)));
  const coverage = gaze.length === 25 && new Set(gaze.map(f => f.gaze.join(','))).size === 25
    && gaze.every(f => expected.has(f.gaze.join(',')));
  const alphaFailures = [], duplicateGazes = [], pixelHashes = new Set();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const frame of manifest.frames) {
    const [x,y,w,h] = frame.rect;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(images.get(frame.sheet), x,y,w,h,0,0,w,h);
    const pixels = ctx.getImageData(0,0,w,h).data;
    let clear = 0, solid = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (!pixels[i]) clear++;
      if (pixels[i] > 128) solid++;
    }
    if (clear < w*h*.08 || solid < w*h*.0078125) alphaFailures.push(frame.id);
    if (frame.kind === 'gaze') {
      const hash = await hashBytes(pixels);
      if (pixelHashes.has(hash)) duplicateGazes.push(frame.id);
      pixelHashes.add(hash);
    }
  }
  const manifestBytes = await pack.readFile('manifest.json');
  const manifestHash = await hashBytes(manifestBytes);
  const sheetHashes = {};
  for (const name of new Set(manifest.frames.map(f => f.sheet))) sheetHashes[name] = pack.sheetHashes?.[name] || await hashBytes(await pack.readFile(name));
  const recordBytes = await pack.readFile('gaze-review.json', true);
  const record = recordBytes ? JSON.parse(new TextDecoder().decode(recordBytes)) : null;
  const bindingValid = record?.binding?.manifest === manifestHash
    && Object.keys(record?.binding?.sheets || {}).length === Object.keys(sheetHashes).length
    && Object.entries(sheetHashes).every(([k,v]) => record.binding.sheets[k] === v);
  const recordsValid = record?.version === 1 && typeof record.reviewer === 'string' && !!record.reviewer.trim()
    && record.neighborContinuity === 'pass' && record.runtimeTracking === 'pass'
    && Object.keys(record.frames || {}).length === gaze.length && gaze.every(f => {
      const r = record.frames[f.id];
      return r?.status === 'pass' && typeof r.evidence === 'string' && !!r.evidence.trim()
        && JSON.stringify(r.observed) === JSON.stringify(f.gaze) && JSON.stringify(r.expected) === JSON.stringify(f.gaze);
    });
  return { version:1, character:manifest.name, manifestSha256:manifestHash, sheetHashes,
    gazeCount:gaze.length, reactionCount:reactions.length, fullCharacter:!manifest.layers,
    coverage, alphaFailures, duplicateGazes,
    visualRecord:!record ? 'missing' : !bindingValid ? 'stale' : recordsValid ? 'current' : 'incomplete',
    reviewer:recordsValid && bindingValid ? record.reviewer : null,
    scope:'Technical evidence and existing review record only. No automatic visual approval.' };
}

export function renderInspection(target, result) {
  const checks = [
    ['Gaze', result.coverage && !result.duplicateGazes.length, `${result.gazeCount} / 25 · ${result.coverage ? 'full grid' : 'coverage is wrong'} · ${result.duplicateGazes.length ? 'exact copies: '+result.duplicateGazes.join(', ') : 'no exact copies'}`],
    ['Reactions', result.reactionCount === 12, `${result.reactionCount} / 12`],
    ['Transparency', !result.alphaFailures.length, result.alphaFailures.length ? result.alphaFailures.join(', ') : 'Real alpha and visible pixels in every pose'],
    ['Format', result.fullCharacter, result.fullCharacter ? 'One complete sprite per pose' : 'Separate layers: outside the current flow'],
    ['Visual review', result.visualRecord === 'current', ({current:'Current record, bound to these files',missing:'No record: review still required',stale:'Record is stale: the files changed',incomplete:'Record is incomplete or has failures'})[result.visualRecord]],
  ];
  target.replaceChildren();
  for (const [name, pass, detail] of checks) {
    const row = document.createElement('div'); row.className = 'review-check';
    const heading = document.createElement('strong'); heading.textContent = `${pass ? '✓' : '○'} ${name}`;
    const text = document.createElement('span'); text.textContent = detail;
    row.dataset.pass = String(pass); row.append(heading,text); target.append(row);
  }
}
