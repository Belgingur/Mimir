import type * as WeatherLayers from "weatherlayers-gl";

export type PlaybackHooks = {
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
};

type TimelineControlConfigLike = {
  datetimes?: string[];
  datetime?: string;
  [key: string]: unknown;
};

type TimelineControlInner = {
  getConfig?: () => TimelineControlConfigLike;
  setConfig?: (config: TimelineControlConfigLike) => void;
  start?: () => Promise<void> | void;
  pause?: () => void;
  stop?: () => void;
};

/**
 * Composes a WeatherLayers.TimelineControl without mutating it.
 *
 * Replaces the former monkey-patching approach: callers invoke adapter
 * methods which run lifecycle hooks and then delegate to the vendor
 * instance.  The vendor object is never modified, so repeated calls to
 * setTimelineControl cannot stack wrappers and upstream binding changes
 * are harmless.
 *
 * adapter.pause()  = hooks + forward to vendor
 * adapter.raw      = unwrapped vendor instance (no hooks)
 */
export class TimelineControlAdapter {
  private readonly inner: TimelineControlInner;
  private readonly hooks: PlaybackHooks;

  private readonly rawControl: WeatherLayers.TimelineControl;

  constructor(inner: WeatherLayers.TimelineControl, hooks: PlaybackHooks) {
    this.rawControl = inner;
    this.inner = inner as unknown as TimelineControlInner;
    this.hooks = hooks;
  }

  get raw(): WeatherLayers.TimelineControl {
    return this.rawControl;
  }

  async start(): Promise<void> {
    if (typeof this.inner.start === "function") {
      await this.inner.start();
    }
    this.hooks.onStart();
  }

  pause(): void {
    this.hooks.onPause();
    if (typeof this.inner.pause === "function") {
      this.inner.pause();
    }
  }

  stop(): void {
    this.hooks.onStop();
    if (typeof this.inner.stop === "function") {
      this.inner.stop();
    }
  }

  getConfig(): TimelineControlConfigLike | undefined {
    if (typeof this.inner.getConfig === "function") {
      return this.inner.getConfig();
    }
    return undefined;
  }

  setConfig(config: TimelineControlConfigLike): void {
    if (typeof this.inner.setConfig === "function") {
      this.inner.setConfig(config);
    }
  }
}
