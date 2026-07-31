import { describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import {
  getPresentSettlementLayerIds,
  pickPlaceLabel,
  SETTLEMENT_LAYER_IDS,
} from "../src/lib/placeLabelPick";

interface FakeFeature {
  sourceLayer?: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates?: [number, number] };
}

function makeFeature(
  name: string,
  lon: number,
  lat: number,
  extra: Record<string, unknown> = {},
): FakeFeature {
  return {
    sourceLayer: "place",
    properties: { name, ...extra },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

/**
 * Minimal MapLibre stand-in. `project` maps lon/lat to screen pixels with a
 * 1° = 1px scale so screen distances in the tests are easy to reason about.
 */
function makeMap(
  features: FakeFeature[],
  options: { presentLayers?: readonly string[] } = {},
) {
  const present = new Set(options.presentLayers ?? SETTLEMENT_LAYER_IDS);
  const queryRenderedFeatures = vi.fn(() => features);
  const map = {
    getLayer: (id: string) => (present.has(id) ? { id } : undefined),
    queryRenderedFeatures,
    project: ([lon, lat]: [number, number]) => ({ x: lon, y: lat }),
  };
  return { map: map as unknown as maplibregl.Map, queryRenderedFeatures };
}

const POINT = { x: 100, y: 50 };

describe("getPresentSettlementLayerIds", () => {
  it("keeps only layers the loaded style actually has", () => {
    const { map } = makeMap([], { presentLayers: ["place_city", "place_town"] });
    expect(getPresentSettlementLayerIds(map)).toEqual([
      "place_city",
      "place_town",
    ]);
  });

  it("is empty for a style with no place layers (demotiles fallback)", () => {
    const { map } = makeMap([], { presentLayers: [] });
    expect(getPresentSettlementLayerIds(map)).toEqual([]);
  });
});

describe("pickPlaceLabel", () => {
  it("returns the label's own name and coordinates", () => {
    const { map } = makeMap([
      makeFeature("Reykjavík", -21.9, 64.15, { class: "city", rank: 2 }),
    ]);
    expect(pickPlaceLabel(map, POINT, { coarsePointer: false })).toEqual({
      name: "Reykjavík",
      longitude: -21.9,
      latitude: 64.15,
      placeClass: "city",
      rank: 2,
    });
  });

  it("queries a box around the cursor, not a single pixel", () => {
    const { map, queryRenderedFeatures } = makeMap([]);
    pickPlaceLabel(map, POINT, { coarsePointer: false });
    expect(queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [94, 44],
        [106, 56],
      ],
      { layers: [...SETTLEMENT_LAYER_IDS] },
    );
  });

  it("widens the box for coarse pointers so touch taps need no precision", () => {
    const { map, queryRenderedFeatures } = makeMap([]);
    pickPlaceLabel(map, POINT, { coarsePointer: true });
    expect(queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [90, 40],
        [110, 60],
      ],
      { layers: [...SETTLEMENT_LAYER_IDS] },
    );
  });

  it("restricts the query to settlement layers only", () => {
    const { map, queryRenderedFeatures } = makeMap([]);
    pickPlaceLabel(map, POINT);
    const [, opts] = queryRenderedFeatures.mock.calls[0] as unknown as [
      unknown,
      { layers: string[] },
    ];
    // Region + country labels are not clickable settlements.
    expect(opts.layers).not.toContain("place_state");
    expect(opts.layers).not.toContain("place_country_major");
  });

  it("prefers the localised name variant when present", () => {
    const { map } = makeMap([
      makeFeature("Copenhagen", 12.57, 55.68, {
        "name:is": "Kaupmannahöfn",
        class: "city",
      }),
    ]);
    expect(pickPlaceLabel(map, POINT, { locale: "is" })?.name).toBe(
      "Kaupmannahöfn",
    );
  });

  it("falls back to name when the locale variant is missing", () => {
    const { map } = makeMap([
      makeFeature("Akureyri", -18.1, 65.68, { class: "town" }),
    ]);
    expect(pickPlaceLabel(map, POINT, { locale: "fo" })?.name).toBe("Akureyri");
  });

  it("splits the newline-joined latin/nonlatin script pair", () => {
    const { map } = makeMap([
      makeFeature("Tokyo\n東京", 139.75, 35.69, { class: "city" }),
    ]);
    expect(pickPlaceLabel(map, POINT)?.name).toBe("Tokyo");
  });

  it("prefers the more significant class over a nearer minor place", () => {
    const { map } = makeMap([
      // Village sits exactly under the cursor, city is 5px away.
      makeFeature("Smalltown", 100, 50, { class: "village", rank: 9 }),
      makeFeature("Bigcity", 103, 54, { class: "city", rank: 3 }),
    ]);
    expect(pickPlaceLabel(map, POINT)?.name).toBe("Bigcity");
  });

  it("breaks class ties on rank, lower being more important", () => {
    const { map } = makeMap([
      makeFeature("Minor", 100, 50, { class: "city", rank: 8 }),
      makeFeature("Major", 104, 53, { class: "city", rank: 1 }),
    ]);
    expect(pickPlaceLabel(map, POINT)?.name).toBe("Major");
  });

  it("breaks remaining ties on distance to the click", () => {
    const { map } = makeMap([
      makeFeature("Far", 104, 53, { class: "town", rank: 5 }),
      makeFeature("Near", 100, 50, { class: "town", rank: 5 }),
    ]);
    expect(pickPlaceLabel(map, POINT)?.name).toBe("Near");
  });

  it("deduplicates a city carrying more than one label feature", () => {
    // Same name, near-identical anchors: keep the one closest to the cursor.
    const { map } = makeMap([
      makeFeature("Paris", 102, 52, { class: "city", rank: 2 }),
      makeFeature("Paris", 100, 50, { class: "city", rank: 2 }),
    ]);
    const picked = pickPlaceLabel(map, POINT);
    expect(picked?.name).toBe("Paris");
    expect(picked?.longitude).toBe(100);
  });

  it("keeps distinct same-name places that are far apart", () => {
    // Two real "Springfield"s must not collapse into one another.
    const { map } = makeMap([
      makeFeature("Springfield", 100, 50, { class: "town", rank: 5 }),
      makeFeature("Springfield", 140, 50, { class: "city", rank: 3 }),
    ]);
    // The city wins on class, proving they were treated as separate places.
    expect(pickPlaceLabel(map, POINT)?.longitude).toBe(140);
  });

  it("returns null when nothing is under the cursor", () => {
    const { map } = makeMap([]);
    expect(pickPlaceLabel(map, POINT)).toBeNull();
  });

  it("returns null when the style has no settlement layers", () => {
    const { map, queryRenderedFeatures } = makeMap(
      [makeFeature("Nowhere", 0, 0)],
      { presentLayers: [] },
    );
    expect(pickPlaceLabel(map, POINT)).toBeNull();
    expect(queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it("ignores features that are not point places", () => {
    const { map } = makeMap([
      { sourceLayer: "place", properties: { name: "Region" }, geometry: { type: "Polygon" } },
      { sourceLayer: "water_name", properties: { name: "Atlantic" }, geometry: { type: "Point", coordinates: [0, 0] } },
      { sourceLayer: "place", properties: {}, geometry: { type: "Point", coordinates: [1, 1] } },
    ]);
    expect(pickPlaceLabel(map, POINT)).toBeNull();
  });

  it("survives a style swap between the layer check and the query", () => {
    const { map } = makeMap([]);
    vi.spyOn(map, "queryRenderedFeatures").mockImplementation(() => {
      throw new Error("style is not done loading");
    });
    expect(pickPlaceLabel(map, POINT)).toBeNull();
  });
});
