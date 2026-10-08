import type { UserLocation } from "./initialCamera";
import {
  TIME_ZONE_ALIASES,
  TIME_ZONE_COORDINATES,
} from "./timeZoneCoordinates";

/** The browser's IANA time zone id, or "" when it cannot say. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

const has = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/**
 * A first-time reader's approximate location, from their time zone: the
 * zone's principal city ("Europe/Paris" → Paris). It asks no permission and
 * sends nothing anywhere, and it is known before the map exists. Zone-sized
 * accuracy is enough to choose between forecast domains, which are larger
 * still.
 *
 * Returns null for a zone with no place, such as "UTC", which privacy-minded
 * browsers report on purpose.
 */
export function timeZoneLocation(
  timeZone: string = browserTimeZone(),
): UserLocation | null {
  const zone = has(TIME_ZONE_ALIASES, timeZone)
    ? TIME_ZONE_ALIASES[timeZone]
    : timeZone;
  if (!has(TIME_ZONE_COORDINATES, zone)) return null;
  const [lat, lon] = TIME_ZONE_COORDINATES[zone];
  return { lat, lon };
}
