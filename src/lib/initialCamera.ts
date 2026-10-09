import type * as maplibregl from "maplibre-gl";
import type { ModelBBox } from "./inhouseTypes";

/**
 * First-visit landing.
 *
 * The app never prompts for the Geolocation API on first paint. A first visit
 * (no saved camera) opens on, in order:
 *   1. a location remembered from an earlier session (localStorage), centred;
 *   2. else the reader's region, guessed from the browser's time zone (see
 *      timeZoneLocation), which the catalog then frames with the most detailed
 *      model that has data there;
 *   3. else the whole world, until the catalog frames its `default` model.
 * The map is built at that view, so it never opens somewhere else and flies.
 *
 * The reader may opt in to precise positioning with the "use my location"
 * button, the ONLY place the browser's Geolocation permission prompt appears.
 */

/** localStorage key holding the last resolved approximate user location. */
export const USER_LOCATION_KEY = "mimir-user-location-v1";

export interface UserLocation {
  lat: number;
  lon: number;
}

/** Zoom used when we centre on the user's own (opt-in) position. */
export const LOCATED_ZOOM = 8;

/** Where the map opens when nothing says where the reader is. */
export const WORLD_VIEW: { center: [number, number]; zoom: number } = {
  center: [0, 30],
  zoom: 1.5,
};

/**
 * How far around a guessed location the landing view reaches, in degrees of
 * latitude (about 670 km): a region the size of a country, which is as much
 * as a time zone can say.
 */
export const LANDING_RADIUS_DEG = 6;

/** The camera a map is built with: a point and zoom, or bounds to fit. */
export type InitialView =
  | { center: [number, number]; zoom: number }
  | {
      bounds: [number, number, number, number];
      fitBoundsOptions: { padding: number };
    };

/**
 * The view around a guessed location: the box within LANDING_RADIUS_DEG of
 * it, cut to a model's bbox when one is given. A small domain is then framed
 * whole; a large one, or a global model, is cut down to the reader's region.
 */
export function landingBounds(
  point: UserLocation,
  bbox?: ModelBBox | null,
): [number, number, number, number] {
  const lonRadius =
    LANDING_RADIUS_DEG / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.2);
  const around: [number, number, number, number] = [
    point.lon - lonRadius,
    Math.max(-85, point.lat - LANDING_RADIUS_DEG),
    point.lon + lonRadius,
    Math.min(85, point.lat + LANDING_RADIUS_DEG),
  ];
  // A domain spanning every longitude has nothing to cut there, and cutting at
  // its seam would only squash a view near the antimeridian.
  if (!bbox || bbox.east - bbox.west >= 359) return around;
  const cut: [number, number, number, number] = [
    Math.max(around[0], bbox.west),
    Math.max(around[1], bbox.south),
    Math.min(around[2], bbox.east),
    Math.min(around[3], bbox.north),
  ];
  return cut[0] < cut[2] && cut[1] < cut[3] ? cut : around;
}

/**
 * The view a first visit (no saved camera) is built with. A remembered
 * location is centred; a guessed one is framed as a region, which the catalog
 * tightens to the chosen model's domain once it knows it; with neither, the
 * whole world.
 */
export function firstVisitView(opts: {
  stored: UserLocation | null;
  guessed: UserLocation | null;
}): InitialView {
  if (opts.stored) {
    return { center: [opts.stored.lon, opts.stored.lat], zoom: LOCATED_ZOOM };
  }
  if (opts.guessed) {
    return {
      bounds: landingBounds(opts.guessed),
      fitBoundsOptions: { padding: 40 },
    };
  }
  return { center: [...WORLD_VIEW.center], zoom: WORLD_VIEW.zoom };
}

/** Read the cached approximate location, or null when absent/corrupt. */
export function readStoredLocation(): UserLocation | null {
  try {
    const raw = localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserLocation>;
    if (
      typeof parsed?.lat === "number" &&
      Number.isFinite(parsed.lat) &&
      typeof parsed?.lon === "number" &&
      Number.isFinite(parsed.lon)
    ) {
      return { lat: parsed.lat, lon: parsed.lon };
    }
  } catch {
    // Access denied / bad JSON — treat as no stored location.
  }
  return null;
}

/** Persist the approximate location for subsequent visits. */
export function writeStoredLocation(loc: UserLocation): void {
  try {
    localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // Storage unavailable (private mode / quota) — non-fatal.
  }
}

export interface BrowserLocationDeps {
  /** Injectable for tests; defaults to the browser Geolocation API. */
  geolocation?: Geolocation | null;
  /** Called with the resolved location after it is persisted. */
  onLocated: (loc: UserLocation) => void;
  /** Called when the request is denied, times out, or is unavailable. */
  onError?: (error: GeolocationPositionError | null) => void;
}

/**
 * Explicit, user-initiated precise positioning (the "use my location" button).
 * This is the ONLY caller of the Geolocation API. On success the location is
 * persisted and handed to `onLocated`; failures go to `onError`.
 */
export function requestBrowserLocation(deps: BrowserLocationDeps): void {
  const geolocation =
    deps.geolocation ??
    (typeof navigator !== "undefined" ? navigator.geolocation : null);
  if (!geolocation) {
    deps.onError?.(null);
    return;
  }
  geolocation.getCurrentPosition(
    (position) => {
      const loc: UserLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      writeStoredLocation(loc);
      deps.onLocated(loc);
    },
    (error) => deps.onError?.(error),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
  );
}

const LOCATE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"></circle>' +
  '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path></svg>';

/**
 * A small MapLibre control button that triggers the opt-in Geolocation prompt.
 * Kept framework-light so it can be added alongside the other map controls.
 */
export function createLocateControl(opts: {
  label: string;
  onClick: () => void;
}): maplibregl.IControl {
  let container: HTMLDivElement | null = null;
  return {
    onAdd() {
      container = document.createElement("div");
      container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mimir-locate-btn";
      btn.title = opts.label;
      btn.setAttribute("aria-label", opts.label);
      btn.innerHTML = LOCATE_ICON;
      btn.addEventListener("click", opts.onClick);
      container.appendChild(btn);
      return container;
    },
    onRemove() {
      container?.remove();
      container = null;
    },
  };
}
