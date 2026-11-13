/**
 * Types for the vendored bel-meteogram widget bundle (see README.md in this
 * directory). Keep in sync with `bel-meteogram/src/bel-meteogram.ts`.
 */

export interface BelMeteogramStatusDetail {
  status: "loading" | "ready" | "error";
  error?: string;
}

export interface BelMeteogramLocationDetail {
  lat: number;
  lon: number;
  /**
   * Resolved place name (nearest station, or the name passed to
   * loadChartLocation). For a point without a place name, its coordinates in
   * the `language` attribute's format (widget 0.9.0), e.g. "64,18°N 21,85°V".
   */
  name: string;
  /** Rounded "now" temperature in °C, or null when unavailable. */
  tempC: number | null;
  /**
   * API variables corrected against the observations of the station at this
   * point (e.g. "air_temperature_at_2m_agl"); empty when none were.
   */
  corrections: string[];
}

/** Detail of `bel-meteogram-time` (widget 0.8.0). */
export interface BelMeteogramTimeDetail {
  /** ISO UTC instant of the selected column, or null when the requested
   *  `selected-time` is outside the meteogram's range. */
  time: string | null;
  /** Temperature in °C exactly as the panel's readout shows it (rounded), or
   *  null when `time` is null or the value is missing. */
  tempC: number | null;
  /** "host": after `selected-time` changed or a load completed while it is
   *  set. "user": the reader committed a move in the panel (keys, click, tap,
   *  drag release, landscape rail); hover never emits. */
  source: "host" | "user";
}

/**
 * Attributes:
 * - `selected-time` (widget 0.8.0): an absolute UTC ISO
 *   instant, e.g. `2026-11-09T14:00:00.000Z`. Moves the panel's selected hour,
 *   graph cursor and shown day to the nearest column within half a step. It
 *   only repaints, never refetches; removing it returns to the "now" hour.
 * - `display-time-zone` (widget 0.9.0): an IANA zone name, e.g.
 *   `Atlantic/Reykjavik`. The table, graph, day chips, night bands and
 *   selected time are shown on that clock, each hour at the zone's own offset;
 *   the header names the zone when its offset differs from the point's.
 *   Absent or unknown to the browser: the point's own offset. Repaints
 *   without a refetch.
 */
export class BelMeteogram extends HTMLElement {
  /** Point the widget at a new location. */
  loadChartLocation(lat: number, lon: number, name?: string): void;
  /**
   * Open the settings dialog at its station search (widget 0.9.0). The search
   * field takes focus with a fine pointer only, so a phone's keyboard doesn't
   * pop up. Full mode only; does nothing in graph mode.
   */
  openSearch(): void;
  /** Open the meteogram card in a self-managed bottom sheet. */
  static openSheet(options: {
    title: string;
    attributes: Record<string, string>;
  }): HTMLElement;
}

declare global {
  interface HTMLElementTagNameMap {
    "bel-meteogram": BelMeteogram;
  }
  interface HTMLElementEventMap {
    "bel-meteogram-status": CustomEvent<BelMeteogramStatusDetail>;
    /** The widget's built-in ✕ (the `closable` attribute) was pressed. */
    "bel-meteogram-close": CustomEvent<null>;
    /**
     * The currently-selected point, fired on every successful load (initial,
     * station pick in the overlay, model change, or programmatic
     * loadChartLocation()). Lets a host move its map pin when a different
     * station is picked. Bubbles and is composed.
     */
    "bel-meteogram-location": CustomEvent<BelMeteogramLocationDetail>;
    /**
     * The selected hour (widget 0.8.0): after `selected-time` changes or is
     * removed, after every completed load while it is set (right after
     * `bel-meteogram-location`), and when the reader commits a move. Repeats
     * are not fired. Bubbles and is composed.
     */
    "bel-meteogram-time": CustomEvent<BelMeteogramTimeDetail>;
  }
}
