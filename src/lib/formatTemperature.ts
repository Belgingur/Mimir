/**
 * A temperature in whole degrees, as text.
 *
 * `toFixed(0)` keeps the sign of a negative value that rounds to zero, so
 * −0.2 °C would read "-0". Values that round to zero read "0" from either side.
 */
export function formatWholeDegrees(celsius: number): string {
  return String(Math.round(celsius) || 0);
}
