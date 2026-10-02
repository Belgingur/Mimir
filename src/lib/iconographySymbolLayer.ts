/**
 * The iconography view's weather widgets, drawn as a MapLibre symbol layer.
 *
 * Why not a deck.gl IconLayer? deck draws over the map with no say in label
 * placement, so a bubble painted straight over neighbouring town names, and
 * the city name it carried duplicated the map's own label for that city. As
 * a symbol layer the bubble joins MapLibre's collision pass: it sits on top of
 * the stack, so it is placed first and any basemap label it would cover is
 * hidden instead.
 *
 * The bubble names its own place, below the pointer tip, and the city layer
 * drops its label and dot for that place so the name shows once. The name
 * can't come from the city layer alone: most model station names (201 of 208
 * for BEL-IS) aren't in its dataset.
 */

import type * as maplibregl from "maplibre-gl";
import type { IconPoint } from "../controllers/IconographyController";
import type { AtlasResult } from "./iconographyTypes";
import {
  CITY_TEXT_FONT,
  CITY_TEXT_OFFSET,
  CITY_TEXT_SIZE,
  setHiddenCities,
} from "./cityLabelLayer";
import {
  LABEL_HALO_BLUR,
  LABEL_HALO_COLOR,
  SETTLEMENT_HALO_WIDTH,
  SETTLEMENT_TEXT_COLOR,
} from "./mapLabelStyleTokens";

export const ICONOGRAPHY_SOURCE_ID = "mimir-iconography";
export const ICONOGRAPHY_LAYER_ID = "mimir-iconography-widgets";
const IMAGE_PREFIX = "iconography:";

/**
 * Zoomed out, a bubble names its place only if it is among the most
 * important (rank 1); from NAME_ALL_ZOOM every bubble does. Like the city
 * layer's ladder, this keeps the far view from filling with names. Where a
 * bubble draws no name, the city layer may still label the place on its own
 * ladder, in the same spot and style.
 */
export const NAME_ALL_ZOOM = 5;

const bubbleNamesItself = (point: IconPoint, zoom: number) =>
  zoom >= NAME_ALL_ZOOM || (point.rank ?? 1) <= 1;

/** Widget image ids currently registered on each map, so stale ones go. */
const registeredImages = new WeakMap<maplibregl.Map, Set<string>>();

/**
 * Show `points` as widgets, adding the source and layer on first use. With no
 * points (or no atlas yet) the layer stays but draws nothing.
 */
export function syncIconographySymbols(
  map: maplibregl.Map,
  points: readonly IconPoint[],
  iconSize: number,
  atlas: AtlasResult | null,
): void {
  const ctx = atlas?.atlas.getContext("2d");
  const wanted = new Set<string>();
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  if (atlas && ctx) {
    points.forEach((point, order) => {
      const key = atlas.getKey(point);
      const entry = atlas.mapping[key];
      if (!entry) return;
      const imageId = IMAGE_PREFIX + key;
      // The atlas entry is drawn `iconSize` px tall on screen.
      const pixelRatio = entry.height / iconSize;
      if (!wanted.has(imageId)) {
        wanted.add(imageId);
        // Cut off at the pointer tip, dropping the shadow room below it, so
        // the image ends where the name below it starts. Re-sent on every
        // sync: the weather glyphs load async, so an earlier copy of this key
        // may still be missing its icon.
        const image = ctx.getImageData(
          entry.x,
          entry.y,
          entry.width,
          entry.anchorY,
        );
        if (map.hasImage(imageId)) map.updateImage(imageId, image);
        else map.addImage(imageId, image, { pixelRatio });
      }
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point.position },
        properties: {
          image: imageId,
          name: point.name ?? "",
          rank: point.rank ?? 1,
          order,
          // Bottom-anchored on the tip; shifted if the tip is off-centre.
          offset: [(entry.width / 2 - entry.anchorX) / pixelRatio, 0],
        },
      });
    });
  }

  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };
  const source = map.getSource(ICONOGRAPHY_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (source) source.setData(data);
  else map.addSource(ICONOGRAPHY_SOURCE_ID, { type: "geojson", data });

  if (!map.getLayer(ICONOGRAPHY_LAYER_ID)) {
    map.addLayer({
      id: ICONOGRAPHY_LAYER_ID,
      type: "symbol",
      source: ICONOGRAPHY_SOURCE_ID,
      layout: {
        "icon-image": ["get", "image"],
        "icon-anchor": "bottom",
        "icon-offset": ["get", "offset"],
        "text-field": [
          "step",
          ["zoom"],
          ["case", ["<=", ["get", "rank"], 1], ["get", "name"], ""],
          NAME_ALL_ZOOM,
          ["get", "name"],
        ],
        "text-font": CITY_TEXT_FONT,
        "text-size": CITY_TEXT_SIZE,
        "text-anchor": "top",
        "text-offset": CITY_TEXT_OFFSET,
        "text-max-width": 8,
        // A name that collides is dropped; its bubble still shows.
        "text-optional": true,
        // declutterPlaces already ranked the points, most important first.
        "symbol-sort-key": ["get", "order"],
        "symbol-z-order": "source",
      },
      paint: {
        "text-color": SETTLEMENT_TEXT_COLOR,
        "text-halo-color": LABEL_HALO_COLOR,
        "text-halo-width": SETTLEMENT_HALO_WIDTH,
        "text-halo-blur": LABEL_HALO_BLUR,
      },
    });
  } else if (topLayerId(map) !== ICONOGRAPHY_LAYER_ID) {
    // Layers added later (the city labels after a style swap) would otherwise
    // sit above the widgets and win collisions against them.
    map.moveLayer(ICONOGRAPHY_LAYER_ID);
  }

  removeStaleImages(map, wanted);
  // Floored: MapLibre evaluates the text-field's zoom step per whole zoom.
  const zoom = Math.floor(map.getZoom());
  setHiddenCities(map, {
    labels: points.flatMap((p) =>
      p.name && bubbleNamesItself(p, zoom) ? [p.name] : [],
    ),
    dots: points.flatMap((p) => (p.name ? [p.name] : [])),
  });
}

/** Remove the widgets and give the cities back their labels and dots. */
export function clearIconographySymbols(map: maplibregl.Map): void {
  if (map.getLayer(ICONOGRAPHY_LAYER_ID)) map.removeLayer(ICONOGRAPHY_LAYER_ID);
  if (map.getSource(ICONOGRAPHY_SOURCE_ID)) {
    map.removeSource(ICONOGRAPHY_SOURCE_ID);
  }
  removeStaleImages(map, new Set());
  setHiddenCities(map, { labels: [], dots: [] });
}

function topLayerId(map: maplibregl.Map): string | undefined {
  const order = map.getLayersOrder();
  return order[order.length - 1];
}

function removeStaleImages(map: maplibregl.Map, wanted: Set<string>): void {
  const previous = registeredImages.get(map) ?? new Set<string>();
  for (const id of previous) {
    if (!wanted.has(id) && map.hasImage(id)) map.removeImage(id);
  }
  registeredImages.set(map, wanted);
}
