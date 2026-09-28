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

/**
 * The encoded nodata flag under a coordinate: 0 for "outside the domain",
 * 255-ish for "has data", or null when it cannot be read.
 *
 * Every inhouse raster declares `nodata: "A==0"` in its manifest, so the alpha
 * channel of the decoded image is the model's own statement about where it has
 * values. Reading it directly works for layers that never build a float grid —
 * the wave lane renders through contours, so its `scalar` is often absent — and
 * it costs one array lookup.
 *
 * Returns null for a single-channel image (no alpha to read) so callers can tell
 * "no data here" apart from "cannot say".
 */
export function sampleNodataAlpha(
  layer: {
    image?: { data: ArrayLike<number>; width: number; height: number } | null;
    manifest: { bounds: [number, number, number, number] };
  },
  lng: number,
  lat: number,
): number | null {
  const image = layer.image;
  if (!image?.data || !image.width || !image.height) return null;
  const bands = Math.round(image.data.length / (image.width * image.height));
  if (bands < 4) return null; // no alpha channel to consult

  const [minLon, minLat, maxLon, maxLat] = layer.manifest.bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (!(lonSpan > 0) || !(latSpan > 0)) return null;

  // Row 0 is the northern edge, as everywhere else these images are read.
  const x = Math.round(((lng - minLon) / lonSpan) * (image.width - 1));
  const y = Math.round(((maxLat - lat) / latSpan) * (image.height - 1));
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;

  return image.data[(y * image.width + x) * bands + 3] ?? null;
}
