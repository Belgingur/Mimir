/**
 * How a WeatherLayers raster layer is blended onto the map.
 *
 * WeatherLayers' raster shader hands deck.gl its colour already multiplied by
 * its alpha: it ends with `mix(transparentColor, vec4(rgb, 1), alpha)`, which
 * for the default transparent colour is `(alpha·rgb, alpha)`. deck.gl blends
 * layers as straight alpha (`src-alpha`, `one-minus-src-alpha`), so it
 * multiplies by alpha a second time: a palette colour at 50 % reached the map
 * as a quarter of its colour over half the basemap, darker and greyer than its
 * legend (#46). Blending with `one` as the source factor takes the
 * premultiplied colour as it is, so the colour is applied once.
 */
export const PREMULTIPLIED_ALPHA_BLEND = {
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "one",
  blendColorDstFactor: "one-minus-src-alpha",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one-minus-src-alpha",
} as const;

/**
 * The deck.gl `parameters` for a raster layer. Depth testing is off for every
 * raster, as before; `premultiplied` adds the blending above, for a palette
 * whose translucent colours must show at their own alpha (precipitation).
 */
export function rasterLayerParameters(premultiplied: boolean) {
  return premultiplied
    ? { depthTest: false, ...PREMULTIPLIED_ALPHA_BLEND }
    : { depthTest: false };
}
