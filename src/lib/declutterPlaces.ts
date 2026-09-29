/**
 * Screen-space decluttering for the iconography view's named places.
 *
 * Places are taken most-important first (lowest rank), and each one is kept
 * only if its widget would not overlap a widget already kept. The test runs in
 * Web Mercator world pixels over the whole list rather than the visible part,
 * so the selection depends on zoom alone and does not reshuffle while panning.
 */

export type RankedPlace = { lon: number; lat: number; rank: number };

/** On-screen size of one place's widget, in CSS pixels. */
export type Footprint = { width: number; height: number };

/** MapLibre's world size at zoom 0, in pixels. */
const TILE_SIZE = 512;

/**
 * The footprint of a weather widget drawn at `iconSize`: the bubble is about
 * 1.9 × iconSize wide (icon plus the wind and temperature columns); its body
 * and pointer take ~0.92 × iconSize above the point and the name label ~16 px
 * below it.
 */
export const widgetFootprint = (iconSize: number): Footprint => ({
  width: Math.round(iconSize * 1.9),
  height: Math.round(iconSize * 0.92) + 16,
});

const toWorldPx = (lon: number, lat: number, worldSize: number) => {
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const phi = (clampedLat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * worldSize,
    y:
      (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) *
      worldSize,
  };
};

export function declutterPlaces<T extends RankedPlace>(
  places: readonly T[],
  zoom: number,
  footprint: Footprint,
): T[] {
  const { width, height } = footprint;
  if (width <= 0 || height <= 0) return [...places];
  const worldSize = TILE_SIZE * 2 ** zoom;

  // A kept widget can only collide with one in its own or a neighbouring
  // footprint-sized cell, so a hash over those cells keeps this linear.
  const cells = new Map<string, { x: number; y: number }[]>();
  const kept: T[] = [];
  // Array.prototype.sort is stable: equal ranks keep the file's order.
  const byRank = [...places].sort((a, b) => a.rank - b.rank);

  for (const place of byRank) {
    const p = toWorldPx(place.lon, place.lat, worldSize);
    const cx = Math.floor(p.x / width);
    const cy = Math.floor(p.y / height);
    let clear = true;
    for (let dx = -1; dx <= 1 && clear; dx++) {
      for (let dy = -1; dy <= 1 && clear; dy++) {
        for (const q of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (Math.abs(q.x - p.x) < width && Math.abs(q.y - p.y) < height) {
            clear = false;
            break;
          }
        }
      }
    }
    if (!clear) continue;
    const key = `${cx},${cy}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(p);
    else cells.set(key, [p]);
    kept.push(place);
  }
  return kept;
}
