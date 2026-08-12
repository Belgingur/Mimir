/**
 * Timings for the transient centre crosshair (mobile).
 *
 * Every delay the crosshair state machine and its CSS depend on lives here, as
 * named constants — nothing is inlined at a call site. The CSS counterparts are
 * declared as custom properties in styles/components/center-readout.css and must
 * be kept in step with `CROSSHAIR_FADE_IN_MS` / `CROSSHAIR_FADE_OUT_MS`; they are
 * the only duplicated values, because CSS transitions cannot read TS constants.
 */

/**
 * SETTLED grace window before the crosshair fades out.
 *
 * Raised from the originally suggested 1800 ms after on-device testing: 1800
 * was not long enough to notice the meteogram button and reach it, so taps kept
 * landing on an already-fading readout and doing nothing. Lengthening this is
 * the sanctioned fix — the button is not to be shrunk to compensate.
 */
export const CROSSHAIR_HIDE_DELAY_MS = 3500;

/**
 * Shortened window used when a hide was owed but deferred — e.g. the hide timer
 * elapsed while the value for the current frame was still being decoded. The
 * user has already had most of the full window, so the remainder is trimmed.
 */
export const CROSSHAIR_HIDE_DELAY_SHORT_MS = 800;

/** Enter transition (opacity + scale on the reticle). */
export const CROSSHAIR_FADE_IN_MS = 120;

/** Exit transition (opacity only). */
export const CROSSHAIR_FADE_OUT_MS = 260;

/**
 * Above this much movement a touch is a pan, not a tap.
 *
 * Raised from the originally suggested 10 px: that is a mouse-sized tolerance,
 * and a thumb tap on a phone routinely drifts further than that during contact.
 * Taps on the readout were being classified as pans and dropped. 16 px is
 * conventional touch slop and still far below anything that reads as a pan —
 * MapLibre has its own, independent threshold for starting a drag, so this only
 * decides whether *we* treat the touch as a tap.
 */
export const TAP_MOVE_TOLERANCE_PX = 16;

/**
 * Above this duration a touch is a press/pan, not a tap. Raised from the
 * suggested 300 ms for the same reason: a deliberate aim-and-press at a small
 * target on a moving map often holds contact longer. There is no long-press
 * gesture anywhere in the app for this to collide with.
 */
export const TAP_MAX_DURATION_MS = 450;

/** Auto-dismiss for PINNED. 0 disables it — pinning holds until dismissed. */
export const PINNED_AUTO_DISMISS_MS = 0;

/**
 * Longest a still-resolving value may defer the hide. Standing in for the
 * "or aborts" half of "defer hiding until the request resolves or aborts": if
 * the frame's data never arrives (a failed catalog load, say) the crosshair must
 * not stay pinned on screen for ever.
 *
 * Kept comfortably longer than CROSSHAIR_HIDE_DELAY_MS so that it only ever
 * fires for a genuinely stuck value, never as a race against a normal hide.
 */
export const VALUE_PENDING_TIMEOUT_MS = 6000;

/**
 * Side of the square, transparent hit area centred on the reticle, in CSS px.
 * 44 is the iOS/Material minimum touch target. The area is *not* a DOM element
 * with `pointer-events: auto` — that would steal pinch gestures that happen to
 * start on the reticle. Touches are hit-tested against this box geometrically
 * instead (see `isWithinReticleHit`), so MapLibre keeps receiving every touch.
 */
export const RETICLE_HIT_PX = 44;

export interface CrosshairTimings {
  CROSSHAIR_HIDE_DELAY_MS: number;
  CROSSHAIR_HIDE_DELAY_SHORT_MS: number;
  CROSSHAIR_FADE_IN_MS: number;
  CROSSHAIR_FADE_OUT_MS: number;
  TAP_MOVE_TOLERANCE_PX: number;
  TAP_MAX_DURATION_MS: number;
  PINNED_AUTO_DISMISS_MS: number;
  VALUE_PENDING_TIMEOUT_MS: number;
  RETICLE_HIT_PX: number;
}

/** The defaults above as one object, for injection into the state machine. */
export const CROSSHAIR_TIMINGS: CrosshairTimings = {
  CROSSHAIR_HIDE_DELAY_MS,
  CROSSHAIR_HIDE_DELAY_SHORT_MS,
  CROSSHAIR_FADE_IN_MS,
  CROSSHAIR_FADE_OUT_MS,
  TAP_MOVE_TOLERANCE_PX,
  TAP_MAX_DURATION_MS,
  PINNED_AUTO_DISMISS_MS,
  VALUE_PENDING_TIMEOUT_MS,
  RETICLE_HIT_PX,
};
