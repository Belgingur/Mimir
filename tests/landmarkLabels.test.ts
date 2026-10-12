import { describe, expect, it, vi } from "vitest";
import {
  featureFilter,
  validateStyleMin,
  type FilterSpecification,
  type StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import {
  buildPeakIcon,
  ensureLandmarkLabels,
  ISLAND_FILTER,
  LANDMARK_LAYER_IDS,
  PEAK_FILTER,
  PEAK_ICON_ID,
  PEAK_NAME_MIN_ZOOM,
  WATER_NAME_FILTER,
} from "../src/lib/landmarkLabels";

const LAYERS = [
  { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
  { id: "place_other", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  { id: "place_town", type: "symbol", source: "openmaptiles", "source-layer": "place" },
];

function makeMap(layers: unknown[] = LAYERS) {
  const present = new Set<string>();
  const images = new Set<string>();
  const addLayer = vi.fn((layer: { id: string }, _beforeId?: string) => {
    present.add(layer.id);
  });
  const addImage = vi.fn((id: string) => {
    images.add(id);
  });
  const map = {
    getStyle: () => ({ layers }),
    getLayer: (id: string) => (present.has(id) ? { id } : undefined),
    hasImage: (id: string) => images.has(id),
    addLayer,
    addImage,
  };
  return { map: map as never, addLayer, addImage };
}

const passes = (
  filter: unknown,
  zoom: number,
  properties: Record<string, unknown>,
) =>
  featureFilter(filter as FilterSpecification, "layers[0].filter").filter({ zoom }, {
    type: 1,
    properties,
  } as never);

describe("ensureLandmarkLabels", () => {
  it("adds water, island and peak labels under the first place layer", () => {
    const { map, addLayer } = makeMap();
    ensureLandmarkLabels(map, "place_other");
    expect(addLayer.mock.calls.map(([layer]) => layer.id)).toEqual([
      LANDMARK_LAYER_IDS.water,
      LANDMARK_LAYER_IDS.islands,
      LANDMARK_LAYER_IDS.peaks,
    ]);
    expect(addLayer.mock.calls.every(([, before]) => before === "place_other")).toBe(true);
  });

  it("is idempotent across style loads", () => {
    const { map, addLayer, addImage } = makeMap();
    ensureLandmarkLabels(map, "place_other");
    ensureLandmarkLabels(map, "place_other");
    expect(addLayer).toHaveBeenCalledTimes(3);
    expect(addImage).toHaveBeenCalledTimes(1);
    expect(addImage).toHaveBeenCalledWith(PEAK_ICON_ID, expect.anything(), { pixelRatio: 2 });
  });

  it("adds nothing to a style it does not know", () => {
    const noAnchor = makeMap();
    ensureLandmarkLabels(noAnchor.map, undefined);
    expect(noAnchor.addLayer).not.toHaveBeenCalled();

    const noPlaces = makeMap([LAYERS[0]]);
    ensureLandmarkLabels(noPlaces.map, "water");
    expect(noPlaces.addLayer).not.toHaveBeenCalled();
  });

  it("draws peaks as bare triangles until the name zoom", () => {
    const { map, addLayer } = makeMap();
    ensureLandmarkLabels(map, "place_other");
    const peaks = addLayer.mock.calls
      .map(([layer]) => layer as { id: string; layout?: Record<string, unknown> })
      .find((layer) => layer.id === LANDMARK_LAYER_IDS.peaks);
    const field = peaks?.layout?.["text-field"] as unknown[];
    expect(field.slice(0, 4)).toEqual(["step", ["zoom"], "", PEAK_NAME_MIN_ZOOM]);
    expect(peaks?.layout?.["icon-image"]).toBe(PEAK_ICON_ID);
  });

  it("produces layers the style spec accepts", () => {
    const { map, addLayer } = makeMap();
    ensureLandmarkLabels(map, "place_other");
    const style = {
      version: 8,
      glyphs: "https://example.test/fonts/{fontstack}/{range}.pbf",
      sources: { openmaptiles: { type: "vector", url: "https://example.test/tiles.json" } },
      layers: addLayer.mock.calls.map(([layer]) => layer),
    } as unknown as StyleSpecification;
    expect(validateStyleMin(style)).toEqual([]);
  });
});

describe("landmark filters", () => {
  const peak = (props: Record<string, unknown>) => ({
    class: "peak",
    name: "Hekla",
    ele: 1491,
    rank: 1,
    ...props,
  });

  it("shows peaks and volcanoes, not hills", () => {
    expect(passes(PEAK_FILTER, 8, peak({}))).toBe(true);
    expect(passes(PEAK_FILTER, 8, peak({ class: "volcano" }))).toBe(true);
    // Denmark's rank-1 "peaks" are 25–170 m hills.
    expect(passes(PEAK_FILTER, 12, peak({ name: "Vissenbjerg", ele: 129 }))).toBe(false);
    expect(passes(PEAK_FILTER, 8, peak({ ele: undefined }))).toBe(false);
    expect(passes(PEAK_FILTER, 8, peak({ class: "saddle" }))).toBe(false);
    expect(passes(PEAK_FILTER, 8, peak({ name: undefined }))).toBe(false);
  });

  it("shows only the big peaks zoomed out, smaller ones as you zoom in", () => {
    // South Iceland: Hekla (1491 m) from z7, Tindafjall (1056 m) from z9,
    // Þríhyrningur (691 m) from z10.
    expect(passes(PEAK_FILTER, 7, peak({ ele: 1491 }))).toBe(true);
    expect(passes(PEAK_FILTER, 8, peak({ ele: 1056 }))).toBe(false);
    expect(passes(PEAK_FILTER, 9, peak({ ele: 1056 }))).toBe(true);
    expect(passes(PEAK_FILTER, 9, peak({ ele: 691 }))).toBe(false);
    expect(passes(PEAK_FILTER, 10, peak({ ele: 691 }))).toBe(true);
  });

  it("keeps only the top-ranked peak of each patch", () => {
    expect(passes(PEAK_FILTER, 9, peak({ rank: 1 }))).toBe(true);
    expect(passes(PEAK_FILTER, 9, peak({ rank: 2 }))).toBe(false);
  });

  it("names bays, straits and lakes, leaving seas to the country names", () => {
    expect(passes(WATER_NAME_FILTER, 8, { class: "bay", name: "Arnarfjörður" })).toBe(true);
    expect(passes(WATER_NAME_FILTER, 8, { class: "lake", name: "Þórisvatn" })).toBe(true);
    expect(passes(WATER_NAME_FILTER, 8, { class: "strait", name: "Lillebælt" })).toBe(true);
    expect(passes(WATER_NAME_FILTER, 8, { class: "ocean", name: "Atlantic" })).toBe(false);
    expect(passes(WATER_NAME_FILTER, 8, { class: "sea", name: "North Sea" })).toBe(false);
  });

  it("shows the large islands first and the small ones from z9", () => {
    expect(passes(ISLAND_FILTER, 7, { class: "island", name: "Fyn", rank: 1 })).toBe(true);
    expect(passes(ISLAND_FILTER, 7, { class: "island", name: "Heimaey", rank: 3 })).toBe(false);
    expect(passes(ISLAND_FILTER, 9, { class: "island", name: "Heimaey", rank: 3 })).toBe(true);
    expect(passes(ISLAND_FILTER, 9, { class: "village", name: "Vík", rank: 1 })).toBe(false);
  });
});

describe("buildPeakIcon", () => {
  it("draws an upward triangle: open at the top corners, solid at the base", () => {
    const { width, height, data } = buildPeakIcon();
    expect(data).toHaveLength(width * height * 4);
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(width - 1, 0)).toBe(0);
    expect(alpha(width / 2, height - 3)).toBe(255);
    // The middle of the base is filled with the landmark colour, not the rim.
    const i = ((height - 6) * width + width / 2) * 4;
    expect(data[i]).toBeGreaterThan(200);
  });
});
