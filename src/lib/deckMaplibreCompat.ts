import type * as maplibregl from "maplibre-gl";

/**
 * @deck.gl/mapbox (<= 9.4.0) reads the undocumented `map.transform` to size
 * its interleaved viewport. maplibre-gl 6 moved that onto `map._camera`, so
 * without this every deck.gl draw throws and the weather layers never paint.
 * Remove once @deck.gl/mapbox supports maplibre-gl 6 on its own.
 */
export function restoreMapTransformForDeck(map: maplibregl.Map): void {
  const m = map as unknown as {
    transform?: unknown;
    _camera?: { transform: unknown };
  };
  const camera = m._camera;
  if (m.transform !== undefined || !camera) return;
  Object.defineProperty(map, "transform", {
    configurable: true,
    get: () => camera.transform,
  });
}
