import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachMapEventHandlers,
  OUTLINE_FALLBACK_STYLE,
  type MapEventDeps,
} from "../src/lib/mapEventHandlers";

function createMap(loaded: boolean) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const canvas = document.createElement("canvas");
  const container = document.createElement("div");
  const canvasContainer = document.createElement("div");

  const addListener = (
    event: string,
    callback: (...args: unknown[]) => void,
  ) => {
    listeners.set(event, [...(listeners.get(event) ?? []), callback]);
  };

  const map = {
    on: vi.fn(
      (event: string, callback: (...args: unknown[]) => void) => {
        addListener(event, callback);
        return map;
      },
    ),
    once: vi.fn(
      (event: string, callback: (...args: unknown[]) => void) => {
        addListener(event, callback);
        return map;
      },
    ),
    loaded: vi.fn(() => loaded),
    addControl: vi.fn(),
    jumpTo: vi.fn(),
    setStyle: vi.fn(),
    getCanvas: () => canvas,
    getContainer: () => container,
    getCanvasContainer: () => canvasContainer,
    getCenter: () => ({ lng: -19, lat: 65 }),
    getZoom: () => 5,
    getBearing: () => 0,
    getPitch: () => 0,
  };

  return {
    map,
    emit(event: string, value?: unknown) {
      for (const callback of listeners.get(event) ?? []) callback(value);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.className = "";
});

describe("attachMapEventHandlers startup", () => {
  it("initialises exactly once after deferred attachment and waits for forecast data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { map, emit } = createMap(true);
    let finishWeather!: () => void;
    const weatherReady = new Promise<void>((resolve) => {
      finishWeather = resolve;
    });
    const initWeather = vi.fn(() => weatherReady);
    const setMapReady = vi.fn();

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const layerComposer = {
      setLastStableView: vi.fn(),
      setGridLabelsDirty: vi.fn(),
      scheduleLabelRender: vi.fn(),
      setZooming: vi.fn(),
      updateGridOnly: vi.fn(),
    };
    const deps = {
      getOverlay: () => ({}),
      getLayerComposer: () => layerComposer,
      getCatalogController: () => ({
        hideInhouseTooltip: vi.fn(),
        getActiveInhouseContourLayer: () => null,
        inhouseSelectedModel: "gfs-1",
      }),
      getLayerGroupController: () => ({ viewMode: "forecast" }),
      getTooltipController: () => ({
        clearAllAddons: vi.fn(),
        tooltipControl: null,
      }),
      getIconographyController: () => undefined,
      getWavegramController: () => ({ isOpen: false }),
      getUiState: () => ({
        layerMode: "temperature",
        visible: true,
        opacity: 1,
        showGrid: false,
      }),
      getPersistedState: () => ({
        version: 1,
        mapCamera: {
          center: [-19, 65] as [number, number],
          zoom: 5,
          bearing: 0,
          pitch: 0,
        },
      }),
      setMapReady,
      initWeather,
      scheduleUpdateLayers: vi.fn(),
      schedulePersistState: vi.fn(),
    } as unknown as MapEventDeps;

    document.body.classList.add("is-loading");
    attachMapEventHandlers(map as never, deps);
    emit("load");

    expect(initWeather).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains("is-loading")).toBe(true);
    emit("error", { error: { message: "missing optional sprite" } });
    expect(map.setStyle).not.toHaveBeenCalled();

    finishWeather();
    await vi.waitFor(() =>
      expect(document.body.classList.contains("is-loading")).toBe(false),
    );
    expect(setMapReady).toHaveBeenCalledTimes(1);
  });

  it("uses a neutral outline-only style for initial style failures", () => {
    expect(
      OUTLINE_FALLBACK_STYLE.layers.every(
        (layer) => layer.type === "background" || layer.type === "line",
      ),
    ).toBe(true);
    expect(
      OUTLINE_FALLBACK_STYLE.layers.some((layer) => layer.type === "symbol"),
    ).toBe(false);
    expect(OUTLINE_FALLBACK_STYLE.glyphs).toBeUndefined();
    expect(OUTLINE_FALLBACK_STYLE.sprite).toBeUndefined();
  });
});

describe("attachMapEventHandlers on styledata", () => {
  function setup() {
    vi.useFakeTimers();
    const { map, emit } = createMap(false);
    // Stands for the layers Mímir adds to the style: what onStyleReady does.
    const addedDuringEvent: boolean[] = [];
    let inStyledataEvent = false;
    const onStyleReady = vi.fn(() => addedDuringEvent.push(inStyledataEvent));
    const onStyleData = vi.fn();
    const deps = {
      onStyleReady,
      onStyleData,
      getCatalogController: () => ({ hideInhouseTooltip: vi.fn() }),
      getTooltipController: () => ({ clearAllAddons: vi.fn() }),
      setMapReady: vi.fn(),
      initWeather: vi.fn(() => Promise.resolve()),
    } as unknown as MapEventDeps;
    attachMapEventHandlers(map as never, deps);
    // MapLibre fires styledata mid-frame; the frame goes on once it returns.
    const fireStyledata = () => {
      inStyledataEvent = true;
      emit("styledata");
      inStyledataEvent = false;
    };
    return { onStyleReady, onStyleData, addedDuringEvent, fireStyledata };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds Mímir's layers after the event, never inside it", () => {
    const { onStyleReady, addedDuringEvent, fireStyledata } = setup();
    fireStyledata();
    // Still inside the frame that fired the event: nothing added yet.
    expect(onStyleReady).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(onStyleReady).toHaveBeenCalledTimes(1);
    expect(addedDuringEvent).toEqual([false]);
  });

  it("tells onStyleData inside each event, before anything is re-applied", () => {
    const { onStyleReady, onStyleData, fireStyledata } = setup();
    fireStyledata();
    fireStyledata();
    // Every event, at once: it is where a lost anchor is let go of in time.
    expect(onStyleData).toHaveBeenCalledTimes(2);
    expect(onStyleReady).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(onStyleData.mock.invocationCallOrder[1]).toBeLessThan(
      onStyleReady.mock.invocationCallOrder[0],
    );
  });

  it("re-applies once for the events of one frame, and again for a later one", () => {
    const { onStyleReady, fireStyledata } = setup();
    fireStyledata();
    fireStyledata();
    fireStyledata();
    vi.runAllTimers();
    expect(onStyleReady).toHaveBeenCalledTimes(1);

    fireStyledata();
    vi.runAllTimers();
    expect(onStyleReady).toHaveBeenCalledTimes(2);
  });
});

describe("attachMapEventHandlers hover while the meteogram is open", () => {
  function setup(meteogramOpen: () => boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { map, emit } = createMap(false);
    (map as unknown as { getStyle: () => unknown }).getStyle = () => ({
      layers: [],
    });
    const contourLayer = { manifest: { bounds: [-30, 60, -10, 70] } };
    const catalog = {
      hideInhouseTooltip: vi.fn(),
      getActiveInhouseContourLayer: () => contourLayer,
      scheduleInhouseContourHover: vi.fn(),
      inhouseSelectedModel: "gfs-1",
    };
    const deps = {
      getOverlay: () => ({}),
      getLayerComposer: () => ({}),
      getCatalogController: () => catalog,
      getLayerGroupController: () => ({ viewMode: "forecast" }),
      getTooltipController: () => ({
        clearAllAddons: vi.fn(),
        tooltipControl: null,
      }),
      getIconographyController: () => undefined,
      getWavegramController: () => ({ isOpen: false }),
      getMeteogramController: () => ({
        get isOpen() {
          return meteogramOpen();
        },
        cancelPendingClick: vi.fn(),
      }),
      getUiState: () => ({ layerMode: "temperature" }),
      getPersistedState: () => null,
      setMapReady: vi.fn(),
      initWeather: vi.fn(() => Promise.resolve()),
      scheduleUpdateLayers: vi.fn(),
      schedulePersistState: vi.fn(),
    } as unknown as MapEventDeps;
    attachMapEventHandlers(map as never, deps);
    const move = () =>
      emit("mousemove", {
        point: { x: 10, y: 20 },
        lngLat: { lng: -20, lat: 64 },
      });
    return { catalog, move };
  }

  it("shows no contour value while the meteogram's pin is the only value", () => {
    const { catalog, move } = setup(() => true);
    move();
    expect(catalog.scheduleInhouseContourHover).not.toHaveBeenCalled();
    expect(catalog.hideInhouseTooltip).toHaveBeenCalled();
  });

  it("shows the contour value on hover as before once it is closed", () => {
    const { catalog, move } = setup(() => false);
    move();
    expect(catalog.scheduleInhouseContourHover).toHaveBeenCalledTimes(1);
  });
});
