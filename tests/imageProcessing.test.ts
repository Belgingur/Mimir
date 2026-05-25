import { describe, it, expect } from "vitest";
import {
  normalizeScalarImage,
  expandBounds,
  decodeScalarGrid,
  padFloatGridToWidthMultipleOf4,
  maybeConvertToHpa,
  buildMslpThresholds,
  cropScalarImageToBounds,
  clampScalarImage,
  normalizeVectorImage,
  decodeVectorComponents,
  quantizeFloatToUint8,
  getScalarRange,
  vectorToSpeedImage,
  vectorToSpeedImageSigned,
  getSpeedRange,
} from "../src/lib/imageProcessing";

describe("normalizeScalarImage", () => {
  it("returns unchanged for single-band image", () => {
    const image = { data: new Uint8Array([10, 20, 30]), width: 3, height: 1 };
    const result = normalizeScalarImage(image);
    expect(result.bands).toBe(1);
    expect(result.image).toBe(image);
  });

  it("extracts first band from 4-band image", () => {
    const data = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    const result = normalizeScalarImage({ data, width: 2, height: 1 });
    expect(result.bands).toBe(4);
    expect(result.image.data).toEqual(new Uint8Array([10, 40]));
  });

  it("returns unchanged for 2-band image", () => {
    const image = {
      data: new Uint8Array([10, 20, 30, 40]),
      width: 2,
      height: 1,
    };
    const result = normalizeScalarImage(image);
    expect(result.bands).toBe(2);
    expect(result.image).toBe(image);
  });
});

describe("expandBounds", () => {
  it("expands bounds by pad degrees", () => {
    expect(expandBounds([10, 20, 30, 40], 5)).toEqual([5, 15, 35, 45]);
  });

  it("clamps to world bounds", () => {
    expect(expandBounds([-175, -85, 175, 85], 10)).toEqual([
      -180, -90, 180, 90,
    ]);
  });

  it("handles zero padding", () => {
    expect(expandBounds([10, 20, 30, 40], 0)).toEqual([10, 20, 30, 40]);
  });
});

describe("decodeScalarGrid", () => {
  it("returns Float32Array data unchanged", () => {
    const data = new Float32Array([1.5, 2.5, 3.5]);
    const result = decodeScalarGrid({ data, width: 3, height: 1 }, null);
    expect(result.data).toBe(data);
  });

  it("decodes uint8 with imageUnscale", () => {
    const data = new Uint8Array([0, 128, 255]);
    const result = decodeScalarGrid({ data, width: 3, height: 1 }, [-10, 10]);
    expect(result.data[0]).toBeCloseTo(-10, 1);
    expect(result.data[1]).toBeCloseTo(0.039, 0);
    expect(result.data[2]).toBeCloseTo(10, 1);
  });

  it("decodes uint8 without imageUnscale", () => {
    const data = new Uint8Array([0, 128, 255]);
    const result = decodeScalarGrid({ data, width: 3, height: 1 }, null);
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(255);
  });
});

describe("padFloatGridToWidthMultipleOf4", () => {
  it("returns unchanged if width is already multiple of 4", () => {
    const grid = { data: new Float32Array(8), width: 4, height: 2 };
    expect(padFloatGridToWidthMultipleOf4(grid)).toBe(grid);
  });

  it("pads width 3 to width 4", () => {
    const grid = {
      data: new Float32Array([1, 2, 3, 4, 5, 6]),
      width: 3,
      height: 2,
    };
    const result = padFloatGridToWidthMultipleOf4(grid);
    expect(result.width).toBe(4);
    expect(result.height).toBe(2);
    expect(result.data[0]).toBe(1);
    expect(result.data[1]).toBe(2);
    expect(result.data[2]).toBe(3);
    expect(Number.isNaN(result.data[3])).toBe(true);
    expect(result.data[4]).toBe(4);
    expect(result.data[5]).toBe(5);
    expect(result.data[6]).toBe(6);
    expect(Number.isNaN(result.data[7])).toBe(true);
  });
});

describe("maybeConvertToHpa", () => {
  it("converts Pa to hPa when max > 2000", () => {
    const grid = {
      data: new Float32Array([101325, 100000]),
      width: 2,
      height: 1,
    };
    const result = maybeConvertToHpa(grid);
    expect(result.data[0]).toBeCloseTo(1013.25, 2);
    expect(result.data[1]).toBeCloseTo(1000, 2);
  });

  it("returns unchanged when max <= 2000", () => {
    const grid = { data: new Float32Array([1013, 1000]), width: 2, height: 1 };
    const result = maybeConvertToHpa(grid);
    expect(result).toBe(grid);
  });

  it("preserves NaN values", () => {
    const grid = { data: new Float32Array([101325, NaN]), width: 2, height: 1 };
    const result = maybeConvertToHpa(grid);
    expect(result.data[0]).toBeCloseTo(1013.25, 2);
    expect(Number.isNaN(result.data[1])).toBe(true);
  });
});

describe("buildMslpThresholds", () => {
  it("builds thresholds at step=4 within data range", () => {
    const grid = { data: new Float32Array([1000, 1020]) };
    const thresholds = buildMslpThresholds(grid);
    expect(thresholds).toEqual([1000, 1004, 1008, 1012, 1016, 1020]);
  });

  it("returns empty for all-NaN data", () => {
    const grid = { data: new Float32Array([NaN, NaN]) };
    expect(buildMslpThresholds(grid)).toEqual([]);
  });

  it("handles tight range", () => {
    const grid = { data: new Float32Array([1012, 1013]) };
    expect(buildMslpThresholds(grid)).toEqual([1012]);
  });
});

describe("cropScalarImageToBounds", () => {
  it("returns unchanged when crop covers full image", () => {
    const image = { data: new Float32Array(16), width: 4, height: 4 };
    const result = cropScalarImageToBounds(
      image,
      [-180, -90, 180, 90],
      [-180, -90, 180, 90],
    );
    expect(result.image).toBe(image);
  });

  it("crops to smaller region", () => {
    const data = new Float32Array(16);
    for (let i = 0; i < 16; i++) data[i] = i;
    const image = { data, width: 4, height: 4 };
    const result = cropScalarImageToBounds(
      image,
      [0, 0, 30, 30],
      [0, 0, 15, 15],
    );
    expect(result.image.width).toBeLessThanOrEqual(4);
    expect(result.image.height).toBeLessThanOrEqual(4);
  });
});

describe("clampScalarImage", () => {
  it("clamps values to given range", () => {
    const data = new Uint8Array([0, 128, 255]);
    const result = clampScalarImage(
      { data, width: 3, height: 1 },
      [-10, 10],
      -5,
      5,
    );
    expect(result.data.length).toBe(3);
    // raw=0 maps to -10, clamped to -5, t=0 => encoded=0
    expect(result.data[0]).toBe(0);
    // raw=128 maps to ~0.04, clamped to 0.04, t≈0.504 => encoded≈128
    expect(result.data[1]).toBeGreaterThan(100);
    expect(result.data[1]).toBeLessThan(150);
    // raw=255 maps to 10, clamped to 5, t=1 => encoded=255
    expect(result.data[2]).toBe(255);
  });

  it("preserves alpha channel for transparent pixels", () => {
    const data = new Uint8Array([128, 0, 0, 0]);
    const result = clampScalarImage(
      { data, width: 1, height: 1 },
      [-10, 10],
      -5,
      5,
    );
    expect(result.data[3]).toBe(0);
    expect(result.data[0]).toBe(0);
  });
});

describe("normalizeVectorImage", () => {
  it("fills alpha with 255 when all alpha channels are 0", () => {
    const data = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 0]);
    const result = normalizeVectorImage({ data, width: 2, height: 1 });
    const outData = result.data as Uint8Array;
    expect(outData[3]).toBe(255);
    expect(outData[7]).toBe(255);
    expect(outData[0]).toBe(10);
    expect(outData[4]).toBe(40);
  });

  it("returns unchanged when alpha has non-zero values", () => {
    const data = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    const image = { data, width: 2, height: 1 };
    expect(normalizeVectorImage(image)).toBe(image);
  });

  it("returns unchanged for non-4-band images", () => {
    const data = new Uint8Array([10, 20, 30]);
    const image = { data, width: 3, height: 1 };
    expect(normalizeVectorImage(image)).toBe(image);
  });

  it("returns unchanged for Float32Array data", () => {
    const data = new Float32Array([1, 2, 3, 0, 5, 6, 7, 0]);
    const image = { data, width: 2, height: 1 };
    expect(normalizeVectorImage(image)).toBe(image);
  });
});

describe("decodeVectorComponents", () => {
  it("decodes u/v from RGBA with imageUnscale", () => {
    const data = new Uint8Array([0, 255, 0, 255, 128, 128, 0, 255]);
    const result = decodeVectorComponents(
      { data, width: 2, height: 1 },
      [-10, 10],
    );
    expect(result.u[0]).toBeCloseTo(-10, 1);
    expect(result.v[0]).toBeCloseTo(10, 1);
    expect(result.u[1]).toBeCloseTo(0.039, 0);
  });

  it("marks transparent pixels as NaN when some alphas are non-zero", () => {
    // normalizeVectorImage only fills alpha when ALL alphas are 0
    // so mix: one transparent, one opaque
    const data = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 255]);
    const result = decodeVectorComponents(
      { data, width: 2, height: 1 },
      [-10, 10],
    );
    expect(Number.isNaN(result.u[0])).toBe(true);
    expect(Number.isNaN(result.v[0])).toBe(true);
    expect(Number.isNaN(result.u[1])).toBe(false);
  });
});

describe("quantizeFloatToUint8", () => {
  it("quantizes float values to 0-255 range", () => {
    const data = new Float32Array([0, 5, 10]);
    const result = quantizeFloatToUint8({ data, width: 3, height: 1 }, 0, 10);
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(255);
  });

  it("outputs 0 for NaN values", () => {
    const data = new Float32Array([NaN]);
    const result = quantizeFloatToUint8({ data, width: 1, height: 1 }, 0, 10);
    expect(result.data[0]).toBe(0);
  });
});

describe("getScalarRange", () => {
  it("returns imageUnscale when provided", () => {
    const result = getScalarRange(
      { data: new Uint8Array([50]), width: 1, height: 1 },
      [-10, 10],
    );
    expect(result).toEqual({ min: -10, max: 10 });
  });

  it("computes range from data when no imageUnscale", () => {
    const result = getScalarRange(
      { data: new Uint8Array([10, 50, 200]), width: 3, height: 1 },
      null,
    );
    expect(result).toEqual({ min: 10, max: 200 });
  });
});

describe("vectorToSpeedImage", () => {
  it("computes speed as hypot of u,v", () => {
    const data = new Uint8Array([0, 255, 0, 255]);
    const result = vectorToSpeedImage({ data, width: 1, height: 1 }, [-10, 10]);
    expect(result.data[0]).toBeCloseTo(Math.hypot(-10, 10), 1);
  });

  it("returns zeros for single-band input", () => {
    const data = new Uint8Array([128]);
    const result = vectorToSpeedImage({ data, width: 1, height: 1 }, null);
    expect(result.data[0]).toBe(0);
  });

  it("marks nodata pixels as NaN", () => {
    const data = new Uint8Array([128, 128, 0, 0]);
    const result = vectorToSpeedImage({ data, width: 1, height: 1 }, [-10, 10]);
    expect(Number.isNaN(result.data[0])).toBe(true);
  });
});

describe("vectorToSpeedImageSigned", () => {
  it("computes speed from signed encoding (128-offset)", () => {
    const data = new Uint8Array([128, 128, 0, 255]);
    const result = vectorToSpeedImageSigned({ data, width: 1, height: 1 });
    expect(result.data[0]).toBeCloseTo(0, 5);
  });

  it("marks nodata pixels as NaN", () => {
    const data = new Uint8Array([128, 128, 0, 0]);
    const result = vectorToSpeedImageSigned({ data, width: 1, height: 1 });
    expect(Number.isNaN(result.data[0])).toBe(true);
  });
});

describe("getSpeedRange", () => {
  it("returns {min:0,max:0} for null input", () => {
    expect(getSpeedRange(null)).toEqual({ min: 0, max: 0 });
  });

  it("computes range from float data", () => {
    const result = getSpeedRange({
      data: new Float32Array([2, 5, NaN, 10]),
      width: 4,
      height: 1,
    });
    expect(result).toEqual({ min: 2, max: 10 });
  });

  it("returns {min:0,max:0} for all-NaN data", () => {
    const result = getSpeedRange({
      data: new Float32Array([NaN, NaN]),
      width: 2,
      height: 1,
    });
    expect(result).toEqual({ min: 0, max: 0 });
  });
});
