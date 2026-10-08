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

/**
 * The part of `bbox` the mask's data spans, as [west, south, east, north]:
 * what to frame for a model whose domain fills only part of its bbox. Null
 * when the mask has no data at all.
 */
export function domainMaskExtent(
  mask: DomainMask,
  bbox: ModelBBox,
): [number, number, number, number] | null {
  const cells = decode(mask);
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (let row = 0; row < mask.rows; row += 1) {
    for (let col = 0; col < mask.cols; col += 1) {
      if (cells[row * mask.cols + col] !== 1) continue;
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }
  }
  if (minCol === Infinity) return null;
  const lonPerCol = (bbox.east - bbox.west) / mask.cols;
  const latPerRow = (bbox.north - bbox.south) / mask.rows;
  return [
    bbox.west + minCol * lonPerCol,
    bbox.north - (maxRow + 1) * latPerRow,
    bbox.west + (maxCol + 1) * lonPerCol,
    bbox.north - minRow * latPerRow,
  ];
}
