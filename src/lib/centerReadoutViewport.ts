/** Media query shared by the center readout UI and mobile tooltip suppression. */
export const CENTER_READOUT_MEDIA =
  "(max-width: 640px), (hover: none) and (pointer: coarse)";

export function isCenterReadoutViewport(): boolean {
  return window.matchMedia(CENTER_READOUT_MEDIA).matches;
}
