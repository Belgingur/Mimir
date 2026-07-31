/**
 * Phase 4 — one resolver, two paths, one normalised result.
 *
 * Tries the basemap's own city labels first (exact, free, already rendered),
 * then falls back to the bundled Natural Earth dataset so that *any* click
 * resolves to a named place. Both paths are local: no geocoding or
 * reverse-geocoding request is issued, and no tile request beyond the basemap
 * and weather imagery already in flight.
 */

import type maplibregl from "maplibre-gl";
import { pickPlaceLabel } from "./placeLabelPick";
import { distance } from "geokdbush";
import {
  NearestPlaceIndex,
  type ExtraPlace,
  type NearestPlaceIndexOptions,
  type PlaceTuple,
} from "./nearestPlace";

/** Which mechanism produced the result — kept for debugging and acceptance checks. */
export type ResolvedPlaceSource = "label" | "dataset";

export interface ResolvedPlace {
  readonly name: string;
  /**
   * The place's own coordinates — the station's exact position where the name
   * matches one, else the city's point in the label/dataset. For a "label"
   * result this is the point the app should actually forecast for; for a
   * "dataset" result it is merely the nearest city to the click, and the
   * clicked point stands.
   */
  readonly latitude: number;
  readonly longitude: number;
  readonly source: ResolvedPlaceSource;
  /** Distance from the click to the returned place; 0 for a direct label hit. */
  readonly distanceKm: number;
  readonly countryCode?: string;
  /** True when the coordinates came from the model's own station list. */
  readonly fromStation?: boolean;
}

/**
 * Letters NFD cannot decompose, because they are distinct letters rather than
 * an accented base. Iceland makes this load-bearing: without it "Ísafjörður"
 * folds to "isafjorður" and never matches a station spelled "Isafjordur".
 */
const NON_DECOMPOSABLE: Record<string, string> = {
  ð: "d",
  þ: "th",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ł: "l",
  đ: "d",
  ħ: "h",
  ı: "i",
};

/**
 * Accent- and case-insensitive comparison key, so "Ísafjörður" matches
 * "Isafjordur" and "REYKJAVIK" matches "Reykjavík".
 */
export function foldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, (char) => (char === " " ? " " : ""))
    .normalize("NFD")
    // Strip the combining marks NFD just split off...
    .replace(/\p{M}/gu, "")
    // ...then the letters it could not split at all.
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(/./gu, (char) => NON_DECOMPOSABLE[char] ?? char);
}

/** Stations further than this from the resolved city are a different place. */
const STATION_MATCH_MAX_KM = 25;

export interface PlaceResolverDeps {
  readonly map: maplibregl.Map;
  readonly getLocale?: () => string;
  readonly getExtraPlaces?: () => readonly ExtraPlace[];
  readonly indexOptions?: Omit<NearestPlaceIndexOptions, "getExtraPlaces">;
  readonly isDev?: boolean;
}

export interface PlaceResolver {
  /**
   * Resolve the place for a map click.
   *
   * @param point screen point in CSS pixels (`event.point`)
   * @param lngLat geographic point of the same click (`event.lngLat`) — taken
   *   straight from the map event, which costs nothing
   */
  resolve(
    point: { x: number; y: number },
    lngLat: { lng: number; lat: number },
  ): ResolvedPlace | null;
  /** Warm the dataset so the first click has no perceptible delay. */
  preload(): Promise<void>;
  /** The loaded dataset, so the city-label layer can reuse the same fetch. */
  loadedPlaces(): readonly PlaceTuple[];
}

export function createPlaceResolver(deps: PlaceResolverDeps): PlaceResolver {
  const index = new NearestPlaceIndex({
    ...deps.indexOptions,
    getExtraPlaces: deps.getExtraPlaces,
    isDev: deps.isDev,
  });

  /**
   * Prefer the model's own station coordinates when one carries the same name
   * as the resolved city. The station list is what the forecast is actually
   * computed for, so selecting "Akureyri" should land on the Akureyri station,
   * not on a label anchor a few hundred metres away.
   */
  function snapToStation(
    name: string,
    longitude: number,
    latitude: number,
  ): { longitude: number; latitude: number; fromStation: boolean } {
    const key = foldName(name);
    if (!key) return { longitude, latitude, fromStation: false };

    let best: { lon: number; lat: number; km: number } | null = null;
    for (const station of deps.getExtraPlaces?.() ?? []) {
      if (foldName(station.name) !== key) continue;
      if (!Number.isFinite(station.lon) || !Number.isFinite(station.lat)) {
        continue;
      }
      const km = distance(longitude, latitude, station.lon, station.lat);
      // A same-named station on the other side of the country is a different
      // place, not this one.
      if (km > STATION_MATCH_MAX_KM) continue;
      if (!best || km < best.km) best = { lon: station.lon, lat: station.lat, km };
    }

    return best
      ? { longitude: best.lon, latitude: best.lat, fromStation: true }
      : { longitude, latitude, fromStation: false };
  }

  return {
    preload: () => index.load(),

    loadedPlaces: () => index.loadedPlaces,

    resolve(point, lngLat) {
      // Path 1: a label directly under the cursor — the user selected a city,
      // so the result carries that city's own point, snapped to a station
      // where one matches. Callers should forecast for *that* point.
      const label = pickPlaceLabel(deps.map, point, {
        locale: deps.getLocale?.(),
      });
      if (label) {
        const snapped = snapToStation(
          label.name,
          label.longitude,
          label.latitude,
        );
        return {
          name: label.name,
          latitude: snapped.latitude,
          longitude: snapped.longitude,
          source: "label",
          distanceKm: 0,
          fromStation: snapped.fromStation,
        };
      }

      // Path 2: no label under the cursor, so the user picked a bare point on
      // the map, not a city. This reports the nearest place for context, but
      // the point itself is *not* moved and callers must keep the clicked
      // coordinate — clicking open countryside should forecast that spot, not
      // a town 20 km away.
      const nearest = index.query(lngLat.lng, lngLat.lat);
      if (!nearest) return null;

      return {
        name: nearest.name,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        source: "dataset",
        distanceKm: nearest.distanceKm,
        countryCode: nearest.countryCode,
      };
    },
  };
}
