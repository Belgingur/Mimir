import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPlaceOverrides,
  DEFAULT_MAX_DISTANCE_KM,
  NearestPlaceIndex,
  type PlaceOverride,
  type PlaceTuple,
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
    // Once for the dataset and once for its overrides, however many loads.
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(["/data/places-overrides.json", "/data/places.json"]);
    expect(index.isLoaded).toBe(true);
  });

  it("revalidates the stable public URL across deployments", async () => {
    const fetchMock = stubFetch({ places: PLACES });
    const index = new NearestPlaceIndex();
    await index.load();
    expect(fetchMock).toHaveBeenCalledWith("/data/places.json", {
      cache: "no-cache",
    });
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

describe("place overrides", () => {
  const OVERRIDE = {
    name: "Akureyri",
    countryCode: "IS",
    from: [-18.1, 65.667] as const,
    to: [-18.0913, 65.6826] as const,
  };

  /** Answer the dataset and the overrides file each with its own payload. */
  function stubFetchByUrl(payloads: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) => {
      const payload = payloads[url];
      return payload === undefined
        ? { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }
        : { ok: true, status: 200, statusText: "OK", json: async () => payload };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("moves a place to its corrected point", async () => {
    stubFetchByUrl({
      "/data/places.json": { places: PLACES },
      "/data/places-overrides.json": { overrides: [OVERRIDE] },
    });
    const index = new NearestPlaceIndex();
    await index.load();
    const akureyri = index.loadedPlaces.find(([name]) => name === "Akureyri");
    expect(akureyri?.slice(1, 3)).toEqual([-18.0913, 65.6826]);
    // Everything else about the place, and every other place, is untouched.
    expect(akureyri?.slice(3)).toEqual([16563, "IS"]);
    expect(index.loadedPlaces.find(([name]) => name === "Reykjavík")).toEqual(PLACES[0]);
    // The spatial index is built from the corrected point too.
    expect(index.query(-18.0913, 65.6826)?.distanceKm).toBeCloseTo(0, 5);
  });

  it("leaves an override unused when the dataset's point has moved", () => {
    const moved = PLACES.map((p) =>
      p[0] === "Akureyri" ? (["Akureyri", -18.09, 65.68, 16563, "IS"] as const) : p,
    );
    const { places, unused } = applyPlaceOverrides(
      moved as unknown as PlaceTuple[],
      [OVERRIDE],
    );
    expect(places).toBe(moved);
    expect(unused).toEqual([OVERRIDE]);
  });

  it("matches the country as well as the name", () => {
    const { unused } = applyPlaceOverrides(PLACES as unknown as PlaceTuple[], [
      { ...OVERRIDE, countryCode: "NO" },
    ]);
    expect(unused).toHaveLength(1);
  });

  it("loads the dataset without corrections when the overrides file is missing", async () => {
    stubFetchByUrl({ "/data/places.json": { places: PLACES } });
    const index = new NearestPlaceIndex();
    await index.load();
    expect(index.isLoaded).toBe(true);
    expect(index.loadedPlaces).toEqual(PLACES);
  });

  it("ships overrides that all match the bundled dataset", async () => {
    const { readFile } = await import("node:fs/promises");
    const read = async (file: string) =>
      JSON.parse(await readFile(`${process.cwd()}/public/data/${file}`, "utf8"));
    const { places } = await read("places.json");
    const { overrides } = await read("places-overrides.json");
    const result = applyPlaceOverrides(places, overrides);
    expect(result.unused).toEqual([]);
    expect(overrides.map((o: PlaceOverride) => o.name)).toEqual([
      "Akureyri",
      "Ísafjörður",
      "Borgarnes",
      "Höfn",
    ]);
  });
});
