/**
 * Snow-fraction symbols, drawn as a MapLibre symbol layer.
 *
 * Symbol design follows public/data/snowflakes.js:
 *
 *   Tier 1 (0.25–0.50): two small white dots  per tile  — pt-snow-1 (r=0.75)
 *   Tier 2 (0.50–0.75): two medium white dots per tile  — pt-snow-2 (r=1 / r=1.25)
 *   Tier 3 (0.75–1.00): two snowflakes                  — pt-snow-3 using #snow-flake
 *                        at scale 0.020 / 0.027 with a per-block rotation
 *
 * Architecture
 * ────────────
 * extractSnowPoints()  scans the snow-fraction raster, gated by the
 *   precipitation frame for the same time, and returns a flat list of
 *   SnowPoint objects (one per symbol, two per tile block). The caller caches
 *   it per pair of frames, so it is recomputed only when a new frame loads.
 *
 * syncSnowSymbols()    puts those points in a GeoJSON source drawn by a
 *   symbol layer just under the first label layer above the weather, so place
 *   names are drawn over the symbols. The symbols move with the map; their
 *   size follows the zoom through the layer's icon-size expression.
 */

import type * as maplibregl from "maplibre-gl";
import type { InhouseLayer } from "./inhouseTypes";
import { getInhouseLayerUnscale } from "./inhouseLayerHelpers";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum snow_fraction to show any symbol (matches fillSnowFrac.domain()[0]). */
export const SNOW_OVERLAY_MIN = 0.25;

/**
 * The least precipitation, in mm/h, at which a cell's snow fraction counts.
 * A dry cell's snow fraction says what would fall, not that anything does.
 */
export const SNOW_PRECIP_MIN_MM_H = 0.1;

/**
 * Distance between tile block centres in raster pixels.
 * Controls symbol density.  Larger = sparser.
 */
export const TILE_STEP = 12;

/** Scale factors of a tile's two snowflakes (pt-snow-3: 0.02 and 0.027). */
const SMALL_FLAKE_SIZE = 0.02;
const LARGE_FLAKE_SIZE = 0.027;

/** Height of the snowflake path in its own units (y runs from 43.1 to 369.9). */
const FLAKE_PATH_HEIGHT = 326.84;

/**
 * The smallest and the largest a symbol is drawn on screen, in pixels: the
 * height of the larger snowflake. The other symbols keep their proportions to
 * it (a tier-2 dot is 2.5 base units across to the flake's 8.8).
 */
export const MIN_FLAKE_PX = 8;
export const MAX_FLAKE_PX = 18;

/** The circumference of the earth at the equator, in metres (Web Mercator). */
const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** MapLibre's tile size: the world is 512 × 2^zoom px wide. */
const WORLD_PX_AT_ZOOM_0 = 512;

/**
 * How wide a tile block (TILE_STEP cells) is on screen, in pixels, for a grid
 * of `gridSpacingMeters` at `zoom` and latitude `lat`. This ties the symbols
 * to the model's resolution: a block of a 2.5 km model is ten times smaller
 * on screen than a block of a 25 km one at the same zoom.
 */
export function snowBlockPx(
  gridSpacingMeters: number,
  zoom: number,
  lat: number,
): number {
  const metersPerPx =
    (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) /
    (WORLD_PX_AT_ZOOM_0 * 2 ** zoom);
  return (TILE_STEP * gridSpacingMeters) / metersPerPx;
}

/**
 * The zooms at which the larger snowflake, half a tile block high, reaches
 * MIN_FLAKE_PX and MAX_FLAKE_PX on a grid of `gridSpacingMeters` at latitude
 * `lat`. Between them it grows with the block (×2 per zoom); outside them it
 * stays at the nearer limit: zoomed out, a symbol stays big enough to see;
 * zoomed in, it stands for an area of the forecast grid and doesn't grow over
 * the map and its labels. Null for a grid of unknown spacing.
 */
export function snowFlakeZoomRange(
  gridSpacingMeters: number | null,
  lat: number,
): [number, number] | null {
  if (
    gridSpacingMeters === null ||
    !Number.isFinite(gridSpacingMeters) ||
    gridSpacingMeters <= 0
  ) {
    return null;
  }
  const flakePxAtZoom0 = snowBlockPx(gridSpacingMeters, 0, lat) / 2;
  const zoomFor = (px: number) => Math.log2(px / flakePxAtZoom0);
  return [zoomFor(MIN_FLAKE_PX), zoomFor(MAX_FLAKE_PX)];
}

/**
 * The symbols' outline, which keeps them readable on light colours: a dark
 * edge of SYMBOL_OUTLINE_PX screen pixels centred on the symbol's outline, so
 * half of it shows outside the white fill (as the SVG stroke drawn behind the
 * fill did, #63). It is the icons' halo: the icons are signed distance
 * fields, so the edge keeps its width in screen pixels at every icon size and
 * stays sharp at any scale, in WebKit too.
 */
export const SYMBOL_OUTLINE_PX = 1;
export const SYMBOL_OUTLINE_COLOR = "rgba(0, 20, 80, 0.4)";
export const SYMBOL_HALO_PX = SYMBOL_OUTLINE_PX / 2;

// ─── Snowflake path ───────────────────────────────────────────────────────────
// Copied verbatim from public/data/snowflakes.js (#snow-flake path data).
// The original element carries transform="translate(-202 -202)": the flake is
// centred on (202, 202), which is the icon's centre and rotation point.
const FLAKE_PATH_D =
  "M183.3125,43.09375L183.3125,83.8125L152.71875,66.125L137.1875,92.9375" +
  "L183.3125,119.65625L183.3125,179.75L131.5,149.8125L131.40625,96.28125" +
  "L100.40625,96.34375L100.46875,131.90625L65.09375,111.46875L49.59375,138.3125" +
  "L84.875,158.6875L54.25,176.3125L69.6875,203.1875L115.90625,176.59375" +
  "L167.90625,206.625L116.09375,236.53125L69.6875,209.84375L54.25,236.71875" +
  "L85.0625,254.46875L49.6875,274.875L65.1875,301.71875L100.46875,281.34375" +
  "L100.40625,316.6875L131.40625,316.75L131.5,263.4375L183.5,233.4375" +
  "L183.5,293.25L137.1875,320.09375L152.71875,346.90625L183.5,329.09375" +
  "L183.5,369.9375L214.5,369.9375L214.5,329.21875L245.09375,346.90625" +
  "L260.625,320.09375L214.5,293.375L214.5,233.28125L266.3125,263.21875" +
  "L266.40625,316.75L297.40625,316.6875L297.34375,281.125L332.71875,301.5625" +
  "L348.21875,274.71875L312.9375,254.34375L343.5625,236.71875L328.125,209.84375" +
  "L281.9375,236.4375L229.90625,206.40625L281.75,176.46875L328.125,203.1875" +
  "L343.5625,176.3125L312.75,158.5625L348.125,138.15625L332.625,111.3125" +
  "L297.34375,131.6875L297.40625,96.34375L266.40625,96.28125L266.3125,149.59375" +
  "L214.3125,179.59375L214.3125,119.78125L260.625,92.9375L245.09375,66.125" +
  "L214.3125,83.9375L214.3125,43.09375L183.3125,43.09375z";

// ─── Data types ───────────────────────────────────────────────────────────────

export interface SnowPoint {
  lng: number;
  lat: number;
  tier: 1 | 2 | 3;
  /** Rotation in degrees (meaningful for tier 3 flakes only). */
  rot: number;
  /**
   * For tiers 1 & 2: circle radius, in the units of the snowflake path scaled
   * by 1 (matching pt-snow-1 and pt-snow-2).
   * For tier 3: scale factor applied to the snowflake path (matching
   * pt-snow-3: scale(0.02) for the first symbol, scale(0.027) for the second).
   */
  size: number;
}

// ─── Point extraction ─────────────────────────────────────────────────────────

type RasterScalar = {
  data: Uint8Array;
  width: number;
  height: number;
  widthMeta?: number;
};

/** A decoded precipitation frame, in mm/h (`InhouseLayer.scalar`). */
export type PrecipGrid = { data: Float32Array; width: number; height: number };

/**
 * Whether the snow-fraction frame and the precipitation frame both hold the
 * selected time. `selectedFrameTime` gives the time a layer should hold for
 * the timeline's selection; a layer's `frameTime` is the time it does hold.
 * A frame still arriving, or one that failed, leaves the layer on an earlier
 * time, so the symbols wait instead of being gated on another time's
 * precipitation.
 */
export function snowFramesAreCurrent<L extends Pick<InhouseLayer, "frameTime">>(
  snow: L,
  precip: L,
  selectedFrameTime: (layer: L) => string | null,
): boolean {
  if (!snow.frameTime || !precip.frameTime) return false;
  if (snow.frameTime !== precip.frameTime) return false;
  return (
    selectedFrameTime(snow) === snow.frameTime &&
    selectedFrameTime(precip) === precip.frameTime
  );
}

/**
 * Scan the snow_fraction raster and return one SnowPoint per symbol to render
 * (two staggered symbols per tile block, mirroring the two-element stagger in
 * the reference SVG patterns).
 *
 * Only cells with at least SNOW_PRECIP_MIN_MM_H of precipitation count: a
 * block's symbol comes from the largest snow fraction among them, and a block
 * without one gets no symbol. `precip` must be the frame for the same time
 * (see snowFramesAreCurrent); without it there are no symbols.
 *
 * Returns null when no block has a counted cell at SNOW_OVERLAY_MIN or more.
 */
export function extractSnowPoints(
  layer: InhouseLayer,
  precip: PrecipGrid | null,
): SnowPoint[] | null {
  const rasterScalar = layer.rasterScalar as RasterScalar | null | undefined;
  if (!rasterScalar || !precip) return null;

  const { data, width: paddedWidth, height, widthMeta } = rasterScalar;
  const rasterW = widthMeta ?? paddedWidth;
  const rasterH = height;

  // The precipitation cell under a snow cell. Both come from the same model's
  // grid and normally have the same size; otherwise the nearest cell by
  // position in the domain.
  const sameGrid = precip.width === rasterW && precip.height === rasterH;
  const px = (rx: number) =>
    sameGrid
      ? rx
      : Math.round((rx * (precip.width - 1)) / Math.max(1, rasterW - 1));
  const py = (ry: number) =>
    sameGrid
      ? ry
      : Math.round((ry * (precip.height - 1)) / Math.max(1, rasterH - 1));
  // NaN (outside the domain) fails the comparison and doesn't count.
  const isWet = (rx: number, ry: number) =>
    (precip.data[py(ry) * precip.width + px(rx)] ?? Number.NaN) >=
    SNOW_PRECIP_MIN_MM_H;

  const [unscaleMin, unscaleMax] = getInhouseLayerUnscale(layer);
  const decode = (raw: number) =>
    unscaleMin + (raw / 255) * (unscaleMax - unscaleMin);

  // Geographic extent from manifest bounds [west, south, east, north].
  const [west, south, east, north] = layer.manifest.bounds as [
    number,
    number,
    number,
    number,
  ];

  /** Longitude for raster column rx (row 0 = leftmost / westmost). */
  const lngOf = (rx: number) => west + (rx / (rasterW - 1)) * (east - west);
  /** Latitude  for raster row    ry (row 0 = northernmost after np.flipud). */
  const latOf = (ry: number) => north - (ry / (rasterH - 1)) * (north - south);

  const step = TILE_STEP;
  const points: SnowPoint[] = [];

  for (let gy = 0; gy < rasterH; gy += step) {
    const yEnd = Math.min(gy + step, rasterH);

    for (let gx = 0; gx < rasterW; gx += step) {
      const xEnd = Math.min(gx + step, rasterW);

      // Maximum snow_fraction among this tile block's wet cells.
      let maxFrac = 0;
      for (let ry = gy; ry < yEnd; ry++) {
        const rowBase = ry * paddedWidth;
        for (let rx = gx; rx < xEnd; rx++) {
          if (!isWet(rx, ry)) continue;
          const frac = decode(data[rowBase + rx]);
          if (frac > maxFrac) maxFrac = frac;
        }
      }
      if (maxFrac < SNOW_OVERLAY_MIN) continue;

      // Tier thresholds match fillSnowFrac in snowflakes.js.
      const tier: 1 | 2 | 3 = maxFrac >= 0.75 ? 3 : maxFrac >= 0.5 ? 2 : 1;

      // Two staggered positions within the block — mirrors (5,5) and (15,14)
      // in the reference 20×20 SVG pattern tiles.
      const rx1 = gx + (xEnd - gx) * 0.25;
      const ry1 = gy + (yEnd - gy) * 0.25;
      const rx2 = gx + (xEnd - gx) * 0.75;
      const ry2 = gy + (yEnd - gy) * 0.7;

      // Deterministic per-block rotations for visual variety.
      const rot1 = ((gx * 7 + gy * 13) % 60) - 30; // –30° … +30°
      const rot2 = ((gx * 11 + gy * 7) % 60) - 30;

      if (tier === 3) {
        // Snowflake path — scale factors mirror pt-snow-3: scale(0.02) / scale(0.027).
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: rot1,
          size: SMALL_FLAKE_SIZE,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: rot2,
          size: LARGE_FLAKE_SIZE,
        });
      } else if (tier === 2) {
        // Medium dots — matches pt-snow-2: r=1 and r=1.25.
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: 0,
          size: 1.0,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: 0,
          size: 1.25,
        });
      } else {
        // Small dots — matches pt-snow-1: r=0.75.
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: 0,
          size: 0.75,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: 0,
          size: 0.75,
        });
      }
    }
  }

  return points.length > 0 ? points : null;
}

// ─── Map layer ───────────────────────────────────────────────────────────────

export const SNOW_SOURCE_ID = "mimir-snow-symbols";
export const SNOW_LAYER_ID = "mimir-snow-symbols";
export const SNOW_IMAGE_IDS = {
  dot: "mimir-snow-dot",
  flake: "mimir-snow-flake",
} as const;

/**
 * Size of a symbol in its icon image, in image pixels: the snowflake path's
 * height and the dot's diameter. Large enough that the thin arms of the flake
 * stay resolved in the distance field.
 */
const ICON_SYMBOL_PX = 64;
/**
 * How far outside the symbol the distance field reaches, in image pixels.
 * MapLibre's SDF encoding puts the edge at 6/8 and loses the field 6 px out,
 * so a halo can't be wider than this many image pixels.
 */
const ICON_PAD_PX = 6;
/** Image pixels per unit of distance in MapLibre's SDF alpha (SDF_PX). */
const SDF_PX = 8;
/** Alpha level of the edge in MapLibre's SDF encoding (6 / SDF_PX). */
const SDF_EDGE = 6 / SDF_PX;

/** An icon image for map.addImage: RGBA, with the distance field in alpha. */
export interface SdfImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Encode a signed distance (image px, negative inside) as MapLibre's SDF
 * alpha: SDF_EDGE on the edge, falling by 1 / SDF_PX per pixel outward.
 */
function sdfAlpha(distance: number): number {
  const a = SDF_EDGE - distance / SDF_PX;
  return Math.round(255 * Math.min(1, Math.max(0, a)));
}

function sdfImage(
  size: number,
  signedDistance: (x: number, y: number) => number,
): SdfImage {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = sdfAlpha(signedDistance(x + 0.5, y + 0.5));
    }
  }
  return { width: size, height: size, data };
}

/** The dot: a disc ICON_SYMBOL_PX across, centred in the image. */
export function buildSnowDotIcon(): SdfImage {
  const r = ICON_SYMBOL_PX / 2;
  const size = 2 * (r + ICON_PAD_PX);
  const c = size / 2;
  return sdfImage(size, (x, y) => Math.hypot(x - c, y - c) - r);
}

/** The snowflake path's vertices, in its own units. */
function flakeVertices(): [number, number][] {
  const nums = FLAKE_PATH_D.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
  return points;
}

/** Distance from (px, py) to the segment (ax, ay)–(bx, by). */
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 > 0
      ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
      : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The snowflake: the path scaled so it is ICON_SYMBOL_PX high, with its
 * centre (202, 202) in the image's centre, so it rotates about it as the SVG
 * symbol did.
 */
export function buildSnowFlakeIcon(): SdfImage {
  const k = ICON_SYMBOL_PX / FLAKE_PATH_HEIGHT;
  const verts = flakeVertices();
  const reach = Math.max(
    ...verts.map(([x, y]) => Math.max(Math.abs(x - 202), Math.abs(y - 202))),
  );
  const size = 2 * Math.ceil(reach * k + ICON_PAD_PX);
  const c = size / 2;
  const poly = verts.map(([x, y]) => [c + (x - 202) * k, c + (y - 202) * k]);
  return sdfImage(size, (x, y) => {
    let inside = false;
    let d = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
      d = Math.min(d, segmentDistance(x, y, xi, yi, xj, yj));
    }
    return inside ? -d : d;
  });
}

/** On-screen height of the larger snowflake per unit of the symbols' scale. */
const LARGE_FLAKE_HEIGHT = FLAKE_PATH_HEIGHT * LARGE_FLAKE_SIZE;

/**
 * A point's icon size for each pixel of the larger snowflake's height: its
 * own height (a flake's) or diameter (a dot's) relative to the larger flake,
 * over the size of its icon image.
 */
export function snowIconSizePerFlakePx(point: SnowPoint): number {
  const height =
    point.tier === 3
      ? point.size * FLAKE_PATH_HEIGHT
      : 2 * point.size;
  return height / LARGE_FLAKE_HEIGHT / ICON_SYMBOL_PX;
}

/** The GeoJSON the snow layer draws, one feature per point. */
export function snowFeatures(
  points: readonly SnowPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: {
        icon: point.tier === 3 ? SNOW_IMAGE_IDS.flake : SNOW_IMAGE_IDS.dot,
        size: snowIconSizePerFlakePx(point),
        rot: point.rot,
      },
    })),
  };
}

/**
 * The layer's icon-size: the larger flake MIN_FLAKE_PX high up to the first
 * zoom of `range`, growing ×2 per zoom to MAX_FLAKE_PX at the second, then
 * held there; each symbol keeps its proportion to it (the feature's `size`).
 * Without a range (unknown grid spacing) every zoom draws the smallest size.
 */
export function snowIconSizeExpression(
  range: [number, number] | null,
): maplibregl.DataDrivenPropertyValueSpecification<number> {
  const at = (px: number) => ["*", px, ["get", "size"]];
  if (!range) return at(MIN_FLAKE_PX) as never;
  // Rounded so a small pan (another centre latitude) doesn't re-lay the layer.
  const [z0, z1] = range.map((z) => Math.round(z * 100) / 100);
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    z0,
    at(MIN_FLAKE_PX),
    z1,
    at(MAX_FLAKE_PX),
  ] as never;
}

/** The part of a MapLibre map the snow layer uses. */
export type SnowMap = Pick<
  maplibregl.Map,
  | "getSource"
  | "addSource"
  | "getLayer"
  | "addLayer"
  | "moveLayer"
  | "getLayersOrder"
  | "hasImage"
  | "addImage"
  | "setLayoutProperty"
  | "setPaintProperty"
>;

/**
 * The layer the snow symbols go under: the first symbol layer from
 * `weatherBeforeId` up, the first label above the weather and its reference
 * lines. Undefined (the top of the stack) when there is none.
 */
export function snowLayerBeforeId(
  map: Pick<maplibregl.Map, "getLayersOrder" | "getLayer">,
  weatherBeforeId: string | undefined,
): string | undefined {
  const order = map.getLayersOrder();
  const from = weatherBeforeId ? Math.max(0, order.indexOf(weatherBeforeId)) : 0;
  return order
    .slice(from)
    .find((id) => id !== SNOW_LAYER_ID && map.getLayer(id)?.type === "symbol");
}

export interface SnowSymbolState {
  /** The points to draw, or null for none. */
  points: readonly SnowPoint[] | null;
  /** Layer opacity, 0–1. */
  opacity: number;
  /** From snowFlakeZoomRange for the model's grid. */
  zoomRange: [number, number] | null;
  /** The weather's anchor in the layer stack (see snowLayerBeforeId). */
  weatherBeforeId: string | undefined;
}

/** What was last given to each map's layer, so unchanged values aren't re-sent. */
const applied = new WeakMap<
  SnowMap,
  { points: readonly SnowPoint[] | null; size: string; opacity: number }
>();

/**
 * Draw `state.points` as the snow layer, adding its images, source and layer
 * on first use and again after a style swap removed them. With no points the
 * layer stays and draws nothing.
 *
 * The layer allows overlap and ignores placement: a symbol is never dropped
 * by label collision and never displaces a place name.
 */
export function syncSnowSymbols(map: SnowMap, state: SnowSymbolState): void {
  if (!map.hasImage(SNOW_IMAGE_IDS.dot)) {
    map.addImage(SNOW_IMAGE_IDS.dot, buildSnowDotIcon(), { sdf: true });
  }
  if (!map.hasImage(SNOW_IMAGE_IDS.flake)) {
    map.addImage(SNOW_IMAGE_IDS.flake, buildSnowFlakeIcon(), { sdf: true });
  }

  const points = state.points && state.opacity > 0 ? state.points : null;
  const iconSize = snowIconSizeExpression(state.zoomRange);
  const sizeKey = JSON.stringify(iconSize);
  const fresh = !map.getLayer(SNOW_LAYER_ID);
  const last = fresh ? undefined : applied.get(map);

  const source = map.getSource(SNOW_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  const data = snowFeatures(points ?? []);
  if (!source) map.addSource(SNOW_SOURCE_ID, { type: "geojson", data });
  else if (!last || last.points !== points) source.setData(data);

  const beforeId = snowLayerBeforeId(map, state.weatherBeforeId);
  if (fresh) {
    map.addLayer(
      {
        id: SNOW_LAYER_ID,
        type: "symbol",
        source: SNOW_SOURCE_ID,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": iconSize,
          "icon-rotate": ["get", "rot"],
          "icon-rotation-alignment": "viewport",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": "#ffffff",
          "icon-halo-color": SYMBOL_OUTLINE_COLOR,
          "icon-halo-width": SYMBOL_HALO_PX,
          "icon-opacity": state.opacity,
        },
      },
      beforeId,
    );
  } else {
    // Labels added after the layer (after a style swap) belong above it.
    const order = map.getLayersOrder();
    const below = beforeId
      ? order[order.indexOf(beforeId) - 1]
      : order[order.length - 1];
    if (below !== SNOW_LAYER_ID) map.moveLayer(SNOW_LAYER_ID, beforeId);
    if (last?.size !== sizeKey) {
      map.setLayoutProperty(SNOW_LAYER_ID, "icon-size", iconSize);
    }
    if (last?.opacity !== state.opacity) {
      map.setPaintProperty(SNOW_LAYER_ID, "icon-opacity", state.opacity);
    }
  }
  applied.set(map, { points, size: sizeKey, opacity: state.opacity });
}

/** Draw no snow symbols (another view or parameter). Keeps the layer. */
export function clearSnowSymbols(map: SnowMap): void {
  const source = map.getSource(SNOW_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  const last = applied.get(map);
  if (!source || (last && last.points === null)) return;
  source.setData(snowFeatures([]));
  if (last) applied.set(map, { ...last, points: null });
}
