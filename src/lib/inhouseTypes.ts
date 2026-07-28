import type * as WeatherLayers from "weatherlayers-gl";
import type { LayerMode, IconographyStyle } from "./viewerTypes";

/** URL path segment for the forecast catalog served under `public/forecast-data/` in dev. */
export const FORECAST_DATA_SEGMENT = "forecast-data";

export type UiState = {
  visible: boolean;
  opacity: number;
  layerMode: LayerMode;
  showGrid: boolean;
  iconographyStyle: IconographyStyle;
};

export type ViewMode = "forecast" | "iconography";

export type CanonicalVariable =
  | "air_temperature"
  | "wind_speed"
  | "mean_sea_level_pressure";

export type CanonicalStyle = "raster" | "contour";

export type ProviderId = "cloud" | "inhouse";

export type ProviderFrame = {
  image: WeatherLayers.TextureData | null;
  bounds: [number, number, number, number];
  imageUnscale: [number, number];
  imageType: WeatherLayers.ImageType;
};

/** Geographic bounding box of a model domain (WGS84 lon/lat degrees). */
export type ModelBBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * Per-model coverage metadata used for automatic, location-based model
 * selection (task A2/A3). Populated from `models.json`; every field except
 * `id`/`available` is optional so pre-existing catalogs keep working.
 */
export type ModelCoverage = {
  id: string;
  title?: string;
  /** Model domain bbox (cheap first containment check). */
  bbox?: ModelBBox;
  /**
   * Optional precise domain as GeoJSON Polygon ring(s): `[[ [lon,lat], … ]]`.
   * Used for non-rectangular (rotated/curvilinear) domains after the bbox check.
   */
  domainPolygon?: number[][][];
  /** Grid resolution in km; lower = finer. Used to rank candidates. */
  resolutionKm?: number;
  /** Shrink the usable area inward by this many km to avoid domain-edge effects. */
  marginKm?: number;
  /**
   * Health flag: `false` when ops mark the model as having no data, so
   * selection skips it. Defaults to `true`.
   */
  available: boolean;
};

export type InhouseManifest = {
  bounds: [number, number, number, number];
  shape: { width: number; height: number } | [number, number];
  srcMin: number;
  srcMax: number;
  imageUnscale?: [number, number];
  imageScale?: string;
  unit?: string;
  fileTemplate: string;
  count: number;
  times?: string[];
  /** Model run label, e.g. "2026-07-16_00". */
  analysisTime: string;
  /** Model run / analysis time as ISO 8601 UTC, e.g. "2026-07-16T00:00:00Z". */
  analysisTimeISO?: string;
  /** When this manifest/dataset was produced, ISO 8601 UTC. */
  generatedAt?: string;
  historyIntervalMinutes?: number;
  encoding?: { kind?: string; dtype?: string };
  rendering?: { resolutionMeters?: number; [key: string]: unknown };
  contourSource?: { kind: string; url: string };
};

export type InhouseLayer = {
  id: string;
  model: string;
  analysis: string;
  variable: string;
  manifest: InhouseManifest;
  times: string[];
  visible: boolean;
  image: WeatherLayers.TextureData | null;
  scalar: { data: Float32Array; width: number; height: number } | null;
  rasterScalar: {
    data: Uint8Array;
    width: number;
    height: number;
    widthMeta?: number;
  } | null;
  rawRange?: [number, number] | null;
  domainMask?: Uint8Array;
  domainMaskOn?: number;
  renderMode: "raster" | "contour";
};

export type InhouseGroupId =
  | "temperature"
  | "wind"
  | "precip"
  | "waves"
  | "cloud"
  | "snow";

export type LayerGroupConfig = {
  id: UiState["layerMode"];
  title: string;
  provider: ProviderId;
  default?: boolean;
};

export const INHOUSE_WIND_VECTOR_VARIABLES = ["wind_uv_10m"];

export const INHOUSE_GROUP_VARIABLES: Record<
  InhouseGroupId,
  {
    primary: string[];
    windVector?: string[];
    windSpeed?: string[];
    windDir?: string[];
    /** Optional overlay variables loaded invisibly alongside the primary (e.g. snow_fraction). */
    overlay?: string[];
  }
> = {
  temperature: {
    primary: [
      "air_temperature_at_2m_agl",
      "air_temperature_2m",
      "air_temperature",
    ],
  },
  wind: {
    primary: [
      "wind_speed",
      "wind_speed_at_10m_agl",
      "wind_speed_10m",
      "wind_speed_10m_agl",
    ],
    windVector: INHOUSE_WIND_VECTOR_VARIABLES,
    windSpeed: [
      "wind_speed",
      "wind_speed_at_10m_agl",
      "wind_speed_10m",
      "wind_speed_10m_agl",
    ],
    windDir: [
      "wind_from_direction",
      "wind_direction",
      "wind_from_direction_at_10m_agl",
      "wind_direction_10m",
    ],
  },
  precip: {
    primary: [
      "lwe_precipitation_rate",
      "precipitation_rate",
      "total_precipitation",
      "precipitation_amount",
      "precipitation",
    ],
    windVector: INHOUSE_WIND_VECTOR_VARIABLES,
    windSpeed: [
      "wind_speed",
      "wind_speed_at_10m_agl",
      "wind_speed_10m",
      "wind_speed_10m_agl",
    ],
    windDir: [
      "wind_from_direction",
      "wind_direction",
      "wind_from_direction_at_10m_agl",
      "wind_direction_10m",
    ],
    overlay: ["snow_fraction"],
  },
  waves: {
    primary: ["significant_wave_height"],
    windSpeed: ["primary_wave_mean_period"],
    windDir: ["primary_wave_direction"],
  },
  cloud: {
    primary: ["cloud_area_fraction"],
  },
  snow: {
    primary: ["lwe_snow_depth", "snow_depth", "snow_water_equivalent"],
  },
};

export const INHOUSE_PRESETS = [
  {
    name: "Wind + MSLP",
    variables: ["wind_speed", "mean_sea_level_pressure"] as CanonicalVariable[],
  },
];

export const LAYER_GROUPS: LayerGroupConfig[] = [
  {
    id: "temperature",
    title: "layer.temperature",
    provider: "inhouse",
    default: true,
  },
  { id: "wind", title: "layer.wind", provider: "inhouse" },
  { id: "precip", title: "layer.precip", provider: "inhouse" },
  { id: "cloud", title: "layer.cloud", provider: "inhouse" },
  { id: "snow", title: "layer.snow", provider: "inhouse" },
  { id: "waves", title: "layer.waves", provider: "inhouse" },
];

export const WAVE_HEIGHT_VARIABLE = "significant_wave_height";
export const WAVE_PERIOD_VARIABLE = "primary_wave_mean_period";
export const WAVE_DIRECTION_VARIABLE = "primary_wave_direction";
export const WAVE_DIRECTION_IS_FROM = true;
