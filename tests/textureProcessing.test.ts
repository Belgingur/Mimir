import { describe, expect, it } from "vitest";
import { processTexturePixels } from "../src/lib/textureProcessing";

/** Build an RGBA Uint8Array from [r,g,b,a] pixel tuples. */
function rgba(pixels: [number, number, number, number][]): Uint8Array {
  const out = new Uint8Array(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  });
  return out;
}

describe("processTexturePixels", () => {
  it("counts opaque pixels and computes the red-channel range", () => {
    const data = rgba([
      [10, 0, 0, 255],
      [200, 0, 0, 255],
      [50, 0, 0, 255],
    ]);
    const out = processTexturePixels(data, 3, 1);
    expect(out.alphaOn).toBe(3);
    expect(out.alphaOff).toBe(0);
    expect(out.rawRange).toEqual([10, 200]);
  });

  it("zeroes RGB of fully-transparent pixels and excludes them from the range", () => {
    const data = rgba([
      [10, 20, 30, 0], // fully transparent → rgb zeroed, excluded from range
      [200, 0, 0, 255],
    ]);
    const out = processTexturePixels(data, 2, 1);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([0, 0, 0]);
    expect(out.alphaOn).toBe(1);
    expect(out.alphaOff).toBe(1);
    expect(out.rawRange).toEqual([200, 200]);
  });

  it("promotes partial alpha to fully opaque", () => {
    const data = rgba([[123, 0, 0, 128]]);
    const out = processTexturePixels(data, 1, 1);
    expect(out.data[3]).toBe(255);
    expect(out.alphaOn).toBe(1);
  });

  it("treats an all-transparent-but-coloured image as fully opaque (ignoreAlpha)", () => {
    // No fully-opaque and no partial-alpha pixels, but red > 0 → ignore alpha.
    const data = rgba([
      [40, 0, 0, 0],
      [90, 0, 0, 0],
    ]);
    const out = processTexturePixels(data, 2, 1);
    expect(out.alphaOn).toBe(2);
    expect(out.alphaOff).toBe(0);
    expect(out.rawRange).toEqual([40, 90]);
    expect(out.data[3]).toBe(255);
  });
});
