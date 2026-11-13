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
import { FALLBACK_OUTLINE_LAYER_ID } from "./mapStartup";

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
  glacierFill: "mimir-reference-glacier-fill",
  glacierStipple: "mimir-reference-glacier-stipple",
  coastHalo: "mimir-reference-coast-halo",
  coast: "mimir-reference-coast",
  riverHalo: "mimir-reference-river-halo",
  river: "mimir-reference-river",
  roadHalo: "mimir-reference-road-halo",
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

const GLACIER_FILTER = [
  "==",
  ["get", "subclass"],
  "glacier",
] as maplibregl.FilterSpecification;

export const GLACIER_PATTERN_ID = "mimir-glacier-stipple";

/**
 * The glacier stipple: two light dots, staggered, in a 10 px cell, drawn at
 * twice its CSS size. A repeating pattern is anchored to the world, not to
 * the tile, so it carries across tile edges without a seam.
 */
export function buildGlacierPattern(): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const size = 20;
  const radius = 1.9;
  const centres: [number, number][] = [
    [5, 5],
    [15, 15],
  ];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(
        ...centres.map(([cx, cy]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy)),
      );
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - d));
      if (alpha === 0) continue;
      const i = (y * size + x) * 4;
      data[i] = 0xf4;
      data[i + 1] = 0xfb;
      data[i + 2] = 0xfd;
      data[i + 3] = Math.round(255 * alpha);
    }
  }
  return { width: size, height: size, data };
}

/** Basemap source layers hidden because Mímir draws its own above the forecast. */
const BASEMAP_SOURCE_LAYERS_REDRAWN: ReadonlySet<string> = new Set([
  "boundary",
  "transportation",
  "transportation_name",
]);

/** Road classes drawn from the road layer's first zoom. */
export const MAIN_ROAD_CLASSES = ["motorway", "trunk", "primary"] as const;
/** Secondary roads join at this zoom. */
export const SECONDARY_ROAD_MIN_ZOOM = 8;

const ROAD_FILTER = [
  "any",
  ["match", ["to-string", ["get", "class"]], [...MAIN_ROAD_CLASSES], true, false],
  [
    "all",
    [">=", ["zoom"], SECONDARY_ROAD_MIN_ZOOM],
    ["==", ["to-string", ["get", "class"]], "secondary"],
  ],
] as maplibregl.FilterSpecification;

type ReferenceLayerId =
  (typeof FORECAST_REFERENCE_LAYER_IDS)[keyof typeof FORECAST_REFERENCE_LAYER_IDS];

/**
 * Add a restrained cartographic reference stack above the forecast, reusing
 * the basemap's vector source. This replaces the former 7 MB country GeoJSON
 * download and adds lakes, glaciers, coastlines, major waterways, and country borders
 * without another network source.
 *
 * Returns the first reference layer id, which is the correct `beforeId` for
 * weather rasters: forecast below reference ink, place labels above both.
 * On the fallback style that is its outline layer.
 */
export function ensureForecastReferenceLayers(
  map: maplibregl.Map,
  labelBeforeId: string | undefined,
): string | undefined {
  const style = map.getStyle() as MinimalStyle;
  // Hide the basemap's boundary and road stacks, road names included; Mímir
  // redraws filtered boundaries and roads above the forecast. Positron's boundaries include maritime and
  // territorial lines, pale offshore rings wherever a regional forecast is
  // transparent or ends at its domain edge. Its roads sit under the forecast,
  // so they showed only through the transparent (dry) end of precipitation
  // and on no other parameter.
  for (const layer of style.layers ?? []) {
    if (
      !BASEMAP_SOURCE_LAYERS_REDRAWN.has(layer["source-layer"] ?? "") ||
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
  const landcoverSource = sourceFor("landcover");
  const waterwaySource = sourceFor("waterway");
  const transportationSource = sourceFor("transportation");
  const boundarySource = sourceFor("boundary");
  const orderedIds: ReferenceLayerId[] = [];

  const addFill = (
    id: ReferenceLayerId,
    source: string | undefined,
    sourceLayer: string,
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
      "source-layer": sourceLayer,
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
  addFill(FORECAST_REFERENCE_LAYER_IDS.lakeFill, waterSource, "water", {
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

  // Glaciers: a faint icy wash under a light stipple, the atlas convention.
  // Ice caps are among the most recognisable shapes on a map of Iceland,
  // Norway or the Alps, and the wash is as faint as the lakes' so the forecast
  // colours still read true. Not an outline: from z7 the tiles cut glacier
  // polygons exactly at the tile edge, with no buffer, so an outline (or a
  // fill's antialiased edge) draws the tile grid across every ice cap.
  if (landcoverSource && !map.hasImage(GLACIER_PATTERN_ID)) {
    map.addImage(GLACIER_PATTERN_ID, buildGlacierPattern(), { pixelRatio: 2 });
  }
  addFill(FORECAST_REFERENCE_LAYER_IDS.glacierFill, landcoverSource, "landcover", {
    minzoom: 5,
    filter: GLACIER_FILTER,
    paint: {
      "fill-color": "#eef7fa",
      "fill-antialias": false,
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.08,
        9,
        0.12,
      ],
    },
  });
  addFill(FORECAST_REFERENCE_LAYER_IDS.glacierStipple, landcoverSource, "landcover", {
    minzoom: 5,
    filter: GLACIER_FILTER,
    paint: {
      "fill-pattern": GLACIER_PATTERN_ID,
      "fill-antialias": false,
      "fill-opacity": 0.75,
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

  // Secondary roads are drawn thinner than the main ones at the same zoom.
  const roadWidth = (main: number, secondary: number) =>
    [
      "match",
      ["to-string", ["get", "class"]],
      "secondary",
      secondary,
      main,
    ] as maplibregl.ExpressionSpecification;
  add(
    FORECAST_REFERENCE_LAYER_IDS.roadHalo,
    transportationSource,
    "transportation",
    {
      minzoom: 5,
      filter: ROAD_FILTER,
      paint: {
        "line-color": "rgba(240, 245, 246, 0.5)",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          2.2,
          8,
          roadWidth(2.8, 2),
          12,
          roadWidth(3.6, 2.8),
        ] as maplibregl.ExpressionSpecification,
        "line-blur": 0.6,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.4,
          8,
          0.5,
          12,
          0.55,
        ],
      },
    },
  );
  add(
    FORECAST_REFERENCE_LAYER_IDS.road,
    transportationSource,
    "transportation",
    {
      minzoom: 5,
      filter: ROAD_FILTER,
      paint: {
        "line-color": "#2f454d",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.9,
          8,
          roadWidth(1.3, 0.8),
          12,
          roadWidth(2, 1.4),
        ] as maplibregl.ExpressionSpecification,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.6,
          8,
          0.65,
          12,
          0.7,
        ],
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
  if (orderedIds.length > 0) return orderedIds[0];
  // The fallback style's tiles have none of these source layers, so nothing
  // was added. Its own outline is the reference there, and the forecast goes
  // under it as it goes under the stack above.
  return style.layers?.find((layer) => layer.id === FALLBACK_OUTLINE_LAYER_ID)
    ?.id;
}
