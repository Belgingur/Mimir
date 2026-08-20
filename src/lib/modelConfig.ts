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

/**
 * Where to frame each model whose domain does not fit its bounds box well —
 * used only when the user's view is outside the model's coverage, so it is a
 * "you were looking somewhere else, here is this model" view, never an override
 * of where the reader already was.
 */
export const MODEL_REFOCUS_VIEW: Record<
  string,
  { center: [number, number]; zoom: number }
> = {
  "BEL-IS": { center: [-19, 65], zoom: 6.0 },
  "UWC-IG": { center: [-36, 68.5], zoom: 3.5 },
  RAP: { center: [-60, 62], zoom: 2.5 },
  "UWC-DINI": { center: [-1.5, 53.8], zoom: 4.5 },
};

/**
 * Whether a model has data where the user is currently looking.
 *
 * This is the one question that decides if a model switch is allowed to move the
 * camera: the map stays where the user left it unless staying would show them a
 * region the new model does not cover. Global models cover everything, so they
 * never move it.
 *
 * The test is the viewport's CENTRE, not its full extent — the cheap, legible
 * definition of "where you are looking". A view centred just outside a domain
 * counts as uncovered even if a corner of the domain is still on screen, which
 * is the behaviour you want: that reader is looking somewhere else.
 */
export const modelCoversPoint = (
  model: string,
  bounds: [number, number, number, number] | null | undefined,
  center: [number, number],
): boolean => {
  if (GLOBAL_MODELS.has(model)) return true;
  if (!bounds) return false;
  const [west, south, east, north] = bounds;
  const [lon, lat] = center;
  if (lat < Math.min(south, north) || lat > Math.max(south, north)) return false;
  // A domain spanning the antimeridian arrives with east < west.
  return east < west
    ? lon >= west || lon <= east
    : lon >= Math.min(west, east) && lon <= Math.max(west, east);
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
