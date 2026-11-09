import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";
import {
  ModelStationLists,
  stationListUrl,
} from "../src/lib/modelStationLists";
import { createPlaceResolver } from "../src/lib/resolveClickedPlace";
import { PICKABLE_LABEL_LAYER_IDS } from "../src/lib/placeLabelPick";
import { CITY_LABEL_LAYER_ID } from "../src/lib/cityLabelLayer";

const STATIONS = {
  cities: [
    ["Reykjavík", -21.9079, 64.1288, 1],
    ["Akureyri", -18.091, 65.683, 1],
  ],
};

/** Serve each URL its own response; anything else is a 404. */
function stubFetch(responses: Record<string, () => Promise<unknown>>) {
  const fetchMock = vi.fn(async (url: string) => {
    const body = responses[url];
    return body
      ? { ok: true, status: 200, json: body }
      : { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stationListUrl", () => {
  it("takes a model's own station file", () => {
    expect(stationListUrl("BEL-IS")).toBe("/data/stations-BEL-IS.json");
    expect(stationListUrl("BEL-FO")).toBe("/data/stations-BEL-FO.json");
  });

  it("gives BEL-IS (EC) the BEL-IS stations, whose WOD config it shares", () => {
    expect(stationListUrl("BEL-IS_EC")).toBe("/data/stations-BEL-IS.json");
  });
});

describe("ModelStationLists", () => {
  it("has the stations once the model's list has loaded", async () => {
    stubFetch({ "/data/stations-BEL-IS.json": async () => STATIONS });
    const lists = new ModelStationLists();
    expect(lists.placesFor("BEL-IS")).toEqual([]);
    await lists.preload("BEL-IS");
    expect(lists.placesFor("BEL-IS")).toEqual([
      { name: "Reykjavík", lon: -21.9079, lat: 64.1288 },
      { name: "Akureyri", lon: -18.091, lat: 65.683 },
    ]);
  });

  it("fetches a list once, for every model that shares it", async () => {
    const fetchMock = stubFetch({ "/data/stations-BEL-IS.json": async () => STATIONS });
    const lists = new ModelStationLists();
    await Promise.all([lists.preload("BEL-IS"), lists.preload("BEL-IS_EC")]);
    lists.placesFor("BEL-IS");
    lists.placesFor("BEL-IS_EC");
    await lists.preload("BEL-IS");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lists.placesFor("BEL-IS_EC")).toHaveLength(2);
  });

  it("has no stations for a model without a station file", async () => {
    // No fallback to the global cities file: snapping to it would move the
    // pin with no station behind it.
    const fetchMock = stubFetch({ "/data/cities.json": async () => STATIONS });
    const lists = new ModelStationLists();
    await lists.preload("GFS");
    expect(lists.placesFor("GFS")).toEqual([]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/data/stations-GFS.json"]);
  });

  it("treats a page that isn't a station list as no list", async () => {
    stubFetch({
      // A server answering a missing file with its HTML page.
      "/data/stations-RAP.json": async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
      "/data/stations-ICON-EU.json": async () => ({ html: true }),
    });
    const lists = new ModelStationLists();
    await lists.preload("RAP");
    await lists.preload("ICON-EU");
    expect(lists.placesFor("RAP")).toEqual([]);
    expect(lists.placesFor("ICON-EU")).toEqual([]);
  });

  it("starts loading on first use, for a click that comes before any preload", async () => {
    const fetchMock = stubFetch({ "/data/stations-BEL-IS.json": async () => STATIONS });
    const lists = new ModelStationLists();
    expect(lists.placesFor("BEL-IS")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await lists.preload("BEL-IS");
    expect(lists.placesFor("BEL-IS")).toHaveLength(2);
  });
});

describe("a city click in forecast view, in a fresh session", () => {
  it("snaps to the station without the icons view having been opened", async () => {
    // The real BEL-IS station list, as the app serves it.
    const bundled = JSON.parse(
      readFileSync(`${process.cwd()}/public/data/stations-BEL-IS.json`, "utf8"),
    );
    stubFetch({
      "/data/stations-BEL-IS.json": async () => bundled,
      "/data/places.json": async () => ({ places: [["Reykjavík", -21.937, 64.143, 166212, "IS", 1, 1]] }),
      "/data/places-overrides.json": async () => ({ overrides: [] }),
    });
    const lists = new ModelStationLists();
    // What the app does on start-up and on every model change.
    await lists.preload("BEL-IS_EC");

    // Mímir's Reykjavík label, under the click.
    const map = {
      getLayer: (id: string) =>
        PICKABLE_LABEL_LAYER_IDS.includes(id as (typeof PICKABLE_LABEL_LAYER_IDS)[number])
          ? { id }
          : undefined,
      queryRenderedFeatures: () => [
        {
          layer: { id: CITY_LABEL_LAYER_ID },
          properties: { name: "Reykjavík", population: 166212 },
          geometry: { type: "Point", coordinates: [-21.937, 64.143] },
        },
      ],
      project: ([lon, lat]: [number, number]) => ({ x: lon, y: lat }),
    } as unknown as maplibregl.Map;
    const resolver = createPlaceResolver({
      map,
      getExtraPlaces: () => lists.placesFor("BEL-IS_EC"),
    });
    await resolver.preload();

    expect(resolver.resolve({ x: 0, y: 0 }, { lng: -21.937, lat: 64.143 })).toMatchObject({
      name: "Reykjavík",
      // The IMO station is.vi.1, where the corrected forecast is.
      longitude: -21.9079,
      latitude: 64.1288,
      fromStation: true,
      labelLongitude: -21.937,
      labelLatitude: 64.143,
    });
  });
});
