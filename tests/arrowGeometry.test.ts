import { describe, it, expect } from "vitest";
import {
  ARROW_ICON,
  ARROW_HEAD_ICON,
  buildStreamlineArrowHeads,
  buildArrowPoints,
  buildVectorFieldTexture,
  buildWindLabelPoints,
} from "../src/lib/arrowGeometry";
import type { FeatureCollection } from "geojson";
import type { InhouseLayer } from "../src/lib/inhouseTypes";

const makeScalarLayer = (
  width: number,
  height: number,
  data: number[],
  bounds: [number, number, number, number] = [0, 0, 10, 10],
  variable = "wind_speed",
): InhouseLayer =>
  ({
    variable,
    manifest: {
      bounds,
      shape: { width, height },
      imageUnscale: [0, 100],
      srcMin: 0,
      srcMax: 100,
    },
    image: null,
    rasterScalar: null,
    scalar: { data: new Float32Array(data), width, height },
    domainMask: null,
  }) as unknown as InhouseLayer;

describe("ARROW_ICON", () => {
  it("has expected dimensions", () => {
    expect(ARROW_ICON.width).toBe(24);
    expect(ARROW_ICON.height).toBe(24);
    expect(ARROW_ICON.anchorX).toBe(12);
    expect(ARROW_ICON.anchorY).toBe(12);
    expect(ARROW_ICON.mask).toBe(true);
  });

  it("url is a data URI", () => {
    expect(ARROW_ICON.url).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("ARROW_HEAD_ICON", () => {
  it("has expected dimensions", () => {
    expect(ARROW_HEAD_ICON.width).toBe(24);
    expect(ARROW_HEAD_ICON.height).toBe(24);
    expect(ARROW_HEAD_ICON.mask).toBe(true);
  });
});

describe("buildStreamlineArrowHeads", () => {
  const makeLine = (coords: [number, number][]): FeatureCollection => ({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      },
    ],
  });

  it("returns empty for lines with fewer than 4 coordinates", () => {
    const fc = makeLine([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    const result = buildStreamlineArrowHeads(fc, "short-line-test", 16);
    expect(result).toEqual([]);
  });

  it("produces arrow points from a line with enough coordinates", () => {
    const coords: [number, number][] = [];
    for (let i = 0; i < 20; i++) coords.push([i, 0]);
    const fc = makeLine(coords);
    const result = buildStreamlineArrowHeads(fc, "long-line-test", 16);
    expect(result.length).toBeGreaterThan(0);
    for (const pt of result) {
      expect(pt).toHaveProperty("position");
      expect(pt).toHaveProperty("angle");
      expect(pt).toHaveProperty("size");
      expect(pt.size).toBe(16);
    }
  });

  it("caches results by key", () => {
    const coords: [number, number][] = [];
    for (let i = 0; i < 20; i++) coords.push([i, 0]);
    const fc = makeLine(coords);
    const key = "cache-test-streamline";
    const r1 = buildStreamlineArrowHeads(fc, key, 16);
    const r2 = buildStreamlineArrowHeads(fc, key, 16);
    expect(r1).toBe(r2);
  });

  it("skips non-LineString features", () => {
    const fc: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: {},
        },
      ],
    };
    const result = buildStreamlineArrowHeads(fc, "point-feature-test", 16);
    expect(result).toEqual([]);
  });
});

describe("buildArrowPoints", () => {
  it("builds arrow points from magnitude and direction grids", () => {
    const magLayer = makeScalarLayer(
      3,
      3,
      [5, 10, 15, 5, 10, 15, 5, 10, 15],
      [0, 0, 10, 10],
      "wind_speed",
    );
    const dirLayer = makeScalarLayer(
      3,
      3,
      [0, 90, 180, 0, 90, 180, 0, 90, 180],
      [0, 0, 10, 10],
      "wind_from_direction",
    );

    const result = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      "arrow-test-3x3",
    );
    expect(result.length).toBe(9);
    for (const pt of result) {
      expect(pt.position).toHaveLength(2);
      expect(typeof pt.angle).toBe("number");
      expect(pt.size).toBeGreaterThanOrEqual(5);
      expect(pt.size).toBeLessThanOrEqual(32);
    }
  });

  it("returns empty array when bounds have zero span", () => {
    const magLayer = makeScalarLayer(2, 2, [5, 5, 5, 5], [5, 5, 5, 5]);
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0], [5, 5, 5, 5]);
    const result = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [5, 5, 5, 5],
      1,
      8,
      32,
      "zero-span-test",
    );
    expect(result).toEqual([]);
  });

  it("returns empty when dimension mismatch", () => {
    const magLayer = makeScalarLayer(3, 3, [5, 5, 5, 5, 5, 5, 5, 5, 5]);
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0]);
    const result = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      "mismatch-test",
    );
    expect(result).toEqual([]);
  });

  it("skips NaN values", () => {
    const magLayer = makeScalarLayer(2, 2, [5, NaN, 10, 5], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 2, [90, 90, 90, NaN], [0, 0, 10, 10]);
    const result = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      "nan-skip-test",
    );
    expect(result).toHaveLength(2);
  });

  it("uses magnitudeMin/magnitudeMax for size mapping when provided", () => {
    const magLayer = makeScalarLayer(2, 1, [5, 20], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 1, [0, 0], [0, 0, 10, 10]);
    const result = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      "mag-range-test",
      0,
      30,
    );
    expect(result).toHaveLength(2);
    expect(result[0].size).toBeLessThan(result[1].size);
  });

  it("caches result by key", () => {
    const magLayer = makeScalarLayer(2, 2, [5, 5, 5, 5], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0], [0, 0, 10, 10]);
    const key = "cache-arrow-test";
    const r1 = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      key,
    );
    const r2 = buildArrowPoints(
      magLayer,
      dirLayer,
      false,
      [0, 0, 10, 10],
      1,
      8,
      32,
      key,
    );
    expect(r1).toBe(r2);
  });
});

describe("buildVectorFieldTexture", () => {
  it("builds packed RGBA texture from mag + dir grids", () => {
    const magLayer = makeScalarLayer(2, 2, [10, 10, 10, 10], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 2, [0, 90, 180, 270], [0, 0, 10, 10]);
    const result = buildVectorFieldTexture(
      magLayer,
      dirLayer,
      false,
      "vft-test-2x2",
    );
    expect(result).not.toBeNull();
    expect(result!.texture.width).toBe(2);
    expect(result!.texture.height).toBe(2);
    expect(result!.texture.data).toBeInstanceOf(Uint8Array);
    expect(result!.texture.data.length).toBe(2 * 2 * 4);
    expect(result!.unscale).toHaveLength(2);
    expect(result!.maxMagnitude).toBeGreaterThan(0);
  });

  it("returns null when scalar is missing", () => {
    const magLayer = makeScalarLayer(2, 2, [5, 5, 5, 5]);
    magLayer.scalar = null;
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0]);
    const result = buildVectorFieldTexture(
      magLayer,
      dirLayer,
      false,
      "vft-null-test",
    );
    expect(result).toBeNull();
  });

  it("returns null on dimension mismatch", () => {
    const magLayer = makeScalarLayer(3, 3, Array(9).fill(5));
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0]);
    const result = buildVectorFieldTexture(
      magLayer,
      dirLayer,
      false,
      "vft-mismatch-test",
    );
    expect(result).toBeNull();
  });

  it("sets alpha to 0 for NaN pixels", () => {
    const magLayer = makeScalarLayer(2, 1, [10, NaN], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 1, [0, 0], [0, 0, 10, 10]);
    const result = buildVectorFieldTexture(
      magLayer,
      dirLayer,
      false,
      "vft-nan-test",
    );
    expect(result).not.toBeNull();
    const data = result!.texture.data as Uint8Array;
    expect(data[7]).toBe(0);
    expect(data[3]).toBe(255);
  });

  it("caches result by key", () => {
    const magLayer = makeScalarLayer(2, 2, [5, 5, 5, 5], [0, 0, 10, 10]);
    const dirLayer = makeScalarLayer(2, 2, [0, 0, 0, 0], [0, 0, 10, 10]);
    const key = "vft-cache-test";
    const r1 = buildVectorFieldTexture(magLayer, dirLayer, false, key);
    const r2 = buildVectorFieldTexture(magLayer, dirLayer, false, key);
    expect(r1).toBe(r2);
  });
});

describe("buildWindLabelPoints", () => {
  it("builds label points from a scalar grid", () => {
    const layer = makeScalarLayer(
      3,
      3,
      [5, 10, 15, 20, 25, 30, 35, 40, 45],
      [0, 0, 10, 10],
    );
    const result = buildWindLabelPoints(
      layer,
      [0, 0, 10, 10],
      1,
      "wlp-test-3x3",
    );
    expect(result).toHaveLength(9);
    for (const pt of result) {
      expect(pt).toHaveProperty("position");
      expect(pt).toHaveProperty("text");
      expect(pt.position).toHaveLength(2);
      expect(typeof pt.text).toBe("string");
    }
  });

  it("rounds values in label text", () => {
    const layer = makeScalarLayer(1, 1, [12.7], [0, 0, 10, 10]);
    const result = buildWindLabelPoints(
      layer,
      [0, 0, 10, 10],
      1,
      "wlp-round-test",
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("13");
  });

  it("returns empty for zero-span bounds", () => {
    const layer = makeScalarLayer(2, 2, [5, 5, 5, 5], [5, 5, 5, 5]);
    const result = buildWindLabelPoints(
      layer,
      [5, 5, 5, 5],
      1,
      "wlp-zero-span",
    );
    expect(result).toEqual([]);
  });

  it("skips NaN grid values", () => {
    const layer = makeScalarLayer(2, 1, [10, NaN], [0, 0, 10, 10]);
    const result = buildWindLabelPoints(
      layer,
      [0, 0, 10, 10],
      1,
      "wlp-nan-test",
    );
    expect(result).toHaveLength(1);
  });

  it("applies lon/lat offset factors", () => {
    const layer = makeScalarLayer(3, 1, [10, 20, 30], [0, 0, 10, 10]);
    const noOffset = buildWindLabelPoints(
      layer,
      [0, 0, 10, 10],
      1,
      "wlp-no-offset",
    );
    const withOffset = buildWindLabelPoints(
      layer,
      [0, 0, 10, 10],
      1,
      "wlp-with-offset",
      0.5,
      0.5,
    );
    expect(noOffset[0].position[0]).not.toBe(withOffset[0].position[0]);
  });

  it("caches result by key", () => {
    const layer = makeScalarLayer(2, 2, [5, 5, 5, 5], [0, 0, 10, 10]);
    const key = "wlp-cache-test";
    const r1 = buildWindLabelPoints(layer, [0, 0, 10, 10], 1, key);
    const r2 = buildWindLabelPoints(layer, [0, 0, 10, 10], 1, key);
    expect(r1).toBe(r2);
  });
});
