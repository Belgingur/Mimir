import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OUTLINE_FALLBACK_STYLE,
  STALL_QUIET_MS,
  watchForQuiet,
  watchMapStartup,
  whenStyleLoads,
} from "../src/lib/mapStartup";

/** A stand-in for MapLibre's event surface, with a way to fire. */
function stubMap() {
  const listeners = new Map<string, Array<(value?: unknown) => void>>();
  const add = (type: string, listener: (value?: unknown) => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };
  return {
    on: vi.fn(add),
    once: vi.fn(add),
    setStyle: vi.fn(),
    fire(type: string, value?: unknown) {
      for (const listener of listeners.get(type) ?? []) listener(value);
    },
  };
}

/** A progress source the test drives: tick() is "a request finished". */
function stubProgress() {
  let report: (() => void) | null = null;
  const stopped = vi.fn();
  return {
    source: (onProgress: () => void) => {
      report = onProgress;
      return stopped;
    },
    tick: () => report?.(),
    stopped,
  };
}

const settle = () => Promise.resolve();

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("whenStyleLoads", () => {
  it("resolves on style.load, not before and not on load", async () => {
    const map = stubMap();
    const resolved = vi.fn();
    void whenStyleLoads(map as never).then(resolved);

    await settle();
    expect(resolved).not.toHaveBeenCalled();
    map.fire("load");
    await settle();
    expect(resolved).not.toHaveBeenCalled();

    map.fire("style.load");
    await settle();
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it("still answers a caller that asks after the event", async () => {
    const map = stubMap();
    const styleLoaded = whenStyleLoads(map as never);
    map.fire("style.load");
    await settle();

    const late = vi.fn();
    void styleLoaded.then(late);
    await settle();
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe("watchForQuiet", () => {
  it("reports when nothing has finished for the quiet period, and again after the next", () => {
    const progress = stubProgress();
    const onQuiet = vi.fn();
    watchForQuiet({ quietMs: 1000, onQuiet, progress: progress.source });

    vi.advanceTimersByTime(999);
    expect(onQuiet).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onQuiet).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(onQuiet).toHaveBeenCalledTimes(2);
  });

  it("counts from the last request that finished, however long the load takes", () => {
    const progress = stubProgress();
    const onQuiet = vi.fn();
    watchForQuiet({ quietMs: 1000, onQuiet, progress: progress.source });

    // A slow load that keeps delivering: ten times the quiet period in all.
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(500);
      progress.tick();
    }
    expect(onQuiet).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onQuiet).toHaveBeenCalledTimes(1);
  });

  it("says nothing while the tab is hidden", () => {
    const progress = stubProgress();
    const onQuiet = vi.fn();
    let hidden = true;
    watchForQuiet({
      quietMs: 1000,
      onQuiet,
      progress: progress.source,
      isHidden: () => hidden,
    });
    vi.advanceTimersByTime(5000);
    expect(onQuiet).not.toHaveBeenCalled();

    hidden = false;
    vi.advanceTimersByTime(1000);
    expect(onQuiet).toHaveBeenCalledTimes(1);
  });

  it("stops: no more reports, and the progress source is released", () => {
    const progress = stubProgress();
    const onQuiet = vi.fn();
    const stop = watchForQuiet({
      quietMs: 1000,
      onQuiet,
      progress: progress.source,
    });
    stop();
    vi.advanceTimersByTime(5000);
    expect(onQuiet).not.toHaveBeenCalled();
    expect(progress.stopped).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("watchMapStartup: the fallback style", () => {
  function setup() {
    const map = stubMap();
    const progress = stubProgress();
    const startup = watchMapStartup(map as never, {
      progress: progress.source,
      isHidden: () => false,
    });
    return { map, progress, startup };
  }

  it("is outline-only: no symbols, glyphs or sprite to fail in their turn", () => {
    expect(
      OUTLINE_FALLBACK_STYLE.layers.every(
        (layer) => layer.type === "background" || layer.type === "line",
      ),
    ).toBe(true);
    expect(OUTLINE_FALLBACK_STYLE.glyphs).toBeUndefined();
    expect(OUTLINE_FALLBACK_STYLE.sprite).toBeUndefined();
  });

  it("takes over when the style fails, even before any controller exists", () => {
    const { map } = setup();
    map.fire("error", { error: { message: "Failed to fetch style.json" } });
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.setStyle).toHaveBeenCalledWith(OUTLINE_FALLBACK_STYLE);

    // A second error (the same failure reported twice) changes nothing more.
    map.fire("error", { error: { message: "again" } });
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });

  it("takes over when the style never answers and nothing else is loading", () => {
    const { map, progress } = setup();
    // Other requests finish for a while (scripts, the catalog)…
    vi.advanceTimersByTime(STALL_QUIET_MS - 1);
    progress.tick();
    vi.advanceTimersByTime(STALL_QUIET_MS - 1);
    expect(map.setStyle).not.toHaveBeenCalled();
    // …and then nothing does for the whole quiet period.
    vi.advanceTimersByTime(1);
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.setStyle).toHaveBeenCalledWith(OUTLINE_FALLBACK_STYLE);

    // Once only, however long it stays quiet.
    vi.advanceTimersByTime(STALL_QUIET_MS * 3);
    expect(map.setStyle).toHaveBeenCalledTimes(1);
  });

  it("leaves a style that loaded alone: later errors and quiet don't replace it", () => {
    const { map } = setup();
    map.fire("style.load");
    map.fire("error", { error: { message: "missing optional sprite" } });
    vi.advanceTimersByTime(STALL_QUIET_MS * 3);
    expect(map.setStyle).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("takes over when the style's tile source can't load, while the basemap is first drawn", () => {
    const { map } = setup();
    map.fire("style.load");
    // The tile manifest failed: the error names the source and no tile.
    map.fire("error", {
      error: { message: "Failed to fetch tiles.json" },
      sourceId: "openmaptiles",
    });
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.setStyle).toHaveBeenCalledWith(OUTLINE_FALLBACK_STYLE);
  });

  it("doesn't give up the style for one failed tile, or a failed sprite", () => {
    const { map } = setup();
    map.fire("style.load");
    map.fire("error", {
      error: { message: "Failed to fetch a tile" },
      sourceId: "openmaptiles",
      tile: {},
    });
    map.fire("error", { error: { message: "Failed to fetch sprite.json" } });
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it("leaves the basemap alone once it has been drawn, whatever fails later", () => {
    const { map } = setup();
    map.fire("style.load");
    map.fire("load");
    map.fire("error", {
      error: { message: "a source added later failed" },
      sourceId: "some-later-source",
    });
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it("resolves styleLoaded when the fallback loads in the failed style's place", async () => {
    const { map, startup } = setup();
    const resolved = vi.fn();
    void startup.styleLoaded.then(resolved);

    map.fire("error", { error: { message: "Failed to fetch style.json" } });
    await settle();
    expect(resolved).not.toHaveBeenCalled();

    // MapLibre fires style.load for the style set with setStyle().
    map.fire("style.load");
    await settle();
    expect(resolved).toHaveBeenCalledTimes(1);
  });
});
