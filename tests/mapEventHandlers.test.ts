import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachMapEventHandlers,
  type MapEventDeps,
} from "../src/lib/mapEventHandlers";
import { whenStyleLoads } from "../src/lib/mapStartup";

/** Lets promise callbacks that are already due run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
  /** The deps the start touches, with a forecast load the test finishes. */
  function startupDeps(styleLoaded: Promise<void>) {
    let finishWeather!: () => void;
    const weatherReady = new Promise<void>((resolve) => {
      finishWeather = resolve;
    });
    const initWeather = vi.fn(() => weatherReady);
    const setMapReady = vi.fn();
    const onStyleReady = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const deps = {
      getOverlay: () => ({}),
      getCatalogController: () => ({ hideInhouseTooltip: vi.fn() }),
      getTooltipController: () => ({ clearAllAddons: vi.fn() }),
      onStyleReady,
      styleLoaded,
      setMapReady,
      initWeather,
      scheduleUpdateLayers: vi.fn(),
      schedulePersistState: vi.fn(),
    } as unknown as MapEventDeps;
    return { deps, initWeather, setMapReady, onStyleReady, finishWeather };
  }

  it("starts once when the style loads, and waits for forecast data", async () => {
    const { map, emit } = createMap(false);
    const { deps, initWeather, setMapReady, finishWeather } = startupDeps(
      whenStyleLoads(map as never),
    );

    document.body.classList.add("is-loading");
    attachMapEventHandlers(map as never, deps);
    await settle();
    // Nothing starts before the style is in.
    expect(initWeather).not.toHaveBeenCalled();

    emit("style.load");
    await settle();
    expect(initWeather).toHaveBeenCalledTimes(1);
    expect(map.addControl).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains("is-loading")).toBe(true);

    finishWeather();
    await vi.waitFor(() =>
      expect(document.body.classList.contains("is-loading")).toBe(false),
    );
    expect(setMapReady).toHaveBeenCalledTimes(1);
  });

  it("starts when the style loaded before the controllers attached", async () => {
    // The controllers' scripts can arrive after the basemap: the style has
    // loaded, MapLibre has fired `load`, and the map is loading tiles again
    // (the reader is moving it), so map.loaded() is false.
    const { map, emit } = createMap(false);
    const styleLoaded = whenStyleLoads(map as never);
    emit("style.load");
    emit("load");

    const { deps, initWeather, onStyleReady } = startupDeps(styleLoaded);
    attachMapEventHandlers(map as never, deps);
    await settle();

    expect(initWeather).toHaveBeenCalledTimes(1);
    expect(onStyleReady).toHaveBeenCalledTimes(1);
  });

  it("doesn't wait for MapLibre's load, which a stalled basemap request holds back", async () => {
    const { map, emit } = createMap(false);
    const { deps, initWeather } = startupDeps(whenStyleLoads(map as never));
    attachMapEventHandlers(map as never, deps);

    // The style is in; a tile never answers, so `load` never comes.
    emit("style.load");
    await settle();
    expect(initWeather).toHaveBeenCalledTimes(1);

    // And a `load` that does come later starts nothing a second time.
    emit("load");
    await settle();
    expect(initWeather).toHaveBeenCalledTimes(1);
  });
});

describe("attachMapEventHandlers when the start ends", () => {
  function setup(
    initWeather: () => Promise<boolean | void>,
    overlay: () => unknown,
  ) {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { map } = createMap(false);
    const onStartFinished = vi.fn();
    const deps = {
      getOverlay: overlay,
      getCatalogController: () => ({ hideInhouseTooltip: vi.fn() }),
      getTooltipController: () => ({ clearAllAddons: vi.fn() }),
      styleLoaded: Promise.resolve(),
      onStartFinished,
      setMapReady: vi.fn(),
      initWeather,
    } as unknown as MapEventDeps;
    document.body.classList.add("is-loading");
    attachMapEventHandlers(map as never, deps);
    return { onStartFinished };
  }

  it("reports a start that ended with the forecast in", async () => {
    const { onStartFinished } = setup(async () => {}, () => ({}));
    await vi.waitFor(() =>
      expect(onStartFinished).toHaveBeenCalledWith("forecast"),
    );
    expect(document.body.classList.contains("is-loading")).toBe(false);
  });

  it("reports a start that ended with its own error on screen", async () => {
    // What ForecastStart.start resolves with when it has shown its Retry.
    const { onStartFinished } = setup(async () => false, () => ({}));
    await vi.waitFor(() => expect(onStartFinished).toHaveBeenCalledWith("error"));
    expect(document.body.classList.contains("is-loading")).toBe(false);
  });

  it("ends the loading state and reports a failure when the forecast load throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { onStartFinished } = setup(
      async () => {
        throw new Error("boom");
      },
      () => ({}),
    );
    await vi.waitFor(() =>
      expect(onStartFinished).toHaveBeenCalledWith("failed"),
    );
    expect(document.body.classList.contains("is-loading")).toBe(false);
  });

  it("does the same when a step before the forecast load throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const initWeather = vi.fn(async () => {});
    const { onStartFinished } = setup(initWeather, () => {
      throw new Error("no WebGL for the overlay");
    });
    await vi.waitFor(() =>
      expect(onStartFinished).toHaveBeenCalledWith("failed"),
    );
    expect(initWeather).not.toHaveBeenCalled();
    expect(document.body.classList.contains("is-loading")).toBe(false);
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
      styleLoaded: new Promise<void>(() => {}),
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
      styleLoaded: new Promise<void>(() => {}),
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
