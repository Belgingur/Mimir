// Cloud cover colour scale — 5 bins defined by 6 thresholds.
// Colours copied exactly from scales/cloud_area_fraction_scale.svg.
//
// The manifest encodes cloud cover as PERCENTAGE (0–100 %).
// manifest_scaling_v2.yml: srcMax=1.0 (fraction input), imageUnscale=[0,100]
// so the viewer receives decoded values in 0–100 range. Palette stops are
// in percentage units to match.
//
//  Bin  │ Range (%)   │ Colour
//  ─────┼─────────────┼────────────────────────────
//   1   │  0 –  25    │ #fffeff  rgb(255,254,255)
//   2   │ 25 –  50    │ #dfe2e9  rgb(223,226,233)
//   3   │ 50 –  75    │ #bfc6d2  rgb(191,198,210)
//   4   │ 75 –  99    │ #9fa9bc  rgb(159,169,188)
//   5   │ 99 – 100    │ #7f8ba5  rgb(127,139,165)
//
// The entry at 100 is a terminal anchor (same colour as bin 5).
export const CLOUD_COVER_SCALE: [number, string][] = [
  [0, "#fffeff"], // bin 1 start
  [25, "#dfe2e9"], // bin 2 start
  [50, "#bfc6d2"], // bin 3 start
  [75, "#9fa9bc"], // bin 4 start
  [99, "#7f8ba5"], // bin 5 start
  [100, "#7f8ba5"], // terminal anchor (same colour as bin 5)
];
