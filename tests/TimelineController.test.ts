import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as WeatherLayers from "weatherlayers-gl";
import {
  TimelineController,
  type PlaybackState,
  type TimelineDeps,
  type TimelineDom,
} from "../src/controllers/TimelineController";
import { buildTimelineDayBlocks } from "../src/lib/timelineHelpers";
import { listenForKeyActions, type KeyAction } from "../src/lib/keymap";

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

  describe("selected datetime hook (meteogram follows the timeline)", () => {
    it("reports each change of the selected datetime once", () => {
      const { deps } = createDeps();
      const onCurrentDatetimeChange = vi.fn();
      const ctrl = new TimelineController({ ...deps, onCurrentDatetimeChange });
      ctrl.currentDatetime = "2026-11-09T14:00:00Z";
      ctrl.currentDatetime = "2026-11-09T14:00:00Z";
      ctrl.currentDatetime = "2026-11-09T15:00:00Z";
      expect(onCurrentDatetimeChange.mock.calls).toEqual([
        ["2026-11-09T14:00:00Z"],
        ["2026-11-09T15:00:00Z"],
      ]);
    });

    it("reports a frame load's datetime", async () => {
      const { deps } = createDeps();
      const onCurrentDatetimeChange = vi.fn();
      const ctrl = new TimelineController({ ...deps, onCurrentDatetimeChange });
      await ctrl.loadFrameForDatetimeCore("2026-11-09T12:00:00Z");
      expect(onCurrentDatetimeChange).toHaveBeenCalledWith(
        "2026-11-09T12:00:00Z",
      );
    });

    it("selectNearestDatetime moves to the frame at, else nearest, a time", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-11-09T12:00:00Z",
        "2026-11-09T15:00:00Z",
        "2026-11-09T18:00:00Z",
      ];
      ctrl.currentDatetime = "2026-11-09T12:00:00Z";
      expect(ctrl.selectNearestDatetime("2026-11-09T16:00:00.000Z")).toBe(
        "2026-11-09T15:00:00Z",
      );
      expect(ctrl.getActiveTimelineIndex()).toBe(1);
      expect(ctrl.selectNearestDatetime("2026-11-09T18:00:00.000Z")).toBe(
        "2026-11-09T18:00:00Z",
      );
      expect(ctrl.getActiveTimelineIndex()).toBe(2);
    });

    it("selectNearestDatetime leaves the timeline alone at its own frame", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["2026-11-09T12:00:00Z", "2026-11-09T15:00:00Z"];
      ctrl.currentDatetime = "2026-11-09T15:00:00Z";
      const select = vi.spyOn(ctrl, "setSelectedIndex");
      expect(ctrl.selectNearestDatetime("2026-11-09T14:00:00.000Z")).toBe(
        "2026-11-09T15:00:00Z",
      );
      expect(select).not.toHaveBeenCalled();
    });

    it("selectNearestDatetime returns null without frames", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.selectNearestDatetime("2026-11-09T14:00:00Z")).toBeNull();
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

    it("puts the now tick where the present hour falls in the run", () => {
      // Fake timers are already installed by the outer beforeEach, so Date.now()
      // inside renderCustomTimeline reads this.
      vi.setSystemTime(new Date("2026-03-20T06:00:00Z"));
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T06:00:00Z",
        "2026-03-20T12:00:00Z",
      ];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const now = dom.timelineHost.querySelector(
        ".timeline-rail__now",
      ) as HTMLElement;
      expect(now.hidden).toBe(false);
      expect(now.style.left).toBe("50%");
    });

    it("draws no now tick when the run does not cover the present", () => {
      // A day after the run's last step: a tick pinned to the right edge would
      // claim the forecast reaches this moment.
      vi.setSystemTime(new Date("2026-03-21T12:00:00Z"));
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T12:00:00Z",
      ];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const now = dom.timelineHost.querySelector(
        ".timeline-rail__now",
      ) as HTMLElement;
      expect(now.hidden).toBe(true);
    });

    it("re-reads the clock when the tab becomes visible again", () => {
      vi.setSystemTime(new Date("2026-03-20T00:00:00Z"));
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T12:00:00Z",
        "2026-03-21T00:00:00Z",
      ];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const now = dom.timelineHost.querySelector(
        ".timeline-rail__now",
      ) as HTMLElement;
      expect(now.style.left).toBe("0%");
      // Hours pass in a background tab; nothing re-renders until it is looked at.
      vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));
      document.dispatchEvent(new Event("visibilitychange"));
      expect(now.style.left).toBe("50%");
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

    it("places each day segment at its first step's rail position", () => {
      const { deps, dom } = createDeps();
      const ctrl = new TimelineController(deps);
      // 49 hourly steps from a local midnight: days start at steps 0, 24 and 48.
      const start = new Date(2026, 10, 10, 0, 0, 0).getTime();
      const datetimes = Array.from({ length: 49 }, (_, i) =>
        new Date(start + i * 3_600_000).toISOString(),
      );
      ctrl.activeTimelineDatetimes = datetimes;
      ctrl.currentDatetime = datetimes[0];
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const segments = Array.from(
        dom.timelineHost.querySelectorAll<HTMLDivElement>(".timeline-day-segment"),
      );
      // The third day has only the run's last step, at the rail's right end:
      // no width, so no box.
      expect(segments.map((el) => el.style.left)).toEqual(["0%", "50%"]);
      expect(segments.map((el) => el.style.width)).toEqual(["calc(50% - 1px)", "50%"]);
      expect(segments[0].style.flex).toBe("");
    });

    it("clicking day segment jumps to midpoint index", async () => {
      const { deps, dom, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      const datetimes = [
        "2026-03-20T00:00:00Z",
        "2026-03-20T03:00:00Z",
        "2026-03-20T06:00:00Z",
        "2026-03-20T09:00:00Z",
      ];
      ctrl.activeTimelineDatetimes = datetimes;
      ctrl.ensureCustomTimeline(dom.timelineHost);
      const firstSegment = dom.timelineHost.querySelector(
        ".timeline-day-segment",
      ) as HTMLDivElement;
      firstSegment.click();
      vi.advanceTimersByTime(160);
      await flush();
      expect(spies.scheduleUpdateLayers).toHaveBeenCalled();
      // Segments are cut on local days, so how these four UTC instants divide
      // depends on the runtime zone. The behaviour under test is "land on the
      // clicked block's midpoint", so read that block back rather than assuming
      // all four share one day.
      const firstBlock = buildTimelineDayBlocks(datetimes)[0];
      const midpoint = Math.round((firstBlock.start + firstBlock.end) / 2);
      expect(ctrl.currentDatetime).toBe(datetimes[midpoint]);
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
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
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
    it("updates currentDatetime and calls persist + scheduleUpdateLayers", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.loadFrameForDatetimeCore("2026-03-20T00:00:00Z");
      expect(ctrl.currentDatetime).toBe("2026-03-20T00:00:00Z");
      expect(spies.schedulePersistState).toHaveBeenCalledTimes(1);
      expect(spies.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
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
      expect(spies.scheduleUpdateLayers).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("setSelectedIndex", () => {
    it("returns early when no active datetimes", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.setSelectedIndex(0, "user");
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("clamps index and debounces user source by 140ms", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      void ctrl.setSelectedIndex(999, "user");
      expect(ctrl.timelineUpdateHandle).not.toBeNull();
      vi.advanceTimersByTime(139);
      await flush();
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2);
      await flush();
      expect(ctrl.currentDatetime).toBe("b");
      expect(spies.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
    });

    it("cancels previous user debounce when called repeatedly", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      void ctrl.setSelectedIndex(0, "user");
      void ctrl.setSelectedIndex(2, "user");
      vi.advanceTimersByTime(160);
      await flush();
      expect(spies.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
      expect(ctrl.currentDatetime).toBe("c");
    });

    it("loads immediately for playback source", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      await ctrl.setSelectedIndex(1, "playback");
      expect(ctrl.currentDatetime).toBe("b");
      expect(spies.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
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

  describe("keyboard actions", () => {
    it("isModalBlockingTimelineHotkeys from wavegram popup", () => {
      const { deps, state } = createDeps();
      const ctrl = new TimelineController(deps);
      state.wavegramOpen = true;
      expect(ctrl.isModalBlockingTimelineHotkeys()).toBe(true);
    });

    it("leaves the key alone while a wavegram is open", () => {
      const { deps, state, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      state.wavegramOpen = true;
      expect(ctrl.runKeyAction("timeline.stepForward")).toBe(false);
      vi.advanceTimersByTime(160);
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("leaves the key alone without a timeline", () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      expect(ctrl.runKeyAction("timeline.stepForward")).toBe(false);
    });

    it("steps forward one frame and takes the key", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.currentDatetime = "a";
      expect(ctrl.runKeyAction("timeline.stepForward")).toBe(true);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("b");
    });

    it("steps back one frame", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.currentDatetime = "c";
      expect(ctrl.runKeyAction("timeline.stepBack")).toBe(true);
      vi.advanceTimersByTime(160);
      await flush();
      expect(ctrl.currentDatetime).toBe("b");
    });

    it("steps from the index last asked for while an update is pending", async () => {
      const { deps, spies } = createDeps({ inhouseLayers: [{ times: ["a", "b", "c"] }] });
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      void ctrl.setSelectedIndex(2, "user");
      expect(ctrl.runKeyAction("timeline.stepBack")).toBe(true);
      await vi.advanceTimersByTimeAsync(160);
      expect(ctrl.currentDatetime).toBe("b");
      expect(spies.loadInhouseFrameSet).toHaveBeenCalledTimes(1);
    });

    describe("quick presses (#49)", () => {
      const hours = Array.from({ length: 24 }, (_, i) => `2026-11-11T${String(i).padStart(2, "0")}:00:00Z`);
      function timeline() {
        const made = createDeps({ inhouseLayers: [{ times: hours }] });
        const ctrl = new TimelineController(made.deps);
        ctrl.activeTimelineDatetimes = hours;
        ctrl.currentDatetime = hours[0];
        return { ctrl, ...made };
      }

      it("ten presses within 100 ms move ten steps and load one frame, the last", async () => {
        const { ctrl, spies } = timeline();
        for (let i = 0; i < 10; i += 1) {
          expect(ctrl.runKeyAction("timeline.stepForward")).toBe(true);
          await vi.advanceTimersByTimeAsync(10);
        }
        // The timeline shows each step at once; the map waits for the last.
        expect(ctrl.getActiveTimelineIndex()).toBe(10);
        expect(spies.loadInhouseFrameSet).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(160);
        expect(ctrl.currentDatetime).toBe(hours[10]);
        expect(spies.loadInhouseFrameSet).toHaveBeenCalledTimes(1);
      });

      it("presses that arrive while a frame loads still count", async () => {
        const { ctrl, spies } = timeline();
        // Each frame takes 300 ms, longer than the 200 ms between presses.
        spies.loadInhouseFrameSet.mockImplementation(
          () => new Promise<void>((resolve) => window.setTimeout(resolve, 300)),
        );
        for (let i = 0; i < 5; i += 1) {
          ctrl.runKeyAction("timeline.stepForward");
          await vi.advanceTimersByTimeAsync(200);
        }
        ctrl.runKeyAction("timeline.stepBack");
        await vi.advanceTimersByTimeAsync(1000);
        expect(ctrl.currentDatetime).toBe(hours[4]);
        expect(ctrl.playbackState).toBe("idle");
      });
    });

    it("a → on the map steps once and never reaches the map's handler", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.currentDatetime = "a";
      // MapLibre's keyboard handler listens on the map's container.
      const container = document.createElement("div");
      const canvas = document.createElement("canvas");
      canvas.tabIndex = 0;
      container.appendChild(canvas);
      document.body.appendChild(container);
      const mapHandler = vi.fn();
      container.addEventListener("keydown", mapHandler);
      const run = vi.fn((action: KeyAction) => ctrl.runKeyAction(action));
      const stop = listenForKeyActions(window, run);
      try {
        const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
        canvas.dispatchEvent(event);
        vi.advanceTimersByTime(160);
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
        expect(ctrl.currentDatetime).toBe("b");
        expect(event.defaultPrevented).toBe(true);
        expect(mapHandler).not.toHaveBeenCalled();
      } finally {
        stop();
        container.remove();
      }
    });
  });

  describe("stepTimelineByKeyboard", () => {
    it("returns when timeline empty", async () => {
      const { deps, spies } = createDeps();
      const ctrl = new TimelineController(deps);
      await ctrl.stepTimelineByKeyboard(1);
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("steps while a frame is loading", async () => {
      const { deps } = createDeps();
      const ctrl = new TimelineController(deps);
      ctrl.activeTimelineDatetimes = ["a", "b"];
      ctrl.currentDatetime = "a";
      ctrl.setPlaybackState("waitingForFrame");
      await ctrl.stepTimelineByKeyboard(1);
      await vi.advanceTimersByTimeAsync(160);
      expect(ctrl.currentDatetime).toBe("b");
    });

    it("stops playback that is waiting for its frame, and steps from there", async () => {
      const times = ["a", "b", "c", "d"];
      const { deps, spies } = createDeps({ inhouseLayers: [{ times }] });
      let finishFrame!: () => void;
      spies.loadInhouseFrameSet.mockImplementationOnce(
        () => new Promise<void>((resolve) => { finishFrame = resolve; }),
      );
      const ctrl = new TimelineController(deps);
      ctrl.setTimelineControl(
        createControl({ datetimes: times, datetime: "b" }) as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.activeTimelineDatetimes = times;
      ctrl.currentDatetime = "b";
      const playback = ctrl.startPlayback();
      await vi.advanceTimersByTimeAsync(0);
      expect(ctrl.playbackState).toBe("waitingForFrame");

      ctrl.runKeyAction("timeline.stepBack");
      finishFrame();
      await vi.advanceTimersByTimeAsync(2000);
      await playback;
      // Playback would have gone on to "c"; the key took it back to "a".
      expect(ctrl.currentDatetime).toBe("a");
      expect(ctrl.timelineAutoPlay).toBe(false);
      expect(ctrl.playbackState).toBe("idle");
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
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
      ctrl.currentDatetime = "b";
      await ctrl.stepTimelineByKeyboard(1);
      expect(spies.scheduleUpdateLayers).not.toHaveBeenCalled();
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

    it("startPlayback counts the frame's load time inside the period", async () => {
      vi.spyOn(performance, "now").mockImplementation(() => Date.now());
      const { deps, spies } = createDeps({
        inhouseLayers: [{ times: ["a", "b", "c"] }],
      });
      const starts: number[] = [];
      spies.loadInhouseFrameSet.mockImplementation(() => {
        starts.push(Date.now());
        return new Promise((resolve) => setTimeout(resolve, 600));
      });
      const ctrl = new TimelineController(deps);
      const control = createControl({
        datetimes: ["a", "b", "c"],
        datetime: "a",
      });
      ctrl.setTimelineControl(
        control as unknown as WeatherLayers.TimelineControl,
      );
      ctrl.activeTimelineDatetimes = ["a", "b", "c"];
      ctrl.currentDatetime = "a";

      const p = ctrl.startPlayback();
      await vi.advanceTimersByTimeAsync(3000);
      await p;

      expect(starts).toHaveLength(3);
      // A 600 ms load fits inside the 900 ms period instead of adding to it.
      expect(starts[1] - starts[0]).toBe(900);
      expect(starts[2] - starts[1]).toBe(900);
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
