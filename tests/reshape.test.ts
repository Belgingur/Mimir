import { describe, it, expect } from "vitest";
import { reshape } from "../src/lib/reshape";

describe("reshape", () => {
  it("reshapes a 2x2 flat array into 2 rows", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const result = reshape(data, 2, 2);
    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("reshapes a 3x2 grid correctly", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6]);
    const result = reshape(data, 3, 2);
    expect(result).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it("replaces NaN with 0", () => {
    const data = new Float32Array([NaN, 1, 2, NaN]);
    const result = reshape(data, 2, 2);
    expect(result).toEqual([
      [0, 1],
      [2, 0],
    ]);
  });

  it("replaces Infinity with 0", () => {
    const data = new Float32Array([Infinity, -Infinity, 1, 2]);
    const result = reshape(data, 2, 2);
    expect(result).toEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it("handles 1x1 grid", () => {
    const data = new Float32Array([42]);
    const result = reshape(data, 1, 1);
    expect(result).toEqual([[42]]);
  });

  it("handles single row", () => {
    const data = new Float32Array([1, 2, 3, 4, 5]);
    const result = reshape(data, 5, 1);
    expect(result).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("handles single column", () => {
    const data = new Float32Array([10, 20, 30]);
    const result = reshape(data, 1, 3);
    expect(result).toEqual([[10], [20], [30]]);
  });

  it("preserves negative values", () => {
    const data = new Float32Array([-5, -10, 0, 5]);
    const result = reshape(data, 2, 2);
    expect(result).toEqual([
      [-5, -10],
      [0, 5],
    ]);
  });

  it("preserves very small floating point values", () => {
    const data = new Float32Array([1e-38, 0, -1e-38, 0]);
    const result = reshape(data, 2, 2);
    expect(result[0][0]).toBeCloseTo(1e-38);
    expect(result[1][0]).toBeCloseTo(-1e-38);
  });

  it("returns correct dimensions", () => {
    const data = new Float32Array(100);
    const result = reshape(data, 10, 10);
    expect(result.length).toBe(10);
    for (const row of result) {
      expect(row.length).toBe(10);
    }
  });
});
