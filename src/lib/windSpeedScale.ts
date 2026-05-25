// Wind speed colour scale — 16 discrete bins of 2.5 m/s from 0 to 40 m/s.
// Colours sourced from scales/wind_speed_scale.svg.
export const WIND_SPEED_SCALE: [number, string][] = [
  [0.0, "#ffffff"], //  0.0 –  2.5 m/s
  [2.5, "#ffffa0"], //  2.5 –  5.0 m/s
  [5.0, "#d9ff80"], //  5.0 –  7.5 m/s
  [7.5, "#bbea80"], //  7.5 – 10.0 m/s
  [10.0, "#9dd580"], // 10.0 – 12.5 m/s
  [12.5, "#80c080"], // 12.5 – 15.0 m/s
  [15.0, "#e6e6ff"], // 15.0 – 17.5 m/s
  [17.5, "#c8c8fb"], // 17.5 – 20.0 m/s
  [20.0, "#aaaaf7"], // 20.0 – 22.5 m/s
  [22.5, "#8d8df3"], // 22.5 – 25.0 m/s
  [25.0, "#ffc6b9"], // 25.0 – 27.5 m/s
  [27.5, "#f7b8ae"], // 27.5 – 30.0 m/s
  [30.0, "#f0aaa2"], // 30.0 – 32.5 m/s
  [32.5, "#e89c97"], // 32.5 – 35.0 m/s
  [35.0, "#e18e8b"], // 35.0 – 37.5 m/s
  [37.5, "#d98080"], // 37.5 – 40.0 m/s
  [40.0, "#d98080"], // terminal — anchors the scale at 40 m/s for legend tick spacing
];

export default WIND_SPEED_SCALE;
