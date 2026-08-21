import { describe, expect, it } from "vitest";

import { TEMPERATURE_SCALE } from "../src/lib/temperatureScale";
import {
  cropStopsToWindow,
  legendTicks,
  MAX_TICKS,
  MIN_SPAN_C,
  rawRangeToCelsius,
  resolveLegendWindow,
  rangeInViewport,
  stopPercent,
  windowsEqual,
  type TemperatureLegendWindow,
} from "../src/lib/temperatureLegendWindow";

/** The encoder domain the legend used to hardcode. */
const DOMAIN = { lo: -50, hi: 50 };
const FULL: TemperatureLegendWindow = { lo: -50, hi: 50, step: 10 };

describe("rawRangeToCelsius", () => {
  it("maps the full uint8 range onto the encoder domain", () => {
    const range = rawRangeToCelsius([0, 255], [-50, 50]);
    // Widened by half a code band (0.392°C / 2) on each end so the window can
    // never crop away a value that is genuinely on screen.
    expect(range?.lo).toBeCloseTo(-50.196, 3);
    expect(range?.hi).toBeCloseTo(50.196, 3);
  });

  it("maps an interior range to its °C band, widened by half a code", () => {
    const range = rawRangeToCelsius([128, 166], [-50, 50]);
    expect(range?.lo).toBeCloseTo(0.0, 1);
    expect(range?.hi).toBeCloseTo(15.29, 1);
  });

  it("returns null for missing or degenerate inputs", () => {
    expect(rawRangeToCelsius(null, [-50, 50])).toBeNull();
    expect(rawRangeToCelsius([0, 255], null)).toBeNull();
    expect(rawRangeToCelsius([200, 100], [-50, 50])).toBeNull();
    expect(rawRangeToCelsius([0, 255], [50, 50])).toBeNull();
    expect(rawRangeToCelsius([Number.NaN, 255], [-50, 50])).toBeNull();
  });
});

describe("resolveLegendWindow", () => {
  it("crops a typical Iceland run to a round narrow window", () => {
    // The motivating case: a domain that lives inside a few degrees should read
    // as -5…15, not -50…50.
    expect(resolveLegendWindow({ lo: 3, hi: 9 }, DOMAIN)).toEqual({
      lo: -5,
      hi: 15,
      step: 5,
    });
  });

  it("never crops below the minimum span", () => {
    const window = resolveLegendWindow({ lo: 6, hi: 7 }, DOMAIN);
    expect(window.hi - window.lo).toBeGreaterThanOrEqual(MIN_SPAN_C);
  });

  it("reproduces the previous -50…50 ladder for a full global domain", () => {
    const observed = rawRangeToCelsius([0, 255], [-50, 50]);
    expect(resolveLegendWindow(observed, DOMAIN)).toEqual(FULL);
    expect(legendTicks(FULL)).toEqual([
      -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50,
    ]);
  });

  it("never reaches beyond the palette's own extent", () => {
    // The ramp's overflow colours are deliberately unused; a bar drawn past the
    // last stop would paint a flat block of invented colour.
    const cases = [
      { lo: -50.4, hi: 50.4 },
      { lo: 48, hi: 50.2 },
      { lo: -50.2, hi: -47 },
    ];
    for (const observed of cases) {
      const window = resolveLegendWindow(observed, DOMAIN);
      expect(window.lo).toBeGreaterThanOrEqual(DOMAIN.lo);
      expect(window.hi).toBeLessThanOrEqual(DOMAIN.hi);
    }
  });

  it("slides inward rather than spilling out when widening at a domain edge", () => {
    const window = resolveLegendWindow({ lo: 49, hi: 50 }, DOMAIN);
    expect(window.hi).toBe(50);
    expect(window.hi - window.lo).toBeGreaterThanOrEqual(MIN_SPAN_C);
  });

  it("always snaps outward, so the window covers the observed data", () => {
    const cases = [
      { lo: -21.4, hi: 3.2 },
      { lo: 0.1, hi: 0.2 },
      { lo: -47, hi: 41 },
      { lo: 12, hi: 34 },
      { lo: -6.1, hi: -6.1 },
    ];
    for (const observed of cases) {
      const window = resolveLegendWindow(observed, DOMAIN);
      expect(window.lo).toBeLessThanOrEqual(observed.lo);
      expect(window.hi).toBeGreaterThanOrEqual(observed.hi);
    }
  });

  it("falls back to the whole domain when the observed range is absent or nonsense", () => {
    expect(resolveLegendWindow(null, DOMAIN)).toEqual(FULL);
    expect(resolveLegendWindow({ lo: Number.NaN, hi: 4 }, DOMAIN)).toEqual(FULL);
    expect(resolveLegendWindow({ lo: 10, hi: -10 }, DOMAIN)).toEqual(FULL);
  });
});

describe("legendTicks", () => {
  it("walks the window in uniform round steps", () => {
    expect(legendTicks({ lo: -5, hi: 15, step: 5 })).toEqual([
      -5, 0, 5, 10, 15,
    ]);
  });

  it("always labels 0°C when the window straddles freezing", () => {
    const straddling = [
      { lo: -5, hi: 15 },
      { lo: -20, hi: 5 },
      { lo: -35, hi: 25 },
      { lo: -2.5, hi: 11 },
      { lo: -0.5, hi: 0.5 },
    ];
    for (const observed of straddling) {
      const window = resolveLegendWindow(observed, DOMAIN);
      expect(legendTicks(window)).toContain(0);
    }
  });

  it("keeps the label count readable on the 220px bar", () => {
    for (let lo = -50; lo < 50; lo += 5) {
      for (const span of [0, 1, 8, 20, 45, 90, 120]) {
        const window = resolveLegendWindow({ lo, hi: lo + span }, DOMAIN);
        expect(legendTicks(window).length).toBeLessThanOrEqual(MAX_TICKS);
      }
    }
  });

  it("labels both ends of the bar", () => {
    const window = resolveLegendWindow({ lo: -3, hi: 12 }, DOMAIN);
    const ticks = legendTicks(window);
    expect(ticks[0]).toBe(window.lo);
    expect(ticks[ticks.length - 1]).toBe(window.hi);
  });

  it("drops an interior label that would collide with an edge label", () => {
    // At a 10°C step, -50 sits 2°C from the -48 edge and 10 sits 2°C from the
    // 12 edge. Both would be drawn on top of an edge label, so both go.
    expect(legendTicks({ lo: -48, hi: 12, step: 10 })).toEqual([
      -48, -40, -30, -20, -10, 0, 12,
    ]);
  });

  it("degrades safely for a zero-width or stepless window", () => {
    expect(legendTicks({ lo: 5, hi: 5, step: 5 })).toEqual([5]);
    expect(legendTicks({ lo: 0, hi: 10, step: 0 })).toEqual([0, 10]);
  });
});

describe("stopPercent", () => {
  it("puts the window edges at 0% and 100%", () => {
    expect(stopPercent(-5, { lo: -5, hi: 15, step: 5 })).toBe(0);
    expect(stopPercent(15, { lo: -5, hi: 15, step: 5 })).toBe(100);
    expect(stopPercent(5, { lo: -5, hi: 15, step: 5 })).toBe(50);
  });
});

describe("cropStopsToWindow", () => {
  const byValue = new Map(TEMPERATURE_SCALE);

  it("keeps every colour byte-for-byte identical to the source ramp", () => {
    // The whole point of the feature: cropping must never recolour anything.
    const cropped = cropStopsToWindow(TEMPERATURE_SCALE, {
      lo: -5,
      hi: 15,
      step: 5,
    });
    // The last entry is the synthesised terminal stop, which carries the colour
    // of the band below it; every other stop is a source entry, unchanged.
    for (const [value, color] of cropped.slice(0, -1)) {
      expect(color).toBe(byValue.get(value));
    }
    expect(cropped.find(([v]) => v === 8)?.[1]).toBe(byValue.get(8));
  });

  it("spans exactly the window, with the low band painting from the bottom", () => {
    const cropped = cropStopsToWindow(TEMPERATURE_SCALE, {
      lo: -5,
      hi: 15,
      step: 5,
    });
    expect(cropped[0]).toEqual([-5, byValue.get(-5)]);
    expect(cropped[cropped.length - 1]).toEqual([15, byValue.get(14)]);
    expect(cropped.every(([v]) => v >= -5 && v <= 15)).toBe(true);
  });

  it("keeps one stop per source band inside the window", () => {
    const cropped = cropStopsToWindow(TEMPERATURE_SCALE, {
      lo: -5,
      hi: 15,
      step: 5,
    });
    // Bands -5…14 (20 of them) plus the terminal stop closing the bar at 15.
    expect(cropped.length).toBe(21);
  });

  it("covers the whole bar for the full encoder domain", () => {
    const cropped = cropStopsToWindow(TEMPERATURE_SCALE, FULL);
    expect(cropped[0][0]).toBe(-50);
    expect(cropped[cropped.length - 1][0]).toBe(50);
  });

  it("clamps a band that straddles the low edge instead of dropping it", () => {
    const stops: [number, string][] = [
      [0, "a"],
      [10, "b"],
      [20, "c"],
    ];
    expect(cropStopsToWindow(stops, { lo: 5, hi: 15, step: 5 })).toEqual([
      [5, "a"],
      [10, "b"],
      [15, "b"],
    ]);
  });

  it("holds a colour rather than blanking when the window misses every band", () => {
    const stops: [number, string][] = [
      [0, "a"],
      [10, "b"],
    ];
    expect(
      cropStopsToWindow(stops, { lo: 20, hi: 35, step: 5 }).map(([, c]) => c),
    ).toEqual(["b", "b"]);
    expect(
      cropStopsToWindow(stops, { lo: -30, hi: -15, step: 5 }).map(([, c]) => c),
    ).toEqual(["a", "a"]);
  });

  it("returns nothing for an empty palette", () => {
    expect(cropStopsToWindow([], FULL)).toEqual([]);
  });
});

describe("windowsEqual", () => {
  it("compares edges and step", () => {
    expect(windowsEqual(FULL, { lo: -50, hi: 50, step: 10 })).toBe(true);
    expect(windowsEqual(FULL, { lo: -50, hi: 50, step: 5 })).toBe(false);
    expect(windowsEqual(FULL, { lo: -5, hi: 15, step: 5 })).toBe(false);
    expect(windowsEqual(null, null)).toBe(true);
    expect(windowsEqual(FULL, null)).toBe(false);
  });
});

describe("rangeInViewport", () => {
  /**
   * A 10x10 RGBA frame spanning the whole globe, where the raw code is a
   * function of the pixel's column — so a viewport over the left edge sees
   * different values from one over the right.
   */
  const FRAME_BOUNDS = [-180, -90, 180, 90] as const;
  const frame = (value: (x: number, y: number) => number, alpha = () => 255) => {
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = value(x, y);
        data[i + 3] = alpha();
      }
    }
    return { data, width, height };
  };

  const codes = frame((x) => x * 25); // 0, 25, 50 … 225

  it("reports only what the viewport covers, not the whole frame", () => {
    const west = rangeInViewport(codes, FRAME_BOUNDS, [-180, -90, -100, 90], [
      -50, 50,
    ]);
    const east = rangeInViewport(codes, FRAME_BOUNDS, [100, -90, 180, 90], [
      -50, 50,
    ]);
    expect(west!.hi).toBeLessThan(east!.lo);
    // ...and the whole-frame answer is wider than either.
    const all = rangeInViewport(codes, FRAME_BOUNDS, FRAME_BOUNDS, [-50, 50])!;
    expect(all.lo).toBeLessThanOrEqual(west!.lo);
    expect(all.hi).toBeGreaterThanOrEqual(east!.hi);
  });

  it("follows the map: panning changes the answer", () => {
    const seen = [
      rangeInViewport(codes, FRAME_BOUNDS, [-180, -90, -90, 90], [-50, 50])!,
      rangeInViewport(codes, FRAME_BOUNDS, [-90, -90, 0, 90], [-50, 50])!,
      rangeInViewport(codes, FRAME_BOUNDS, [0, -90, 90, 90], [-50, 50])!,
      rangeInViewport(codes, FRAME_BOUNDS, [90, -90, 180, 90], [-50, 50])!,
    ];
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].lo).toBeGreaterThan(seen[i - 1].lo);
    }
  });

  it("clips the viewport to the frame instead of reading outside it", () => {
    const regional = [-30, 60, -8, 69] as const;
    const inside = rangeInViewport(codes, regional, [-25, 62, -12, 67], [
      -50, 50,
    ]);
    const overhang = rangeInViewport(codes, regional, [-180, -90, 180, 90], [
      -50, 50,
    ]);
    expect(inside).not.toBeNull();
    expect(overhang).not.toBeNull();
  });

  it("returns null when the map is looking away from the model", () => {
    const iceland = [-30, 60, -8, 69] as const;
    expect(
      rangeInViewport(codes, iceland, [100, -40, 140, -10], [-50, 50]),
    ).toBeNull();
  });

  it("skips nodata pixels outside the model domain", () => {
    // Alpha 0 everywhere: nothing is in-domain, so there is nothing to report.
    const masked = frame((x) => x * 25, () => 0);
    expect(
      rangeInViewport(masked, FRAME_BOUNDS, FRAME_BOUNDS, [-50, 50]),
    ).toBeNull();
  });

  it("handles single-band frames, which carry no alpha", () => {
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height);
    data.fill(128);
    data[0] = 10;
    const range = rangeInViewport(
      { data, width, height },
      FRAME_BOUNDS,
      FRAME_BOUNDS,
      [-50, 50],
    );
    expect(range).not.toBeNull();
    expect(range!.lo).toBeLessThan(range!.hi);
  });

  it("bounds its work on a large frame by striding", () => {
    const width = 1440;
    const height = 720;
    const big = new Uint8Array(width * height * 4);
    for (let i = 0; i < big.length; i += 4) {
      big[i] = 100;
      big[i + 3] = 255;
    }
    const started = performance.now();
    const range = rangeInViewport(
      { data: big, width, height },
      FRAME_BOUNDS,
      FRAME_BOUNDS,
      [-50, 50],
    );
    expect(range).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(120);
  });

  it("degrades safely on missing or malformed input", () => {
    expect(rangeInViewport(null, FRAME_BOUNDS, FRAME_BOUNDS, [-50, 50])).toBeNull();
    expect(rangeInViewport(codes, FRAME_BOUNDS, FRAME_BOUNDS, null)).toBeNull();
    expect(
      rangeInViewport({ data: new Uint8Array(0), width: 0, height: 0 }, FRAME_BOUNDS, FRAME_BOUNDS, [-50, 50]),
    ).toBeNull();
    // A degenerate frame footprint has no linear mapping to pixels.
    expect(rangeInViewport(codes, [10, 10, 10, 10], FRAME_BOUNDS, [-50, 50])).toBeNull();
  });
});
