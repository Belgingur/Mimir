import { describe, expect, it } from "vitest";
import {
  buildSnowDotIcon,
  buildSnowFlakeIcon,
  clearSnowSymbols,
  extractSnowPoints,
  MAX_FLAKE_PX,
  MIN_FLAKE_PX,
  type PrecipGrid,
  snowBlockPx,
  snowFeatures,
  snowFlakeZoomRange,
  snowFramesAreCurrent,
  snowIconSizeExpression,
  snowLayerBeforeId,
  SNOW_IMAGE_IDS,
  SNOW_LAYER_ID,
  SNOW_OVERLAY_MIN,
  SNOW_PRECIP_MIN_MM_H,
  SNOW_SOURCE_ID,
  type SnowMap,
  syncSnowSymbols,
  SYMBOL_OUTLINE_COLOR,
  SYMBOL_OUTLINE_PX,
  type SnowPoint,
} from "../src/lib/snowOverlay";
import type { InhouseLayer } from "../src/lib/inhouseTypes";
import { decodeScalarGrid } from "../src/lib/imageProcessing";

// ── snowBlockPx / snowSymbolScale ─────────────────────────────────────────────

/** Height of the snowflake path in its own units, as in snowOverlay.ts. */
const FLAKE_PATH_HEIGHT = 326.84;
/** Size of a symbol in its icon image (path height, dot diameter), in px. */
const ICON_SYMBOL_PX = 64;

/**
 * Evaluate the layer's icon-size at a zoom for a feature's `size`: either
 * ["*", px, ["get", "size"]], or an exponential interpolation over zoom of
 * two such stops, clamped outside them, as MapLibre evaluates it.
 */
function iconSizeAt(expr: unknown, zoom: number, size: number): number {
  const product = (e: unknown) => (e as [string, number])[1] * size;
  const e = expr as unknown[];
  if (e[0] === "*") return product(e);
  const [, [, base], , z0, a, z1, b] = e as [
    string, [string, number], unknown, number, unknown, number, unknown,
  ];
  if (zoom <= z0) return product(a);
  if (zoom >= z1) return product(b);
  const t = (base ** (zoom - z0) - 1) / (base ** (z1 - z0) - 1);
  return product(a) + t * (product(b) - product(a));
}

/** On-screen height, in px, of the larger snowflake on a grid at a zoom. */
function largeFlakePx(spacing: number | null, zoom: number, lat = 64): number {
  const large: SnowPoint = { lng: 0, lat: 0, tier: 3, rot: 0, size: 0.027 };
  const size = snowFeatures([large]).features[0].properties?.size as number;
  const expr = snowIconSizeExpression(snowFlakeZoomRange(spacing, lat));
  return iconSizeAt(expr, zoom, size) * ICON_SYMBOL_PX;
}

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

describe("the symbols' size per zoom", () => {
  it("makes the larger snowflake half a block high between 8 and 18 px", () => {
    for (const zoom of [5, 5.5, 6]) {
      const half = snowBlockPx(2500, zoom, 64) / 2;
      if (half < MIN_FLAKE_PX || half > MAX_FLAKE_PX) continue;
      // The stops are rounded to 0.01 of a zoom: within 1 %.
      expect(largeFlakePx(2500, zoom) / half).toBeCloseTo(1, 1);
    }
  });

  it("keeps every symbol between MIN_FLAKE_PX and MAX_FLAKE_PX at every zoom", () => {
    expect(MIN_FLAKE_PX).toBe(8);
    expect(MAX_FLAKE_PX).toBe(18);
    for (const spacing of [2500, 9000, 25000]) {
      for (let zoom = 0; zoom <= 14; zoom += 0.5) {
        const px = largeFlakePx(spacing, zoom);
        expect(px).toBeGreaterThanOrEqual(MIN_FLAKE_PX - 1e-9);
        expect(px).toBeLessThanOrEqual(MAX_FLAKE_PX + 1e-9);
      }
    }
  });

  it("sizes a model it doesn't know by name from its resolution alone", () => {
    // No model id goes in. At zoom 5 and 64° N a 2.5 km grid's block is
    // about 28 px, so its flake is 14 px; a 25 km grid is at the 18 px cap.
    const fine = largeFlakePx(2500, 5);
    expect(fine).toBeGreaterThan(13);
    expect(fine).toBeLessThan(15);
    expect(largeFlakePx(25000, 5)).toBeCloseTo(MAX_FLAKE_PX, 6);
  });

  it("draws the smallest size for a grid of unknown spacing", () => {
    for (const zoom of [3, 9]) {
      expect(largeFlakePx(null, zoom)).toBeCloseTo(MIN_FLAKE_PX, 6);
    }
  });

  it("keeps each symbol's proportion to the larger flake, as the SVG drew them", () => {
    const points: SnowPoint[] = [
      { lng: 0, lat: 0, tier: 3, rot: 0, size: 0.02 },
      { lng: 0, lat: 0, tier: 2, rot: 0, size: 1.25 },
      { lng: 0, lat: 0, tier: 1, rot: 0, size: 0.75 },
    ];
    const [small, dot2, dot1] = snowFeatures(points).features.map(
      (f) => (f.properties?.size as number) * ICON_SYMBOL_PX * 12,
    );
    // At a flake height of 12 px: the SVG's scale was 12 / (0.027 · 326.84),
    // a flake path · 0.02 of it high, a dot of radius r of it.
    const scale = 12 / (0.027 * FLAKE_PATH_HEIGHT);
    expect(small).toBeCloseTo(0.02 * FLAKE_PATH_HEIGHT * scale, 6);
    expect(dot2).toBeCloseTo(2 * 1.25 * scale, 6);
    expect(dot1).toBeCloseTo(2 * 0.75 * scale, 6);
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

// ── The map layer ────────────────────────────────────────────────────────────

/** A stand-in for the parts of a MapLibre map the snow layer uses. */
function fakeMap(initial: { id: string; type: string }[]) {
  const layers = [...initial];
  const specs = new Map<string, Record<string, unknown>>();
  const sources = new Map<string, { data: unknown; setData(d: unknown): void }>();
  const images = new Map<string, { image: unknown; options: unknown }>();
  const calls = { setData: 0, setLayout: 0, setPaint: 0, move: 0 };
  const map = {
    getLayersOrder: () => layers.map((l) => l.id),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer(spec: { id: string; type: string }, before?: string) {
      const i = before ? layers.findIndex((l) => l.id === before) : -1;
      layers.splice(i < 0 ? layers.length : i, 0, { id: spec.id, type: spec.type });
      specs.set(spec.id, spec as unknown as Record<string, unknown>);
    },
    moveLayer(id: string, before?: string) {
      calls.move++;
      const [layer] = layers.splice(layers.findIndex((l) => l.id === id), 1);
      const i = before ? layers.findIndex((l) => l.id === before) : -1;
      layers.splice(i < 0 ? layers.length : i, 0, layer);
    },
    getSource: (id: string) => sources.get(id),
    addSource(id: string, spec: { data: unknown }) {
      const source = {
        data: spec.data,
        setData(d: unknown) {
          calls.setData++;
          source.data = d;
        },
      };
      sources.set(id, source);
    },
    hasImage: (id: string) => images.has(id),
    addImage: (id: string, image: unknown, options: unknown) =>
      images.set(id, { image, options }),
    setLayoutProperty: () => calls.setLayout++,
    setPaintProperty: () => calls.setPaint++,
  };
  /** A style swap: the style's own layers come back, Mímir's are gone. */
  const swapStyle = () => {
    layers.splice(0, layers.length, ...initial);
    sources.clear();
    images.clear();
  };
  return { map: map as unknown as SnowMap, layers, specs, sources, images, calls, swapStyle };
}

const STYLE = [
  { id: "background", type: "background" },
  { id: "water-name-basemap", type: "symbol" },
  { id: "weather-raster", type: "custom" },
  { id: "mimir-reference-coast", type: "line" },
  { id: "mimir-landmark-water", type: "symbol" },
  { id: "place-city", type: "symbol" },
];
const flake: SnowPoint = { lng: 1, lat: 1, tier: 3, rot: 10, size: 0.027 };
const dot: SnowPoint = { lng: 2, lat: 3, tier: 2, rot: 0, size: 1.25 };
const state = (points: SnowPoint[] | null, opacity = 1) => ({
  points,
  opacity,
  zoomRange: snowFlakeZoomRange(2500, 64),
  weatherBeforeId: "mimir-reference-coast",
});

describe("the snow symbol layer", () => {
  it("goes under the first label above the weather, so place names are drawn over it", () => {
    const { map, layers } = fakeMap(STYLE);
    expect(snowLayerBeforeId(map, "mimir-reference-coast")).toBe("mimir-landmark-water");
    syncSnowSymbols(map, state([flake, dot]));
    const ids = layers.map((l) => l.id);
    expect(ids.indexOf(SNOW_LAYER_ID)).toBe(ids.indexOf("mimir-landmark-water") - 1);
    // Above the weather and its reference lines.
    expect(ids.indexOf(SNOW_LAYER_ID)).toBeGreaterThan(ids.indexOf("mimir-reference-coast"));
  });

  it("is never dropped by label collision and never displaces a label", () => {
    const { map, specs } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake]));
    const layout = specs.get(SNOW_LAYER_ID)?.layout as Record<string, unknown>;
    expect(layout["icon-allow-overlap"]).toBe(true);
    expect(layout["icon-ignore-placement"]).toBe(true);
  });

  it("draws one feature per point, at the point, with its icon and rotation", () => {
    const { map, sources } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake, dot]));
    const data = sources.get(SNOW_SOURCE_ID)?.data as GeoJSON.FeatureCollection<GeoJSON.Point>;
    expect(data.features.map((f) => f.geometry.coordinates)).toEqual([[1, 1], [2, 3]]);
    expect(data.features.map((f) => f.properties?.icon)).toEqual([
      SNOW_IMAGE_IDS.flake,
      SNOW_IMAGE_IDS.dot,
    ]);
    expect(data.features.map((f) => f.properties?.rot)).toEqual([10, 0]);
  });

  it("gives the symbols a white fill and a dark outline as a halo of the SDF icons", () => {
    const { map, specs, images } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake]));
    for (const id of Object.values(SNOW_IMAGE_IDS)) {
      expect(images.get(id)?.options).toEqual({ sdf: true });
    }
    const paint = specs.get(SNOW_LAYER_ID)?.paint as Record<string, unknown>;
    expect(paint["icon-color"]).toBe("#ffffff");
    expect(paint["icon-halo-color"]).toBe(SYMBOL_OUTLINE_COLOR);
    // Half of a 1 px edge centred on the outline, as the SVG stroke behind
    // the fill showed; in screen pixels, whatever the icon size.
    expect(paint["icon-halo-width"]).toBe(SYMBOL_OUTLINE_PX / 2);
  });

  it("moves the symbols with the map: nothing listens for map moves", () => {
    const { map, calls } = fakeMap(STYLE);
    const points = [flake];
    syncSnowSymbols(map, state(points));
    syncSnowSymbols(map, state(points));
    // The same points (one cached list per pair of frames) and size: nothing re-sent, nothing moved.
    expect(calls).toEqual({ setData: 0, setLayout: 0, setPaint: 0, move: 0 });
  });

  it("sends new points, sizes and opacity only when they change", () => {
    const { map, calls } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake]));
    syncSnowSymbols(map, state([dot], 0.5));
    expect(calls).toMatchObject({ setData: 1, setPaint: 1, setLayout: 0 });
    syncSnowSymbols(map, { ...state([dot], 0.5), zoomRange: snowFlakeZoomRange(9000, 64) });
    expect(calls.setLayout).toBe(1);
  });

  it("clears to no features and back", () => {
    const { map, sources } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake, dot]));
    clearSnowSymbols(map);
    const count = () =>
      (sources.get(SNOW_SOURCE_ID)?.data as GeoJSON.FeatureCollection).features.length;
    expect(count()).toBe(0);
    syncSnowSymbols(map, state([flake, dot]));
    expect(count()).toBe(2);
  });

  it("is put back under the labels after a style swap", () => {
    const { map, layers, images, swapStyle } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake]));
    swapStyle();
    syncSnowSymbols(map, state([flake]));
    const ids = layers.map((l) => l.id);
    expect(ids.indexOf(SNOW_LAYER_ID)).toBe(ids.indexOf("mimir-landmark-water") - 1);
    expect(images.size).toBe(2);
  });

  it("moves under a label layer added above the weather after it", () => {
    const { map, layers } = fakeMap(STYLE);
    syncSnowSymbols(map, state([flake]));
    // A label layer slotted in right below the snow layer, above the weather.
    layers.splice(layers.findIndex((l) => l.id === SNOW_LAYER_ID), 0, {
      id: "mimir-landmark-peak",
      type: "symbol",
    });
    syncSnowSymbols(map, state([flake]));
    const ids = layers.map((l) => l.id);
    expect(ids.indexOf(SNOW_LAYER_ID)).toBe(ids.indexOf("mimir-landmark-peak") - 1);
  });
});

describe("the snow icons", () => {
  /** MapLibre's SDF edge: alpha 6/8 (192 of 255). */
  const EDGE = 192;
  const alphaAt = (icon: { width: number; data: Uint8Array }, x: number, y: number) =>
    icon.data[(y * icon.width + x) * 4 + 3];

  it("are distance fields: opaque inside, the edge at 6/8, room for the halo outside", () => {
    for (const icon of [buildSnowDotIcon(), buildSnowFlakeIcon()]) {
      const c = icon.width / 2;
      // The centre of the dot and of the flake is inside the shape.
      expect(alphaAt(icon, c, c)).toBe(255);
      // The corner is outside, beyond the halo's reach.
      expect(alphaAt(icon, 0, 0)).toBe(0);
      // Some pixels sit on the edge band.
      let edge = 0;
      for (let i = 3; i < icon.data.length; i += 4) {
        if (Math.abs(icon.data[i] - EDGE) <= 16) edge++;
      }
      expect(edge).toBeGreaterThan(0);
    }
  });

  it("draw the dot ICON_SYMBOL_PX across and the flake ICON_SYMBOL_PX high", () => {
    const span = (icon: { width: number; height: number; data: Uint8Array }, axis: "x" | "y") => {
      const c = Math.floor(icon.width / 2);
      let inside = 0;
      for (let i = 0; i < icon.width; i++) {
        const a = axis === "x" ? alphaAt(icon, i, c) : alphaAt(icon, c, i);
        if (a >= EDGE) inside++;
      }
      return inside;
    };
    expect(Math.abs(span(buildSnowDotIcon(), "x") - ICON_SYMBOL_PX)).toBeLessThanOrEqual(1);
    // The flake's vertical arm runs the path's full height through its centre.
    expect(Math.abs(span(buildSnowFlakeIcon(), "y") - ICON_SYMBOL_PX)).toBeLessThanOrEqual(2);
  });
});
