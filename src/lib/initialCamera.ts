import type maplibregl from "maplibre-gl";

/**
 * First-visit landing (task A1).
 *
 * The app never prompts for the Geolocation API on first paint. Instead:
 *   1. A location cached from a previous session (localStorage) is reused
 *      immediately — zero latency, zero permission friction.
 *   2. Otherwise the map stays on the Iceland overview and the coverage-aware
 *      model picker falls back to Reykjavík (see InhouseCatalogController's
 *      getAutoSelectLocation), landing on the finest healthy model for Iceland.
 *   3. The user may opt in to precise positioning via the explicit
 *      "use my location" button, which is the ONLY place the browser
 *      Geolocation permission prompt can appear.
 */

/** localStorage key holding the last resolved approximate user location. */
export const USER_LOCATION_KEY = "mimir-user-location-v1";

export interface UserLocation {
  lat: number;
  lon: number;
}

/**
 * Reykjavík / Iceland fallback used when no location is known. The app is
 * Iceland-centric, so this is the "sensible default" the landing brief asks for.
 */
export const REYKJAVIK_VIEW: { center: [number, number]; zoom: number } = {
  center: [-21.94, 64.15],
  zoom: 8,
};

/** Zoom used when we centre on the user's own (opt-in) position. */
export const LOCATED_ZOOM = 8;

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

export interface InitialCameraDeps {
  /**
   * Suppress the model's one-shot domain auto-centre for this first load, so it
   * can't clobber the located view when the first model finishes loading.
   * Consumed once by the next centerMapOnInhouseDomain() call.
   */
  suppressAutoCenter?: () => void;
  /** Injectable for tests; defaults to reading localStorage. */
  storedLocation?: UserLocation | null;
}

/**
 * First-visit camera (task A1). Only called when there is no persisted camera
 * to restore. When a cached location exists we centre on it (and suppress the
 * model domain auto-centre so it can't override the point); otherwise we do
 * nothing and let the coverage-aware model picker centre on its domain
 * (Iceland overview fallback). Never triggers a permission prompt.
 */
export function applyInitialCamera(
  map: Pick<maplibregl.Map, "easeTo">,
  deps: InitialCameraDeps = {},
): void {
  const stored =
    deps.storedLocation !== undefined ? deps.storedLocation : readStoredLocation();
  if (!stored) return;

  // We own the camera for this first load — keep the model's domain auto-centre
  // from moving us off the user's point.
  deps.suppressAutoCenter?.();
  map.easeTo({
    center: [stored.lon, stored.lat],
    zoom: LOCATED_ZOOM,
    duration: 600,
  });
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
