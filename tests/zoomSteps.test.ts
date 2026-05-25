import { describe, expect, it } from "vitest";
import {
  getArrowDensityForZoom,
  getArrowStepForModel,
  getArrowStepForZoom,
  getGridStepForZoom,
  getIconGridForZoom,
  getInhouseContourDownsample,
  getMslpContourDownsample,
  getWaveContourDownsample,
  getWaveLabelStepForZoom,
  getWindLabelStepForZoom,
  getWindOverlayStyle,
  getWindStepForZoom,
  getWindStreamlineStyle,
} from "../src/lib/zoomSteps";

describe("getGridStepForZoom", () => {
  it("returns 2 at high zoom", () => {
    expect(getGridStepForZoom(6)).toBe(2);
    expect(getGridStepForZoom(10)).toBe(2);
  });
  it("returns 30 at low zoom", () => {
    expect(getGridStepForZoom(1)).toBe(30);
    expect(getGridStepForZoom(2)).toBe(30);
  });
  it("returns intermediate values at mid zoom", () => {
    expect(getGridStepForZoom(4.5)).toBe(5);
    expect(getGridStepForZoom(3.5)).toBe(10);
    expect(getGridStepForZoom(2.5)).toBe(20);
  });
});

describe("getWaveContourDownsample", () => {
  it("returns smallest factor at high zoom", () => {
    expect(getWaveContourDownsample(5)).toBe(3);
    expect(getWaveContourDownsample(8)).toBe(3);
  });
  it("returns largest factor at low zoom", () => {
    expect(getWaveContourDownsample(1)).toBe(12);
  });
  it("scales through intermediate values", () => {
    expect(getWaveContourDownsample(4)).toBe(4);
    expect(getWaveContourDownsample(3)).toBe(6);
    expect(getWaveContourDownsample(2)).toBe(8);
  });
});

describe("getMslpContourDownsample", () => {
  it("returns smallest factor at high zoom", () => {
    expect(getMslpContourDownsample(5)).toBe(2);
  });
  it("returns largest factor at low zoom", () => {
    expect(getMslpContourDownsample(1)).toBe(8);
  });
  it("covers all intermediate breakpoints", () => {
    expect(getMslpContourDownsample(4)).toBe(3);
    expect(getMslpContourDownsample(3)).toBe(4);
    expect(getMslpContourDownsample(2)).toBe(6);
  });
});

describe("getInhouseContourDownsample", () => {
  it("returns 1 at high zoom", () => {
    expect(getInhouseContourDownsample(8)).toBe(1);
    expect(getInhouseContourDownsample(10)).toBe(1);
  });
  it("returns 6 at very low zoom", () => {
    expect(getInhouseContourDownsample(1)).toBe(6);
  });
  it("returns intermediate values", () => {
    expect(getInhouseContourDownsample(3)).toBe(4);
    expect(getInhouseContourDownsample(5)).toBe(3);
    expect(getInhouseContourDownsample(7)).toBe(2);
  });
});

describe("getWindStepForZoom", () => {
  it("returns 1 at high zoom", () => {
    expect(getWindStepForZoom(6)).toBe(1);
  });
  it("returns 6 at low zoom", () => {
    expect(getWindStepForZoom(2)).toBe(6);
  });
  it("covers all intermediate breakpoints", () => {
    expect(getWindStepForZoom(5)).toBe(2);
    expect(getWindStepForZoom(4)).toBe(3);
    expect(getWindStepForZoom(3)).toBe(4);
  });
});

describe("getArrowDensityForZoom", () => {
  it("returns highest density at high zoom", () => {
    expect(getArrowDensityForZoom(6)).toBe(0.9);
  });
  it("returns lowest density at low zoom", () => {
    expect(getArrowDensityForZoom(1)).toBe(0.25);
  });
  it("covers all intermediate breakpoints", () => {
    expect(getArrowDensityForZoom(5)).toBe(0.7);
    expect(getArrowDensityForZoom(4)).toBe(0.5);
    expect(getArrowDensityForZoom(3)).toBe(0.35);
  });
});

describe("getArrowStepForZoom", () => {
  it("returns smallest step at high zoom", () => {
    expect(getArrowStepForZoom(6)).toBe(6);
  });
  it("returns largest step at low zoom", () => {
    expect(getArrowStepForZoom(2)).toBe(16);
  });
});

describe("getArrowStepForModel", () => {
  it("returns base step for null model", () => {
    expect(getArrowStepForModel(null, 5)).toBe(8);
  });
  it("returns base step for non-UWC model", () => {
    expect(getArrowStepForModel("gfs-1", 5)).toBe(8);
  });
  it("returns larger step for UWC model at low zoom", () => {
    expect(getArrowStepForModel("UWC-4km", 4)).toBe(40);
  });
  it("returns moderate step for UWC model at high zoom", () => {
    expect(getArrowStepForModel("UWC-4km", 8)).toBe(8);
  });
  it("is case-insensitive for UWC prefix", () => {
    expect(getArrowStepForModel("uwc-2km", 4)).toBe(40);
  });
  it("returns 30-clamped step for UWC model at zoom 5", () => {
    expect(getArrowStepForModel("UWC-4km", 5)).toBe(30);
  });
  it("returns 20-clamped step for UWC model at zoom 6", () => {
    expect(getArrowStepForModel("UWC-4km", 6)).toBe(20);
  });
  it("returns 12-clamped step for UWC model at zoom 7", () => {
    expect(getArrowStepForModel("UWC-4km", 7)).toBe(12);
  });
});

describe("getWaveLabelStepForZoom", () => {
  it("returns smallest step at high zoom", () => {
    expect(getWaveLabelStepForZoom(6)).toBe(3);
  });
  it("returns largest step at low zoom", () => {
    expect(getWaveLabelStepForZoom(1)).toBe(12);
  });
  it("covers all intermediate breakpoints", () => {
    expect(getWaveLabelStepForZoom(5)).toBe(4);
    expect(getWaveLabelStepForZoom(4)).toBe(5);
    expect(getWaveLabelStepForZoom(3)).toBe(6);
    expect(getWaveLabelStepForZoom(2)).toBe(9);
  });
});

describe("getWindLabelStepForZoom", () => {
  it("returns smallest step at high zoom", () => {
    expect(getWindLabelStepForZoom(7)).toBe(10);
  });
  it("returns largest step at low zoom", () => {
    expect(getWindLabelStepForZoom(2)).toBe(40);
  });
  it("covers all intermediate breakpoints", () => {
    expect(getWindLabelStepForZoom(6)).toBe(12);
    expect(getWindLabelStepForZoom(5)).toBe(16);
    expect(getWindLabelStepForZoom(4)).toBe(20);
    expect(getWindLabelStepForZoom(3)).toBe(28);
  });
});

describe("getWindOverlayStyle", () => {
  it("returns a complete style object", () => {
    const style = getWindOverlayStyle("gfs-1", 5);
    expect(style).toHaveProperty("arrowStep");
    expect(style).toHaveProperty("labelStep");
    expect(style).toHaveProperty("arrowMagnitudeMin", 2);
    expect(style).toHaveProperty("arrowMagnitudeMax", 20);
    expect(style).toHaveProperty("arrowSizeMin");
    expect(style).toHaveProperty("arrowSizeMax");
    expect(style).toHaveProperty("labelSize");
  });
  it("uses larger label step for UWC models", () => {
    const normal = getWindOverlayStyle("gfs-1", 4);
    const uwc = getWindOverlayStyle("UWC-4km", 4);
    expect(uwc.labelStep).toBeGreaterThanOrEqual(normal.labelStep);
  });
  it("returns larger arrow sizes at high zoom", () => {
    const low = getWindOverlayStyle(null, 3);
    const high = getWindOverlayStyle(null, 7);
    expect(high.arrowSizeMax).toBeGreaterThan(low.arrowSizeMax);
  });
});

describe("getWindStreamlineStyle", () => {
  it("returns density, width, and arrowSize", () => {
    const style = getWindStreamlineStyle(5);
    expect(style).toHaveProperty("density");
    expect(style).toHaveProperty("width");
    expect(style).toHaveProperty("arrowSize");
  });
  it("increases density at higher zoom", () => {
    const low = getWindStreamlineStyle(2);
    const high = getWindStreamlineStyle(8);
    expect(high.density).toBeGreaterThan(low.density);
  });
  it("increases arrowSize at higher zoom", () => {
    const low = getWindStreamlineStyle(2);
    const high = getWindStreamlineStyle(8);
    expect(high.arrowSize).toBeGreaterThan(low.arrowSize);
  });
  it("covers all zoom breakpoints", () => {
    expect(getWindStreamlineStyle(1)).toMatchObject({ density: 0.18 });
    expect(getWindStreamlineStyle(3)).toMatchObject({ density: 0.24 });
    expect(getWindStreamlineStyle(4)).toMatchObject({ density: 0.32 });
    expect(getWindStreamlineStyle(5)).toMatchObject({ density: 0.42 });
    expect(getWindStreamlineStyle(6)).toMatchObject({ density: 0.56 });
    expect(getWindStreamlineStyle(7)).toMatchObject({ density: 0.72 });
  });
});

describe("getWindOverlayStyle UWC-DINI and ECMWF-IS", () => {
  it("applies minimum labelStep of 48 for UWC-DINI at low zoom", () => {
    const style = getWindOverlayStyle("UWC-DINI", 3);
    expect(style.labelStep).toBeGreaterThanOrEqual(48);
  });

  it("uses same labelStep as regular UWC for non-DINI UWC models", () => {
    const dini = getWindOverlayStyle("UWC-DINI", 7);
    const other = getWindOverlayStyle("UWC-4km", 7);
    // DINI enforces >= 48; other UWC models enforce >= 24
    expect(dini.labelStep).toBeGreaterThanOrEqual(other.labelStep);
  });

  it("returns anisotropic arrow steps for ECMWF-IS", () => {
    const style = getWindOverlayStyle("ECMWF-IS", 5);
    expect(style.arrowStepX).toBeLessThan(style.arrowStep);
    expect(style.arrowStepY).toBeLessThan(style.arrowStepX);
  });

  it("returns symmetric arrow steps for non-ECMWF-IS model", () => {
    const style = getWindOverlayStyle("GFS", 5);
    expect(style.arrowStepX).toBe(style.arrowStep);
    expect(style.arrowStepY).toBe(style.arrowStep);
  });

  it("UWC-DINI label step at zoom 3 is at least base", () => {
    const style = getWindOverlayStyle("UWC-DINI", 3);
    const base = getWindOverlayStyle("GFS", 3);
    expect(style.labelStep).toBeGreaterThanOrEqual(base.labelStep);
  });
});

describe("getIconGridForZoom", () => {
  it("returns finest grid at very high zoom", () => {
    expect(getIconGridForZoom(9)).toEqual({ degStep: 0.25, iconSize: 72 });
    expect(getIconGridForZoom(10)).toEqual({ degStep: 0.25, iconSize: 72 });
  });

  it("returns coarsest grid at very low zoom", () => {
    expect(getIconGridForZoom(1)).toEqual({ degStep: 15.0, iconSize: 48 });
    expect(getIconGridForZoom(0)).toEqual({ degStep: 15.0, iconSize: 48 });
  });

  it("covers all zoom breakpoints", () => {
    expect(getIconGridForZoom(8)).toEqual({ degStep: 0.5, iconSize: 69 });
    expect(getIconGridForZoom(7)).toEqual({ degStep: 1.0, iconSize: 66 });
    expect(getIconGridForZoom(6)).toEqual({ degStep: 1.5, iconSize: 63 });
    expect(getIconGridForZoom(5)).toEqual({ degStep: 2.5, iconSize: 60 });
    expect(getIconGridForZoom(4)).toEqual({ degStep: 4.0, iconSize: 57 });
    expect(getIconGridForZoom(3)).toEqual({ degStep: 6.0, iconSize: 54 });
    expect(getIconGridForZoom(2)).toEqual({ degStep: 10.0, iconSize: 51 });
  });

  it("iconSize decreases as zoom decreases", () => {
    const high = getIconGridForZoom(9);
    const low = getIconGridForZoom(2);
    expect(high.iconSize).toBeGreaterThan(low.iconSize);
  });

  it("degStep increases as zoom decreases", () => {
    const high = getIconGridForZoom(9);
    const low = getIconGridForZoom(2);
    expect(low.degStep).toBeGreaterThan(high.degStep);
  });
});
