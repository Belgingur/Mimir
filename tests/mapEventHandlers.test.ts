import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachMapEventHandlers,
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
    const { map, emit } = createMap(true);
    let finishWeather!: () => void;
    const weatherReady = new Promise<void>((resolve) => {
      finishWeather = resolve;
    });
    const initWeather = vi.fn(() => weatherReady);
    const loadCountryOutlines = vi.fn().mockResolvedValue(undefined);
    const setMapReady = vi.fn();
    let idleWork: (() => void) | null = null;

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal(
      "requestIdleCallback",
      (callback: () => void) => {
        idleWork = callback;
        return 1;
      },
    );

    const layerComposer = {
      loadCountryOutlines,
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
    expect(loadCountryOutlines).not.toHaveBeenCalled();

    finishWeather();
    await vi.waitFor(() =>
      expect(document.body.classList.contains("is-loading")).toBe(false),
    );
    expect(setMapReady).toHaveBeenCalledTimes(1);
    expect(loadCountryOutlines).not.toHaveBeenCalled();

    expect(idleWork).not.toBeNull();
    (idleWork as unknown as () => void)();
    expect(loadCountryOutlines).toHaveBeenCalledTimes(1);
  });
});
