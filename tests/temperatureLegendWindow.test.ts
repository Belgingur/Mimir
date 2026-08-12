import { describe, expect, it } from "vitest";

import { TEMPERATURE_SCALE } from "../src/lib/temperatureScale";
import { TEMPERATURE_SCALE_TROPICS } from "../src/lib/temperatureScaleTropics";
import {
  cropStopsToWindow,
  legendTicks,
  MAX_TICKS,
  MIN_SPAN_C,
  rawRangeToCelsius,
  resolveLegendWindow,
  stopPercent,
  unionRange,
  windowsEqual,
  type TemperatureLegendWindow,
} from "../src/lib/temperatureLegendWindow";

/** The encoder domain the legend used to hardcode. */
const DOMAIN = { lo: -50, hi: 50 };
const FULL: TemperatureLegendWindow = { lo: -50, hi: 50, step: 10 };
/** The tropics ramp's own extent (BEL-BR). */
const TROPICS_DOMAIN = { lo: -20, hi: 40 };

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

describe("unionRange", () => {
  it("widens to cover both sides and tolerates absent ones", () => {
    expect(unionRange({ lo: 2, hi: 9 }, { lo: -3, hi: 6 })).toEqual({
      lo: -3,
      hi: 9,
    });
    expect(unionRange(null, { lo: 1, hi: 2 })).toEqual({ lo: 1, hi: 2 });
    expect(unionRange({ lo: 1, hi: 2 }, null)).toEqual({ lo: 1, hi: 2 });
    expect(unionRange(null, null)).toBeNull();
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
    const tropics = resolveLegendWindow({ lo: -30, hi: 60 }, TROPICS_DOMAIN);
    expect(tropics.lo).toBe(TROPICS_DOMAIN.lo);
    expect(tropics.hi).toBe(TROPICS_DOMAIN.hi);
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

  it("works the same on the tropics ramp", () => {
    const cropped = cropStopsToWindow(TEMPERATURE_SCALE_TROPICS, {
      lo: 10,
      hi: 40,
      step: 5,
    });
    expect(cropped[0][0]).toBe(10);
    expect(cropped[cropped.length - 1][0]).toBe(40);
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
