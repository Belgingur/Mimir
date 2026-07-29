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
  /** Resolved place name (nearest station, or the name passed to loadChartLocation). */
  name: string;
  /** Rounded "now" temperature in °C, or null when unavailable. */
  tempC: number | null;
}

export class BelMeteogram extends HTMLElement {
  /** Point the widget at a new location. */
  loadChartLocation(lat: number, lon: number, name?: string): void;
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
  }
}
