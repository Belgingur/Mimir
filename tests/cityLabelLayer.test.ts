import { describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import {
  addCityLabelLayer,
  buildCityFilter,
  buildCityGeoJSON,
  CITY_DOT_LAYER_ID,
  CITY_LABEL_LAYER_ID,
  CITY_LABEL_SOURCE_ID,
  CAPITAL_POPULATION_BY_ZOOM,
  NATIONAL_RANK_BY_ZOOM,
  POPULATION_BY_ZOOM,
} from "../src/lib/cityLabelLayer";
import type { PlaceTuple } from "../src/lib/nearestPlace";

//            name          lon      lat     pop   cc  capital natRank
const PLACES: PlaceTuple[] = [
  ["Tokyo", 139.749, 35.687, 35676000, "JP", 1, 1],
  ["Barcelona", 2.175, 41.385, 4920000, "ES", 0, 2],
  ["Madrid", -3.702, 40.42, 5567000, "ES", 1, 1],
  ["Bourges", 2.4, 47.084, 70828, "FR", 0, 60],
  ["Reykjavík", -21.937, 64.143, 166212, "IS", 1, 1],
  ["Akureyri", -18.1, 65.667, 16563, "IS", 0, 2],
  // A tiny capital: only the capital rung can let this one in.
  ["Vaduz", 9.517, 47.134, 36281, "LI", 1, 1],
];

/**
 * Evaluate the filter the way MapLibre would, for one feature at one zoom.
 * Only the handful of expression forms the filter actually uses are supported.
 */
function evaluate(expr: unknown, props: Record<string, number>, zoom: number) {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr as [string, ...unknown[]];
  switch (op) {
    case "zoom":
      return zoom;
    case "get":
      return props[args[0] as string];
    case "any":
      return args.some((a) => evaluate(a, props, zoom));
    case "all":
      return args.every((a) => evaluate(a, props, zoom));
    case "==":
      return evaluate(args[0], props, zoom) === evaluate(args[1], props, zoom);
    case ">=":
      return (
        (evaluate(args[0], props, zoom) as number) >=
        (evaluate(args[1], props, zoom) as number)
      );
    case "<=":
      return (
        (evaluate(args[0], props, zoom) as number) <=
        (evaluate(args[1], props, zoom) as number)
      );
    case "step": {
      const input = evaluate(args[0], props, zoom) as number;
      let out = args[1];
      for (let i = 2; i < args.length; i += 2) {
        if (input >= (args[i] as number)) out = args[i + 1];
        else break;
      }
      return out;
    }
    default:
      throw new Error(`unsupported op ${op}`);
  }
}

const shows = (
  place: PlaceTuple,
  zoom: number,
  filter = buildCityFilter(),
): boolean =>
  evaluate(
    filter,
    { population: place[3], capital: place[5], nationalRank: place[6] },
    zoom,
  ) as boolean;

const byName = (name: string) =>
  PLACES.find((p) => p[0] === name) as PlaceTuple;

describe("city label population tiers", () => {
  it("steps down through 500k → 250k → 100k as you zoom in", () => {
    const tiers = new Map(POPULATION_BY_ZOOM);
    expect(tiers.get(5)).toBe(500_000);
    expect(tiers.get(6)).toBe(250_000);
    expect(tiers.get(8)).toBe(100_000);
    // Thresholds must only ever loosen with zoom.
    const values = POPULATION_BY_ZOOM.map(([, pop]) => pop);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  it("admits a city once its population clears the tier", () => {
    const bourges = byName("Bourges"); // 70,828, France's 60th place
    expect(shows(bourges, 5)).toBe(false);
    expect(shows(bourges, 8)).toBe(false);
    // Only once the tier drops to zero at z10.
    expect(shows(bourges, 10)).toBe(true);
  });

  it("opens the capital rung before the general-city rung", () => {
    const firstCapitalZoom = CAPITAL_POPULATION_BY_ZOOM.find(
      ([, pop]) => pop < 1e12,
    )?.[0];
    const firstCityZoom = POPULATION_BY_ZOOM.find(([, pop]) => pop < 1e12)?.[0];
    expect(firstCapitalZoom).toBeLessThan(firstCityZoom as number);
  });

  it("shows no city at all on the far-out view", () => {
    // Zoomed right out the map is country borders and country names; even
    // Tokyo stays off until the capitals rung at z3.
    for (const place of PLACES) {
      expect(shows(place, 0)).toBe(false);
      expect(shows(place, 2)).toBe(false);
    }
  });

  it("brings in major capitals first, at z3", () => {
    expect(shows(byName("Tokyo"), 3)).toBe(true);
    expect(shows(byName("Madrid"), 3)).toBe(true);
    // Not a capital, and the general-city tier has not opened yet.
    expect(shows(byName("Barcelona"), 3)).toBe(false);
  });

  it("adds the remaining capitals and megacities at z4", () => {
    // Vaduz is 36k: only the capital rung can admit it.
    expect(shows(byName("Vaduz"), 3)).toBe(false);
    expect(shows(byName("Vaduz"), 4)).toBe(true);
    expect(shows(byName("Reykjavík"), 4)).toBe(true);
    // A 4.9M non-capital clears the 5M megacity cut only just short...
    expect(shows(byName("Barcelona"), 4)).toBe(false);
    expect(shows(byName("Barcelona"), 5)).toBe(true);
  });

  it("reveals a small country's second city as cities open up", () => {
    const akureyri = byName("Akureyri"); // 16.5k, national rank 2
    expect(shows(akureyri, 4)).toBe(false);
    expect(shows(akureyri, 5)).toBe(false);
    expect(shows(akureyri, 6)).toBe(true);
  });

  it("keeps a small country represented once cities appear", () => {
    // Reykjavík is 166k — under every population tier until z8 — but is both
    // Iceland's capital and its largest place, so it is never missing.
    for (const zoom of [4, 5, 6, 8, 10]) {
      expect(shows(byName("Reykjavík"), zoom)).toBe(true);
    }
  });

  it("loosens the national-rank tier monotonically too", () => {
    const ranks = NATIONAL_RANK_BY_ZOOM.map(([, rank]) => rank);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  it("shows everything once fully zoomed in", () => {
    for (const place of PLACES) expect(shows(place, 12)).toBe(true);
  });
});

describe("buildCityGeoJSON", () => {
  it("carries the fields the filter and click path need", () => {
    const fc = buildCityGeoJSON(PLACES);
    expect(fc.features).toHaveLength(PLACES.length);
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [139.749, 35.687] },
      properties: {
        name: "Tokyo",
        population: 35676000,
        countryCode: "JP",
        capital: 1,
        nationalRank: 1,
      },
    });
  });
});

describe("addCityLabelLayer", () => {
  function makeMap(existing: string[] = []) {
    const present = new Set(existing);
    const setData = vi.fn();
    const map = {
      getSource: (id: string) => (present.has(id) ? { setData } : undefined),
      addSource: vi.fn((id: string) => present.add(id)),
      getLayer: (id: string) => (present.has(id) ? { id } : undefined),
      addLayer: vi.fn((layer: { id: string }) => present.add(layer.id)),
      setFilter: vi.fn(),
    };
    return { map: map as unknown as maplibregl.Map, setData, raw: map };
  }

  it("adds the source and both layers on first call", () => {
    const { raw, map } = makeMap();
    addCityLabelLayer(map, PLACES);
    expect(raw.addSource).toHaveBeenCalledTimes(1);
    const added = raw.addLayer.mock.calls.map(([l]) => (l as { id: string }).id);
    expect(added).toEqual([CITY_DOT_LAYER_ID, CITY_LABEL_LAYER_ID]);
  });

  it("labels come from the dataset's name field", () => {
    const { raw, map } = makeMap();
    addCityLabelLayer(map, PLACES);
    const [layer] = raw.addLayer.mock.calls[1] as unknown as [
      { layout: Record<string, unknown> },
    ];
    expect(layer.layout["text-field"]).toEqual(["get", "name"]);
    // Bigger cities should win collisions against smaller neighbours.
    expect(layer.layout["symbol-sort-key"]).toEqual([
      "-",
      0,
      ["get", "population"],
    ]);
  });

  it("updates in place instead of re-adding on a second call", () => {
    const { raw, map, setData } = makeMap([
      CITY_LABEL_SOURCE_ID,
      CITY_DOT_LAYER_ID,
      CITY_LABEL_LAYER_ID,
    ]);
    addCityLabelLayer(map, PLACES);
    expect(raw.addSource).not.toHaveBeenCalled();
    expect(raw.addLayer).not.toHaveBeenCalled();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(raw.setFilter).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the dataset failed to load", () => {
    const { raw, map } = makeMap();
    addCityLabelLayer(map, []);
    expect(raw.addSource).not.toHaveBeenCalled();
    expect(raw.addLayer).not.toHaveBeenCalled();
  });
});
