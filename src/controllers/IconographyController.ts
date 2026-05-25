/**
 * IconographyController
 *
 * Manages a "forecast iconography" view mode that renders a composite weather
 * display at each grid/city point on the map:
 *   • Yr.no-style condition icon   (cloud cover + precipitation + temperature type)
 *   • Temperature text label        (°C)
 *   • Wind arrow                    (direction + speed)
 *
 * Variables loaded (best-effort, in priority order):
 *   cloud_area_fraction              – cloud fraction (0–1 or 0–100%, auto-detected)
 *   lwe_precipitation_rate           – precip rate mm/hr (or mm/s, normalised)
 *   air_temperature_at_2m_agl        – 2-m temperature in °C (or K, normalised)
 *   wind_speed_at_10m_agl            – 10-m wind speed m/s
 *   wind_from_direction_at_10m_agl   – 10-m wind FROM direction, degrees CW from N
 *   convective_available_potential_energy – CAPE J/kg (optional, enables thunder icons)
 */

import { decodeScalarGrid } from "../lib/imageProcessing";
import {
  resolveManifestTimes,
  formatIndex,
} from "../lib/inhouseCatalogHelpers";
import {
  classifyWeatherCondition,
  getSunPhase,
} from "../lib/weatherConditions";
import { sampleScalarGridAtCoord } from "../lib/gridSampling";
import { getIconGridForZoom } from "../lib/zoomSteps";
import type { InhouseManifest } from "../lib/inhouseTypes";
import type * as WeatherLayers from "weatherlayers-gl";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IconPoint {
  position: [number, number]; // [lon, lat]
  icon: string; // Yr.no icon code, e.g. "01d", "09"
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null; // degrees clockwise from North (wind FROM direction)
  name?: string; // city name (named-place mode only)
}

interface ScalarVar {
  manifest: InhouseManifest | null;
  times: string[];
  grid: { data: Float32Array; width: number; height: number } | null;
  /** True if the raw values are in Kelvin and need –273.15 offset */
  isKelvin: boolean;
  /** True if the raw values are in mm/s and need ×3600 */
  isPrecipMmS: boolean;
}

interface CityEntry {
  name: string;
  lon: number;
  lat: number;
  rank: number; // 1 = major city, 4 = small town
}

export interface IconographyDeps {
  inhouseRoot: string;
  isDev: boolean;
  /** Loads and caches a WebP frame, returning texture data */
  loadInhouseTexture: (
    url: string,
    signal?: AbortSignal,
  ) => Promise<WeatherLayers.TextureData | null>;
  /** Loads and caches a manifest.json */
  loadInhouseManifest: (
    model: string,
    analysis: string,
    variable: string,
  ) => Promise<InhouseManifest | null>;
  /** Returns the URL base for a variable: {root}/forecast-data/{model}/{analysis}/{variable} */
  getVariableBaseUrl: (
    model: string,
    analysis: string,
    variable: string,
  ) => string;
  /** Currently selected in-house model */
  getSelectedModel: () => string;
  /** Currently selected in-house analysis run */
  getSelectedAnalysis: () => string;
  /** Current time index from the shared timeline */
  getTimeIndex: () => number;
  /** Current datetime ISO string for the active time step */
  getCurrentDatetime: () => string;
  /** Viewport bounds */
  getMapBounds: () => {
    getSouth(): number;
    getWest(): number;
    getNorth(): number;
    getEast(): number;
  };
  /** Current map zoom */
  getMapZoom: () => number;
  /** Trigger a layer rebuild */
  scheduleUpdateLayers: () => void;
}

// Variable name candidates per logical role (ordered by preference)
const CLOUD_VARS = [
  "cloud_area_fraction",
  "total_cloud_cover",
  "cloud_fraction",
];
const PRECIP_VARS = [
  "lwe_precipitation_rate",
  "precipitation_rate",
  "precipitation_amount",
];
const TEMP_VARS = [
  "air_temperature_at_2m_agl",
  "air_temperature_2m",
  "air_temperature",
];
const WIND_SPD_VARS = ["wind_speed_at_10m_agl", "wind_speed_10m", "wind_speed"];
const WIND_DIR_VARS = [
  "wind_from_direction_at_10m_agl",
  "wind_from_direction_10m",
  "wind_direction_at_10m_agl",
  "wind_direction_10m",
  "wind_direction",
];
const CAPE_VARS = ["convective_available_potential_energy", "cape"];

const ICON_SIZE_PX = 48; // PNG icon size (from @yr/weather-symbols/dist/png/48/)

// Iconography always uses named places (cities.json or model-specific stations file).
// Grid mode has been removed — additional station files can be added per model.

const EMPTY_VAR: ScalarVar = {
  manifest: null,
  times: [],
  grid: null,
  isKelvin: false,
  isPrecipMmS: false,
};

// ─── Controller ──────────────────────────────────────────────────────────────

export class IconographyController {
  private readonly deps: IconographyDeps;

  private _active = false;
  private _model = "";
  private _analysis = "";
  private _loadAbort: AbortController | null = null;
  private _loadedModel = "";
  private _loadedAnalysis = "";
  private _lastTimeIndex = -1;

  // Per-role scalar variable state
  private _cloud: ScalarVar = { ...EMPTY_VAR };
  private _precip: ScalarVar = { ...EMPTY_VAR };
  private _temp: ScalarVar = { ...EMPTY_VAR };
  private _windSpd: ScalarVar = { ...EMPTY_VAR };
  private _windDir: ScalarVar = { ...EMPTY_VAR };
  private _cape: ScalarVar = { ...EMPTY_VAR };

  // Resolved variable names
  private _cloudVarName = "";
  private _precipVarName = "";
  private _tempVarName = "";
  private _windSpdVarName = "";
  private _windDirVarName = "";
  private _capeVarName = "";

  // Named places
  private _cities: CityEntry[] = [];
  private _citiesLoadedFor = ""; // model name the current _cities were loaded for

  // Output: current icon points (updated after each time step)
  private _iconPoints: IconPoint[] = [];
  private _lastBoundsKey = "";
  private _lastZoom = -1;

  // Dev diagnostic
  private _debugSampleCount = 0;

  constructor(deps: IconographyDeps) {
    this.deps = deps;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  activate(): void {
    this._active = true;
    if (this._loadedModel && this._loadedAnalysis) {
      // Model data already loaded when switching back from another view.
      // Grids are still in memory — skip re-fetching and rebuild icon points
      // directly from the existing data so the view appears immediately.
      this._lastBoundsKey = "";
      this._lastZoom = -1;
      this._rebuildIconPoints();
      this.deps.scheduleUpdateLayers();
    } else {
      void this._initForCurrentModel();
    }
  }

  deactivate(): void {
    this._active = false;
    this._loadAbort?.abort();
    this._loadAbort = null;
    this._iconPoints = [];
  }

  /** Call when the map moves or zooms so icon density is recalculated. */
  onMapMove(): void {
    if (!this._active) return;
    this._rebuildIconPoints();
    this.deps.scheduleUpdateLayers();
  }

  /** Call when the timeline time index changes (or after the first frame set loads). */
  onTimeChange(): void {
    if (!this._active) return;
    if (!this._loadedModel || !this._loadedAnalysis) {
      void this._initForCurrentModel();
      return;
    }
    void this._loadCurrentTimeStep();
  }

  /** Call when the model/analysis selection changes. */
  onModelChange(): void {
    if (!this._active) return;
    void this._initForCurrentModel();
  }

  get iconPoints(): IconPoint[] {
    return this._iconPoints;
  }
  get isActive(): boolean {
    return this._active;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  private async _initForCurrentModel(): Promise<void> {
    const model = this.deps.getSelectedModel();
    const analysis = this.deps.getSelectedAnalysis();
    if (!model || !analysis) return;
    if (model === this._loadedModel && analysis === this._loadedAnalysis)
      return;

    this._loadAbort?.abort();
    this._loadAbort = new AbortController();
    this._model = model;
    this._analysis = analysis;
    this._lastTimeIndex = -1;
    // Force a full rebuild when the model changes, even if the map hasn't moved.
    this._lastBoundsKey = "";
    this._lastZoom = -1;

    await Promise.all([
      this._resolveVariableNames(model, analysis),
      this._loadCitiesForModel(model),
    ]);
    this._loadedModel = model;
    this._loadedAnalysis = analysis;

    if (!this._active) return;
    this._lastTimeIndex = -1;
    await this._loadCurrentTimeStep();
  }

  private async _resolveVariableNames(
    model: string,
    analysis: string,
  ): Promise<void> {
    const tryLoad = async (
      candidates: string[],
    ): Promise<{ name: string; sv: ScalarVar } | null> => {
      for (const varName of candidates) {
        try {
          const manifest = await this.deps.loadInhouseManifest(
            model,
            analysis,
            varName,
          );
          if (!manifest) continue;
          const times = resolveManifestTimes(manifest);
          const isKelvin =
            varName.startsWith("air_temperature") && manifest.srcMax > 200;
          const isPrecipMmS = varName.includes("rate") && manifest.srcMax < 0.1;
          return {
            name: varName,
            sv: { manifest, times, grid: null, isKelvin, isPrecipMmS },
          };
        } catch {
          /* try next */
        }
      }
      return null;
    };

    const [c, p, t, ws, wd, ca] = await Promise.all([
      tryLoad(CLOUD_VARS),
      tryLoad(PRECIP_VARS),
      tryLoad(TEMP_VARS),
      tryLoad(WIND_SPD_VARS),
      tryLoad(WIND_DIR_VARS),
      tryLoad(CAPE_VARS),
    ]);

    this._cloudVarName = c?.name ?? "";
    this._precipVarName = p?.name ?? "";
    this._tempVarName = t?.name ?? "";
    this._windSpdVarName = ws?.name ?? "";
    this._windDirVarName = wd?.name ?? "";
    this._capeVarName = ca?.name ?? "";

    this._cloud = c?.sv ?? { ...EMPTY_VAR };
    this._precip = p?.sv ?? { ...EMPTY_VAR };
    this._temp = t?.sv ?? { ...EMPTY_VAR };
    this._windSpd = ws?.sv ?? { ...EMPTY_VAR };
    this._windDir = wd?.sv ?? { ...EMPTY_VAR };
    this._cape = ca?.sv ?? { ...EMPTY_VAR };

    if (this.deps.isDev) {
      console.log("[iconography] resolved variables", {
        cloud: this._cloudVarName,
        precip: this._precipVarName,
        temp: this._tempVarName,
        windSpd: this._windSpdVarName,
        windDir: this._windDirVarName || "(none)",
        cape: this._capeVarName || "(none)",
      });
    }
  }

  // ─── Frame loading ─────────────────────────────────────────────────────────

  private async _loadCurrentTimeStep(): Promise<void> {
    const model = this._model;
    const analysis = this._analysis;
    const timeIndex = this.deps.getTimeIndex();
    if (
      timeIndex === this._lastTimeIndex &&
      model === this._loadedModel &&
      analysis === this._loadedAnalysis
    )
      return;
    this._lastTimeIndex = timeIndex;

    const signal = this._loadAbort?.signal;

    const loadVar = async (sv: ScalarVar, varName: string): Promise<void> => {
      if (!sv.manifest || !varName) return;
      const count = sv.times.length;
      const clampedIndex = Math.max(0, Math.min(timeIndex, count - 1));
      const fileName = sv.manifest.fileTemplate.replace(
        "{index:03d}",
        formatIndex(clampedIndex, 3),
      );
      const baseUrl = this.deps.getVariableBaseUrl(model, analysis, varName);
      const url = `${baseUrl}/${fileName}`;
      try {
        const texture = await this.deps.loadInhouseTexture(url, signal);
        if (!texture) return;
        const imageUnscale: [number, number] | null =
          sv.manifest.imageUnscale ??
          (sv.manifest.srcMin != null && sv.manifest.srcMax != null
            ? [sv.manifest.srcMin, sv.manifest.srcMax]
            : null);
        sv.grid = decodeScalarGrid(texture, imageUnscale);
      } catch {
        // leave grid as-is if load fails
      }
    };

    await Promise.all([
      loadVar(this._cloud, this._cloudVarName),
      loadVar(this._precip, this._precipVarName),
      loadVar(this._temp, this._tempVarName),
      loadVar(this._windSpd, this._windSpdVarName),
      loadVar(this._windDir, this._windDirVarName),
      loadVar(this._cape, this._capeVarName),
    ]);

    if (!this._active) return;

    if (this.deps.isDev) {
      console.log("[iconography] grids loaded", {
        cloud: this._cloud.grid
          ? `${this._cloud.grid.width}x${this._cloud.grid.height}`
          : "null",
        precip: this._precip.grid
          ? `${this._precip.grid.width}x${this._precip.grid.height}`
          : "null",
        temp: this._temp.grid
          ? `${this._temp.grid.width}x${this._temp.grid.height}`
          : "null",
        windSpd: this._windSpd.grid
          ? `${this._windSpd.grid.width}x${this._windSpd.grid.height}`
          : "null",
        windDir: this._windDir.grid
          ? `${this._windDir.grid.width}x${this._windDir.grid.height}`
          : "null",
        cape: this._cape.grid
          ? `${this._cape.grid.width}x${this._cape.grid.height}`
          : "null",
      });
    }

    this._debugSampleCount = 0;
    // Reset bounds cache so _rebuildIconPoints always runs after loading new data
    this._lastBoundsKey = "";
    this._rebuildIconPoints();
    this.deps.scheduleUpdateLayers();
  }

  // ─── Icon point generation ─────────────────────────────────────────────────

  private _rebuildIconPoints(): void {
    const zoom = this.deps.getMapZoom();
    const bounds = this.deps.getMapBounds();
    const boundsKey = `${bounds.getSouth().toFixed(2)},${bounds.getWest().toFixed(2)},${bounds.getNorth().toFixed(2)},${bounds.getEast().toFixed(2)}`;

    if (
      boundsKey === this._lastBoundsKey &&
      Math.abs(zoom - this._lastZoom) < 0.1
    )
      return;
    this._lastBoundsKey = boundsKey;
    this._lastZoom = zoom;

    const points = this._buildNamedPlacePoints(bounds, zoom);

    if (this.deps.isDev) {
      console.log(
        `[iconography] rebuilt ${points.length} icon points (named mode, zoom ${zoom.toFixed(1)})`,
      );
    }

    this._iconPoints = points;
  }

  private _buildNamedPlacePoints(
    bounds: ReturnType<IconographyDeps["getMapBounds"]>,
    zoom: number,
  ): IconPoint[] {
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();
    const modelBounds = this._getModelBounds();
    const datetime = this.deps.getCurrentDatetime();
    const utcMs = datetime ? Date.parse(datetime) : Date.now();

    // Max rank to include at this zoom level (lower rank = more important).
    // zoom 5–6.5: rank 1 only   — BEL-IS "outermost" view (25 key stations)
    // zoom 6.5–7: rank 2        — regional zoom-in
    // zoom 7–8:   rank 3        — city-level
    // zoom 8+:    rank 4        — all stations
    // zoom < 5:   rank 2        — global/continental view (GFS etc.) needs
    //                             enough cities to be useful
    const maxRank =
      zoom >= 8 ? 4 : zoom >= 7 ? 3 : zoom >= 6.5 ? 2 : zoom >= 5 ? 1 : 2;

    const points: IconPoint[] = [];
    for (const city of this._cities) {
      if (city.rank > maxRank) continue;
      const { lon, lat } = city;
      if (lat < south || lat > north || lon < west || lon > east) continue;
      if (modelBounds && !this._inBounds(lon, lat, modelBounds)) continue;

      const pt = this._samplePoint(lon, lat, utcMs);
      if (pt) points.push({ ...pt, name: city.name });
    }
    return points;
  }

  private _samplePoint(
    lon: number,
    lat: number,
    utcMs: number,
  ): IconPoint | null {
    const hasAny = this._cloud.grid || this._precip.grid || this._temp.grid;
    if (!hasAny) return null;

    const modelBounds = this._getModelBounds() ?? [-180, -90, 180, 90];

    const sampleGrid = (sv: ScalarVar): number | null => {
      if (!sv.grid || !sv.manifest) return null;
      let v = sampleScalarGridAtCoord(sv.grid, modelBounds, [lon, lat]);
      if (v === null) return null;
      if (sv.isKelvin) v = v - 273.15;
      if (sv.isPrecipMmS) v = v * 3600;
      return v;
    };

    const cloudFractionRaw = sampleGrid(this._cloud);
    const precipRate = sampleGrid(this._precip);
    const temperature = sampleGrid(this._temp);
    const windSpeed = sampleGrid(this._windSpd);
    const windDirection = sampleGrid(this._windDir);
    const cape = sampleGrid(this._cape);

    if (
      cloudFractionRaw === null &&
      precipRate === null &&
      temperature === null
    )
      return null;

    // cloud_area_fraction may be decoded to 0–100 (%) or 0–1 depending on the
    // manifest's imageUnscale.  decodeScalarGrid uses imageUnscale for decoding,
    // so we must check imageUnscale[1] (not srcMax) to decide whether to normalise.
    // Example: srcMax=1 (fraction) but imageUnscale=[0,100] → decoded values are
    // 0–100 and need dividing by 100 to get the 0–1 range classifyWeatherCondition expects.
    const cloudDecodeMax =
      this._cloud.manifest?.imageUnscale?.[1] ??
      this._cloud.manifest?.srcMax ??
      1;
    const cloudFraction =
      cloudFractionRaw !== null
        ? cloudDecodeMax > 1
          ? cloudFractionRaw / cloudDecodeMax
          : cloudFractionRaw
        : null;

    const sunPhase = Number.isFinite(utcMs)
      ? getSunPhase(lat, lon, utcMs)
      : "day";

    if (this.deps.isDev && this._debugSampleCount < 3) {
      this._debugSampleCount++;
      console.log("[iconography] sample", {
        lon: lon.toFixed(2),
        lat: lat.toFixed(2),
        cloudRaw: cloudFractionRaw?.toFixed(3),
        cloudNorm: cloudFraction?.toFixed(3),
        cloudDecodeMax,
        precipRate: precipRate?.toFixed(4),
        temperature: temperature?.toFixed(1),
        windSpeed: windSpeed?.toFixed(1),
        windDirection: windDirection?.toFixed(0),
        sunPhase,
        cape: cape?.toFixed(0) ?? "n/a",
      });
    }

    const icon = classifyWeatherCondition({
      cloudFraction,
      precipRate,
      temperature,
      windSpeed,
      sunPhase,
      cape,
    });

    return {
      position: [lon, lat],
      icon,
      temperature,
      windSpeed,
      windDirection,
    };
  }

  // ─── Named places ──────────────────────────────────────────────────────────

  /**
   * Load named places for the given model. Tries a model-specific file first
   * (e.g. /data/stations-BEL-IS.json), then falls back to /data/cities.json.
   * Re-loads only when the model changes.
   */
  private async _loadCitiesForModel(model: string): Promise<void> {
    if (this._citiesLoadedFor === model) return;

    const urls = model
      ? [`/data/stations-${model}.json`, "/data/cities.json"]
      : ["/data/cities.json"];

    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const json = (await resp.json()) as {
          cities: [string, number, number, number][];
        };
        this._cities = json.cities.map(([name, lon, lat, rank]) => ({
          name,
          lon,
          lat,
          rank,
        }));
        this._citiesLoadedFor = model;
        if (this.deps.isDev) {
          console.log(
            `[iconography] loaded ${this._cities.length} named places from ${url}`,
          );
        }
        // Cities just changed — force a rebuild on the next update cycle.
        this._lastBoundsKey = "";
        this._lastZoom = -1;
        this.deps.scheduleUpdateLayers();
        return;
      } catch {
        /* try next */
      }
    }
    // No file found — keep any previously loaded list
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private _getModelBounds(): [number, number, number, number] | null {
    const manifest =
      this._cloud.manifest ?? this._precip.manifest ?? this._temp.manifest;
    return manifest?.bounds ?? null;
  }

  private _inBounds(
    lon: number,
    lat: number,
    bounds: [number, number, number, number],
  ): boolean {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  get modelBounds(): [number, number, number, number] | null {
    return this._getModelBounds();
  }

  get iconSize(): number {
    return getIconGridForZoom(this.deps.getMapZoom()).iconSize;
  }

  static iconUrl(code: string): string {
    return `/weather-icons/${code}.png`;
  }

  static iconDescriptor(code: string): {
    url: string;
    width: number;
    height: number;
    anchorY: number;
  } {
    return {
      url: IconographyController.iconUrl(code),
      width: ICON_SIZE_PX,
      height: ICON_SIZE_PX,
      anchorY: ICON_SIZE_PX,
    };
  }
}
