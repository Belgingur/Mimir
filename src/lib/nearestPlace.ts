/**
 * Phase 3 — nearest named place from a locally bundled dataset.
 *
 * This is the fallback when no basemap label sits under the cursor, but it is
 * the path that carries the UX: it makes the whole map clickable instead of a
 * few dozen pixels of glyphs, and it is the only path that works if the style
 * ever degrades to a schema without a `place` layer.
 *
 * Data is Natural Earth 10m populated places, converted at build time by
 * scripts/build-places.mjs (public domain — no attribution obligation).
 * Nothing here talks to a geocoding service.
 */

import KDBush from "kdbush";
import { around, distance } from "geokdbush";

/** Tuple layout written by scripts/build-places.mjs. */
export type PlaceTuple = [
  name: string,
  lon: number,
  lat: number,
  population: number,
  countryCode: string,
  /** 1 for a national capital. */
  capital: number,
  /** Position by population within its own country, 1 = largest. */
  nationalRank: number,
];

interface PlacesPayload {
  readonly places?: readonly PlaceTuple[];
}

export interface NearestPlace {
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly population?: number;
  readonly countryCode?: string;
  /** Great-circle distance from the query point, in kilometres. */
  readonly distanceKm: number;
}

/** An extra point set to consider alongside the bundled dataset. */
export interface ExtraPlace {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
}

/**
 * Beyond this the nearest place is not a useful answer — a mid-ocean click
 * should return nothing rather than a town 900 km away. 250 km is chosen to
 * still resolve legitimately remote settlements (Sahara, Siberian and
 * Australian interiors) while rejecting open water.
 */
export const DEFAULT_MAX_DISTANCE_KM = 250;

const DEFAULT_DATASET_URL = "/data/places.json";
const DEFAULT_OVERRIDES_URL = "/data/places-overrides.json";

/**
 * One correction to a Natural Earth point, from public/data/places-overrides.json.
 *
 * Natural Earth is a small-scale dataset: at the zooms Mímir is read at, some
 * of its points sit kilometres from the town they name (Borgarnes 4.5 km).
 * Corrections live in their own file so a regenerated places.json can't wipe
 * them. Each names the point it corrects (`from`, as [lon, lat]); an upstream
 * update that moves or fixes that point leaves the override unused instead of
 * dragging a new point somewhere wrong.
 */
export interface PlaceOverride {
  readonly name: string;
  readonly countryCode: string;
  readonly from: readonly [lon: number, lat: number];
  readonly to: readonly [lon: number, lat: number];
}

interface OverridesPayload {
  readonly overrides?: readonly PlaceOverride[];
}

/** Coordinates in places.json carry 3 decimals; this only absorbs float noise. */
const SAME_COORDINATE_DEG = 1e-6;

/**
 * The dataset with each override's place moved to its corrected point. Returns
 * the input array itself when nothing applies, and reports overrides that no
 * longer match a place (the dataset changed under them) so they can be revisited.
 */
export function applyPlaceOverrides(
  places: readonly PlaceTuple[],
  overrides: readonly PlaceOverride[],
): { places: readonly PlaceTuple[]; unused: readonly PlaceOverride[] } {
  if (overrides.length === 0) return { places, unused: [] };
  const unused = new Set(overrides);
  let corrected: PlaceTuple[] | null = null;
  places.forEach((place, i) => {
    const [name, lon, lat, , countryCode] = place;
    const override = overrides.find(
      (o) =>
        unused.has(o) &&
        o.name === name &&
        o.countryCode === countryCode &&
        Math.abs(o.from[0] - lon) < SAME_COORDINATE_DEG &&
        Math.abs(o.from[1] - lat) < SAME_COORDINATE_DEG,
    );
    if (!override) return;
    corrected ??= [...places];
    corrected[i] = [name, override.to[0], override.to[1], ...place.slice(3)] as PlaceTuple;
    unused.delete(override);
  });
  return { places: corrected ?? places, unused: [...unused] };
}

export interface NearestPlaceIndexOptions {
  readonly url?: string;
  /** Corrections to the dataset's points; null loads none. */
  readonly overridesUrl?: string | null;
  readonly maxDistanceKm?: number;
  /**
   * Additional, already-in-memory places to consider — the app's model-specific
   * station lists (e.g. 208 points for Iceland) are far denser than Natural
   * Earth's 9 Icelandic entries, so including them markedly improves the
   * primary market. Queried by a bounded linear scan: these sets are small
   * (hundreds of points at most) and already resident, so indexing them would
   * cost more than it saves.
   */
  readonly getExtraPlaces?: () => readonly ExtraPlace[];
  readonly isDev?: boolean;
}

/**
 * Lazily-loaded spatial index over the bundled place dataset.
 *
 * `load()` is idempotent and safe to call eagerly (e.g. on map idle) so that
 * the first click has no perceptible delay.
 */
export class NearestPlaceIndex {
  private readonly url: string;
  private readonly overridesUrl: string | null;
  private readonly maxDistanceKm: number;
  private readonly getExtraPlaces?: () => readonly ExtraPlace[];
  private readonly isDev: boolean;

  private places: readonly PlaceTuple[] = [];
  private index: KDBush | null = null;
  private loading: Promise<void> | null = null;

  constructor(options: NearestPlaceIndexOptions = {}) {
    this.url = options.url ?? DEFAULT_DATASET_URL;
    this.overridesUrl =
      options.overridesUrl === undefined
        ? DEFAULT_OVERRIDES_URL
        : options.overridesUrl;
    this.maxDistanceKm = options.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM;
    this.getExtraPlaces = options.getExtraPlaces;
    this.isDev = options.isDev ?? false;
  }

  get isLoaded(): boolean {
    return this.index !== null;
  }

  /**
   * The loaded dataset, so the city-label layer can be built from the same
   * fetch rather than requesting the file a second time. Empty until loaded.
   */
  get loadedPlaces(): readonly PlaceTuple[] {
    return this.places;
  }

  /** Fetch + index the dataset once. Never rejects; failure leaves it unloaded. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  private async doLoad(): Promise<void> {
    try {
      // Fetched alongside the dataset, so the corrections cost no extra wait.
      const overridesLoad = this.loadOverrides();
      // This public asset keeps a stable URL across deployments. Revalidate it
      // so a browser cannot keep an older tuple schema while loading new code;
      // a valid cached response can still be reused after a 304.
      const resp = await fetch(this.url, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const payload = (await resp.json()) as PlacesPayload;
      if ((payload.places ?? []).length === 0) {
        throw new Error("dataset is empty");
      }
      const { places, unused } = applyPlaceOverrides(
        payload.places ?? [],
        await overridesLoad,
      );
      if (unused.length > 0) {
        console.warn(
          `[nearestPlace] ${unused.length} override(s) no longer match the dataset:`,
          unused.map((o) => o.name).join(", "),
        );
      }

      // kdbush packs into typed arrays, so building over ~7.3k points is well
      // under a millisecond and queries are O(log n) — never a linear scan.
      const index = new KDBush(places.length);
      for (const [, lon, lat] of places) index.add(lon, lat);
      index.finish();

      this.places = places;
      this.index = index;
      if (this.isDev) {
        console.log(`[nearestPlace] indexed ${places.length} places`);
      }
    } catch (error) {
      // Non-fatal: the label path still works, the fallback just goes quiet.
      console.warn(
        `[nearestPlace] could not load ${this.url}:`,
        error instanceof Error ? error.message : error,
      );
      this.loading = null;
    }
  }

  /** The coordinate overrides, or none. Never rejects: the dataset is usable without them. */
  private async loadOverrides(): Promise<readonly PlaceOverride[]> {
    if (!this.overridesUrl) return [];
    try {
      const resp = await fetch(this.overridesUrl, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const payload = (await resp.json()) as OverridesPayload;
      return Array.isArray(payload.overrides) ? payload.overrides : [];
    } catch (error) {
      console.warn(
        `[nearestPlace] could not load ${this.overridesUrl}:`,
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }

  /**
   * Nearest place to a coordinate, or null when nothing is within the distance
   * cap (or the dataset never loaded).
   *
   * geokdbush does the great-circle maths and wraps correctly across ±180°,
   * which hand-rolled Euclidean distance on lon/lat does not.
   */
  query(longitude: number, latitude: number): NearestPlace | null {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

    let best: NearestPlace | null = null;

    if (this.index) {
      const [nearestId] = around(
        this.index,
        longitude,
        latitude,
        1,
        this.maxDistanceKm,
      );
      if (nearestId !== undefined) {
        const [name, lon, lat, population, countryCode] =
          this.places[nearestId];
        best = {
          name,
          longitude: lon,
          latitude: lat,
          population: population || undefined,
          countryCode: countryCode || undefined,
          distanceKm: distance(longitude, latitude, lon, lat),
        };
      }
    }

    for (const extra of this.getExtraPlaces?.() ?? []) {
      if (!Number.isFinite(extra.lon) || !Number.isFinite(extra.lat)) continue;
      const distanceKm = distance(longitude, latitude, extra.lon, extra.lat);
      if (distanceKm > this.maxDistanceKm) continue;
      if (best && distanceKm >= best.distanceKm) continue;
      best = {
        name: extra.name,
        longitude: extra.lon,
        latitude: extra.lat,
        distanceKm,
      };
    }

    return best;
  }
}
