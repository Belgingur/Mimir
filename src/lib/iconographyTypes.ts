import type { IconPoint } from "../controllers/IconographyController";
import type { IconMappingEntry } from "./WeatherWidgetRenderer";

/** The two available iconography rendering styles. */
export type IconographyStyle = "classic" | "compact";

/** Return type of IconographyRenderer.buildAtlas (same shape as AtlasResult). */
export interface AtlasResult {
  atlas: HTMLCanvasElement;
  mapping: Record<string, IconMappingEntry>;
  getKey: (point: IconPoint) => string;
}

/**
 * Common interface implemented by all iconography widget renderers.
 * LayerComposer calls only buildAtlas() — the renderer handles image loading,
 * caching, and sprite-sheet packing internally.
 */
export interface IconographyRenderer {
  buildAtlas(points: IconPoint[], iconSize: number): AtlasResult;
}
