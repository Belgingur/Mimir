import { describe, expect, it } from "vitest";
import { buildWavePeriodContourPaths } from "../src/workers/waveContoursWorker";

function makeRampGrid(w: number, h: number, min: number, max: number): Float32Array {
  const data = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) {
    data[i] = min + (max - min) * (i / (data.length - 1));
  }
  return data;
}

const BASE_REQUEST = {
  key: "test",
  bounds: [-10, 50, 10, 60] as [number, number, number, number],
  landMask: null,
  bufferPx: 0,
  downsample: 1,
};

describe("buildWavePeriodContourPaths (waveContoursWorker)", () => {
  it("returns empty paths for a flat grid with no threshold crossing", () => {
    const image = new Float32Array(6 * 6).fill(3);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 6,
      height: 6,
      thresholds: [5],
    });
    expect(result).toHaveLength(0);
  });

  it("returns paths when values straddle a threshold", () => {
    const image = makeRampGrid(10, 10, 0, 10);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [5],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe(5);
  });

  it("uses fallback thresholds 1–20 when none are provided", () => {
    const image = makeRampGrid(10, 10, 0, 25);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: undefined,
    });
    const values = new Set(result.map((p) => p.value));
    expect(values.size).toBeGreaterThan(1);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it("uses fallback thresholds when thresholds is an empty array", () => {
    const image = makeRampGrid(10, 10, 0, 25);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it("projects path coordinates into geographic space (not pixel space)", () => {
    const bounds: [number, number, number, number] = [-20, 40, 20, 70];
    const image = makeRampGrid(10, 10, 0, 10);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      bounds,
      thresholds: [5],
    });
    expect(result.length).toBeGreaterThan(0);
    for (const { path } of result) {
      for (const [lon, lat] of path) {
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        // Coordinates should be in the rough geographic neighbourhood of the bounds
        expect(lon).toBeGreaterThan(-180);
        expect(lon).toBeLessThan(180);
        expect(lat).toBeGreaterThan(-90);
        expect(lat).toBeLessThan(90);
      }
    }
  });

  it("treats NaN values as -999 so they don't generate contours at real thresholds", () => {
    const image = new Float32Array(8 * 8).fill(NaN);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: 8,
      height: 8,
      thresholds: [5],
    });
    expect(result).toHaveLength(0);
  });

  it("excludes segments that fall on land-masked pixels", () => {
    const w = 10;
    const h = 10;
    const image = makeRampGrid(w, h, 0, 10);
    // Mark all pixels as land
    const landMask = new Uint8Array(w * h).fill(1);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: w,
      height: h,
      thresholds: [5],
      landMask,
      bufferPx: 0,
    });
    expect(result).toHaveLength(0);
  });

  it("keeps segments that are entirely ocean (land mask all zeros)", () => {
    const w = 10;
    const h = 10;
    const image = makeRampGrid(w, h, 0, 10);
    const landMask = new Uint8Array(w * h).fill(0);
    const result = buildWavePeriodContourPaths({
      ...BASE_REQUEST,
      image,
      width: w,
      height: h,
      thresholds: [5],
      landMask,
      bufferPx: 0,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not throw with downsampling applied", () => {
    const image = makeRampGrid(8, 8, 0, 10);
    expect(() =>
      buildWavePeriodContourPaths({
        ...BASE_REQUEST,
        image,
        width: 8,
        height: 8,
        thresholds: [5],
        downsample: 2,
      }),
    ).not.toThrow();
  });
});
