import { describe, it, expect } from "vitest";
import {
  buildInhouseWindLines,
  buildInhouseWaveArrows,
} from "../src/lib/inhouseWindArrows";
import type { InhouseLayer, InhouseManifest } from "../src/lib/inhouseTypes";

const makeManifest = (
  overrides: Partial<InhouseManifest> = {},
): InhouseManifest => ({
  bounds: [0, 0, 20, 20],
  shape: { width: 3, height: 3 },
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

describe("buildInhouseWindLines", () => {
  it("returns empty array when speedLayer.scalar is null", () => {
    const speed = makeLayer({ scalar: null });
    const dir = makeLayer({
      scalar: { data: new Float32Array([0]), width: 1, height: 1 },
    });
    expect(buildInhouseWindLines(speed, dir)).toEqual([]);
  });

  it("returns empty array when dirLayer.scalar is null", () => {
    const speed = makeLayer({
      scalar: { data: new Float32Array([10]), width: 1, height: 1 },
    });
    const dir = makeLayer({ scalar: null });
    expect(buildInhouseWindLines(speed, dir)).toEqual([]);
  });

  it("produces 3 line segments per valid grid point (shaft + 2 arrowhead)", () => {
    const data = new Float32Array([10]);
    const manifest = makeManifest({ bounds: [0, 0, 1, 1] });
    const speed = makeLayer({
      manifest,
      scalar: { data, width: 1, height: 1 },
    });
    const dirData = new Float32Array([180]);
    const dir = makeLayer({
      manifest,
      scalar: { data: dirData, width: 1, height: 1 },
    });
    const lines = buildInhouseWindLines(speed, dir, 1);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length % 3).toBe(0);
  });

  it("skips grid points with NaN speed", () => {
    const manifest = makeManifest({ bounds: [0, 0, 1, 1] });
    const speed = makeLayer({
      manifest,
      scalar: { data: new Float32Array([NaN]), width: 1, height: 1 },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: new Float32Array([90]), width: 1, height: 1 },
    });
    const lines = buildInhouseWindLines(speed, dir, 1);
    expect(lines).toHaveLength(0);
  });

  it("uses stepDegrees to control sampling density", () => {
    const w = 11;
    const h = 11;
    const data = new Float32Array(w * h).fill(10);
    const dirData = new Float32Array(w * h).fill(180);
    const manifest = makeManifest({
      bounds: [0, 0, 10, 10],
      shape: { width: w, height: h },
    });
    const speed = makeLayer({
      manifest,
      scalar: { data, width: w, height: h },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: dirData, width: w, height: h },
    });

    const linesStep5 = buildInhouseWindLines(speed, dir, 5);
    const linesStep10 = buildInhouseWindLines(speed, dir, 10);
    expect(linesStep5.length).toBeGreaterThan(linesStep10.length);
  });

  it("line segments have source and target as [lon, lat] tuples", () => {
    const manifest = makeManifest({ bounds: [0, 0, 1, 1] });
    const speed = makeLayer({
      manifest,
      scalar: { data: new Float32Array([15]), width: 1, height: 1 },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: new Float32Array([0]), width: 1, height: 1 },
    });
    const lines = buildInhouseWindLines(speed, dir, 1);
    for (const line of lines) {
      expect(line.source).toHaveLength(2);
      expect(line.target).toHaveLength(2);
      expect(typeof line.source[0]).toBe("number");
      expect(typeof line.target[1]).toBe("number");
    }
  });
});

describe("buildInhouseWaveArrows", () => {
  it("returns empty array when periodLayer.scalar is null", () => {
    const period = makeLayer({ scalar: null });
    const dir = makeLayer({
      scalar: { data: new Float32Array([0]), width: 1, height: 1 },
    });
    expect(buildInhouseWaveArrows(period, dir)).toEqual([]);
  });

  it("returns empty array when dirLayer.scalar is null", () => {
    const period = makeLayer({
      scalar: { data: new Float32Array([8]), width: 1, height: 1 },
    });
    const dir = makeLayer({ scalar: null });
    expect(buildInhouseWaveArrows(period, dir)).toEqual([]);
  });

  it("produces 3 line segments per valid grid point", () => {
    const manifest = makeManifest({ bounds: [0, 0, 1, 1] });
    const period = makeLayer({
      manifest,
      scalar: { data: new Float32Array([8]), width: 1, height: 1 },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: new Float32Array([270]), width: 1, height: 1 },
    });
    const lines = buildInhouseWaveArrows(period, dir, 1);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length % 3).toBe(0);
  });

  it("skips grid points with NaN period", () => {
    const manifest = makeManifest({ bounds: [0, 0, 1, 1] });
    const period = makeLayer({
      manifest,
      scalar: { data: new Float32Array([NaN]), width: 1, height: 1 },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: new Float32Array([90]), width: 1, height: 1 },
    });
    const lines = buildInhouseWaveArrows(period, dir, 1);
    expect(lines).toHaveLength(0);
  });

  it("default stepDegrees is 8", () => {
    const w = 17;
    const h = 17;
    const data = new Float32Array(w * h).fill(10);
    const dirData = new Float32Array(w * h).fill(180);
    const manifest = makeManifest({
      bounds: [0, 0, 16, 16],
      shape: { width: w, height: h },
    });
    const period = makeLayer({
      manifest,
      scalar: { data, width: w, height: h },
    });
    const dir = makeLayer({
      manifest,
      scalar: { data: dirData, width: w, height: h },
    });

    const linesDefault = buildInhouseWaveArrows(period, dir);
    const linesExplicit8 = buildInhouseWaveArrows(period, dir, 8);
    expect(linesDefault.length).toBe(linesExplicit8.length);
  });
});
