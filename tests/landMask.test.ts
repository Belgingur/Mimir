import { describe, it, expect } from "vitest";
import { expandLandMask, applyLandMask } from "../src/lib/landMask";

describe("expandLandMask", () => {
  it("returns original mask when bufferPx <= 0", () => {
    const mask = new Uint8Array([1, 0, 0, 0]);
    expect(expandLandMask(mask, 2, 2, 0)).toBe(mask);
    expect(expandLandMask(mask, 2, 2, -1)).toBe(mask);
  });

  it("expands single pixel by 1", () => {
    // 3x3 grid, center pixel is land
    const mask = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const result = expandLandMask(mask, 3, 3, 1);
    expect(Array.from(result)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("expands corner pixel by 1", () => {
    const mask = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = expandLandMask(mask, 3, 3, 1);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(1);
    expect(result[3]).toBe(1);
    expect(result[4]).toBe(1);
    expect(result[8]).toBe(0);
  });

  it("does not expand beyond grid boundaries", () => {
    const mask = new Uint8Array([1]);
    const result = expandLandMask(mask, 1, 1, 5);
    expect(result[0]).toBe(1);
    expect(result.length).toBe(1);
  });
});

describe("applyLandMask", () => {
  it("sets masked pixels to NaN", () => {
    const image = { data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 };
    const mask = new Uint8Array([1, 0, 0, 1]);
    const result = applyLandMask(image, mask);
    expect(Number.isNaN(result.data[0])).toBe(true);
    expect(result.data[1]).toBe(2);
    expect(result.data[2]).toBe(3);
    expect(Number.isNaN(result.data[3])).toBe(true);
  });

  it("applies buffer expansion before masking", () => {
    const image = { data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 };
    const mask = new Uint8Array([1, 0, 0, 0]);
    const result = applyLandMask(image, mask, 1);
    expect(Number.isNaN(result.data[0])).toBe(true);
    expect(Number.isNaN(result.data[1])).toBe(true);
    expect(Number.isNaN(result.data[2])).toBe(true);
    expect(Number.isNaN(result.data[3])).toBe(true);
  });

  it("preserves all values when mask is empty", () => {
    const image = { data: new Float32Array([5, 10, 15]), width: 3, height: 1 };
    const mask = new Uint8Array([0, 0, 0]);
    const result = applyLandMask(image, mask);
    expect(Array.from(result.data)).toEqual([5, 10, 15]);
  });

  it("does not mutate original image", () => {
    const original = new Float32Array([1, 2]);
    const image = { data: original, width: 2, height: 1 };
    const mask = new Uint8Array([1, 1]);
    applyLandMask(image, mask);
    expect(original[0]).toBe(1);
    expect(original[1]).toBe(2);
  });
});
