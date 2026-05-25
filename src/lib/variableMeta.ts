import { t } from "./i18n";

/**
 * Variable metadata with i18n keys for label and unit.
 * Both are resolved at access time via `t()` so they respond to locale changes.
 */
export const VARIABLE_META_KEYS = {
  air_temperature: { labelKey: "var.temperature", unitKey: "unit.celsius" },
  lwe_precipitation_rate: { labelKey: "var.precipRate", unitKey: "unit.mmhr" },
  wind_speed: { labelKey: "var.windSpeed", unitKey: "unit.ms" },
  wind_from_direction: {
    labelKey: "var.windDirection",
    unitKey: "unit.degrees",
  },
  relative_humidity: { labelKey: "var.humidity", unitKey: "unit.percent" },
  air_pressure_at_sea_level: { labelKey: "var.pressure", unitKey: "unit.hPa" },
  downward_shortwave_flux: { labelKey: "var.radiation", unitKey: "unit.wm2" },
  wind_speed_of_gust: { labelKey: "var.windGust", unitKey: "unit.ms" },
} as const;

type VarKey = keyof typeof VARIABLE_META_KEYS;

/** Runtime-resolved variable metadata (backwards-compatible shape). */
export const VARIABLE_META = new Proxy(
  {} as Record<VarKey, { label: string; unit: string }>,
  {
    get(_target, prop: string) {
      const entry = VARIABLE_META_KEYS[prop as VarKey];
      if (!entry) return undefined;
      return { label: t(entry.labelKey), unit: t(entry.unitKey) };
    },
    has(_target, prop: string | symbol) {
      return typeof prop === "string" && prop in VARIABLE_META_KEYS;
    },
    ownKeys() {
      return Object.keys(VARIABLE_META_KEYS);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const entry = VARIABLE_META_KEYS[prop as VarKey];
      if (entry) {
        return {
          configurable: true,
          enumerable: true,
          value: { label: t(entry.labelKey), unit: t(entry.unitKey) },
        };
      }
      return undefined;
    },
  },
);
