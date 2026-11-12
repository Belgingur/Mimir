/**
 * The first load: what main.ts sets up right after it creates the map, before
 * the controllers (a separate, larger download) exist. Anything the
 * controllers attached themselves could miss an early map event.
 */
import type * as maplibregl from "maplibre-gl";

/**
 * Resolves when the map's style has loaded: MapLibre's `style.load`, fired as
 * soon as the style is parsed. It doesn't wait for tiles, the sprite or
 * glyphs, as `load` does.
 *
 * Call it right after creating the map. A promise keeps the answer, so the
 * controllers can attach at any time later and still start.
 */
export function whenStyleLoads(
  map: Pick<maplibregl.Map, "once">,
): Promise<void> {
  return new Promise((resolve) => {
    map.once("style.load", () => resolve());
  });
}
