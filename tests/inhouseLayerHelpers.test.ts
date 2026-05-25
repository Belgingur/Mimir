import { describe, it, expect } from "vitest";
import {
  tempMinC,
  tempMaxC,
  normalizeTemperatureUnscale,
  getInhouseLayerUnscale,
  getInhouseLayerBounds,
  ensureScalar,
} from "../src/lib/inhouseLayerHelpers";
import type { InhouseLayer } from "../src/lib/inhouseTypes";

const makeLayer = (overrides: Partial<InhouseLayer> = {}): InhouseLayer =>
  ({
    variable: "wind_speed",
    manifest: {
      bounds: [-10, 50, 30, 70] as [number, number, number, number],
      shape: { width: 100, height: 80 },
      imageUnscale: [0, 30] as [number, number],
      srcMin: 0,
      srcMax: 30,
    },
    image: null,
    rasterScalar: null,
    scalar: null,
    domainMask: null,
    ...overrides,
  }) as unknown as InhouseLayer;

describe("tempMinC / tempMaxC", () => {
  it("tempMinC is -30", () => {
    expect(tempMinC).toBe(-30);
  });
  it("tempMaxC is 40", () => {
    expect(tempMaxC).toBe(40);
  });
});

describe("normalizeTemperatureUnscale", () => {
  it("returns fallback for null input", () => {
    expect(normalizeTemperatureUnscale(null)).toEqual([-30, 40]);
  });

  it("returns fallback for undefined input", () => {
    expect(normalizeTemperatureUnscale(undefined)).toEqual([-30, 40]);
  });

  it("converts Kelvin range (max > 100) to Celsius", () => {
    const result = normalizeTemperatureUnscale([223.15, 313.15]);
    expect(result[0]).toBeCloseTo(-50, 2);
    expect(result[1]).toBeCloseTo(40, 2);
  });

  it("passes through Celsius range (max <= 100)", () => {
    expect(normalizeTemperatureUnscale([-30, 40])).toEqual([-30, 40]);
  });

  it("passes through range at boundary max = 100", () => {
    expect(normalizeTemperatureUnscale([-20, 100])).toEqual([-20, 100]);
  });
});

describe("getInhouseLayerUnscale", () => {
  it("returns imageUnscale from manifest", () => {
    const layer = makeLayer();
    expect(getInhouseLayerUnscale(layer)).toEqual([0, 30]);
  });

  it("falls back to srcMin/srcMax when imageUnscale is missing", () => {
    const layer = makeLayer({
      manifest: {
        bounds: [-10, 50, 30, 70],
        shape: { width: 100, height: 80 },
        imageUnscale: undefined,
        srcMin: -5,
        srcMax: 45,
      } as any,
    });
    expect(getInhouseLayerUnscale(layer)).toEqual([-5, 45]);
  });

  it("applies Kelvin normalization for air_temperature_at_2m_agl", () => {
    const layer = makeLayer({
      variable: "air_temperature_at_2m_agl",
      manifest: {
        bounds: [-10, 50, 30, 70],
        shape: { width: 100, height: 80 },
        imageUnscale: [223.15, 313.15],
        srcMin: 223.15,
        srcMax: 313.15,
      } as any,
    });
    const result = getInhouseLayerUnscale(layer);
    expect(result[0]).toBeCloseTo(-50, 2);
    expect(result[1]).toBeCloseTo(40, 2);
  });

  it("does not convert temperature if already in Celsius", () => {
    const layer = makeLayer({
      variable: "air_temperature_at_2m_agl",
      manifest: {
        bounds: [-10, 50, 30, 70],
        shape: { width: 100, height: 80 },
        imageUnscale: [-30, 40],
        srcMin: -30,
        srcMax: 40,
      } as any,
    });
    expect(getInhouseLayerUnscale(layer)).toEqual([-30, 40]);
  });
});

describe("getInhouseLayerBounds", () => {
  it("returns manifest bounds when image matches source width", () => {
    const layer = makeLayer();
    expect(getInhouseLayerBounds(layer)).toEqual([-10, 50, 30, 70]);
  });

  it("returns manifest bounds when no image is present", () => {
    const layer = makeLayer({ image: null });
    expect(getInhouseLayerBounds(layer)).toEqual([-10, 50, 30, 70]);
  });

  it("expands bounds when image is wider than source (padding)", () => {
    const layer = makeLayer({
      image: { width: 104, widthMeta: 100 } as any,
      manifest: {
        bounds: [0, 0, 99, 10] as [number, number, number, number],
        shape: { width: 100, height: 80 },
        imageUnscale: [0, 30],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    const result = getInhouseLayerBounds(layer);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[3]).toBe(10);
    expect(result[2]).toBeGreaterThan(99);
  });

  it("handles array shape format", () => {
    const layer = makeLayer({
      manifest: {
        bounds: [-180, -90, 180, 90] as [number, number, number, number],
        shape: [360, 180] as any,
        imageUnscale: [0, 30],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    expect(getInhouseLayerBounds(layer)).toEqual([-180, -90, 180, 90]);
  });
});

describe("ensureScalar", () => {
  it("does nothing if layer already has scalar", () => {
    const existingScalar = {
      data: new Float32Array([1, 2, 3]),
      width: 3,
      height: 1,
    };
    const layer = makeLayer({ scalar: existingScalar } as any);
    ensureScalar(layer);
    expect(layer.scalar).toBe(existingScalar);
  });

  it("does nothing if image is null", () => {
    const layer = makeLayer({ image: null });
    ensureScalar(layer);
    expect(layer.scalar).toBeNull();
  });

  it("does nothing if image is a Promise", () => {
    const layer = makeLayer({ image: Promise.resolve({}) } as any);
    ensureScalar(layer);
    expect(layer.scalar).toBeNull();
  });

  it("decodes scalar from image when scalar is null", () => {
    const fakeImage = {
      width: 2,
      height: 2,
      data: new Uint8Array([
        128, 0, 0, 255, 64, 0, 0, 255, 192, 0, 0, 255, 255, 0, 0, 255,
      ]),
    };
    const layer = makeLayer({
      image: fakeImage as any,
      manifest: {
        bounds: [0, 0, 10, 10] as [number, number, number, number],
        shape: { width: 2, height: 2 },
        imageUnscale: [0, 30] as [number, number],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    ensureScalar(layer);
    expect(layer.scalar).not.toBeNull();
    expect(layer.scalar!.data).toBeInstanceOf(Float32Array);
  });

  it("applies domainMask when present", () => {
    const fakeImage = {
      width: 2,
      height: 2,
      data: new Uint8Array([
        128, 0, 0, 255, 64, 0, 0, 255, 192, 0, 0, 255, 255, 0, 0, 255,
      ]),
    };
    const domainMask = new Uint8Array([1, 0, 1, 0]);
    const layer = makeLayer({
      image: fakeImage as any,
      domainMask: domainMask as any,
      manifest: {
        bounds: [0, 0, 10, 10] as [number, number, number, number],
        shape: { width: 2, height: 2 },
        imageUnscale: [0, 30] as [number, number],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    ensureScalar(layer);
    expect(layer.scalar).not.toBeNull();
    expect(Number.isNaN(layer.scalar!.data[1])).toBe(true);
    expect(Number.isNaN(layer.scalar!.data[3])).toBe(true);
    expect(Number.isFinite(layer.scalar!.data[0])).toBe(true);
  });

  it("handles shape as array format in getInhouseLayerBounds", () => {
    const layer = makeLayer({
      image: { width: 100, widthMeta: 100 } as any,
      manifest: {
        bounds: [-180, -90, 180, 90] as [number, number, number, number],
        shape: [100, 50] as any,
        imageUnscale: [0, 30],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    expect(getInhouseLayerBounds(layer)).toEqual([-180, -90, 180, 90]);
  });

  it("falls back to rasterScalar widthMeta when image widthMeta is missing", () => {
    const layer = makeLayer({
      image: { width: 104 } as any,
      rasterScalar: { widthMeta: 100 } as any,
      manifest: {
        bounds: [0, 0, 99, 10] as [number, number, number, number],
        shape: { width: 100, height: 80 },
        imageUnscale: [0, 30],
        srcMin: 0,
        srcMax: 30,
      } as any,
    });
    const result = getInhouseLayerBounds(layer);
    expect(result[2]).toBeGreaterThan(99);
  });
});
