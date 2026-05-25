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
  analysisTime: string;
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
