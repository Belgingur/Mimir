/**
 * 16-point compass bearing utilities.
 */

import { t } from "./i18n";

const BINS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;
export type CompassBin16 = (typeof BINS_16)[number];

/** i18n keys that match the 16-point bins. */
const DIR_KEYS = BINS_16.map((d) => `dir.${d}` as const);

/**
 * Convert a wind-FROM direction (degrees clockwise from North, 0–360)
 * to a 16-point compass abbreviation.  Each bin spans 22.5°.
 *
 * Returns the localised abbreviation via i18n (falls back to English).
 */
export function windDirectionBin(degrees: number): string {
  const normalised = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalised / 22.5) % 16;
  return t(DIR_KEYS[index]);
}
