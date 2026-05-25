import type { InhouseLayer } from "./inhouseTypes";
import { decodeScalarGrid } from "./imageProcessing";

export const tempMinC = -30;
export const tempMaxC = 40;

export const normalizeTemperatureUnscale = (
  unscale: [number, number] | null | undefined,
): [number, number] => {
  const fallback: [number, number] = [tempMinC, tempMaxC];
  if (!unscale || unscale.length < 2) return fallback;
  const [min, max] = unscale;
  if (max > 100) {
    return [min - 273.15, max - 273.15];
  }
  return [min, max];
};

export const getInhouseLayerUnscale = (layer: InhouseLayer) => {
  const raw = layer.manifest.imageUnscale ?? [
    layer.manifest.srcMin,
    layer.manifest.srcMax,
  ];
  if (layer.variable === "air_temperature_at_2m_agl") {
    return normalizeTemperatureUnscale(raw);
  }
  return raw as [number, number];
};

export const getInhouseLayerImageScale = (
  layer: InhouseLayer,
): string | null => {
  return layer.manifest.imageScale ?? null;
};

export const getInhouseLayerBounds = (
  layer: InhouseLayer,
): [number, number, number, number] => {
  const bounds = layer.manifest.bounds;
  const sourceWidth = Array.isArray(layer.manifest.shape)
    ? layer.manifest.shape[0]
    : layer.manifest.shape?.width;
  const widthMeta =
    (layer.image as { widthMeta?: number } | null | undefined)?.widthMeta ??
    (layer.rasterScalar as { widthMeta?: number } | null | undefined)
      ?.widthMeta ??
    sourceWidth;
  const imageWidth =
    (layer.image as { width?: number } | null | undefined)?.width ?? widthMeta;
  if (!widthMeta || !imageWidth || imageWidth === widthMeta) {
    return bounds;
  }
  const span = bounds[2] - bounds[0];
  const step = span / Math.max(1, widthMeta - 1);
  const extra = step * (imageWidth - widthMeta);
  return [bounds[0], bounds[1], bounds[2] + extra, bounds[3]];
};

export const ensureScalar = (layer: InhouseLayer) => {
  if (layer.scalar) return;
  if (!layer.image) return;
  if (layer.image instanceof Promise) return;
  const grid = decodeScalarGrid(
    layer.image,
    getInhouseLayerUnscale(layer),
    getInhouseLayerImageScale(layer),
  );
  if (layer.domainMask) {
    const max = Math.min(layer.domainMask.length, grid.data.length);
    for (let i = 0; i < max; i += 1) {
      if (layer.domainMask[i] === 0) grid.data[i] = Number.NaN;
    }
  }
  layer.scalar = grid;
};
