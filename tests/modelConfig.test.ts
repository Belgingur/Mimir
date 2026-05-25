import { describe, it, expect } from "vitest";
import {
  REGIONAL_MODELS,
  GLOBAL_MODELS,
  DEFAULT_VIEW,
  WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0,
  MODEL_RESOLUTION_METERS,
  shouldCenterOnBounds,
  getModelResolutionMeters,
  getModelDefaultCenter,
  getMetersPerPixelAtLatitude,
} from "../src/lib/modelConfig";

describe("model constants", () => {
  it("REGIONAL_MODELS contains expected models", () => {
    expect(REGIONAL_MODELS.has("UWC-IG")).toBe(true);
    expect(REGIONAL_MODELS.has("BEL-IS")).toBe(true);
    expect(REGIONAL_MODELS.has("RAP")).toBe(true);
    expect(REGIONAL_MODELS.has("GFS")).toBe(false);
  });

  it("GLOBAL_MODELS contains expected models", () => {
    expect(GLOBAL_MODELS.has("GFS")).toBe(true);
    expect(GLOBAL_MODELS.has("GWES")).toBe(true);
    expect(GLOBAL_MODELS.has("RAP")).toBe(false);
  });

  it("DEFAULT_VIEW has expected shape", () => {
    expect(DEFAULT_VIEW.center).toEqual([-20, 55]);
    expect(DEFAULT_VIEW.zoom).toBe(3.2);
  });

  it("MODEL_RESOLUTION_METERS has entries for known models", () => {
    expect(MODEL_RESOLUTION_METERS["GFS"]).toBe(25000);
    expect(MODEL_RESOLUTION_METERS["BEL-IS"]).toBe(2000);
  });
});

describe("shouldCenterOnBounds", () => {
  it("returns true for regional models regardless of bounds", () => {
    expect(shouldCenterOnBounds("UWC-IG", [-180, -90, 180, 90])).toBe(true);
    expect(shouldCenterOnBounds("RAP", [0, 0, 10, 10])).toBe(true);
  });

  it("returns true for non-regional models with small bounds", () => {
    expect(shouldCenterOnBounds("GFS", [-30, 50, 10, 80])).toBe(true);
  });

  it("returns false for non-regional models with global bounds", () => {
    expect(shouldCenterOnBounds("GFS", [-180, -90, 180, 90])).toBe(false);
  });
});

describe("getModelResolutionMeters", () => {
  it("returns manifest resolution when available", () => {
    const manifest = {
      bounds: [0, 0, 10, 10] as [number, number, number, number],
      shape: { width: 100, height: 100 },
      srcMin: 0,
      srcMax: 1,
      fileTemplate: "f_{index:03d}.webp",
      count: 1,
      analysisTime: "2026-01-01_00",
      historyIntervalMinutes: 60,
      rendering: { resolutionMeters: 5000 },
    };
    expect(getModelResolutionMeters("GFS", manifest)).toBe(5000);
  });

  it("falls back to MODEL_RESOLUTION_METERS", () => {
    expect(getModelResolutionMeters("GFS")).toBe(25000);
    expect(getModelResolutionMeters("BEL-FO")).toBe(3000);
  });

  it("returns null for unknown model without manifest", () => {
    expect(getModelResolutionMeters("UNKNOWN")).toBeNull();
  });

  it("ignores non-positive manifest resolution", () => {
    const manifest = {
      bounds: [0, 0, 10, 10] as [number, number, number, number],
      shape: { width: 100, height: 100 },
      srcMin: 0,
      srcMax: 1,
      fileTemplate: "f_{index:03d}.webp",
      count: 1,
      analysisTime: "2026-01-01_00",
      historyIntervalMinutes: 60,
      rendering: { resolutionMeters: 0 },
    };
    expect(getModelResolutionMeters("GFS", manifest)).toBe(25000);
  });
});

describe("getModelDefaultCenter", () => {
  it("returns hardcoded center for UWC-IG", () => {
    expect(getModelDefaultCenter("UWC-IG")).toEqual([-36, 68.5]);
  });

  it("returns hardcoded center for RAP", () => {
    expect(getModelDefaultCenter("RAP")).toEqual([-60, 62]);
  });

  it("returns DEFAULT_VIEW center for global models", () => {
    expect(getModelDefaultCenter("GFS")).toEqual(DEFAULT_VIEW.center);
    expect(getModelDefaultCenter("GWES")).toEqual(DEFAULT_VIEW.center);
  });

  it("returns bounds center for non-global models with bounds", () => {
    expect(getModelDefaultCenter("BEL-FO", [-30, 60, -10, 70])).toEqual([
      -20, 65,
    ]);
  });

  it("returns DEFAULT_VIEW center when no bounds provided for unknown model", () => {
    expect(getModelDefaultCenter("UNKNOWN")).toEqual(DEFAULT_VIEW.center);
  });
});

describe("getMetersPerPixelAtLatitude", () => {
  it("returns expected value at equator zoom 0", () => {
    const result = getMetersPerPixelAtLatitude(0, 0);
    expect(result).toBeCloseTo(WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0, 0);
  });

  it("returns half value at equator zoom 1", () => {
    const z0 = getMetersPerPixelAtLatitude(0, 0);
    const z1 = getMetersPerPixelAtLatitude(0, 1);
    expect(z1).toBeCloseTo(z0 / 2, 0);
  });

  it("returns smaller value at higher latitudes (cos factor)", () => {
    const equator = getMetersPerPixelAtLatitude(0, 5);
    const lat60 = getMetersPerPixelAtLatitude(60, 5);
    expect(lat60).toBeLessThan(equator);
    expect(lat60).toBeCloseTo(equator * 0.5, 0);
  });
});
