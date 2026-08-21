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

/** OpenMapTiles source-layer that carries settlement + region labels. */
export const PLACE_SOURCE_LAYER = "place";

interface MinimalLayer {
  readonly id: string;
  readonly type: string;
  readonly "source-layer"?: string;
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
