/**
 * Draw-order helpers for the weather overlay.
 *
 * The WebP weather imagery is a deck.gl layer rendered through an interleaved
 * MapboxOverlay, so it participates in MapLibre's own layer stack. Without an
 * explicit anchor deck appends it at the top, which paints it over every
 * basemap label — the city names are then still *rendered* (and so still
 * returned by queryRenderedFeatures) but invisible to the user, which reads as
 * "the labels aren't clickable".
 *
 * Anchoring the raster below the first place-label layer fixes both the optics
 * and the affordance.
 */

import type * as maplibregl from "maplibre-gl";

/** OpenMapTiles source-layer that carries settlement + region labels. */
export const PLACE_SOURCE_LAYER = "place";

interface MinimalLayer {
  readonly id: string;
  readonly type: string;
  readonly "source-layer"?: string;
  readonly source?: unknown;
  readonly layout?: { readonly visibility?: unknown };
}

interface MinimalStyle {
  readonly layers?: readonly MinimalLayer[];
}

/**
 * Resolve the layer id the weather overlay should be inserted *before*.
 *
 * Deliberately not "the first symbol layer": in MapTiler's positron style that
 * is `water_name` (index 8), which sits *below* buildings, roads, railways and
 * boundaries — anchoring there would let the whole road network paint on top of
 * the weather. The first `place` symbol layer (`place_other`, index 39) is the
 * correct seam: weather covers terrain and roads, all settlement labels stay
 * above it.
 *
 * Resolved by scanning the live style rather than hardcoding an id, because a
 * MapTiler style update can rename or reorder layers at any time — and a stale
 * hardcoded id fails silently by putting the overlay back on top.
 *
 * @returns the anchor layer id, or `undefined` when the style has no symbol
 *   layers at all (e.g. the demotiles error fallback), in which case the caller
 *   should leave the overlay unanchored.
 */
export function resolveWeatherBeforeId(
  style: MinimalStyle | null | undefined,
): string | undefined {
  const layers = style?.layers;
  if (!layers?.length) return undefined;

  const firstPlaceSymbol = layers.find(
    (layer) =>
      layer.type === "symbol" &&
      layer["source-layer"] === PLACE_SOURCE_LAYER,
  );
  if (firstPlaceSymbol) return firstPlaceSymbol.id;

  // No place labels (unknown schema): fall back to the first symbol layer so
  // that at least road/water labels stay legible above the weather.
  return layers.find((layer) => layer.type === "symbol")?.id;
}

export const FORECAST_REFERENCE_LAYER_IDS = {
  lakeFill: "mimir-reference-lake-fill",
  coastHalo: "mimir-reference-coast-halo",
  coast: "mimir-reference-coast",
  riverHalo: "mimir-reference-river-halo",
  river: "mimir-reference-river",
  road: "mimir-reference-road",
  countryHalo: "mimir-reference-country-halo",
  country: "mimir-reference-country",
} as const;

export const LAND_COUNTRY_BOUNDARY_FILTER = [
  "all",
  ["==", ["to-string", ["get", "admin_level"]], "2"],
  [
    "match",
    ["to-string", ["get", "maritime"]],
    ["1", "true"],
    false,
    true,
  ],
] as maplibregl.FilterSpecification;

const LAKE_FILTER = [
  "match",
  ["to-string", ["get", "class"]],
  ["lake", "reservoir", "pond"],
  true,
  false,
] as maplibregl.FilterSpecification;

type ReferenceLayerId =
  (typeof FORECAST_REFERENCE_LAYER_IDS)[keyof typeof FORECAST_REFERENCE_LAYER_IDS];

/**
 * Add a restrained cartographic reference stack above the forecast, reusing
 * the basemap's vector source. This replaces the former 7 MB country GeoJSON
 * download and adds lakes, coastlines, major waterways, and country borders
 * without another network source.
 *
 * Returns the first reference layer id, which is the correct `beforeId` for
 * weather rasters: forecast below reference ink, place labels above both.
 */
export function ensureForecastReferenceLayers(
  map: maplibregl.Map,
  labelBeforeId: string | undefined,
): string | undefined {
  const style = map.getStyle() as MinimalStyle;
  // Positron's boundary stack also includes maritime/territorial lines. Hide
  // that entire stack and redraw only filtered land-country borders below.
  // Otherwise those pale offshore rings remain visible wherever a regional
  // forecast is transparent or ends at its domain edge.
  for (const layer of style.layers ?? []) {
    if (
      layer["source-layer"] !== "boundary" ||
      layer.id.startsWith("mimir-reference-") ||
      layer.layout?.visibility === "none"
    ) {
      continue;
    }
    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch {
      // A concurrent style swap will trigger another style-ready pass.
    }
  }
  const sourceFor = (sourceLayer: string): string | undefined => {
    const layer = style.layers?.find(
      (candidate) =>
        candidate["source-layer"] === sourceLayer &&
        typeof candidate.source === "string",
    );
    return typeof layer?.source === "string" ? layer.source : undefined;
  };

  const waterSource = sourceFor("water");
  const waterwaySource = sourceFor("waterway");
  const transportationSource = sourceFor("transportation");
  const boundarySource = sourceFor("boundary");
  const orderedIds: ReferenceLayerId[] = [];

  const addFill = (
    id: ReferenceLayerId,
    source: string | undefined,
    options: {
      minzoom?: number;
      filter: maplibregl.FilterSpecification;
      paint: NonNullable<maplibregl.FillLayerSpecification["paint"]>;
    },
  ) => {
    if (!source) return;
    orderedIds.push(id);
    if (map.getLayer(id)) return;
    const layer: maplibregl.FillLayerSpecification = {
      id,
      type: "fill",
      source,
      "source-layer": "water",
      filter: options.filter,
      paint: options.paint,
    };
    if (options.minzoom !== undefined) layer.minzoom = options.minzoom;
    map.addLayer(layer, labelBeforeId);
  };

  const add = (
    id: ReferenceLayerId,
    source: string | undefined,
    sourceLayer: string,
    options: {
      minzoom?: number;
      filter?: maplibregl.FilterSpecification;
      paint: NonNullable<maplibregl.LineLayerSpecification["paint"]>;
    },
  ) => {
    if (!source) return;
    orderedIds.push(id);
    if (map.getLayer(id)) return;
    const layer: maplibregl.LineLayerSpecification = {
      id,
      type: "line",
      source,
      "source-layer": sourceLayer,
      filter: options.filter ?? ["all"],
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: options.paint,
    };
    if (options.minzoom !== undefined) layer.minzoom = options.minzoom;
    map.addLayer(layer, labelBeforeId);
  };

  // Keep lake shading inside the polygon. A blurred line is centered on the
  // shore and necessarily spills onto land, especially badly where small lake
  // polygons overlap; the shared crisp coastline layers provide the edge.
  addFill(FORECAST_REFERENCE_LAYER_IDS.lakeFill, waterSource, {
    minzoom: 3,
    filter: LAKE_FILTER,
    paint: {
      "fill-color": "#76a9bc",
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.07,
        7,
        0.1,
        11,
        0.13,
      ],
    },
  });

  const coastWidth = [
    "interpolate",
    ["linear"],
    ["zoom"],
    3,
    0.8,
    6,
    1.05,
    10,
    1.5,
  ] as maplibregl.ExpressionSpecification;
  add(
    FORECAST_REFERENCE_LAYER_IDS.coastHalo,
    waterSource,
    "water",
    {
      minzoom: 3,
      paint: {
        "line-color": "rgba(234, 243, 245, 0.34)",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          1.7,
          6,
          2.05,
          10,
          2.55,
        ] as maplibregl.ExpressionSpecification,
        "line-blur": 0.85,
        "line-opacity": 0.68,
      },
    },
  );
  add(FORECAST_REFERENCE_LAYER_IDS.coast, waterSource, "water", {
    minzoom: 3,
    paint: {
      "line-color": "#203a44",
      "line-width": coastWidth,
      "line-opacity": 0.88,
    },
  });

  const riverWidth = [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    0.65,
    8,
    1.05,
    12,
    1.5,
  ] as maplibregl.ExpressionSpecification;
  add(
    FORECAST_REFERENCE_LAYER_IDS.riverHalo,
    waterwaySource,
    "waterway",
    {
      minzoom: 4,
      paint: {
        "line-color": "rgba(231, 242, 245, 0.28)",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          1.55,
          8,
          2.05,
          12,
          2.65,
        ] as maplibregl.ExpressionSpecification,
        "line-blur": 0.65,
        "line-opacity": 0.58,
      },
    },
  );
  add(FORECAST_REFERENCE_LAYER_IDS.river, waterwaySource, "waterway", {
    minzoom: 4,
    paint: {
      "line-color": "#5b8fa4",
      "line-width": riverWidth,
      "line-opacity": 0.82,
    },
  });

  add(
    FORECAST_REFERENCE_LAYER_IDS.road,
    transportationSource,
    "transportation",
    {
      minzoom: 5,
      filter: [
        "match",
        ["to-string", ["get", "class"]],
        ["motorway", "trunk", "primary"],
        true,
        false,
      ],
      paint: {
        "line-color": "#38545e",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.35,
          8,
          0.65,
          12,
          1.15,
        ],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.08,
          8,
          0.16,
          12,
          0.25,
        ],
        "line-blur": 0.2,
      },
    },
  );

  const countryWidth = [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    0.9,
    6,
    1.2,
    10,
    1.65,
  ] as maplibregl.ExpressionSpecification;
  add(
    FORECAST_REFERENCE_LAYER_IDS.countryHalo,
    boundarySource,
    "boundary",
    {
      minzoom: 2,
      filter: LAND_COUNTRY_BOUNDARY_FILTER,
      paint: {
        "line-color": "rgba(235, 243, 245, 0.3)",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          2,
          1.75,
          6,
          2.15,
          10,
          2.65,
        ] as maplibregl.ExpressionSpecification,
        "line-blur": 0.9,
        "line-opacity": 0.62,
      },
    },
  );
  add(
    FORECAST_REFERENCE_LAYER_IDS.country,
    boundarySource,
    "boundary",
    {
      minzoom: 2,
      filter: LAND_COUNTRY_BOUNDARY_FILTER,
      paint: {
        "line-color": "#1d3741",
        "line-width": countryWidth,
        "line-opacity": 0.86,
      },
    },
  );
  return orderedIds[0];
}
