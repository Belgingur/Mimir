import { describe, it, expect } from "vitest";
import { expandLandMask, downsampleMask } from "../src/lib/waveContourUtils";

describe("expandLandMask", () => {
  it("returns original mask when bufferPx is 0", () => {
    const mask = new Uint8Array([1, 0, 0, 0]);
    const result = expandLandMask(mask, 2, 2, 0);
    expect(result).toBe(mask);
  });

  it("returns original mask when bufferPx is negative", () => {
    const mask = new Uint8Array([0, 1, 0, 0]);
    const result = expandLandMask(mask, 2, 2, -1);
    expect(result).toBe(mask);
  });

  it("expands a single land pixel by 1 in all directions", () => {
    // 5x5 grid, single land pixel at center (2,2)
    const mask = new Uint8Array(25);
    mask[2 * 5 + 2] = 1; // center
    const result = expandLandMask(mask, 5, 5, 1);
    // center and all 8 neighbors should be 1
    expect(result[1 * 5 + 1]).toBe(1); // top-left
    expect(result[1 * 5 + 2]).toBe(1); // top
    expect(result[1 * 5 + 3]).toBe(1); // top-right
    expect(result[2 * 5 + 1]).toBe(1); // left
    expect(result[2 * 5 + 2]).toBe(1); // center
    expect(result[2 * 5 + 3]).toBe(1); // right
    expect(result[3 * 5 + 1]).toBe(1); // bottom-left
    expect(result[3 * 5 + 2]).toBe(1); // bottom
    expect(result[3 * 5 + 3]).toBe(1); // bottom-right
    // corners should remain 0
    expect(result[0 * 5 + 0]).toBe(0);
    expect(result[0 * 5 + 4]).toBe(0);
    expect(result[4 * 5 + 0]).toBe(0);
    expect(result[4 * 5 + 4]).toBe(0);
  });

  it("expands corner pixel, clamped to grid bounds", () => {
    // 3x3, land at (0,0)
    const mask = new Uint8Array(9);
    mask[0] = 1;
    const result = expandLandMask(mask, 3, 3, 1);
    // (0,0), (0,1), (1,0), (1,1) should be 1
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(1);
    expect(result[3]).toBe(1);
    expect(result[4]).toBe(1);
    // far corners should be 0
    expect(result[2]).toBe(0); // (0,2)
    expect(result[6]).toBe(0); // (2,0)
    expect(result[8]).toBe(0); // (2,2)
  });

  it("expands with buffer 2", () => {
    // 5x5, land at center (2,2)
    const mask = new Uint8Array(25);
    mask[2 * 5 + 2] = 1;
    const result = expandLandMask(mask, 5, 5, 2);
    // entire grid should be covered since buffer=2 from center reaches all corners
    for (let i = 0; i < 25; i++) {
      expect(result[i]).toBe(1);
    }
  });

  it("handles all-zero mask", () => {
    const mask = new Uint8Array(9);
    const result = expandLandMask(mask, 3, 3, 2);
    for (let i = 0; i < 9; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it("handles all-ones mask", () => {
    const mask = new Uint8Array(4).fill(1);
    const result = expandLandMask(mask, 2, 2, 1);
    for (let i = 0; i < 4; i++) {
      expect(result[i]).toBe(1);
    }
  });

  it("handles 1x1 grid", () => {
    const mask = new Uint8Array([1]);
    const result = expandLandMask(mask, 1, 1, 5);
    expect(result[0]).toBe(1);
  });
});

describe("downsampleMask", () => {
  it("returns original when factor <= 1", () => {
    const mask = new Uint8Array([1, 0, 0, 1]);
    const result = downsampleMask(mask, 2, 2, 1);
    expect(result.mask).toBe(mask);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it("returns original when factor is 0", () => {
    const mask = new Uint8Array([1]);
    const result = downsampleMask(mask, 1, 1, 0);
    expect(result.mask).toBe(mask);
  });

  it("downsamples 4x4 to 2x2 — any-hit wins", () => {
    // 4x4 grid, only one pixel set in top-left block
    const mask = new Uint8Array(16);
    mask[0] = 1; // (0,0) → in block (0,0)
    const result = downsampleMask(mask, 4, 4, 2);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.mask[0]).toBe(1); // top-left block has a hit
    expect(result.mask[1]).toBe(0);
    expect(result.mask[2]).toBe(0);
    expect(result.mask[3]).toBe(0);
  });

  it("any hit in block propagates to downsampled cell", () => {
    // 4x4, bottom-right pixel of bottom-right block
    const mask = new Uint8Array(16);
    mask[15] = 1; // (3,3) → block (1,1)
    const result = downsampleMask(mask, 4, 4, 2);
    expect(result.mask[3]).toBe(1); // bottom-right cell
    expect(result.mask[0]).toBe(0);
    expect(result.mask[1]).toBe(0);
    expect(result.mask[2]).toBe(0);
  });

  it("handles large factor that exceeds grid", () => {
    const mask = new Uint8Array([0, 1, 1, 0]);
    const result = downsampleMask(mask, 2, 2, 10);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.mask[0]).toBe(1); // any hit
  });

  it("handles all-zero mask", () => {
    const mask = new Uint8Array(16);
    const result = downsampleMask(mask, 4, 4, 2);
    for (let i = 0; i < result.mask.length; i++) {
      expect(result.mask[i]).toBe(0);
    }
  });

  it("handles non-square grid", () => {
    // 6x2, factor 3 → 2x1
    const mask = new Uint8Array(12);
    mask[5] = 1; // (5,0) → block (1,0)
    const result = downsampleMask(mask, 6, 2, 3);
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.mask[0]).toBe(0);
    expect(result.mask[1]).toBe(1);
  });

  it("handles 1x1 grid", () => {
    const mask = new Uint8Array([1]);
    const result = downsampleMask(mask, 1, 1, 2);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.mask[0]).toBe(1);
  });
});
