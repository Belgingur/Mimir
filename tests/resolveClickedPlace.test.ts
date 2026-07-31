import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import {
  createPlaceResolver,
  foldName,
} from "../src/lib/resolveClickedPlace";
import { PICKABLE_LABEL_LAYER_IDS } from "../src/lib/placeLabelPick";
import { CITY_LABEL_LAYER_ID } from "../src/lib/cityLabelLayer";

const PLACES: [string, number, number, number, string, number][] = [
  ["Reykjavík", -21.937, 64.143, 166212, "IS", 1],
  ["Akureyri", -18.1, 65.667, 16563, "IS", 2],
];

interface FakeFeature {
  layer?: { id: string };
  sourceLayer?: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: [number, number] };
}

/** A feature from Mímir's own city layer. */
function cityFeature(
  name: string,
  lon: number,
  lat: number,
  props: Record<string, unknown> = {},
): FakeFeature {
  return {
    layer: { id: CITY_LABEL_LAYER_ID },
    properties: { name, population: 100000, ...props },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

function makeMap(features: FakeFeature[]) {
  return {
    getLayer: (id: string) =>
      PICKABLE_LABEL_LAYER_IDS.includes(
        id as (typeof PICKABLE_LABEL_LAYER_IDS)[number],
      )
        ? { id }
        : undefined,
    queryRenderedFeatures: vi.fn(() => features),
    project: ([lon, lat]: [number, number]) => ({ x: lon, y: lat }),
  } as unknown as maplibregl.Map;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ places: PLACES }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const POINT = { x: 100, y: 50 };

describe("foldName", () => {
  it("ignores accents, case and punctuation", () => {
    expect(foldName("Ísafjörður")).toBe(foldName("Isafjordur"));
    expect(foldName("REYKJAVÍK")).toBe(foldName("Reykjavík"));
    expect(foldName("Saint-Étienne")).toBe(foldName("saint etienne"));
  });

  it("keeps genuinely different names apart", () => {
    expect(foldName("Akureyri")).not.toBe(foldName("Reykjavík"));
  });
});

describe("createPlaceResolver", () => {
  it("returns the city's own point when its label is clicked", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([cityFeature("Reykjavík", -21.937, 64.143)]),
    });
    await resolver.preload();
    // Clicked slightly off the city's point...
    const result = resolver.resolve(POINT, { lng: -21.5, lat: 64.0 });
    // ...and got the city's point back, not the click.
    expect(result).toMatchObject({
      name: "Reykjavík",
      latitude: 64.143,
      longitude: -21.937,
      source: "label",
      fromStation: false,
    });
  });

  it("snaps a selected city onto its station's exact coordinates", async () => {
    const resolver = createPlaceResolver({
      // The dataset centroid and the station differ by a few hundred metres;
      // the station is the point the forecast is actually computed for.
      map: makeMap([cityFeature("Akureyri", -18.1, 65.667)]),
      getExtraPlaces: () => [
        { name: "Akureyri", lon: -18.0878, lat: 65.6835 },
        { name: "Reykjavík", lon: -21.9333, lat: 64.1333 },
      ],
    });
    await resolver.preload();
    const result = resolver.resolve(POINT, { lng: -18.09, lat: 65.68 });
    expect(result).toMatchObject({
      name: "Akureyri",
      longitude: -18.0878,
      latitude: 65.6835,
      fromStation: true,
    });
  });

  it("matches a station name across accents", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([cityFeature("Ísafjörður", -23.15, 66.083)]),
      getExtraPlaces: () => [
        { name: "Isafjordur", lon: -23.1333, lat: 66.0755 },
      ],
    });
    await resolver.preload();
    expect(resolver.resolve(POINT, { lng: -23.15, lat: 66.08 })).toMatchObject({
      longitude: -23.1333,
      fromStation: true,
    });
  });

  it("ignores a same-named station that is far away", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([cityFeature("Springfield", -89.65, 39.78)]),
      // A different Springfield, 1500 km off — not this one.
      getExtraPlaces: () => [{ name: "Springfield", lon: -72.58, lat: 42.1 }],
    });
    await resolver.preload();
    expect(resolver.resolve(POINT, { lng: -89.65, lat: 39.78 })).toMatchObject({
      longitude: -89.65,
      latitude: 39.78,
      fromStation: false,
    });
  });

  it("does not move the point for a click on open ground", async () => {
    const resolver = createPlaceResolver({ map: makeMap([]) });
    await resolver.preload();
    const result = resolver.resolve(POINT, { lng: -21.5, lat: 64.1 });
    // The nearest city is reported for context...
    expect(result?.name).toBe("Reykjavík");
    expect(result?.source).toBe("dataset");
    expect(result?.distanceKm).toBeGreaterThan(0);
    // ...and callers are expected to keep the clicked coordinate; the result
    // carries the city's location, explicitly flagged as a non-selection.
    expect(result?.fromStation).toBeUndefined();
  });

  it("returns nothing for a mid-ocean click", async () => {
    const resolver = createPlaceResolver({ map: makeMap([]) });
    await resolver.preload();
    expect(resolver.resolve(POINT, { lng: -30, lat: 55 })).toBeNull();
  });

  it("still picks up basemap labels for small places", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([
        {
          sourceLayer: "place",
          properties: { name: "Hveragerði", class: "town", rank: 7 },
          geometry: { type: "Point", coordinates: [-21.19, 64.0] },
        },
      ]),
    });
    await resolver.preload();
    expect(resolver.resolve(POINT, { lng: -21.19, lat: 64.0 })).toMatchObject({
      name: "Hveragerði",
      source: "label",
    });
  });

  it("prefers its own city feature over a basemap label at the same spot", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([
        {
          sourceLayer: "place",
          properties: { name: "Reykjavik Suburb", class: "suburb", rank: 9 },
          geometry: { type: "Point", coordinates: [-21.93, 64.14] },
        },
        cityFeature("Reykjavík", -21.937, 64.143),
      ]),
    });
    await resolver.preload();
    expect(resolver.resolve(POINT, { lng: -21.9, lat: 64.14 })?.name).toBe(
      "Reykjavík",
    );
  });

  it("issues no request at all on the label path", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([cityFeature("Reykjavík", -21.937, 64.143)]),
    });
    resolver.resolve(POINT, { lng: -21.5, lat: 64.0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("preloads once and resolves synchronously afterwards", async () => {
    const resolver = createPlaceResolver({ map: makeMap([]) });
    await resolver.preload();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolver.resolve(POINT, { lng: -21.5, lat: 64.1 })?.name).toBe(
      "Reykjavík",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes the loaded dataset for the city-label layer", async () => {
    const resolver = createPlaceResolver({ map: makeMap([]) });
    expect(resolver.loadedPlaces()).toHaveLength(0);
    await resolver.preload();
    expect(resolver.loadedPlaces()).toHaveLength(PLACES.length);
  });

  it("passes the app locale through to the label name lookup", async () => {
    const resolver = createPlaceResolver({
      map: makeMap([
        {
          sourceLayer: "place",
          properties: {
            name: "Copenhagen",
            "name:is": "Kaupmannahöfn",
            class: "city",
          },
          geometry: { type: "Point", coordinates: [12.57, 55.68] },
        },
      ]),
      getLocale: () => "is",
    });
    expect(resolver.resolve(POINT, { lng: 12.5, lat: 55.6 })?.name).toBe(
      "Kaupmannahöfn",
    );
  });
});
