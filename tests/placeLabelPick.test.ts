import { describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";
import {
  ANCHOR_SNAP_RADIUS_PX,
  getPresentSettlementLayerIds,
  pickPlaceLabel,
  SETTLEMENT_LAYER_IDS,
} from "../src/lib/placeLabelPick";
import { LANDMARK_LAYER_IDS } from "../src/lib/landmarkLabels";

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

/**
 * A stand-in that hit-tests like MapLibre: each label has a screen-space box,
 * a box query returns the labels whose box overlaps it, and a point query the
 * labels whose box contains the point. Screen x/y equal lon/lat here.
 */
function makeLabelMap(
  labels: { name: string; anchor: [number, number]; box: [number, number, number, number] }[],
) {
  const features = labels.map((label) => ({
    ...makeFeature(label.name, label.anchor[0], label.anchor[1], { class: "town", rank: 5 }),
    box: label.box,
  }));
  type Geometry = [number, number] | [[number, number], [number, number]];
  const queryRenderedFeatures = vi.fn((geometry: Geometry) => {
    const [[x0, y0], [x1, y1]] = Array.isArray(geometry[0])
      ? (geometry as [[number, number], [number, number]])
      : [geometry as [number, number], geometry as [number, number]];
    return features.filter(({ box: [bx0, by0, bx1, by1] }) => bx0 <= x1 && x0 <= bx1 && by0 <= y1 && y0 <= by1);
  });
  const map = {
    getLayer: (id: string) => ({ id }),
    queryRenderedFeatures,
    project: ([lon, lat]: [number, number]) => ({ x: lon, y: lat }),
  };
  return map as unknown as maplibregl.Map;
}

describe("pickPlaceLabel — peaks", () => {
  const PEAK_LAYERS = [...SETTLEMENT_LAYER_IDS, LANDMARK_LAYER_IDS.peaks];
  const peak = (name: string, lon: number, lat: number, ele?: unknown): FakeFeature => ({
    sourceLayer: "mountain_peak",
    properties: { name, class: "volcano", rank: 1, ...(ele === undefined ? {} : { ele }) },
    geometry: { type: "Point", coordinates: [lon, lat] },
  });

  it("queries the peak layer when the style has it", () => {
    const { map, queryRenderedFeatures } = makeMap([], { presentLayers: PEAK_LAYERS });
    pickPlaceLabel(map, POINT, { coarsePointer: false });
    expect(queryRenderedFeatures).toHaveBeenCalledWith(expect.anything(), {
      layers: PEAK_LAYERS,
    });
  });

  it("resolves a click on a peak to its name alone, without its height", () => {
    const { map } = makeMap([peak("Hvannadalshnúkur", 100, 50, 2110)], {
      presentLayers: PEAK_LAYERS,
    });
    expect(pickPlaceLabel(map, POINT, { coarsePointer: false })).toEqual({
      name: "Hvannadalshnúkur",
      longitude: 100,
      latitude: 50,
      placeClass: "volcano",
      rank: 1,
    });
  });

  it("lets a town win over a peak at the same spot", () => {
    const { map } = makeMap(
      [peak("Esja", 100, 50, 914), makeFeature("Mosfellsbær", 101, 50, { class: "town" })],
      { presentLayers: PEAK_LAYERS },
    );
    expect(pickPlaceLabel(map, POINT, { coarsePointer: false })?.name).toBe("Mosfellsbær");
  });
});

describe("pickPlaceLabel — a click beside a long name", () => {
  // Seltjarnarnes at full zoom: the name is drawn centred on the town's point
  // and its last letters end right at Reykjavík's old harbour, 48 px east.
  const seltjarnarnes = { name: "Seltjarnarnes", anchor: [500, 300] as [number, number], box: [452, 292, 548, 308] as [number, number, number, number] };

  it("doesn't snap a click 1 px past the end of the name, 49 px from the town", () => {
    const map = makeLabelMap([seltjarnarnes]);
    expect(pickPlaceLabel(map, { x: 549, y: 300 }, { coarsePointer: false })).toBeNull();
  });

  it("doesn't snap a click 4 px below the end of the name", () => {
    const map = makeLabelMap([seltjarnarnes]);
    const click = { x: 546, y: 312 };
    expect(Math.hypot(click.x - 500, click.y - 300)).toBeGreaterThan(ANCHOR_SNAP_RADIUS_PX);
    expect(pickPlaceLabel(map, click, { coarsePointer: false })).toBeNull();
  });

  it("snaps a click on the name's last letters to the town", () => {
    const map = makeLabelMap([seltjarnarnes]);
    expect(pickPlaceLabel(map, { x: 540, y: 300 }, { coarsePointer: false })?.name).toBe("Seltjarnarnes");
  });

  it("snaps a click within 12 px of the town's point, even off the name", () => {
    // A short name centred on its point; both clicks are below its box.
    const map = makeLabelMap([{ name: "Vík", anchor: [200, 200], box: [188, 193, 212, 207] }]);
    expect(pickPlaceLabel(map, { x: 200, y: 211 }, { coarsePointer: false })?.name).toBe("Vík");
    expect(pickPlaceLabel(map, { x: 200, y: 213 }, { coarsePointer: false })).toBeNull();
  });

  it("applies the same rule to touch, whose wider box only finds candidates", () => {
    const map = makeLabelMap([seltjarnarnes]);
    expect(pickPlaceLabel(map, { x: 552, y: 300 }, { coarsePointer: true })).toBeNull();
    expect(pickPlaceLabel(map, { x: 540, y: 300 }, { coarsePointer: true })?.name).toBe("Seltjarnarnes");
  });
});
