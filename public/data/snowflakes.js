// Definitions of snow_fraction patterns
const SNOW_FRACTION_DEFS = `
    <path id="snow-flake" fill="#fff" stroke="none" transform="translate(-202 -202)"
          d="M183.3125,43.09375L183.3125,83.8125L152.71875,66.125L137.1875,92.9375L183.3125,119.65625L183.3125,179.75L131.5,149.8125L131.40625,96.28125L100.40625,96.34375L100.46875,131.90625L65.09375,111.46875L49.59375,138.3125L84.875,158.6875L54.25,176.3125L69.6875,203.1875L115.90625,176.59375L167.90625,206.625L116.09375,236.53125L69.6875,209.84375L54.25,236.71875L85.0625,254.46875L49.6875,274.875L65.1875,301.71875L100.46875,281.34375L100.40625,316.6875L131.40625,316.75L131.5,263.4375L183.5,233.4375L183.5,293.25L137.1875,320.09375L152.71875,346.90625L183.5,329.09375L183.5,369.9375L214.5,369.9375L214.5,329.21875L245.09375,346.90625L260.625,320.09375L214.5,293.375L214.5,233.28125L266.3125,263.21875L266.40625,316.75L297.40625,316.6875L297.34375,281.125L332.71875,301.5625L348.21875,274.71875L312.9375,254.34375L343.5625,236.71875L328.125,209.84375L281.9375,236.4375L229.90625,206.40625L281.75,176.46875L328.125,203.1875L343.5625,176.3125L312.75,158.5625L348.125,138.15625L332.625,111.3125L297.34375,131.6875L297.40625,96.34375L266.40625,96.28125L266.3125,149.59375L214.3125,179.59375L214.3125,119.78125L260.625,92.9375L245.09375,66.125L214.3125,83.9375L214.3125,43.09375L183.3125,43.09375z"/>
    <pattern id="pt-snow-1" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <g transform="translate(5, 5)">
        <circle r="0.75" fill="white"/>
      </g>
      <g transform="translate(15, 14)">
        <circle r="0.75" fill="white"/>
      </g>
    </pattern>
    <pattern id="pt-snow-2" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <g transform="translate(5, 5)">
        <circle r="1" fill="white"/>
      </g>
      <g transform="translate(15, 14)">
        <circle r="1.25" fill="white"/>
      </g>
    </pattern>
    <pattern id="pt-snow-3" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <g transform="translate(5, 5)">
        <use href="#snow-flake" transform="scale(0.02) rotate(-15)"/>
      </g>
      <g transform="translate(15, 14)">
        <use href="#snow-flake" transform="scale(0.027) rotate(15)"/>
      </g>
    </pattern>
`;

// Mapping from snow_fraction values to pattern references
const fillSnowFrac = plt.linearScale(
  [0.25, "url(#pt-snow-1)"],
  [0.5, "url(#pt-snow-2)"],
  [0.75, "url(#pt-snow-3)"],
);

MIN_VISIBLE_SNOW = fillSnowFrac.domain()[0];

/** Add snow-patterned contours for snow-fraction (if present) */
function addSnowFraction(plotCtx, varSnowFrac, varPrecRate) {
  if (
    varSnowFrac?.data == null ||
    varSnowFrac.data_range[1] < MIN_VISIBLE_SNOW
  ) {
    return;
  }

  // Copy snow-fraction array, but 0 where precipitation is negligible (#1224)
  const realSnowFrac = new Array(varSnowFrac.data.length);
  for (let i = realSnowFrac.length - 1; i >= 0; i--) {
    realSnowFrac[i] =
      varPrecRate.data[i] >= MIN_VISIBLE_PREC ? varSnowFrac.data[i] : 0;
  }

  plotCtx.svgElm.append("defs").html(SNOW_FRACTION_DEFS);
  const thresholds = plt.thresholdsForVariable(fillSnowFrac, varSnowFrac);
  plt.plotContours(plotCtx, realSnowFrac, thresholds, {
    fillColorMap: fillSnowFrac,
  });
}
