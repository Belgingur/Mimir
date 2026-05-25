// Wave height scale: 30 discrete 1 m bins, 0–30 m.
// Colours 0–9 m sampled from ./scales/wave_height_scale_0-10.svg (19-band SVG).
// Colours 10–30 m linearly interpolated between JS anchors:
//   10 m → #b30000, 14 m → #000000, 20 m → #ff00ff, 30 m → #00ffff

export const WAVE_HEIGHT_SCALE: [number, string][] = [
  [0, "#5353ec"], //  0 –  1 m
  [1, "#d9d9ff"], //  1 –  2 m
  [2, "#70a970"], //  2 –  3 m
  [3, "#ffff70"], //  3 –  4 m
  [4, "#f7e469"], //  4 –  5 m
  [5, "#efc862"], //  5 –  6 m
  [6, "#e7ad5b"], //  6 –  7 m
  [7, "#de9254"], //  7 –  8 m
  [8, "#d6764d"], //  8 –  9 m
  [9, "#ce5b47"], //  9 – 10 m
  [10, "#b30000"], // 10 – 11 m
  [11, "#860000"], // 11 – 12 m
  [12, "#5a0000"], // 12 – 13 m
  [13, "#2d0000"], // 13 – 14 m
  [14, "#000000"], // 14 – 15 m
  [15, "#2a002a"], // 15 – 16 m
  [16, "#550055"], // 16 – 17 m
  [17, "#800080"], // 17 – 18 m
  [18, "#aa00aa"], // 18 – 19 m
  [19, "#d400d4"], // 19 – 20 m
  [20, "#ff00ff"], // 20 – 21 m
  [21, "#e61aff"], // 21 – 22 m
  [22, "#cc33ff"], // 22 – 23 m
  [23, "#b24cff"], // 23 – 24 m
  [24, "#9966ff"], // 24 – 25 m
  [25, "#8080ff"], // 25 – 26 m
  [26, "#6699ff"], // 26 – 27 m
  [27, "#4cb2ff"], // 27 – 28 m
  [28, "#33ccff"], // 28 – 29 m
  [29, "#1ae6ff"], // 29 – 30 m
  [30, "#00ffff"], // terminal — anchors the scale at 30 m
];

export default WAVE_HEIGHT_SCALE;
