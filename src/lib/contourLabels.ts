export type ContourLabel = { position: [number, number]; text: string };

export const buildWavePeriodLabelsFromContours = (
  paths: { path: [number, number][]; value: number }[],
  minSpacingDegrees: number,
): ContourLabel[] => {
  const labels: ContourLabel[] = [];
  const minSpacingSq = minSpacingDegrees * minSpacingDegrees;
  const pickMidpoint = (path: [number, number][]) => {
    if (path.length < 2) return null;
    let total = 0;
    const lengths: number[] = [];
    for (let i = 1; i < path.length; i += 1) {
      const dx = path[i][0] - path[i - 1][0];
      const dy = path[i][1] - path[i - 1][1];
      const len = Math.hypot(dx, dy);
      total += len;
      lengths.push(len);
    }
    if (total === 0) return path[Math.floor(path.length / 2)];
    let target = total / 2;
    for (let i = 1; i < path.length; i += 1) {
      const seg = lengths[i - 1];
      if (target <= seg) {
        const t = seg === 0 ? 0 : target / seg;
        const [x0, y0] = path[i - 1];
        const [x1, y1] = path[i];
        return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t] as [number, number];
      }
      target -= seg;
    }
    return path[Math.floor(path.length / 2)];
  };

  for (const entry of paths) {
    const rounded = Math.round(entry.value);
    if (rounded < 2 || rounded % 2 !== 0) continue;
    const midpoint = pickMidpoint(entry.path);
    if (!midpoint) continue;
    const tooClose = labels.some((label) => {
      const dx = label.position[0] - midpoint[0];
      const dy = label.position[1] - midpoint[1];
      return dx * dx + dy * dy < minSpacingSq;
    });
    if (tooClose) continue;
    labels.push({ position: midpoint, text: `${rounded}` });
  }
  return labels;
};

export const buildMslpLabelsFromContours = (
  contours: { path: [number, number][]; value: number }[],
  step = 10,
): ContourLabel[] => {
  const labels: ContourLabel[] = [];
  const seen = new Set<number>();
  contours.forEach((contour) => {
    const rounded = Math.round(contour.value);
    if (rounded % step !== 0) return;
    if (seen.has(rounded)) return;
    const path = contour.path;
    if (!path || path.length < 4) return;
    const midpoint = path[Math.floor(path.length / 2)];
    labels.push({ position: midpoint, text: `${rounded}` });
    seen.add(rounded);
  });
  return labels;
};
