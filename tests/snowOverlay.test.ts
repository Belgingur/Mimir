import { describe, expect, it } from "vitest";
import {
  extractSnowPoints,
  hideSnowOverlayWhileMoving,
  MAX_FLAKE_PX,
  MIN_FLAKE_PX,
  type PrecipGrid,
  snowBlockPx,
  snowFramesAreCurrent,
  SNOW_OVERLAY_MIN,
  SNOW_PRECIP_MIN_MM_H,
  SnowOverlaySVG,
  snowSymbolScale,
  SYMBOL_OUTLINE_COLOR,
  SYMBOL_OUTLINE_PX,
  type SnowPoint,
} from "../src/lib/snowOverlay";
import type { InhouseLayer } from "../src/lib/inhouseTypes";
import { decodeScalarGrid } from "../src/lib/imageProcessing";

// ── snowBlockPx / snowSymbolScale ─────────────────────────────────────────────

/** Height of the snowflake path in its own units, as in snowOverlay.ts. */
const FLAKE_PATH_HEIGHT = 326.84;
/** On-screen height, in px, of the larger snowflake at a scale. */
const largeFlakePx = (scale: number) => 0.027 * scale * FLAKE_PATH_HEIGHT;

describe("snowBlockPx", () => {
  it("is twelve cells of the grid, at the map's scale for the latitude", () => {
    // At zoom 0 on the equator a 512 px world is 40 075 km round.
    const metersPerPx = 40075016.686 / 512;
    expect(snowBlockPx(2500, 0, 0)).toBeCloseTo((12 * 2500) / metersPerPx, 6);
    // Each zoom level doubles it; at 60° N a metre is twice as many pixels.
    expect(snowBlockPx(2500, 5, 0)).toBeCloseTo(32 * snowBlockPx(2500, 0, 0), 6);
    expect(snowBlockPx(2500, 5, 60)).toBeCloseTo(2 * snowBlockPx(2500, 5, 0), 6);
  });

  it("follows the resolution: a 25 km grid's block is ten times a 2.5 km one's", () => {
    expect(snowBlockPx(25000, 6, 64)).toBeCloseTo(10 * snowBlockPx(2500, 6, 64), 6);
  });
});

describe("snowSymbolScale", () => {
  it("makes the larger snowflake half a block high between 8 and 18 px", () => {
    expect(largeFlakePx(snowSymbolScale(20))).toBeCloseTo(10, 6);
    expect(largeFlakePx(snowSymbolScale(30))).toBeCloseTo(15, 6);
  });

  it("keeps every symbol between MIN_FLAKE_PX and MAX_FLAKE_PX at every zoom", () => {
    expect(MIN_FLAKE_PX).toBe(8);
    expect(MAX_FLAKE_PX).toBe(18);
    for (const spacing of [2500, 9000, 25000]) {
      for (let zoom = 0; zoom <= 14; zoom += 0.5) {
        const px = largeFlakePx(snowSymbolScale(snowBlockPx(spacing, zoom, 64)));
        expect(px).toBeGreaterThanOrEqual(MIN_FLAKE_PX - 1e-9);
        expect(px).toBeLessThanOrEqual(MAX_FLAKE_PX + 1e-9);
      }
    }
  });

  it("sizes a model it doesn't know by name from its resolution alone", () => {
    // No model id goes in. At zoom 5 and 64° N a 2.5 km grid's block is
    // about 28 px, so its flake is 14 px; a 25 km grid is at the 18 px cap.
    const fine = largeFlakePx(snowSymbolScale(snowBlockPx(2500, 5, 64)));
    const coarse = largeFlakePx(snowSymbolScale(snowBlockPx(25000, 5, 64)));
    expect(fine).toBeGreaterThan(13);
    expect(fine).toBeLessThan(15);
    expect(coarse).toBe(MAX_FLAKE_PX);
  });

  it("draws the smallest size for a grid of unknown spacing", () => {
    expect(largeFlakePx(snowSymbolScale(null))).toBeCloseTo(MIN_FLAKE_PX, 6);
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

/** A precipitation frame of the layer's size, wet (1 mm/h) everywhere. */
function wetFor(layer: InhouseLayer, mmh = 1): PrecipGrid {
  const width = layer.rasterScalar?.widthMeta ?? layer.rasterScalar?.width ?? 0;
  const height = layer.rasterScalar?.height ?? 0;
  return { data: new Float32Array(width * height).fill(mmh), width, height };
}

/** Raw byte value encoding a fraction in [0,1] with srcMin=0, srcMax=1. */
const encodeFrac = (frac: number) => Math.round(frac * 255);

// ── extractSnowPoints ─────────────────────────────────────────────────────────

describe("extractSnowPoints", () => {
  it("returns null when rasterScalar is null", () => {
    const layer = makeLayer(12, 12, new Uint8Array(144));
    layer.rasterScalar = null;
    expect(extractSnowPoints(layer, wetFor(layer))).toBeNull();
  });

  it("returns null when all values are below SNOW_OVERLAY_MIN", () => {
    const size = 24;
    // Fill with 10% snow fraction — below the 0.25 minimum
    const data = new Uint8Array(size * size).fill(encodeFrac(0.1));
    const layer = makeLayer(size, size, data);
    expect(extractSnowPoints(layer, wetFor(layer))).toBeNull();
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
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
    expect(points!.length).toBeGreaterThan(0);
  });

  it("assigns tier 1 for fraction 0.25–0.5", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 1)).toBe(true);
  });

  it("assigns tier 2 for fraction 0.5–0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 2)).toBe(true);
  });

  it("assigns tier 3 for fraction >= 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
    expect(points!.every((p) => p.tier === 3)).toBe(true);
  });

  it("returns two points per tile block", () => {
    // Single 12×12 block filled with high snow fraction
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
    expect(points!.length).toBe(2);
  });

  it("tier 1 and 2 points have rot=0", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.4));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer))!;
    expect(points.every((p) => p.rot === 0)).toBe(true);
  });

  it("tier 3 points have deterministic non-zero rotation", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer))!;
    // Rotation is deterministic (based on block coordinates)
    expect(points[0].rot).toBeDefined();
    expect(points[0].rot).toBeGreaterThanOrEqual(-30);
    expect(points[0].rot).toBeLessThanOrEqual(30);
  });

  it("tier 1 size is 0.75", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.35));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer))!;
    expect(points.every((p) => p.size === 0.75)).toBe(true);
  });

  it("tier 3 sizes are 0.02 and 0.027", () => {
    const size = 12;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.9));
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, wetFor(layer))!;
    expect(points[0].size).toBe(0.02);
    expect(points[1].size).toBe(0.027);
  });

  it("point lng/lat are within the manifest bounds", () => {
    const size = 24;
    const data = new Uint8Array(size * size).fill(encodeFrac(0.6));
    const bounds: [number, number, number, number] = [-20, -10, 20, 10];
    const layer = makeLayer(size, size, data, 0, 1, bounds);
    const points = extractSnowPoints(layer, wetFor(layer))!;
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
    const points = extractSnowPoints(layer, wetFor(layer));
    expect(points).not.toBeNull();
  });

  it("exports SNOW_OVERLAY_MIN = 0.25", () => {
    expect(SNOW_OVERLAY_MIN).toBe(0.25);
  });
});

// ── extractSnowPoints: only where it precipitates ────────────────────────────

describe("extractSnowPoints gated on precipitation", () => {
  const size = 12;
  /** A 12 × 12 precipitation frame, every cell at `mmh` unless `cells` says. */
  const precipGrid = (mmh: number, cells: Record<number, number> = {}) => {
    const grid = { data: new Float32Array(size * size).fill(mmh), width: size, height: size };
    for (const [i, v] of Object.entries(cells)) grid.data[Number(i)] = v;
    return grid;
  };

  it("draws no symbol for a block whose cells are all below 0.1 mm/h", () => {
    const layer = makeLayer(size, size, new Uint8Array(size * size).fill(encodeFrac(0.9)));
    expect(SNOW_PRECIP_MIN_MM_H).toBe(0.1);
    expect(extractSnowPoints(layer, precipGrid(0.09))).toBeNull();
    expect(extractSnowPoints(layer, precipGrid(0))).toBeNull();
  });

  it("takes the wet cells' fraction: dry 1.0 and wet 0.3 give dots, not snowflakes", () => {
    const data = new Uint8Array(size * size).fill(encodeFrac(0.3));
    data[0] = encodeFrac(1.0); // the one dry cell
    const layer = makeLayer(size, size, data);
    const points = extractSnowPoints(layer, precipGrid(0.5, { 0: 0 }))!;
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.tier === 1)).toBe(true);
  });

  it("draws none for a block whose only snowy cell is dry", () => {
    const data = new Uint8Array(size * size).fill(0);
    data[5] = encodeFrac(1.0);
    const layer = makeLayer(size, size, data);
    expect(extractSnowPoints(layer, precipGrid(2, { 5: 0.05 }))).toBeNull();
  });

  it("doesn't count cells outside the precipitation domain (NaN)", () => {
    const layer = makeLayer(size, size, new Uint8Array(size * size).fill(encodeFrac(0.9)));
    expect(extractSnowPoints(layer, precipGrid(Number.NaN))).toBeNull();
  });

  it("draws nothing without a precipitation frame", () => {
    const layer = makeLayer(size, size, new Uint8Array(size * size).fill(encodeFrac(0.9)));
    expect(extractSnowPoints(layer, null)).toBeNull();
  });

  it("puts the 0.1 mm/h threshold between levels 4 and 5 of the live log1p frame", () => {
    // Live precipitation frames: 8 bits, log1p, imageUnscale [0, 250]. Level
    // 4 is 0.090 mm/h and level 5 0.114 mm/h, so level 5 is the first to count.
    const precipFrame = (level: number) =>
      decodeScalarGrid(
        {
          data: new Uint8Array(size * size * 4).map((_, i) => (i % 4 === 3 ? 255 : level)),
          width: size,
          height: size,
        } as never,
        [0, 250],
        "log1p",
      );
    expect(precipFrame(4).data[0]).toBeCloseTo(0.0905, 3);
    expect(precipFrame(5).data[0]).toBeCloseTo(0.1144, 3);
    const layer = makeLayer(size, size, new Uint8Array(size * size).fill(encodeFrac(0.9)));
    expect(extractSnowPoints(layer, precipFrame(4))).toBeNull();
    expect(extractSnowPoints(layer, precipFrame(5))).toHaveLength(2);
  });
});

// ── snowFramesAreCurrent ──────────────────────────────────────────────────────

describe("snowFramesAreCurrent", () => {
  type L = { frameTime?: string | null; name: string };
  const selected = (time: string | null) => () => time;
  const T1 = "2026-11-16T12:00:00Z";
  const T0 = "2026-11-16T11:00:00Z";

  it("is true when both frames hold the selected time", () => {
    const snow: L = { name: "snow", frameTime: T1 };
    const precip: L = { name: "precip", frameTime: T1 };
    expect(snowFramesAreCurrent(snow, precip, selected(T1))).toBe(true);
  });

  it("is false while the precipitation frame for the time is still arriving", () => {
    // The snow frame has landed; precipitation still holds the previous time.
    const snow: L = { name: "snow", frameTime: T1 };
    const precip: L = { name: "precip", frameTime: T0 };
    expect(snowFramesAreCurrent(snow, precip, selected(T1))).toBe(false);
  });

  it("is false when a frame failed and the layer kept another time's", () => {
    const snow: L = { name: "snow", frameTime: T0 };
    const precip: L = { name: "precip", frameTime: T0 };
    expect(snowFramesAreCurrent(snow, precip, selected(T1))).toBe(false);
  });

  it("is false before any frame has landed, or with nothing selected", () => {
    expect(
      snowFramesAreCurrent({ name: "s" } as L, { name: "p", frameTime: T1 }, selected(T1)),
    ).toBe(false);
    expect(
      snowFramesAreCurrent({ name: "s", frameTime: T1 }, { name: "p", frameTime: T1 }, selected(null)),
    ).toBe(false);
  });

  it("asks for each layer's own selected time (a layer may match a nearest time)", () => {
    const snow: L = { name: "snow", frameTime: T1 };
    const precip: L = { name: "precip", frameTime: T1 };
    const perLayer = (layer: L) => (layer.name === "snow" ? T1 : T0);
    expect(snowFramesAreCurrent(snow, precip, perLayer)).toBe(false);
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
    overlay.update([point], before, 1, 1, bounds);
    expect(svg.style.visibility).toBe("");
    expect(cx()).toBe("20.0");

    map.fire("movestart");
    expect(svg.style.visibility).toBe("hidden");

    // An update scheduled mid-move (zoomstart schedules one) keeps it hidden.
    overlay.update([point], after, 1, 1, bounds);
    expect(svg.style.visibility).toBe("hidden");

    map.fire("moveend");
    overlay.update([point], after, 1, 1, bounds);
    expect(svg.style.visibility).toBe("");
    expect(cx()).toBe("70.0");
    container.remove();
  });

  it("draws the symbols at the scale it is given, 8–18 px for the flake", () => {
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

    // A block 24 px wide: the flake is 12 px, the dot keeps its proportion.
    overlay.update([flake, dot], before, 1, snowSymbolScale(24), bounds);
    expect(sizes().flakePx).toBeCloseTo(12, 1);
    expect(sizes().dotPx).toBeCloseTo((12 / (0.027 * FLAKE_PATH_HEIGHT)) * 2.5, 1);

    // A tiny block (zoomed far out) and a huge one (deepest zoom).
    overlay.update([flake, dot], before, 1, snowSymbolScale(2), bounds);
    expect(sizes().flakePx).toBeCloseTo(MIN_FLAKE_PX, 1);
    overlay.update([flake, dot], before, 1, snowSymbolScale(1000), bounds);
    expect(sizes().flakePx).toBeCloseTo(MAX_FLAKE_PX, 1);
    expect(sizes().dotPx).toBeLessThan(MAX_FLAKE_PX);
    container.remove();
  });

  it("hides the symbols on zoomstart too", () => {
    const { container, overlay, map, svg } = setup();
    overlay.update([point], before, 1, 1, bounds);
    map.fire("zoomstart");
    expect(svg.style.visibility).toBe("hidden");
    map.fire("moveend");
    overlay.update([point], after, 1, 1, bounds);
    expect(svg.style.visibility).toBe("");
    container.remove();
  });
});

// ── SnowOverlaySVG: the symbols' outline ─────────────────────────────────────

describe("SnowOverlaySVG outline", () => {
  const bounds = { west: -10, south: -10, east: 10, north: 10 };
  const project = ([lng, lat]: [number, number]) => ({ x: lng * 10, y: lat * 10 });
  const flake: SnowPoint = { lng: 1, lat: 1, tier: 3, rot: 10, size: 0.027 };
  const dot: SnowPoint = { lng: 2, lat: 3, tier: 2, rot: 0, size: 1.25 };

  function setup() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const overlay = new SnowOverlaySVG(container);
    const svg = container.querySelector("svg") as SVGSVGElement;
    const group = svg.querySelector("#sf-g") as SVGGElement;
    return { container, overlay, svg, group };
  }

  it("uses no SVG filter: WebKit draws a filtered group this large at a reduced resolution", () => {
    const { container, overlay, svg, group } = setup();
    overlay.update([flake, dot], project, 1, snowSymbolScale(1000), bounds);
    expect(svg.querySelector("filter")).toBeNull();
    expect(group.hasAttribute("filter")).toBe(false);
    expect(svg.innerHTML).not.toContain("filter");
    container.remove();
  });

  it("gives every symbol a dark outline, drawn behind its white fill", () => {
    const { container, group } = setup();
    expect(group.getAttribute("fill")).toBe("white");
    expect(group.getAttribute("stroke")).toBe(SYMBOL_OUTLINE_COLOR);
    expect(group.getAttribute("paint-order")).toBe("stroke");
    container.remove();
  });

  it("keeps the outline's width in screen pixels, whatever the symbols' scale", () => {
    const { container, overlay, svg, group } = setup();
    // The snowflake path is drawn through <use> with a scale: only
    // non-scaling-stroke on the path itself keeps the stroke from scaling.
    expect(svg.querySelector("#sf")?.getAttribute("vector-effect")).toBe(
      "non-scaling-stroke",
    );
    for (const zoom of [3, 5, 9.5]) {
      overlay.update([flake, dot], project, 1, snowSymbolScale(zoom), bounds);
      expect(group.getAttribute("stroke-width")).toBe(String(SYMBOL_OUTLINE_PX));
      // No symbol overrides the group's outline.
      for (const symbol of group.children) {
        expect(symbol.hasAttribute("stroke-width")).toBe(false);
        expect(symbol.hasAttribute("stroke")).toBe(false);
      }
    }
    container.remove();
  });
});
