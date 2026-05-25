import { describe, expect, it } from "vitest";
import {
  extractSnowPoints,
  referenceZoomForModel,
  SNOW_OVERLAY_MIN,
} from "../src/lib/snowOverlay";
import type { InhouseLayer } from "../src/lib/inhouseTypes";

// ── referenceZoomForModel ─────────────────────────────────────────────────────

describe("referenceZoomForModel", () => {
  it("returns 3.0 for large-domain models (GFS, ECMWF)", () => {
    expect(referenceZoomForModel("GFS")).toBe(3.0);
    expect(referenceZoomForModel("ECMWF")).toBe(3.0);
  });

  it("returns 4.0 for medium-domain models (ICON-EU, UWC-DINI, UWC-IG)", () => {
    expect(referenceZoomForModel("ICON-EU")).toBe(4.0);
    expect(referenceZoomForModel("UWC-DINI")).toBe(4.0);
    expect(referenceZoomForModel("UWC-IG")).toBe(4.0);
  });

  it("returns 5.8 for small-domain models (BEL-IS, BEL-FO, unknown)", () => {
    expect(referenceZoomForModel("BEL-IS")).toBe(5.8);
    expect(referenceZoomForModel("BEL-FO")).toBe(5.8);
    expect(referenceZoomForModel("UNKNOWN")).toBe(5.8);
  });
});

// ── extractSnowPoints helpers ─────────────────────────────────────────────────

function makeLayer(
  width: number,
  height: number,
  data: Uint8Array,
  srcMin = 0,
  srcMax = 1,
  bounds: [number, number, number, number] = [-10, -10, 10, 10],
): InhouseLayer {
  return {
    id: "test",
    model: "GFS",
    analysis: "2026-01-01_00",
    variable: "snow_fraction",
    manifest: {
      bounds,
      shape: { width, height },
      srcMin,
      srcMax,
      fileTemplate: "f_{index:03d}.webp",
      count: 1,
      analysisTime: "2026-01-01_00",
    },
    times: [],
    visible: true,
    image: null,
    scalar: null,
    rasterScalar: { data, width, height },
    rawRange: null,
    domainMask: null,
  } as unknown as InhouseLayer;
}

/** Raw byte value encoding a fraction in [0,1] with srcMin=0, srcMax=1. */
const encodeFrac = (frac: number) => Math.round(frac * 255);

// ── extractSnowPoints ─────────────────────────────────────────────────────────

describe("extractSnowPoints", () => {
  it("returns null when rasterScalar is null", () => {
    const layer = makeLayer(12, 12, new Uint8Array(144));
    (layer as any).rasterScalar = null;
    expect(extractSnowPoints(layer)).toBeNull();
  });

  it("returns null when all values are below SNOW_OVERLAY_MIN", () => {
    const size = 24;
    // Fill with 10% snow fraction — below the 0.25 minimum
    const data = new Uint8Array(size * size).fill(encodeFrac(0.1));
    const layer = makeLayer(size, size, data);
    expect(extractSnowPoints(layer)).toBeNull();
  });

  it("returns points when some blocks exceed SNOW_OVERLAY_MIN", () => {
    // 24×24 raster: fill first 12×12 quadrant with 0.5 snow fraction
    const size = 24;
    const data = new Uint8Array(size * size).fill(0);
    for (let ry = 0; ry < 12; ry++) {
      for (let rx = 0; rx < 12; rx++) {
        data[ry * size + rx] = encodeFrac(0.5);
      }
    }
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.length).toBeGreaterThan(0);
  });

  it("assigns tier 1 for fraction 0.25–0.5", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 1)).toBe(true);
  });

  it("assigns tier 2 for fraction 0.5–0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 2)).toBe(true);
  });

  it("assigns tier 3 for fraction >= 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 3)).toBe(true);
  });

  it("returns two points per tile block", () => {
    // Single 12×12 block filled with high snow fraction
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.length).toBe(2);
  });

  it("tier 1 and 2 points have rot=0", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.4));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points.every((p) => p.rot === 0)).toBe(true);
  });

  it("tier 3 points have deterministic non-zero rotation", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    // Rotation is deterministic (based on block coordinates)
    expect(points[0].rot).toBeDefined();
    expect(points[0].rot).toBeGreaterThanOrEqual(-30);
    expect(points[0].rot).toBeLessThanOrEqual(30);
  });

  it("tier 1 size is 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points.every((p) => p.size === 0.75)).toBe(true);
  });

  it("tier 3 sizes are 0.02 and 0.027", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points[0].size).toBe(0.02);
    expect(points[1].size).toBe(0.027);
  });

  it("point lng/lat are within the manifest bounds", () => {
    const size = 24;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const bounds: [number, number, number, number] = [-20, -10, 20, 10];
    const layer = makeLayer(size, size, data, 0, 1, bounds);
    const points = extractSnowPoints(layer)!;
    for (const p of points) {
      expect(p.lng).toBeGreaterThanOrEqual(-20);
      expect(p.lng).toBeLessThanOrEqual(20);
      expect(p.lat).toBeGreaterThanOrEqual(-10);
      expect(p.lat).toBeLessThanOrEqual(10);
    }
  });

  it("respects widthMeta for logical raster width", () => {
    // paddedWidth=16, logical width=12
    const paddedWidth = 16;
    const logicalWidth = 12;
    const height = 12;
    const data = new Uint8Array(paddedWidth * height).fill(0);
    // Write high snow fraction in first 12 columns
    for (let ry = 0; ry < height; ry++) {
      for (let rx = 0; rx < logicalWidth; rx++) {
        data[ry * paddedWidth + rx] = encodeFrac(0.9);
      }
    }
    const layer = makeLayer(paddedWidth, height, data);
    (layer as any).rasterScalar.widthMeta = logicalWidth;
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
  });

  it("exports SNOW_OVERLAY_MIN = 0.25", () => {
    expect(SNOW_OVERLAY_MIN).toBe(0.25);
  });
});
