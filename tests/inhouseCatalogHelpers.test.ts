import { describe, it, expect } from "vitest";
import {
  resolveVariableMeta,
  resolveInhouseUnit,
  formatIndex,
  resolveManifestTimes,
} from "../src/lib/inhouseCatalogHelpers";
import type { InhouseManifest } from "../src/lib/inhouseTypes";

const makeManifest = (
  overrides: Partial<InhouseManifest> = {},
): InhouseManifest => ({
  bounds: [-180, -90, 180, 90],
  shape: { width: 360, height: 180 },
  srcMin: 0,
  srcMax: 1,
  fileTemplate: "frame_{index:03d}.webp",
  count: 3,
  analysisTime: "2026-03-04_00",
  historyIntervalMinutes: 60,
  ...overrides,
});

describe("resolveVariableMeta", () => {
  it("returns exact match for known variable", () => {
    const meta = resolveVariableMeta("air_temperature");
    expect(meta).toEqual({ label: "Temperature", unit: "°C" });
  });

  it("returns prefix match for extended variable id", () => {
    const meta = resolveVariableMeta("air_temperature_at_2m_agl");
    expect(meta).toEqual({ label: "Temperature", unit: "°C" });
  });

  it("returns null for unknown variable", () => {
    expect(resolveVariableMeta("nonexistent_variable")).toBeNull();
  });

  it("returns exact match for wind_speed", () => {
    const meta = resolveVariableMeta("wind_speed");
    expect(meta).toEqual({ label: "Wind speed", unit: "m/s" });
  });

  it("returns exact match for air_pressure_at_sea_level", () => {
    const meta = resolveVariableMeta("air_pressure_at_sea_level");
    expect(meta).toEqual({ label: "Sea level pressure", unit: "hPa" });
  });
});

describe("resolveInhouseUnit", () => {
  it("returns unit for known variable", () => {
    expect(resolveInhouseUnit("air_temperature")).toBe("°C");
  });

  it("returns unit via prefix match", () => {
    expect(resolveInhouseUnit("wind_speed_of_gust")).toBe("m/s");
  });

  it("returns empty string for unknown variable", () => {
    expect(resolveInhouseUnit("nonexistent")).toBe("");
  });
});

describe("formatIndex", () => {
  it("zero-pads to default width 3", () => {
    expect(formatIndex(0)).toBe("000");
    expect(formatIndex(5)).toBe("005");
    expect(formatIndex(42)).toBe("042");
    expect(formatIndex(123)).toBe("123");
  });

  it("zero-pads to custom width", () => {
    expect(formatIndex(7, 5)).toBe("00007");
    expect(formatIndex(12345, 5)).toBe("12345");
  });

  it("does not truncate numbers wider than width", () => {
    expect(formatIndex(1234, 2)).toBe("1234");
  });
});

describe("resolveManifestTimes", () => {
  it("returns copy of manifest.times when length matches count", () => {
    const times = [
      "2026-03-04T00:00:00Z",
      "2026-03-04T01:00:00Z",
      "2026-03-04T02:00:00Z",
    ];
    const manifest = makeManifest({ times, count: 3 });
    const result = resolveManifestTimes(manifest);
    expect(result).toEqual(times);
    expect(result).not.toBe(times);
  });

  it("generates times from analysisTime when times array missing", () => {
    const manifest = makeManifest({ count: 3, historyIntervalMinutes: 60 });
    delete (manifest as Record<string, unknown>).times;
    const result = resolveManifestTimes(manifest);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("2026-03-04T00:00:00.000Z");
    expect(result[1]).toBe("2026-03-04T01:00:00.000Z");
    expect(result[2]).toBe("2026-03-04T02:00:00.000Z");
  });

  it("generates times from analysisTime when times length != count", () => {
    const manifest = makeManifest({
      times: ["only_one"],
      count: 3,
      historyIntervalMinutes: 120,
    });
    const result = resolveManifestTimes(manifest);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("2026-03-04T00:00:00.000Z");
    expect(result[1]).toBe("2026-03-04T02:00:00.000Z");
    expect(result[2]).toBe("2026-03-04T04:00:00.000Z");
  });

  it("uses 30-minute intervals when specified", () => {
    const manifest = makeManifest({
      count: 4,
      historyIntervalMinutes: 30,
      analysisTime: "2026-03-04_12",
    });
    delete (manifest as Record<string, unknown>).times;
    const result = resolveManifestTimes(manifest);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe("2026-03-04T12:00:00.000Z");
    expect(result[1]).toBe("2026-03-04T12:30:00.000Z");
    expect(result[2]).toBe("2026-03-04T13:00:00.000Z");
    expect(result[3]).toBe("2026-03-04T13:30:00.000Z");
  });

  it("falls back to hourly offsets from now for unparseable analysisTime", () => {
    const manifest = makeManifest({
      count: 2,
      analysisTime: "GARBAGE",
    });
    delete (manifest as Record<string, unknown>).times;
    const result = resolveManifestTimes(manifest);
    expect(result).toHaveLength(2);
    const t0 = Date.parse(result[0]);
    const t1 = Date.parse(result[1]);
    expect(Number.isFinite(t0)).toBe(true);
    expect(Number.isFinite(t1)).toBe(true);
    expect(t1 - t0).toBeCloseTo(3600000, -2);
  });

  it("falls back to hourly offsets from now when historyIntervalMinutes is absent", () => {
    // Non-uniform models (e.g. ICON-EU) omit historyIntervalMinutes from the
    // manifest and always supply a times array.  If times is somehow absent too,
    // resolveManifestTimes must not produce NaN dates.
    const manifest = makeManifest({ count: 2 });
    delete (manifest as Record<string, unknown>).times;
    delete (manifest as Record<string, unknown>).historyIntervalMinutes;
    const result = resolveManifestTimes(manifest);
    expect(result).toHaveLength(2);
    const t0 = Date.parse(result[0]);
    const t1 = Date.parse(result[1]);
    expect(Number.isFinite(t0)).toBe(true);
    expect(Number.isFinite(t1)).toBe(true);
    expect(t1 - t0).toBeCloseTo(3600000, -2);
  });
});
