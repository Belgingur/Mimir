/**
 * While the meteogram pin names a place, hide the map's own label for it.
 *
 * The pin's label already says the name ("Reykjavík · 5°"), and the pin often
 * sits away from the label's point: a click on a city snaps to its forecast
 * station, up to 25 km off (Reykjavík's is 2.1 km from the city label). With
 * both shown, the map reads as two places. Hiding the label leaves one.
 *
 * Keyed on the pin's place name and point, not on how the pin was made, so a
 * city label clicked on the map and a station picked in the widget's list
 * behave the same. A pin without a place name (a click on open ground) hides
 * nothing.
 *
 *  - Mímir's own city layer: the one city with that name nearest the pin
 *    within {@link STATION_MATCH_MAX_KM} (the snapping rule), by feature id,
 *    so pinning London, England leaves London, Ontario. Label and dot go.
 *  - The basemap's town and village layers: labels with that name within the
 *    same distance (see settlementLabelFilters.ts).
 */

import type * as maplibregl from "maplibre-gl";
import { distance } from "geokdbush";
import { setPinnedCity } from "./cityLabelLayer";
import type { PlaceTuple } from "./nearestPlace";
import { foldName, STATION_MATCH_MAX_KM } from "./resolveClickedPlace";
import { setPinnedSettlement } from "./settlementLabelFilters";

/** The place a pin names, at the pin's point. */
export interface PinnedPlace {
  readonly name: string;
  readonly lng: number;
  readonly lat: number;
}

/**
 * Basemap name properties a pin's name can come from: a click takes the app
 * locale's `name:xx` first, then `name`, `name:latin` and `name:en` (see
 * placeLabelPick.ts). Every app locale is listed, since the locale can change
 * while the pin stays.
 */
export function settlementNameKeys(locales: readonly string[]): string[] {
  return [
    ...new Set([
      "name:latin",
      "name",
      "name:en",
      ...locales.map((locale) => `name:${locale}`),
    ]),
  ];
}

/**
 * Index of the city in `places` the pin stands for: the nearest one with the
 * pin's name (ignoring case and accents) within {@link STATION_MATCH_MAX_KM},
 * or null.
 */
export function findPinnedCityId(
  places: readonly PlaceTuple[],
  pin: PinnedPlace,
): number | null {
  const key = foldName(pin.name);
  if (!key) return null;
  let best: { index: number; km: number } | null = null;
  places.forEach(([name, lon, lat], index) => {
    if (foldName(name) !== key) return;
    const km = distance(pin.lng, pin.lat, lon, lat);
    if (km > STATION_MATCH_MAX_KM) return;
    if (!best || km < best.km) best = { index, km };
  });
  return (best as { index: number } | null)?.index ?? null;
}

/**
 * Hide the labels of the place `pin` names, or show them all again for null
 * (or a pin without a name).
 */
export function showPinnedPlaceLabels(
  map: maplibregl.Map,
  places: readonly PlaceTuple[],
  pin: PinnedPlace | null,
  locales: readonly string[],
): void {
  const named = pin && pin.name.trim() ? pin : null;
  setPinnedCity(map, named ? findPinnedCityId(places, named) : null);
  setPinnedSettlement(
    map,
    named,
    STATION_MATCH_MAX_KM * 1000,
    settlementNameKeys(locales),
  );
}
