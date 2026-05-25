export const parseHexColor = (
  value: string,
): [number, number, number, number] => {
  const hex = value.replace("#", "");
  if (hex.length !== 6 && hex.length !== 8) {
    return [255, 255, 255, 255];
  }
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
  return [r, g, b, a];
};

export type Palette = Array<
  [number, string | [number, number, number, number]]
>;

export const rescalePalette = (
  palette: Palette,
  srcMin: number,
  srcMax: number,
  refMin: number,
  refMax: number,
): Palette => {
  const span = refMax - refMin;
  if (!Number.isFinite(span) || span === 0) return palette;
  if (!Array.isArray(palette)) return palette;
  return palette.map(([value, color]) => {
    const t = (Number(value) - refMin) / span;
    const scaled = srcMin + t * (srcMax - srcMin);
    return [scaled, color] as [
      number,
      string | [number, number, number, number],
    ];
  });
};

export const rescalePaletteIfNeeded = (
  palette: Palette,
  srcMin: number,
  srcMax: number,
  refMin: number,
  refMax: number,
): Palette => {
  if (!Number.isFinite(srcMin) || !Number.isFinite(srcMax)) return palette;
  if (srcMin >= refMin && srcMax <= refMax) return palette;
  return rescalePalette(palette, srcMin, srcMax, refMin, refMax);
};

/**
 * Build a step palette from any linearly-encoded palette by inserting a hard
 * pre-stop just before each colour boundary.  The pre-stop carries the
 * previous stop's colour, so chroma-js's linear interpolation stays on one
 * colour right up to the boundary and then jumps instantly to the next.
 *
 * An epsilon of 1e-4 in palette-value space is sub-pixel in weatherlayers-gl's
 * 256-pixel colour ramp for all typical meteorological ranges (°C, m/s, m).
 */
export function buildStepPalette(palette: Palette): Palette {
  const result: Palette = [];
  for (let i = 0; i < palette.length; i++) {
    const [v, color] = palette[i];
    if (i > 0) {
      result.push([Number(v) - 1e-4, palette[i - 1][1]]);
    }
    result.push([v, color]);
  }
  return result;
}

/**
 * Build a palette suitable for rendering a log1p-encoded scalar image.
 *
 * WeatherLayers-GL builds a 256-pixel colorRamp texture from the palette.  With
 * a linear domain of [0, 250] that means one ramp pixel ≈ 0.98 mm/hr — far too
 * coarse to resolve stops at 0.01 or 0.25 mm/hr.  By transforming every stop
 * value `v` (in physical units) to its log1p-encoded equivalent
 *
 *   v_enc = log1p(v) / log1p(srcMax) * srcMax
 *
 * the stops spread across the ramp in the same proportion the image pixels do,
 * so every stop lands at its correct ramp position.
 *
 * Each stop also gets a duplicate entry immediately before it (offset by a tiny
 * epsilon in encoded space) that carries the *previous* stop's colour.  This
 * produces a hard step boundary instead of a gradual blend — exactly what the
 * Belgingur precipitation scale intends.
 *
 * Pass the result to RasterLayer together with the original (un-linearised)
 * log1p-encoded image and imageUnscale [0, srcMax].
 */
export function buildLog1pStepPalette(
  palette: Palette,
  srcMax: number,
): Palette {
  const log1pMax = Math.log1p(srcMax);
  const result: Palette = [];
  for (let i = 0; i < palette.length; i++) {
    const [v, color] = palette[i];
    const vEnc = (Math.log1p(Number(v)) / log1pMax) * srcMax;
    if (i > 0) {
      // Pre-stop: keeps previous colour right up to this boundary.
      // 1e-4 in encoded space ≈ 0.0001 ramp pixels → effectively a step.
      result.push([vEnc - 1e-4, palette[i - 1][1]]);
    }
    result.push([vEnc, color]);
  }
  return result;
}

export const getDefaultInhousePalette = (
  minValue: number,
  maxValue: number,
): Palette => {
  const mid = (minValue + maxValue) / 2;
  return [
    [minValue, "#2b83ba"],
    [mid, "#ffffbf"],
    [maxValue, "#d7191c"],
  ];
};
