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

import type maplibregl from "maplibre-gl";
import type { PlaceTuple } from "./nearestPlace";

export const CITY_LABEL_SOURCE_ID = "mimir-places";
export const CITY_LABEL_LAYER_ID = "mimir-city-labels";
export const CITY_DOT_LAYER_ID = "mimir-city-dots";

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

const SETTLEMENT_TEXT_COLOR = "#13202c";
const LABEL_HALO_COLOR = "rgba(255, 255, 255, 0.95)";

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
      ([name, lon, lat, population, countryCode, capital, nationalRank]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { name, population, countryCode, capital, nationalRank },
      }),
    ),
  };
}

/**
 * Add (or refresh) the city label source and layers. Added at the top of the
 * stack so the labels sit above the weather imagery. Idempotent: a second call
 * updates the data rather than throwing on a duplicate id.
 */
export function addCityLabelLayer(
  map: maplibregl.Map,
  places: readonly PlaceTuple[],
): void {
  if (places.length === 0) return;
  const data = buildCityGeoJSON(places);

  const existing = map.getSource(CITY_LABEL_SOURCE_ID);
  if (existing) {
    (existing as maplibregl.GeoJSONSource).setData(
      data as unknown as GeoJSON.FeatureCollection,
    );
  } else {
    map.addSource(CITY_LABEL_SOURCE_ID, {
      type: "geojson",
      data: data as unknown as GeoJSON.FeatureCollection,
    });
  }

  const filter = buildCityFilter();

  // A small dot anchors the name to the actual point — the same coordinate a
  // click on this label resolves to, so "where is this city" is unambiguous.
  if (!map.getLayer(CITY_DOT_LAYER_ID)) {
    map.addLayer({
      id: CITY_DOT_LAYER_ID,
      type: "circle",
      source: CITY_LABEL_SOURCE_ID,
      filter: filter as maplibregl.FilterSpecification,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          2,
          10,
          3.5,
        ],
        "circle-color": SETTLEMENT_TEXT_COLOR,
        "circle-stroke-color": LABEL_HALO_COLOR,
        "circle-stroke-width": 1.2,
      },
    });
  } else {
    map.setFilter(CITY_DOT_LAYER_ID, filter as maplibregl.FilterSpecification);
  }

  if (!map.getLayer(CITY_LABEL_LAYER_ID)) {
    map.addLayer({
      id: CITY_LABEL_LAYER_ID,
      type: "symbol",
      source: CITY_LABEL_SOURCE_ID,
      filter: filter as maplibregl.FilterSpecification,
      layout: {
        "text-field": ["get", "name"],
        // Bold and mixed-case: positron's uppercase Regular is the least
        // legible combination over a busy raster.
        "text-font": ["Metropolis Bold", "Noto Sans Bold"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          12,
          6,
          14,
          10,
          16,
        ],
        "text-anchor": "top",
        "text-offset": [0, 0.45],
        "text-max-width": 8,
        "text-padding": 2,
        // Bigger cities win collisions against smaller neighbours.
        "symbol-sort-key": ["-", 0, ["get", "population"]],
      },
      paint: {
        "text-color": SETTLEMENT_TEXT_COLOR,
        "text-halo-color": LABEL_HALO_COLOR,
        "text-halo-width": 2,
        "text-halo-blur": 0,
      },
    });
  } else {
    map.setFilter(
      CITY_LABEL_LAYER_ID,
      filter as maplibregl.FilterSpecification,
    );
  }
}
