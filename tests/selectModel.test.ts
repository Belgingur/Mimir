import { describe, expect, it } from "vitest";
import { selectModel, pointInBBox, pointInPolygon } from "../src/lib/selectModel";
import type { ModelCoverage } from "../src/lib/inhouseTypes";

/** A realistic-ish coverage set: Iceland high-res, a wider N-Atlantic model, global. */
function models(overrides: Partial<Record<string, Partial<ModelCoverage>>> = {}): ModelCoverage[] {
  const base: ModelCoverage[] = [
    {
      id: "BEL-IS",
      resolutionKm: 2,
      marginKm: 30,
      bbox: { west: -25.6, south: 62.9, east: -12.4, north: 67.3 },
      available: true,
    },
    {
      id: "RAP",
      resolutionKm: 13,
      bbox: { west: -80, south: 40, east: 0, north: 75 },
      available: true,
    },
    {
      id: "GFS",
      resolutionKm: 25,
      bbox: { west: -180, south: -90, east: 180, north: 90 },
      available: true,
    },
  ];
  return base.map((m) => ({ ...m, ...(overrides[m.id] ?? {}) }));
}

describe("selectModel", () => {
  it("picks the finest model for a point inside its domain (Reykjavík → BEL-IS)", () => {
    expect(selectModel(64.15, -21.94, models())).toBe("BEL-IS");
  });

  it("skips a high-res domain when the point sits inside its edge margin (→ RAP)", () => {
    // lat 62.95 is inside BEL-IS' raw south edge (62.9) but within its 30 km margin.
    expect(selectModel(62.95, -19, models())).toBe("RAP");
  });

  it("falls to the covering model for a point outside all regional domains (mainland Europe → GFS)", () => {
    // Germany (10°E) is east of RAP's eastern edge (0°) but inside the global bbox.
    expect(selectModel(48, 10, models())).toBe("GFS");
  });

  it("returns the global model in the mid-Atlantic (south of RAP)", () => {
    expect(selectModel(30, -40, models())).toBe("GFS");
  });

  it("returns null when every model is unhealthy", () => {
    const all = models({
      "BEL-IS": { available: false },
      RAP: { available: false },
      GFS: { available: false },
    });
    expect(selectModel(64.15, -21.94, all)).toBeNull();
  });

  it("skips an unhealthy finest model and picks the next covering one", () => {
    // BEL-IS disabled → Reykjavík resolves to the next covering model, RAP.
    const set = models({ "BEL-IS": { available: false } });
    expect(selectModel(64.15, -21.94, set)).toBe("RAP");
  });

  it("tie-breaks equal-resolution models by display order (BEL-IS before UWC-IG)", () => {
    const set: ModelCoverage[] = [
      {
        id: "UWC-IG",
        resolutionKm: 2,
        bbox: { west: -25.6, south: 62.9, east: -12.4, north: 67.3 },
        available: true,
      },
      {
        id: "BEL-IS",
        resolutionKm: 2,
        bbox: { west: -25.6, south: 62.9, east: -12.4, north: 67.3 },
        available: true,
      },
    ];
    expect(selectModel(65, -19, set)).toBe("BEL-IS");
  });

  it("respects a domain_polygon that carves out part of the bbox", () => {
    // Square bbox, but the polygon only covers the western half.
    const set: ModelCoverage[] = [
      {
        id: "WAISTED",
        resolutionKm: 3,
        bbox: { west: -10, south: 60, east: 10, north: 70 },
        domainPolygon: [
          [
            [-10, 60],
            [0, 60],
            [0, 70],
            [-10, 70],
            [-10, 60],
          ],
        ],
        available: true,
      },
      {
        id: "GFS",
        resolutionKm: 25,
        bbox: { west: -180, south: -90, east: 180, north: 90 },
        available: true,
      },
    ];
    // Western half → WAISTED; eastern half (in bbox, outside polygon) → GFS.
    expect(selectModel(65, -5, set)).toBe("WAISTED");
    expect(selectModel(65, 5, set)).toBe("GFS");
  });

  it("ignores models with neither bbox nor polygon (no containment claim)", () => {
    const set: ModelCoverage[] = [
      { id: "NOBOX", resolutionKm: 1, available: true },
      {
        id: "GFS",
        resolutionKm: 25,
        bbox: { west: -180, south: -90, east: 180, north: 90 },
        available: true,
      },
    ];
    expect(selectModel(0, 0, set)).toBe("GFS");
  });
});

describe("pointInBBox", () => {
  const bbox = { west: -25.6, south: 62.9, east: -12.4, north: 67.3 };

  it("is inside with no margin", () => {
    expect(pointInBBox(bbox, 64.15, -21.94)).toBe(true);
  });

  it("excludes a point within the inward margin", () => {
    expect(pointInBBox(bbox, 62.95, -19, 30)).toBe(false);
  });

  it("returns false when the margin swallows the box", () => {
    expect(pointInBBox(bbox, 65, -19, 5000)).toBe(false);
  });
});

describe("pointInPolygon", () => {
  const square = [
    [
      [-10, 60],
      [0, 60],
      [0, 70],
      [-10, 70],
      [-10, 60],
    ],
  ];

  it("detects a point inside", () => {
    expect(pointInPolygon(square, 65, -5)).toBe(true);
  });

  it("detects a point outside", () => {
    expect(pointInPolygon(square, 65, 5)).toBe(false);
  });
});
