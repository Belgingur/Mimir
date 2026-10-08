import { describe, expect, it } from "vitest";
import {
  selectModel,
  pointInBBox,
  pointInPolygon,
  modelIntersectsViewport,
} from "../src/lib/selectModel";
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

describe("selectModel — data masks and preferred models", () => {
  // A wide bbox whose data fills only its northern half, like a Lambert
  // domain reprojected to lat/lon.
  const lambert: ModelCoverage = {
    id: "LAMBERT",
    resolutionKm: 2,
    bbox: { west: -10, south: 40, east: 20, north: 70 },
    domainMask: { cols: 2, rows: 2, runs: "0.2/2" },
    available: true,
  };
  const global: ModelCoverage = {
    id: "GLOBAL",
    resolutionKm: 25,
    bbox: { west: -180, south: -90, east: 180, north: 90 },
    available: true,
  };
  const local: ModelCoverage = {
    id: "LOCAL",
    resolutionKm: 3,
    bbox: { west: -8.8, south: 60.9, east: -5, north: 62.9 },
    preferred: true,
    available: true,
  };

  it("picks a model where its mask has data", () => {
    expect(selectModel(60, 5, [lambert, global])).toBe("LAMBERT");
  });

  it("passes over a model whose bbox, but not its data, covers the point", () => {
    expect(selectModel(45, 5, [lambert, global])).toBe("GLOBAL");
  });

  it("lets a preferred model win over a finer one where it has data", () => {
    expect(selectModel(62, -6.8, [lambert, local, global])).toBe("LOCAL");
  });

  it("does not let a preferred model win anywhere else", () => {
    expect(selectModel(60, 5, [lambert, local, global])).toBe("LAMBERT");
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

describe("modelIntersectsViewport", () => {
  const iceland = { bbox: { west: -25.6, south: 62.9, east: -12.4, north: 67.3 } };
  const brazil = { bbox: { west: -59.3, south: -32.8, east: -31.7, north: -0.4 } };
  const global = {};
  const overIceland = { west: -30, south: 60, east: -10, north: 69 };

  it("sees a domain that overlaps the view", () => {
    expect(modelIntersectsViewport(iceland, overIceland)).toBe(true);
  });

  it("rejects a domain in the wrong hemisphere", () => {
    // The exact case a first-time visitor hits: the deployed catalog defaults
    // to the Brazil model while the camera sits on Iceland, and the map paints
    // nothing at all.
    expect(modelIntersectsViewport(brazil, overIceland)).toBe(false);
  });

  it("treats a model with no bbox as covering everything", () => {
    expect(modelIntersectsViewport(global, overIceland)).toBe(true);
  });

  it("rejects a domain that is only outside in latitude", () => {
    expect(
      modelIntersectsViewport(iceland, { west: -30, south: 0, east: -10, north: 20 }),
    ).toBe(false);
  });

  it("matches a domain across a view that has wrapped past the antimeridian", () => {
    const pacific = { bbox: { west: 170, south: -10, east: 179, north: 10 } };
    expect(
      modelIntersectsViewport(pacific, {
        west: 160 + 360,
        south: -20,
        east: 200 + 360,
        north: 20,
      }),
    ).toBe(true);
  });
});

describe("modelIntersectsViewport — a global domain always covers the view", () => {
  // The bug this pins: -180 and +180 are the same point on the globe, so
  // wrapping both edges relative to the view collapsed a global domain to a
  // single longitude, and any view away from it was reported as uncovered.
  // GWES and GFS are both global, so the app accused them of not covering the
  // map they were painting.
  const global = { bbox: { west: -180, south: -90, east: 180, north: 90 } };

  it("covers a narrow view over Iceland", () => {
    expect(
      modelIntersectsViewport(global, {
        west: -24,
        south: 63,
        east: -20,
        north: 65,
      }),
    ).toBe(true);
  });

  it("covers a narrow view on the other side of the world", () => {
    expect(
      modelIntersectsViewport(global, {
        west: 138,
        south: 34,
        east: 141,
        north: 36,
      }),
    ).toBe(true);
  });

  it("covers a view at every longitude", () => {
    for (let lon = -180; lon <= 180; lon += 15) {
      expect(
        modelIntersectsViewport(global, {
          west: lon - 2,
          south: -1,
          east: lon + 2,
          north: 1,
        }),
      ).toBe(true);
    }
  });

  it("still rejects a regional domain a long way from the view", () => {
    const brazil = {
      bbox: { west: -59.3, south: -32.8, east: -31.7, north: -0.4 },
    };
    expect(
      modelIntersectsViewport(brazil, {
        west: -24,
        south: 63,
        east: -20,
        north: 65,
      }),
    ).toBe(false);
  });

  it("matches a domain that straddles the antimeridian", () => {
    const straddling = { bbox: { west: 170, south: -10, east: -170, north: 10 } };
    expect(
      modelIntersectsViewport(straddling, {
        west: 178,
        south: -1,
        east: 180,
        north: 1,
      }),
    ).toBe(true);
  });
});
