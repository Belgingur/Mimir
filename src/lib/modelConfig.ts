import { domainMaskExtent } from "./domainMask";
import type {
  InhouseManifest,
  ModelBBox,
  ModelCoverage,
  ModelView,
} from "./inhouseTypes";
import { modelContainsPoint } from "./selectModel";

/**
 * How the viewer treats a forecast model, worked out from the catalog alone.
 *
 * Nothing here names a model. A deployment describes its models in
 * models.json (where each has data, how fine its grid is, which one is
 * preferred where, how to frame it, in what order to list them) and in each
 * variable's manifest, and the behaviour follows from that. A catalog with
 * none of the optional fields still works: models are listed as given, framed
 * on their bounds, and zoom-capped from their manifests. See the README's
 * "Catalog Files" section for the fields.
 */

/** [west, south, east, north] in degrees, as manifests give bounds. */
export type Bounds = [number, number, number, number];

/** Web Mercator ground resolution at zoom 0 on the equator, for 512-px tiles. */
export const WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0 = 78271.51696402048;

/** Zoom cap for a model whose resolution cannot be established. */
export const DEFAULT_MODEL_MAX_ZOOM = 12;

/** Kilometres per degree of latitude. */
const KM_PER_DEGREE_LAT = 111.32;

export const getMetersPerPixelAtLatitude = (latitude: number, zoom: number) =>
  (WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0 * Math.cos((latitude * Math.PI) / 180)) /
  2 ** zoom;

const toBBox = (bounds: Bounds): ModelBBox => ({
  west: bounds[0],
  south: bounds[1],
  east: bounds[2],
  north: bounds[3],
});

/**
 * Whether a domain spans the globe, as a global model's does. Such a model has
 * data wherever the reader looks, so it never needs framing.
 *
 * Spanning every longitude is not enough: a regional domain that crosses the
 * pole or the antimeridian can do that too, so the test also asks for most of
 * the latitudes. A wave model whose grid stops short of the poles still counts.
 */
export const isGlobalDomain = (domain: ModelBBox | Bounds): boolean => {
  const { west, south, east, north } = Array.isArray(domain)
    ? toBBox(domain)
    : domain;
  return Math.abs(east - west) >= 359 && Math.abs(north - south) >= 150;
};

/**
 * The spacing of a manifest's grid, in metres: its declared
 * `rendering.resolutionMeters`, else the north-south spacing of its frames.
 * North-south spacing is the same everywhere on a lat/lon image, where
 * east-west spacing shrinks towards the poles, so it is the one honest figure
 * for a whole domain. scripts/catalog_coverage.py estimates resolution_km the
 * same way.
 */
export const manifestGridSpacingMeters = (
  manifest: InhouseManifest | null | undefined,
): number | null => {
  if (!manifest) return null;
  const declared = manifest.rendering?.resolutionMeters;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) {
    return declared;
  }
  const height = Array.isArray(manifest.shape)
    ? manifest.shape[1]
    : manifest.shape?.height;
  const bounds = manifest.bounds;
  if (!height || !bounds) return null;
  const latSpan = Math.abs(bounds[3] - bounds[1]);
  const meters = (latSpan * KM_PER_DEGREE_LAT * 1000) / height;
  return Number.isFinite(meters) && meters > 0 ? meters : null;
};

/**
 * A model's resolution in metres: `resolution_km` from models.json when the
 * catalog gives it (a published figure), else the grid spacing of a manifest
 * of the model, when one is to hand.
 */
export const modelResolutionMeters = (
  coverage: ModelCoverage | null | undefined,
  manifest?: InhouseManifest | null,
): number | null => {
  const km = coverage?.resolutionKm;
  if (typeof km === "number" && Number.isFinite(km) && km > 0) return km * 1000;
  return manifestGridSpacingMeters(manifest);
};

/**
 * Whether a model has data where the reader is looking.
 *
 * This is the one question that decides whether a model switch may move the
 * camera: the map stays where the reader left it unless staying would show
 * them a region the model does not cover.
 *
 * The test is the viewport's CENTRE, not its extent: the cheap, legible
 * meaning of "where you are looking". A view centred just outside a domain
 * counts as uncovered even with a corner of the domain on screen, which is
 * what you want, since that reader is looking somewhere else.
 *
 * The catalog's coverage is used when it has any, and its data mask or
 * polygon when it gives one; otherwise the bounds of a loaded manifest. A
 * global domain covers every view.
 */
export const modelCoversPoint = (
  coverage: ModelCoverage | null | undefined,
  bounds: Bounds | null | undefined,
  center: [number, number],
): boolean => {
  const [lon, lat] = center;
  const domain = coverage?.bbox ?? (bounds ? toBBox(bounds) : null);
  if (!domain && !coverage?.domainPolygon) return false;
  if (domain && isGlobalDomain(domain)) return true;
  if (coverage?.domainMask || coverage?.domainPolygon) {
    return modelContainsPoint({ ...coverage, marginKm: 0 }, lat, lon);
  }
  if (!domain) return false;
  const { west, south, east, north } = domain;
  if (lat < Math.min(south, north) || lat > Math.max(south, north)) return false;
  // A domain spanning the antimeridian arrives with east < west.
  return east < west
    ? lon >= west || lon <= east
    : lon >= Math.min(west, east) && lon <= Math.max(west, east);
};

/** How to frame a model for a reader who is looking somewhere else. */
export type ModelFraming = { view: ModelView } | { bounds: Bounds };

/**
 * Where to put the camera to show a model: the `view` models.json gives it,
 * else the extent of its data, else its bounds. Null for a global model, which
 * covers wherever the reader already is.
 *
 * A `view` is for domains whose data sits awkwardly in its bounds: one that
 * crosses the pole spans every longitude, and framing all of it shows the
 * whole hemisphere.
 */
export const modelFraming = (
  coverage: ModelCoverage | null | undefined,
  bounds: Bounds | null | undefined,
): ModelFraming | null => {
  const domain = coverage?.bbox ?? (bounds ? toBBox(bounds) : null);
  if (domain && isGlobalDomain(domain)) return null;
  if (coverage?.view) return { view: coverage.view };
  if (coverage?.bbox && coverage.domainMask) {
    const extent = domainMaskExtent(coverage.domainMask, coverage.bbox);
    if (extent) return { bounds: extent };
  }
  if (!domain) return null;
  return { bounds: [domain.west, domain.south, domain.east, domain.north] };
};
