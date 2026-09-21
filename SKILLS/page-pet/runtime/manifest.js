export function validateManifest(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || !value.name.trim()
      || !Array.isArray(value.frames) || !value.frames.length) throw new Error('Invalid mascot manifest v1.');
  const ids = new Set();
  const points = new Set();
  if (value.puppet) throw new Error('Static two-image puppets are retired. Use a layered spritesheet pack.');
  const bodyIds = new Set();
  if (value.layers) {
    const p = value.layers;
    if (!Number.isInteger(p.size) || p.size < 64 || p.size > 1024
      || !Array.isArray(p.neck) || p.neck.length !== 2 || p.neck.some(n => !Number.isFinite(n) || n < 0 || n > 1)
      || !Array.isArray(p.bodyFrames) || !p.bodyFrames.length) throw new Error('Invalid layer geometry.');
    for (const body of p.bodyFrames) {
      if (typeof body.id !== 'string' || !body.id || bodyIds.has(body.id)) throw new Error('Body frame IDs must be unique.');
      bodyIds.add(body.id); validateSprite(body);
      if (body.rect[2] !== p.size) throw new Error('Body cells must match the layer canvas size.');
    }
  }
  if (value.pivot !== undefined && (!Array.isArray(value.pivot) || value.pivot.length !== 2
      || value.pivot.some(n => !Number.isFinite(n) || n < 0 || n > 1))) throw new Error('Pivot must be normalized within 0..1.');
  for (const frame of value.frames) {
    if (typeof frame.id !== 'string' || !frame.id || ids.has(frame.id)) throw new Error('Frame IDs must be unique.');
    if (frame.expression !== undefined && (typeof frame.expression !== 'boolean' || frame.kind !== 'reaction' || !value.layers))
      throw new Error('Expressions require a layered reaction frame.');
    ids.add(frame.id);
    validateSprite(frame);
    if (!['gaze', 'reaction'].includes(frame.kind)) throw new Error('Unknown frame kind.');
    if (value.layers && (!bodyIds.has(frame.body) || frame.rect[2] !== value.layers.size))
      throw new Error('Each head pose needs a valid body frame and matching cell size.');
    if (frame.kind === 'gaze' && (!Array.isArray(frame.gaze) || frame.gaze.length !== 2
        || frame.gaze.some(n => !Number.isFinite(n) || Math.abs(n) > 1))) throw new Error('Gaze coordinates must be within -1..1.');
    if (frame.kind === 'gaze') {
      const point = frame.gaze.join(',');
      if (points.has(point)) throw new Error('Gaze coordinates must be unique across sheets.');
      points.add(point);
    }
  }
  if (!value.frames.some(f => f.id === value.neutral && f.kind === 'gaze')) throw new Error('A neutral gaze frame is required.');
  return value;
}

export function nearestGaze(frames, x, y) {
  return frames.reduce((best, frame) => {
    const distance = (frame.gaze[0] - x) ** 2 + (frame.gaze[1] - y) ** 2;
    return distance < best.distance ? { frame, distance } : best;
  }, { frame: frames[0], distance: Infinity }).frame;
}

export function validateImages(manifest, images) {
  for (const frame of [...manifest.frames, ...(manifest.layers?.bodyFrames || [])]) {
    const image = images.get(frame.sheet);
    const [x, y, w, h] = frame.rect;
    if (!image || x + w > image.naturalWidth || y + h > image.naturalHeight)
      throw new Error(`Frame ${frame.id} is outside its sheet.`);
  }
}

export function sheetNames(manifest) {
  return [...new Set([...manifest.frames, ...(manifest.layers?.bodyFrames || [])].map(f => f.sheet))];
}

export async function decodeImage(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

function validateSprite(frame) {
  if (typeof frame.sheet !== 'string' || !/^[a-zA-Z0-9_-]+\.(png|webp|avif)$/.test(frame.sheet))
    throw new Error('Sheets must be local PNG, WebP, or AVIF filenames without paths.');
  if (!Array.isArray(frame.rect) || frame.rect.length !== 4 || frame.rect.some(n => !Number.isInteger(n) || n < 0)
    || !frame.rect[2] || frame.rect[2] !== frame.rect[3]) throw new Error('Frames need square integer rectangles.');
}
