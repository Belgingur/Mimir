/**
 * The first load: what main.ts sets up right after it creates the map, before
 * the controllers (a separate, larger download) exist. Anything the
 * controllers attached themselves could miss an early map event.
 */
import type * as maplibregl from "maplibre-gl";
import { t } from "./i18n";
import { LAND_COUNTRY_BOUNDARY_FILTER } from "./mapLayerOrder";

/**
 * How long nothing may finish loading before the first load is taken to have
 * stalled. Counted from the last request that finished, not from the start,
 * so a slow connection that keeps delivering never reaches it. See the pull
 * request that added it for the measurements behind the value.
 */
export const STALL_QUIET_MS = 45_000;

/** Neutral outline-only fallback; deliberately has no symbols or glyphs. */
export const OUTLINE_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Mímir outline fallback",
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://demotiles.maplibre.org/tiles/tiles.json",
      attribution:
        "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e8edf0" },
    },
    {
      id: "fallback-coast",
      type: "line",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["all"],
      paint: {
        "line-color": "#526873",
        "line-width": 0.9,
      },
    },
    {
      id: "fallback-waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 4,
      filter: ["all"],
      paint: {
        "line-color": "#668896",
        "line-width": 0.75,
      },
    },
    {
      id: "fallback-boundary",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: LAND_COUNTRY_BOUNDARY_FILTER,
      paint: {
        "line-color": "#344852",
        "line-width": 1.1,
      },
    },
  ],
};

/**
 * Resolves when the map's style has loaded: MapLibre's `style.load`, fired as
 * soon as the style is parsed. It doesn't wait for tiles, the sprite or
 * glyphs, as `load` does.
 *
 * Call it right after creating the map. A promise keeps the answer, so the
 * controllers can attach at any time later and still start.
 */
export function whenStyleLoads(
  map: Pick<maplibregl.Map, "once">,
): Promise<void> {
  return new Promise((resolve) => {
    map.once("style.load", () => resolve());
  });
}

/** Subscribes to "something finished loading"; returns the way to stop. */
export type ProgressSource = (onProgress: () => void) => () => void;

/**
 * Every request the page finishes, whatever it was for: the browser's
 * resource timing entries. Where the browser has no PerformanceObserver the
 * source reports nothing, and a quiet period is then counted from its start.
 */
export const resourceLoads: ProgressSource = (onProgress) => {
  if (typeof PerformanceObserver !== "function") return () => {};
  try {
    const observer = new PerformanceObserver(() => onProgress());
    observer.observe({ type: "resource", buffered: false });
    return () => observer.disconnect();
  } catch {
    return () => {};
  }
};

export interface QuietWatchOptions {
  quietMs: number;
  /** Called each time `quietMs` have passed with no progress. */
  onQuiet: () => void;
  progress: ProgressSource;
  /** A hidden tab is throttled by the browser and doesn't draw, so time
   *  there says nothing about a stall. */
  isHidden?: () => boolean;
}

/**
 * Calls `onQuiet` when nothing has made progress for `quietMs`, and again
 * after each further quiet period, until stopped.
 */
export function watchForQuiet(options: QuietWatchOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      arm();
      if (!options.isHidden?.()) options.onQuiet();
    }, options.quietMs);
  };
  const stopProgress = options.progress(arm);
  arm();
  return () => {
    clearTimeout(timer);
    stopProgress();
  };
}

/**
 * How the start ended: with the forecast in, with the start's own error on
 * screen (it offers a retry), or because something threw.
 */
export type StartOutcome = "forecast" | "error" | "failed";

export interface MapStartupOptions {
  /** The style that takes over when the map's own can't be loaded. */
  fallbackStyle?: maplibregl.StyleSpecification;
  quietMs?: number;
  progress?: ProgressSource;
  isHidden?: () => boolean;
  /** Ends the loading state and shows an error with a way to reload. */
  showError?: () => void;
  /** Takes that error away again: the start finished after all. */
  hideError?: () => void;
}

export interface MapStartup {
  /** Resolves when a style has loaded: the map's own, or the fallback. */
  styleLoaded: Promise<void>;
  /**
   * The start has ended: the forecast is in, or the start has shown its own
   * error. Pass `failed` when it ended because something threw.
   */
  finished(failed?: boolean): void;
}

type StartupMap = Pick<maplibregl.Map, "on" | "once" | "setStyle">;

/**
 * Watches the map's first load from the moment the map exists.
 *
 * The style is what everything else waits for. If it fails, or never
 * answers, the fallback style takes its place:
 * - a map error before any style has loaded is the style's own (tiles, the
 *   sprite and glyphs are only asked for once it has), so it switches at once;
 * - a style request that never answers raises no error at all, so it also
 *   switches when the style still isn't in and nothing has finished loading
 *   for `quietMs`.
 *
 * It also takes over when the style loaded but its tile source can't be
 * (the tile manifest failed) while the basemap is being drawn for the first
 * time: that style has nothing to draw.
 *
 * Every other map error is only logged once a style has loaded. A failed
 * tile or sprite is not a reason to replace the whole basemap.
 *
 * It is also the safety net for whatever else can keep the start from
 * ending: a forecast frame that never answers, or controllers that never
 * arrive. When the start hasn't finished and nothing has finished loading
 * for `quietMs`, `showError` is called. The start may still finish after
 * that; `hideError` is then called and the forecast shows.
 */
export function watchMapStartup(
  map: StartupMap,
  options: MapStartupOptions = {},
): MapStartup {
  const fallbackStyle = options.fallbackStyle ?? OUTLINE_FALLBACK_STYLE;
  let styleIsIn = false;
  let fallbackApplied = false;
  let ended = false;
  let errorShown = false;

  const useFallbackStyle = (reason: string): void => {
    if (fallbackApplied) return;
    fallbackApplied = true;
    console.warn(t("error.styleFallback", { message: reason }));
    map.setStyle(fallbackStyle);
  };

  const showError = (): void => {
    if (errorShown) return;
    errorShown = true;
    options.showError?.();
  };

  const stopWatching = watchForQuiet({
    quietMs: options.quietMs ?? STALL_QUIET_MS,
    progress: options.progress ?? resourceLoads,
    isHidden: options.isHidden ?? (() => document.hidden),
    onQuiet: () => {
      // First the style: with the fallback in, the start can still go on.
      if (!styleIsIn && !fallbackApplied) {
        useFallbackStyle("the style did not load");
        return;
      }
      showError();
    },
  });

  const styleLoaded = new Promise<void>((resolve) => {
    map.once("style.load", () => {
      styleIsIn = true;
      resolve();
    });
  });

  // MapLibre's `load`: the basemap has been drawn once, with what it had.
  let basemapDrawn = false;
  map.once("load", () => {
    basemapDrawn = true;
  });

  map.on("error", (event: maplibregl.ErrorEvent) => {
    const { error, sourceId, tile } = event as {
      error?: { message?: string };
      sourceId?: string;
      tile?: unknown;
    };
    const message = error?.message ?? "Unknown map error";
    // An error that names a source and no tile is the source itself failing
    // to load: its tile manifest.
    const sourceFailed = Boolean(sourceId) && !tile;
    if (!styleIsIn || (sourceFailed && !basemapDrawn)) {
      useFallbackStyle(message);
      return;
    }
    console.warn("MapLibre error after the style loaded:", message);
  });

  return {
    styleLoaded,
    finished(failed = false): void {
      if (ended) return;
      ended = true;
      stopWatching();
      if (failed) {
        showError();
      } else if (errorShown) {
        // The start finished after the safety net had given up on it.
        errorShown = false;
        options.hideError?.();
      }
    },
  };
}
