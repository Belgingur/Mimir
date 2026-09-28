import { describe, expect, it, vi } from "vitest";
import {
  ensureForecastReferenceLayers,
  FORECAST_REFERENCE_LAYER_IDS,
  resolveWeatherBeforeId,
} from "../src/lib/mapLayerOrder";

/** Abridged positron layer stack, preserving the ordering that matters. */
const POSITRON_LAYERS = [
  { id: "background", type: "background" },
  {
    id: "water",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "water",
  },
  {
    id: "waterway",
    type: "line",
    source: "openmaptiles",
    "source-layer": "waterway",
  },
  { id: "water_name", type: "symbol", "source-layer": "water_name" },
  { id: "building", type: "fill", "source-layer": "building" },
  {
    id: "highway_major_inner",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
  },
  {
    id: "highway_name_other",
    type: "symbol",
    "source-layer": "transportation_name",
  },
  {
    id: "boundary_country_z5-",
    type: "line",
    source: "openmaptiles",
    "source-layer": "boundary",
  },
  { id: "place_other", type: "symbol", "source-layer": "place" },
  { id: "place_village", type: "symbol", "source-layer": "place" },
  { id: "place_city", type: "symbol", "source-layer": "place" },
  { id: "place_country_major", type: "symbol", "source-layer": "place" },
];

describe("resolveWeatherBeforeId", () => {
  it("anchors before the first place-label layer, not the first symbol layer", () => {
    // water_name and highway_name_other are symbol layers that come earlier,
    // but anchoring there would let roads and buildings paint over the weather.
    expect(resolveWeatherBeforeId({ layers: POSITRON_LAYERS })).toBe(
      "place_other",
    );
  });

  it("falls back to the first symbol layer when no place layer exists", () => {
    const layers = POSITRON_LAYERS.filter(
      (layer) => layer["source-layer"] !== "place",
    );
    expect(resolveWeatherBeforeId({ layers })).toBe("water_name");
  });

  it("returns undefined when the style has no symbol layers", () => {
    const layers = POSITRON_LAYERS.filter((layer) => layer.type !== "symbol");
    expect(resolveWeatherBeforeId({ layers })).toBeUndefined();
  });

  it("returns undefined for an unloaded or empty style", () => {
    expect(resolveWeatherBeforeId(null)).toBeUndefined();
    expect(resolveWeatherBeforeId(undefined)).toBeUndefined();
    expect(resolveWeatherBeforeId({})).toBeUndefined();
    expect(resolveWeatherBeforeId({ layers: [] })).toBeUndefined();
  });

  it("tracks a reordered style rather than a fixed id", () => {
    // A MapTiler style update that renames the first place layer must not leave
    // the overlay unanchored — the id is always read from the live style.
    const renamed = POSITRON_LAYERS.map((layer) =>
      layer.id === "place_other" ? { ...layer, id: "place_minor" } : layer,
    );
    expect(resolveWeatherBeforeId({ layers: renamed })).toBe("place_minor");
  });
});

describe("ensureForecastReferenceLayers", () => {
  function makeMap(layers = POSITRON_LAYERS) {
    const present = new Set<string>();
    const addLayer = vi.fn(
      (
        layer: {
          id: string;
          type?: string;
          source?: string;
          filter?: unknown;
          paint?: Record<string, unknown>;
        },
        _beforeId?: string,
      ) => {
        present.add(layer.id);
      },
    );
    const setLayoutProperty = vi.fn();
    const map = {
      getStyle: () => ({ layers }),
      getLayer: (id: string) => (present.has(id) ? { id } : undefined),
      addLayer,
      setLayoutProperty,
    };
    return { map: map as never, addLayer, setLayoutProperty };
  }

  it("reuses basemap sources for all forecast reference details", () => {
    const { map, addLayer } = makeMap();

    const anchor = ensureForecastReferenceLayers(map, "place_other");

    expect(anchor).toBe(FORECAST_REFERENCE_LAYER_IDS.lakeFill);
    expect(addLayer.mock.calls.map(([layer]) => layer.id)).toEqual(
      Object.values(FORECAST_REFERENCE_LAYER_IDS),
    );
    expect(addLayer.mock.calls.every(([, beforeId]) => beforeId === "place_other"))
      .toBe(true);
    expect(
      addLayer.mock.calls.every(
        ([layer]) => layer.source === "openmaptiles",
      ),
    ).toBe(true);
    expect(
      addLayer.mock.calls.every(([layer]) => Array.isArray(layer.filter)),
    ).toBe(true);
  });

  it("keeps road context faint and limited to major routes", () => {
    const { map, addLayer } = makeMap();
    ensureForecastReferenceLayers(map, "place_other");
    const road = addLayer.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer.id === FORECAST_REFERENCE_LAYER_IDS.road);

    expect(JSON.stringify(road?.filter)).toContain("motorway");
    expect(JSON.stringify(road?.filter)).toContain("primary");
    expect(JSON.stringify(road?.filter)).not.toContain("secondary");
    expect(road?.paint?.["line-opacity"]).toEqual(
      expect.arrayContaining(["interpolate", ["linear"], ["zoom"]]),
    );
  });

  it("keeps lake shading inside polygons without an outward line blur", () => {
    const { map, addLayer } = makeMap();
    ensureForecastReferenceLayers(map, "place_other");
    const lakeLayers = addLayer.mock.calls
      .map(([layer]) => layer)
      .filter((layer) => JSON.stringify(layer.filter).includes('"lake"'));
    const fill = lakeLayers.find(
      (layer) => layer.id === FORECAST_REFERENCE_LAYER_IDS.lakeFill,
    );

    expect(lakeLayers).toHaveLength(1);
    expect(lakeLayers.every((layer) => layer.type === "fill")).toBe(true);
    expect(fill?.type).toBe("fill");
    expect(JSON.stringify(fill?.filter)).toContain("lake");
    expect(JSON.stringify(fill?.filter)).not.toContain("ocean");
    expect(fill?.paint?.["fill-opacity"]).toEqual(
      expect.arrayContaining(["interpolate", ["linear"], ["zoom"]]),
    );
  });

  it("excludes maritime boundaries while retaining land borders", () => {
    const { map, addLayer, setLayoutProperty } = makeMap();
    ensureForecastReferenceLayers(map, "place_other");
    const country = addLayer.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer.id === FORECAST_REFERENCE_LAYER_IDS.country);
    const filterText = JSON.stringify(country?.filter);

    expect(filterText).toContain("admin_level");
    expect(filterText).toContain("maritime");
    expect(filterText).toContain('"1"');
    expect(filterText).toContain('"true"');
    expect(setLayoutProperty).toHaveBeenCalledWith(
      "boundary_country_z5-",
      "visibility",
      "none",
    );
  });

  it("keeps zoom as the input of a top-level width interpolation", () => {
    const { map, addLayer } = makeMap();
    ensureForecastReferenceLayers(map, "place_other");

    for (const [layer] of addLayer.mock.calls) {
      const width = (
        layer as {
          paint?: { "line-width"?: unknown };
        }
      ).paint?.["line-width"];
      if (
        Array.isArray(width) &&
        JSON.stringify(width).includes('"zoom"')
      ) {
        expect(width[0], `${layer.id} line-width`).toBe("interpolate");
        expect(width[2]).toEqual(["zoom"]);
      }
    }
  });

  it("is idempotent across repeated style-ready notifications", () => {
    const { map, addLayer } = makeMap();
    ensureForecastReferenceLayers(map, "place_other");
    ensureForecastReferenceLayers(map, "place_other");
    expect(addLayer).toHaveBeenCalledTimes(
      Object.keys(FORECAST_REFERENCE_LAYER_IDS).length,
    );
  });

  it("returns undefined when the basemap exposes no compatible vector source", () => {
    const { map, addLayer } = makeMap([
      { id: "background", type: "background" },
      { id: "labels", type: "symbol" },
    ]);
    expect(ensureForecastReferenceLayers(map, "labels")).toBeUndefined();
    expect(addLayer).not.toHaveBeenCalled();
  });
});
