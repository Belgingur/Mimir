import { describe, expect, it } from "vitest";
import {
  PREMULTIPLIED_ALPHA_BLEND,
  rasterLayerParameters,
} from "../src/lib/rasterBlending";

describe("rasterLayerParameters", () => {
  it("keeps depth testing off, and deck.gl's own blending, by default", () => {
    expect(rasterLayerParameters(false)).toEqual({ depthTest: false });
  });

  it("blends a premultiplied colour as such: source factor one, not alpha", () => {
    const p = rasterLayerParameters(true);
    expect(p.depthTest).toBe(false);
    expect(p).toMatchObject({
      blend: true,
      blendColorSrcFactor: "one",
      blendColorDstFactor: "one-minus-src-alpha",
      blendAlphaSrcFactor: "one",
      blendAlphaDstFactor: "one-minus-src-alpha",
    });
  });

  it("puts a 50 % band on the map at its own alpha, once (#46)", () => {
    // The shader's output for #e6ff00 at 50 %: (alpha·rgb, alpha).
    const alpha = 128 / 255;
    const src = [230 * alpha, 255 * alpha, 0];
    const land = [242, 243, 240];
    const factor = (f: string) => (f === "one" ? 1 : f === "src-alpha" ? alpha : NaN);
    const blended = src.map((c, i) =>
      Math.round(
        c * factor(PREMULTIPLIED_ALPHA_BLEND.blendColorSrcFactor) + land[i] * (1 - alpha),
      ),
    );
    // α·C + (1 − α)·D, not α²·C + (1 − α)·D (= #b2b978, what the map drew).
    expect(blended).toEqual([236, 249, 120]);
  });
});
