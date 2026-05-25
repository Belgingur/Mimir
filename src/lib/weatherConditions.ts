/**
 * Weather condition classification → Yr.no icon code.
 *
 * Sun-phase variants (d/m/n):
 *   d  – Day:        solar elevation > 6°
 *   m  – Winter sun: solar elevation 0–6° (low polar sun)
 *   n  – Night:      sun below horizon
 *
 * Yr.no icon codes used here:
 *   01d/m/n  – Clear sky
 *   02d/m/n  – Nearly clear
 *   03d/m/n  – Partly cloudy
 *   04       – Overcast             (no sun visible regardless)
 *   05d/m/n  – Rain showers (light)
 *   06d/m/n  – Rain showers + thunder
 *   07d/m/n  – Sleet showers
 *   08d/m/n  – Snow showers
 *   09       – Rain                 (heavy enough to obscure sky)
 *   10       – Heavy rain
 *   11       – Heavy rain + thunder
 *   12       – Sleet
 *   13       – Snow
 *   15       – Fog
 *   20d/m/n  – Sleet showers + thunder
 *   21d/m/n  – Snow showers + thunder
 *   06d/m/n  – Rain showers + thunder  (light precip + high CAPE)
 *   20d/m/n  – Sleet showers + thunder (light precip + high CAPE)
 *   21d/m/n  – Snow showers + thunder  (light precip + high CAPE)
 *   22       – Rain + thunder
 *   23       – Sleet + thunder
 *   24d/m/n  – Snow + thunder (heavy, has day/night variants unlike 22–23)
 */

/** Three-state sun phase. */
export type SunPhase = "day" | "midsun" | "night";

export interface WeatherInputs {
  /** Cloud area fraction 0–1 */
  cloudFraction: number | null;
  /** Liquid-water-equivalent precipitation rate, mm/hr */
  precipRate: number | null;
  /** 2-m air temperature, °C */
  temperature: number | null;
  /** 10-m wind speed, m/s */
  windSpeed: number | null;
  /** Sun phase: 'day' (elevation > 6°), 'midsun' (0–6°), or 'night' (below horizon) */
  sunPhase: SunPhase;
  /**
   * Convective Available Potential Energy, J/kg.
   * null = unavailable for this model; thunder icons fall back to the
   * precipitation-rate-only heuristic when CAPE is absent.
   * Rough thresholds: ≥500 = convective possible, ≥1500 = moderate instability.
   */
  cape: number | null;
}

/** Return the Yr.no icon code for the given meteorological inputs. */
export function classifyWeatherCondition(inputs: WeatherInputs): string {
  const { cloudFraction, precipRate, temperature, sunPhase, cape } = inputs;

  const cf = cloudFraction ?? 0.5;
  const pr = precipRate ?? 0;
  const temp = temperature ?? 5;

  // Map sun phase to icon suffix. Codes that have no day/night variant (09, 10,
  // 11, 12, 13, 15, 22, 23 …) never use this suffix.
  // Note: 24 DOES have d/m/n variants on disk (24d/24m/24n) — no bare 24.png.
  const suffix: string =
    sunPhase === "night" ? "n" : sunPhase === "midsun" ? "m" : "d";

  // Whether atmospheric instability justifies a thunder icon.
  // When CAPE is available, require ≥500 J/kg (weak convective threshold).
  // When CAPE is null (model doesn't provide it), fall back to the old
  // precipitation-rate-only heuristic so existing behaviour is preserved.
  const thunder = cape !== null ? cape >= 500 : pr >= 5.0;

  // ── Precipitation branch ──────────────────────────────────────────────────

  if (pr >= 5.0) {
    // Heavy precipitation — show thunder only when instability warrants it
    if (thunder) {
      if (temp < 0) return `24${suffix}`; // snow + thunder (heavy)
      if (temp < 2) return "23"; // sleet + thunder (heavy)
      return "11"; // heavy rain + thunder
    }
    // Heavy precip but no meaningful CAPE — plain heavy icons
    if (temp < 0) return "13"; // snow (heavy)
    if (temp < 2) return "12"; // sleet (heavy)
    return "10"; // heavy rain
  }

  if (pr >= 1.5) {
    // Moderate to heavy
    if (temp < 0) return "13"; // snow
    if (temp < 2) return "12"; // sleet
    return "10"; // heavy rain
  }

  if (pr >= 0.3) {
    // Moderate
    if (temp < 0) return "13"; // snow
    if (temp < 2) return "12"; // sleet
    return "09"; // rain
  }

  if (pr >= 0.05) {
    // Light / showery — high CAPE (≥1500 J/kg) triggers thunder-shower icons
    const showerThunder = cape !== null ? cape >= 1500 : false;
    if (showerThunder) {
      if (temp < 0) return `21${suffix}`; // snow showers + thunder
      if (temp < 2) return `20${suffix}`; // sleet showers + thunder
      return `06${suffix}`; // rain showers + thunder
    }
    if (temp < 0) return `08${suffix}`; // snow showers
    if (temp < 2) return `07${suffix}`; // sleet showers
    return `05${suffix}`; // rain showers
  }

  // ── Dry branch ─────────────────────────────────────────────────────────────

  if (cf > 0.875) return "04"; // overcast – no sun visible
  if (cf > 0.625) return `03${suffix}`; // partly cloudy
  if (cf > 0.25) return `02${suffix}`; // nearly clear
  return `01${suffix}`; // clear sky
}

// ── Solar elevation helper ────────────────────────────────────────────────────

/**
 * Returns the sun phase at (lat, lon) at the given UTC time:
 *   'day'     – solar elevation > 6°   (full daylight)
 *   'midsun'  – solar elevation 0–6°   (low polar / winter sun near horizon)
 *   'night'   – solar elevation < 0°   (sun below horizon)
 *
 * Uses a fast approximation accurate to ~±1°.
 *
 * The 6° threshold corresponds to civil twilight and is approximately the
 * maximum solar elevation seen from Reykjavik at the winter solstice (~3–5°),
 * making it a natural boundary for the Arctic "winter sun" aesthetic.
 */
export function getSunPhase(lat: number, lon: number, utcMs: number): SunPhase {
  const dayOfYear = getDayOfYear(new Date(utcMs));
  const decl = solarDeclination(dayOfYear);
  const hourAngle = solarHourAngle(lon, utcMs);

  // sinAlt = sine of the solar elevation angle
  const sinAlt =
    Math.sin(toRad(lat)) * Math.sin(toRad(decl)) +
    Math.cos(toRad(lat)) * Math.cos(toRad(decl)) * Math.cos(toRad(hourAngle));

  // sin(6°) ≈ 0.1045  →  elevation between 0° and 6° is the "midsun" band
  if (sinAlt >= 0.1045) return "day";
  if (sinAlt >= 0) return "midsun";
  return "night";
}

/**
 * @deprecated Use getSunPhase instead.
 * Kept for any remaining call sites; returns true for both 'day' and 'midsun'.
 */
export function isSunAboveHorizon(
  lat: number,
  lon: number,
  utcMs: number,
): boolean {
  return getSunPhase(lat, lon, utcMs) !== "night";
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function getDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  return Math.floor(diff / 86_400_000);
}

function solarDeclination(dayOfYear: number): number {
  return -23.45 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
}

function solarHourAngle(lon: number, utcMs: number): number {
  const utcHour = (utcMs % 86_400_000) / 3_600_000;
  const solarNoonOffset = lon / 15; // hours
  const solarTime = utcHour + solarNoonOffset;
  return 15 * (solarTime - 12); // degrees from noon
}
