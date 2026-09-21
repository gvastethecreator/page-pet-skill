// Each visible layer reads its own atlas rectangle. No synthetic head turns.
export function bodyFrame(pack, frame, override = frame.body) {
  return pack.layers?.bodyFrames.find(body => body.id === override);
}

export function drawPose(ctx, pack, images, frame, size, bodyOverride, neckOffset = 0) {
  ctx.clearRect(0, 0, size, size);
  const body = bodyFrame(pack, frame, bodyOverride || frame.body);
  if (body) ctx.drawImage(images.get(body.sheet), ...body.rect, 0, 0, size, size);
  ctx.drawImage(images.get(frame.sheet), ...frame.rect, 0, pack.layers ? -neckOffset * size / frame.rect[2] : 0, size, size);
}

// Measure once per pack so every direction shares the same safe travel range.
export function measureNeckRange(pack, images) {
  if (!pack.layers) return [0, 0];
  const size = pack.layers.size, probe = document.createElement('canvas');
  probe.width = probe.height = size;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  let top = size, bottom = 0;
  for (const frame of pack.frames) {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(images.get(frame.sheet), ...frame.rect, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (pixels[(y * size + x) * 4 + 3]) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
    }
  }
  return [Math.min(0, -Math.min(24, size - bottom - 2)), Math.max(0, Math.min(24, top - 2))];
}
