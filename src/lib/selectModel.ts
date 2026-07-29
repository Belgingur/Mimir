import type { ModelBBox, ModelCoverage } from "./inhouseTypes";
import { MODEL_DISPLAY_ORDER } from "./modelConfig";

/**
 * Coverage-aware model selection (task A3).
 *
 * Given an approximate `(lat, lon)`, pick the finest-resolution *healthy* model
 * whose domain actually **contains** the point. Because global models carry a
 * world bbox, a point outside every regional domain naturally resolves to the
 * global model that covers it — we never pan the user into a domain they are
 * not in (spec A3.4). Returns `null` when no available model covers the point
 * (the caller then uses its own default).
 *
 * This function is pure and side-effect free so it can be unit-tested in
 * isolation.
 */
export function selectModel(
  lat: number,
  lon: number,
  models: ModelCoverage[],
): string | null {
  const covering = models
    .filter((m) => m.available)
    .filter((m) => modelContainsPoint(m, lat, lon));
  if (!covering.length) return null;

  const rank = new Map(MODEL_DISPLAY_ORDER.map((id, i) => [id, i]));
  covering.sort((a, b) => {
    // Finest resolution first; models with no resolution rank last.
    const ra = a.resolutionKm ?? Number.POSITIVE_INFINITY;
    const rb = b.resolutionKm ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    // Tie-break by the display order, then id, for a deterministic pick.
    return (
      (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) ||
      a.id.localeCompare(b.id)
    );
  });
  return covering[0].id;
}

/**
 * Whether a model's domain contains the point. Cheap bbox check first
 * (shrunk inward by `marginKm`), then a precise point-in-polygon test when a
 * `domainPolygon` is present. A model with no bbox and no polygon cannot be
 * matched by containment (it can only be selected via the caller's fallback).
 */
export function modelContainsPoint(
  model: ModelCoverage,
  lat: number,
  lon: number,
): boolean {
  if (model.bbox && !pointInBBox(model.bbox, lat, lon, model.marginKm ?? 0)) {
    return false;
  }
  if (model.domainPolygon) {
    return pointInPolygon(model.domainPolygon, lat, lon);
  }
  // bbox present and passed, no polygon → contained.
  return Boolean(model.bbox);
}

/**
 * Point-in-bbox with an inward safety margin in km. The margin is converted to
 * degrees at the point's latitude; if the margin is wider than half the box the
 * usable area collapses and the point is treated as outside.
 */
export function pointInBBox(
  bbox: ModelBBox,
  lat: number,
  lon: number,
  marginKm = 0,
): boolean {
  const latMargin = marginKm / 111;
  const lonMargin =
    marginKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
  const west = bbox.west + lonMargin;
  const east = bbox.east - lonMargin;
  const south = bbox.south + latMargin;
  const north = bbox.north - latMargin;
  if (west > east || south > north) return false; // margin swallowed the box
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

/**
 * GeoJSON Polygon containment: inside the outer ring and not inside any hole.
 * Rings are `[lon, lat]` pairs (ring[0] = outer, remainder = holes).
 */
export function pointInPolygon(
  rings: number[][][],
  lat: number,
  lon: number,
): boolean {
  if (!rings.length) return false;
  if (!ringContains(rings[0], lon, lat)) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (ringContains(rings[i], lon, lat)) return false; // in a hole
  }
  return true;
}

/** Ray-casting point-in-ring test. Coordinates are [lon, lat] = [x, y]. */
function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
