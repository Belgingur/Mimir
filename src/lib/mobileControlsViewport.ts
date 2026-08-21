/**
 * Whether this device gets the mobile map layout, where the on-map `.zoom-buttons`
 * stack (+ / − / grid / meteogram) is removed and zooming is gesture-only.
 *
 * Capability **and** viewport, deliberately — unlike `CENTER_READOUT_MEDIA`,
 * which is capability *or* viewport:
 *
 * - `(pointer: coarse)` alone would strip the buttons from a coarse-pointer
 *   device large enough to have room for them.
 * - `(max-width: 640px)` alone would strip them from a narrow *desktop* window,
 *   which has no pinch gesture and would be left with no way to zoom at all.
 *
 * Requiring both means the buttons only disappear where a pinch is actually
 * available to replace them. No user-agent sniffing is involved.
 *
 * Overridable per-device — see lib/mobileMapControls.ts.
 */
export const MOBILE_MAP_CONTROLS_MEDIA =
  "(max-width: 640px) and (pointer: coarse)";

export function isMobileControlsViewport(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(MOBILE_MAP_CONTROLS_MEDIA).matches;
}
