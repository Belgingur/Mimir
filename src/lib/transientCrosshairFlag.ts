/**
 * Feature flag for the transient mobile crosshair.
 *
 * Follows the house pattern (see features/meteogram/enabled.ts): a build-time
 * `import.meta.env` read, so a disabled build folds the guard to a constant.
 *
 * Default **on**. Set `VITE_TRANSIENT_CROSSHAIR=0` (or `false` / `off`) to fall
 * back to the previous behaviour — an always-visible centre crosshair plus the
 * four-button top-left control stack on mobile — without reverting anything.
 */
function isDisabledValue(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "0" || value === "false" || value === "off" || value === "no";
}

export function isTransientCrosshairEnabled(): boolean {
  return !isDisabledValue(import.meta.env.VITE_TRANSIENT_CROSSHAIR);
}
