import { describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";
import {
  featureFilter,
  type FilterSpecification,
  type ICanonicalTileID,
} from "@maplibre/maplibre-gl-style-spec";
import {
  buildDuplicateCityFilter,
  buildPinnedSettlementFilter,
  DUPLICATE_RADIUS_M,
  FILTERED_SETTLEMENT_LAYER_IDS,
  refreshSettlementLabelFilters,
  setCityDuplicates,
  setPinnedSettlement,
  toExpressionFilter,
} from "../src/lib/settlementLabelFilters";
import type { PlaceTuple } from "../src/lib/nearestPlace";

// ─── Evaluating filters with MapLibre's own engine ───────────────────────────

const EXTENT = 8192;
const ZOOM = 10;

/** A vector-tile point feature at lon/lat, with the tile it would sit in. */
function pointFeature(
  lon: number,
  lat: number,
  properties: Record<string, unknown>,
  id?: number,
) {
  const n = 2 ** ZOOM;
  const fx = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  return {
    feature: {
      type: 1 as const,
      id,
      properties,
      geometry: [[{ x: Math.round((fx - tx) * EXTENT), y: Math.round((fy - ty) * EXTENT) }]],
    },
    canonical: { z: ZOOM, x: tx, y: ty } as unknown as ICanonicalTileID,
  };
}

function passes(
  filter: unknown,
  lon: number,
  lat: number,
  properties: Record<string, unknown>,
): boolean {
  const { feature, canonical } = pointFeature(lon, lat, properties);
  return featureFilter(filter as FilterSpecification, "filter").filter(
    { zoom: ZOOM },
    feature,
    canonical,
  );
}

// Positron's own settlement filters, as MapTiler serves them.
const TOWN = ["all", ["==", "$type", "Point"], ["==", "class", "town"]];
const VILLAGE = ["all", ["==", "$type", "Point"], ["==", "class", "village"]];

describe("toExpressionFilter", () => {
  // Each legacy form, against features chosen to hit its edge cases. The
  // converted filter must agree with MapLibre's reading of the legacy one.
  const LEGACY: unknown[] = [
    TOWN,
    VILLAGE,
    ["all", ["==", "$type", "Point"], ["in", "class", "continent", "hamlet", "neighbourhood"]],
    ["!in", "class", "town", "city"],
    ["has", "rank"],
    ["!has", "rank"],
    ["none", ["==", "class", "town"], ["==", "class", "city"]],
    ["any", [">", "rank", 3], ["==", "capital", 2]],
    ["all", ["<=", "rank", 3], ["!=", "capital", 2]],
    ["==", "name", null],
    ["!=", "name", null],
    ["in", "rank", 1, "2", 3],
  ];
  const FEATURES: Record<string, unknown>[] = [
    { class: "town", rank: 6, name: "Keflavík" },
    { class: "village", rank: 2 },
    { class: "city", rank: 4, capital: 2 },
    { class: "hamlet" },
    { class: "town", rank: "6" }, // wrong type for an ordering test
    { name: null, rank: 1 },
    {},
  ];

  it.each(LEGACY.map((f) => [JSON.stringify(f), f]))(
    "agrees with MapLibre on %s",
    (_label, legacy) => {
      const converted = toExpressionFilter(legacy);
      for (const props of FEATURES) {
        expect(passes(converted, 0, 0, props), JSON.stringify(props)).toBe(
          passes(legacy, 0, 0, props),
        );
      }
    },
  );

  it("can be extended with expression terms", () => {
    // A legacy filter can't take an expression term; the converted one can.
    const combined = ["all", toExpressionFilter(TOWN), ["!=", ["get", "name"], "Keflavík"]];
    expect(passes(combined, 0, 0, { class: "town", name: "Garður" })).toBe(true);
    expect(passes(combined, 0, 0, { class: "town", name: "Keflavík" })).toBe(false);
    expect(passes(combined, 0, 0, { class: "village", name: "Garður" })).toBe(false);
  });

  it("leaves expression filters and missing filters alone", () => {
    const expression = ["==", ["get", "class"], "town"];
    expect(toExpressionFilter(expression)).toBe(expression);
    expect(toExpressionFilter(undefined)).toBe(true);
    expect(toExpressionFilter(true)).toBe(true);
  });
});

// ─── Duplicates of Mímir's cities ────────────────────────────────────────────

//               name         lon       lat    pop      cc  cap rank
const PLACES: PlaceTuple[] = [
  ["Keflavík", -22.567, 64.017, 7930, "IS", 0, 3],
  ["Borgarnes", -21.862, 64.57, 1783, "IS", 0, 8],
  ["London", -0.118, 51.509, 8567000, "GB", 1, 1],
  // Two places sharing a name: either one hides its own duplicate.
  ["Santiago", -70.648, -33.45, 5720000, "CL", 1, 1],
  ["Santiago", -8.545, 42.881, 95092, "ES", 0, 40],
];

describe("buildDuplicateCityFilter", () => {
  const dedupe = buildDuplicateCityFilter(PLACES);
  const town = (lon: number, lat: number, props: Record<string, unknown>) =>
    passes(["all", toExpressionFilter(TOWN), dedupe], lon, lat, { class: "town", ...props });

  it("hides the basemap's own label for a Mímir city", () => {
    // Where positron puts Keflavík: 2.0 km from Natural Earth's point.
    expect(town(-22.5565, 63.9998, { "name:latin": "Keflavík" })).toBe(false);
    // Borgarnes, the widest gap measured in Iceland (4.5 km).
    expect(town(-21.9258, 64.54, { "name:latin": "Borgarnes" })).toBe(false);
  });

  it("keeps a same-named place farther away than the radius", () => {
    // London, Ontario is not London, England.
    expect(town(-81.245, 42.984, { "name:latin": "London" })).toBe(true);
    // 0.15° of latitude is about 16.7 km, beyond the 10 km radius.
    expect(town(-22.567, 64.017 + 0.15, { "name:latin": "Keflavík" })).toBe(true);
  });

  it("matches each of several same-named cities", () => {
    expect(town(-8.54, 42.88, { "name:latin": "Santiago" })).toBe(false);
    expect(town(-70.65, -33.44, { "name:latin": "Santiago" })).toBe(false);
    expect(town(-99.0, 20.0, { "name:latin": "Santiago" })).toBe(true);
  });

  it("keeps labels with another name, or without a name at all", () => {
    expect(town(-22.5427, 63.9733, { "name:latin": "Njarðvík" })).toBe(true);
    expect(town(-22.5565, 63.9998, {})).toBe(true);
  });

  it("still applies the style's own filter", () => {
    expect(
      passes(["all", toExpressionFilter(TOWN), dedupe], -22.5427, 63.9733, {
        class: "suburb",
        "name:latin": "Njarðvík",
      }),
    ).toBe(false);
  });

  it("is built once per dataset", () => {
    expect(buildDuplicateCityFilter(PLACES)).toBe(dedupe);
    expect(buildDuplicateCityFilter([])).toBeNull();
  });

  it("uses a 10 km radius", () => {
    expect(DUPLICATE_RADIUS_M).toBe(10_000);
  });
});

// ─── Applying the filters to the map ─────────────────────────────────────────

function makeMap(initial: Record<string, unknown> = { place_town: TOWN, place_village: VILLAGE }) {
  const layers = new Map<string, { id: string }>();
  const filters = new Map<string, unknown>();
  for (const [id, filter] of Object.entries(initial)) {
    layers.set(id, { id });
    filters.set(id, filter);
  }
  const setFilter = vi.fn((id: string, filter: unknown) => filters.set(id, filter));
  const map = {
    getLayer: (id: string) => layers.get(id),
    getFilter: (id: string) => filters.get(id),
    setFilter,
  } as unknown as maplibregl.Map;
  /** Swap in a fresh style: new layer objects with the style's filters again. */
  const reloadStyle = () => {
    for (const [id, filter] of Object.entries(initial)) {
      layers.set(id, { id });
      filters.set(id, filter);
    }
  };
  return { map, setFilter, filters, reloadStyle };
}

describe("setCityDuplicates", () => {
  it("adds the duplicate filter to the town and village layers", () => {
    const { map, filters } = makeMap();
    setCityDuplicates(map, PLACES);
    for (const id of FILTERED_SETTLEMENT_LAYER_IDS) {
      const filter = filters.get(id) as unknown[];
      expect(filter[0]).toBe("all");
      expect(filter).toContain(buildDuplicateCityFilter(PLACES));
    }
    // The style's own terms survive.
    expect(passes(filters.get("place_town"), 0, 0, { class: "village" })).toBe(false);
  });

  it("restores the style's filters exactly when switched off", () => {
    const { map, filters } = makeMap();
    setCityDuplicates(map, PLACES);
    setCityDuplicates(map, null);
    expect(filters.get("place_town")).toEqual(TOWN);
    expect(filters.get("place_village")).toEqual(VILLAGE);
  });

  it("does not touch a layer again when nothing changed", () => {
    const { map, setFilter } = makeMap();
    setCityDuplicates(map, PLACES);
    setFilter.mockClear();
    setCityDuplicates(map, PLACES);
    refreshSettlementLabelFilters(map);
    expect(setFilter).not.toHaveBeenCalled();
  });

  it("re-applies on top of a reloaded style's own filters", () => {
    const { map, filters, reloadStyle } = makeMap();
    setCityDuplicates(map, PLACES);
    reloadStyle();
    refreshSettlementLabelFilters(map);
    const filter = filters.get("place_town") as unknown[];
    expect(filter).toContain(buildDuplicateCityFilter(PLACES));
    // Built from the new style's filter, not by nesting the old combined one.
    expect(JSON.stringify(filter).match(/"all"/g)?.length).toBe(2);
  });

  it("skips layers the style doesn't have", () => {
    const { map, setFilter } = makeMap({ place_town: TOWN });
    setCityDuplicates(map, PLACES);
    expect(setFilter).toHaveBeenCalledTimes(1);
    expect(setFilter.mock.calls[0][0]).toBe("place_town");
  });
});

// ─── The pinned place ────────────────────────────────────────────────────────

describe("buildPinnedSettlementFilter", () => {
  const KEYS = ["name:latin", "name", "name:en", "name:is"];
  // A pin dropped on Njarðvík's basemap label.
  const pin = { name: "Njarðvík", lng: -22.5427, lat: 63.9733 };
  const kept = (lon: number, lat: number, props: Record<string, unknown>) =>
    passes(buildPinnedSettlementFilter(pin, 25_000, KEYS), lon, lat, props);

  it("hides the pinned place's label", () => {
    expect(kept(-22.5427, 63.9733, { "name:latin": "Njarðvík" })).toBe(false);
  });

  it("ignores case and accents, as the click path does", () => {
    expect(kept(-22.5427, 63.9733, { "name:latin": "NJARDVIK" })).toBe(false);
  });

  it("matches a name the click may have taken from another property", () => {
    // A click in Icelandic takes name:is, which can differ from the drawn name.
    const garður = { name: "Sveitarfélagið Garður", lng: -22.6512, lat: 64.0703 };
    expect(
      passes(buildPinnedSettlementFilter(garður, 25_000, KEYS), -22.6512, 64.0703, {
        "name:latin": "Garður",
        "name:is": "Sveitarfélagið Garður",
      }),
    ).toBe(false);
  });

  it("keeps other names, and the same name beyond the radius", () => {
    expect(kept(-22.5565, 63.9998, { "name:latin": "Keflavík" })).toBe(true);
    // ~30 km north: a different Njarðvík, if there were one.
    expect(kept(-22.5427, 64.24, { "name:latin": "Njarðvík" })).toBe(true);
  });

  it("keeps a label that lacks the name properties", () => {
    expect(kept(-22.5427, 63.9733, {})).toBe(true);
  });
});

describe("setPinnedSettlement", () => {
  const KEYS = ["name:latin", "name"];
  const pin = { name: "Njarðvík", lng: -22.5427, lat: 63.9733 };

  it("adds the pin term next to the duplicates term", () => {
    const { map, filters } = makeMap();
    setCityDuplicates(map, PLACES);
    setPinnedSettlement(map, pin, 25_000, KEYS);
    const town = filters.get("place_town");
    expect(town).toContain(buildDuplicateCityFilter(PLACES));
    expect(passes(town, -22.5427, 63.9733, { class: "town", "name:latin": "Njarðvík" })).toBe(false);
    expect(passes(town, -22.5565, 63.9998, { class: "town", "name:latin": "Keflavík" })).toBe(false);
    expect(passes(town, -22.6512, 64.0703, { class: "town", "name:latin": "Garður" })).toBe(true);
  });

  it("drops only the pin term when the pin goes", () => {
    const { map, filters } = makeMap();
    setCityDuplicates(map, PLACES);
    setPinnedSettlement(map, pin, 25_000, KEYS);
    setPinnedSettlement(map, null, 25_000, KEYS);
    expect(filters.get("place_town")).toEqual([
      "all",
      toExpressionFilter(TOWN),
      buildDuplicateCityFilter(PLACES),
    ]);
    setCityDuplicates(map, null);
    expect(filters.get("place_town")).toEqual(TOWN);
  });

  it("leaves the layers alone when the same pin is shown again", () => {
    const { map, setFilter } = makeMap();
    setPinnedSettlement(map, pin, 25_000, KEYS);
    setFilter.mockClear();
    setPinnedSettlement(map, { ...pin }, 25_000, KEYS);
    expect(setFilter).not.toHaveBeenCalled();
  });

  it("is re-applied over a reloaded style", () => {
    const { map, filters, reloadStyle } = makeMap();
    setPinnedSettlement(map, pin, 25_000, KEYS);
    reloadStyle();
    refreshSettlementLabelFilters(map);
    expect(passes(filters.get("place_town"), -22.5427, 63.9733, { class: "town", "name:latin": "Njarðvík" })).toBe(false);
  });
});
