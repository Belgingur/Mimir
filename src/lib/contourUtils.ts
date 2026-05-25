export const downsampleScalarGrid = (
  image: Float32Array,
  width: number,
  height: number,
  factor: number,
): { data: Float32Array; width: number; height: number } => {
  if (factor <= 1) return { data: image, width, height };
  const nextWidth = Math.max(1, Math.floor(width / factor));
  const nextHeight = Math.max(1, Math.floor(height / factor));
  const next = new Float32Array(nextWidth * nextHeight);
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      let sum = 0;
      let count = 0;
      const startX = x * factor;
      const startY = y * factor;
      for (let dy = 0; dy < factor; dy += 1) {
        const iy = startY + dy;
        if (iy >= height) continue;
        for (let dx = 0; dx < factor; dx += 1) {
          const ix = startX + dx;
          if (ix >= width) continue;
          const value = image[iy * width + ix];
          if (Number.isFinite(value)) {
            sum += value;
            count += 1;
          }
        }
      }
      next[y * nextWidth + x] = count > 0 ? sum / count : Number.NaN;
    }
  }
  return { data: next, width: nextWidth, height: nextHeight };
};

// Chaikin corner-cutting: each iteration replaces segments with 25%/75% split points
export const chaikinSmooth = (
  path: [number, number][],
  iterations: number,
): [number, number][] => {
  let points = path;
  for (let iter = 0; iter < iterations; iter += 1) {
    if (points.length < 3) break;
    const next: [number, number][] = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const q: [number, number] = [
        x0 * 0.75 + x1 * 0.25,
        y0 * 0.75 + y1 * 0.25,
      ];
      const r: [number, number] = [
        x0 * 0.25 + x1 * 0.75,
        y0 * 0.25 + y1 * 0.75,
      ];
      next.push(q, r);
    }
    next.push(points[points.length - 1]);
    points = next;
  }
  return points;
};
