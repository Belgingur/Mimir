import { describe, expect, it } from "vitest";
import {
  extractSnowPoints,
  hideSnowOverlayWhileMoving,
  MAX_FLAKE_PX,
  referenceZoomForModel,
  SNOW_OVERLAY_MIN,
  SnowOverlaySVG,
  snowSymbolScale,
  type SnowPoint,
} from "../src/lib/snowOverlay";
import type { InhouseLayer } from "../src/lib/inhouseTypes";

// ── referenceZoomForModel ─────────────────────────────────────────────────────

describe("referenceZoomForModel", () => {
  it("returns 3.0 for large-domain models (GFS, ECMWF)", () => {
    expect(referenceZoomForModel("GFS")).toBe(3.0);
    expect(referenceZoomForModel("ECMWF")).toBe(3.0);
  });

  it("returns 4.0 for medium-domain models (ICON-EU, UWC-DINI, UWC-IG)", () => {
    expect(referenceZoomForModel("ICON-EU")).toBe(4.0);
    expect(referenceZoomForModel("UWC-DINI")).toBe(4.0);
    expect(referenceZoomForModel("UWC-IG")).toBe(4.0);
  });

  it("returns 5.8 for small-domain models (BEL-IS, BEL-FO, unknown)", () => {
    expect(referenceZoomForModel("BEL-IS")).toBe(5.8);
    expect(referenceZoomForModel("BEL-FO")).toBe(5.8);
    expect(referenceZoomForModel("UNKNOWN")).toBe(5.8);
  });
});

// ── snowSymbolScale ───────────────────────────────────────────────────────────

/** Height of the snowflake path in its own units, as in snowOverlay.ts. */
const FLAKE_PATH_HEIGHT = 326.84;
/** On-screen height, in px, of the larger snowflake at a scale. */
const largeFlakePx = (scale: number) => 0.027 * scale * FLAKE_PATH_HEIGHT;

describe("snowSymbolScale", () => {
  it("is 1 at the reference zoom, where the symbols have their base size", () => {
    expect(snowSymbolScale(4, 4)).toBe(1);
    expect(snowSymbolScale(5.8, 5.8)).toBe(1);
  });

  it("doubles with each zoom level, and halves below the reference zoom", () => {
    expect(snowSymbolScale(5, 4)).toBe(2);
    expect(snowSymbolScale(6, 4)).toBe(4);
    expect(snowSymbolScale(3, 4)).toBe(0.5);
    expect(snowSymbolScale(6.8, 5.8)).toBeCloseTo(2, 10);
  });

  it("stops where the larger snowflake is MAX_FLAKE_PX high", () => {
    // Two zoom levels past the reference the flake is still under the cap…
    expect(largeFlakePx(snowSymbolScale(6, 4))).toBeLessThan(MAX_FLAKE_PX);
    // …and from three levels on it stays at the cap, however deep the zoom.
    for (const zoom of [7, 8, 9.5, 11, 14]) {
      expect(largeFlakePx(snowSymbolScale(zoom, 4))).toBeCloseTo(MAX_FLAKE_PX, 6);
    }
  });

  it("gives every model's symbols the same largest size", () => {
    for (const model of ["GFS", "UWC-DINI", "BEL-IS"]) {
      const scale = snowSymbolScale(14, referenceZoomForModel(model));
      expect(largeFlakePx(scale)).toBeCloseTo(MAX_FLAKE_PX, 6);
    }
  });
});

// ── extractSnowPoints helpers ─────────────────────────────────────────────────

function makeLayer(
  width: number,
  height: number,
  data: Uint8Array,
  srcMin = 0,
  srcMax = 1,
  bounds: [number, number, number, number] = [-10, -10, 10, 10],
): InhouseLayer {
  return {
    id: "test",
    model: "GFS",
    analysis: "2026-01-01_00",
    variable: "snow_fraction",
    manifest: {
      bounds,
      shape: { width, height },
      srcMin,
      srcMax,
      fileTemplate: "f_{index:03d}.webp",
      count: 1,
      analysisTime: "2026-01-01_00",
    },
    times: [],
    visible: true,
    image: null,
    scalar: null,
    rasterScalar: { data, width, height },
    rawRange: null,
    domainMask: null,
  } as unknown as InhouseLayer;
}

/** Raw byte value encoding a fraction in [0,1] with srcMin=0, srcMax=1. */
const encodeFrac = (frac: number) => Math.round(frac * 255);

// ── extractSnowPoints ─────────────────────────────────────────────────────────

describe("extractSnowPoints", () => {
  it("returns null when rasterScalar is null", () => {
    const layer = makeLayer(12, 12, new Uint8Array(144));
    layer.rasterScalar = null;
    expect(extractSnowPoints(layer)).toBeNull();
  });

  it("returns null when all values are below SNOW_OVERLAY_MIN", () => {
    const size = 24;
    // Fill with 10% snow fraction — below the 0.25 minimum
    const data = new Uint8Array(size * size).fill(encodeFrac(0.1));
    const layer = makeLayer(size, size, data);
    expect(extractSnowPoints(layer)).toBeNull();
  });

  it("returns points when some blocks exceed SNOW_OVERLAY_MIN", () => {
    // 24×24 raster: fill first 12×12 quadrant with 0.5 snow fraction
    const size = 24;
    const data = new Uint8Array(size * size).fill(0);
    for (let ry = 0; ry < 12; ry++) {
      for (let rx = 0; rx < 12; rx++) {
        data[ry * size + rx] = encodeFrac(0.5);
      }
    }
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.length).toBeGreaterThan(0);
  });

  it("assigns tier 1 for fraction 0.25–0.5", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 1)).toBe(true);
  });

  it("assigns tier 2 for fraction 0.5–0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 2)).toBe(true);
  });

  it("assigns tier 3 for fraction >= 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 3)).toBe(true);
  });

  it("returns two points per tile block", () => {
    // Single 12×12 block filled with high snow fraction
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
    expect(points!.length).toBe(2);
  });

  it("tier 1 and 2 points have rot=0", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.4));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points.every((p) => p.rot === 0)).toBe(true);
  });

  it("tier 3 points have deterministic non-zero rotation", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    // Rotation is deterministic (based on block coordinates)
    expect(points[0].rot).toBeDefined();
    expect(points[0].rot).toBeGreaterThanOrEqual(-30);
    expect(points[0].rot).toBeLessThanOrEqual(30);
  });

  it("tier 1 size is 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points.every((p) => p.size === 0.75)).toBe(true);
  });

  it("tier 3 sizes are 0.02 and 0.027", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer)!;
    expect(points[0].size).toBe(0.02);
    expect(points[1].size).toBe(0.027);
  });

  it("point lng/lat are within the manifest bounds", () => {
    const size = 24;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const bounds: [number, number, number, number] = [-20, -10, 20, 10];
    const layer = makeLayer(size, size, data, 0, 1, bounds);
    const points = extractSnowPoints(layer)!;
    for (const p of points) {
      expect(p.lng).toBeGreaterThanOrEqual(-20);
      expect(p.lng).toBeLessThanOrEqual(20);
      expect(p.lat).toBeGreaterThanOrEqual(-10);
      expect(p.lat).toBeLessThanOrEqual(10);
    }
  });

  it("respects widthMeta for logical raster width", () => {
    // paddedWidth=16, logical width=12
    const paddedWidth = 16;
    const logicalWidth = 12;
    const height = 12;
    const data = new Uint8Array(paddedWidth * height).fill(0);
    // Write high snow fraction in first 12 columns
    for (let ry = 0; ry < height; ry++) {
      for (let rx = 0; rx < logicalWidth; rx++) {
        data[ry * paddedWidth + rx] = encodeFrac(0.9);
      }
    }
    const layer = makeLayer(paddedWidth, height, data);
    layer.rasterScalar!.widthMeta = logicalWidth;
    const points = extractSnowPoints(layer);
    expect(points).not.toBeNull();
  });

  it("exports SNOW_OVERLAY_MIN = 0.25", () => {
    expect(SNOW_OVERLAY_MIN).toBe(0.25);
  });
});

// ── SnowOverlaySVG while the map moves ───────────────────────────────────────

describe("SnowOverlaySVG while the map moves", () => {
  /** A stand-in for MapLibre's event surface: on() and a way to fire. */
  function stubMap() {
    const listeners = new Map<string, Array<() => void>>();
    return {
      on(type: string, listener: () => void) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      fire(type: string) {
        for (const listener of listeners.get(type) ?? []) listener();
      },
    };
  }

  const point: SnowPoint = { lng: 2, lat: 3, tier: 1, rot: 0, size: 4 };
  const bounds = { west: -10, south: -10, east: 10, north: 10 };
  // Two projections: the map before and after it has been panned 50 px.
  const before = ([lng, lat]: [number, number]) => ({ x: lng * 10, y: lat * 10 });
  const after = ([lng, lat]: [number, number]) => ({ x: lng * 10 + 50, y: lat * 10 });

  function setup() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const overlay = new SnowOverlaySVG(container);
    const map = stubMap();
    hideSnowOverlayWhileMoving(map, overlay);
    const svg = container.querySelector("svg") as SVGSVGElement;
    const cx = () => svg.querySelector("circle")?.getAttribute("cx");
    return { container, overlay, map, svg, cx };
  }

  it("hides the symbols on movestart and shows them re-projected after moveend", () => {
    const { container, overlay, map, svg, cx } = setup();
    overlay.update([point], before, 1, 3, bounds, "GFS");
    expect(svg.style.visibility).toBe("");
    expect(cx()).toBe("20.0");

    map.fire("movestart");
    expect(svg.style.visibility).toBe("hidden");

    // An update scheduled mid-move (zoomstart schedules one) keeps it hidden.
    overlay.update([point], after, 1, 3, bounds, "GFS");
    expect(svg.style.visibility).toBe("hidden");

    map.fire("moveend");
    overlay.update([point], after, 1, 3, bounds, "GFS");
    expect(svg.style.visibility).toBe("");
    expect(cx()).toBe("70.0");
    container.remove();
  });

  it("draws no symbol larger than MAX_FLAKE_PX, however deep the zoom", () => {
    const { container, overlay, svg } = setup();
    const flake: SnowPoint = { lng: 1, lat: 1, tier: 3, rot: 10, size: 0.027 };
    const dot: SnowPoint = { lng: 2, lat: 3, tier: 2, rot: 0, size: 1.25 };
    const sizes = () => {
      const scale = Number(
        svg.querySelector("use")?.getAttribute("transform")?.match(/scale\(([\d.]+)\)/)?.[1],
      );
      const radius = Number(svg.querySelector("circle")?.getAttribute("r"));
      return { flakePx: scale * FLAKE_PATH_HEIGHT, dotPx: radius * 2 };
    };

    // One zoom level past UWC-DINI's reference zoom (4): twice the base size.
    overlay.update([flake, dot], before, 1, 5, bounds, "UWC-DINI");
    expect(sizes().flakePx).toBeCloseTo(2 * 0.027 * FLAKE_PATH_HEIGHT, 1);
    expect(sizes().dotPx).toBeCloseTo(2 * 2.5, 2);

    // As deep as the map goes: unlimited, the flake would be about 400 px high.
    overlay.update([flake, dot], before, 1, 9.5, bounds, "UWC-DINI");
    expect(sizes().flakePx).toBeGreaterThan(MAX_FLAKE_PX - 1);
    expect(sizes().flakePx).toBeLessThanOrEqual(MAX_FLAKE_PX + 0.1);
    expect(sizes().dotPx).toBeLessThan(MAX_FLAKE_PX);
    container.remove();
  });

  it("hides the symbols on zoomstart too", () => {
    const { container, overlay, map, svg } = setup();
    overlay.update([point], before, 1, 3, bounds, "GFS");
    map.fire("zoomstart");
    expect(svg.style.visibility).toBe("hidden");
    map.fire("moveend");
    overlay.update([point], after, 1, 3, bounds, "GFS");
    expect(svg.style.visibility).toBe("");
    container.remove();
  });
});
