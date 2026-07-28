/**
 * Pure pixel-processing for in-house WebP frames (task B1).
 *
 * Extracted from InhouseCatalogController.loadInhouseTexture so the exact same
 * work runs either off-thread (textureDecoderWorker) or on the main thread as a
 * fallback. Takes the raw RGBA bytes of a decoded frame and:
 *   1. pre-scans alpha to decide whether alpha encodes a domain mask,
 *   2. normalizes alpha (fully opaque / fully transparent), and
 *   3. computes the red-channel value range + opaque/transparent pixel counts.
 *
 * `srcData` is mutated in place and returned as `data`.
 */
export interface ProcessedTexture {
  data: Uint8Array;
  width: number;
  height: number;
  rawRange: [number, number] | null;
  alphaOn: number;
  alphaOff: number;
  /** Red-channel min/max across all pixels (used only for dev logging). */
  minR: number;
  maxR: number;
}

export function processTexturePixels(
  srcData: Uint8Array,
  width: number,
  height: number,
): ProcessedTexture {
  // Pre-scan alpha.
  let preAlphaOn = 0;
  let preAlphaPartial = 0;
  let preMaxR = 0;
  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i];
    const a = srcData[i + 3];
    if (a >= 255) preAlphaOn += 1;
    else if (a > 0) preAlphaPartial += 1;
    if (r > preMaxR) preMaxR = r;
  }
  // Only ignore alpha (treat image as fully opaque) when there are NO fully-opaque
  // pixels AND NO partial-alpha pixels. Partial alpha indicates the image uses
  // alpha for domain masking (e.g. BEL-FO temperature), so we must preserve it.
  const ignoreAlpha = preAlphaOn === 0 && preAlphaPartial === 0 && preMaxR > 0;

  // Normalize alpha.
  for (let i = 0; i < srcData.length; i += 4) {
    let a = srcData[i + 3];
    if (ignoreAlpha) {
      a = 255;
    } else if (a === 0) {
      srcData[i] = 0;
      srcData[i + 1] = 0;
      srcData[i + 2] = 0;
    } else if (a > 0 && a < 255) {
      a = 255;
    }
    srcData[i + 3] = a;
  }

  let alphaOn = 0;
  let alphaOff = 0;
  let min = 255;
  let max = 0;
  let minR = 255;
  let maxR = 0;
  for (let i = 0; i < srcData.length; i += 4) {
    const r = srcData[i];
    const alpha = srcData[i + 3];
    if (alpha >= 255) alphaOn += 1;
    else alphaOff += 1;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (alpha < 255) continue;
    if (r < min) min = r;
    if (r > max) max = r;
  }
  const rawRange: [number, number] | null =
    Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;

  return { data: srcData, width, height, rawRange, alphaOn, alphaOff, minR, maxR };
}
