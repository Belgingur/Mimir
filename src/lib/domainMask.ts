import type { DomainMask, ModelBBox } from "./inhouseTypes";

/** Decoded masks, one byte per cell (1 = data), keyed by the mask object. */
const decodedMasks = new WeakMap<DomainMask, Uint8Array>();

function decode(mask: DomainMask): Uint8Array {
  const cached = decodedMasks.get(mask);
  if (cached) return cached;
  const { cols, rows } = mask;
  const cells = new Uint8Array(cols * rows);
  mask.runs.split("/").forEach((row, r) => {
    if (r >= rows) return;
    let col = 0;
    let valid = false;
    for (const part of row.split(".")) {
      const length = Number(part);
      if (valid) {
        cells.fill(1, r * cols + col, r * cols + Math.min(cols, col + length));
      }
      col += length;
      valid = !valid;
    }
  });
  decodedMasks.set(mask, cells);
  return cells;
}

/**
 * Whether the model has data at the point, by the mask laid over `bbox`.
 *
 * Cells are treated as equal slices of the bbox. The generator's last column
 * and row can be narrower than the rest, so the lookup can be off by less than
 * one cell at the far edges, which does not matter at this resolution.
 */
export function domainMaskContains(
  mask: DomainMask,
  bbox: ModelBBox,
  lat: number,
  lon: number,
): boolean {
  const { west, south, east, north } = bbox;
  if (!(lon >= west && lon <= east && lat >= south && lat <= north)) return false;
  const col = Math.min(
    mask.cols - 1,
    Math.floor(((lon - west) / (east - west)) * mask.cols),
  );
  const row = Math.min(
    mask.rows - 1,
    Math.floor(((north - lat) / (north - south)) * mask.rows),
  );
  return decode(mask)[row * mask.cols + col] === 1;
}
