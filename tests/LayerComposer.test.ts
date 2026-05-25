import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureCollection } from "geojson";

const {
  mockRasterLayer,
  mockParticleLayer,
  mockLegendControl,
  mockGetRasterPoints,
  mockGeoJsonLayer,
  mockIconLayer,
  mockLineLayer,
  mockPathLayer,
  mockScatterplotLayer,
  mockTextLayer,
  mockBuildGraticuleLines,
  mockBuildGraticuleLabels,
  mockDecodeVectorComponents,
  mockBuildStreamlineGeotransform,
} = vi.hoisted(() => ({
  mockRasterLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props, { __type: "RasterLayer" });
  }),
  mockParticleLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props, { __type: "ParticleLayer" });
  }),
  mockLegendControl: vi.fn(function (
    this: Record<string, unknown>,
    config: Record<string, unknown>,
  ) {
    Object.assign(this, {
      config,
      addTo: vi.fn((host: HTMLDivElement) => {
        const child = document.createElement("div");
        host.appendChild(child);
      }),
      setConfig: vi.fn(),
    });
  }),
  mockGetRasterPoints: vi.fn(() => ({ features: [] as Array<any> })),
  mockGeoJsonLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockIconLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockLineLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockPathLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockScatterplotLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockTextLayer: vi.fn(function (
    this: Record<string, unknown>,
    props: Record<string, unknown>,
  ) {
    Object.assign(this, props);
  }),
  mockBuildGraticuleLines: vi.fn(() => [{ source: [0, 0], target: [1, 1] }]),
  mockBuildGraticuleLabels: vi.fn(() => [{ position: [1, 2], text: "10°N" }]),
  mockDecodeVectorComponents: vi.fn(() => ({
    width: 2,
    height: 2,
    u: new Float32Array([1, 2, 3, 4]),
    v: new Float32Array([4, 3, 2, 1]),
  })),
  mockBuildStreamlineGeotransform: vi.fn(() => [0, 1, 0, 0, 0, -1]),
}));

vi.mock("weatherlayers-gl", () => ({
  RasterLayer: mockRasterLayer,
  ParticleLayer: mockParticleLayer,
  LegendControl: mockLegendControl,
  getRasterPoints: mockGetRasterPoints,
  ImageType: { SCALAR: "SCALAR", VECTOR: "VECTOR" },
  ImageInterpolation: { LINEAR: "LINEAR" },
  UnitSystem: { METRIC: "metric" },
}));

vi.mock("weatherlayers-gl/client", () => ({}));

vi.mock("@deck.gl/layers", () => ({
  GeoJsonLayer: mockGeoJsonLayer,
  IconLayer: mockIconLayer,
  LineLayer: mockLineLayer,
  PathLayer: mockPathLayer,
  ScatterplotLayer: mockScatterplotLayer,
  TextLayer: mockTextLayer,
}));

vi.mock("@deck.gl/core", () => ({}));

vi.mock("../src/lib/graticule", () => ({
  buildGraticuleLines: mockBuildGraticuleLines,
  buildGraticuleLabels: mockBuildGraticuleLabels,
}));

vi.mock("../src/lib/imageProcessing", () => ({
  clampScalarImage: vi.fn((image: unknown) => image),
  cropScalarImageToBounds: vi.fn(
    (image: unknown, bounds: [number, number, number, number]) => ({
      image,
      bounds,
    }),
  ),
  decodeScalarGrid: vi.fn(
    (image: { data: Float32Array; width: number; height: number }) => image,
  ),
  decodeVectorComponents: mockDecodeVectorComponents,
}));

vi.mock("../src/lib/inhouseLayerHelpers", () => ({
  getInhouseLayerBounds: vi.fn(
    (layer: { manifest: { bounds: [number, number, number, number] } }) =>
      layer.manifest.bounds,
  ),
  getInhouseLayerUnscale: vi.fn(() => [-128, 127]),
  getInhouseLayerImageScale: vi.fn(() => null),
}));

vi.mock("../src/lib/streamlineBuilder", () => ({
  buildStreamlineGeotransform: mockBuildStreamlineGeotransform,
}));

vi.mock("../src/lib/arrowGeometry", () => ({
  ARROW_HEAD_ICON: { id: "head" },
  ARROW_ICON: { id: "arrow" },
  buildArrowPoints: vi.fn(() => []),
  buildStreamlineArrowHeads: vi.fn(() => []),
  buildWindLabelPoints: vi.fn(() => []),
}));

vi.mock("../src/lib/zoomSteps", () => ({
  getArrowStepForModel: vi.fn(() => 4),
  getGridStepForZoom: vi.fn(() => 10),
  getInhouseContourDownsample: vi.fn(() => 2),
  getWaveContourDownsample: vi.fn(() => 2),
  getWindOverlayStyle: vi.fn(() => ({
    arrowStep: 4,
    labelStep: 6,
    arrowSizeMin: 8,
    arrowSizeMax: 20,
    arrowMagnitudeMin: 0,
    arrowMagnitudeMax: 25,
    labelSize: 12,
  })),
  getWindStepForZoom: vi.fn(() => 8),
  getWindStreamlineStyle: vi.fn(() => ({
    density: 2,
    width: 1.5,
    arrowSize: 10,
  })),
}));

import {
  LayerComposer,
  type LayerComposerDeps,
} from "../src/controllers/LayerComposer";

function makeDom() {
  return {
    inhouseTooltip: document.createElement("div") as HTMLDivElement,
    gridLabelsContainer: document.createElement("div") as HTMLDivElement,
    tooltipHost: document.createElement("div") as HTMLDivElement,
    mapWrap: document.createElement("div") as HTMLDivElement,
    legendHost: document.createElement("div") as HTMLDivElement,
    waveLegendHost: document.createElement("div") as HTMLDivElement,
    windLegendHost: document.createElement("div") as HTMLDivElement,
    precipLegendHost: document.createElement("div") as HTMLDivElement,
  };
}

function makeMockCatalogController() {
  return {
    inhouseLayers: [] as Array<any>,
    inhouseTimeIndex: 0,
    contourCache: new Map<
      string,
      { path: [number, number][]; value: number }[]
    >(),
    contourPending: new Set<string>(),
    inhouseVariableMeta: {} as Record<
      string,
      { contourInterval?: number; majorInterval?: number }
    >,
    findInhouseLayerByCandidates: vi.fn(() => null),
    findPreferredInhouseWindVectorLayer: vi.fn(() => null),
    isInhouseVectorLayer: vi.fn(() => false),
    sampleInhouseVectorAtCoord: vi.fn(() => ({ value: null, direction: null })),
    logWindParticleTextureDebug: vi.fn(),
    getParticleTextureData: vi.fn((image: unknown) => image),
  };
}

function makeMockTimelineController() {
  return {
    currentDatetime: "2026-01-01T00:00:00Z",
    timelineRange: null,
    windTimelineDatetimes: [] as string[],
    activeTimelineDatetimes: [] as string[],
    timelineAutoPlay: false,
    resolveDatasetDatetime: vi.fn((d: string) => d),
    updateTimelineControlForMode: vi.fn(),
  };
}

function makeMockTooltipController() {
  return {
    tempRasterHoverActive: false,
    tempRasterHoverTs: 0,
    updatePickingInfo: vi.fn(),
    updateTooltipValueOverride: vi.fn(),
    updateTooltipWindSpeed: vi.fn(),
    updateWindDirectionDebug: vi.fn(),
    finiteDirectionOrUndefined: vi.fn((v: number | null) =>
      Number.isFinite(v) ? v : undefined,
    ),
    formatCardinalDirection: vi.fn((_v: number | null) => "NW"),
    updateTooltipWindSpeedBeforeDirection: vi.fn(),
    updateTooltipWavePeriod: vi.fn(),
  };
}

function makeMockWindStyleController() {
  return {
    style: "arrows" as const,
    runtimeAvailable: true,
    hasWindUv10m: false,
    numParticles: 900,
    maxAge: 10,
    speedFactor: 20,
    syncControls: vi.fn(),
    setStyle: vi.fn(),
    setWarning: vi.fn(),
    handleParticleFailure: vi.fn(),
  };
}

function makeMockLayerGroupController() {
  return {
    viewMode: "forecast" as const,
  };
}

function makeMockWavegramController() {
  return {
    isLoading: false,
    isOpen: false,
    activeCoord: null as [number, number] | null,
    open: vi.fn(),
  };
}

function makeDeps(overrides?: Partial<LayerComposerDeps>): LayerComposerDeps {
  const dom = makeDom();
  const contourWorker = {
    postMessage: vi.fn(),
    onmessage: null,
    terminate: vi.fn(),
  } as unknown as Worker;
  const mslpWorker = {
    postMessage: vi.fn(),
    onmessage: null,
    terminate: vi.fn(),
  } as unknown as Worker;
  const windWorker = {
    postMessage: vi.fn(),
    onmessage: null,
    terminate: vi.fn(),
  } as unknown as Worker;
  return {
    dom,
    getMapZoom: () => 5,
    getMapBounds: () => ({
      getWest: () => -30,
      getSouth: () => 45,
      getEast: () => 10,
      getNorth: () => 70,
    }),
    getMapCenter: () => ({ lng: -20, lat: 55 }),
    getMapBearing: () => 0,
    getMapPitch: () => 0,
    projectMap: vi.fn(() => ({ x: 100, y: 100 })),
    unprojectMap: vi.fn(() => ({ lng: -20, lat: 55 })),
    getMapCanvas: () => document.createElement("canvas"),
    getMapContainer: () => document.createElement("div"),
    resizeMap: vi.fn(),
    jumpToMap: vi.fn(),
    easeToMap: vi.fn(),
    setOverlayProps: vi.fn(),
    getUiState: () => ({
      visible: true,
      opacity: 1,
      layerMode: "temperature",
      showGrid: false,
      iconographyStyle: "compact",
    }),
    isMapReady: () => true,
    getCatalogController: () =>
      makeMockCatalogController() as unknown as LayerComposerDeps["getCatalogController"] extends () => infer T
        ? T
        : never,
    getTimelineController: () =>
      makeMockTimelineController() as unknown as LayerComposerDeps["getTimelineController"] extends () => infer T
        ? T
        : never,
    getTooltipController: () =>
      makeMockTooltipController() as unknown as LayerComposerDeps["getTooltipController"] extends () => infer T
        ? T
        : never,
    getWindStyleController: () =>
      makeMockWindStyleController() as unknown as LayerComposerDeps["getWindStyleController"] extends () => infer T
        ? T
        : never,
    getLayerGroupController: () =>
      makeMockLayerGroupController() as unknown as LayerComposerDeps["getLayerGroupController"] extends () => infer T
        ? T
        : never,
    getWavegramController: () =>
      makeMockWavegramController() as unknown as LayerComposerDeps["getWavegramController"] extends () => infer T
        ? T
        : never,
    schedulePersistState: vi.fn(),
    client: {
      loadDatasetData: vi.fn(async () => ({
        datetime: "2026-01-01T00:00:00Z",
        referenceDatetime: "2026-01-01T00:00:00Z",
        horizon: 0,
        image: { data: new Uint8Array(4), width: 1, height: 1 },
        image2: null,
        imageType: "SCALAR",
        imageUnscale: [0, 1],
        imageWeight: 0,
        imageMinValue: null,
        imageMaxValue: null,
        imageInterpolation: "LINEAR",
        imageSmoothing: 0,
      })),
      loadDataset: vi.fn(async () => ({
        title: "Dataset",
        unitFormat: null,
        attribution: "",
        bounds: [-180, -90, 180, 90],
        datetimes: [],
        id: "x",
        palette: [],
      })),
      loadDatasetSlice: vi.fn(async () => ({ datetimes: [] })),
    },
    createContourWorker: vi.fn(() => contourWorker),
    createMslpContourWorker: vi.fn(() => mslpWorker),
    createWindStreamlineWorker: vi.fn(() => windWorker),
    isDev: false,
    supportsWindParticlesPlatform: true,
    isFirefox: false,
    inhouseRoot: "/forecast-data",
    ...overrides,
  } as unknown as LayerComposerDeps;
}

function getPrivate<T>(instance: LayerComposer, key: string): T {
  return (instance as unknown as Record<string, T>)[key];
}

function callPrivate<T>(
  instance: LayerComposer,
  key: string,
  ...args: unknown[]
): T {
  const fn = (instance as unknown as Record<string, (...a: unknown[]) => T>)[
    key
  ];
  return fn.apply(instance, args);
}

function makeVectorLayer(overrides: Record<string, unknown> = {}) {
  return {
    id: "layer-1",
    model: "gfs",
    analysis: "2026-01-01_00",
    variable: "wind_uv_10m",
    image: { data: new Float32Array([1, 1, 1, 1]), width: 2, height: 2 },
    manifest: {
      bounds: [-20, 50, -10, 60] as [number, number, number, number],
      shape: { width: 4, height: 4 },
    },
    ...overrides,
  };
}

describe("LayerComposer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("construction", () => {
    it("creates instance with valid deps", () => {
      const composer = new LayerComposer(makeDeps());
      expect(composer).toBeInstanceOf(LayerComposer);
    });

    it("initializes state and caches as empty", () => {
      const composer = new LayerComposer(makeDeps());
      expect(getPrivate<unknown[]>(composer, "lastCompositeLayers")).toEqual(
        [],
      );
      expect(getPrivate<unknown>(composer, "windData")).toBeNull();
      expect(getPrivate<unknown>(composer, "precipData")).toBeNull();
      expect(getPrivate<boolean>(composer, "gridLabelsDirty")).toBe(true);
    });

    it("creates workers lazily on first access", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      // Workers are not created eagerly in the constructor
      expect(deps.createContourWorker).not.toHaveBeenCalled();
      // Trigger lazy initialization via private getter
      getPrivate<Worker>(composer, "contourWorker");
      getPrivate<Worker>(composer, "mslpContourWorker");
      getPrivate<Worker>(composer, "windStreamlineWorker");
      expect(deps.createContourWorker).toHaveBeenCalledTimes(1);
      expect(deps.createMslpContourWorker).toHaveBeenCalledTimes(1);
      expect(deps.createWindStreamlineWorker).toHaveBeenCalledTimes(1);
    });

    it("attaches worker onmessage handlers", () => {
      const composer = new LayerComposer(makeDeps());
      const contourWorker = getPrivate<{ onmessage: unknown }>(
        composer,
        "contourWorker",
      );
      const mslpWorker = getPrivate<{ onmessage: unknown }>(
        composer,
        "mslpContourWorker",
      );
      const windWorker = getPrivate<{ onmessage: unknown }>(
        composer,
        "windStreamlineWorker",
      );
      expect(typeof contourWorker.onmessage).toBe("function");
      expect(typeof mslpWorker.onmessage).toBe("function");
      expect(typeof windWorker.onmessage).toBe("function");
    });
  });

  describe("scheduleUpdateLayers", () => {
    it("calls updateLayers immediately when map ready and no composite layers", () => {
      const composer = new LayerComposer(makeDeps());
      const spy = vi
        .spyOn(composer, "updateLayers")
        .mockImplementation(() => {});
      composer.scheduleUpdateLayers();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("calls updateLayers via requestAnimationFrame", () => {
      vi.useFakeTimers();
      const composer = new LayerComposer(makeDeps());
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "x" },
      ];
      const spy = vi
        .spyOn(composer, "updateLayers")
        .mockImplementation(() => {});
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) =>
          setTimeout(() => cb(0), 0) as unknown as number,
      );

      composer.scheduleUpdateLayers();
      expect(spy).toHaveBeenCalledTimes(0);
      vi.advanceTimersToNextTimer();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("debounces multiple calls into single frame callback", () => {
      vi.useFakeTimers();
      const composer = new LayerComposer(makeDeps());
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "x" },
      ];
      const spy = vi
        .spyOn(composer, "updateLayers")
        .mockImplementation(() => {});
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) =>
          setTimeout(() => cb(0), 0) as unknown as number,
      );

      composer.scheduleUpdateLayers();
      composer.scheduleUpdateLayers();
      vi.advanceTimersToNextTimer();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("catches updateLayers errors without throwing", () => {
      vi.useFakeTimers();
      const composer = new LayerComposer(makeDeps());
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "x" },
      ];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) =>
          setTimeout(() => cb(0), 0) as unknown as number,
      );
      vi.spyOn(composer, "updateLayers").mockImplementation(() => {
        throw new Error("boom");
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => composer.scheduleUpdateLayers()).not.toThrow();
      vi.advanceTimersToNextTimer();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("updateGridOnly", () => {
    it("returns early and schedules update when no lastCompositeLayers", () => {
      const composer = new LayerComposer(makeDeps());
      const spy = vi
        .spyOn(composer, "scheduleUpdateLayers")
        .mockImplementation(() => {});
      composer.updateGridOnly();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("replaces graticule-lines layer in stack", () => {
      const deps = makeDeps({
        getUiState: () => ({
          visible: true,
          opacity: 1,
          layerMode: "temperature",
          showGrid: true,
          iconographyStyle: "compact",
        }),
      });
      const composer = new LayerComposer(deps);
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "keep" },
        { id: "graticule-lines" },
      ];
      composer.updateGridOnly();
      const layers = (deps.setOverlayProps as ReturnType<typeof vi.fn>).mock
        .calls[0][0].layers as Array<{ id: string }>;
      expect(layers[0].id).toBe("keep");
      expect(layers[1].id).toBe("graticule-lines");
      expect(mockLineLayer).toHaveBeenCalledTimes(1);
    });

    it("calls setOverlayProps with updated layers", () => {
      const deps = makeDeps({
        getUiState: () => ({
          visible: true,
          opacity: 1,
          layerMode: "temperature",
          showGrid: true,
          iconographyStyle: "compact",
        }),
      });
      const composer = new LayerComposer(deps);
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "graticule-lines" },
      ];
      composer.updateGridOnly();
      expect(deps.setOverlayProps).toHaveBeenCalledTimes(1);
    });

    it("uses empty grid data when grid not visible", () => {
      const deps = makeDeps({
        getUiState: () => ({
          visible: true,
          opacity: 1,
          layerMode: "temperature",
          showGrid: false,
          iconographyStyle: "compact",
        }),
      });
      const composer = new LayerComposer(deps);
      (composer as unknown as Record<string, unknown>).lastCompositeLayers = [
        { id: "graticule-lines" },
      ];
      composer.updateGridOnly();
      const lineProps = mockLineLayer.mock.calls[0][0] as {
        data: unknown[];
        visible: boolean;
      };
      expect(lineProps.data).toEqual([]);
      expect(lineProps.visible).toBe(false);
    });
  });

  describe("getGridLinesForStep", () => {
    it("returns grid lines for a given step", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<
        { source: [number, number]; target: [number, number] }[]
      >(composer, "getGridLinesForStep", 8);
      expect(result).toEqual([{ source: [0, 0], target: [1, 1] }]);
    });

    it("caches results for repeated step", () => {
      const composer = new LayerComposer(makeDeps());
      callPrivate(composer, "getGridLinesForStep", 9);
      callPrivate(composer, "getGridLinesForStep", 9);
      expect(mockBuildGraticuleLines).toHaveBeenCalledTimes(1);
    });

    it("recomputes for different step", () => {
      const composer = new LayerComposer(makeDeps());
      callPrivate(composer, "getGridLinesForStep", 9);
      callPrivate(composer, "getGridLinesForStep", 10);
      expect(mockBuildGraticuleLines).toHaveBeenCalledTimes(2);
    });
  });

  describe("buildArrowPointsFromVectorLayer", () => {
    it("returns empty array if no image", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<unknown[]>(
        composer,
        "buildArrowPointsFromVectorLayer",
        makeVectorLayer({ image: null }),
        [-20, 50, -10, 60],
        true,
        2,
        8,
        20,
        "k",
      );
      expect(result).toEqual([]);
    });

    it("returns empty array if image is Promise", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<unknown[]>(
        composer,
        "buildArrowPointsFromVectorLayer",
        makeVectorLayer({ image: Promise.resolve(null) }),
        [-20, 50, -10, 60],
        true,
        2,
        8,
        20,
        "k",
      );
      expect(result).toEqual([]);
    });

    it("returns empty array for invalid bounds span", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<unknown[]>(
        composer,
        "buildArrowPointsFromVectorLayer",
        makeVectorLayer({
          manifest: { bounds: [1, 1, 1, 1], shape: { width: 4, height: 4 } },
        }),
        [1, 1, 1, 1],
        true,
        2,
        8,
        20,
        "k",
      );
      expect(result).toEqual([]);
    });

    it("generates arrow points with position angle and size", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [
          {
            geometry: { coordinates: [-15, 55] },
            properties: { value: 12, direction: 90 },
          },
        ],
      });
      const result = callPrivate<
        Array<{ position: [number, number]; angle: number; size: number }>
      >(
        composer,
        "buildArrowPointsFromVectorLayer",
        makeVectorLayer(),
        [-20, 50, -10, 60],
        true,
        2,
        8,
        20,
        "k",
      );
      expect(result).toHaveLength(1);
      expect(result[0].position).toEqual([-15, 55]);
      expect(Number.isFinite(result[0].angle)).toBe(true);
      expect(result[0].size).toBeGreaterThanOrEqual(8);
    });
  });

  describe("buildWindLines", () => {
    it("returns wind line structures for valid features", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [
          {
            geometry: { coordinates: [0, 0] },
            properties: { value: 10, direction: 90 },
          },
        ],
      });
      const lines = callPrivate<
        Array<{ source: [number, number]; target: [number, number] }>
      >(
        composer,
        "buildWindLines",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [-128, 127],
        [-10, -10, 10, 10],
        10,
      );
      expect(lines).toHaveLength(3);
      expect(lines[0]).toHaveProperty("source");
      expect(lines[0]).toHaveProperty("target");
    });

    it("handles no valid features", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [
          {
            geometry: { coordinates: [0, 0] },
            properties: { value: NaN, direction: NaN },
          },
        ],
      });
      const lines = callPrivate<unknown[]>(
        composer,
        "buildWindLines",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [-128, 127],
        [-10, -10, 10, 10],
        10,
      );
      expect(lines).toEqual([]);
    });
  });

  describe("syncLegendForMode", () => {
    it("updates legend content for temperature mode", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      composer.syncLegendForMode("temperature");
      expect(deps.dom.legendHost.innerHTML).toContain("°C");
    });

    it("pre-renders wave height legend into waveLegendHost on initLegends", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      // Wave legend is rendered as custom HTML in waveLegendHost during initLegends(),
      // not via LegendControl. syncLegendForMode('waves') has nothing to do here.
      expect(deps.dom.waveLegendHost.children.length).toBeGreaterThan(0);
    });

    it("does nothing when legend not initialized", () => {
      const composer = new LayerComposer(makeDeps());
      expect(() => composer.syncLegendForMode("temperature")).not.toThrow();
    });

    it("keeps wind legend host hidden after init", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      expect(deps.dom.windLegendHost.style.display).toBe("none");
    });

    it("keeps precip legend host hidden after init", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
    });
  });

  describe("renderGridLabels / renderWaveLabels", () => {
    it("renderGridLabels clears container first", () => {
      const composer = new LayerComposer(makeDeps());
      const container = document.createElement("div");
      container.innerHTML = "<span>old</span>";
      callPrivate(composer, "renderGridLabels", container, 10, false);
      expect(container.innerHTML).toBe("");
    });

    it("renderGridLabels does not render when not visible", () => {
      const composer = new LayerComposer(makeDeps());
      const container = document.createElement("div");
      callPrivate(composer, "renderGridLabels", container, 10, false);
      expect(container.children.length).toBe(0);
    });

    it("renderGridLabels creates grid label elements when visible", () => {
      const deps = makeDeps({ projectMap: vi.fn(() => ({ x: 12, y: 34 })) });
      const composer = new LayerComposer(deps);
      const container = document.createElement("div");
      callPrivate(composer, "renderGridLabels", container, 10, true);
      expect(container.querySelectorAll(".grid-label").length).toBe(1);
    });

    it("renderWaveLabels clears and does not render when hidden", () => {
      const composer = new LayerComposer(makeDeps());
      const container = document.createElement("div");
      container.innerHTML = "<span>old</span>";
      callPrivate(
        composer,
        "renderWaveLabels",
        container,
        [{ position: [1, 2], text: "8" }],
        false,
      );
      expect(container.children.length).toBe(0);
    });

    it("renderWaveLabels creates wave label elements", () => {
      const deps = makeDeps({ projectMap: vi.fn(() => ({ x: 20, y: 40 })) });
      const composer = new LayerComposer(deps);
      const container = document.createElement("div");
      callPrivate(
        composer,
        "renderWaveLabels",
        container,
        [{ position: [1, 2], text: "8" }],
        true,
      );
      expect(container.querySelectorAll(".wave-label").length).toBe(1);
    });
  });

  describe("rasterizeLandMask", () => {
    it("returns cached mask if available", () => {
      const composer = new LayerComposer(makeDeps());
      const originalCreateElement = document.createElement.bind(document);
      const imageData = {
        data: new Uint8ClampedArray([0, 0, 0, 255]),
        width: 1,
        height: 1,
      };
      const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        getImageData: vi.fn(() => imageData),
      };
      const createSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tagName: string) => {
          if (tagName === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn(() => ctx),
            } as unknown as HTMLCanvasElement;
          }
          return originalCreateElement(tagName);
        });
      const fc = {
        type: "FeatureCollection",
        features: [],
      } as unknown as FeatureCollection;
      const first = callPrivate<Uint8Array>(
        composer,
        "rasterizeLandMask",
        fc,
        1,
        1,
        [-10, -10, 10, 10],
      );
      const second = callPrivate<Uint8Array>(
        composer,
        "rasterizeLandMask",
        fc,
        1,
        1,
        [-10, -10, 10, 10],
      );
      expect(first).toBe(second);
      expect(createSpy).toHaveBeenCalledTimes(1);
      createSpy.mockRestore();
    });

    it("creates mask from feature collection alpha channel", () => {
      const composer = new LayerComposer(makeDeps());
      const originalCreateElement = document.createElement.bind(document);
      const imageData = {
        data: new Uint8ClampedArray([
          0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0,
        ]),
        width: 2,
        height: 2,
      };
      const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        getImageData: vi.fn(() => imageData),
      };
      vi.spyOn(document, "createElement").mockImplementation(
        (tagName: string) => {
          if (tagName === "canvas") {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn(() => ctx),
            } as unknown as HTMLCanvasElement;
          }
          return originalCreateElement(tagName);
        },
      );
      const fc = {
        type: "FeatureCollection",
        features: [],
      } as unknown as FeatureCollection;
      const mask = callPrivate<Uint8Array>(
        composer,
        "rasterizeLandMask",
        fc,
        2,
        2,
        [-10, -10, 10, 10],
      );
      expect(Array.from(mask)).toEqual([1, 0, 1, 0]);
      vi.restoreAllMocks();
    });
  });

  describe("worker scheduling", () => {
    it("scheduleMslpContours posts message to worker", () => {
      const composer = new LayerComposer(makeDeps());
      callPrivate(
        composer,
        "scheduleMslpContours",
        "m1",
        { data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 },
        [-10, -10, 10, 10],
        [1000, 1004],
        2,
      );
      const worker = getPrivate<{ postMessage: ReturnType<typeof vi.fn> }>(
        composer,
        "mslpContourWorker",
      );
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
    });

    it("scheduleMslpContours deduplicates by key", () => {
      const composer = new LayerComposer(makeDeps());
      const args: unknown[] = [
        "m1",
        { data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 },
        [-10, -10, 10, 10],
        [1000, 1004],
        2,
      ];
      callPrivate(composer, "scheduleMslpContours", ...args);
      callPrivate(composer, "scheduleMslpContours", ...args);
      const worker = getPrivate<{ postMessage: ReturnType<typeof vi.fn> }>(
        composer,
        "mslpContourWorker",
      );
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
    });

    it("scheduleWindStreamlines posts to worker", () => {
      const composer = new LayerComposer(makeDeps());
      callPrivate(
        composer,
        "scheduleWindStreamlines",
        "w1",
        makeVectorLayer(),
        2,
        0.25,
      );
      const worker = getPrivate<{ postMessage: ReturnType<typeof vi.fn> }>(
        composer,
        "windStreamlineWorker",
      );
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
      expect(mockDecodeVectorComponents).toHaveBeenCalledTimes(1);
    });

    it("scheduleWindStreamlines skips repost for cached key", () => {
      const composer = new LayerComposer(makeDeps());
      const cache = getPrivate<Map<string, FeatureCollection>>(
        composer,
        "windStreamlineCache",
      );
      cache.set("w1", { type: "FeatureCollection", features: [] });
      callPrivate(
        composer,
        "scheduleWindStreamlines",
        "w1",
        makeVectorLayer(),
        2,
        0.25,
      );
      const worker = getPrivate<{ postMessage: ReturnType<typeof vi.fn> }>(
        composer,
        "windStreamlineWorker",
      );
      expect(worker.postMessage).not.toHaveBeenCalled();
    });

    it("scheduleInhouseContours posts to contour worker", () => {
      const catalog = makeMockCatalogController();
      const composer = new LayerComposer(
        makeDeps({
          getCatalogController: (() =>
            catalog) as unknown as LayerComposerDeps["getCatalogController"],
        }),
      );
      callPrivate(
        composer,
        "scheduleInhouseContours",
        "c1",
        { data: new Float32Array([1, 2]), width: 1, height: 2 },
        [-10, -10, 10, 10],
        [1, 2],
        2,
      );
      const worker = getPrivate<{ postMessage: ReturnType<typeof vi.fn> }>(
        composer,
        "contourWorker",
      );
      expect(worker.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("loadWindData / loadPrecipData", () => {
    it("loadWindData uses cached data when available", async () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      const cache = getPrivate<Map<string, unknown>>(composer, "windCache");
      cache.set("2026-01-01T00:00:00Z", { cached: true });
      await callPrivate<Promise<void>>(
        composer,
        "loadWindData",
        "2026-01-01T00:00:00Z",
      );
      expect(deps.client.loadDatasetData).not.toHaveBeenCalled();
      expect(getPrivate<Record<string, boolean>>(composer, "windData")).toEqual(
        { cached: true },
      );
    });

    it("loadWindData fetches and stores in cache when missing", async () => {
      const deps = makeDeps();
      (
        deps.client.loadDatasetData as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ fresh: true });
      const composer = new LayerComposer(deps);
      await callPrivate<Promise<void>>(
        composer,
        "loadWindData",
        "2026-01-01T03:00:00Z",
      );
      expect(deps.client.loadDatasetData).toHaveBeenCalledTimes(1);
      const cache = getPrivate<Map<string, unknown>>(composer, "windCache");
      expect(cache.has("2026-01-01T03:00:00Z")).toBe(true);
    });

    it("loadPrecipData uses cached data when available", async () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      const cache = getPrivate<Map<string, unknown>>(composer, "precipCache");
      cache.set("2026-01-01T00:00:00Z", { cached: true });
      await callPrivate<Promise<void>>(
        composer,
        "loadPrecipData",
        "2026-01-01T00:00:00Z",
      );
      expect(deps.client.loadDatasetData).not.toHaveBeenCalled();
      expect(
        getPrivate<Record<string, boolean>>(composer, "precipData"),
      ).toEqual({ cached: true });
    });

    it("loadPrecipData fetches and stores in cache when missing", async () => {
      const deps = makeDeps();
      (
        deps.client.loadDatasetData as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ rain: 1 });
      const composer = new LayerComposer(deps);
      await callPrivate<Promise<void>>(
        composer,
        "loadPrecipData",
        "2026-01-01T03:00:00Z",
      );
      expect(deps.client.loadDatasetData).toHaveBeenCalledTimes(1);
      const cache = getPrivate<Map<string, unknown>>(composer, "precipCache");
      expect(cache.has("2026-01-01T03:00:00Z")).toBe(true);
    });

    it("loadPrecipData triggers map restore in precip mode with stable view", async () => {
      vi.useFakeTimers();
      const deps = makeDeps({
        getUiState: () => ({
          visible: true,
          opacity: 1,
          layerMode: "precip",
          showGrid: false,
          iconographyStyle: "compact",
        }),
      });
      const composer = new LayerComposer(deps);
      (composer as unknown as Record<string, unknown>).lastStableView = {
        center: [-20, 55],
        zoom: 4,
        bearing: 0,
        pitch: 0,
      };
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) =>
          setTimeout(() => cb(0), 0) as unknown as number,
      );
      await callPrivate<Promise<void>>(
        composer,
        "loadPrecipData",
        "2026-01-01T03:00:00Z",
      );
      vi.advanceTimersToNextTimer();
      expect(deps.resizeMap).toHaveBeenCalledTimes(1);
      expect(deps.jumpToMap).toHaveBeenCalledTimes(1);
    });
  });

  describe("loadCountryOutlines", () => {
    it("fetches and stores data then schedules update", async () => {
      const composer = new LayerComposer(makeDeps());
      const scheduleSpy = vi
        .spyOn(composer, "scheduleUpdateLayers")
        .mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ type: "FeatureCollection", features: [] }),
        })),
      );

      await composer.loadCountryOutlines();
      expect(getPrivate<unknown>(composer, "countryOutlineData")).toEqual({
        type: "FeatureCollection",
        features: [],
      });
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("handles fetch failure gracefully", async () => {
      const composer = new LayerComposer(makeDeps());
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: false, status: 500 })),
      );
      await composer.loadCountryOutlines();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("sampling functions", () => {
    it("sampleScalarValue returns value from getRasterPoints", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [{ properties: { value: 13.5 } }],
      });
      const value = callPrivate<number | null>(
        composer,
        "sampleScalarValue",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [0, 10],
        [-10, -10, 10, 10],
        [0, 0],
      );
      expect(value).toBe(13.5);
    });

    it("sampleVectorDirection returns direction", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [{ properties: { direction: 270 } }],
      });
      const direction = callPrivate<number | null>(
        composer,
        "sampleVectorDirection",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [0, 10],
        [-10, -10, 10, 10],
        [0, 0],
      );
      expect(direction).toBe(270);
    });

    it("sampleVectorAtPosition returns value and direction pair", () => {
      const composer = new LayerComposer(makeDeps());
      mockGetRasterPoints.mockReturnValue({
        features: [{ properties: { value: 8.2, direction: 180 } }],
      });
      const result = callPrivate<{
        value: number | null;
        direction: number | null;
      }>(
        composer,
        "sampleVectorAtPosition",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [0, 10],
        [-10, -10, 10, 10],
        [0, 0],
      );
      expect(result).toEqual({ value: 8.2, direction: 180 });
    });

    it("scaleUnscale transforms values with factor", () => {
      const composer = new LayerComposer(makeDeps());
      const scaled = callPrivate<[number, number]>(
        composer,
        "scaleUnscale",
        [2, 4],
        3,
      );
      expect(scaled).toEqual([6, 12]);
    });
  });

  describe("updateLayers", () => {
    it("updateLayers returns early when map not ready", () => {
      const deps = makeDeps({ isMapReady: () => false });
      const composer = new LayerComposer(deps);
      composer.updateLayers();
      expect(deps.setOverlayProps).not.toHaveBeenCalled();
    });

    it("in forecast mode composes raster and grid layers", () => {
      const catalog = makeMockCatalogController();
      catalog.inhouseLayers = [
        {
          id: "a",
          model: "gfs",
          analysis: "2026",
          variable: "air_temperature_at_2m_agl",
          image: { data: new Float32Array([1]), width: 1, height: 1 },
          rasterScalar: null,
          manifest: {
            bounds: [-10, -10, 10, 10],
            shape: { width: 1, height: 1 },
            unit: "°C",
          },
          visible: true,
          renderMode: "raster",
        },
      ];
      const deps = makeDeps({
        getCatalogController: (() =>
          catalog) as unknown as LayerComposerDeps["getCatalogController"],
        getUiState: () => ({
          visible: true,
          opacity: 1,
          layerMode: "temperature",
          showGrid: true,
          iconographyStyle: "compact",
        }),
      });
      const composer = new LayerComposer(deps);

      composer.updateLayers();

      expect(deps.setOverlayProps).toHaveBeenCalledTimes(1);
      expect(mockRasterLayer).toHaveBeenCalledTimes(1);
      expect(mockLineLayer).toHaveBeenCalledTimes(1);
      const layers = (deps.setOverlayProps as ReturnType<typeof vi.fn>).mock
        .calls[0][0].layers as Array<{ id: string }>;
      expect(layers.some((l) => l.id === "graticule-lines")).toBe(true);
    });

    it("updateLayers updates lastCompositeLayers state", () => {
      const catalog = makeMockCatalogController();
      catalog.inhouseLayers = [];
      const deps = makeDeps({
        getCatalogController: (() =>
          catalog) as unknown as LayerComposerDeps["getCatalogController"],
      });
      const composer = new LayerComposer(deps);
      composer.updateLayers();
      const layers = getPrivate<unknown[]>(composer, "lastCompositeLayers");
      expect(Array.isArray(layers)).toBe(true);
      expect(layers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getters and setters", () => {
    it("palette and unitFormat return initial values", () => {
      const composer = new LayerComposer(makeDeps());
      expect(composer.palette).toEqual([]);
      expect(composer.unitFormat).toBeNull();
    });

    it("windPalette and windUnitFormat return initial values", () => {
      const composer = new LayerComposer(makeDeps());
      expect(composer.windPalette).toEqual([]);
      expect(composer.windUnitFormat).toBeNull();
    });

    it("temperatureScaleC returns static palette", () => {
      const composer = new LayerComposer(makeDeps());
      expect(Array.isArray(composer.temperatureScaleC)).toBe(true);
      expect(composer.temperatureScaleC.length).toBeGreaterThan(1);
    });

    it("setZooming updates isZooming", () => {
      const composer = new LayerComposer(makeDeps());
      composer.setZooming(true);
      expect(getPrivate<boolean>(composer, "isZooming")).toBe(true);
    });

    it("setLastStableView updates lastStableView", () => {
      const composer = new LayerComposer(makeDeps());
      const view = { center: [-20, 55], zoom: 4, bearing: 0, pitch: 0 };
      composer.setLastStableView(view);
      expect(
        getPrivate<Record<string, unknown>>(composer, "lastStableView"),
      ).toEqual(view);
    });

    it("setGridLabelsDirty updates dirty flag", () => {
      const composer = new LayerComposer(makeDeps());
      composer.setGridLabelsDirty(false);
      expect(getPrivate<boolean>(composer, "gridLabelsDirty")).toBe(false);
    });
  });

  describe("initLegends", () => {
    it("renders legend content into hosts", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      expect(deps.dom.legendHost.children.length).toBeGreaterThan(0);
      expect(deps.dom.windLegendHost.children.length).toBeGreaterThan(0);
      expect(deps.dom.precipLegendHost.children.length).toBeGreaterThan(0);
    });

    it("sets initial visibility for wind and precip legends", () => {
      const deps = makeDeps();
      const composer = new LayerComposer(deps);
      composer.initLegends();
      expect(deps.dom.windLegendHost.style.display).toBe("none");
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
    });

    it("does not recreate legends when hosts already populated", () => {
      const deps = makeDeps();
      deps.dom.legendHost.appendChild(document.createElement("div"));
      deps.dom.windLegendHost.appendChild(document.createElement("div"));
      deps.dom.precipLegendHost.appendChild(document.createElement("div"));
      const composer = new LayerComposer(deps);
      composer.initLegends();
      expect(mockLegendControl).not.toHaveBeenCalled();
    });
  });

  describe("getInhouseContourIntervals", () => {
    it("returns configured intervals from metadata", () => {
      const catalog = makeMockCatalogController();
      catalog.inhouseVariableMeta["mslp"] = {
        contourInterval: 2,
        majorInterval: 10,
      };
      const composer = new LayerComposer(
        makeDeps({
          getCatalogController: (() =>
            catalog) as unknown as LayerComposerDeps["getCatalogController"],
        }),
      );
      const result = callPrivate<{ interval: number; majorInterval: number }>(
        composer,
        "getInhouseContourIntervals",
        { variable: "mslp" },
      );
      expect(result).toEqual({ interval: 2, majorInterval: 10 });
    });

    it("returns pressure defaults for MSLP-like variable", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<{ interval: number; majorInterval: number }>(
        composer,
        "getInhouseContourIntervals",
        { variable: "pressure_mean_sea_level" },
      );
      expect(result).toEqual({ interval: 4, majorInterval: 20 });
    });

    it("returns temperature defaults for temperature variable", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<{ interval: number; majorInterval: number }>(
        composer,
        "getInhouseContourIntervals",
        { variable: "air_temperature_at_2m" },
      );
      expect(result).toEqual({ interval: 5, majorInterval: 10 });
    });

    it("returns generic default for unknown variable", () => {
      const composer = new LayerComposer(makeDeps());
      const result = callPrivate<{ interval: number; majorInterval: number }>(
        composer,
        "getInhouseContourIntervals",
        { variable: "significant_wave_height" },
      );
      expect(result).toEqual({ interval: 10, majorInterval: 20 });
    });
  });

  describe("renderPrecipLegend", () => {
    it("creates precip legend DOM elements", () => {
      const composer = new LayerComposer(makeDeps());
      const host = document.createElement("div");
      callPrivate(composer, "renderPrecipLegend", host);
      expect(host.querySelector(".precip-legend")).not.toBeNull();
      expect(
        host.querySelector(".precip-legend__title")?.textContent,
      ).toContain("mm/hr");
    });

    it("renders gradient bar and multiple tick labels", () => {
      const composer = new LayerComposer(makeDeps());
      const host = document.createElement("div");
      callPrivate(composer, "renderPrecipLegend", host);
      const bar = host.querySelector(
        ".precip-legend__bar",
      ) as HTMLDivElement | null;
      expect(bar?.getAttribute("style")).toContain("linear-gradient");
      expect(
        host.querySelectorAll(".precip-legend__label").length,
      ).toBeGreaterThan(2);
    });
  });

  describe("buildWavePeriodLabels", () => {
    it("returns labels based on scalar scans", () => {
      const composer = new LayerComposer(makeDeps());
      const sampleSpy = vi
        .spyOn(
          composer as unknown as {
            sampleScalarValue: (...args: unknown[]) => number | null;
          },
          "sampleScalarValue",
        )
        .mockReturnValue(6);
      const labels = callPrivate<
        Array<{ position: [number, number]; text: string }>
      >(
        composer,
        "buildWavePeriodLabels",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [0, 10],
        [-2, -2, 2, 2],
        2,
      );
      expect(labels.length).toBeGreaterThan(0);
      expect(labels[0].text).toBe("6");
      expect(sampleSpy).toHaveBeenCalled();
    });

    it("filters out odd and low values", () => {
      const composer = new LayerComposer(makeDeps());
      vi.spyOn(
        composer as unknown as {
          sampleScalarValue: (...args: unknown[]) => number | null;
        },
        "sampleScalarValue",
      ).mockReturnValue(3);
      const labels = callPrivate<
        Array<{ position: [number, number]; text: string }>
      >(
        composer,
        "buildWavePeriodLabels",
        { data: new Float32Array([1]), width: 1, height: 1 },
        [0, 10],
        [-2, -2, 2, 2],
        2,
      );
      expect(labels).toEqual([]);
    });
  });
});
