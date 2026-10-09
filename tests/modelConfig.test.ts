import { describe, expect, it } from "vitest";
import {
  WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0,
  getMetersPerPixelAtLatitude,
  isGlobalDomain,
  manifestGridSpacingMeters,
  modelCoversPoint,
  modelFraming,
  modelResolutionMeters,
  type Bounds,
} from "../src/lib/modelConfig";
import type { InhouseManifest, ModelCoverage } from "../src/lib/inhouseTypes";

const manifest = (overrides: Partial<InhouseManifest> = {}): InhouseManifest =>
  ({
    bounds: [-180, -90, 179.75, 90],
    shape: { width: 1440, height: 720 },
    srcMin: 0,
    srcMax: 1,
    fileTemplate: "f_{index:03d}.webp",
    count: 1,
    ...overrides,
  }) as InhouseManifest;

const ICELAND: Bounds = [-25, 63, -13, 67];
const GLOBE: Bounds = [-180, -90, 179.75, 90];

describe("getMetersPerPixelAtLatitude", () => {
  it("returns expected value at equator zoom 0", () => {
    expect(getMetersPerPixelAtLatitude(0, 0)).toBeCloseTo(
      WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0,
      0,
    );
  });

  it("halves with every zoom level", () => {
    expect(getMetersPerPixelAtLatitude(0, 1)).toBeCloseTo(
      getMetersPerPixelAtLatitude(0, 0) / 2,
      0,
    );
  });

  it("shrinks with the cosine of latitude", () => {
    expect(getMetersPerPixelAtLatitude(60, 5)).toBeCloseTo(
      getMetersPerPixelAtLatitude(0, 5) * 0.5,
      0,
    );
  });
});

describe("isGlobalDomain", () => {
  it("recognises a global grid, including one without the poles", () => {
    expect(isGlobalDomain(GLOBE)).toBe(true);
    expect(isGlobalDomain([-180, -80, 179.75, 80])).toBe(true); // a wave model
    expect(isGlobalDomain({ west: -180, south: -90, east: 180, north: 90 })).toBe(true);
  });

  it("does not mistake a domain over the pole for a global one", () => {
    // Every longitude, because it crosses the pole, but only half the latitudes.
    expect(isGlobalDomain([-180, -10.6, 180, 90])).toBe(false);
  });

  it("says no for a regional domain", () => {
    expect(isGlobalDomain(ICELAND)).toBe(false);
  });
});

describe("manifestGridSpacingMeters", () => {
  it("reads the north-south spacing from bounds and image height", () => {
    // 0.25° rows, as GFS's grid.
    expect(manifestGridSpacingMeters(manifest())).toBeCloseTo(27_830, -1);
  });

  it("accepts a [width, height] shape", () => {
    const m = manifest({ bounds: [0, 0, 1, 1], shape: [10, 10] });
    expect(manifestGridSpacingMeters(m)).toBeCloseTo(11_132, 0);
  });

  it("prefers a resolution the manifest declares", () => {
    const m = manifest({ rendering: { resolutionMeters: 2500 } } as Partial<InhouseManifest>);
    expect(manifestGridSpacingMeters(m)).toBe(2500);
  });

  it("is null without a manifest or a usable shape", () => {
    expect(manifestGridSpacingMeters(null)).toBeNull();
    expect(
      manifestGridSpacingMeters(manifest({ shape: { width: 0, height: 0 } })),
    ).toBeNull();
  });
});

describe("modelResolutionMeters", () => {
  it("takes the catalog's resolution_km first", () => {
    const coverage: ModelCoverage = { id: "M", resolutionKm: 3.2, available: true };
    expect(modelResolutionMeters(coverage, manifest())).toBe(3200);
  });

  it("falls back to the manifest's grid", () => {
    const coverage: ModelCoverage = { id: "M", available: true };
    expect(modelResolutionMeters(coverage, manifest())).toBeCloseTo(27_830, -1);
  });

  it("is null when neither knows", () => {
    expect(modelResolutionMeters(null)).toBeNull();
  });
});

describe("modelCoversPoint", () => {
  // The single question that decides whether a model switch may move the
  // camera: does this model have data where the reader is looking?

  it("says yes inside the bounds and no outside them", () => {
    expect(modelCoversPoint(null, ICELAND, [-21.9, 64.1])).toBe(true);
    expect(modelCoversPoint(null, ICELAND, [10.7, 59.9])).toBe(false); // Oslo
  });

  it("counts the boundary as covered", () => {
    expect(modelCoversPoint(null, ICELAND, [-25, 63])).toBe(true);
    expect(modelCoversPoint(null, ICELAND, [-13, 67])).toBe(true);
  });

  it("ignores latitude outside the band even at a covered longitude", () => {
    expect(modelCoversPoint(null, ICELAND, [-19, 50])).toBe(false);
  });

  it("always says yes for a global domain, wherever the reader is", () => {
    const sea: ModelCoverage = {
      id: "WAVES",
      bbox: { west: -180, south: -80, east: 179.75, north: 80 },
      // Data over the sea only: still global, so it never reframes.
      domainMask: { cols: 2, rows: 1, runs: "1.1" },
      available: true,
    };
    for (const center of [[-21.9, 64.1], [151.2, -33.9], [0, 0]] as [number, number][]) {
      expect(modelCoversPoint(null, GLOBE, center)).toBe(true);
      expect(modelCoversPoint(sea, GLOBE, center)).toBe(true);
    }
  });

  it("uses the catalog's data mask over the bounds", () => {
    // Data in the northern half of the bbox only.
    const lambert: ModelCoverage = {
      id: "LAMBERT",
      bbox: { west: -10, south: 40, east: 20, north: 70 },
      domainMask: { cols: 1, rows: 2, runs: "0.1/1" },
      available: true,
    };
    expect(modelCoversPoint(lambert, null, [5, 60])).toBe(true);
    expect(modelCoversPoint(lambert, null, [5, 45])).toBe(false);
  });

  it("says no for a model with nothing to reason about", () => {
    // Better to reframe on a domain than to leave the reader on a blank map.
    expect(modelCoversPoint(null, null, [-21.9, 64.1])).toBe(false);
  });

  it("handles a domain crossing the antimeridian", () => {
    const pacific: Bounds = [170, -10, -170, 10];
    expect(modelCoversPoint(null, pacific, [179, 0])).toBe(true);
    expect(modelCoversPoint(null, pacific, [-179, 0])).toBe(true);
    expect(modelCoversPoint(null, pacific, [0, 0])).toBe(false);
  });
});

describe("modelFraming", () => {
  it("leaves a global model alone", () => {
    expect(modelFraming(null, GLOBE)).toBeNull();
  });

  it("uses the view models.json gives", () => {
    const coverage: ModelCoverage = {
      id: "M",
      bbox: { west: -180, south: -10, east: 180, north: 90 },
      view: { center: [-60, 62], zoom: 2.5 },
      available: true,
    };
    expect(modelFraming(coverage, null)).toEqual({
      view: { center: [-60, 62], zoom: 2.5 },
    });
  });

  it("frames the extent of the data when the mask is narrower than the bbox", () => {
    const coverage: ModelCoverage = {
      id: "M",
      bbox: { west: 0, south: 0, east: 4, north: 2 },
      domainMask: { cols: 4, rows: 2, runs: "1.2/4" },
      available: true,
    };
    expect(modelFraming(coverage, null)).toEqual({ bounds: [1, 1, 3, 2] });
  });

  it("frames the bounds when that is all there is", () => {
    expect(modelFraming(null, ICELAND)).toEqual({ bounds: ICELAND });
  });

  it("has nothing to frame without coverage or bounds", () => {
    expect(modelFraming(null, null)).toBeNull();
  });
});
