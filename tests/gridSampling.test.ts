import { describe, it, expect } from "vitest";
import {
  sampleScalarGridAtCoord,
  sampleInhouseScalarAtCoord,
  sampleInhouseRasterAtCoord,
} from "../src/lib/gridSampling";
import type { InhouseLayer, InhouseManifest } from "../src/lib/inhouseTypes";

const makeManifest = (
  overrides: Partial<InhouseManifest> = {},
): InhouseManifest => ({
  bounds: [0, 0, 10, 10],
  shape: { width: 4, height: 4 },
  srcMin: 0,
  srcMax: 100,
  fileTemplate: "",
  count: 1,
  analysisTime: "2026-01-01T00:00:00Z",
  historyIntervalMinutes: 60,
  ...overrides,
});

const makeLayer = (overrides: Partial<InhouseLayer> = {}): InhouseLayer => ({
  id: "test",
  model: "test-model",
  analysis: "2026-01-01_00",
  variable: "wind_speed",
  manifest: makeManifest(),
  times: [],
  visible: true,
  image: null,
  scalar: null,
  rasterScalar: null,
  renderMode: "raster",
  ...overrides,
});

describe("sampleScalarGridAtCoord", () => {
  it("returns value at grid center", () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const grid = { data, width: 3, height: 3 };
    const bounds: [number, number, number, number] = [0, 0, 10, 10];
    const result = sampleScalarGridAtCoord(grid, bounds, [5, 5]);
    expect(result).toBe(5);
  });

  it("returns value at top-left corner", () => {
    const data = new Float32Array([10, 20, 30, 40]);
    const grid = { data, width: 2, height: 2 };
    const bounds: [number, number, number, number] = [0, 0, 10, 10];
    const result = sampleScalarGridAtCoord(grid, bounds, [0, 10]);
    expect(result).toBe(10);
  });

  it("returns value at bottom-right corner", () => {
    const data = new Float32Array([10, 20, 30, 40]);
    const grid = { data, width: 2, height: 2 };
    const bounds: [number, number, number, number] = [0, 0, 10, 10];
    const result = sampleScalarGridAtCoord(grid, bounds, [10, 0]);
    expect(result).toBe(40);
  });

  it("returns null for zero-span bounds", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const grid = { data, width: 2, height: 2 };
    expect(sampleScalarGridAtCoord(grid, [5, 5, 5, 10], [5, 7])).toBeNull();
    expect(sampleScalarGridAtCoord(grid, [0, 5, 10, 5], [5, 5])).toBeNull();
  });

  it("returns null for NaN in grid", () => {
    const data = new Float32Array([NaN]);
    const grid = { data, width: 1, height: 1 };
    expect(sampleScalarGridAtCoord(grid, [0, 0, 10, 10], [5, 5])).toBeNull();
  });

  it("returns null for Infinity in grid", () => {
    const data = new Float32Array([Infinity]);
    const grid = { data, width: 1, height: 1 };
    expect(sampleScalarGridAtCoord(grid, [0, 0, 10, 10], [5, 5])).toBeNull();
  });

  it("clamps coordinates outside bounds", () => {
    const data = new Float32Array([42]);
    const grid = { data, width: 1, height: 1 };
    expect(sampleScalarGridAtCoord(grid, [0, 0, 10, 10], [-5, 15])).toBe(42);
  });
});

describe("sampleInhouseScalarAtCoord", () => {
  it("returns null when scalar is null", () => {
    const layer = makeLayer({ scalar: null });
    expect(
      sampleInhouseScalarAtCoord(layer, [5, 5], [0, 0, 10, 10]),
    ).toBeNull();
  });

  it("samples scalar data correctly", () => {
    const data = new Float32Array([10, 20, 30, 40]);
    const layer = makeLayer({ scalar: { data, width: 2, height: 2 } });
    const result = sampleInhouseScalarAtCoord(layer, [0, 10], [0, 0, 10, 10]);
    expect(result).toBe(10);
  });

  it("returns null for zero-span bounds", () => {
    const data = new Float32Array([10]);
    const layer = makeLayer({ scalar: { data, width: 1, height: 1 } });
    expect(sampleInhouseScalarAtCoord(layer, [5, 5], [5, 5, 5, 10])).toBeNull();
  });

  it("returns null for non-finite scalar value", () => {
    const data = new Float32Array([NaN]);
    const layer = makeLayer({ scalar: { data, width: 1, height: 1 } });
    expect(
      sampleInhouseScalarAtCoord(layer, [5, 5], [0, 0, 10, 10]),
    ).toBeNull();
  });
});

describe("sampleInhouseRasterAtCoord", () => {
  it("returns null when rasterScalar is null", () => {
    const layer = makeLayer({ rasterScalar: null });
    expect(
      sampleInhouseRasterAtCoord(layer, [5, 5], [0, 0, 10, 10]),
    ).toBeNull();
  });

  it("samples raster data correctly", () => {
    const data = new Uint8Array([100, 150, 200, 250]);
    const layer = makeLayer({ rasterScalar: { data, width: 2, height: 2 } });
    const result = sampleInhouseRasterAtCoord(layer, [0, 10], [0, 0, 10, 10]);
    expect(result).toBe(100);
  });

  it("uses widthMeta for logical width when present", () => {
    const data = new Uint8Array([10, 20, 0, 0, 30, 40, 0, 0]);
    const layer = makeLayer({
      rasterScalar: { data, width: 4, height: 2, widthMeta: 2 },
    });
    const result = sampleInhouseRasterAtCoord(layer, [10, 10], [0, 0, 10, 10]);
    expect(result).toBe(20);
  });

  it("returns null when domain mask blocks the sample", () => {
    const data = new Uint8Array([100]);
    const domainMask = new Uint8Array([0]);
    const layer = makeLayer({
      rasterScalar: { data, width: 1, height: 1 },
      domainMask,
      domainMaskOn: 1,
    });
    expect(
      sampleInhouseRasterAtCoord(layer, [5, 5], [0, 0, 10, 10]),
    ).toBeNull();
  });

  it("returns value when domain mask allows the sample", () => {
    const data = new Uint8Array([100]);
    const domainMask = new Uint8Array([1]);
    const layer = makeLayer({
      rasterScalar: { data, width: 1, height: 1 },
      domainMask,
      domainMaskOn: 1,
    });
    expect(sampleInhouseRasterAtCoord(layer, [5, 5], [0, 0, 10, 10])).toBe(100);
  });

  it("ignores domain mask when domainMaskOn is 0", () => {
    const data = new Uint8Array([100]);
    const domainMask = new Uint8Array([0]);
    const layer = makeLayer({
      rasterScalar: { data, width: 1, height: 1 },
      domainMask,
      domainMaskOn: 0,
    });
    expect(sampleInhouseRasterAtCoord(layer, [5, 5], [0, 0, 10, 10])).toBe(100);
  });

  it("returns null for zero-span bounds", () => {
    const data = new Uint8Array([100]);
    const layer = makeLayer({ rasterScalar: { data, width: 1, height: 1 } });
    expect(sampleInhouseRasterAtCoord(layer, [5, 5], [5, 5, 5, 10])).toBeNull();
  });
});
