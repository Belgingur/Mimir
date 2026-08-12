/**
 * Accessibility escape hatch for the removed mobile zoom controls.
 *
 * Gesture-only zoom is a regression for anyone who cannot pinch, double-tap or
 * double-tap-drag. This flag restores the top-left `+` / `−` / grid stack on
 * mobile without a rebuild:
 *
 *     localStorage.setItem('mimir-show-map-controls', '1')   // then reload
 *
 * It is intentionally *not* wired to any on-screen control. The brief forbids
 * adding a replacement entry point on mobile, and there is no user-facing
 * settings surface on mobile to host a "Show map controls" toggle (`.panel` is
 * dev-only). Building one is a new UI surface and a product decision — see the
 * hand-off note. Until then this key is the supported path, and it is
 * deliberately separate from the versioned `wl-viewer-state-v1` blob so an
 * a11y override is never lost to a schema migration.
 */
const STORAGE_KEY = "mimir-show-map-controls";

export function shouldForceMobileMapControls(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const value = raw.trim().toLowerCase();
    return value === "1" || value === "true" || value === "on" || value === "yes";
  } catch {
    // Private-mode / blocked storage: fall back to the default (controls hidden).
    return false;
  }
}
