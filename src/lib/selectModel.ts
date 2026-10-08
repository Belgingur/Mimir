import { domainMaskContains } from "./domainMask";
import type { ModelBBox, ModelCoverage } from "./inhouseTypes";
import { MODEL_DISPLAY_ORDER } from "./modelConfig";

/**
 * Coverage-aware model selection (task A3).
 *
 * Given an approximate `(lat, lon)`, pick the finest-resolution *healthy* model
 * whose domain actually **contains** the point, unless a `preferred` model has
 * data there. Because global models carry a world bbox, a point outside every
 * regional domain naturally resolves to the global model that covers it — we
 * never pan the user into a domain they are not in (spec A3.4). Returns `null`
 * when no available model covers the point (the caller then uses its own
 * default).
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
    // A model preferred where it has data beats any finer one.
    if (Boolean(a.preferred) !== Boolean(b.preferred)) return a.preferred ? -1 : 1;
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
 * (shrunk inward by `marginKm`), then a precise test against the
 * `domainPolygon` or, failing that, the `domainMask` of cells with data. A
 * model with no bbox and no polygon cannot be matched by containment (it can
 * only be selected via the caller's fallback).
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
  if (model.domainMask && model.bbox) {
    return domainMaskContains(model.domainMask, model.bbox, lat, lon);
  }
  // bbox present and passed, no polygon or mask → contained.
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

/** west, south, east, north — the map's visible extent. */
export type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Whether any part of a model's domain is on screen.
 *
 * A model whose domain lies entirely outside the view paints nothing, and the
 * app used to say nothing about it either: the deployed config defaults new
 * visitors to a regional model, so a first-time reader could land on an empty
 * map with no indication that the data existed somewhere else entirely. This is
 * the test behind telling them.
 *
 * A model with no bbox (a global one) is treated as covering everything, which
 * is what it does.
 */
export function modelIntersectsViewport(
  model: Pick<ModelCoverage, "bbox">,
  view: ViewportBounds,
): boolean {
  const bbox = model.bbox;
  if (!bbox) return true;
  if (bbox.north < view.south || bbox.south > view.north) return false;

  // Longitude is an angle, so overlap is a question about arcs, not intervals:
  // compare the two spans' centres by the shortest way round the globe against
  // the sum of their half-widths.
  //
  // An earlier version wrapped both edges of the domain relative to the view
  // and compared them as plain numbers. That quietly broke the most important
  // case: a GLOBAL domain (-180 to 180) has edges that are the same point on the
  // globe, so wrapping collapsed it to a single longitude and any view not
  // sitting on it was reported as uncovered. A global model would then be
  // accused of not covering the map it was painting.
  const spanOf = (west: number, east: number): number => {
    const raw = east - west;
    if (!Number.isFinite(raw)) return 360;
    if (raw >= 360 || raw <= -360) return 360;
    return raw < 0 ? raw + 360 : raw;
  };
  const bboxWidth = spanOf(bbox.west, bbox.east);
  const viewWidth = spanOf(view.west, view.east);
  if (bboxWidth >= 359.999 || viewWidth >= 359.999) return true;

  const bboxCentre = bbox.west + bboxWidth / 2;
  const viewCentre = view.west + viewWidth / 2;
  // Shortest angular distance between the two centres, 0…180.
  const apart = Math.abs((((bboxCentre - viewCentre) % 360) + 540) % 360 - 180);
  return apart <= (bboxWidth + viewWidth) / 2;
}
