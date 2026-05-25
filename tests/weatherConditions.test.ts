import { describe, expect, it } from "vitest";
import {
  classifyWeatherCondition,
  getSunPhase,
  isSunAboveHorizon,
  type WeatherInputs,
} from "../src/lib/weatherConditions";

// ── classifyWeatherCondition ──────────────────────────────────────────────────

const base: WeatherInputs = {
  cloudFraction: 0,
  precipRate: 0,
  temperature: 10,
  windSpeed: 3,
  sunPhase: "day",
  cape: null,
};

describe("classifyWeatherCondition – dry branch", () => {
  it("returns 01d for clear sky during day", () => {
    expect(classifyWeatherCondition({ ...base, cloudFraction: 0.1 })).toBe("01d");
  });

  it("returns 02d for nearly clear sky", () => {
    expect(classifyWeatherCondition({ ...base, cloudFraction: 0.4 })).toBe("02d");
  });

  it("returns 03d for partly cloudy", () => {
    expect(classifyWeatherCondition({ ...base, cloudFraction: 0.7 })).toBe("03d");
  });

  it("returns 04 for overcast (no sun suffix)", () => {
    expect(classifyWeatherCondition({ ...base, cloudFraction: 0.9 })).toBe("04");
  });

  it("applies night suffix", () => {
    expect(
      classifyWeatherCondition({ ...base, cloudFraction: 0.1, sunPhase: "night" }),
    ).toBe("01n");
  });

  it("applies midsun suffix", () => {
    expect(
      classifyWeatherCondition({ ...base, cloudFraction: 0.1, sunPhase: "midsun" }),
    ).toBe("01m");
  });

  it("uses cloudFraction 0.5 when cloudFraction is null", () => {
    const result = classifyWeatherCondition({ ...base, cloudFraction: null });
    // null defaults to 0.5 which falls in the nearly-clear band (0.25–0.625)
    expect(result).toBe("02d");
  });
});

describe("classifyWeatherCondition – light precipitation (pr 0.05–0.3)", () => {
  const lp = { ...base, precipRate: 0.1 };

  it("returns rain showers icon", () => {
    expect(classifyWeatherCondition(lp)).toBe("05d");
  });

  it("returns sleet showers when temp below 2°C", () => {
    expect(classifyWeatherCondition({ ...lp, temperature: 1 })).toBe("07d");
  });

  it("returns snow showers when temp below 0°C", () => {
    expect(classifyWeatherCondition({ ...lp, temperature: -1 })).toBe("08d");
  });

  it("returns thunder rain showers when CAPE >= 1500", () => {
    expect(classifyWeatherCondition({ ...lp, cape: 1500 })).toBe("06d");
  });

  it("returns thunder sleet showers with CAPE >= 1500 and temp 1°C", () => {
    expect(classifyWeatherCondition({ ...lp, cape: 1500, temperature: 1 })).toBe("20d");
  });

  it("returns thunder snow showers with CAPE >= 1500 and temp -1°C", () => {
    expect(classifyWeatherCondition({ ...lp, cape: 1500, temperature: -1 })).toBe("21d");
  });

  it("no shower thunder when CAPE is present but < 1500", () => {
    expect(classifyWeatherCondition({ ...lp, cape: 1000 })).toBe("05d");
  });

  it("no shower thunder when CAPE is null (fallback only applies to heavy precip)", () => {
    expect(classifyWeatherCondition({ ...lp, cape: null })).toBe("05d");
  });
});

describe("classifyWeatherCondition – moderate precipitation (pr 0.3–1.5)", () => {
  const mp = { ...base, precipRate: 0.6 };

  it("returns rain (09)", () => {
    expect(classifyWeatherCondition(mp)).toBe("09");
  });

  it("returns sleet (12) when temp below 2°C", () => {
    expect(classifyWeatherCondition({ ...mp, temperature: 1 })).toBe("12");
  });

  it("returns snow (13) when temp below 0°C", () => {
    expect(classifyWeatherCondition({ ...mp, temperature: -5 })).toBe("13");
  });
});

describe("classifyWeatherCondition – moderate-heavy precipitation (pr 1.5–5.0)", () => {
  const mhp = { ...base, precipRate: 2.0 };

  it("returns heavy rain (10)", () => {
    expect(classifyWeatherCondition(mhp)).toBe("10");
  });

  it("returns sleet (12) when temp below 2°C", () => {
    expect(classifyWeatherCondition({ ...mhp, temperature: 1 })).toBe("12");
  });

  it("returns snow (13) when temp below 0°C", () => {
    expect(classifyWeatherCondition({ ...mhp, temperature: -5 })).toBe("13");
  });
});

describe("classifyWeatherCondition – heavy precipitation (pr >= 5.0)", () => {
  const hp = { ...base, precipRate: 6.0 };

  it("returns heavy rain + thunder (11) when cape null (pr fallback)", () => {
    // cape is null → thunder = pr >= 5.0 = true
    expect(classifyWeatherCondition({ ...hp, cape: null })).toBe("11");
  });

  it("returns heavy rain + thunder (11) when cape >= 500", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 600 })).toBe("11");
  });

  it("returns heavy rain (10) when cape < 500 (explicitly provided)", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 200 })).toBe("10");
  });

  it("returns sleet + thunder (23) when temp 1°C and thunder", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 600, temperature: 1 })).toBe("23");
  });

  it("returns sleet (12) when temp 1°C and no thunder", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 200, temperature: 1 })).toBe("12");
  });

  it("returns snow + thunder (24d) when temp -5°C and thunder", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 600, temperature: -5 })).toBe("24d");
  });

  it("returns snow (13) when temp -5°C and no thunder", () => {
    expect(classifyWeatherCondition({ ...hp, cape: 200, temperature: -5 })).toBe("13");
  });

  it("24 icon uses night suffix when sunPhase is night", () => {
    expect(
      classifyWeatherCondition({
        ...hp,
        cape: 600,
        temperature: -5,
        sunPhase: "night",
      }),
    ).toBe("24n");
  });

  it("24 icon uses midsun suffix", () => {
    expect(
      classifyWeatherCondition({
        ...hp,
        cape: 600,
        temperature: -5,
        sunPhase: "midsun",
      }),
    ).toBe("24m");
  });
});

describe("classifyWeatherCondition – null defaults", () => {
  it("defaults precipRate to 0 when null", () => {
    const result = classifyWeatherCondition({ ...base, precipRate: null, cloudFraction: 0.1 });
    expect(result).toBe("01d");
  });

  it("defaults temperature to 5°C when null (sleet boundary check)", () => {
    // temp defaults to 5°C → above 2, so no sleet
    const result = classifyWeatherCondition({ ...base, precipRate: 0.6, temperature: null });
    expect(result).toBe("09");
  });
});

// ── getSunPhase ───────────────────────────────────────────────────────────────

describe("getSunPhase", () => {
  // Summer solstice 2026-06-21 12:00 UTC
  const summerNoon = Date.UTC(2026, 5, 21, 12, 0, 0);
  // Summer solstice 2026-06-21 00:00 UTC (midnight)
  const summerMidnight = Date.UTC(2026, 5, 21, 0, 0, 0);
  // Winter solstice 2026-12-21 12:00 UTC
  const winterNoon = Date.UTC(2026, 11, 21, 12, 0, 0);

  it("returns 'day' at equator, solar noon, summer", () => {
    expect(getSunPhase(0, 0, summerNoon)).toBe("day");
  });

  it("returns 'night' at equator, midnight, summer", () => {
    expect(getSunPhase(0, 0, summerMidnight)).toBe("night");
  });

  it("returns 'day' at North Pole at summer solstice noon (midnight sun)", () => {
    expect(getSunPhase(90, 0, summerNoon)).toBe("day");
  });

  it("returns 'night' at North Pole at winter solstice", () => {
    expect(getSunPhase(90, 0, winterNoon)).toBe("night");
  });

  it("returns 'midsun' at Reykjavik latitude around winter solstice noon", () => {
    // lat=64, lon=0, winter solstice noon — solar elevation ~2.5° → midsun
    expect(getSunPhase(64, 0, winterNoon)).toBe("midsun");
  });

  it("returns 'night' at southern temperate zone at local midnight in summer", () => {
    // lat=-34 (Buenos Aires), midnight UTC in summer → night
    expect(getSunPhase(-34, 0, summerMidnight)).toBe("night");
  });
});

// ── isSunAboveHorizon ─────────────────────────────────────────────────────────

describe("isSunAboveHorizon", () => {
  const summerNoon = Date.UTC(2026, 5, 21, 12, 0, 0);
  const summerMidnight = Date.UTC(2026, 5, 21, 0, 0, 0);

  it("returns true during day", () => {
    expect(isSunAboveHorizon(0, 0, summerNoon)).toBe(true);
  });

  it("returns false at night", () => {
    expect(isSunAboveHorizon(0, 0, summerMidnight)).toBe(false);
  });

  it("returns true for midsun (sun at horizon but above)", () => {
    const winterNoon = Date.UTC(2026, 11, 21, 12, 0, 0);
    expect(isSunAboveHorizon(64, 0, winterNoon)).toBe(true);
  });
});
