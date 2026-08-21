import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_DISTANCE_KM,
  NearestPlaceIndex,
} from "../src/lib/nearestPlace";

const PLACES: [string, number, number, number, string][] = [
  ["Reykjavík", -21.937, 64.143, 166212, "IS"],
  ["Akureyri", -18.1, 65.667, 16563, "IS"],
  ["London", -0.13, 51.51, 8567000, "GB"],
  // A discriminating antimeridian pair. From a query at 179.9°E, "Eastpoint"
  // is ~22 km away across the date line while "Westpoint" is ~545 km away on
  // the same side. Unwrapped Euclidean longitude maths reverses that: it scores
  // Eastpoint as 359.8° distant and picks Westpoint.
  ["Eastpoint", -179.9, 0, 1000, "XX"],
  ["Westpoint", 175.0, 0, 1000, "XX"],
];

function stubFetch(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? "OK" : "Not Found",
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function loadedIndex(options = {}) {
  stubFetch({ places: PLACES });
  const index = new NearestPlaceIndex(options);
  await index.load();
  return index;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NearestPlaceIndex", () => {
  it("resolves the nearest place to a click", async () => {
    const index = await loadedIndex();
    // A point in the hills just east of Reykjavík.
    const result = index.query(-21.5, 64.1);
    expect(result?.name).toBe("Reykjavík");
    expect(result?.latitude).toBe(64.143);
    expect(result?.longitude).toBe(-21.937);
    expect(result?.countryCode).toBe("IS");
    expect(result?.distanceKm).toBeLessThan(30);
  });

  it("picks the genuinely closest of several candidates", async () => {
    const index = await loadedIndex();
    expect(index.query(-18.3, 65.5)?.name).toBe("Akureyri");
    expect(index.query(-0.2, 51.4)?.name).toBe("London");
  });

  it("returns null mid-ocean instead of a distant city", async () => {
    const index = await loadedIndex();
    // Mid-North-Atlantic, well over 250 km from anything in the dataset.
    expect(index.query(-30, 55)).toBeNull();
  });

  it("honours a custom distance cap", async () => {
    const index = await loadedIndex({ maxDistanceKm: 5 });
    // ~20 km from Reykjavík: inside the default cap, outside a 5 km one.
    expect(index.query(-21.5, 64.1)).toBeNull();
  });

  it("measures great-circle distance across the antimeridian", async () => {
    const index = await loadedIndex();
    // Fails with hand-rolled Euclidean lon/lat distance, which would return
    // Westpoint; geokdbush wraps ±180° correctly and returns Eastpoint.
    const result = index.query(179.9, 0);
    expect(result?.name).toBe("Eastpoint");
    expect(result?.distanceKm).toBeLessThan(30);
    expect(result?.distanceKm).toBeLessThan(DEFAULT_MAX_DISTANCE_KM);
  });

  it("prefers a nearer extra place over the bundled dataset", async () => {
    const index = await loadedIndex({
      getExtraPlaces: () => [
        { name: "Hveragerði", lon: -21.19, lat: 64.0 },
        { name: "Selfoss", lon: -20.997, lat: 63.933 },
      ],
    });
    // Closer to the station list than to Reykjavík.
    const result = index.query(-21.2, 64.0);
    expect(result?.name).toBe("Hveragerði");
    expect(result?.distanceKm).toBeLessThan(2);
  });

  it("keeps the dataset match when it is closer than any extra", async () => {
    const index = await loadedIndex({
      getExtraPlaces: () => [{ name: "Selfoss", lon: -20.997, lat: 63.933 }],
    });
    expect(index.query(-21.9, 64.14)?.name).toBe("Reykjavík");
  });

  it("applies the distance cap to extra places too", async () => {
    const index = await loadedIndex({
      maxDistanceKm: 10,
      getExtraPlaces: () => [{ name: "Faraway", lon: 0, lat: 0 }],
    });
    expect(index.query(-30, 55)).toBeNull();
  });

  it("fetches the dataset exactly once across repeated loads", async () => {
    const fetchMock = stubFetch({ places: PLACES });
    const index = new NearestPlaceIndex();
    await Promise.all([index.load(), index.load()]);
    await index.load();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(index.isLoaded).toBe(true);
  });

  it("degrades quietly when the dataset cannot be fetched", async () => {
    stubFetch(null, false);
    const index = new NearestPlaceIndex();
    await index.load();
    expect(index.isLoaded).toBe(false);
    expect(index.query(-21.9, 64.14)).toBeNull();
  });

  it("still answers from extra places when the dataset failed to load", async () => {
    stubFetch(null, false);
    const index = new NearestPlaceIndex({
      getExtraPlaces: () => [{ name: "Selfoss", lon: -20.997, lat: 63.933 }],
    });
    await index.load();
    expect(index.query(-21.0, 63.94)?.name).toBe("Selfoss");
  });

  it("rejects a non-finite query coordinate", async () => {
    const index = await loadedIndex();
    expect(index.query(Number.NaN, 64)).toBeNull();
    expect(index.query(-21.9, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("treats an empty dataset as a failed load", async () => {
    stubFetch({ places: [] });
    const index = new NearestPlaceIndex();
    await index.load();
    expect(index.isLoaded).toBe(false);
  });
});
