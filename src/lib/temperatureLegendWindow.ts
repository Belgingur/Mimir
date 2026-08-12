/**
 * Cropping rule for the temperature legend bar.
 *
 * The colour ramp is fixed and global: a pixel at 8°C is the same colour on
 * every model, and nothing in this module changes that. What it changes is how
 * much of that ramp the *legend* bothers to show. A 2km Iceland run spends its
 * whole life inside roughly -5…+15°C, so a bar labelled -50…+50 wastes 80% of
 * its height on colours that are not on screen and squeezes the ten degrees the
 * reader actually cares about into a 20px stub.
 *
 * So the bar is cropped to a window derived from the data itself — the decoded
 * frame's own value range, which `textureProcessing` already computes for free
 * as `rawRange` — and the colours inside that window stay exactly as they are.
 *
 * Everything here is pure. `LayerComposer` owns the accumulation across frames
 * and the DOM; this module owns the arithmetic and the tick rule.
 */

/** An observed, unsnapped value range in °C. */
export interface TemperatureRange {
  lo: number;
  hi: number;
}

/**
 * A resolved legend window: the bar's end values plus the step its interior
 * labels are spaced by. Interior labels are multiples of `step`, so 0°C is
 * always labelled whenever the window straddles freezing — the ramp has a hard
 * cyan→green discontinuity there, so that label is the one that must never go
 * missing.
 */
export interface TemperatureLegendWindow extends TemperatureRange {
  step: number;
}

/**
 * Candidate label steps, finest-first. 5°C is the finest offered: it keeps the
 * snapped edges round enough to read as deliberate ("-5", not "-4.6") while
 * still landing a label every ~55px on the 220px bar for a typical regional
 * window.
 */
export const TICK_STEPS: readonly number[] = [5, 10, 20];

/**
 * The bar is `min-height: 220px` (see styles/components/legend.css) and labels
 * are 11px, so eleven of them sit ~20px apart — tight but legible, and exactly
 * what the hardcoded -50…+50 / 10°C ladder produced before this module existed.
 */
export const MAX_TICKS = 11;

/**
 * Narrowest window we will crop to. A calm overcast day can hold a whole domain
 * inside 4°C; cropping to that turns the legend into a two-label stub and makes
 * ordinary diurnal variation look like a heatwave. 15°C keeps enough context for
 * the colours to mean something.
 */
export const MIN_SPAN_C = 15;

/**
 * Convert a frame's raw red-channel range to °C.
 *
 * `rawRange` counts uint8 codes over in-domain (opaque) pixels only, and the
 * encoder maps `[0, 255]` linearly onto `unscale`. Each code covers a band of
 * `(max - min) / 255`, so the true value behind a code lies within ±half a band
 * of that band's centre; we widen by that half-band on both ends rather than
 * reporting the centres, so the window can never crop away a value that is
 * genuinely on screen. Mirrors the quantisation reasoning already applied to
 * `imageMinValue` in LayerComposer.
 */
export function rawRangeToCelsius(
  rawRange: readonly [number, number] | null | undefined,
  unscale: readonly [number, number] | null | undefined,
): TemperatureRange | null {
  if (!rawRange || !unscale) return null;
  const [rawLo, rawHi] = rawRange;
  const [min, max] = unscale;
  if (![rawLo, rawHi, min, max].every((v) => Number.isFinite(v))) return null;
  if (rawHi < rawLo || max <= min) return null;

  const perCode = (max - min) / 255;
  const half = perCode / 2;
  return {
    lo: min + rawLo * perCode - half,
    hi: min + rawHi * perCode + half,
  };
}

/**
 * The extent a palette actually defines, i.e. its first and last stop. This is
 * the hard boundary the window is clamped to.
 */
export function paletteDomain(
  stops: readonly (readonly [number, unknown])[],
): TemperatureRange {
  if (!stops.length) return { lo: 0, hi: 0 };
  const values = stops.map(([value]) => value);
  return { lo: Math.min(...values), hi: Math.max(...values) };
}

/** Widest of two observed ranges; either side may be absent. */
export function unionRange(
  a: TemperatureRange | null,
  b: TemperatureRange | null,
): TemperatureRange | null {
  if (!a) return b;
  if (!b) return a;
  return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
}

/**
 * Resolve an observed range into the window the bar will actually draw.
 *
 * `domain` is the palette's own extent, and it is a hard boundary in both
 * directions:
 *
 *  - The window never reaches *beyond* it. The ramp's overflow colours are
 *    deliberately unused (with `clip: BOTH` an out-of-range pixel is
 *    indistinguishable from a genuine endpoint reading), so a bar drawn past the
 *    last stop would paint a flat block of invented colour.
 *  - Widening to {@link MIN_SPAN_C} slides inward rather than spilling out, so a
 *    domain hugging one end of the ramp still gets a full-height bar.
 *
 * Within those bounds the edges snap *outward* to multiples of the chosen step,
 * which is what guarantees the window is always a superset of the observed data:
 * cropping can shrink the bar but never hide a reading.
 */
export function resolveLegendWindow(
  observed: TemperatureRange | null,
  domain: TemperatureRange,
): TemperatureLegendWindow {
  const dLo = Math.min(domain.lo, domain.hi);
  const dHi = Math.max(domain.lo, domain.hi);

  let lo = dLo;
  let hi = dHi;
  if (
    observed &&
    Number.isFinite(observed.lo) &&
    Number.isFinite(observed.hi) &&
    observed.hi >= observed.lo
  ) {
    lo = Math.max(dLo, Math.min(dHi, observed.lo));
    hi = Math.min(dHi, Math.max(dLo, observed.hi));
  }

  // Widen to the minimum span, then slide the whole window back inside the
  // domain if that pushed an edge out (rather than clipping it short).
  const deficit = MIN_SPAN_C - (hi - lo);
  if (deficit > 0) {
    lo -= deficit / 2;
    hi += deficit / 2;
    if (lo < dLo) {
      hi = Math.min(dHi, hi + (dLo - lo));
      lo = dLo;
    } else if (hi > dHi) {
      lo = Math.max(dLo, lo - (hi - dHi));
      hi = dHi;
    }
  }

  const step =
    TICK_STEPS.find((candidate) => tickCount(lo, hi, candidate) <= MAX_TICKS) ??
    TICK_STEPS[TICK_STEPS.length - 1];

  return {
    lo: Math.max(dLo, Math.floor(lo / step) * step),
    hi: Math.min(dHi, Math.ceil(hi / step) * step),
    step,
  };
}

/** How many labels {@link legendTicks} would emit for a window at `step`. */
function tickCount(lo: number, hi: number, step: number): number {
  return legendTicks({
    lo: Math.floor(lo / step) * step,
    hi: Math.ceil(hi / step) * step,
    step,
  }).length;
}

/** Two windows draw the same bar — used to skip pointless re-renders. */
export function windowsEqual(
  a: TemperatureLegendWindow | null,
  b: TemperatureLegendWindow | null,
): boolean {
  if (!a || !b) return a === b;
  return a.lo === b.lo && a.hi === b.hi && a.step === b.step;
}

/**
 * Fraction of a step below which an interior label is dropped for sitting too
 * close to an edge label. Both would be drawn, so they would overlap.
 */
const EDGE_CROWDING = 0.4;

/**
 * The label ladder for a window: both ends of the bar, plus the multiples of
 * `step` between them.
 *
 * The interior labels are anchored on 0 rather than counted up from `lo`, which
 * is what puts a label exactly on the freezing discontinuity even when the
 * window's own edges are not multiples of the step (a domain-clamped edge like
 * -50 at a 20°C step).
 */
export function legendTicks(window: TemperatureLegendWindow): number[] {
  const { lo, hi, step } = window;
  if (!(hi > lo)) return [lo];
  if (!(step > 0)) return [lo, hi];

  const ticks: number[] = [lo];
  const guard = step * EDGE_CROWDING;
  const first = Math.ceil(lo / step) * step;
  for (let v = first; v < hi; v += step) {
    if (v - lo < guard || hi - v < guard) continue;
    ticks.push(v);
  }
  ticks.push(hi);
  return ticks;
}

/** Position of a value on the bar: 0% at the window's low edge, 100% at its high edge. */
export function stopPercent(
  value: number,
  window: TemperatureLegendWindow,
): number {
  const span = window.hi - window.lo;
  if (!(span > 0)) return 0;
  return ((value - window.lo) / span) * 100;
}

/**
 * Crop a palette to a window, preserving every colour.
 *
 * A palette entry `[v, colour]` owns the band from `v` up to the next entry's
 * value — that is how the legend paints hard steps (each colour emitted twice,
 * at its own percent and at the next stop's). Cropping therefore keeps every
 * band that *overlaps* the window, not every stop inside it, and clamps the
 * first survivor's value to the window's low edge so the band containing `lo`
 * still paints from 0%. A terminal stop is appended at `hi` so the last band
 * reaches 100%.
 *
 * Colours pass through untouched; only the values they are keyed at move.
 */
export function cropStopsToWindow<T>(
  stops: readonly (readonly [number, T])[],
  window: TemperatureLegendWindow,
): [number, T][] {
  const sorted = [...stops].sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return [];

  const { lo, hi } = window;
  const kept: [number, T][] = [];
  for (let i = 0; i < sorted.length; i++) {
    const [value, color] = sorted[i];
    // The terminal entry has no successor; treat its band as zero-width.
    const bandEnd = i + 1 < sorted.length ? sorted[i + 1][0] : value;
    if (i + 1 < sorted.length && bandEnd <= lo) continue; // entirely below
    if (value >= hi) break; // at or above the top edge
    kept.push([Math.max(value, lo), color]);
  }

  if (!kept.length) {
    // The window sits entirely outside the ramp (shouldn't happen once it is
    // domain-clamped): hold the nearest end colour so the bar still paints.
    const nearest = lo >= sorted[sorted.length - 1][0] ? sorted[sorted.length - 1] : sorted[0];
    kept.push([lo, nearest[1]]);
  }

  const last = kept[kept.length - 1];
  if (last[0] < hi) kept.push([hi, last[1]]);
  return kept;
}
