/**
 * Phase 2 — hit-test the city labels the vector basemap already draws.
 *
 * The labels come from the `place` source-layer of MapTiler's OpenMapTiles v3
 * tiles, which are already paid for as part of the basemap. Reading the name
 * and coordinates straight out of the returned feature means no geocoding or
 * reverse-geocoding request is ever made.
 */

import type maplibregl from "maplibre-gl";
import { PLACE_SOURCE_LAYER } from "./mapLayerOrder";
import { CITY_LABEL_LAYER_ID } from "./cityLabelLayer";

/**
 * Settlement label layers in the positron / OpenMapTiles schema, most specific
 * first. `place_state` and `place_country_*` are deliberately excluded: they
 * label regions and countries, not clickable settlements.
 */
export const SETTLEMENT_LAYER_IDS = [
  "place_capital",
  "place_city_large",
  "place_city",
  "place_town",
  "place_village",
  "place_suburb",
  "place_other",
] as const;

/**
 * Layers the click hit-test queries: Mímir's own city layer plus the basemap's.
 * The basemap city layers are hidden (see placeLabelStyle) and so return
 * nothing, but they stay listed so the hit-test still works if that changes or
 * the style is swapped.
 */
export const PICKABLE_LABEL_LAYER_IDS = [
  CITY_LABEL_LAYER_ID,
  ...SETTLEMENT_LAYER_IDS,
] as const;

/**
 * Weight for Mímir's own city features. Above every basemap class: these carry
 * the dataset's exact coordinates and a real population, which is what the
 * click path wants to resolve to.
 */
const OWN_CITY_WEIGHT = 100;

/**
 * Ranking weight per OpenMapTiles `class`, higher = more significant. Used to
 * pick a winner when several labels fall inside the query box.
 */
const CLASS_WEIGHT: Record<string, number> = {
  city: 60,
  town: 50,
  village: 40,
  suburb: 30,
  hamlet: 20,
  neighbourhood: 15,
  isolated_dwelling: 10,
};

/** Hit-box half-size in CSS pixels for a mouse pointer. */
const HIT_PADDING_FINE = 6;
/** Larger half-size for touch / coarse pointers, where taps are imprecise. */
const HIT_PADDING_COARSE = 10;

/** Two labels with the same name closer than this are treated as duplicates. */
const DUPLICATE_RADIUS_DEG = 0.5;

export interface PickedPlaceLabel {
  readonly name: string;
  readonly longitude: number;
  readonly latitude: number;
  /** OpenMapTiles `class`, e.g. "city" / "town" / "village". */
  readonly placeClass?: string;
  /** OpenMapTiles `rank`, lower = more important. */
  readonly rank?: number;
  /** Population, present only on Mímir's own city features. */
  readonly population?: number;
}

export interface PickPlaceLabelOptions {
  /** App locale, used to prefer a localised `name:<locale>` variant. */
  readonly locale?: string;
  /** Override hit-box sizing; defaults to a coarse-pointer media query. */
  readonly coarsePointer?: boolean;
}

/** True when the primary pointer is coarse (touch), so the hit box is widened. */
function hasCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Which of {@link SETTLEMENT_LAYER_IDS} exist in the style that is currently
 * loaded. The style can be swapped at runtime (see the demotiles error
 * fallback in mapEventHandlers), and querying a layer id that isn't present
 * throws, so this is checked on every call rather than cached.
 */
export function getPresentSettlementLayerIds(map: maplibregl.Map): string[] {
  return PICKABLE_LABEL_LAYER_IDS.filter((id) => {
    try {
      return Boolean(map.getLayer(id));
    } catch {
      return false;
    }
  });
}

/**
 * Pick the best localised name from a place feature's properties.
 *
 * OpenMapTiles v3 always carries `name`, `name:latin` and `name:nonlatin`;
 * per-language variants beyond a handful (`name:en`, `name:de`) are not
 * guaranteed, so the locale variant is only a preference.
 */
function pickName(
  props: Record<string, unknown>,
  locale?: string,
): string | null {
  const candidates = [
    locale ? `name:${locale}` : null,
    "name",
    "name:latin",
    "name:en",
  ].filter((key): key is string => Boolean(key));

  for (const key of candidates) {
    const value = props[key];
    if (typeof value === "string") {
      // The style's text-field is "{name:latin}\n{name:nonlatin}", so a raw
      // value can still carry a newline-joined script pair; keep the first line.
      const name = value.split("\n")[0].trim();
      if (name) return name;
    }
  }
  return null;
}

/**
 * Hit-test the basemap's own settlement labels at a screen point.
 *
 * @param point screen point of the click/tap, in CSS pixels
 * @returns the most significant label under the cursor, or null when none is.
 */
export function pickPlaceLabel(
  map: maplibregl.Map,
  point: { x: number; y: number },
  options: PickPlaceLabelOptions = {},
): PickedPlaceLabel | null {
  const layers = getPresentSettlementLayerIds(map);
  // Unknown schema (e.g. the demotiles fallback style): nothing to query.
  if (layers.length === 0) return null;

  const padding =
    (options.coarsePointer ?? hasCoarsePointer())
      ? HIT_PADDING_COARSE
      : HIT_PADDING_FINE;

  // A box, not a single pixel: a 1px query forces the user to hit the glyph
  // outlines exactly, which feels broken. Passing an explicit layer filter
  // keeps roads, landuse polygons and the rest out of the result.
  const box: [maplibregl.PointLike, maplibregl.PointLike] = [
    [point.x - padding, point.y - padding],
    [point.x + padding, point.y + padding],
  ];

  let features: maplibregl.MapGeoJSONFeature[];
  try {
    features = map.queryRenderedFeatures(box, { layers });
  } catch {
    // Style swapped between the layer check and the query.
    return null;
  }
  if (features.length === 0) return null;

  const candidates: (PickedPlaceLabel & {
    screenDistance: number;
    weight: number;
  })[] = [];

  for (const feature of features) {
    const isOwnCity = feature.layer?.id === CITY_LABEL_LAYER_ID;
    if (!isOwnCity && feature.sourceLayer !== PLACE_SOURCE_LAYER) continue;
    if (feature.geometry?.type !== "Point") continue;

    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const name = pickName(props, options.locale);
    if (!name) continue;

    // The label anchor is roughly the settlement centroid as authored by
    // OpenMapTiles — not an official administrative point. That precision is
    // fine for a weather lookup; revisit if exact boundaries ever matter.
    const [longitude, latitude] = feature.geometry.coordinates as [
      number,
      number,
    ];
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;

    const projected = map.project([longitude, latitude]);
    const screenDistance = Math.hypot(
      projected.x - point.x,
      projected.y - point.y,
    );

    const placeClass =
      typeof props.class === "string" ? props.class : undefined;
    candidates.push({
      name,
      longitude,
      latitude,
      placeClass: isOwnCity ? "city" : placeClass,
      rank: typeof props.rank === "number" ? props.rank : undefined,
      population:
        typeof props.population === "number" ? props.population : undefined,
      screenDistance,
      weight: isOwnCity ? OWN_CITY_WEIGHT : (CLASS_WEIGHT[placeClass ?? ""] ?? 0),
    });
  }

  if (candidates.length === 0) return null;

  // A large city can carry more than one label feature (multiple tiles, or a
  // capital that is also a city). Collapse same-name points that sit close
  // together, keeping the one nearest the cursor.
  const deduped: typeof candidates = [];
  for (const candidate of candidates) {
    const twin = deduped.find(
      (kept) =>
        kept.name === candidate.name &&
        Math.abs(kept.longitude - candidate.longitude) < DUPLICATE_RADIUS_DEG &&
        Math.abs(kept.latitude - candidate.latitude) < DUPLICATE_RADIUS_DEG,
    );
    if (!twin) {
      deduped.push(candidate);
    } else if (candidate.screenDistance < twin.screenDistance) {
      deduped[deduped.indexOf(twin)] = candidate;
    }
  }

  // Most significant first, then lowest OpenMapTiles rank (lower = more
  // important), then nearest to the click.
  deduped.sort((a, b) => {
    const weightDelta = b.weight - a.weight;
    if (weightDelta !== 0) return weightDelta;
    const rankDelta = (a.rank ?? Infinity) - (b.rank ?? Infinity);
    if (rankDelta !== 0) return rankDelta;
    return a.screenDistance - b.screenDistance;
  });

  const { name, longitude, latitude, placeClass, rank, population } =
    deduped[0];
  return { name, longitude, latitude, placeClass, rank, population };
}
