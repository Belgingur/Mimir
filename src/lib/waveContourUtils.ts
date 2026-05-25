// Box dilation: expand each land pixel by bufferPx in all directions
export const expandLandMask = (
  mask: Uint8Array,
  width: number,
  height: number,
  bufferPx: number,
): Uint8Array => {
  if (bufferPx <= 0) return mask;
  const expanded = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      for (let dy = -bufferPx; dy <= bufferPx; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -bufferPx; dx <= bufferPx; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          expanded[ny * width + nx] = 1;
        }
      }
    }
  }
  return expanded;
};

export const downsampleMask = (
  mask: Uint8Array,
  width: number,
  height: number,
  factor: number,
): { mask: Uint8Array; width: number; height: number } => {
  if (factor <= 1) return { mask, width, height };
  const nextWidth = Math.max(1, Math.floor(width / factor));
  const nextHeight = Math.max(1, Math.floor(height / factor));
  const next = new Uint8Array(nextWidth * nextHeight);
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const startX = x * factor;
      const startY = y * factor;
      let hit = 0;
      for (let dy = 0; dy < factor && !hit; dy += 1) {
        const iy = startY + dy;
        if (iy >= height) continue;
        for (let dx = 0; dx < factor; dx += 1) {
          const ix = startX + dx;
          if (ix >= width) continue;
          if (mask[iy * width + ix]) {
            hit = 1;
            break;
          }
        }
      }
      next[y * nextWidth + x] = hit;
    }
  }
  return { mask: next, width: nextWidth, height: nextHeight };
};
