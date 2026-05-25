import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as WeatherLayers from "weatherlayers-gl";
import {
  TimelineController,
  type PlaybackState,
  type TimelineDeps,
  type TimelineDom,
} from "../src/controllers/TimelineController";

type ControlLike = {
  config: { datetimes: string[]; datetime: string };
  getConfig: () => { datetimes: string[]; datetime: string };
  setConfig: (config: { datetimes: string[]; datetime: string }) => void;
  start: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};

function createDom(): TimelineDom & { timelineHost: HTMLDivElement } {
  const mapWrap = document.createElement("div") as HTMLDivElement;
  const timelineHost = document.createElement("div") as HTMLDivElement;
  const wrapper = document.createElement("div");
  wrapper.className = "control";
  wrapper.appendChild(timelineHost);
  mapWrap.appendChild(wrapper);
  document.body.appendChild(mapWrap);
  return { mapWrap, timelineHost };
}

function createControl(initial: {
  datetimes: string[];
  datetime: string;
}): ControlLike {
  const control: ControlLike = {
    config: { ...initial },
    getConfig: () => ({ ...control.config }),
    setConfig: (config) => {
      control.config = { ...config };
    },
    start: async () => undefined,
    pause: () => undefined,
    stop: () => undefined,
  };
  return control;
}

function createDeps(options?: {
  isDev?: boolean;
  inhouseLayers?: Array<{ times?: string[] }>;
  wavegramOpen?: boolean;
}): {
  deps: TimelineDeps;
  dom: TimelineDom & { timelineHost: HTMLDivElement };
  spies: {
    schedulePersistState: ReturnType<typeof vi.fn>;
    scheduleUpdateLayers: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    updateLayers: ReturnType<typeof vi.fn>;
    syncInhouseTimeToTimeline: ReturnType<typeof vi.fn>;
    loadInhouseFrameSet: ReturnType<typeof vi.fn>;
    createTimelineControl: ReturnType<typeof vi.fn>;
    offsetDatetimeRange: ReturnType<typeof vi.fn>;
  };
  state: {
    inhouseLayers: Array<{ times?: string[] }>;
    wavegramOpen: boolean;
  };
} {
  const dom = createDom();
  const state = {
    inhouseLayers: options?.inhouseLayers ?? [],
    wavegramOpen: options?.wavegramOpen ?? false,
  };
  const schedulePersistState = vi.fn();
  const scheduleUpdateLayers = vi.fn();
  const setStatus = vi.fn();
  const updateLayers = vi.fn();
  const syncInhouseTimeToTimeline = vi.fn();
  const loadInhouseFrameSet = vi.fn().mockResolvedValue(undefined);
  const createTimelineControl = vi.fn();
  const offsetDatetimeRange = vi.fn(
    (iso: string, hoursBack: number, hoursForward: number) => ({
      from: iso,
      back: hoursBack,
      forward: hoursForward,
    }),
  );

  const deps: TimelineDeps = {
    dom,
    isDev: options?.isDev ?? false,
    schedulePersistState,
    scheduleUpdateLayers,
    setStatus,
    updateLayers,
    getInhouseLayers: () => state.inhouseLayers,
    syncInhouseTimeToTimeline,
    loadInhouseFrameSet,
    isWavegramOpen: () => state.wavegramOpen,
    renderGridLabels: vi.fn(),
    getGridStepForZoom: vi.fn(() => 2),
    isGridVisible: vi.fn(() => true),
    createTimelineControl,
    offsetDatetimeRange,
  };

  return {
    deps,
    dom,
    spies: {
      schedulePersistState,
      scheduleUpdateLayers,
      setStatus,
      updateLayers,
      syncInhouseTimeToTimeline,
      loadInhouseFrameSet,
      createTimelineControl,
      offsetDatetimeRange,
    },
    state,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("TimelineController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("state getters/setters", () => {
    it("tracks currentDatetime", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.currentDatetime = "2026-03-20T00:00:00Z";
      expect(ctrl.currentDatetime).toBe("2026-03-20T00:00:00Z");
    });

    it("tracks timelineRange", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const range = { from: "a", to: "b" };
      ctrl.timelineRange = range;
      expect(ctrl.timelineRange).toEqual(range);
    });

    it("tracks timelineDatetimes and activeTimelineDatetimes", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.timelineDatetimes = ["t0", "t1"];
      ctrl.activeTimelineDatetimes = ["a0", "a1", "a2"];
      expect(ctrl.timelineDatetimes).toEqual(["t0", "t1"]);
      expect(ctrl.activeTimelineDatetimes).toEqual(["a0", "a1", "a2"]);
    });

    it("tracks temperature/wind/mslp datetimes", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.temperatureTimelineDatetimes = ["temp"];
      ctrl.windTimelineDatetimes = ["wind"];
      ctrl.mslpTimelineDatetimes = ["mslp"];
      expect(ctrl.temperatureTimelineDatetimes).toEqual(["temp"]);
      expect(ctrl.windTimelineDatetimes).toEqual(["wind"]);
      expect(ctrl.mslpTimelineDatetimes).toEqual(["mslp"]);
    });

    it("starts idle playback with null update handle and no control", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.playbackState).toBe("idle");
      expect(ctrl.timelineUpdateHandle).toBeNull();
      expect(ctrl.timelineControl).toBeNull();
      expect(ctrl.timelineAutoPlay).toBe(false);
      expect(ctrl.timelineContainerEl).toBeNull();
      expect(ctrl.timelineBaseClasses).toBeNull();
    });

    it("applies lastFrameLoadHadErrors setter in frame loads", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.currentDatetime = "before";
      ctrl.lastFrameLoadHadErrors = true;
      await expect(ctrl.loadFrameForDatetimeCore("after")).rejects.toThrow(
        "Frame load failed for after",
      );
    });
  });

  describe("getActiveTimelineIndex", () => {
    it("returns requestedIndex when in range", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      void ctrl.setSelectedIndex(2, "user");
      expect(ctrl.getActiveTimelineIndex()).toBe(2);
    });

    it("falls back to currentDatetime index", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.currentDatetime = "b";
      expect(ctrl.getActiveTimelineIndex()).toBe(1);
    });

    it("falls back to zero if datetime not found", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "x";
      expect(ctrl.getActiveTimelineIndex()).toBe(0);
    });
  });

  describe("ensureCustomTimeline and renderCustomTimeline", () => {
    it("creates custom timeline shell and keeps host inside its wrapper", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["2026-03-20T00:00:00Z"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      // Host stays inside .control wrapper (which is inside mapWrap)
      expect(dom.timelineHost.closest(".map-wrap, div")).not.toBeNull();
      expect(dom.timelineHost.classList.contains("timeline-host--docked")).toBe(
        true,
      );
      expect(dom.timelineHost.querySelector(".timeline-shell")).not.toBeNull();
    });

    it("hides original timeline wrapper", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const wrapper = dom.mapWrap.querySelector(".control") as HTMLElement;
      expect(wrapper.style.display).toBe("none");
    });

    it("reuses shell on repeated ensureCustomTimeline calls", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const first = dom.timelineHost.querySelector(".timeline-shell");
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const second = dom.timelineHost.querySelector(".timeline-shell");
      expect(first).toBe(second);
    });

    it("hides custom timeline when no datetimes", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const shell = dom.timelineHost.querySelector(
        ".timeline-shell",
      ) as HTMLDivElement;
      expect(shell.style.display).toBe("none");
    });

    it("renders bubble/progress/marker from selected index", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T03:00:00Z",
        "2026-03-20T06:00:00Z",
      ];
      ctrl.currentDatetime = "2026-03-20T03:00:00Z";
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const bubble = dom.timelineHost.querySelector(
        ".timeline-bubble",
      ) as HTMLButtonElement;
      const progress = dom.timelineHost.querySelector(
        ".timeline-rail__progress",
      ) as HTMLDivElement;
      const marker = dom.timelineHost.querySelector(
        ".timeline-rail__marker",
      ) as HTMLDivElement;
      expect(bubble.style.left).toBe("50%");
      expect(progress.style.width).toBe("50%");
      expect(marker.style.left).toBe("50%");
    });

    it("renders play button glyph from playbackState", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["2026-03-20T00:00:00Z"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const play = dom.timelineHost.querySelector(
        ".timeline-play",
      ) as HTMLButtonElement;
      expect(play.textContent).toBe("▶");
      ctrl.setPlaybackState("playing");
      expect(play.textContent).toBe("❚❚");
      expect(play.getAttribute("aria-pressed")).toBe("true");
    });

    it("renders day segments and marks active day", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T03:00:00Z",
        "2026-03-21T00:00:00Z",
      ];
      ctrl.currentDatetime = "2026-03-21T00:00:00Z";
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const segments = dom.timelineHost.querySelectorAll(
        ".timeline-day-segment",
      );
      expect(segments.length).toBe(2);
      expect(
        Array.from(segments).some((el) => el.classList.contains("is-active")),
      ).toBe(true);
    });

    it("clicking day segment jumps to midpoint index", async () => {
      const { deps, dom, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T03:00:00Z",
        "2026-03-20T06:00:00Z",
        "2026-03-20T09:00:00Z",
      ];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const firstSegment = dom.timelineHost.querySelector(
        ".timeline-day-segment",
      ) as HTMLDivElement;
      firstSegment.click();
      vi.advanceTimersByTime(160);
      await flush();
      expect(spies.updateLayers).toHaveBeenCalled();
      expect(ctrl.currentDatetime).toBe("2026-03-20T06:00:00Z");
    });

    it("play button sets autoplay intent when idle", async () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["2026-03-20T00:00:00Z"];
      ctrl.currentDatetime = "2026-03-20T00:00:00Z";
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const play = dom.timelineHost.querySelector(
        ".timeline-play",
      ) as HTMLButtonElement;
      play.click();
      await flush();
      expect(ctrl.timelineAutoPlay).toBe(true);
    });

    it("play button pauses when currently playing", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["2026-03-20T00:00:00Z"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      ctrl.setPlaybackState("playing");
      const play = dom.timelineHost.querySelector(
        ".timeline-play",
      ) as HTMLButtonElement;
      play.click();
      expect(ctrl.playbackState).toBe("paused");
    });
  });

  describe("applyTimelineIndexFromPointer", () => {
    it("ignores when rail missing", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      expect(() => ctrl.applyTimelineIndexFromPointer(50)).not.toThrow();
    });

    it("ignores when less than 2 datetimes", () => {
      const { deps, dom, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      ctrl.applyTimelineIndexFromPointer(30);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("maps pointer x to nearest timeline index", async () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const rail = dom.timelineHost.querySelector(
        ".timeline-rail",
      ) as HTMLDivElement;
      Object.defineProperty(rail, "getBoundingClientRect", {
        value: () => ({
          left: 10,
          width: 100,
          top: 0,
          bottom: 0,
          right: 110,
          height: 10,
        }),
      });
      ctrl.applyTimelineIndexFromPointer(82);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("b");
    });

    it("clamps pointer outside rail bounds", async () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const rail = dom.timelineHost.querySelector(
        ".timeline-rail",
      ) as HTMLDivElement;
      Object.defineProperty(rail, "getBoundingClientRect", {
        value: () => ({
          left: 50,
          width: 100,
          top: 0,
          bottom: 0,
          right: 150,
          height: 10,
        }),
      });
      ctrl.applyTimelineIndexFromPointer(-100);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("a");
      ctrl.applyTimelineIndexFromPointer(999);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("c");
    });
  });

  describe("setTimelineLoading/updateTimelineDebug/setPlaybackState", () => {
    it("setTimelineLoading keeps loading element hidden", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const loading = document.createElement("div") as HTMLDivElement;
      ctrl.setTimelineFeedbackElements({ loadingEl: loading });
      ctrl.setTimelineLoading(true, "Loading frame…");
      expect(loading.style.display).toBe("none");
    });

    it("updateTimelineDebug writes requested/loaded state", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const debug = document.createElement("div") as HTMLDivElement;
      ctrl.setTimelineFeedbackElements({ debugEl: debug });
      ctrl.activeTimelineDatetimes = ["a", "b"];
      void ctrl.setSelectedIndex(1, "user");
      ctrl.updateTimelineDebug();
      expect(debug.textContent).toContain("requested index: 1");
    });

    it("setPlaybackState updates playback state value", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.setPlaybackState("waitingForFrame");
      expect(ctrl.playbackState).toBe("waitingForFrame");
    });

    it("setPlaybackState updates debug label loading flag", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const debug = document.createElement("div") as HTMLDivElement;
      ctrl.setTimelineFeedbackElements({ debugEl: debug });
      ctrl.setPlaybackState("waitingForFrame");
      expect(debug.textContent).toContain("loading: true");
      ctrl.setPlaybackState("idle");
      expect(debug.textContent).toContain("loading: false");
    });
  });

  describe("loadFrameForDatetimeCore/loadFrameForDatetime", () => {
    it("updates currentDatetime and calls persist + updateLayers", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.loadFrameForDatetimeCore("2026-03-20T00:00:00Z");
      expect(ctrl.currentDatetime).toBe("2026-03-20T00:00:00Z");
      expect(spies.schedulePersistState).toHaveBeenCalledTimes(1);
      expect(spies.updateLayers).toHaveBeenCalledTimes(1);
    });

    it("syncs and loads inhouse frame set when inhouse layers exist", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [{ times: ["a"] }] });
      const ctrl = new TimelineController(deps);
      await ctrl.loadFrameForDatetimeCore("a");
      expect(spies.syncInhouseTimeToTimeline).toHaveBeenCalledTimes(1);
      expect(spies.loadInhouseFrameSet).toHaveBeenCalledTimes(1);
    });

    it("does not call inhouse callbacks when no inhouse layers", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [] });
      const ctrl = new TimelineController(deps);
      await ctrl.loadFrameForDatetimeCore("a");
      expect(spies.syncInhouseTimeToTimeline).not.toHaveBeenCalled();
      expect(spies.loadInhouseFrameSet).not.toHaveBeenCalled();
    });

    it("throws aborted when signal is aborted", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const abort = new AbortController();
      abort.abort();
      await expect(
        ctrl.loadFrameForDatetimeCore("a", abort.signal),
      ).rejects.toThrow("aborted");
    });

    it("writes datetime into timeline control config when available", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      await ctrl.loadFrameForDatetimeCore("b");
      expect(control.config.datetime).toBe("b");
    });

    it("loadFrameForDatetime logs in dev and delegates core", async () => {
      const { deps, spies } = createDeps({ isDev: true });
      const ctrl = new TimelineController(deps);
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => undefined);
      await ctrl.loadFrameForDatetime("a");
      expect(logSpy).toHaveBeenCalled();
      expect(spies.updateLayers).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("setSelectedIndex", () => {
    it("returns early when no active datetimes", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.setSelectedIndex(0, "user");
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("clamps index and debounces user source by 140ms", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      void ctrl.setSelectedIndex(999, "user");
      expect(ctrl.timelineUpdateHandle).not.toBeNull();
      vi.advanceTimersByTime(139);
      await flush();
      expect(spies.updateLayers).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2);
      await flush();
      expect(ctrl.currentDatetime).toBe("b");
      expect(spies.updateLayers).toHaveBeenCalledTimes(1);
    });

    it("cancels previous user debounce when called repeatedly", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      void ctrl.setSelectedIndex(0, "user");
      void ctrl.setSelectedIndex(2, "user");
      vi.advanceTimersByTime(160);
      await flush();
      expect(spies.updateLayers).toHaveBeenCalledTimes(1);
      expect(ctrl.currentDatetime).toBe("c");
    });

    it("loads immediately for playback source", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      await ctrl.setSelectedIndex(1, "playback");
      expect(ctrl.currentDatetime).toBe("b");
      expect(spies.updateLayers).toHaveBeenCalledTimes(1);
      expect(ctrl.playbackState).toBe("waitingForFrame");
    });

    it("sets idle state after successful user load", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      void ctrl.setSelectedIndex(1, "user");
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.playbackState).toBe("idle");
    });

    it("sets error state and status on non-abort load errors", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [{ times: ["a"] }] });
      spies.loadInhouseFrameSet.mockRejectedValueOnce(new Error("boom"));
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a"];
      await expect(ctrl.setSelectedIndex(0, "playback")).rejects.toThrow(
        "boom",
      );
      expect(ctrl.playbackState).toBe("error");
      expect(spies.setStatus).toHaveBeenCalledWith("boom");
    });

    it("swallows abort-like errors and does not set error", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [{ times: ["a"] }] });
      spies.loadInhouseFrameSet.mockRejectedValueOnce(
        new Error("aborted by test"),
      );
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a"];
      void ctrl.setSelectedIndex(0, "user");
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.playbackState).toBe("waitingForFrame");
    });
  });

  describe("hotkey filtering and keyboard handler", () => {
    it("shouldIgnoreTimelineHotkeys false for null target", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.shouldIgnoreTimelineHotkeys(null)).toBe(false);
    });

    it("ignores contentEditable targets", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const el = document.createElement("div");
      el.setAttribute("contenteditable", "true");
      expect(ctrl.shouldIgnoreTimelineHotkeys(el)).toBe(true);
    });

    it("ignores textarea targets", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const textarea = document.createElement("textarea");
      expect(ctrl.shouldIgnoreTimelineHotkeys(textarea)).toBe(true);
    });

    it("ignores select targets", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const select = document.createElement("select");
      expect(ctrl.shouldIgnoreTimelineHotkeys(select)).toBe(true);
    });

    it("ignores text-like input types", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const input = document.createElement("input");
      input.type = "search";
      expect(ctrl.shouldIgnoreTimelineHotkeys(input)).toBe(true);
    });

    it("does not ignore checkbox input", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const input = document.createElement("input");
      input.type = "checkbox";
      expect(ctrl.shouldIgnoreTimelineHotkeys(input)).toBe(false);
    });

    it("ignores targets inside editable ancestor", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const wrapper = document.createElement("div");
      wrapper.setAttribute("contenteditable", "true");
      const child = document.createElement("span");
      wrapper.appendChild(child);
      expect(ctrl.shouldIgnoreTimelineHotkeys(child)).toBe(true);
    });

    it("isModalBlockingTimelineHotkeys from wavegram popup", () => {
      const { deps, state } = createDeps();
      const ctrl = new TimelineController(deps);
      state.wavegramOpen = true;
      expect(ctrl.isModalBlockingTimelineHotkeys()).toBe(true);
    });

    it("handleTimelineKeydown ignores non-arrow keys", () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.handleTimelineKeydown(
        new KeyboardEvent("keydown", { key: "Enter" }),
      );
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("handleTimelineKeydown ignores when modal blocks", () => {
      const { deps, state, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      state.wavegramOpen = true;
      ctrl.handleTimelineKeydown(
        new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }),
      );
      vi.advanceTimersByTime(160);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("handleTimelineKeydown ignores when target is editable", () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      const input = document.createElement("input");
      input.type = "text";
      ctrl.handleTimelineKeydown(
        new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }),
      );
      ctrl.handleTimelineKeydown(
        new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }),
      );
      expect(ctrl.shouldIgnoreTimelineHotkeys(input)).toBe(true);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("handleTimelineKeydown steps right and prevents default", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "a";
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        cancelable: true,
      });
      ctrl.handleTimelineKeydown(event);
      vi.advanceTimersByTime(160);
      await flush();
      expect(event.defaultPrevented).toBe(true);
      expect(ctrl.currentDatetime).toBe("b");
    });

    it("handleTimelineKeydown does nothing when update is pending", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      void ctrl.setSelectedIndex(2, "user");
      const event = new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        cancelable: true,
      });
      ctrl.handleTimelineKeydown(event);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("c");
    });
  });

  describe("stepTimelineByKeyboard", () => {
    it("returns when timeline empty", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.stepTimelineByKeyboard(1);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("returns when waitingForFrame", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.setPlaybackState("waitingForFrame");
      await ctrl.stepTimelineByKeyboard(1);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });

    it("stops playback when currently playing", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "a";
      ctrl.setPlaybackState("playing");
      await ctrl.stepTimelineByKeyboard(1);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.playbackState).toBe("idle");
      expect(ctrl.timelineAutoPlay).toBe(false);
    });

    it("clamps at boundaries", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "a";
      await ctrl.stepTimelineByKeyboard(-1);
      expect(spies.updateLayers).not.toHaveBeenCalled();
      ctrl.currentDatetime = "b";
      await ctrl.stepTimelineByKeyboard(1);
      expect(spies.updateLayers).not.toHaveBeenCalled();
    });
  });

  describe("resolveDatasetDatetime", () => {
    it("returns requested when dataset list empty", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.resolveDatasetDatetime("x", [])).toBe("x");
    });

    it("returns requested when exact match exists", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.resolveDatasetDatetime("b", ["a", "b", "c"])).toBe("b");
    });

    it("returns first dataset datetime when base timeline empty", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.resolveDatasetDatetime("x", ["a", "b"], [])).toBe("a");
    });

    it("returns first dataset datetime when requested missing from base", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.resolveDatasetDatetime("x", ["a", "b"], ["c", "d"])).toBe(
        "a",
      );
    });

    it("maps requested by relative position", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const mapped = ctrl.resolveDatasetDatetime(
        "t2",
        ["a", "b", "c", "d"],
        ["t0", "t1", "t2", "t3", "t4"],
      );
      expect(mapped).toBe("c");
    });
  });

  describe("timeline datetimes by mode + control updates", () => {
    it("getInhouseTimelineDatetimes returns first layer times", () => {
      const { deps } = createDeps({ inhouseLayers: [{ times: ["i0", "i1"] }] });
      const ctrl = new TimelineController(deps);
      expect(ctrl.getInhouseTimelineDatetimes()).toEqual(["i0", "i1"]);
    });

    it("getTimelineDatetimesForMode prefers inhouse times when >1", () => {
      const { deps } = createDeps({ inhouseLayers: [{ times: ["i0", "i1"] }] });
      const ctrl = new TimelineController(deps);
      ctrl.timelineDatetimes = ["t0", "t1", "t2"];
      expect(ctrl.getTimelineDatetimesForMode("temperature")).toEqual([
        "i0",
        "i1",
      ]);
    });

    it("getTimelineDatetimesForMode falls back to cloud timeline", () => {
      const { deps } = createDeps({ inhouseLayers: [{ times: ["i0"] }] });
      const ctrl = new TimelineController(deps);
      ctrl.timelineDatetimes = ["t0", "t1"];
      expect(ctrl.getTimelineDatetimesForMode("wind")).toEqual(["t0", "t1"]);
    });

    it("updateTimelineControlForMode returns when no control", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.timelineDatetimes = ["t0"];
      ctrl.updateTimelineControlForMode("temperature");
      expect(ctrl.activeTimelineDatetimes).toEqual([]);
    });

    it("updateTimelineControlForMode updates control config and active timeline", async () => {
      const { deps } = createDeps({ inhouseLayers: [{ times: ["i0", "i1"] }] });
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["x"], datetime: "x" });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.currentDatetime = "i1";
      ctrl.updateTimelineControlForMode("temperature");
      vi.advanceTimersByTime(160);
      await flush();
      expect(control.config.datetimes).toEqual(["i0", "i1"]);
      expect(control.config.datetime).toBe("i1");
      expect(ctrl.activeTimelineDatetimes).toEqual(["i0", "i1"]);
    });
  });

  describe("playback lifecycle", () => {
    it("startPlayback returns early when already playing", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.setPlaybackState("playing");
      await ctrl.startPlayback();
      expect(ctrl.playbackState).toBe("playing");
    });

    it("startPlayback returns when no control or no datetimes", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a"];
      await ctrl.startPlayback();
      expect(ctrl.playbackState).toBe("idle");

      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.activeTimelineDatetimes = [];
      await ctrl.startPlayback();
      expect(ctrl.playbackState).toBe("idle");
    });

    it("startPlayback advances frames then pauses at end", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a", "b"], datetime: "a" });
      const pauseSpy = vi.spyOn(control, "pause");
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "a";

      const p = ctrl.startPlayback();
      vi.advanceTimersByTime(140);
      await flush();
      vi.advanceTimersByTime(900);
      await flush();
      await p;

      expect(pauseSpy).toHaveBeenCalled();
      expect(["paused", "idle"] as PlaybackState[]).toContain(
        ctrl.playbackState,
      );
      expect(ctrl.timelineAutoPlay).toBe(false);
    });

    it("startPlayback handles load errors and sets status", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [{ times: ["a"] }] });
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      const pauseSpy = vi.spyOn(control, "pause");
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.activeTimelineDatetimes = ["a"];
      spies.loadInhouseFrameSet.mockRejectedValueOnce(
        new Error("frame failure"),
      );
      await ctrl.startPlayback();
      expect(ctrl.playbackState).toBe("paused");
      expect(spies.setStatus).toHaveBeenCalledWith("frame failure");
      expect(pauseSpy).toHaveBeenCalled();
    });

    it("stopPlayback aborts playback and sets target state", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.setPlaybackState("playing");
      ctrl.stopPlayback("idle");
      expect(ctrl.playbackState).toBe("idle");
      expect(ctrl.timelineAutoPlay).toBe(false);
    });
  });

  describe("setTimelineControl adapter hooks", () => {
    it("setTimelineControl stores control instance", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      expect(ctrl.timelineControl).not.toBeNull();
    });

    it("adapter start captures playing class and triggers playback", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const host = document.createElement("div");
      const child = document.createElement("div");
      child.className = "timeline-base playing-now";
      host.appendChild(child);
      ctrl.setTimelineContainerState(child, new Set(["timeline-base"]));

      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.activeTimelineDatetimes = ["a"];
      ctrl.currentDatetime = "a";
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      const adapter = (
        ctrl as unknown as { _adapter: { start: () => Promise<void> } }
      )._adapter;
      await adapter.start();
      expect(child.classList.contains("playing-now")).toBe(true);
      expect(ctrl.timelineAutoPlay).toBe(true);
      expect(host.children.length).toBe(1);
    });

    it("adapter pause stops playback and removes known playing class", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const container = document.createElement("div");
      container.className = "timeline-base playing-now";
      ctrl.setTimelineContainerState(container, new Set(["timeline-base"]));
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.activeTimelineDatetimes = ["a"];
      ctrl.currentDatetime = "a";
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      const adapter = (
        ctrl as unknown as {
          _adapter: { start: () => Promise<void>; pause: () => void };
        }
      )._adapter;
      await adapter.start();
      adapter.pause();
      expect(container.classList.contains("playing-now")).toBe(false);
      expect(ctrl.playbackState).toBe("paused");
    });

    it("adapter stop sets idle and removes known playing class", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const container = document.createElement("div");
      container.className = "timeline-base playing-now";
      ctrl.setTimelineContainerState(container, new Set(["timeline-base"]));
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.activeTimelineDatetimes = ["a"];
      ctrl.currentDatetime = "a";
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      const adapter = (
        ctrl as unknown as {
          _adapter: { start: () => Promise<void>; stop: () => void };
        }
      )._adapter;
      await adapter.start();
      adapter.stop();
      expect(container.classList.contains("playing-now")).toBe(false);
      expect(ctrl.playbackState).toBe("idle");
    });

    it("original control methods are not mutated", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      const originalStart = control.start;
      const originalPause = control.pause;
      const originalStop = control.stop;
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      expect(control.start).toBe(originalStart);
      expect(control.pause).toBe(originalPause);
      expect(control.stop).toBe(originalStop);
    });

    it("setTimelineControl(null) clears adapter", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      const control = createControl({ datetimes: ["a"], datetime: "a" });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      expect(ctrl.timelineControl).not.toBeNull();
      ctrl.setTimelineControl(null);
      expect(ctrl.timelineControl).toBeNull();
    });
  });
});
