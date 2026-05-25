import type { InhouseLayer } from "./inhouseTypes";

export const sampleScalarGridAtCoord = (
  grid: { data: Float32Array; width: number; height: number },
  bounds: [number, number, number, number],
  coord: [number, number],
) => {
  const [lon, lat] = coord;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const spanLon = maxLon - minLon;
  const spanLat = maxLat - minLat;
  if (spanLon <= 0 || spanLat <= 0) return null;
  const u = (lon - minLon) / spanLon;
  const v = (maxLat - lat) / spanLat;
  const x = Math.max(
    0,
    Math.min(grid.width - 1, Math.round(u * (grid.width - 1))),
  );
  const y = Math.max(
    0,
    Math.min(grid.height - 1, Math.round(v * (grid.height - 1))),
  );
  const value = grid.data[y * grid.width + x];
  return Number.isFinite(value) ? value : null;
};

export const sampleInhouseScalarAtCoord = (
  layer: InhouseLayer,
  coord: [number, number],
  bounds: [number, number, number, number],
): number | null => {
  if (!layer.scalar) return null;
  const [lon, lat] = coord;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const spanLon = maxLon - minLon;
  const spanLat = maxLat - minLat;
  if (spanLon <= 0 || spanLat <= 0) return null;
  const u = (lon - minLon) / spanLon;
  const v = (maxLat - lat) / spanLat;
  const x = Math.max(
    0,
    Math.min(layer.scalar.width - 1, Math.round(u * (layer.scalar.width - 1))),
  );
  const y = Math.max(
    0,
    Math.min(
      layer.scalar.height - 1,
      Math.round(v * (layer.scalar.height - 1)),
    ),
  );
  const sample = layer.scalar.data[y * layer.scalar.width + x];
  return Number.isFinite(sample) ? sample : null;
};

export const sampleInhouseRasterAtCoord = (
  layer: InhouseLayer,
  coord: [number, number],
  bounds: [number, number, number, number],
): number | null => {
  if (!layer.rasterScalar) return null;
  const [lon, lat] = coord;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const spanLon = maxLon - minLon;
  const spanLat = maxLat - minLat;
  if (spanLon <= 0 || spanLat <= 0) return null;
  const u = (lon - minLon) / spanLon;
  const v = (maxLat - lat) / spanLat;
  const logicalWidth = layer.rasterScalar.widthMeta ?? layer.rasterScalar.width;
  const x = Math.max(
    0,
    Math.min(logicalWidth - 1, Math.round(u * (logicalWidth - 1))),
  );
  const y = Math.max(
    0,
    Math.min(
      layer.rasterScalar.height - 1,
      Math.round(v * (layer.rasterScalar.height - 1)),
    ),
  );
  if (layer.domainMask && (layer.domainMaskOn ?? 0) > 0) {
    if (layer.domainMask[y * logicalWidth + x] === 0) return null;
  }
  const sample = layer.rasterScalar.data[y * layer.rasterScalar.width + x];
  return Number.isFinite(sample) ? sample : null;
};
