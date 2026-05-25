import { describe, expect, it } from "vitest";
import { VARIABLE_META, VARIABLE_META_KEYS } from "../src/lib/variableMeta";

describe("VARIABLE_META proxy", () => {
  it("returns label and unit for a known variable", () => {
    const meta = VARIABLE_META.air_temperature;
    expect(meta).toBeDefined();
    expect(typeof meta.label).toBe("string");
    expect(typeof meta.unit).toBe("string");
    expect(meta.label.length).toBeGreaterThan(0);
    expect(meta.unit.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown variable key", () => {
    expect((VARIABLE_META as any).unknown_variable).toBeUndefined();
  });

  it("'in' operator (has trap) returns true for known keys", () => {
    expect("air_temperature" in VARIABLE_META).toBe(true);
    expect("wind_speed" in VARIABLE_META).toBe(true);
    expect("relative_humidity" in VARIABLE_META).toBe(true);
  });

  it("'in' operator (has trap) returns false for unknown keys", () => {
    expect("not_a_variable" in VARIABLE_META).toBe(false);
  });

  it("Object.keys returns all VARIABLE_META_KEYS keys", () => {
    const keys = Object.keys(VARIABLE_META);
    const expected = Object.keys(VARIABLE_META_KEYS);
    expect(keys).toEqual(expected);
  });

  it("getOwnPropertyDescriptor returns descriptor for known key", () => {
    const desc = Object.getOwnPropertyDescriptor(VARIABLE_META, "wind_speed");
    expect(desc).toBeDefined();
    expect(desc!.enumerable).toBe(true);
    expect(desc!.configurable).toBe(true);
    expect(typeof desc!.value.label).toBe("string");
  });

  it("getOwnPropertyDescriptor returns undefined for unknown key", () => {
    const desc = Object.getOwnPropertyDescriptor(VARIABLE_META, "unknown_var");
    expect(desc).toBeUndefined();
  });

  it("all known variables have non-empty label and unit", () => {
    for (const key of Object.keys(VARIABLE_META_KEYS)) {
      const meta = (VARIABLE_META as any)[key];
      expect(meta).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.unit.length).toBeGreaterThan(0);
    }
  });
});
