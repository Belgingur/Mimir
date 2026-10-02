import { describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";
import type { IconPoint } from "../src/controllers/IconographyController";
import type { AtlasResult } from "../src/lib/iconographyTypes";
import {
  CITY_DOT_LAYER_ID,
  CITY_LABEL_LAYER_ID,
} from "../src/lib/cityLabelLayer";
import {
  clearIconographySymbols,
  ICONOGRAPHY_LAYER_ID,
  ICONOGRAPHY_SOURCE_ID,
  NAME_ALL_ZOOM,
  syncIconographySymbols,
} from "../src/lib/iconographySymbolLayer";

const point = (name: string, icon: string, rank = 1): IconPoint => ({
  position: [21, 52],
  icon,
  temperature: 14,
  windSpeed: 3,
  windDirection: 180,
  name,
  rank,
});

/**
 * Evaluate a layout expression the way MapLibre would, for one feature at one
 * zoom. Only the forms the bubble's text-field uses are supported.
 */
function evaluate(expr: unknown, props: Record<string, unknown>, zoom: number): unknown {
  if (!Array.isArray(expr)) return expr;
  const [op, ...args] = expr as [string, ...unknown[]];
  switch (op) {
    case "zoom":
      return zoom;
    case "get":
      return props[args[0] as string];
    case "<=":
      return (
        (evaluate(args[0], props, zoom) as number) <=
        (evaluate(args[1], props, zoom) as number)
      );
    case "case":
      return evaluate(args[0], props, zoom)
        ? evaluate(args[1], props, zoom)
        : evaluate(args[2], props, zoom);
    case "step": {
      const input = evaluate(args[0], props, zoom) as number;
      let out = args[1];
      for (let i = 2; i < args.length; i += 2) {
        if (input >= (args[i] as number)) out = args[i + 1];
        else break;
      }
      return evaluate(out, props, zoom);
    }
    default:
      throw new Error(`unsupported op ${op}`);
  }
}

/** Each icon code gets an 80 × 60 atlas entry with its tip at (40, 50). */
function makeAtlas(): AtlasResult {
  const getImageData = vi.fn(
    (_x: number, _y: number, width: number, height: number) =>
      ({ width, height }) as ImageData,
  );
  return {
    atlas: {
      getContext: () => ({ getImageData }),
    } as unknown as HTMLCanvasElement,
    mapping: new Proxy(
      {},
      {
        get: () => ({ x: 0, y: 0, width: 80, height: 60, anchorX: 40, anchorY: 50 }),
      },
    ),
    getKey: (p) => p.icon,
  };
}

function makeMap(order: string[] = [], zoom = 8) {
  const images = new Map<string, ImageData>();
  const layers = [...order];
  const source = { setData: vi.fn() };
  let hasSource = false;
  const map = {
    hasImage: (id: string) => images.has(id),
    addImage: vi.fn((id: string, img: ImageData) => images.set(id, img)),
    updateImage: vi.fn((id: string, img: ImageData) => images.set(id, img)),
    removeImage: vi.fn((id: string) => images.delete(id)),
    getSource: (id: string) =>
      id === ICONOGRAPHY_SOURCE_ID && hasSource ? source : undefined,
    addSource: vi.fn(() => (hasSource = true)),
    removeSource: vi.fn(() => (hasSource = false)),
    getLayer: (id: string) => (layers.includes(id) ? { id } : undefined),
    addLayer: vi.fn((layer: { id: string }) => layers.push(layer.id)),
    removeLayer: vi.fn((id: string) => layers.splice(layers.indexOf(id), 1)),
    moveLayer: vi.fn((id: string) => {
      layers.splice(layers.indexOf(id), 1);
      layers.push(id);
    }),
    getLayersOrder: () => layers,
    getZoom: () => zoom,
    setFilter: vi.fn(),
  };
  return { map: map as unknown as maplibregl.Map, raw: map, images, source };
}

describe("syncIconographySymbols", () => {
  it("adds one image per distinct widget, cut off at the pointer tip", () => {
    const { map, raw } = makeMap();
    syncIconographySymbols(
      map,
      [point("Warsaw", "01d"), point("Kraków", "01d"), point("Berlin", "04")],
      30,
      makeAtlas(),
    );
    expect(raw.addImage).toHaveBeenCalledTimes(2);
    const [, image, options] = raw.addImage.mock.calls[0];
    // 50 px tall, not 60: the shadow room below the tip is dropped so the
    // city name under the point is not hidden by the widget's collision box.
    expect(image).toMatchObject({ width: 80, height: 50 });
    // 60 atlas px are drawn 30 css px tall.
    expect(options).toEqual({ pixelRatio: 2 });
  });

  it("names its own place; the city layer stands down for it", () => {
    const { map, raw } = makeMap([CITY_DOT_LAYER_ID, CITY_LABEL_LAYER_ID]);
    syncIconographySymbols(map, [point("Hvanneyri", "01d", 2)], 30, makeAtlas());
    const [layer] = raw.addLayer.mock.calls[0] as unknown as [
      { layout: Record<string, unknown> },
    ];
    expect(layer.layout["text-optional"]).toBe(true);
    const hidden = ["!", ["in", ["get", "name"], ["literal", ["Hvanneyri"]]]];
    for (const id of [CITY_DOT_LAYER_ID, CITY_LABEL_LAYER_ID]) {
      const [, filter] = raw.setFilter.mock.calls.find(([l]) => l === id)!;
      expect(filter).toContainEqual(hidden);
    }
  });

  it("lets the city layer label a place its bubble leaves unnamed", () => {
    // Zoomed out, a rank-2 bubble draws no name; the city layer may still
    // label it on its own ladder, but its dot stays hidden under the tip.
    const { map, raw } = makeMap([CITY_DOT_LAYER_ID, CITY_LABEL_LAYER_ID], 4.5);
    syncIconographySymbols(
      map,
      [point("Paris", "01d", 1), point("Warsaw", "01d", 2)],
      30,
      makeAtlas(),
    );
    const filterFor = (id: string) =>
      raw.setFilter.mock.calls.find(([l]) => l === id)?.[1];
    expect(filterFor(CITY_LABEL_LAYER_ID)).toContainEqual([
      "!",
      ["in", ["get", "name"], ["literal", ["Paris"]]],
    ]);
    expect(filterFor(CITY_DOT_LAYER_ID)).toContainEqual([
      "!",
      ["in", ["get", "name"], ["literal", ["Paris", "Warsaw"]]],
    ]);
  });

  it("names only rank-1 places zoomed out, and every place from z5", () => {
    const { map, raw } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    const [layer] = raw.addLayer.mock.calls[0] as unknown as [
      { layout: { "text-field": unknown } },
    ];
    const at = (zoom: number, rank: number) =>
      evaluate(layer.layout["text-field"], { name: "X", rank }, zoom);
    expect(at(4, 1)).toBe("X");
    expect(at(4, 2)).toBe("");
    expect(at(NAME_ALL_ZOOM, 2)).toBe("X");
    expect(at(9, 4)).toBe("X");
  });

  it("removes images no widget uses any more", () => {
    const { map, raw, images } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    syncIconographySymbols(map, [point("Warsaw", "09")], 30, makeAtlas());
    expect(raw.removeImage).toHaveBeenCalledWith("iconography:01d");
    expect([...images.keys()]).toEqual(["iconography:09"]);
  });

  it("re-sends an existing image, since its glyph may have loaded since", () => {
    const { map, raw } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    expect(raw.addImage).toHaveBeenCalledTimes(1);
    expect(raw.updateImage).toHaveBeenCalledTimes(1);
  });

  it("moves back to the top when a layer was added above it", () => {
    const { map, raw } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    raw.getLayersOrder().push("mimir-city-labels");
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    expect(raw.moveLayer).toHaveBeenCalledWith(ICONOGRAPHY_LAYER_ID);
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    expect(raw.moveLayer).toHaveBeenCalledTimes(1);
  });

  it("empties the source when there is nothing to draw", () => {
    const { map, source } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    syncIconographySymbols(map, [], 30, null);
    expect(source.setData).toHaveBeenLastCalledWith({
      type: "FeatureCollection",
      features: [],
    });
  });
});

describe("clearIconographySymbols", () => {
  it("removes the layer, source and every widget image", () => {
    const { map, raw, images } = makeMap();
    syncIconographySymbols(map, [point("Warsaw", "01d")], 30, makeAtlas());
    clearIconographySymbols(map);
    expect(raw.removeLayer).toHaveBeenCalledWith(ICONOGRAPHY_LAYER_ID);
    expect(raw.removeSource).toHaveBeenCalledWith(ICONOGRAPHY_SOURCE_ID);
    expect(images.size).toBe(0);
  });

  it("is a no-op when the view never drew any widgets", () => {
    const { map, raw } = makeMap();
    clearIconographySymbols(map);
    expect(raw.removeLayer).not.toHaveBeenCalled();
    expect(raw.removeSource).not.toHaveBeenCalled();
  });
});
