import { describe, it, expect } from "vitest";
import { downsampleScalarGrid, chaikinSmooth } from "../src/lib/contourUtils";

describe("downsampleScalarGrid", () => {
  it("returns original when factor <= 1", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const result = downsampleScalarGrid(data, 2, 2, 1);
    expect(result.data).toBe(data);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it("returns original when factor is 0", () => {
    const data = new Float32Array([10]);
    const result = downsampleScalarGrid(data, 1, 1, 0);
    expect(result.data).toBe(data);
  });

  it("downsamples 4x4 grid by factor 2 to 2x2", () => {
    // 4x4 grid:
    //  1  2  3  4
    //  5  6  7  8
    //  9 10 11 12
    // 13 14 15 16
    const data = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    const result = downsampleScalarGrid(data, 4, 4, 2);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    // top-left block: avg(1,2,5,6) = 3.5
    expect(result.data[0]).toBeCloseTo(3.5);
    // top-right block: avg(3,4,7,8) = 5.5
    expect(result.data[1]).toBeCloseTo(5.5);
    // bottom-left block: avg(9,10,13,14) = 11.5
    expect(result.data[2]).toBeCloseTo(11.5);
    // bottom-right block: avg(11,12,15,16) = 13.5
    expect(result.data[3]).toBeCloseTo(13.5);
  });

  it("handles NaN values by excluding them from average", () => {
    const data = new Float32Array([NaN, 2, 3, 4]);
    const result = downsampleScalarGrid(data, 2, 2, 2);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    // avg of finite values: (2 + 3 + 4) / 3 = 3
    expect(result.data[0]).toBeCloseTo(3);
  });

  it("returns NaN when all values in a block are NaN", () => {
    const data = new Float32Array([NaN, NaN, NaN, NaN]);
    const result = downsampleScalarGrid(data, 2, 2, 2);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(Number.isNaN(result.data[0])).toBe(true);
  });

  it("handles non-square grids", () => {
    // 6x2 grid, factor 3 → 2x1
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const result = downsampleScalarGrid(data, 6, 2, 3);
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    // first block: 1,2,3,7,8,9 but height limit — only y=0 row for nextHeight=0
    // Actually: nextHeight = floor(2/3) = 0 → max(1, 0) = 1, nextWidth = floor(6/3) = 2
    // block (0,0): startX=0,startY=0, samples: (0,0)=1, (1,0)=2, (2,0)=3, (0,1)=7, (1,1)=8, (2,1)=9
    // avg = (1+2+3+7+8+9)/6 = 5
    expect(result.data[0]).toBeCloseTo(5);
    // block (1,0): startX=3,startY=0, samples: (3,0)=4, (4,0)=5, (5,0)=6, (3,1)=10, (4,1)=11, (5,1)=12
    // avg = (4+5+6+10+11+12)/6 = 8
    expect(result.data[1]).toBeCloseTo(8);
  });

  it("handles Infinity by treating it as non-finite", () => {
    const data = new Float32Array([Infinity, -Infinity, 5, 10]);
    const result = downsampleScalarGrid(data, 2, 2, 2);
    // Only 5 and 10 are finite → avg = 7.5
    expect(result.data[0]).toBeCloseTo(7.5);
  });

  it("handles large downsample factor that exceeds grid size", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const result = downsampleScalarGrid(data, 2, 2, 10);
    // floor(2/10) = 0 → max(1, 0) = 1
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    // Only pixel (0,0) = 1 is sampled (startX=0, startY=0, factor=10 but bounds check limits it)
    // Actually samples all 4 because startX=0,startY=0 and dx goes 0..9, dy goes 0..9
    // but ix < width and iy < height limits to 0,1
    expect(result.data[0]).toBeCloseTo(2.5);
  });

  it("handles 1x1 grid", () => {
    const data = new Float32Array([42]);
    const result = downsampleScalarGrid(data, 1, 1, 2);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data[0]).toBeCloseTo(42);
  });
});

describe("chaikinSmooth", () => {
  it("returns original points when iterations is 0", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 0],
    ];
    const result = chaikinSmooth(path, 0);
    expect(result).toEqual(path);
  });

  it("returns original points when path has fewer than 3 points", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 1],
    ];
    const result = chaikinSmooth(path, 5);
    expect(result).toEqual(path);
  });

  it("returns single point unchanged", () => {
    const path: [number, number][] = [[5, 5]];
    const result = chaikinSmooth(path, 3);
    expect(result).toEqual([[5, 5]]);
  });

  it("preserves first and last points after smoothing", () => {
    const path: [number, number][] = [
      [0, 0],
      [5, 10],
      [10, 0],
    ];
    const result = chaikinSmooth(path, 1);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([10, 0]);
  });

  it("inserts correct intermediate points for one iteration", () => {
    const path: [number, number][] = [
      [0, 0],
      [4, 4],
      [8, 0],
    ];
    const result = chaikinSmooth(path, 1);
    // first point preserved: [0, 0]
    // segment 0→1: q = [0*0.75 + 4*0.25, 0*0.75 + 4*0.25] = [1, 1]
    //              r = [0*0.25 + 4*0.75, 0*0.25 + 4*0.75] = [3, 3]
    // segment 1→2: q = [4*0.75 + 8*0.25, 4*0.75 + 0*0.25] = [5, 3]
    //              r = [4*0.25 + 8*0.75, 4*0.25 + 0*0.75] = [7, 1]
    // last point preserved: [8, 0]
    expect(result).toEqual([
      [0, 0],
      [1, 1],
      [3, 3],
      [5, 3],
      [7, 1],
      [8, 0],
    ]);
  });

  it("increases point count with each iteration", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
    ];
    const r1 = chaikinSmooth(path, 1);
    const r2 = chaikinSmooth(path, 2);
    expect(r1.length).toBeGreaterThan(path.length);
    expect(r2.length).toBeGreaterThan(r1.length);
  });

  it("handles negative iterations gracefully (no-op)", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 0],
    ];
    const result = chaikinSmooth(path, -1);
    expect(result).toEqual(path);
  });

  it("handles collinear points", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
    ];
    const result = chaikinSmooth(path, 1);
    expect(result[0]).toEqual([0, 0]);
    expect(result[result.length - 1]).toEqual([2, 2]);
    for (const [x, y] of result) {
      expect(x).toBeCloseTo(y);
    }
  });
});
