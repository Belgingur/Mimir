import { describe, it, expect } from "vitest";
import { buildStreamlineGeotransform } from "../src/lib/streamlineBuilder";

describe("buildStreamlineGeotransform", () => {
  it("computes GDAL-style affine for a global grid", () => {
    const gt = buildStreamlineGeotransform([-180, -90, 180, 90], 361, 181);
    expect(gt[0]).toBe(-180);
    expect(gt[1]).toBeCloseTo(1, 5);
    expect(gt[2]).toBe(0);
    expect(gt[3]).toBe(90);
    expect(gt[4]).toBe(0);
    expect(gt[5]).toBeCloseTo(-1, 5);
  });

  it("returns zero dx/dy for 1x1 grid", () => {
    const gt = buildStreamlineGeotransform([10, 20, 30, 40], 1, 1);
    expect(gt[0]).toBe(10);
    expect(gt[1]).toBe(0);
    expect(gt[3]).toBe(40);
    expect(gt[5]).toBe(0);
  });

  it("computes correct pixel size for regional grid", () => {
    const gt = buildStreamlineGeotransform([0, 0, 10, 5], 11, 6);
    expect(gt[1]).toBeCloseTo(1, 5);
    expect(gt[5]).toBeCloseTo(-1, 5);
  });
});
