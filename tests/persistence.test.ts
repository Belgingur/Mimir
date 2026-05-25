import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadPersistedState,
  savePersistedState,
  createPersistScheduler,
} from "../src/lib/persistence";
import type { PersistedStateV1 } from "../src/lib/viewerTypes";

const STORAGE_KEY = "wl-viewer-state-v1";

const validState: PersistedStateV1 = {
  version: 1,
  modelId: "gfs-1",
  layerMode: "temperature",
  analysisId: "2026-03-04_00",
  timeIndex: 5,
  opacity: 1,
  visible: true,
  mapCamera: { center: [-20, 55], zoom: 3.2, bearing: 0, pitch: 0 },
};

beforeEach(() => {
  localStorage.clear();
});

describe("loadPersistedState", () => {
  it("returns null when storage is empty", () => {
    expect(loadPersistedState()).toBeNull();
  });

  it("returns parsed state for valid v1 data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validState));
    expect(loadPersistedState()).toEqual(validState);
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{bad json");
    expect(loadPersistedState()).toBeNull();
  });

  it("returns null for wrong version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...validState, version: 2 }),
    );
    expect(loadPersistedState()).toBeNull();
  });

  it("returns null for null value", () => {
    localStorage.setItem(STORAGE_KEY, "null");
    expect(loadPersistedState()).toBeNull();
  });
});

describe("savePersistedState", () => {
  it("writes state to localStorage", () => {
    savePersistedState(validState);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw!)).toEqual(validState);
  });

  it("does not throw when localStorage throws", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => savePersistedState(validState)).not.toThrow();
    spy.mockRestore();
  });
});

describe("createPersistScheduler", () => {
  it("calls gatherState after debounce and writes to localStorage", () => {
    vi.useFakeTimers();
    const gather = vi.fn(() => validState);
    const schedule = createPersistScheduler(gather);

    schedule();
    expect(gather).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(gather).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(validState);

    vi.useRealTimers();
  });

  it("deduplicates multiple calls within debounce window", () => {
    vi.useFakeTimers();
    const gather = vi.fn(() => validState);
    const schedule = createPersistScheduler(gather);

    schedule();
    schedule();
    schedule();
    vi.advanceTimersByTime(200);
    expect(gather).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it("allows re-scheduling after debounce completes", () => {
    vi.useFakeTimers();
    const gather = vi.fn(() => validState);
    const schedule = createPersistScheduler(gather);

    schedule();
    vi.advanceTimersByTime(200);
    expect(gather).toHaveBeenCalledOnce();

    schedule();
    vi.advanceTimersByTime(200);
    expect(gather).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
