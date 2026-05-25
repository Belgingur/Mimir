import { describe, expect, it } from "vitest";
import {
  clamp,
  compassBearingToIconAngle,
  bearingFromCoordinates,
  mapMagnitudeToArrowSize,
} from "../src/lib/mathUtils";

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("returns value when in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("handles min === max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
  it("handles NaN input", () => {
    expect(clamp(NaN, 0, 10)).toBeNaN();
  });
});

describe("compassBearingToIconAngle", () => {
  it("converts north (0°) to 90° icon angle", () => {
    expect(compassBearingToIconAngle(0)).toBe(90);
  });
  it("converts east (90°) to 0° icon angle", () => {
    expect(compassBearingToIconAngle(90)).toBe(0);
  });
  it("converts south (180°) to -90° icon angle", () => {
    expect(compassBearingToIconAngle(180)).toBe(-90);
  });
  it("converts west (270°) to -180° icon angle", () => {
    expect(compassBearingToIconAngle(270)).toBe(-180);
  });
  it("normalizes negative bearings", () => {
    expect(compassBearingToIconAngle(-90)).toBe(compassBearingToIconAngle(270));
  });
  it("normalizes bearings > 360", () => {
    expect(compassBearingToIconAngle(450)).toBe(compassBearingToIconAngle(90));
  });
});

describe("bearingFromCoordinates", () => {
  it("returns 0 (north) for due-north displacement", () => {
    expect(bearingFromCoordinates([0, 0], [0, 1])).toBe(0);
  });
  it("returns 90 for due-east displacement", () => {
    expect(bearingFromCoordinates([0, 0], [1, 0])).toBe(90);
  });
  it("returns 180 for due-south displacement", () => {
    expect(bearingFromCoordinates([0, 0], [0, -1])).toBe(180);
  });
  it("returns 270 for due-west displacement", () => {
    expect(bearingFromCoordinates([0, 0], [-1, 0])).toBe(270);
  });
  it("returns NaN for identical points", () => {
    expect(bearingFromCoordinates([5, 5], [5, 5])).toBeNaN();
  });
  it("returns NaN when coordinates contain Infinity", () => {
    expect(bearingFromCoordinates([Infinity, 0], [0, 0])).toBeNaN();
  });
});

describe("mapMagnitudeToArrowSize", () => {
  it("returns minSize when magnitude equals magnitudeMin", () => {
    expect(mapMagnitudeToArrowSize(0, 0, 20, 10, 24)).toBe(10);
  });
  it("returns maxSize when magnitude equals magnitudeMax", () => {
    expect(mapMagnitudeToArrowSize(20, 0, 20, 10, 24)).toBe(24);
  });
  it("returns midpoint size at midpoint magnitude", () => {
    expect(mapMagnitudeToArrowSize(10, 0, 20, 10, 24)).toBe(17);
  });
  it("clamps below magnitudeMin", () => {
    expect(mapMagnitudeToArrowSize(-5, 0, 20, 10, 24)).toBe(10);
  });
  it("clamps above magnitudeMax", () => {
    expect(mapMagnitudeToArrowSize(30, 0, 20, 10, 24)).toBe(24);
  });
  it("handles zero-range magnitude (magnitudeMin === magnitudeMax)", () => {
    const result = mapMagnitudeToArrowSize(5, 5, 5, 10, 24);
    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(24);
  });
});
