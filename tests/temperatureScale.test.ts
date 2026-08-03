import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TEMPERATURE_SCALE } from "../src/lib/temperatureScale";
import { buildStepPalette } from "../src/lib/paletteUtils";

type Band = { lower: number; upper: number; hex: string };
type ScaleFile = {
  domain: { min: number; max: number; band_width: number };
  bands: Band[];
};

const scale: ScaleFile = JSON.parse(
  readFileSync(resolve(__dirname, "../scales/gfs_temp_scale.json"), "utf8"),
);

/** Must match DOMAIN_MIN/DOMAIN_MAX in scripts/gen_temperature_scale.py. */
const DOMAIN_MIN = -50;
const DOMAIN_MAX = 50;

/** Colour the ramp assigns to a temperature, by lower-edge band lookup. */
const lookup = (celsius: number): string => {
  let match = TEMPERATURE_SCALE[0][1];
  for (const [lower, hex] of TEMPERATURE_SCALE) {
    if (celsius >= lower) match = hex;
  }
  return match;
};

describe("TEMPERATURE_SCALE source fidelity", () => {
  it("matches scales/gfs_temp_scale.json over the encoder domain", () => {
    const expected = scale.bands
      .filter((b) => b.lower >= DOMAIN_MIN && b.lower < DOMAIN_MAX)
      .sort((a, b) => a.lower - b.lower)
      .map((b) => [b.lower, b.hex.toLowerCase()]);

    // All but the terminal anchor, which has no band of its own.
    expect(TEMPERATURE_SCALE.slice(0, -1)).toEqual(expected);
  });

  it("is truncated to the encoder domain with a terminal anchor", () => {
    const [firstValue] = TEMPERATURE_SCALE[0];
    const [lastValue, lastHex] = TEMPERATURE_SCALE[TEMPERATURE_SCALE.length - 1];
    const [, penultimateHex] =
      TEMPERATURE_SCALE[TEMPERATURE_SCALE.length - 2];

    expect(firstValue).toBe(DOMAIN_MIN);
    expect(lastValue).toBe(DOMAIN_MAX);
    // The anchor repeats the top band rather than introducing above_max, which
    // would misreport genuine +50°C readings as overflow.
    expect(lastHex).toBe(penultimateHex);
  });

  it("has contiguous 1°C stops with no gaps or repeats", () => {
    const values = TEMPERATURE_SCALE.map(([value]) => value);
    expect(values).toEqual(
      Array.from(
        { length: DOMAIN_MAX - DOMAIN_MIN + 1 },
        (_, i) => DOMAIN_MIN + i,
      ),
    );
  });
});

describe("TEMPERATURE_SCALE band lookup", () => {
  it("renders the reference hues across the range", () => {
    // Sub-freezing, temperate, and above +40 — the three checks the scale brief
    // calls for, plus the hue landmarks either side of them.
    expect(lookup(-45)).toBe("#863c87"); // deep purple
    expect(lookup(-25)).toBe("#8612be"); // violet
    expect(lookup(-12)).toBe("#619be7"); // blue
    expect(lookup(-2)).toBe("#7dd0e6"); // cyan approaching zero
    expect(lookup(8)).toBe("#48a322"); // green
    expect(lookup(15)).toBe("#f0f670"); // yellow
    expect(lookup(22)).toBe("#f56d21"); // orange
    expect(lookup(34)).toBe("#800000"); // deep red
    expect(lookup(44)).toBe("#fff8e8"); // pale cream
  });

  it("selects the band containing the value, not the nearest stop", () => {
    expect(lookup(6)).toBe(lookup(6.9));
    expect(lookup(6)).not.toBe(lookup(7));
  });

  it("clamps below the domain instead of falling through", () => {
    expect(lookup(-80)).toBe(TEMPERATURE_SCALE[0][1]);
  });
});

describe("0°C discontinuity", () => {
  it("is a hard cyan→green break in the band table", () => {
    expect(lookup(-0.001)).toBe("#90ecff");
    expect(lookup(0)).toBe("#98e6b0");
  });

  it("survives buildStepPalette without a blended stop across zero", () => {
    const palette = buildStepPalette(
      TEMPERATURE_SCALE.map(([value, hex]) => [value, hex]) as Parameters<
        typeof buildStepPalette
      >[0],
    ) as unknown as [number, string][];

    const zeroIndex = palette.findIndex(([value]) => value === 0);
    expect(zeroIndex).toBeGreaterThan(0);

    // The stop immediately before 0 carries the last sub-zero colour right up to
    // the boundary; nothing interpolates between cyan and green.
    const [beforeValue, beforeHex] = palette[zeroIndex - 1];
    expect(beforeValue).toBeCloseTo(0, 3);
    expect(beforeValue).toBeLessThan(0);
    expect(beforeHex).toBe("#90ecff");
    expect(palette[zeroIndex][1]).toBe("#98e6b0");
  });
});
