import { afterEach, describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import {
  applyInitialCamera,
  requestBrowserLocation,
  readStoredLocation,
  writeStoredLocation,
  USER_LOCATION_KEY,
  LOCATED_ZOOM,
} from "../src/lib/initialCamera";

function makeMap(): {
  map: Pick<maplibregl.Map, "easeTo">;
  easeTo: ReturnType<typeof vi.fn>;
} {
  const easeTo = vi.fn();
  return { map: { easeTo } as unknown as Pick<maplibregl.Map, "easeTo">, easeTo };
}

/** A Geolocation stub whose getCurrentPosition resolves to `coords`. */
function grantGeolocation(coords: { latitude: number; longitude: number }): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback) =>
      success({ coords, timestamp: 0 } as GeolocationPosition),
    watchPosition: () => 0,
    clearWatch: () => {},
  } as unknown as Geolocation;
}

/** A Geolocation stub whose getCurrentPosition invokes the error callback. */
function denyGeolocation(): Geolocation {
  return {
    getCurrentPosition: (_s: PositionCallback, error?: PositionErrorCallback) =>
      error?.({ code: 1, message: "denied" } as GeolocationPositionError),
    watchPosition: () => 0,
    clearWatch: () => {},
  } as unknown as Geolocation;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("applyInitialCamera", () => {
  it("centres on a cached location and suppresses the model auto-centre", () => {
    const { map, easeTo } = makeMap();
    const suppressAutoCenter = vi.fn();
    applyInitialCamera(map, {
      suppressAutoCenter,
      storedLocation: { lat: 52.52, lon: 13.405 }, // Berlin
    });
    expect(suppressAutoCenter).toHaveBeenCalledTimes(1);
    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [13.405, 52.52], zoom: LOCATED_ZOOM }),
    );
  });

  it("does nothing (no prompt, no move) when there is no cached location", () => {
    const { map, easeTo } = makeMap();
    const suppressAutoCenter = vi.fn();
    applyInitialCamera(map, { suppressAutoCenter, storedLocation: null });
    expect(easeTo).not.toHaveBeenCalled();
    expect(suppressAutoCenter).not.toHaveBeenCalled();
  });

  it("reads the cached location from localStorage when not injected", () => {
    writeStoredLocation({ lat: 64.15, lon: -21.94 });
    const { map, easeTo } = makeMap();
    applyInitialCamera(map, {});
    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-21.94, 64.15] }),
    );
  });
});

describe("stored location round-trip", () => {
  it("writes and reads back a location", () => {
    writeStoredLocation({ lat: 1.5, lon: -2.5 });
    expect(readStoredLocation()).toEqual({ lat: 1.5, lon: -2.5 });
  });

  it("returns null for absent or corrupt storage", () => {
    expect(readStoredLocation()).toBeNull();
    localStorage.setItem(USER_LOCATION_KEY, "not json");
    expect(readStoredLocation()).toBeNull();
  });
});

describe("requestBrowserLocation (opt-in button)", () => {
  it("persists the location and calls onLocated on success", () => {
    const onLocated = vi.fn();
    requestBrowserLocation({
      geolocation: grantGeolocation({ latitude: 40, longitude: -3 }),
      onLocated,
    });
    expect(onLocated).toHaveBeenCalledWith({ lat: 40, lon: -3 });
    expect(readStoredLocation()).toEqual({ lat: 40, lon: -3 });
  });

  it("calls onError and stores nothing on denial", () => {
    const onLocated = vi.fn();
    const onError = vi.fn();
    requestBrowserLocation({
      geolocation: denyGeolocation(),
      onLocated,
      onError,
    });
    expect(onLocated).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(readStoredLocation()).toBeNull();
  });

  it("calls onError when the Geolocation API is unavailable", () => {
    const onError = vi.fn();
    requestBrowserLocation({
      geolocation: null,
      onLocated: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith(null);
  });
});
