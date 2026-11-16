/**
 * City labels drawn from Mímir's own place dataset instead of the basemap's.
 *
 * Why not just filter the basemap's labels? Because the vector tiles carry no
 * population — the `place` layer's fields are class, rank, capital, iso_a2,
 * name, wikidata. Its `rank` is a *within-country* importance score, not a size
 * measure: measured against real populations, only ~55% of cities over 500k
 * have rank ≤ 4, and you need rank ≤ 6 to catch them all. So rank cannot
 * express "cities above 500k / 250k / 100k".
 *
 * public/data/places.json does carry population (Natural Earth pop_max), so the
 * city labels are rendered from it. That also buys full control of typography,
 * and exact coordinates for the click-to-select path.
 *
 * The basemap's own city layers are hidden in placeLabelStyle.ts so the two
 * don't draw the same name twice; its town/village/suburb layers stay, since
 * they cover small places far below this dataset's resolution.
 */

import type * as maplibregl from "maplibre-gl";
import type { PlaceTuple } from "./nearestPlace";
import {
  LABEL_HALO_BLUR,
  LABEL_HALO_COLOR,
  SETTLEMENT_HALO_WIDTH,
  SETTLEMENT_TEXT_COLOR,
} from "./mapLabelStyleTokens";

export const CITY_LABEL_SOURCE_ID = "mimir-places";
export const CITY_LABEL_LAYER_ID = "mimir-city-labels";
/** The dot under each city's name, drawn as the label's own icon. */
export const CITY_DOT_IMAGE_ID = "mimir-city-dot";

/** City name typography, shared with the iconography bubbles' names. */
export const CITY_TEXT_FONT = ["Metropolis Bold", "Noto Sans Bold"];
export const CITY_TEXT_SIZE: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  12,
  6,
  14,
  10,
  16,
];
/** Below the point, in ems, with the name anchored at its top. */
export const CITY_TEXT_OFFSET: [number, number] = [0, 0.45];

/**
 * The zoom ladder, as three thresholds evaluated in parallel — a place is
 * labelled if it clears any one of them:
 *
 *   z < 3    nothing. Country borders and country names carry the world view.
 *   z 3–4    capitals of the larger countries.
 *   z 4–5    every capital, plus megacities.
 *   z 5–6    + 500k, and each country's largest place.
 *   z 6–8    + 250k, and each country's top 3.
 *   z 8–10   + 100k, and each country's top 8.
 *   z ≥ 10   everything.
 *
 * Note MapLibre only re-evaluates zoom expressions in *filters* at integer
 * zoom levels, so these thresholds step on whole zooms.
 */

/** Effectively infinite — no population clears it, so the tier admits nobody. */
const NEVER = 1e12;

/** Population needed to show a non-capital, by zoom. */
export const POPULATION_BY_ZOOM: [zoom: number, population: number][] = [
  [0, NEVER],
  [4, 5_000_000],
  [5, 500_000],
  [6, 250_000],
  [8, 100_000],
  [10, 0],
];

/**
 * Population needed to show a *capital*. Capitals get in earlier and at any
 * size, so "country names with their capitals" is a rung of its own before
 * general cities start appearing.
 */
export const CAPITAL_POPULATION_BY_ZOOM: [zoom: number, population: number][] =
  [
    [0, NEVER],
    [3, 1_000_000],
    [4, 0],
  ];

/**
 * National-rank escape hatch, applied in parallel with the population tiers. A
 * purely global threshold would blank out whole countries once cities do start
 * appearing: Reykjavík is 166k, so Iceland would show nothing until z8.
 * Admitting the top-N places of every country keeps sparse regions legible.
 * Zero until z5, so it cannot put cities on the far-out view.
 */
export const NATIONAL_RANK_BY_ZOOM: [zoom: number, rank: number][] = [
  [0, 0],
  [5, 1],
  [6, 3],
  [8, 8],
  [10, 9999],
];

/** `["step", ["zoom"], out0, z1, out1, ...]` from a stop table. */
function zoomStep(stops: [number, number][]): unknown[] {
  const [, first] = stops[0];
  const rest = stops.slice(1).flatMap(([zoom, value]) => [zoom, value]);
  return ["step", ["zoom"], first, ...rest];
}

/** A place is labelled if it clears any one of the three tiers. */
export function buildCityFilter(): unknown[] {
  return [
    "any",
    [">=", ["get", "population"], zoomStep(POPULATION_BY_ZOOM)],
    [
      "all",
      ["==", ["get", "capital"], 1],
      [">=", ["get", "population"], zoomStep(CAPITAL_POPULATION_BY_ZOOM)],
    ],
    ["<=", ["get", "nationalRank"], zoomStep(NATIONAL_RANK_BY_ZOOM)],
  ];
}

export function buildCityGeoJSON(places: readonly PlaceTuple[]): {
  type: "FeatureCollection";
  features: unknown[];
} {
  return {
    type: "FeatureCollection",
    features: places.map(
      ([name, lon, lat, population, countryCode, capital, nationalRank], i) => ({
        type: "Feature",
        // The place's index in the dataset, so one city can be singled out
        // where another shares its name (see setPinnedCity).
        id: i,
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { name, population, countryCode, capital, nationalRank },
      }),
    ),
  };
}

/**
 * Cities whose label or dot another layer stands in for, by name, on each
 * map. An iconography bubble's pointer tip marks its city's spot, so the dot
 * goes; when the bubble also draws the name, the label goes too.
 */
export interface HiddenCities {
  labels: readonly string[];
  dots: readonly string[];
}
const NONE: HiddenCities = { labels: [], dots: [] };

/**
 * What is hidden on one map, from two sources kept apart so that neither can
 * drop the other's entries: the iconography (by name, above) and the
 * meteogram pin (one city, by feature id). The layers show their union.
 */
interface HiddenState {
  readonly iconography: HiddenCities;
  readonly pinnedId: number | null;
}
const NOTHING_HIDDEN: HiddenState = { iconography: NONE, pinnedId: null };
const hiddenCities = new WeakMap<maplibregl.Map, HiddenState>();

function withoutHidden(
  names: readonly string[],
  pinnedId: number | null,
): maplibregl.FilterSpecification {
  const terms: unknown[] = [buildCityFilter()];
  if (names.length > 0) {
    terms.push(["!", ["in", ["get", "name"], ["literal", names]]]);
  }
  if (pinnedId !== null) terms.push(["!=", ["id"], pinnedId]);
  return (
    terms.length === 1 ? terms[0] : ["all", ...terms]
  ) as maplibregl.FilterSpecification;
}

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((name, i) => name === b[i]);

/**
 * The label's icon: the dot, or none for the cities whose dot the iconography
 * stands in for while their name stays (a bubble that doesn't name itself).
 */
export function cityDotImage(
  hiddenDots: readonly string[],
): maplibregl.DataDrivenPropertyValueSpecification<
  maplibregl.ResolvedImageSpecification
> {
  if (hiddenDots.length === 0) return CITY_DOT_IMAGE_ID;
  return [
    "case",
    ["in", ["get", "name"], ["literal", hiddenDots]],
    "",
    CITY_DOT_IMAGE_ID,
  ];
}

function setHidden(map: maplibregl.Map, next: HiddenState): void {
  const current = hiddenCities.get(map) ?? NOTHING_HIDDEN;
  hiddenCities.set(map, next);
  if (!map.getLayer(CITY_LABEL_LAYER_ID)) return;
  // Called on every iconography redraw: re-filtering an unchanged list would
  // restart label placement for nothing.
  if (
    next.pinnedId !== current.pinnedId ||
    !sameNames(next.iconography.labels, current.iconography.labels)
  ) {
    map.setFilter(
      CITY_LABEL_LAYER_ID,
      withoutHidden(next.iconography.labels, next.pinnedId),
    );
  }
  if (!sameNames(next.iconography.dots, current.iconography.dots)) {
    map.setLayoutProperty(
      CITY_LABEL_LAYER_ID,
      "icon-image",
      cityDotImage(next.iconography.dots),
    );
  }
}

/**
 * Hide these cities' labels and dots for the iconography; empty lists bring
 * them all back. Leaves the pinned city (see {@link setPinnedCity}) hidden.
 */
export function setHiddenCities(
  map: maplibregl.Map,
  hidden: HiddenCities,
): void {
  const current = hiddenCities.get(map) ?? NOTHING_HIDDEN;
  setHidden(map, { ...current, iconography: hidden });
}

/**
 * Hide one city's label and dot while the meteogram pin names it, by its
 * feature id (its index in the dataset); null shows it again. By id rather
 * than name, so pinning London, England leaves London, Ontario on the map.
 */
export function setPinnedCity(map: maplibregl.Map, id: number | null): void {
  const current = hiddenCities.get(map) ?? NOTHING_HIDDEN;
  if (current.pinnedId === id) return;
  setHidden(map, { ...current, pinnedId: id });
}

/** Dot radius and halo, in CSS pixels, at the icon's full size (zoom 10). */
const DOT_RADIUS = 2.5;
const DOT_HALO = 1.2;
/**
 * Scaled down to zoom 3 as the old circle layer was (radius 1.5 → 2.5, with a
 * fixed 1.2 px halo): (1.5 + 1.2) / (2.5 + 1.2) ≈ 0.73.
 */
export const CITY_DOT_SIZE: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  3,
  0.73,
  10,
  1,
];

/** `#rrggbb` or `rgba(r, g, b, a)` as 0–255 channels and a 0–1 alpha. */
function parseColour(colour: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour);
  if (hex) return [...hex.slice(1).map((h) => parseInt(h, 16)), 1] as never;
  const rgba = /^rgba?\(([^)]+)\)$/.exec(colour);
  if (!rgba) throw new Error(`Unsupported colour: ${colour}`);
  const [r, g, b, a = 1] = rgba[1].split(",").map(Number);
  return [r, g, b, a];
}

/**
 * The city dot, at pixel ratio 2: a {@link SETTLEMENT_TEXT_COLOR} disc inside a
 * {@link LABEL_HALO_COLOR} ring, the names' own colours. Antialiased by
 * sampling each pixel 4 × 4 times.
 */
export function buildCityDotIcon(): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const RATIO = 2;
  const SAMPLES = 4;
  const outer = (DOT_RADIUS + DOT_HALO) * RATIO;
  const inner = DOT_RADIUS * RATIO;
  const size = Math.ceil(outer * 2);
  const centre = size / 2;
  const fill = parseColour(SETTLEMENT_TEXT_COLOR);
  const ring = parseColour(LABEL_HALO_COLOR);
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let inFill = 0;
      let inRing = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const d = Math.hypot(
            px + (sx + 0.5) / SAMPLES - centre,
            py + (sy + 0.5) / SAMPLES - centre,
          );
          if (d <= inner) inFill++;
          else if (d <= outer) inRing++;
        }
      }
      const n = SAMPLES * SAMPLES;
      const fillA = (inFill / n) * fill[3];
      const ringA = (inRing / n) * ring[3];
      const alpha = fillA + ringA;
      const i = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] =
          alpha > 0 ? Math.round((fill[c] * fillA + ring[c] * ringA) / alpha) : 0;
      }
      data[i + 3] = Math.round(255 * alpha);
    }
  }
  return { width: size, height: size, data };
}

/** The places array last sent to each city source, so an unchanged dataset
 *  isn't re-sent. Keyed by source object: a style swap makes a new one. */
const appliedPlaces = new WeakMap<object, readonly PlaceTuple[]>();

/**
 * Add (or refresh) the city label source and layer, and its dot image. Added
 * at the top of the stack so the labels sit above the weather imagery. Idempotent: a second call
 * updates the data rather than throwing on a duplicate id.
 */
export function addCityLabelLayer(
  map: maplibregl.Map,
  places: readonly PlaceTuple[],
): boolean {
  if (places.length === 0) return false;

  // This runs on every `styledata`. Re-sending unchanged data re-tiles the
  // source, which restarts label placement and fires `styledata` again — a
  // loop that kept the map repainting every frame while idle.
  const existing = map.getSource(CITY_LABEL_SOURCE_ID);
  if (existing) {
    if (appliedPlaces.get(existing) !== places) {
      (existing as maplibregl.GeoJSONSource).setData(
        buildCityGeoJSON(places) as unknown as GeoJSON.FeatureCollection,
      );
    }
  } else {
    map.addSource(CITY_LABEL_SOURCE_ID, {
      type: "geojson",
      data: buildCityGeoJSON(places) as unknown as GeoJSON.FeatureCollection,
    });
  }
  const source = map.getSource(CITY_LABEL_SOURCE_ID);
  if (source) appliedPlaces.set(source, places);

  const hidden = hiddenCities.get(map) ?? NOTHING_HIDDEN;
  const labelFilter = withoutHidden(
    hidden.iconography.labels,
    hidden.pinnedId,
  );

  if (!map.hasImage(CITY_DOT_IMAGE_ID)) {
    map.addImage(CITY_DOT_IMAGE_ID, buildCityDotIcon(), { pixelRatio: 2 });
  }

  if (!map.getLayer(CITY_LABEL_LAYER_ID)) {
    map.addLayer({
      id: CITY_LABEL_LAYER_ID,
      type: "symbol",
      source: CITY_LABEL_SOURCE_ID,
      filter: labelFilter,
      layout: {
        "text-field": ["get", "name"],
        // Bold and mixed-case: positron's uppercase Regular is the least
        // legible combination over a busy raster.
        "text-font": CITY_TEXT_FONT,
        "text-size": CITY_TEXT_SIZE,
        "text-anchor": "top",
        "text-offset": CITY_TEXT_OFFSET,
        "text-max-width": 8,
        "text-padding": 2,
        // A small dot anchors the name to the actual point — the same
        // coordinate a click on this label resolves to. It is the label's own
        // icon, so collision keeps or drops the dot and the name together: a
        // separate circle layer takes no part in collision, and left dots
        // without names wherever the names lost.
        "icon-image": cityDotImage(hidden.iconography.dots),
        "icon-size": CITY_DOT_SIZE,
        "icon-padding": 0,
        // Bigger cities win collisions against smaller neighbours.
        "symbol-sort-key": ["-", 0, ["get", "population"]],
      },
      paint: {
        "text-color": SETTLEMENT_TEXT_COLOR,
        "text-halo-color": LABEL_HALO_COLOR,
        "text-halo-width": SETTLEMENT_HALO_WIDTH,
        "text-halo-blur": LABEL_HALO_BLUR,
      },
    });
  } else {
    map.setFilter(CITY_LABEL_LAYER_ID, labelFilter);
  }
  return true;
}
