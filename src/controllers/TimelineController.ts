import type * as WeatherLayers from "weatherlayers-gl";
import {
  buildTimelineDayBlocks,
  formatTimelineBubbleLabel,
} from "../lib/timelineHelpers";
import { TimelineControlAdapter } from "./TimelineControlAdapter";
import type { UiState } from "../lib/inhouseTypes";
import { t } from "../lib/i18n";

export type PlaybackState =
  | "idle"
  | "playing"
  | "waitingForFrame"
  | "paused"
  | "error";

export interface TimelineDom {
  mapWrap: HTMLDivElement;
}

export interface TimelineDeps {
  dom: TimelineDom;
  isDev: boolean;
  schedulePersistState: () => void;
  scheduleUpdateLayers: () => void;
  setStatus: (message: string) => void;
  updateLayers: () => void;
  getInhouseLayers: () => { times?: string[] }[];
  syncInhouseTimeToTimeline: () => void;
  loadInhouseFrameSet: () => Promise<void>;
  isWavegramOpen: () => boolean;
  renderGridLabels: (step: number, visible: boolean) => void;
  getGridStepForZoom: () => number;
  isGridVisible: () => boolean;
  createTimelineControl: (config: unknown) => unknown;
  offsetDatetimeRange: (
    iso: string,
    hoursBack: number,
    hoursForward: number,
  ) => [string, string];
}

export class TimelineController {
  private readonly deps: TimelineDeps;

  private _currentDatetime = "";
  private _adapter: TimelineControlAdapter | null = null;
  private _timelineUpdateHandle: number | null = null;
  private timelineLoadAbort: AbortController | null = null;
  private _timelineRange: ReturnType<
    TimelineDeps["offsetDatetimeRange"]
  > | null = null;
  private _timelineDatetimes: string[] = [];
  private _temperatureTimelineDatetimes: string[] = [];
  private _windTimelineDatetimes: string[] = [];
  private _mslpTimelineDatetimes: string[] = [];
  private _activeTimelineDatetimes: string[] = [];
  private _timelineAutoPlay = false;
  private timelineStepQueued = false;
  private timelineLoadingEl: HTMLDivElement | null = null;
  private _playbackState: PlaybackState = "idle";
  private playbackAbort: AbortController | null = null;
  private static readonly PLAYBACK_MIN_FRAME_MS = 900;
  private _lastFrameLoadHadErrors = false;
  private _timelineContainerEl: HTMLElement | null = null;
  private _timelineBaseClasses: Set<string> | null = null;
  private timelinePlayingClass = "";
  private timelineDebugEl: HTMLDivElement | null = null;
  private timelineCustomEl: HTMLDivElement | null = null;
  private timelineBubbleEl: HTMLButtonElement | null = null;
  private timelineBubbleTextEl: HTMLSpanElement | null = null;
  private timelineRailEl: HTMLDivElement | null = null;
  private timelineProgressEl: HTMLDivElement | null = null;
  private timelineMarkerEl: HTMLDivElement | null = null;
  private timelineDaysEl: HTMLDivElement | null = null;
  private timelinePlayBtnEl: HTMLButtonElement | null = null;
  private requestedIndex: number | null = null;
  private loadedIndex: number | null = null;
  private lastLoadError: string | null = null;
  private _timelineHostEl: HTMLDivElement | null = null;

  constructor(deps: TimelineDeps) {
    this.deps = deps;
  }

  get currentDatetime(): string {
    return this._currentDatetime;
  }
  set currentDatetime(value: string) {
    this._currentDatetime = value;
  }

  get timelineRange(): ReturnType<TimelineDeps["offsetDatetimeRange"]> | null {
    return this._timelineRange;
  }
  set timelineRange(
    value: ReturnType<TimelineDeps["offsetDatetimeRange"]> | null,
  ) {
    this._timelineRange = value;
  }

  get timelineDatetimes(): string[] {
    return this._timelineDatetimes;
  }
  set timelineDatetimes(value: string[]) {
    this._timelineDatetimes = value;
  }

  get activeTimelineDatetimes(): string[] {
    return this._activeTimelineDatetimes;
  }
  set activeTimelineDatetimes(value: string[]) {
    this._activeTimelineDatetimes = value;
  }

  get playbackState(): PlaybackState {
    return this._playbackState;
  }
  get timelineUpdateHandle(): number | null {
    return this._timelineUpdateHandle;
  }

  get temperatureTimelineDatetimes(): string[] {
    return this._temperatureTimelineDatetimes;
  }
  set temperatureTimelineDatetimes(value: string[]) {
    this._temperatureTimelineDatetimes = value;
  }

  get windTimelineDatetimes(): string[] {
    return this._windTimelineDatetimes;
  }
  set windTimelineDatetimes(value: string[]) {
    this._windTimelineDatetimes = value;
  }

  get mslpTimelineDatetimes(): string[] {
    return this._mslpTimelineDatetimes;
  }
  set mslpTimelineDatetimes(value: string[]) {
    this._mslpTimelineDatetimes = value;
  }

  get timelineAutoPlay(): boolean {
    return this._timelineAutoPlay;
  }

  get timelineControl(): WeatherLayers.TimelineControl | null {
    return this._adapter?.raw ?? null;
  }

  get timelineContainerEl(): HTMLElement | null {
    return this._timelineContainerEl;
  }
  get timelineBaseClasses(): Set<string> | null {
    return this._timelineBaseClasses;
  }

  set lastFrameLoadHadErrors(value: boolean) {
    this._lastFrameLoadHadErrors = value;
  }

  setTimelineFeedbackElements(options: {
    loadingEl?: HTMLDivElement | null;
    debugEl?: HTMLDivElement | null;
  }): void {
    if (options.loadingEl !== undefined)
      this.timelineLoadingEl = options.loadingEl;
    if (options.debugEl !== undefined) this.timelineDebugEl = options.debugEl;
  }

  setTimelineContainerState(
    containerEl: HTMLElement | null,
    baseClasses: Set<string> | null,
  ): void {
    this._timelineContainerEl = containerEl;
    this._timelineBaseClasses = baseClasses;
  }

  setTimelineControl(control: WeatherLayers.TimelineControl | null): void {
    if (!control) {
      this._adapter = null;
      return;
    }

    this._adapter = new TimelineControlAdapter(control, {
      onStart: () => {
        if (
          !this.timelinePlayingClass &&
          this._timelineContainerEl &&
          this._timelineBaseClasses
        ) {
          const current = Array.from(this._timelineContainerEl.classList);
          const added = current.find(
            (name) => !this._timelineBaseClasses?.has(name),
          );
          if (added) {
            this.timelinePlayingClass = added;
          }
        }
        if (this.timelinePlayingClass && this._timelineContainerEl) {
          this._timelineContainerEl.classList.add(this.timelinePlayingClass);
        }
        this._timelineAutoPlay = true;
        void this.startPlayback();
      },
      onPause: () => {
        this._timelineAutoPlay = false;
        this.stopPlayback("paused");
        if (this.timelinePlayingClass && this._timelineContainerEl) {
          this._timelineContainerEl.classList.remove(this.timelinePlayingClass);
        }
      },
      onStop: () => {
        this._timelineAutoPlay = false;
        this.stopPlayback("idle");
        if (this.timelinePlayingClass && this._timelineContainerEl) {
          this._timelineContainerEl.classList.remove(this.timelinePlayingClass);
        }
      },
    });
  }

  getActiveTimelineIndex(): number {
    if (
      this.requestedIndex !== null &&
      Number.isFinite(this.requestedIndex) &&
      this.requestedIndex >= 0 &&
      this.requestedIndex < this._activeTimelineDatetimes.length
    ) {
      return this.requestedIndex;
    }
    const idx = this._activeTimelineDatetimes.indexOf(this._currentDatetime);
    return idx >= 0 ? idx : 0;
  }

  applyTimelineIndexFromPointer(clientX: number): void {
    if (!this.timelineRailEl || this._activeTimelineDatetimes.length <= 1)
      return;
    const rect = this.timelineRailEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = Math.round(t * (this._activeTimelineDatetimes.length - 1));
    void this.setSelectedIndex(index, "user");
  }

  renderCustomTimeline(): void {
    if (
      !this.timelineCustomEl ||
      !this.timelineBubbleEl ||
      !this.timelineBubbleTextEl ||
      !this.timelineRailEl ||
      !this.timelineProgressEl ||
      !this.timelineMarkerEl ||
      !this.timelineDaysEl ||
      !this.timelinePlayBtnEl
    ) {
      return;
    }
    const datetimes = this._activeTimelineDatetimes;
    const hasTimeline = datetimes.length > 0;
    if (!hasTimeline) {
      this.timelineCustomEl.style.display = "none";
      return;
    }
    this.timelineCustomEl.style.display = "";
    const selectedIndex = this.getActiveTimelineIndex();
    const ratio =
      datetimes.length > 1 ? selectedIndex / (datetimes.length - 1) : 0;
    this.timelineBubbleTextEl.textContent = formatTimelineBubbleLabel(
      datetimes[selectedIndex],
    );
    this.timelineBubbleEl.style.left = `${ratio * 100}%`;
    this.timelineProgressEl.style.width = `${ratio * 100}%`;
    this.timelineMarkerEl.style.left = `${ratio * 100}%`;
    this.timelinePlayBtnEl.setAttribute(
      "aria-pressed",
      this._playbackState === "playing" ||
        this._playbackState === "waitingForFrame"
        ? "true"
        : "false",
    );
    this.timelinePlayBtnEl.textContent =
      this._playbackState === "playing" ||
      this._playbackState === "waitingForFrame"
        ? "❚❚"
        : "▶";

    const blocks = buildTimelineDayBlocks(datetimes);
    const isLandscapeCompact =
      window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
    const maxLabels = isLandscapeCompact
      ? 3
      : window.innerWidth < 720
        ? 4
        : blocks.length;
    this.timelineDaysEl.innerHTML = "";
    blocks.forEach((block, idx) => {
      const segment = document.createElement("div");
      segment.className = "timeline-day-segment";
      segment.style.flex = String(block.end - block.start + 1);
      if (selectedIndex >= block.start && selectedIndex <= block.end) {
        segment.classList.add("is-active");
      }
      if (
        blocks.length > maxLabels &&
        idx % Math.ceil(blocks.length / maxLabels) !== 0
      ) {
        segment.classList.add("is-muted-label");
      }
      segment.textContent = block.label;
      segment.addEventListener("click", () => {
        const midpoint = Math.round((block.start + block.end) / 2);
        void this.setSelectedIndex(midpoint, "user");
      });
      this.timelineDaysEl?.appendChild(segment);
    });
  }

  ensureCustomTimeline(timelineHost: HTMLDivElement): void {
    this._timelineHostEl = timelineHost;
    const timelineControlWrapper = timelineHost.closest(
      ".control",
    ) as HTMLElement | null;
    if (timelineControlWrapper) {
      timelineControlWrapper.style.display = "none";
    }
    timelineHost.classList.add("timeline-host--docked");
    if (this.timelineCustomEl) {
      this.renderCustomTimeline();
      return;
    }
    this.timelineCustomEl = document.createElement("div");
    this.timelineCustomEl.className = "timeline-shell";
    this.timelineCustomEl.innerHTML = `
      <button class="timeline-play" type="button" aria-label="${t("timeline.play")}"></button>
      <div class="timeline-track">
        <button class="timeline-bubble" type="button" aria-label="${t("timeline.selectedTime")}">
          <span class="timeline-bubble__text"></span>
        </button>
        <div class="timeline-rail">
          <div class="timeline-rail__progress"></div>
          <div class="timeline-rail__marker"></div>
        </div>
        <div class="timeline-days"></div>
      </div>
    `;
    timelineHost.appendChild(this.timelineCustomEl);
    this.timelinePlayBtnEl = this.timelineCustomEl.querySelector(
      ".timeline-play",
    ) as HTMLButtonElement;
    this.timelineBubbleEl = this.timelineCustomEl.querySelector(
      ".timeline-bubble",
    ) as HTMLButtonElement;
    this.timelineBubbleTextEl = this.timelineCustomEl.querySelector(
      ".timeline-bubble__text",
    ) as HTMLSpanElement;
    this.timelineRailEl = this.timelineCustomEl.querySelector(
      ".timeline-rail",
    ) as HTMLDivElement;
    this.timelineProgressEl = this.timelineCustomEl.querySelector(
      ".timeline-rail__progress",
    ) as HTMLDivElement;
    this.timelineMarkerEl = this.timelineCustomEl.querySelector(
      ".timeline-rail__marker",
    ) as HTMLDivElement;
    this.timelineDaysEl = this.timelineCustomEl.querySelector(
      ".timeline-days",
    ) as HTMLDivElement;

    const startScrub = (event: PointerEvent) => {
      this.applyTimelineIndexFromPointer(event.clientX);
      const onMove = (moveEvent: PointerEvent) =>
        this.applyTimelineIndexFromPointer(moveEvent.clientX);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    this.timelinePlayBtnEl.addEventListener("click", () => {
      if (
        this._playbackState === "playing" ||
        this._playbackState === "waitingForFrame"
      ) {
        this.stopPlayback("paused");
      } else {
        this._timelineAutoPlay = true;
        void this.startPlayback();
      }
      this.renderCustomTimeline();
    });
    this.timelineRailEl.addEventListener("pointerdown", startScrub);
    this.timelineBubbleEl.addEventListener("pointerdown", startScrub);
    window.addEventListener("resize", () => this.renderCustomTimeline());
    this.renderCustomTimeline();
  }

  setTimelineLoading(
    _loading: boolean,
    _message = t("status.loadingFrame"),
  ): void {
    if (!this.timelineLoadingEl) return;
    this.timelineLoadingEl.style.display = "none";
  }

  updateTimelineDebug(): void {
    if (!this.timelineDebugEl) return;
    this.timelineDebugEl.textContent = `requested index: ${this.requestedIndex ?? "-"} | loaded index: ${this.loadedIndex ?? "-"} | loading: ${
      this._playbackState === "waitingForFrame" ? "true" : "false"
    }`;
  }

  setPlaybackState(next: PlaybackState): void {
    this._playbackState = next;
    this.setTimelineLoading(next === "waitingForFrame");
    this.updateTimelineDebug();
    this.renderCustomTimeline();
  }

  async loadFrameForDatetimeCore(
    datetime: string,
    signal?: AbortSignal,
  ): Promise<void> {
    this._currentDatetime = datetime;
    this.deps.schedulePersistState();
    if (this.deps.getInhouseLayers().length) {
      this.deps.syncInhouseTimeToTimeline();
      await this.deps.loadInhouseFrameSet();
    }
    if (this._lastFrameLoadHadErrors) {
      throw new Error(`Frame load failed for ${this._currentDatetime}`);
    }
    if (signal?.aborted) throw new Error("aborted");
    if (this._adapter) {
      const currentConfig = this._adapter.getConfig();
      if (currentConfig) {
        this._adapter.setConfig({ ...currentConfig, datetime });
      }
    }
    this.deps.updateLayers();
    this.renderCustomTimeline();
  }

  async loadFrameForDatetime(
    datetime: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.deps.isDev) {
      console.log("[timeline] selectedDatetime ->", datetime);
    }
    await this.loadFrameForDatetimeCore(datetime, signal);
    if (signal?.aborted) throw new Error("aborted");
  }

  async setSelectedIndex(
    index: number,
    source: "user" | "playback",
  ): Promise<void> {
    if (!this._activeTimelineDatetimes.length) return;
    const clamped = Math.max(
      0,
      Math.min(this._activeTimelineDatetimes.length - 1, index),
    );
    this.requestedIndex = clamped;
    this.updateTimelineDebug();
    this.renderCustomTimeline();
    if (this._timelineUpdateHandle !== null) {
      window.clearTimeout(this._timelineUpdateHandle);
    }
    const doLoad = async () => {
      if (this.timelineLoadAbort) this.timelineLoadAbort.abort();
      this.timelineLoadAbort = new AbortController();
      const datetime = this._activeTimelineDatetimes[clamped];
      if (this.deps.isDev) {
        console.log("[timeline] frame url ->", datetime);
      }
      this.deps.setStatus("");
      this.setPlaybackState("waitingForFrame");
      try {
        await this.loadFrameForDatetimeCore(
          datetime,
          this.timelineLoadAbort.signal,
        );
        this.loadedIndex = clamped;
        this.updateTimelineDebug();
        this.lastLoadError = null;
        if (source === "user") {
          this.setPlaybackState("idle");
        }
      } catch (error) {
        if (error instanceof Error && /aborted/i.test(error.message)) {
          return;
        }
        this.lastLoadError =
          error instanceof Error ? error.message : String(error);
        this.deps.setStatus(this.lastLoadError);
        this.setPlaybackState("error");
        throw error;
      }
    };
    if (source === "user") {
      this._timelineUpdateHandle = window.setTimeout(() => {
        this._timelineUpdateHandle = null;
        void doLoad();
      }, 140);
    } else {
      await doLoad();
    }
  }

  shouldIgnoreTimelineHotkeys(target: EventTarget | null): boolean {
    const el = target instanceof HTMLElement ? target : null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
      return true;
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      if (
        type === "text" ||
        type === "search" ||
        type === "email" ||
        type === "url" ||
        type === "tel" ||
        type === "password" ||
        type === "number" ||
        type === "date" ||
        type === "datetime-local" ||
        type === "month" ||
        type === "time" ||
        type === "week"
      ) {
        return true;
      }
    }
    const editableAncestor = el.closest(
      '[contenteditable="true"], textarea, select',
    );
    if (editableAncestor) return true;
    const inputAncestor = el.closest("input") as HTMLInputElement | null;
    if (!inputAncestor) return false;
    const type = (inputAncestor.type || "text").toLowerCase();
    return (
      type === "text" ||
      type === "search" ||
      type === "email" ||
      type === "url" ||
      type === "tel" ||
      type === "password" ||
      type === "number" ||
      type === "date" ||
      type === "datetime-local" ||
      type === "month" ||
      type === "time" ||
      type === "week"
    );
  }

  isModalBlockingTimelineHotkeys(): boolean {
    return this.deps.isWavegramOpen();
  }

  async stepTimelineByKeyboard(delta: -1 | 1): Promise<void> {
    if (!this._activeTimelineDatetimes.length) return;
    if (this._playbackState === "waitingForFrame") return;
    if (this._playbackState === "playing") {
      this._timelineAutoPlay = false;
      this.stopPlayback("paused");
    }
    const currentIndex = this.getActiveTimelineIndex();
    const nextIndex = Math.max(
      0,
      Math.min(this._activeTimelineDatetimes.length - 1, currentIndex + delta),
    );
    if (nextIndex === currentIndex) return;
    await this.setSelectedIndex(nextIndex, "user");
  }

  resolveDatasetDatetime(
    requested: string,
    datasetDatetimes: string[],
    baseTimeline: string[] = this._timelineDatetimes,
  ): string {
    if (!datasetDatetimes.length) return requested;
    if (datasetDatetimes.includes(requested)) return requested;
    if (!baseTimeline.length) return datasetDatetimes[0];
    const idx = baseTimeline.indexOf(requested);
    if (idx < 0) return datasetDatetimes[0];
    const maxIndex = Math.max(1, baseTimeline.length - 1);
    const mapped = Math.round((idx / maxIndex) * (datasetDatetimes.length - 1));
    return datasetDatetimes[
      Math.max(0, Math.min(datasetDatetimes.length - 1, mapped))
    ];
  }

  getInhouseTimelineDatetimes(): string[] {
    const base = this.deps.getInhouseLayers()[0];
    return base?.times ?? [];
  }

  getTimelineDatetimesForMode(_mode: UiState["layerMode"]): string[] {
    const inhouseTimes = this.getInhouseTimelineDatetimes();
    if (inhouseTimes.length > 1) return inhouseTimes;
    return this._timelineDatetimes;
  }

  updateTimelineControlForMode(mode: UiState["layerMode"]): void {
    if (!this._adapter) return;
    const datetimes = this.getTimelineDatetimesForMode(mode);
    if (!datetimes.length) return;
    this._activeTimelineDatetimes = datetimes;
    const nextDatetime = this.resolveDatasetDatetime(
      this._currentDatetime || datetimes[0],
      datetimes,
      datetimes,
    );
    this._currentDatetime = nextDatetime;
    const currentConfig = this._adapter.getConfig();
    if (currentConfig) {
      this._adapter.setConfig({
        ...currentConfig,
        datetimes,
        datetime: nextDatetime,
      });
    }
    if (this._timelineContainerEl) {
      this._timelineBaseClasses = new Set(this._timelineContainerEl.classList);
    }
    void this.setSelectedIndex(
      this._activeTimelineDatetimes.indexOf(nextDatetime),
      "user",
    );
    this.renderCustomTimeline();
  }

  async startPlayback(): Promise<void> {
    if (
      this._playbackState === "playing" ||
      this._playbackState === "waitingForFrame"
    )
      return;
    if (!this._adapter || this._activeTimelineDatetimes.length === 0) return;
    if (this.playbackAbort) this.playbackAbort.abort();
    this.playbackAbort = new AbortController();
    this.setPlaybackState("playing");
    const signal = this.playbackAbort.signal;
    let idx = this._activeTimelineDatetimes.indexOf(this._currentDatetime);
    if (idx < 0) idx = 0;
    while (!signal.aborted) {
      this.setPlaybackState("waitingForFrame");
      try {
        await this.setSelectedIndex(idx, "playback");
      } catch (error) {
        if (signal.aborted) return;
        this.setPlaybackState("error");
        this.deps.setStatus(
          error instanceof Error ? error.message : String(error),
        );
        this._timelineAutoPlay = false;
        this._adapter?.pause();
        return;
      }
      if (signal.aborted) return;
      this.setPlaybackState("playing");
      if (idx >= this._activeTimelineDatetimes.length - 1) {
        break;
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, TimelineController.PLAYBACK_MIN_FRAME_MS),
      );
      if (signal.aborted) return;
      idx += 1;
    }
    this.setPlaybackState("idle");
    this._timelineAutoPlay = false;
    this._adapter?.pause();
  }

  stopPlayback(state: "paused" | "idle" = "paused"): void {
    if (this.playbackAbort) {
      this.playbackAbort.abort();
      this.playbackAbort = null;
    }
    this.setPlaybackState(state);
    this._timelineAutoPlay = false;
  }

  handleTimelineKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (this.deps.isDev) {
      console.log("[timeline keydown]", {
        key: event.key,
        activeTimelineCount: this._activeTimelineDatetimes.length,
        playbackState: this._playbackState,
        hasPendingTimelineUpdate: this._timelineUpdateHandle !== null,
        activeElement: document.activeElement?.tagName ?? null,
      });
    }
    if (
      this.shouldIgnoreTimelineHotkeys(event.target) ||
      this.isModalBlockingTimelineHotkeys()
    )
      return;
    if (!this._activeTimelineDatetimes.length) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    event.preventDefault();
    event.stopPropagation();
    if (
      this._timelineUpdateHandle !== null ||
      this._playbackState === "waitingForFrame"
    )
      return;
    void this.stepTimelineByKeyboard(delta);
  }

  getPlaybackDebugState(): {
    requestedIndex: number | null;
    loadedIndex: number | null;
    lastLoadError: string | null;
    timelineStepQueued: boolean;
    timelinePlayingClass: string;
  } {
    return {
      requestedIndex: this.requestedIndex,
      loadedIndex: this.loadedIndex,
      lastLoadError: this.lastLoadError,
      timelineStepQueued: this.timelineStepQueued,
      timelinePlayingClass: this.timelinePlayingClass,
    };
  }

  initTimeline(
    timelineHost: HTMLDivElement,
    datetimes: string[],
    isDev: boolean,
  ): void {
    if (!datetimes.length) return;
    const lastDatetime = datetimes[datetimes.length - 1];

    const loadingEl = (() => {
      let el = timelineHost.querySelector(
        "#timeline-loading",
      ) as HTMLDivElement | null;
      if (!el) {
        el = document.createElement("div");
        el.id = "timeline-loading";
        el.textContent = t("status.loadingFrame");
        el.style.display = "none";
        el.style.fontSize = "12px";
        el.style.color = "#c2c2c2";
        el.style.marginTop = "6px";
        timelineHost.appendChild(el);
      }
      return el;
    })();
    const debugEl = isDev
      ? (() => {
          let el = timelineHost.querySelector(
            "#timeline-debug",
          ) as HTMLDivElement | null;
          if (!el) {
            el = document.createElement("div");
            el.id = "timeline-debug";
            el.style.fontSize = "11px";
            el.style.color = "#9bb1c2";
            el.style.marginTop = "4px";
            timelineHost.appendChild(el);
          }
          return el;
        })()
      : null;
    this.setTimelineFeedbackElements({ loadingEl, debugEl });
    this.updateTimelineDebug();

    const control = this.deps.createTimelineControl({
      container: timelineHost,
      datetimes,
      datetime: this.currentDatetime,
      fps: 2,
      onPreload: () => [],
      onUpdate: (datetime: string) => {
        if (datetime === lastDatetime) {
          this._adapter?.pause();
        }
        if (
          this._playbackState === "playing" ||
          this._playbackState === "waitingForFrame"
        ) {
          this.stopPlayback("paused");
        }
        const idx = this._activeTimelineDatetimes.indexOf(datetime);
        void this.setSelectedIndex(idx >= 0 ? idx : 0, "user");
      },
    });
    this.setTimelineControl(control as WeatherLayers.TimelineControl);

    const maybeControl = control as unknown as {
      mount?: () => void;
      addTo?: (container: HTMLElement) => void;
    };
    if (typeof maybeControl.mount === "function") {
      maybeControl.mount();
    } else if (typeof maybeControl.addTo === "function") {
      maybeControl.addTo(timelineHost);
    }

    const timelineContainerEl = Array.from(timelineHost.children).find(
      (child) => {
        const customShell = timelineHost.querySelector(".timeline-shell");
        return child !== customShell;
      },
    ) as HTMLElement | null;
    if (timelineContainerEl) {
      timelineContainerEl.style.display = "none";
    }
    this.setTimelineContainerState(
      timelineContainerEl,
      timelineContainerEl ? new Set(timelineContainerEl.classList) : null,
    );
    this.renderCustomTimeline();
  }
}
