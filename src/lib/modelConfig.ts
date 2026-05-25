import type { InhouseManifest } from "./inhouseTypes";

export const REGIONAL_MODELS = new Set([
  "UWC-IG",
  "UWC-DINI",
  "BEL-BR",
  "BEL-FO",
  "BEL-IS",
  "ECMWF-IS",
  "ICON-EU",
  "RAP",
]);
export const GLOBAL_MODELS = new Set(["GFS", "ECMWF", "GWES"]);

/** Preferred display order for the model chooser. Models not listed sort to the end alphabetically. */
export const MODEL_DISPLAY_ORDER: readonly string[] = [
  "BEL-IS",
  "UWC-IG",
  "UWC-DINI",
  "ECMWF-IS",
  "BEL-FO",
  "BEL-BR",
  "ICON-EU",
  "RAP",
  "ECMWF",
  "GFS",
  "GWES",
];

/** Sort a list of model ids according to MODEL_DISPLAY_ORDER. */
export const sortModels = (ids: string[]): string[] => {
  const rank = new Map(MODEL_DISPLAY_ORDER.map((id, i) => [id, i]));
  return [...ids].sort(
    (a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b),
  );
};
export const DEFAULT_VIEW = {
  center: [-20, 55] as [number, number],
  zoom: 3.2,
};
export const DEFAULT_NON_WAVES_MODEL = "GFS";
export const DEFAULT_MODEL_MAX_ZOOM = 12;
export const WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0 = 78271.51696402048;
export const MODEL_RESOLUTION_METERS: Record<string, number> = {
  GWES: 25000,
  ECMWF: 25000,
  GFS: 25000,
  RAP: 13000,
  "ICON-EU": 7000,
  "ECMWF-IS": 10000,
  "BEL-BR": 3200,
  "BEL-FO": 3000,
  "BEL-IS": 2000,
  "UWC-IG": 2000,
  "UWC-DINI": 2000,
};

export const shouldCenterOnBounds = (
  model: string,
  bounds: [number, number, number, number],
) => {
  if (REGIONAL_MODELS.has(model)) return true;
  const lonSpan = Math.abs(bounds[2] - bounds[0]);
  const latSpan = Math.abs(bounds[3] - bounds[1]);
  return lonSpan < 200 && latSpan < 120;
};

export const getModelResolutionMeters = (
  model: string,
  manifest?: InhouseManifest | null,
) => {
  const manifestResolution = manifest?.rendering?.resolutionMeters;
  if (
    typeof manifestResolution === "number" &&
    Number.isFinite(manifestResolution) &&
    manifestResolution > 0
  ) {
    return manifestResolution;
  }
  return MODEL_RESOLUTION_METERS[model] ?? null;
};

export const getModelDefaultCenter = (
  model: string,
  bounds?: [number, number, number, number] | null,
): [number, number] => {
  if (model === "UWC-IG") return [-36, 68.5];
  if (model === "RAP") return [-60, 62];
  if (GLOBAL_MODELS.has(model)) return DEFAULT_VIEW.center;
  if (bounds) {
    return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  }
  return DEFAULT_VIEW.center;
};

export const getMetersPerPixelAtLatitude = (latitude: number, zoom: number) =>
  (WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0 * Math.cos((latitude * Math.PI) / 180)) /
  2 ** zoom;
