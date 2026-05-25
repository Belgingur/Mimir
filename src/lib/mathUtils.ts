export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const compassBearingToIconAngle = (bearing: number) => {
  const normalized = ((bearing % 360) + 360) % 360;
  return 90 - normalized;
};

export const bearingFromCoordinates = (
  from: [number, number],
  to: [number, number],
) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0))
    return Number.NaN;
  return (((90 - (Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360;
};

export const mapMagnitudeToArrowSize = (
  magnitude: number,
  magnitudeMin: number,
  magnitudeMax: number,
  minSize: number,
  maxSize: number,
) => {
  const safeMax = Math.max(magnitudeMin + 1e-6, magnitudeMax);
  const t = clamp((magnitude - magnitudeMin) / (safeMax - magnitudeMin), 0, 1);
  return minSize + t * (maxSize - minSize);
};
