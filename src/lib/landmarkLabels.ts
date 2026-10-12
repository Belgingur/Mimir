/**
 * Landmark labels above the forecast: mountain peaks, fjord, bay and lake
 * names, and island names, from the basemap's own vector tiles.
 *
 * Zoomed in, the forecast is a field of colour with a few town names on it,
 * and a reader can lose track of where they are. The tiles already carry the
 * features that fix that, but positron draws its water names under the
 * forecast and has no peak or island labels at all.
 *
 * Natural features are set in italics, settlements upright and bold, so a
 * peak never reads as a town. The layers sit below the place labels, and
 * MapLibre places symbols from the top of the stack down, so a town always
 * wins the space and landmarks fill the gaps between towns.
 */

import type * as maplibregl from "maplibre-gl";
import { LABEL_HALO_BLUR, LABEL_HALO_COLOR } from "./mapLabelStyleTokens";

export const LANDMARK_LAYER_IDS = {
  water: "mimir-landmark-water-names",
  islands: "mimir-landmark-islands",
  peaks: "mimir-landmark-peaks",
} as const;

export const PEAK_ICON_ID = "mimir-peak";

/** Land features: a warm light tone, apart from the settlements' white. */
export const LANDMARK_TEXT_COLOR = "#efe2c6";
/** Water features: a pale blue. */
export const WATER_NAME_TEXT_COLOR = "#cde6f0";
export const LANDMARK_HALO_WIDTH = 1.2;
export const LANDMARK_FONT = ["Metropolis Medium Italic", "Noto Sans Italic"];

/**
 * Lower than this, a "peak" is a hill (Denmark's highest is 170 m) that helps
 * no one find their way at these zooms.
 */
export const PEAK_MIN_ELEVATION_M = 200;

/**
 * The tiles rank peaks 1–5 within each patch of a tile, so rank 1 is spread
 * evenly instead of crowding into the high Alps. One per patch at first,
 * two from z9.
 */
export const PEAK_MAX_RANK_BY_ZOOM: maplibregl.ExpressionSpecification = [
  "step",
  ["zoom"],
  1,
  9,
  2,
];

/** Islands rank 1 (largest) to 4: the big ones from z7, all from z9. */
export const ISLAND_MAX_RANK_BY_ZOOM: maplibregl.ExpressionSpecification = [
  "step",
  ["zoom"],
  2,
  9,
  4,
];

const NAME = ["coalesce", ["get", "name:latin"], ["get", "name"]];

export const PEAK_FILTER = [
  "all",
  ["match", ["get", "class"], ["peak", "volcano"], true, false],
  ["has", "name"],
  [">=", ["to-number", ["get", "ele"], 0], PEAK_MIN_ELEVATION_M],
  ["<=", ["to-number", ["get", "rank"], 99], PEAK_MAX_RANK_BY_ZOOM],
] as maplibregl.FilterSpecification;

/** Seas and oceans are left to the country names that own the far-out view. */
export const WATER_NAME_FILTER = [
  "match",
  ["get", "class"],
  ["bay", "strait", "lake"],
  true,
  false,
] as maplibregl.FilterSpecification;

export const ISLAND_FILTER = [
  "all",
  ["==", ["get", "class"], "island"],
  ["<=", ["to-number", ["get", "rank"], 99], ISLAND_MAX_RANK_BY_ZOOM],
] as maplibregl.FilterSpecification;

const TEXT_SIZE: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  7,
  11,
  10,
  12.5,
];

/** Larger for the larger islands: Sjælland or Streymoy, not a skerry. */
const ISLAND_TEXT_SIZE: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  7,
  ["match", ["to-number", ["get", "rank"], 99], 1, 13.5, 2, 12, 11],
  10,
  ["match", ["to-number", ["get", "rank"], 99], 1, 16, 2, 14, 12.5],
];

/**
 * A small filled triangle in the landmark colour with a dark rim, drawn at
 * twice its CSS size for sharp edges on high-density screens. Built from
 * pixels rather than a font glyph, so it does not depend on what the glyph
 * server carries.
 */
export function buildPeakIcon(): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const width = 22;
  const height = 20;
  const rim = 2.4;
  const [fr, fg, fb] = [0xef, 0xe2, 0xc6];
  const [rr, rg, rb] = [14, 31, 38];
  const data = new Uint8Array(width * height * 4);
  // Signed distance (positive inside) to an upward triangle filling the box.
  const top: [number, number] = [width / 2, 1];
  const left: [number, number] = [1, height - 1];
  const right: [number, number] = [width - 1, height - 1];
  const edge = (a: [number, number], b: [number, number], x: number, y: number) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    return ((x - a[0]) * dy - (y - a[1]) * dx) / Math.hypot(dx, dy);
  };
  const inside = (x: number, y: number) =>
    Math.min(edge(top, left, x, y), edge(left, right, x, y), edge(right, top, x, y));
  const SAMPLES = 4;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let fill = 0;
      let cover = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const d = inside(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES);
          if (d >= 0) cover++;
          if (d >= rim) fill++;
        }
      }
      const n = SAMPLES * SAMPLES;
      const alpha = cover / n;
      if (alpha === 0) continue;
      const t = fill / Math.max(cover, 1);
      const i = (py * width + px) * 4;
      data[i] = Math.round(rr + (fr - rr) * t);
      data[i + 1] = Math.round(rg + (fg - rg) * t);
      data[i + 2] = Math.round(rb + (fb - rb) * t);
      data[i + 3] = Math.round(255 * alpha);
    }
  }
  return { width, height, data };
}

/**
 * Add the landmark layers under `placeBeforeId`, the first place-label layer.
 * Idempotent, so it is safe on every style load. Without a place layer the
 * style is not one this knows, and nothing is added: landmarks on top of the
 * stack would take the space from the town names.
 */
export function ensureLandmarkLabels(
  map: maplibregl.Map,
  placeBeforeId: string | undefined,
): void {
  if (!placeBeforeId) return;
  const layers = (map.getStyle()?.layers ?? []) as {
    "source-layer"?: string;
    source?: unknown;
  }[];
  const source = layers.find(
    (layer) => layer["source-layer"] === "place" && typeof layer.source === "string",
  )?.source as string | undefined;
  if (!source) return;

  if (!map.hasImage(PEAK_ICON_ID)) {
    map.addImage(PEAK_ICON_ID, buildPeakIcon(), { pixelRatio: 2 });
  }

  const paint = (color: string): maplibregl.SymbolLayerSpecification["paint"] => ({
    "text-color": color,
    "text-halo-color": LABEL_HALO_COLOR,
    "text-halo-width": LANDMARK_HALO_WIDTH,
    "text-halo-blur": LABEL_HALO_BLUR,
  });
  const add = (layer: maplibregl.SymbolLayerSpecification) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, placeBeforeId);
  };

  // The tiles carry water names as lines through the water body, so they
  // follow it the way positron's own water labels do.
  add({
    id: LANDMARK_LAYER_IDS.water,
    type: "symbol",
    source,
    "source-layer": "water_name",
    minzoom: 7,
    filter: WATER_NAME_FILTER,
    layout: {
      "text-field": NAME as maplibregl.ExpressionSpecification,
      "text-font": LANDMARK_FONT,
      "text-size": TEXT_SIZE,
      "text-letter-spacing": 0.05,
      "symbol-placement": "line",
      "symbol-spacing": 500,
      "text-rotation-alignment": "map",
      "text-max-angle": 30,
    },
    paint: paint(WATER_NAME_TEXT_COLOR),
  });

  add({
    id: LANDMARK_LAYER_IDS.islands,
    type: "symbol",
    source,
    "source-layer": "place",
    minzoom: 7,
    filter: ISLAND_FILTER,
    layout: {
      "text-field": NAME as maplibregl.ExpressionSpecification,
      "text-font": LANDMARK_FONT,
      "text-size": ISLAND_TEXT_SIZE,
      "text-letter-spacing": 0.05,
      "text-max-width": 8,
      "symbol-sort-key": ["to-number", ["get", "rank"], 99],
    },
    paint: paint(LANDMARK_TEXT_COLOR),
  });

  // The name, and the height in metres on a smaller second line.
  add({
    id: LANDMARK_LAYER_IDS.peaks,
    type: "symbol",
    source,
    "source-layer": "mountain_peak",
    minzoom: 7,
    filter: PEAK_FILTER,
    layout: {
      "icon-image": PEAK_ICON_ID,
      "text-field": [
        "format",
        NAME,
        {},
        "\n",
        {},
        ["concat", ["to-string", ["get", "ele"]], " m"],
        { "font-scale": 0.82 },
      ] as maplibregl.ExpressionSpecification,
      "text-font": LANDMARK_FONT,
      "text-size": TEXT_SIZE,
      "text-anchor": "top",
      "text-offset": [0, 0.55],
      "text-max-width": 8,
      // Higher peaks win collisions against lower neighbours.
      "symbol-sort-key": ["-", 0, ["to-number", ["get", "ele"], 0]],
    },
    paint: paint(LANDMARK_TEXT_COLOR),
  });
}
