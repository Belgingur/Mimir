import { describe, it, expect } from "vitest";
import {
  INHOUSE_WIND_VECTOR_VARIABLES,
  INHOUSE_GROUP_VARIABLES,
  INHOUSE_PRESETS,
  LAYER_GROUPS,
  WAVE_HEIGHT_VARIABLE,
  WAVE_PERIOD_VARIABLE,
  WAVE_DIRECTION_VARIABLE,
  WAVE_DIRECTION_IS_FROM,
} from "../src/lib/inhouseTypes";

describe("inhouseTypes constants", () => {
  it("INHOUSE_WIND_VECTOR_VARIABLES contains wind_uv_10m", () => {
    expect(INHOUSE_WIND_VECTOR_VARIABLES).toContain("wind_uv_10m");
  });

  it("INHOUSE_GROUP_VARIABLES has all 4 group ids", () => {
    expect(Object.keys(INHOUSE_GROUP_VARIABLES)).toEqual(
      expect.arrayContaining(["temperature", "wind", "precip", "waves"]),
    );
  });

  it("every group has a non-empty primary array", () => {
    for (const group of Object.values(INHOUSE_GROUP_VARIABLES)) {
      expect(group.primary.length).toBeGreaterThan(0);
    }
  });

  it("wind group includes windVector, windSpeed, windDir", () => {
    const wind = INHOUSE_GROUP_VARIABLES.wind;
    expect(wind.windVector).toBeDefined();
    expect(wind.windSpeed).toBeDefined();
    expect(wind.windDir).toBeDefined();
  });

  it("INHOUSE_PRESETS has at least one preset", () => {
    expect(INHOUSE_PRESETS.length).toBeGreaterThan(0);
    expect(INHOUSE_PRESETS[0].name).toBe("Wind + MSLP");
  });

  it("LAYER_GROUPS has 6 entries with temperature as default", () => {
    expect(LAYER_GROUPS).toHaveLength(6);
    const defaultGroup = LAYER_GROUPS.find((g) => g.default);
    expect(defaultGroup?.id).toBe("temperature");
  });

  it("LAYER_GROUPS ids are temperature, wind, precip, cloud, snow, waves", () => {
    expect(LAYER_GROUPS.map((g) => g.id)).toEqual([
      "temperature",
      "wind",
      "precip",
      "cloud",
      "snow",
      "waves",
    ]);
  });

  it("wave variable constants are correct", () => {
    expect(WAVE_HEIGHT_VARIABLE).toBe("significant_wave_height");
    expect(WAVE_PERIOD_VARIABLE).toBe("primary_wave_mean_period");
    expect(WAVE_DIRECTION_VARIABLE).toBe("primary_wave_direction");
    expect(WAVE_DIRECTION_IS_FROM).toBe(true);
  });
});
