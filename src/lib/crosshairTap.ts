/**
 * Tap-vs-pan classification for the transient crosshair, plus the geometric
 * hit-test for the reticle. Pure functions — no DOM, no timers — so the
 * thresholds can be unit-tested directly.
 */
import { CROSSHAIR_TIMINGS, type CrosshairTimings } from "./crosshairTimings";

/** A single-finger touch, accumulated between touchstart and touchend. */
export interface TouchGesture {
  /** Largest distance from the start point reached during the touch, in CSS px. */
  readonly maxMovePx: number;
  /** touchend timestamp minus touchstart timestamp, in ms. */
  readonly durationMs: number;
}

export type TouchKind = "tap" | "pan";

/**
 * A touch counts as a tap only when it stayed within `TAP_MOVE_TOLERANCE_PX` of
 * where it started *and* lasted no longer than `TAP_MAX_DURATION_MS` (both from
 * crosshairTimings.ts). Anything else is a pan (or a long press), which MapLibre
 * has already turned into camera movement.
 *
 * Both thresholds are inclusive: exactly 10 px or exactly 300 ms is still a tap,
 * so the tolerance means "up to and including".
 */
export function classifyTouch(
  gesture: TouchGesture,
  timings: Pick<
    CrosshairTimings,
    "TAP_MOVE_TOLERANCE_PX" | "TAP_MAX_DURATION_MS"
  > = CROSSHAIR_TIMINGS,
): TouchKind {
  if (!Number.isFinite(gesture.maxMovePx) || gesture.maxMovePx < 0) return "pan";
  if (!Number.isFinite(gesture.durationMs) || gesture.durationMs < 0) {
    return "pan";
  }
  if (gesture.maxMovePx > timings.TAP_MOVE_TOLERANCE_PX) return "pan";
  if (gesture.durationMs > timings.TAP_MAX_DURATION_MS) return "pan";
  return "tap";
}

/** Convenience predicate over {@link classifyTouch}. */
export function isTap(
  gesture: TouchGesture,
  timings?: Pick<
    CrosshairTimings,
    "TAP_MOVE_TOLERANCE_PX" | "TAP_MAX_DURATION_MS"
  >,
): boolean {
  return classifyTouch(gesture, timings) === "tap";
}

/**
 * Whether a point (viewport coordinates) falls inside a rect. Used to make the
 * whole readout group a tap target without giving it `pointer-events: auto`,
 * which would stop a pinch that begins on the pill from reaching the map.
 * Edges are inclusive.
 */
export function isWithinRect(
  point: { clientX: number; clientY: number },
  rect: { left: number; top: number; right: number; bottom: number },
): boolean {
  return (
    point.clientX >= rect.left &&
    point.clientX <= rect.right &&
    point.clientY >= rect.top &&
    point.clientY <= rect.bottom
  );
}

/**
 * Whether a point (viewport coordinates) falls inside the reticle's square hit
 * area. The reticle is locked to the map centre, so the box is derived from the
 * map container's own rect rather than measuring the reticle element — which
 * also means it is correct before the overlay has ever been laid out.
 */
export function isWithinReticleHit(
  point: { clientX: number; clientY: number },
  containerRect: { left: number; top: number; width: number; height: number },
  hitPx: number = CROSSHAIR_TIMINGS.RETICLE_HIT_PX,
): boolean {
  const centreX = containerRect.left + containerRect.width / 2;
  const centreY = containerRect.top + containerRect.height / 2;
  const half = hitPx / 2;
  return (
    Math.abs(point.clientX - centreX) <= half &&
    Math.abs(point.clientY - centreY) <= half
  );
}
