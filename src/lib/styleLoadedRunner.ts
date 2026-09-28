import type { Map as MaplibreMap } from "maplibre-gl";

type StyleLoadedMap = Pick<MaplibreMap, "isStyleLoaded" | "once">;

/**
 * Wrap `apply` so calling the result runs it as soon as the style is loaded.
 *
 * `isStyleLoaded()` is false not only before the style arrives but also while
 * any tile is still loading, which covers most `styledata` events on first
 * paint. Bailing out on those without a retry leaves `apply` to chance, so a
 * call that lands too early waits for the next `idle` instead. Repeated early
 * calls share one pending retry.
 */
export function createStyleLoadedRunner(
  map: StyleLoadedMap,
  apply: () => void,
): () => void {
  let retryPending = false;
  const run = (): void => {
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    if (retryPending) return;
    retryPending = true;
    map.once("idle", () => {
      retryPending = false;
      run();
    });
  };
  return run;
}
