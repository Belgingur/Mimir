import { describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";
import {
  findPinnedCityId,
  settlementNameKeys,
  showPinnedPlaceLabels,
} from "../src/lib/pinnedPlaceLabels";
import { CITY_LABEL_LAYER_ID } from "../src/lib/cityLabelLayer";
import type { PlaceTuple } from "../src/lib/nearestPlace";

//               name          lon       lat     pop      cc  cap rank
const PLACES: PlaceTuple[] = [
  ["London", -0.118, 51.509, 8567000, "GB", 1, 1],
  ["London", -81.245, 42.984, 346765, "CA", 0, 10],
  ["Reykjavík", -21.937, 64.143, 166212, "IS", 1, 1],
  ["Akureyri", -18.0913, 65.6826, 16563, "IS", 0, 2],
];

describe("findPinnedCityId", () => {
  it("finds the city a pin at its forecast station stands for", () => {
    // Reykjavík's pin sits on the IMO station, 2.1 km from the city's point.
    expect(findPinnedCityId(PLACES, { name: "Reykjavík", lng: -21.9079, lat: 64.1288 })).toBe(2);
  });

  it("singles out one of two same-named cities", () => {
    expect(findPinnedCityId(PLACES, { name: "London", lng: -0.12, lat: 51.5 })).toBe(0);
    expect(findPinnedCityId(PLACES, { name: "London", lng: -81.2, lat: 43.0 })).toBe(1);
  });

  it("compares names as the click path does", () => {
    expect(findPinnedCityId(PLACES, { name: "reykjavik", lng: -21.9, lat: 64.1 })).toBe(2);
  });

  it("finds nothing beyond the snapping distance, or without a name", () => {
    // 0.4° of latitude is ~44 km.
    expect(findPinnedCityId(PLACES, { name: "Akureyri", lng: -18.09, lat: 66.08 })).toBeNull();
    expect(findPinnedCityId(PLACES, { name: "", lng: -21.9, lat: 64.1 })).toBeNull();
  });
});

describe("settlementNameKeys", () => {
  it("lists the drawn name, the click path's fallbacks and every app locale once", () => {
    expect(settlementNameKeys(["is", "en", "pl"])).toEqual([
      "name:latin",
      "name",
      "name:en",
      "name:is",
      "name:pl",
    ]);
  });
});

describe("showPinnedPlaceLabels", () => {
  function makeMap() {
    const layers = new Set([CITY_LABEL_LAYER_ID, "place_town"]);
    const setFilter = vi.fn();
    const map = {
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      getFilter: () => ["==", "class", "town"],
      setFilter,
    } as unknown as maplibregl.Map;
    return { map, setFilter };
  }
  const lastFilter = (setFilter: ReturnType<typeof vi.fn>, id: string) =>
    setFilter.mock.calls.filter(([layer]) => layer === id).at(-1)?.[1];

  it("hides the pinned city in Mímir's layer and its name in the basemap's", () => {
    const { map, setFilter } = makeMap();
    showPinnedPlaceLabels(map, PLACES, { name: "Reykjavík", lng: -21.9079, lat: 64.1288 }, ["en"]);
    expect(JSON.stringify(lastFilter(setFilter, CITY_LABEL_LAYER_ID))).toContain('["!=",["id"],2]');
    expect(JSON.stringify(lastFilter(setFilter, "place_town"))).toContain('"Reykjavík"');
  });

  it("hides nothing for a pin without a name", () => {
    const { map, setFilter } = makeMap();
    showPinnedPlaceLabels(map, PLACES, { name: "  ", lng: -21.9, lat: 64.1 }, ["en"]);
    expect(setFilter).not.toHaveBeenCalled();
  });

  it("shows the labels again when the pin goes", () => {
    const { map, setFilter } = makeMap();
    showPinnedPlaceLabels(map, PLACES, { name: "Reykjavík", lng: -21.9079, lat: 64.1288 }, ["en"]);
    showPinnedPlaceLabels(map, PLACES, null, ["en"]);
    expect(JSON.stringify(lastFilter(setFilter, CITY_LABEL_LAYER_ID))).not.toContain('["id"]');
    expect(lastFilter(setFilter, "place_town")).toEqual(["==", "class", "town"]);
  });
});
