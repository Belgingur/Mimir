/**
 * Presentation of the basemap's own place labels.
 *
 * Positron authors its labels for a pale grey basemap: grey-blue text
 * (rgb(117,129,145)) with a near-white halo. Over a saturated weather raster
 * that reads as a washed-out "tint of white" and is hard to make out, so the
 * palette is overridden here. It also caps settlement labels at zoom 12–15,
 * which means city names *disappear* as you zoom in — the opposite of what a
 * weather map wants — and it labels admin regions (Tirol, Lower Silesian,
 * Norðurland Vestra) that compete with city names for the same screen space.
 *
 * All of this is applied to the live style rather than forked into a custom
 * style JSON, so a MapTiler style update still flows through; layer ids are
 * looked up defensively because the style can be swapped at runtime.
 */

import type maplibregl from "maplibre-gl";
import { SETTLEMENT_LAYER_IDS } from "./placeLabelPick";

/** Admin-region labels — hidden so city names win the collision. */
export const REGION_LABEL_LAYER_IDS = ["place_state"] as const;

/**
 * Basemap city layers, hidden because lib/cityLabelLayer.ts renders these from
 * Mímir's own population-carrying dataset instead. Leaving both on would draw
 * the same name twice (and let the two fight over collision slots).
 */
export const REPLACED_CITY_LAYER_IDS = [
  "place_capital",
  "place_city_large",
  "place_city",
] as const;

/**
 * Basemap layers kept: small places far below the bundled dataset's resolution,
 * which only appear once you are zoomed well in.
 */
export const KEPT_SETTLEMENT_LAYER_IDS = SETTLEMENT_LAYER_IDS.filter(
  (id) =>
    !(REPLACED_CITY_LAYER_IDS as readonly string[]).includes(id),
);

/** Country labels. Kept as-is zoom-wise ("fine how it is now"), recoloured only. */
export const COUNTRY_LABEL_LAYER_IDS = [
  "place_country_major",
  "place_country_minor",
  "place_country_other",
] as const;

/** Near-black slate: high contrast against every hue in the weather palette. */
export const SETTLEMENT_TEXT_COLOR = "#13202c";
/** Countries sit one step back so they don't compete with settlement names. */
export const COUNTRY_TEXT_COLOR = "#3b4d5e";
/** An opaque white halo is what makes dark text legible over dark weather. */
export const LABEL_HALO_COLOR = "rgba(255, 255, 255, 0.95)";
export const SETTLEMENT_HALO_WIDTH = 2;
export const COUNTRY_HALO_WIDTH = 1.8;
/** No blur: a crisp halo edge separates the glyph from the raster cleanly. */
export const LABEL_HALO_BLUR = 0;

/** Bold face, matching the city layer. Verified present on MapTiler's glyph API. */
export const SETTLEMENT_FONT = ["Metropolis Bold", "Noto Sans Bold"];
export const COUNTRY_FONT = ["Metropolis Bold", "Noto Sans Bold"];

/** Larger than positron's flat 10px, and growing as you zoom in. */
export const SETTLEMENT_TEXT_SIZE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  11,
  8,
  12.5,
  12,
  14,
];

/**
 * Keep settlement labels rendered when zoomed in. Positron stops them at
 * z12–z15 (capitals and large cities at 12), expecting suburb-level detail to
 * take over; for a weather map the city name is the thing you want to keep.
 */
export const SETTLEMENT_MAX_ZOOM = 24;

/**
 * Zoom at which each kept basemap layer starts drawing. Positron gives these
 * no minzoom at all, so hamlets and suburbs would compete for space on a
 * continental view. They now come in below the city layer's own ladder, so the
 * far-out view stays borders-and-countries and detail arrives as you zoom.
 */
export const KEPT_SETTLEMENT_MIN_ZOOM: Record<string, number> = {
  place_town: 7,
  place_village: 9,
  place_suburb: 10,
  place_other: 11,
};

/**
 * Tighter than MapLibre's default of 2, so more city names survive symbol
 * collision at a given zoom. Modest on purpose — dropping it further starts to
 * look crowded.
 */
export const SETTLEMENT_TEXT_PADDING = 1;

/** Every setter is guarded: the style may be mid-swap or use another schema. */
function withLayer(
  map: maplibregl.Map,
  id: string,
  apply: (id: string) => void,
): void {
  try {
    if (!map.getLayer(id)) return;
    apply(id);
  } catch {
    /* style swapped underneath us; the styledata handler will retry */
  }
}

/**
 * Recolour place labels, hide admin-region labels, and let settlement names
 * persist at high zoom. Idempotent — safe to call on every style load.
 */
export function applyPlaceLabelStyle(map: maplibregl.Map): void {
  for (const id of KEPT_SETTLEMENT_LAYER_IDS) {
    withLayer(map, id, () => {
      map.setPaintProperty(id, "text-color", SETTLEMENT_TEXT_COLOR);
      map.setPaintProperty(id, "text-halo-color", LABEL_HALO_COLOR);
      map.setPaintProperty(id, "text-halo-width", SETTLEMENT_HALO_WIDTH);
      map.setPaintProperty(id, "text-halo-blur", LABEL_HALO_BLUR);
      map.setLayoutProperty(id, "text-padding", SETTLEMENT_TEXT_PADDING);
      // Bold, mixed case: positron's uppercase Regular is the least legible
      // combination over a busy raster, and matches the city layer's face.
      map.setLayoutProperty(id, "text-font", SETTLEMENT_FONT);
      map.setLayoutProperty(id, "text-transform", "none");
      map.setLayoutProperty(id, "text-size", SETTLEMENT_TEXT_SIZE);
      map.setLayerZoomRange(
        id,
        KEPT_SETTLEMENT_MIN_ZOOM[id] ?? 0,
        SETTLEMENT_MAX_ZOOM,
      );
    });
  }

  for (const id of REPLACED_CITY_LAYER_IDS) {
    withLayer(map, id, () => {
      map.setLayoutProperty(id, "visibility", "none");
    });
  }

  for (const id of COUNTRY_LABEL_LAYER_IDS) {
    withLayer(map, id, () => {
      map.setPaintProperty(id, "text-color", COUNTRY_TEXT_COLOR);
      map.setPaintProperty(id, "text-halo-color", LABEL_HALO_COLOR);
      map.setPaintProperty(id, "text-halo-width", COUNTRY_HALO_WIDTH);
      map.setPaintProperty(id, "text-halo-blur", LABEL_HALO_BLUR);
      map.setLayoutProperty(id, "text-font", COUNTRY_FONT);
    });
  }

  for (const id of REGION_LABEL_LAYER_IDS) {
    withLayer(map, id, () => {
      map.setLayoutProperty(id, "visibility", "none");
    });
  }
}
