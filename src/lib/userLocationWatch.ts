import type { UserLocation } from "./initialCamera";

/**
 * Following the reader's own position, for the dot that marks it on the map
 * (the way the belgingur.is forecast map does).
 *
 * Nothing here prompts. `start()` is called once the reader has granted the
 * Geolocation permission through the "use my location" button, and
 * `resumeIfGranted()` restarts the watch on a later visit only when the
 * browser reports that permission as already granted. Revoking it hides the
 * dot again.
 */

export interface UserLocationWatchDeps {
  /** Injectable for tests; defaults to the browser Geolocation API. */
  geolocation?: Geolocation | null;
  /** Injectable for tests; defaults to the browser Permissions API. */
  permissions?: Permissions | null;
  /** Called with every new position while the watch runs. */
  onFix: (loc: UserLocation) => void;
  /** Called when the permission is revoked or denied: hide the dot. */
  onLost: () => void;
}

export interface UserLocationWatch {
  /** Follow the device. Call only once the permission is granted. */
  start(): void;
  stop(): void;
  /** Start without asking if the permission is already granted. */
  resumeIfGranted(): Promise<void>;
}

/** Positions up to three minutes old are fresh enough for a weather map. */
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 180_000,
};

/** GeolocationPositionError.PERMISSION_DENIED. */
export const PERMISSION_DENIED = 1;

export function createUserLocationWatch(
  deps: UserLocationWatchDeps,
): UserLocationWatch {
  const geolocation =
    deps.geolocation ??
    (typeof navigator !== "undefined" ? navigator.geolocation : null);
  const permissions =
    deps.permissions ??
    (typeof navigator !== "undefined" ? navigator.permissions : null);
  let watchId: number | null = null;

  const stop = (): void => {
    if (watchId !== null) geolocation?.clearWatch(watchId);
    watchId = null;
  };

  const start = (): void => {
    if (!geolocation || watchId !== null) return;
    watchId = geolocation.watchPosition(
      (position) =>
        deps.onFix({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }),
      (error) => {
        // A position that is briefly unavailable keeps the last dot; only a
        // refused permission ends the watch.
        if (error.code !== PERMISSION_DENIED) return;
        stop();
        deps.onLost();
      },
      WATCH_OPTIONS,
    );
  };

  const resumeIfGranted = async (): Promise<void> => {
    if (!geolocation || !permissions) return;
    let status: PermissionStatus;
    try {
      status = await permissions.query({ name: "geolocation" });
    } catch {
      // Browsers without a geolocation permission query: the dot appears
      // once the reader presses the button.
      return;
    }
    const sync = (): void => {
      if (status.state === "granted") {
        start();
      } else if (watchId !== null) {
        stop();
        deps.onLost();
      }
    };
    sync();
    status.addEventListener("change", sync);
  };

  return { start, stop, resumeIfGranted };
}
