// GENERATED FILE — do not edit by hand.
// Regenerate with: python3 scripts/gen_temperature_scale.py
//
// Source: scales/gfs_temp_scale.json (GFS 2m temperature (Climate Reanalyzer style)).
// Each entry is the lower edge of a 1°C band; buildStepPalette turns the
// list into hard-edged steps, so the colour holds until the next stop.
//
// Truncated to the encoder domain [-50, 50]°C. The source ramp
// runs to -60°C, but netcdf2image.py quantises temperature to uint8 over
// srcMin/srcMax from manifest_scaling_v2.yml with `clip: BOTH`, so colder
// values are already saturated at the bottom code and the -60..-50 bands are
// unreachable. Widening this ramp requires re-encoding every frame.
//
// The JSON's below_min/above_max overflow colours are intentionally unused:
// with `clip: BOTH`, an out-of-range pixel is indistinguishable from a genuine
// -50°C or 50°C reading, so painting the endpoints as overflow would
// misreport real data.
//
// Resolution floor: 0.392°C per uint8 code, so 1°C bands span 2-3 codes
// and band edges carry up to +/-0.20°C of quantisation jitter. The 0°C
// discontinuity lands on the 127/128 code boundary (-0.196 / +0.196°C).
export const TEMPERATURE_SCALE: [number, string][] = [
  [-50, "#a873a8"], // -50°C
  [-49, "#a873a8"], // -49°C
  [-48, "#9d619d"], // -48°C
  [-47, "#914f91"], // -47°C
  [-46, "#914f91"], // -46°C
  [-45, "#863c87"], // -45°C
  [-44, "#7e317e"], // -44°C
  [-43, "#762476"], // -43°C
  [-42, "#6f186f"], // -42°C
  [-41, "#680c68"], // -41°C
  [-40, "#600060"], // -40°C
  [-39, "#6f006f"], // -39°C
  [-38, "#7e007e"], // -38°C
  [-37, "#8c008c"], // -37°C
  [-36, "#9b009b"], // -36°C
  [-35, "#aa00aa"], // -35°C
  [-34, "#b900b9"], // -34°C
  [-33, "#c800c8"], // -33°C
  [-32, "#d600d6"], // -32°C
  [-31, "#e500e5"], // -31°C
  [-30, "#f400f4"], // -30°C
  [-29, "#de04e9"], // -29°C
  [-28, "#c807de"], // -28°C
  [-27, "#b20bd4"], // -27°C
  [-26, "#9c0ec9"], // -26°C
  [-25, "#8612be"], // -25°C
  [-24, "#7016b3"], // -24°C
  [-23, "#5a19a8"], // -23°C
  [-22, "#441d9e"], // -22°C
  [-21, "#2e2093"], // -21°C
  [-20, "#182488"], // -20°C
  [-19, "#213395"], // -19°C
  [-18, "#2b42a1"], // -18°C
  [-17, "#3451ae"], // -17°C
  [-16, "#3d60bb"], // -16°C
  [-15, "#476ec7"], // -15°C
  [-14, "#507dd4"], // -14°C
  [-13, "#598ce1"], // -13°C
  [-12, "#619be7"], // -12°C
  [-11, "#6caafa"], // -11°C
  [-10, "#619be7"], // -10°C
  [-9, "#548cc9"], //  -9°C
  [-8, "#487eb1"], //  -8°C
  [-7, "#3c6f98"], //  -7°C
  [-6, "#306080"], //  -6°C
  [-5, "#437c99"], //  -5°C
  [-4, "#5698b3"], //  -4°C
  [-3, "#6ab4cc"], //  -3°C
  [-2, "#7dd0e6"], //  -2°C
  [-1, "#90ecff"], //  -1°C
  [0, "#98e6b0"], //   0°C
  [1, "#7ad28d"], //   1°C
  [2, "#5bbd6a"], //   2°C
  [3, "#3da946"], //   3°C
  [4, "#1e9423"], //   4°C
  [5, "#008000"], //   5°C
  [6, "#188c0b"], //   6°C
  [7, "#309816"], //   7°C
  [8, "#48a322"], //   8°C
  [9, "#60af2d"], //   9°C
  [10, "#78bb38"], //  10°C
  [11, "#90c743"], //  11°C
  [12, "#a8d34e"], //  12°C
  [13, "#c0de5a"], //  13°C
  [14, "#d8ea65"], //  14°C
  [15, "#f0f670"], //  15°C
  [16, "#f1e265"], //  16°C
  [17, "#f1cf59"], //  17°C
  [18, "#f2bb4e"], //  18°C
  [19, "#f3a843"], //  19°C
  [20, "#f39437"], //  20°C
  [21, "#f4812c"], //  21°C
  [22, "#f56d21"], //  22°C
  [23, "#f55a15"], //  23°C
  [24, "#f6460a"], //  24°C
  [25, "#f02906"], //  25°C
  [26, "#e42405"], //  26°C
  [27, "#d72005"], //  27°C
  [28, "#cb1b04"], //  28°C
  [29, "#be1703"], //  29°C
  [30, "#b21203"], //  30°C
  [31, "#a50e02"], //  31°C
  [32, "#990901"], //  32°C
  [33, "#8c0501"], //  33°C
  [34, "#800000"], //  34°C
  [35, "#8d1917"], //  35°C
  [36, "#99322e"], //  36°C
  [37, "#a64a46"], //  37°C
  [38, "#b3635d"], //  38°C
  [39, "#c07c74"], //  39°C
  [40, "#cc958b"], //  40°C
  [41, "#d9aea2"], //  41°C
  [42, "#e6c6ba"], //  42°C
  [43, "#f2dfd1"], //  43°C
  [44, "#fff8e8"], //  44°C
  [45, "#eee7d9"], //  45°C
  [46, "#e7d8ca"], //  46°C
  [47, "#d1c7b7"], //  47°C
  [48, "#acb8ad"], //  48°C
  [49, "#9fa498"], //  49°C
  [50, "#9fa498"], // terminal — anchors the scale at 50°C for legend tick spacing
];

export default TEMPERATURE_SCALE;
