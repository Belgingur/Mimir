export const buildStreamlineGeotransform = (
  bounds: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number, number, number] => {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const dx = width > 1 ? (maxLon - minLon) / (width - 1) : 0;
  const dy = height > 1 ? (minLat - maxLat) / (height - 1) : 0;
  return [minLon, dx, 0, maxLat, 0, dy];
};
