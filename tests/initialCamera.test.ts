import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestBrowserLocation,
  readStoredLocation,
  writeStoredLocation,
  USER_LOCATION_KEY,
  LOCATED_ZOOM,
  LANDING_RADIUS_DEG,
  WORLD_VIEW,
  firstVisitView,
  landingBounds,
} from "../src/lib/initialCamera";

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

describe("landingBounds", () => {
  const paris = { lat: 48.9, lon: 2.3 };

  it("is a region around the point, wider in longitude away from the equator", () => {
    const [west, south, east, north] = landingBounds(paris);
    expect(north - south).toBeCloseTo(2 * LANDING_RADIUS_DEG, 5);
    expect(east - west).toBeGreaterThan(north - south);
    expect((west + east) / 2).toBeCloseTo(paris.lon, 5);
  });

  it("frames a small domain whole", () => {
    const faroes = { west: -8.8, south: 60.8, east: -5, north: 62.9 };
    expect(landingBounds({ lat: 62, lon: -6.8 }, faroes)).toEqual([-8.8, 60.8, -5, 62.9]);
  });

  it("cuts a large domain down to the reader's region", () => {
    const europe = { west: -43, south: 37.7, east: 40, north: 69.9 };
    const [west, south, east, north] = landingBounds(paris, europe);
    expect(west).toBeGreaterThan(-43);
    expect(east).toBeLessThan(40);
    expect(south).toBeCloseTo(paris.lat - LANDING_RADIUS_DEG, 5);
    expect(north).toBeCloseTo(paris.lat + LANDING_RADIUS_DEG, 5);
  });

  it("does not cut at the seam of a domain spanning every longitude", () => {
    const [west, , east] = landingBounds(
      { lat: -17.7, lon: 178.4 }, // Fiji
      { west: -180, south: -90, east: 179.75, north: 90 },
    );
    expect(west).toBeLessThan(178.4);
    expect(east).toBeGreaterThan(180);
  });

  it("keeps the region when the domain does not reach the point", () => {
    const far = { west: 100, south: -10, east: 120, north: 10 };
    expect(landingBounds(paris, far)).toEqual(landingBounds(paris));
  });
});

describe("firstVisitView", () => {
  it("centres a remembered location, ahead of a guessed one", () => {
    expect(
      firstVisitView({ stored: { lat: 52.2, lon: 21 }, guessed: { lat: 64.2, lon: -21.8 } }),
    ).toEqual({ center: [21, 52.2], zoom: LOCATED_ZOOM });
  });

  it("frames the region around a guessed location", () => {
    expect(firstVisitView({ stored: null, guessed: { lat: -23.5, lon: -46.6 } })).toEqual({
      bounds: landingBounds({ lat: -23.5, lon: -46.6 }),
      fitBoundsOptions: { padding: 40 },
    });
  });

  it("opens on the world when nothing says where the reader is", () => {
    expect(firstVisitView({ stored: null, guessed: null })).toEqual(WORLD_VIEW);
  });
});
