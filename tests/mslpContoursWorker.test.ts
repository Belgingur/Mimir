import { describe, expect, it } from "vitest";
import { buildContours } from "../src/workers/mslpContoursWorker";

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
  downsample: 1,
  smoothIterations: 0,
};

describe("buildContours (mslpContoursWorker)", () => {
  it("returns empty paths for a flat grid with no threshold crossing", () => {
    const image = new Float32Array(6 * 6).fill(1010);
    const result = buildContours({
      ...BASE_REQUEST,
      image,
      width: 6,
      height: 6,
      thresholds: [1015],
    });
    expect(result).toHaveLength(0);
  });

  it("returns paths when values straddle a threshold", () => {
    const image = makeRampGrid(10, 10, 1000, 1030);
    const result = buildContours({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [1015],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe(1015);
    expect(result[0].path.length).toBeGreaterThan(1);
  });

  it("projects path coordinates into geographic space (not pixel space)", () => {
    const bounds: [number, number, number, number] = [-20, 40, 20, 70];
    const image = makeRampGrid(10, 10, 1000, 1030);
    const result = buildContours({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      bounds,
      thresholds: [1015],
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

  it("produces paths for each threshold that is crossed", () => {
    const image = makeRampGrid(10, 10, 1000, 1030);
    const result = buildContours({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [1005, 1010, 1015, 1020, 1025],
    });
    const values = new Set(result.map((p) => p.value));
    expect(values.size).toBeGreaterThan(1);
  });

  it("treats NaN values as -999 so they don't generate contours at real thresholds", () => {
    const image = new Float32Array(8 * 8).fill(NaN);
    const result = buildContours({
      ...BASE_REQUEST,
      image,
      width: 8,
      height: 8,
      thresholds: [1013],
    });
    expect(result).toHaveLength(0);
  });

  it("does not throw with downsampling applied", () => {
    const image = makeRampGrid(8, 8, 1000, 1030);
    expect(() =>
      buildContours({
        ...BASE_REQUEST,
        image,
        width: 8,
        height: 8,
        thresholds: [1015],
        downsample: 2,
      }),
    ).not.toThrow();
  });

  it("applies chaikin smoothing without throwing", () => {
    const image = makeRampGrid(10, 10, 1000, 1030);
    const noSmooth = buildContours({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [1015],
      smoothIterations: 0,
    });
    const smoothed = buildContours({
      ...BASE_REQUEST,
      image,
      width: 10,
      height: 10,
      thresholds: [1015],
      smoothIterations: 2,
    });
    expect(noSmooth.length).toBeGreaterThan(0);
    expect(smoothed.length).toBeGreaterThan(0);
  });
});
