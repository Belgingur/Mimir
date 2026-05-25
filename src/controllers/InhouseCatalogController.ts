import type * as WeatherLayers from "weatherlayers-gl";
import { LRUMap } from "../lib/LRUMap";
import {
  normalizeIdList,
  normalizeVariableList,
  pickDefaultId,
  resolveSelectionChange,
  pickValidGroupForModel as sharedPickValidGroupForModel,
  GWES_MODEL_ID,
} from "../lib/selectionRules";
import {
  resolveInhouseUnit,
  formatIndex,
  resolveManifestTimes,
} from "../lib/inhouseCatalogHelpers";
import {
  getInhouseLayerUnscale,
  getInhouseLayerImageScale,
} from "../lib/inhouseLayerHelpers";
import {
  matchNearestTimeIndex,
  filterTimesByRange,
} from "../lib/timelineHelpers";
import { decodeScalarGrid } from "../lib/imageProcessing";
import { sampleInhouseScalarAtCoord } from "../lib/gridSampling";
import { clamp } from "../lib/mathUtils";
import {
  FORECAST_DATA_SEGMENT,
  INHOUSE_GROUP_VARIABLES,
  INHOUSE_PRESETS,
  WAVE_HEIGHT_VARIABLE,
} from "../lib/inhouseTypes";
import type {
  InhouseManifest,
  InhouseLayer,
  InhouseGroupId,
  CanonicalVariable,
  CanonicalStyle,
  ProviderId,
  ProviderFrame,
} from "../lib/inhouseTypes";
import type { DatetimeRange } from "../lib/timelineHelpers";
import { t } from "../lib/i18n";

export interface CloudProviderDeps {
  loadDatasetSlice: (
    datasetId: string,
    range: unknown,
  ) => Promise<{ datetimes: string[] }>;
  loadDatasetData: (
    datasetId: string,
    datetime: string,
  ) => Promise<{
    image: WeatherLayers.TextureData;
    bounds: [number, number, number, number];
    imageUnscale?: [number, number] | null;
    imageType?: WeatherLayers.ImageType;
  }>;
  offsetDatetimeRange: (iso: string, back: number, fwd: number) => unknown;
  imageTypeScalar: WeatherLayers.ImageType;
  imageUnscaleDefault: [number, number];
}

export function createCloudForecastProvider(
  datasetId: string,
  deps: CloudProviderDeps,
): ForecastProvider {
  return {
    id: "cloud" as ProviderId,
    async getDatetimes(range: DatetimeRange | null) {
      const slice = range
        ? await deps.loadDatasetSlice(datasetId, range)
        : await deps.loadDatasetSlice(
            datasetId,
            deps.offsetDatetimeRange(new Date().toISOString(), 0, 24),
          );
      return slice.datetimes;
    },
    async loadFrame(datetime: string) {
      const data = await deps.loadDatasetData(datasetId, datetime);
      return {
        image: data.image,
        bounds: data.bounds,
        imageUnscale: data.imageUnscale ?? deps.imageUnscaleDefault,
        imageType: data.imageType ?? deps.imageTypeScalar,
      };
    },
  };
}
import {
  DEFAULT_MODEL_MAX_ZOOM,
  WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0,
  GLOBAL_MODELS,
  DEFAULT_VIEW,
  DEFAULT_NON_WAVES_MODEL,
  shouldCenterOnBounds,
  getModelResolutionMeters,
  getModelDefaultCenter,
  getMetersPerPixelAtLatitude,
  sortModels,
} from "../lib/modelConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariableMeta {
  id: string;
  title?: string;
  unit?: string;
  defaultLayer?: string;
  contourInterval?: number;
  majorInterval?: number;
}

export interface InhouseCatalogDom {
  inhouseModelSelect: HTMLSelectElement;
  inhouseAnalysisSelect: HTMLSelectElement;
  inhouseVariableSelect: HTMLSelectElement | null;
  inhousePresetSelect: HTMLSelectElement | null;
  inhouseAddLayerBtn: HTMLButtonElement | null;
  inhouseLayersEl: HTMLDivElement | null;
  inhouseWarningEl: HTMLDivElement;
  inhouseTooltip: HTMLDivElement;
}

export interface ForecastProvider {
  id: ProviderId;
  getDatetimes(range: DatetimeRange | null): Promise<string[]>;
  loadFrame(
    datetime: string,
    signal?: AbortSignal,
  ): Promise<ProviderFrame | null>;
}

export interface InhouseCatalogDeps {
  dom: InhouseCatalogDom;
  isDev: boolean;
  inhouseRoot: string;
  persistedModelId: string | null;

  // Map interactions
  getMapContainer: () => { clientWidth: number; clientHeight: number };
  setMapMaxZoom: (zoom: number) => void;
  getMapZoom: () => number;
  setMapZoom: (zoom: number) => void;
  easeToMap: (options: {
    center?: [number, number];
    zoom?: number;
    duration?: number;
  }) => void;
  fitMapBounds: (
    bounds: [number, number, number, number],
    options: { padding: number; duration: number; maxZoom: number },
  ) => void;

  // Shared state accessors
  getCurrentDatetime: () => string;
  setCurrentDatetime: (dt: string) => void;
  isRestoringFromPersisted: () => boolean;
  setRestoringFromPersisted: (v: boolean) => void;
  getPendingTimeIndex: () => number | null;
  setPendingTimeIndex: (v: number | null) => void;
  isMapReady: () => boolean;
  getLastFrameLoadHadErrors: () => boolean;
  setLastFrameLoadHadErrors: (v: boolean) => void;
  getUiState: () => {
    layerMode: string;
    visible: boolean;
    opacity: number;
    showGrid: boolean;
  };

  // Cross-controller callbacks
  scheduleUpdateLayers: () => void;
  schedulePersistState: () => void;
  onSelectorsRefreshed: (
    models: string[],
    selectedModel: string,
    variables: string[],
  ) => void;

  // Sampling callback (sampleVectorAtPosition lives in main.ts / tooltip scope)
  sampleVectorAtPosition: (
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    position: [number, number],
  ) => { value: number | null; direction: number | null };

  // Cloud provider factory (for temperature fallback via WeatherLayers client)
  createCloudProvider: (datasetId: string) => ForecastProvider;

  // Contour worker interaction
  onContourWorkerResult: (
    key: string,
    cache: LRUMap<string, { path: [number, number][]; value: number }[]>,
  ) => void;
}

// ---------------------------------------------------------------------------
// Canonical variable definitions
// ---------------------------------------------------------------------------

export const CANONICAL_VARIABLES: Record<
  CanonicalVariable,
  {
    title: string;
    unit: string;
    style: CanonicalStyle;
    palette?: WeatherLayers.Palette;
    contourInterval?: number;
  }
> = {
  air_temperature: {
    title: "Air temperature",
    unit: "°C",
    style: "raster",
  },
  wind_speed: {
    title: "Wind speed",
    unit: "m/s",
    style: "raster",
  },
  mean_sea_level_pressure: {
    title: "Mean sea level pressure",
    unit: "hPa",
    style: "contour",
    contourInterval: 4,
  },
};

export const VARIABLE_SUBSTITUTIONS: Record<
  CanonicalVariable,
  {
    cloud: { datasetId: string };
    inhouse: Record<string, string>;
  }
> = {
  air_temperature: {
    cloud: { datasetId: "gfs/temperature_2m_above_ground" },
    inhouse: { "gfs-1": "air_temperature_at_2m_agl" },
  },
  wind_speed: {
    cloud: { datasetId: "gfs/wind_10m_above_ground" },
    inhouse: { "gfs-1": "wind_speed" },
  },
  mean_sea_level_pressure: {
    cloud: { datasetId: "gfs/air_pressure_at_sea_level" },
    inhouse: { "gfs-1": "air_pressure_at_sea_level" },
  },
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class InhouseCatalogController {
  private readonly deps: InhouseCatalogDeps;

  // --- Catalog state ---
  private _inhouseModels: string[] = [];
  private _inhouseAnalyses: string[] = [];
  private _inhouseVariables: string[] = [];
  private _inhouseVariableMeta: Record<string, VariableMeta> = {};
  private _inhouseSelectedModel = "";
  private _inhouseSelectedAnalysis = "";
  private _inhouseSelectedVariable = "";
  private _inhouseTimeIndex = 0;
  private _inhouseAbort: AbortController | null = null;
  private _inhouseCatalogReady: Promise<void> | null = null;
  private readonly _inhouseLayers: InhouseLayer[] = [];

  // --- Caches ---
  private readonly _textureCache = new LRUMap<
    string,
    WeatherLayers.TextureData
  >(50);
  private readonly _manifestCache = new LRUMap<string, InhouseManifest>(100);
  private readonly _contourCache = new LRUMap<
    string,
    { path: [number, number][]; value: number }[]
  >(50);
  private readonly _contourPending = new Set<string>();
  private readonly _textureDebugLogged = new Set<string>();
  private readonly _rasterDebugLogged = new Set<string>();
  private readonly _rasterScalarCache = new LRUMap<
    string,
    { data: Uint8Array; width: number; height: number; widthMeta?: number }
  >(50);
  private readonly _scalarCache = new LRUMap<
    string,
    { data: Float32Array; width: number; height: number }
  >(50);

  // --- Misc state ---
  private _precipCandidateIndex = 0;
  private _precipFallbackInFlight = false;
  private _lastCenteredInhouseKey = "";
  private _inhouseHoverLastTs = 0;
  readonly WIND_STREAMLINE_FLIP = false;

  // --- Tooltip state ---
  private _contourHoverRaf: number | null = null;
  private _contourHoverPending: {
    layer: InhouseLayer;
    info: { x?: number; y?: number; coordinate?: [number, number] };
    bounds: [number, number, number, number];
  } | null = null;

  constructor(deps: InhouseCatalogDeps) {
    this.deps = deps;
    this.attachDomListeners();
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  get inhouseModels(): string[] {
    return this._inhouseModels;
  }
  get inhouseAnalyses(): string[] {
    return this._inhouseAnalyses;
  }
  get inhouseVariables(): string[] {
    return this._inhouseVariables;
  }
  get inhouseVariableMeta(): Record<string, VariableMeta> {
    return this._inhouseVariableMeta;
  }
  get inhouseSelectedModel(): string {
    return this._inhouseSelectedModel;
  }
  get inhouseSelectedAnalysis(): string {
    return this._inhouseSelectedAnalysis;
  }
  get inhouseSelectedVariable(): string {
    return this._inhouseSelectedVariable;
  }
  get inhouseTimeIndex(): number {
    return this._inhouseTimeIndex;
  }
  get inhouseLayers(): InhouseLayer[] {
    return this._inhouseLayers;
  }
  get inhouseCatalogReady(): Promise<void> | null {
    return this._inhouseCatalogReady;
  }
  get contourCache(): LRUMap<
    string,
    { path: [number, number][]; value: number }[]
  > {
    return this._contourCache;
  }
  get contourPending(): Set<string> {
    return this._contourPending;
  }
  get precipCandidateIndex(): number {
    return this._precipCandidateIndex;
  }
  get precipFallbackInFlight(): boolean {
    return this._precipFallbackInFlight;
  }

  // ---------------------------------------------------------------------------
  // Public setters for cross-controller coordination
  // ---------------------------------------------------------------------------

  set inhouseTimeIndex(val: number) {
    this._inhouseTimeIndex = val;
  }
  set precipCandidateIndex(val: number) {
    this._precipCandidateIndex = val;
  }

  // ---------------------------------------------------------------------------
  // Inhouse root / URL helpers
  // ---------------------------------------------------------------------------

  getInhouseRoot(): string {
    return this.deps.inhouseRoot
      ? this.deps.inhouseRoot.replace(/\/$/, "")
      : "";
  }

  getVariableBaseUrl(
    model: string,
    analysis: string,
    variable: string,
  ): string {
    const root = this.getInhouseRoot();
    return `${root}/${FORECAST_DATA_SEGMENT}/${model}/${analysis}/${variable}`;
  }

  async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url} (${response.status})`);
    }
    return (await response.json()) as T;
  }

  getInhouseFrameUrl(layer: InhouseLayer, index: number): string {
    const baseUrl = this.getVariableBaseUrl(
      layer.model,
      layer.analysis,
      layer.variable,
    );
    const fileName = layer.manifest.fileTemplate.replace(
      "{index:03d}",
      formatIndex(index, 3),
    );
    return `${baseUrl}/${fileName}`;
  }

  // ---------------------------------------------------------------------------
  // Zoom / centering
  // ---------------------------------------------------------------------------

  private getViewportMinDimensionPx(): number {
    const container = this.deps.getMapContainer();
    return Math.max(
      1,
      Math.min(container.clientWidth || 0, container.clientHeight || 0),
    );
  }

  computeModelMaxZoom(
    model: string,
    options?: {
      bounds?: [number, number, number, number] | null;
      manifest?: InhouseManifest | null;
    },
  ): number {
    const resolutionMeters = getModelResolutionMeters(model, options?.manifest);
    if (!resolutionMeters) {
      return DEFAULT_MODEL_MAX_ZOOM;
    }
    const center = getModelDefaultCenter(model, options?.bounds);
    const latitude = clamp(center[1], -85, 85);
    const targetSpanMeters = resolutionMeters * 35;
    const minDimensionPx = this.getViewportMinDimensionPx();
    const numerator =
      WEB_MERCATOR_METERS_PER_PIXEL_AT_Z0 *
      Math.cos((latitude * Math.PI) / 180) *
      minDimensionPx;
    const rawZoom = Math.log2(
      Math.max(targetSpanMeters, 1) > 0 ? numerator / targetSpanMeters : 1,
    );
    // BEL-IS: allow zooming to at least 7 so the Iceland overview (zoom 6) is reachable.
    const minAllowed = model === "BEL-IS" ? 7 : 1;
    const maxZoom = clamp(rawZoom, minAllowed, 14);
    if (this.deps.isDev) {
      const spanAtZoom =
        getMetersPerPixelAtLatitude(latitude, maxZoom) * minDimensionPx;
      console.debug("[model max zoom]", {
        model,
        resolutionMeters,
        targetSpanMeters,
        center,
        viewportMinDimensionPx: minDimensionPx,
        finalMaxZoom: maxZoom,
        resultingSpanMeters: spanAtZoom,
      });
    }
    return maxZoom;
  }

  applyModelZoomConstraints(
    model: string,
    options?: {
      bounds?: [number, number, number, number] | null;
      manifest?: InhouseManifest | null;
      animate?: boolean;
    },
  ): number {
    const maxZoom = this.computeModelMaxZoom(model, options);
    this.deps.setMapMaxZoom(maxZoom);
    if (this.deps.getMapZoom() > maxZoom) {
      if (options?.animate) {
        this.deps.easeToMap({ zoom: maxZoom, duration: 500 });
      } else {
        this.deps.setMapZoom(maxZoom);
      }
    }
    return maxZoom;
  }

  centerMapOnInhouseDomain(
    model: string,
    analysis: string,
    bounds: [number, number, number, number],
  ): void {
    // BEL-IS always opens at the Iceland overview, even when restoring persisted state.
    // Use jumpTo (not easeTo) so it can't be cancelled by subsequent map events.
    if (model === "BEL-IS") {
      this._lastCenteredInhouseKey = `${model}:${analysis}`;
      window.requestAnimationFrame(() => {
        this.deps.easeToMap({ center: [-19, 65], zoom: 6.0, duration: 0 });
      });
      return;
    }
    if (this.deps.isRestoringFromPersisted()) return;
    if (model === "UWC-IG") {
      this._lastCenteredInhouseKey = `${model}:${analysis}`;
      this.deps.easeToMap({ center: [-36, 68.5], zoom: 3.5, duration: 800 });
      return;
    }
    if (model === "RAP") {
      this._lastCenteredInhouseKey = `${model}:${analysis}`;
      this.deps.easeToMap({ center: [-60, 62], zoom: 2.5, duration: 800 });
      return;
    }
    if (model === "UWC-DINI") {
      this._lastCenteredInhouseKey = `${model}:${analysis}`;
      this.deps.easeToMap({ center: [-1.5, 53.8], zoom: 4.5, duration: 800 });
      return;
    }
    if (GLOBAL_MODELS.has(model)) {
      this._lastCenteredInhouseKey = "";
      this.deps.easeToMap({
        center: DEFAULT_VIEW.center as [number, number],
        zoom: DEFAULT_VIEW.zoom,
        duration: 800,
      });
      return;
    }
    if (!shouldCenterOnBounds(model, bounds)) return;
    const key = `${model}:${analysis}`;
    if (this._lastCenteredInhouseKey === key) return;
    this._lastCenteredInhouseKey = key;
    this.deps.fitMapBounds(bounds, {
      padding: 40,
      duration: 800,
      maxZoom: this.computeModelMaxZoom(model, { bounds }),
    });
  }

  // ---------------------------------------------------------------------------
  // Active layer queries
  // ---------------------------------------------------------------------------

  getActiveInhouseContourLayer(): InhouseLayer | null {
    const visibleRaster = this._inhouseLayers.some(
      (layer) => layer.visible && layer.renderMode === "raster",
    );
    if (visibleRaster) return null;
    for (let i = this._inhouseLayers.length - 1; i >= 0; i -= 1) {
      const layer = this._inhouseLayers[i];
      if (layer.visible && layer.renderMode === "contour" && layer.image)
        return layer;
    }
    return null;
  }

  findInhouseLayerByCandidates(candidates?: string[]): InhouseLayer | null {
    if (!candidates) return null;
    for (const candidate of candidates) {
      const match = this._inhouseLayers.find(
        (layer) => layer.variable === candidate,
      );
      if (match) return match;
    }
    return null;
  }

  isInhouseVectorLayer(layer: InhouseLayer | null | undefined): boolean {
    return layer?.manifest.encoding?.kind === "vector";
  }

  findPreferredInhouseWindVectorLayer(
    groupId: "wind" | "precip" = "wind",
  ): InhouseLayer | null {
    return this.findInhouseLayerByCandidates(
      INHOUSE_GROUP_VARIABLES[groupId].windVector,
    );
  }

  // ---------------------------------------------------------------------------
  // Warning & layer list rendering
  // ---------------------------------------------------------------------------

  setInhouseWarning(message = ""): void {
    this.deps.dom.inhouseWarningEl.textContent = message;
    this.deps.dom.inhouseWarningEl.hidden = !message;
  }

  renderInhouseLayersList(): void {
    const { inhouseLayersEl } = this.deps.dom;
    if (!inhouseLayersEl) return;
    if (!this._inhouseLayers.length) {
      inhouseLayersEl.textContent = t("inhouse.noLayers");
      return;
    }
    if (this.deps.isDev)
      console.log(
        "[inhouse] render layers list",
        this._inhouseLayers.map((l) => l.variable),
      );
    inhouseLayersEl.textContent = "";
    const layerMode = this.deps.getUiState().layerMode;
    if (layerMode === "waves") {
      this._inhouseLayers.forEach((layer) => {
        const row = document.createElement("div");
        row.className = "inhouse-layer-row";
        row.textContent = `${layer.model} · ${layer.analysis} · ${layer.variable}`;
        inhouseLayersEl.appendChild(row);
      });
      return;
    }
    this._inhouseLayers.forEach((layer) => {
      const container = document.createElement("div");

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.layerId = layer.id;
      checkbox.checked = layer.visible;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = `${layer.model} · ${layer.analysis} · ${layer.variable}`;
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(labelSpan);

      const renderLabel = document.createElement("label");
      renderLabel.className = "inhouse-render-mode";
      const renderSpan = document.createElement("span");
      renderSpan.textContent = t("inhouse.render");
      const select = document.createElement("select");
      select.dataset.renderMode = layer.id;
      const rasterOption = document.createElement("option");
      rasterOption.value = "raster";
      rasterOption.textContent = t("inhouse.raster");
      rasterOption.selected = layer.renderMode === "raster";
      const contourOption = document.createElement("option");
      contourOption.value = "contour";
      contourOption.textContent = t("inhouse.contour");
      contourOption.selected = layer.renderMode === "contour";
      select.appendChild(rasterOption);
      select.appendChild(contourOption);
      renderLabel.appendChild(renderSpan);
      renderLabel.appendChild(select);

      const removeBtn = document.createElement("button");
      removeBtn.dataset.removeId = layer.id;
      removeBtn.textContent = t("inhouse.remove");

      container.appendChild(toggleLabel);
      container.appendChild(renderLabel);
      container.appendChild(removeBtn);
      inhouseLayersEl.appendChild(container);
    });
    inhouseLayersEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener("change", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        const id = input.dataset.layerId;
        const layer = this._inhouseLayers.find((l) => l.id === id);
        if (layer) {
          layer.visible = input.checked;
          this.deps.scheduleUpdateLayers();
        }
      });
    });
    inhouseLayersEl.querySelectorAll("button[data-remove-id]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        const id = button.dataset.removeId;
        const idx = this._inhouseLayers.findIndex((l) => l.id === id);
        if (idx >= 0) {
          this._inhouseLayers.splice(idx, 1);
          this.renderInhouseLayersList();
          this.deps.scheduleUpdateLayers();
        }
      });
    });
    inhouseLayersEl
      .querySelectorAll("select[data-render-mode]")
      .forEach((el) => {
        el.addEventListener("change", (event) => {
          const select = event.currentTarget as HTMLSelectElement;
          const id = select.dataset.renderMode;
          const layer = this._inhouseLayers.find((l) => l.id === id);
          if (layer) {
            layer.renderMode =
              select.value === "contour" ? "contour" : "raster";
            this.deps.scheduleUpdateLayers();
          }
        });
      });
  }

  // ---------------------------------------------------------------------------
  // Time sync
  // ---------------------------------------------------------------------------

  syncInhouseTimeToTimeline(): void {
    const base = this._inhouseLayers[0];
    if (!base) return;
    if (
      this.deps.isRestoringFromPersisted() &&
      this.deps.getPendingTimeIndex() !== null
    ) {
      const clamped = Math.max(
        0,
        Math.min(base.times.length - 1, this.deps.getPendingTimeIndex()!),
      );
      this._inhouseTimeIndex = clamped;
      this.deps.setCurrentDatetime(
        base.times[this._inhouseTimeIndex] ?? this.deps.getCurrentDatetime(),
      );
      this.deps.setPendingTimeIndex(null);
      this.deps.setRestoringFromPersisted(false);
      this.deps.schedulePersistState();
      return;
    }
    const currentDatetime = this.deps.getCurrentDatetime();
    if (currentDatetime) {
      this._inhouseTimeIndex = matchNearestTimeIndex(
        base.times,
        currentDatetime,
      );
    } else {
      this._inhouseTimeIndex = Math.min(
        this._inhouseTimeIndex,
        Math.max(0, base.times.length - 1),
      );
    }
    if (this.deps.isRestoringFromPersisted()) {
      this.deps.setRestoringFromPersisted(false);
    }
    this.deps.schedulePersistState();
  }

  syncCurrentDatetimeToTimes(
    times: string[],
    preferredDatetime?: string | null,
  ): void {
    if (!times.length) return;
    const target =
      preferredDatetime || this.deps.getCurrentDatetime() || times[0];
    const idx = target ? matchNearestTimeIndex(times, target) : 0;
    this.deps.setCurrentDatetime(
      times[Math.max(0, Math.min(times.length - 1, idx))] ?? times[0],
    );
  }

  // ---------------------------------------------------------------------------
  // Texture loading
  // ---------------------------------------------------------------------------

  async loadInhouseTexture(
    url: string,
    signal?: AbortSignal,
  ): Promise<WeatherLayers.TextureData | null> {
    if (this._textureCache.has(url)) {
      const cached = this._textureCache.get(url) ?? null;
      if (cached && cached.width % 4 === 0) {
        return cached;
      }
      this._textureCache.delete(url);
    }
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to load frame ${url} (${response.status})`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const srcData = new Uint8Array(imageData.data.buffer.slice(0));
    const width = bitmap.width;
    const height = bitmap.height;
    // Pre-scan alpha
    let preAlphaOn = 0;
    let preAlphaPartial = 0;
    let preMinR = 255;
    let preMaxR = 0;
    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const a = srcData[i + 3];
      if (a >= 255) preAlphaOn += 1;
      else if (a > 0) preAlphaPartial += 1;
      if (r < preMinR) preMinR = r;
      if (r > preMaxR) preMaxR = r;
    }
    // Only ignore alpha (treat image as fully opaque) when there are NO fully-opaque pixels
    // AND NO partial-alpha pixels. Partial alpha indicates the image uses alpha for domain
    // masking (e.g. BEL-FO temperature), so we must preserve it to build a correct domain mask.
    const ignoreAlpha =
      preAlphaOn === 0 && preAlphaPartial === 0 && preMaxR > 0;
    // Normalize alpha
    for (let i = 0; i < srcData.length; i += 4) {
      let a = srcData[i + 3];
      if (ignoreAlpha) {
        a = 255;
      } else if (a === 0) {
        srcData[i] = 0;
        srcData[i + 1] = 0;
        srcData[i + 2] = 0;
      } else if (a > 0 && a < 255) {
        a = 255;
      }
      srcData[i + 3] = a;
    }
    let rawRange: [number, number] | null = null;
    const data = srcData;
    let alphaOn = 0;
    let alphaOff = 0;
    let min = 255;
    let max = 0;
    let minR = 255;
    let maxR = 0;
    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const alpha = srcData[i + 3];
      if (alpha >= 255) alphaOn += 1;
      else alphaOff += 1;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (alpha < 255) continue;
      if (r < min) min = r;
      if (r > max) max = r;
    }
    rawRange = Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
    const texture = {
      data,
      width,
      height,
      rawRange,
      widthMeta: width,
      alphaOn,
      alphaOff,
    } as WeatherLayers.TextureData;
    if (this.deps.isDev && !this._textureDebugLogged.has(url)) {
      this._textureDebugLogged.add(url);
      console.log("[inhouse] texture loaded", {
        url,
        width,
        height,
        textureWidth: texture.width,
        dataLength: data.length,
        expectedLength: data.length,
        alphaOn,
        alphaOff,
        minR,
        maxR,
        rawRange,
      });
    }
    this._textureCache.set(url, texture);
    return texture;
  }

  // ---------------------------------------------------------------------------
  // Manifest loading
  // ---------------------------------------------------------------------------

  async loadInhouseManifest(
    model: string,
    analysis: string,
    variable: string,
  ): Promise<InhouseManifest | null> {
    const key = `${model}:${analysis}:${variable}`;
    if (this._manifestCache.has(key)) {
      return this._manifestCache.get(key) ?? null;
    }
    const baseUrl = this.getVariableBaseUrl(model, analysis, variable);
    const manifest = await this.fetchJson<InhouseManifest>(
      `${baseUrl}/manifest.json`,
    );
    this._manifestCache.set(key, manifest);
    return manifest;
  }

  // ---------------------------------------------------------------------------
  // Frame set loading
  // ---------------------------------------------------------------------------

  async loadInhouseFrameSet(): Promise<void> {
    const base = this._inhouseLayers[0];
    if (!base) return;
    const targetTime = base.times[this._inhouseTimeIndex];
    if (!targetTime) return;
    if (this.deps.isDev)
      console.log("[inhouse] load frame set", {
        model: base.model,
        analysis: base.analysis,
        timeIndex: this._inhouseTimeIndex,
        time: targetTime,
        layers: this._inhouseLayers.map((l) => l.variable),
      });
    if (this._inhouseAbort) {
      this._inhouseAbort.abort();
    }
    this._inhouseAbort = new AbortController();
    const controller = this._inhouseAbort;
    const warningMessages: string[] = [];
    this.deps.setLastFrameLoadHadErrors(false);
    const failedVariables = new Set<string>();
    const results = await Promise.allSettled(
      this._inhouseLayers.map(async (layer) => {
        try {
          const matchIndex =
            layer === base
              ? this._inhouseTimeIndex
              : matchNearestTimeIndex(layer.times, targetTime);
          if (layer.times[matchIndex] !== targetTime) {
            warningMessages.push(
              `${layer.variable} time misaligned (nearest used).`,
            );
          }
          const baseUrl = this.getVariableBaseUrl(
            layer.model,
            layer.analysis,
            layer.variable,
          );
          const fileName = layer.manifest.fileTemplate.replace(
            "{index:03d}",
            formatIndex(matchIndex, 3),
          );
          const url = `${baseUrl}/${fileName}`;
          const asScalar = layer.manifest.encoding?.kind === "scalar";
          layer.image = await this.loadInhouseTexture(url, controller?.signal);

          let alphaOffCount = 0;
          let totalPixels = 0;
          if (layer.image && asScalar) {
            const { data, width, height, widthMeta, alphaOn } = layer.image as {
              data: Uint8Array | Uint8ClampedArray;
              width: number;
              height: number;
              widthMeta?: number;
              alphaOn?: number;
            };
            const alphaValid = (alphaOn ?? 0) > 0;
            const logicalWidth = widthMeta ?? width;
            totalPixels = logicalWidth * height;
            for (let y = 0; y < height; y += 1) {
              const row = y * width * 4;
              for (let x = 0; x < logicalWidth; x += 1) {
                if (alphaValid && data[row + x * 4 + 3] < 255)
                  alphaOffCount += 1;
              }
            }
            if (
              this.deps.isDev &&
              !this._rasterDebugLogged.has(`${layer.id}-alpha-debug`)
            ) {
              this._rasterDebugLogged.add(`${layer.id}-alpha-debug`);
              console.log("[inhouse] alpha coverage", {
                id: layer.id,
                alphaOffCount,
                totalPixels,
              });
            }
            if (alphaValid && alphaOffCount > 0) {
              const mask = new Uint8Array(logicalWidth * height);
              for (let y2 = 0; y2 < height; y2 += 1) {
                const row2 = y2 * width * 4;
                const dstRow = y2 * logicalWidth;
                for (let x2 = 0; x2 < logicalWidth; x2 += 1) {
                  mask[dstRow + x2] = data[row2 + x2 * 4 + 3] >= 255 ? 1 : 0;
                }
              }
              layer.domainMask = mask;
              layer.domainMaskOn = totalPixels - alphaOffCount;
            }
          }
          // Build domain mask for vector layers (e.g. wind_uv_10m) the same way.
          // Vector images have alpha=0 for out-of-domain pixels, exactly like scalar images,
          // but their mask was not built above because the block is guarded by asScalar.
          if (layer.image && !asScalar) {
            const {
              data: vData,
              width: vWidth,
              height: vHeight,
            } = layer.image as {
              data: Uint8Array | Uint8ClampedArray;
              width: number;
              height: number;
            };
            let vAlphaOffCount = 0;
            const vTotalPixels = vWidth * vHeight;
            for (let vi = 3; vi < vData.length; vi += 4) {
              if ((vData[vi] ?? 255) < 255) vAlphaOffCount += 1;
            }
            if (vAlphaOffCount > 0) {
              const vMask = new Uint8Array(vTotalPixels);
              for (let vy = 0; vy < vHeight; vy += 1) {
                for (let vx = 0; vx < vWidth; vx += 1) {
                  vMask[vy * vWidth + vx] =
                    (vData[(vy * vWidth + vx) * 4 + 3] ?? 255) >= 255 ? 1 : 0;
                }
              }
              layer.domainMask = vMask;
              layer.domainMaskOn = vTotalPixels - vAlphaOffCount;
            }
          }
          if (layer.image && asScalar) {
            if (this._scalarCache.has(url)) {
              layer.scalar = this._scalarCache.get(url) ?? null;
            } else {
              layer.scalar = decodeScalarGrid(
                layer.image,
                getInhouseLayerUnscale(layer),
                getInhouseLayerImageScale(layer),
              );
              if (layer.scalar) {
                this._scalarCache.set(url, layer.scalar);
              }
            }
            if (layer.scalar && layer.domainMask && totalPixels > 0) {
              const mask = layer.domainMask;
              const max = Math.min(mask.length, layer.scalar.data.length);
              for (let i = 0; i < max; i += 1) {
                if (mask[i] === 0) layer.scalar.data[i] = Number.NaN;
              }
            }
            if (!this._rasterDebugLogged.has(`${layer.id}-mask-debug`)) {
              this._rasterDebugLogged.add(`${layer.id}-mask-debug`);
              let maskOn = 0;
              let maskOff = 0;
              const mask = layer.domainMask;
              if (mask) {
                for (let i = 0; i < mask.length; i += 1) {
                  if (mask[i] === 1) maskOn += 1;
                  else maskOff += 1;
                }
              }
              if (this.deps.isDev)
                console.log("[inhouse] domain mask", {
                  id: layer.id,
                  maskOn,
                  maskOff,
                });
            }
          } else {
            layer.scalar = null;
          }
          if (layer.image && asScalar) {
            const canUseCachedRaster =
              this._rasterScalarCache.has(url) && !layer.domainMask;
            if (canUseCachedRaster) {
              layer.rasterScalar = this._rasterScalarCache.get(url) ?? null;
            } else {
              const { data, width, height, widthMeta, alphaOn } =
                layer.image as {
                  data: Uint8Array | Uint8ClampedArray;
                  width: number;
                  height: number;
                  widthMeta?: number;
                  alphaOn?: number;
                };
              const alphaValid2 = (alphaOn ?? 0) > 0;
              const logicalWidth = widthMeta ?? width;
              const paddedWidth =
                logicalWidth % 4 === 0
                  ? logicalWidth
                  : logicalWidth + (4 - (logicalWidth % 4));
              const output = new Uint8Array(paddedWidth * height);
              let rMin = 255;
              let rMax = 0;
              const scalar = layer.scalar;
              const scalarWidth = scalar?.width ?? logicalWidth;
              const scalarHeight = scalar?.height ?? height;
              const mask = layer.domainMask ?? null;
              for (let y = 0; y < height; y += 1) {
                const srcRow = y * width * 4;
                const dstRow = y * paddedWidth;
                for (let x = 0; x < logicalWidth; x += 1) {
                  const idx = srcRow + x * 4;
                  const alpha = alphaValid2 ? data[idx + 3] : 255;
                  let raw = alpha >= 255 ? data[idx] : 0;
                  if (scalar && y < scalarHeight && x < scalarWidth) {
                    const s = scalar.data[y * scalarWidth + x];
                    if (!Number.isFinite(s)) {
                      raw = 0;
                    }
                  }
                  if (mask && mask[y * logicalWidth + x] === 0) {
                    raw = 0;
                  }
                  output[dstRow + x] = raw;
                  if (alpha >= 255) {
                    if (raw < rMin) rMin = raw;
                    if (raw > rMax) rMax = raw;
                  }
                }
              }
              layer.rasterScalar = {
                data: output,
                width: paddedWidth,
                height,
                widthMeta: logicalWidth,
              };
              if (!layer.domainMask) {
                this._rasterScalarCache.set(url, layer.rasterScalar);
              }
              if (this.deps.isDev)
                console.log("[inhouse] rasterScalar range", {
                  id: layer.id,
                  min: rMin,
                  max: rMax,
                });
            }
          } else {
            layer.rasterScalar = null;
          }
          if (layer.image && asScalar) {
            const rawRange2 =
              (layer.image as { rawRange?: [number, number] | null })
                .rawRange ?? null;
            layer.rawRange = rawRange2;
            if (this.deps.isDev)
              console.log("[inhouse] raw range", {
                id: layer.id,
                rawRange: layer.rawRange,
              });
          } else {
            layer.rawRange = null;
          }
          // Pre-fetch adjacent frames
          const prevIndex = Math.max(0, matchIndex - 1);
          const nextIndex = Math.min(layer.times.length - 1, matchIndex + 1);
          const prevName = layer.manifest.fileTemplate.replace(
            "{index:03d}",
            formatIndex(prevIndex, 3),
          );
          const nextName = layer.manifest.fileTemplate.replace(
            "{index:03d}",
            formatIndex(nextIndex, 3),
          );
          void this.loadInhouseTexture(
            `${baseUrl}/${prevName}`,
            undefined,
          ).catch(() => undefined);
          void this.loadInhouseTexture(
            `${baseUrl}/${nextName}`,
            undefined,
          ).catch(() => undefined);
          return { layer, url };
        } catch (error) {
          throw { layer, error };
        }
      }),
    );
    results.forEach((result) => {
      if (result.status === "rejected") {
        const reasonObj = result.reason as
          | { error?: unknown; layer?: InhouseLayer }
          | undefined;
        const reason =
          reasonObj?.error instanceof Error
            ? reasonObj.error.message
            : String(reasonObj?.error ?? result.reason);
        if (/aborted/i.test(reason) || /AbortError/i.test(reason)) {
          return;
        }
        const failedVar = reasonObj?.layer?.variable;
        warningMessages.push(
          `Frame load failed${failedVar ? ` (${failedVar})` : ""}: ${reason}`,
        );
        if (reasonObj?.layer?.variable) {
          failedVariables.add(reasonObj.layer.variable);
        }
      }
    });
    if (
      warningMessages.some((msg) => msg.startsWith("Frame load failed")) &&
      failedVariables.size === 0
    ) {
      this._inhouseLayers.forEach((layer) =>
        failedVariables.add(layer.variable),
      );
    }
    if (failedVariables.size > 0) {
      const required = new Set<string>();
      const layerMode = this.deps.getUiState().layerMode;
      if (layerMode === "waves") {
        required.add(WAVE_HEIGHT_VARIABLE);
      } else if (layerMode === "wind") {
        const windSpeed = this.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.wind.windSpeed,
        );
        if (windSpeed) required.add(windSpeed.variable);
      } else if (layerMode === "precip") {
        const precipLayer = this._inhouseLayers.find((layer) =>
          INHOUSE_GROUP_VARIABLES.precip.primary.includes(layer.variable),
        );
        if (precipLayer) required.add(precipLayer.variable);
      } else if (layerMode === "temperature") {
        const tempLayer = this.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.temperature.primary,
        );
        if (tempLayer) required.add(tempLayer.variable);
      } else if (layerMode === "cloud") {
        const cloudLayer = this.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.cloud.primary,
        );
        if (cloudLayer) required.add(cloudLayer.variable);
      } else if (layerMode === "snow") {
        const snowLayer = this.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.snow.primary,
        );
        if (snowLayer) required.add(snowLayer.variable);
      }
      for (const variable of failedVariables) {
        if (required.has(variable)) {
          this.deps.setLastFrameLoadHadErrors(true);
          break;
        }
      }
    }
    if (this.deps.getLastFrameLoadHadErrors() && this.deps.isDev) {
      console.warn("[timeline] frame load failed", {
        datetime: this.deps.getCurrentDatetime(),
        warnings: warningMessages,
      });
    }
    if (
      this.deps.getUiState().layerMode === "precip" &&
      !this._precipFallbackInFlight
    ) {
      const precipLayer = this._inhouseLayers.find((layer) =>
        INHOUSE_GROUP_VARIABLES.precip.primary.includes(layer.variable),
      );
      if (precipLayer) {
        const imageAny = precipLayer.image as {
          alphaOn?: number;
          rawRange?: [number, number] | null;
        } | null;
        const alphaOn = imageAny?.alphaOn ?? 0;
        const rawRange = imageAny?.rawRange ?? precipLayer.rawRange ?? null;
        const isEmpty = alphaOn === 0 && (!rawRange || rawRange[1] <= 0);
        if (isEmpty) {
          const precipCandidates = this.getAvailablePrecipCandidates();
          const currentIdx = precipCandidates.indexOf(precipLayer.variable);
          if (currentIdx >= 0 && currentIdx < precipCandidates.length - 1) {
            this._precipCandidateIndex = currentIdx + 1;
            this._precipFallbackInFlight = true;
            void this.ensureInhouseGroupLayers("precip").finally(() => {
              this._precipFallbackInFlight = false;
            });
            return;
          }
        }
      }
    }
    this.setInhouseWarning(warningMessages.join(" "));
    this.deps.scheduleUpdateLayers();
  }

  // ---------------------------------------------------------------------------
  // Selector refresh
  // ---------------------------------------------------------------------------

  refreshInhouseSelectors(): void {
    const { inhouseModelSelect, inhouseAnalysisSelect, inhouseVariableSelect } =
      this.deps.dom;
    const fillSelect = (
      select: HTMLSelectElement,
      values: string[],
      emptyLabel: string,
    ) => {
      select.replaceChildren();
      if (!values.length) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = emptyLabel;
        select.appendChild(placeholder);
        return;
      }
      for (const value of values) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      }
    };
    fillSelect(inhouseModelSelect, this._inhouseModels, "No models");
    fillSelect(inhouseAnalysisSelect, this._inhouseAnalyses, "No analyses");
    if (inhouseVariableSelect) {
      fillSelect(inhouseVariableSelect, this._inhouseVariables, "No variables");
    }
    if (this._inhouseSelectedModel)
      inhouseModelSelect.value = this._inhouseSelectedModel;
    if (this._inhouseSelectedAnalysis)
      inhouseAnalysisSelect.value = this._inhouseSelectedAnalysis;
    if (this._inhouseSelectedVariable && inhouseVariableSelect)
      inhouseVariableSelect.value = this._inhouseSelectedVariable;
    if (!this._inhouseSelectedModel && this._inhouseModels.length) {
      this._inhouseSelectedModel = inhouseModelSelect.value;
    }
    if (!this._inhouseSelectedAnalysis && this._inhouseAnalyses.length) {
      this._inhouseSelectedAnalysis = inhouseAnalysisSelect.value;
    }
    if (
      !this._inhouseSelectedVariable &&
      this._inhouseVariables.length &&
      inhouseVariableSelect
    ) {
      this._inhouseSelectedVariable = inhouseVariableSelect.value;
    }
    this.deps.onSelectorsRefreshed(
      this._inhouseModels,
      this._inhouseSelectedModel,
      this._inhouseVariables,
    );
  }

  // ---------------------------------------------------------------------------
  // Catalog loading
  // ---------------------------------------------------------------------------

  async loadInhouseCatalog(): Promise<void> {
    const root = this.getInhouseRoot();
    try {
      const modelsRaw = await this.fetchJson<unknown>(
        `${root}/${FORECAST_DATA_SEGMENT}/models.json`,
      );
      const modelsNorm = normalizeIdList(modelsRaw);
      this._inhouseModels = sortModels(
        Array.isArray(modelsNorm) ? modelsNorm : modelsNorm.ids,
      );
      const preferredModel =
        this.deps.persistedModelId &&
        this._inhouseModels.includes(this.deps.persistedModelId)
          ? this.deps.persistedModelId
          : "";
      this._inhouseSelectedModel =
        preferredModel ||
        (Array.isArray(modelsNorm)
          ? (this._inhouseModels[0] ?? "")
          : pickDefaultId(this._inhouseModels, modelsNorm.defaultId));
    } catch (error) {
      this.setInhouseWarning(
        `Failed to load models.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (this._inhouseSelectedModel) {
      try {
        const analysesRaw = await this.fetchJson<unknown>(
          `${root}/${FORECAST_DATA_SEGMENT}/${this._inhouseSelectedModel}/analyses.json`,
        );
        const analysesNorm = normalizeIdList(analysesRaw, "latest");
        this._inhouseAnalyses = Array.isArray(analysesNorm)
          ? analysesNorm
          : analysesNorm.ids;
        this._inhouseSelectedAnalysis = Array.isArray(analysesNorm)
          ? (this._inhouseAnalyses[0] ?? "")
          : pickDefaultId(this._inhouseAnalyses, analysesNorm.defaultId);
      } catch (error) {
        this.setInhouseWarning(
          `Failed to load analyses.json: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (this._inhouseSelectedModel && this._inhouseSelectedAnalysis) {
      try {
        const varsRaw = await this.fetchJson<unknown>(
          `${root}/${FORECAST_DATA_SEGMENT}/${this._inhouseSelectedModel}/${this._inhouseSelectedAnalysis}/variables.json`,
        );
        const varsNorm = normalizeVariableList(varsRaw);
        this._inhouseVariables = varsNorm.ids;
        this._inhouseVariableMeta = varsNorm.meta;
        this._inhouseSelectedVariable = pickDefaultId(
          this._inhouseVariables,
          varsNorm.defaultId,
        );
      } catch (error) {
        this.setInhouseWarning(
          `Failed to load variables.json: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.refreshInhouseSelectors();
    if (!this._inhouseModels.length) {
      this.setInhouseWarning("No in-house models found.");
    }
    const layerMode = this.deps.getUiState().layerMode;
    if (layerMode !== "waves") {
      void this.ensureInhouseGroupLayers(layerMode as InhouseGroupId);
    }
  }

  async loadInhouseAnalyses(model: string): Promise<void> {
    this._inhouseSelectedModel = model;
    this._inhouseSelectedAnalysis = "";
    this._inhouseSelectedVariable = "";
    this._precipCandidateIndex = 0;
    this._inhouseAnalyses = [];
    this._inhouseVariables = [];
    if (this.deps.isMapReady()) {
      this.applyModelZoomConstraints(model, { animate: false });
    }
    try {
      const root = this.getInhouseRoot();
      const analysesRaw = await this.fetchJson<unknown>(
        `${root}/${FORECAST_DATA_SEGMENT}/${model}/analyses.json`,
      );
      const analysesNorm = normalizeIdList(analysesRaw, "latest");
      this._inhouseAnalyses = Array.isArray(analysesNorm)
        ? analysesNorm
        : analysesNorm.ids;
      this._inhouseSelectedAnalysis = Array.isArray(analysesNorm)
        ? (this._inhouseAnalyses[0] ?? "")
        : pickDefaultId(this._inhouseAnalyses, analysesNorm.defaultId);
      if (this._inhouseSelectedAnalysis) {
        const varsRaw = await this.fetchJson<unknown>(
          `${root}/${FORECAST_DATA_SEGMENT}/${model}/${this._inhouseSelectedAnalysis}/variables.json`,
        );
        const varsNorm = normalizeVariableList(varsRaw);
        this._inhouseVariables = varsNorm.ids;
        this._inhouseVariableMeta = varsNorm.meta;
        this._inhouseSelectedVariable = pickDefaultId(
          this._inhouseVariables,
          varsNorm.defaultId,
        );
      }
    } catch (error) {
      this.setInhouseWarning(
        `Failed to load analyses: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.refreshInhouseSelectors();
  }

  // ---------------------------------------------------------------------------
  // Layer group helpers (used by ensureInhouseGroupLayers + external callers)
  // ---------------------------------------------------------------------------

  pickFirstAvailableVariable(candidates: string[]): string {
    for (const candidate of candidates) {
      if (this._inhouseVariables.includes(candidate)) return candidate;
    }
    return "";
  }

  findVariableBySubstring(substrings: string[]): string {
    return (
      this._inhouseVariables.find((name) =>
        substrings.some((sub) => name.includes(sub)),
      ) ?? ""
    );
  }

  getAvailablePrecipCandidates(): string[] {
    return INHOUSE_GROUP_VARIABLES.precip.primary.filter((candidate) =>
      this._inhouseVariables.includes(candidate),
    );
  }

  isGroupAvailableForModel(groupId: InhouseGroupId): boolean {
    const group = INHOUSE_GROUP_VARIABLES[groupId];
    if (!group) return false;
    const primaryCandidates =
      groupId === "precip"
        ? this.getAvailablePrecipCandidates()
        : group.primary.filter((v) => this._inhouseVariables.includes(v));
    if (primaryCandidates.length) return true;
    const fallback = this.findVariableBySubstring(
      group.primary.map((name) => name.split("_").slice(0, 2).join("_")),
    );
    return Boolean(fallback);
  }

  pickValidGroupForModel(model: string): InhouseGroupId | null {
    return sharedPickValidGroupForModel(model, (group) =>
      this.isGroupAvailableForModel(group),
    );
  }

  resolveDefaultGroupForModel(model: string): string {
    return model === "GWES" ? "waves" : this.deps.getUiState().layerMode;
  }

  // ---------------------------------------------------------------------------
  // ensureInhouseGroupLayers
  // ---------------------------------------------------------------------------

  async ensureInhouseGroupLayers(groupId: InhouseGroupId): Promise<void> {
    if (!this._inhouseSelectedModel || !this._inhouseSelectedAnalysis) {
      this.setInhouseWarning("Select an in-house model and analysis first.");
      return;
    }
    const group = INHOUSE_GROUP_VARIABLES[groupId];
    if (!group) return;
    let primary = "";
    if (groupId === "precip") {
      const precipCandidates = this.getAvailablePrecipCandidates();
      if (precipCandidates.length) {
        const idx = Math.min(
          this._precipCandidateIndex,
          precipCandidates.length - 1,
        );
        primary = precipCandidates[idx];
      }
    }
    if (!primary) {
      primary =
        this.pickFirstAvailableVariable(group.primary) ||
        this.findVariableBySubstring(
          group.primary.map((name) => name.split("_").slice(0, 2).join("_")),
        );
    }
    const windSpeed =
      (group.windSpeed
        ? this.pickFirstAvailableVariable(group.windSpeed)
        : "") ||
      (groupId !== "temperature"
        ? this.findVariableBySubstring(["wind_speed"])
        : "");
    const windVector =
      (group.windVector
        ? this.pickFirstAvailableVariable(group.windVector)
        : "") ||
      (groupId !== "temperature"
        ? this.findVariableBySubstring(["wind_uv_10m"])
        : "");
    const windDir =
      (group.windDir ? this.pickFirstAvailableVariable(group.windDir) : "") ||
      (groupId !== "temperature"
        ? this.findVariableBySubstring([
            "wind_from_direction",
            "wind_direction",
          ])
        : "");
    if (!primary) {
      this.setInhouseWarning(
        `No ${groupId} variable found for ${this._inhouseSelectedModel}/${this._inhouseSelectedAnalysis}.`,
      );
      this._inhouseLayers.length = 0;
      this.renderInhouseLayersList();
      this.deps.scheduleUpdateLayers();
      return;
    }
    const specs: {
      variable: string;
      visible: boolean;
      renderMode: "raster" | "contour";
    }[] = [];
    if (groupId === "temperature") {
      specs.push({
        variable: primary,
        visible: true,
        renderMode: this.resolveInhouseRenderMode(primary),
      });
    } else if (groupId === "wind") {
      if (windSpeed) {
        specs.push({
          variable: windSpeed,
          visible: true,
          renderMode: this.resolveInhouseRenderMode(windSpeed),
        });
      }
      if (windVector && windVector !== windSpeed) {
        specs.push({
          variable: windVector,
          visible: false,
          renderMode: "raster",
        });
      } else if (windDir && windDir !== windSpeed) {
        specs.push({ variable: windDir, visible: false, renderMode: "raster" });
      }
    } else if (groupId === "precip") {
      specs.push({
        variable: primary,
        visible: true,
        renderMode: this.resolveInhouseRenderMode(primary),
      });
      if (windVector && windVector !== primary) {
        specs.push({
          variable: windVector,
          visible: false,
          renderMode: "raster",
        });
      }
      if (windSpeed && windSpeed !== primary) {
        specs.push({
          variable: windSpeed,
          visible: false,
          renderMode: "raster",
        });
      }
      if (
        windDir &&
        windDir !== primary &&
        windDir !== windSpeed &&
        windDir !== windVector
      ) {
        specs.push({ variable: windDir, visible: false, renderMode: "raster" });
      }
      // Load overlay variables (e.g. snow_fraction) invisibly alongside the primary.
      for (const overlayVar of group.overlay ?? []) {
        if (
          this._inhouseVariables.includes(overlayVar) &&
          overlayVar !== primary
        ) {
          specs.push({
            variable: overlayVar,
            visible: false,
            renderMode: "raster",
          });
        }
      }
    } else if (groupId === "waves") {
      specs.push({
        variable: primary,
        visible: true,
        renderMode: this.resolveInhouseRenderMode(primary),
      });
      if (windSpeed && windSpeed !== primary) {
        specs.push({
          variable: windSpeed,
          visible: false,
          renderMode: "raster",
        });
      }
      if (windDir && windDir !== primary && windDir !== windSpeed) {
        specs.push({ variable: windDir, visible: false, renderMode: "raster" });
      }
    } else if (groupId === "cloud") {
      specs.push({
        variable: primary,
        visible: true,
        renderMode: this.resolveInhouseRenderMode(primary),
      });
    } else if (groupId === "snow") {
      specs.push({
        variable: primary,
        visible: true,
        renderMode: this.resolveInhouseRenderMode(primary),
      });
    }

    const model = this._inhouseSelectedModel;
    const analysis = this._inhouseSelectedAnalysis;
    const previousDatetime = this.deps.getCurrentDatetime();
    const nextLayers: InhouseLayer[] = [];
    for (const spec of specs) {
      const id = `${model}:${analysis}:${spec.variable}`;
      const existing = this._inhouseLayers.find((layer) => layer.id === id);
      if (existing) {
        existing.visible = spec.visible;
        existing.renderMode = spec.renderMode;
        nextLayers.push(existing);
        continue;
      }
      try {
        const manifest = await this.loadInhouseManifest(
          model,
          analysis,
          spec.variable,
        );
        if (!manifest) continue;
        if (manifest.analysisTime !== analysis) {
          this.setInhouseWarning(
            `Manifest analysisTime mismatch for ${spec.variable}.`,
          );
          continue;
        }
        const times = resolveManifestTimes(manifest);
        nextLayers.push({
          id,
          model,
          analysis,
          variable: spec.variable,
          manifest,
          times,
          visible: spec.visible,
          image: null,
          scalar: null,
          rasterScalar: null,
          renderMode: spec.renderMode,
        });
      } catch (error) {
        this.setInhouseWarning(
          `Failed to load manifest: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    this._inhouseLayers.length = 0;
    this._inhouseLayers.push(...nextLayers);
    const primaryLayer = this._inhouseLayers[0];
    if (primaryLayer?.times?.length) {
      this.syncCurrentDatetimeToTimes(primaryLayer.times, previousDatetime);
    }
    this.renderInhouseLayersList();
    this.syncInhouseTimeToTimeline();
    // Caller is responsible for calling updateTimelineControlForMode etc.
    if (primaryLayer) {
      this.applyModelZoomConstraints(primaryLayer.model, {
        bounds: primaryLayer.manifest.bounds,
        manifest: primaryLayer.manifest,
        animate: true,
      });
      this.centerMapOnInhouseDomain(
        primaryLayer.model,
        primaryLayer.analysis,
        primaryLayer.manifest.bounds,
      );
    }
    void this.loadInhouseFrameSet();
  }

  // ---------------------------------------------------------------------------
  // Canonical variable resolution
  // ---------------------------------------------------------------------------

  getInhouseVariableId(canonicalVar: CanonicalVariable, model: string): string {
    return VARIABLE_SUBSTITUTIONS[canonicalVar]?.inhouse?.[model] ?? "";
  }

  hasInhouseVariable(
    canonicalVar: CanonicalVariable,
    model: string,
    analysis: string,
  ): boolean {
    const variable = this.getInhouseVariableId(canonicalVar, model);
    return Boolean(
      variable &&
      model &&
      analysis &&
      this._inhouseSelectedModel === model &&
      this._inhouseSelectedAnalysis === analysis &&
      this._inhouseVariables.includes(variable),
    );
  }

  resolveProviderForCanonical(
    canonicalVar: CanonicalVariable,
    model: string,
    analysis: string,
  ): ProviderId {
    return this.hasInhouseVariable(canonicalVar, model, analysis)
      ? "inhouse"
      : "cloud";
  }

  resolveProviderForPreset(
    variables: CanonicalVariable[],
    model: string,
    analysis: string,
  ): ProviderId {
    return variables.every((v) => this.hasInhouseVariable(v, model, analysis))
      ? "inhouse"
      : "cloud";
  }

  resolveInhouseRenderMode(variableId: string): "raster" | "contour" {
    const meta = this._inhouseVariableMeta[variableId];
    return meta?.defaultLayer === "contour" ? "contour" : "raster";
  }

  // ---------------------------------------------------------------------------
  // ForecastProvider: InhouseProvider
  // ---------------------------------------------------------------------------

  createInhouseProvider(
    model: string,
    analysis: string,
    variable: string,
  ): ForecastProvider {
    return {
      id: "inhouse" as ProviderId,
      getDatetimes: async (range: DatetimeRange | null) => {
        const manifest = await this.loadInhouseManifest(
          model,
          analysis,
          variable,
        );
        if (!manifest) return [];
        const times = resolveManifestTimes(manifest);
        return filterTimesByRange(times, range as DatetimeRange);
      },
      loadFrame: async (datetime: string, signal?: AbortSignal) => {
        const manifest = await this.loadInhouseManifest(
          model,
          analysis,
          variable,
        );
        if (!manifest) return null;
        const times = resolveManifestTimes(manifest);
        const index = times.includes(datetime)
          ? times.indexOf(datetime)
          : matchNearestTimeIndex(times, datetime);
        const fileName = manifest.fileTemplate.replace(
          "{index:03d}",
          formatIndex(index, 3),
        );
        const baseUrl = this.getVariableBaseUrl(model, analysis, variable);
        const url = `${baseUrl}/${fileName}`;
        const image = await this.loadInhouseTexture(url, signal);
        const unscale = manifest.imageUnscale ?? [
          manifest.srcMin,
          manifest.srcMax,
        ];
        return {
          image,
          bounds: manifest.bounds,
          imageUnscale: unscale,
          imageType: (manifest.encoding?.kind === "vector"
            ? "VECTOR"
            : "SCALAR") as unknown,
        } as ProviderFrame;
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Temperature provider helpers
  // ---------------------------------------------------------------------------

  resolveTemperatureProviderId(): ProviderId {
    return this.resolveProviderForCanonical(
      "air_temperature",
      this._inhouseSelectedModel,
      this._inhouseSelectedAnalysis,
    );
  }

  getInhouseTemperatureMapping(): {
    model: string;
    analysis: string;
    variable: string;
  } | null {
    const model = this._inhouseSelectedModel;
    const analysis = this._inhouseSelectedAnalysis;
    const variable = this.getInhouseVariableId("air_temperature", model);
    if (!model || !analysis || !variable) return null;
    return { model, analysis, variable };
  }

  getTemperatureProvider(): ForecastProvider {
    const providerId = this.resolveTemperatureProviderId();
    if (providerId === "inhouse") {
      const mapping = this.getInhouseTemperatureMapping();
      if (mapping) {
        return this.createInhouseProvider(
          mapping.model,
          mapping.analysis,
          mapping.variable,
        );
      }
    }
    return this.deps.createCloudProvider(
      VARIABLE_SUBSTITUTIONS.air_temperature.cloud.datasetId,
    );
  }

  // ---------------------------------------------------------------------------
  // Wind particle / vector helpers
  // ---------------------------------------------------------------------------

  logWindParticleTextureDebug(layer: InhouseLayer, index: number): void {
    if (!layer.image || layer.variable !== "wind_uv_10m") return;
    const texture = layer.image;
    const expectedLength = texture.width * texture.height * 4;
    const actualLength = texture.data?.length ?? null;
    const manifestShape = Array.isArray(layer.manifest.shape)
      ? { width: layer.manifest.shape[0], height: layer.manifest.shape[1] }
      : layer.manifest.shape;
    if (this.deps.isDev)
      console.log("[wind particles][texture]", {
        model: layer.model,
        analysis: layer.analysis,
        variable: layer.variable,
        index,
        frameUrl: this.getInhouseFrameUrl(layer, index),
        textureWidth: texture.width,
        textureHeight: texture.height,
        textureDataLength: actualLength,
        expectedRgbaLength: expectedLength,
        rgbaLengthMatches: actualLength === expectedLength,
        manifestShape,
        manifestBounds: layer.manifest.bounds,
        manifestImageUnscale: layer.manifest.imageUnscale ?? [
          layer.manifest.srcMin,
          layer.manifest.srcMax,
        ],
      });
  }

  getParticleTextureData(
    texture: WeatherLayers.TextureData,
  ): WeatherLayers.TextureData {
    return {
      data:
        texture.data instanceof Uint8Array
          ? new Uint8Array(texture.data)
          : new Uint8Array(texture.data.buffer.slice(0)),
      width: texture.width,
      height: texture.height,
    };
  }

  sampleInhouseVectorAtCoord(
    layer: InhouseLayer,
    coord: [number, number],
    bounds: [number, number, number, number],
  ): { value: number | null; direction: number | null } {
    if (!layer.image || layer.image instanceof Promise) {
      return { value: null, direction: null };
    }
    return this.deps.sampleVectorAtPosition(
      layer.image,
      getInhouseLayerUnscale(layer),
      bounds,
      coord,
    );
  }

  // ---------------------------------------------------------------------------
  // Inhouse tooltip
  // ---------------------------------------------------------------------------

  hideInhouseTooltip(): void {
    this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "true");
    this.deps.dom.inhouseTooltip.style.visibility = "hidden";
  }

  formatInhouseTooltipValue(layer: InhouseLayer, value: number): string {
    const unit = layer.manifest.unit ?? resolveInhouseUnit(layer.variable);
    const isAirTemp = layer.variable === "air_temperature_at_2m_agl";
    const displayValue = isAirTemp && value > 100 ? value - 273.15 : value;
    const formatted = isAirTemp
      ? displayValue.toFixed(0)
      : displayValue.toFixed(2);
    return `${formatted}${unit ? ` ${unit}` : ""}`;
  }

  showInhouseTooltip(text: string, x: number, y: number): void {
    const el = this.deps.dom.inhouseTooltip;
    el.textContent = text;
    el.setAttribute("aria-hidden", "false");
    // Position the cursor point; CSS transform centres the bubble above it.
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "visible";
  }

  scheduleInhouseContourHover(
    layer: InhouseLayer,
    info: { x?: number; y?: number; coordinate?: [number, number] },
    bounds: [number, number, number, number],
  ): void {
    this._contourHoverPending = { layer, info, bounds };
    if (this._contourHoverRaf !== null) return;
    this._contourHoverRaf = window.requestAnimationFrame(() => {
      this._contourHoverRaf = null;
      const pending = this._contourHoverPending;
      this._contourHoverPending = null;
      if (!pending) return;
      const coord = pending.info.coordinate;
      if (!coord) {
        this.hideInhouseTooltip();
        return;
      }
      const value = sampleInhouseScalarAtCoord(
        pending.layer,
        coord,
        pending.bounds,
      );
      if (typeof value === "number" && Number.isFinite(value)) {
        const x = pending.info.x ?? 0;
        const y = pending.info.y ?? 0;
        this.showInhouseTooltip(
          this.formatInhouseTooltipValue(pending.layer, value),
          x,
          y,
        );
      } else {
        this.hideInhouseTooltip();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Cache clearing helpers
  // ---------------------------------------------------------------------------

  clearTextureCaches(): void {
    this._textureCache.clear();
    this._textureDebugLogged.clear();
    this._rasterScalarCache.clear();
    this._scalarCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Preset initialization
  // ---------------------------------------------------------------------------

  initPresetSelect(): void {
    const { inhousePresetSelect } = this.deps.dom;
    if (inhousePresetSelect) {
      inhousePresetSelect.innerHTML = [
        "None",
        ...INHOUSE_PRESETS.map((p) => p.name),
      ]
        .map((name) => `<option value="${name}">${name}</option>`)
        .join("");
    }
  }

  // ---------------------------------------------------------------------------
  // Analysis change handler (for main.ts delegation)
  // ---------------------------------------------------------------------------

  async handleAnalysisChange(analysisId: string): Promise<void> {
    this._inhouseSelectedAnalysis = analysisId;
    this._inhouseSelectedVariable = "";
    this._precipCandidateIndex = 0;
    this._inhouseVariables = [];
    try {
      const root = this.getInhouseRoot();
      const varsRaw = await this.fetchJson<unknown>(
        `${root}/${FORECAST_DATA_SEGMENT}/${this._inhouseSelectedModel}/${this._inhouseSelectedAnalysis}/variables.json`,
      );
      const varsNorm = normalizeVariableList(varsRaw);
      this._inhouseVariables = varsNorm.ids;
      this._inhouseVariableMeta = varsNorm.meta;
      this._inhouseSelectedVariable = pickDefaultId(
        this._inhouseVariables,
        varsNorm.defaultId,
      );
    } catch (error) {
      this.setInhouseWarning(
        `Failed to load variables: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.refreshInhouseSelectors();
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  start(): Promise<void> {
    this.initPresetSelect();
    this._inhouseCatalogReady = this.loadInhouseCatalog();
    return this._inhouseCatalogReady;
  }

  // ---------------------------------------------------------------------------
  // DOM event listeners
  // ---------------------------------------------------------------------------

  private attachDomListeners(): void {
    const { inhouseVariableSelect, inhousePresetSelect, inhouseAddLayerBtn } =
      this.deps.dom;

    // Variable select — simple state update
    inhouseVariableSelect?.addEventListener("change", () => {
      if (!inhouseVariableSelect) return;
      this._inhouseSelectedVariable = inhouseVariableSelect.value;
    });

    // Preset select
    inhousePresetSelect?.addEventListener("change", () => {
      if (!inhousePresetSelect) return;
      const preset = INHOUSE_PRESETS.find(
        (p) => p.name === inhousePresetSelect.value,
      );
      if (!preset) return;
      if (this.deps.isDev)
        console.log("[inhouse] preset selected", preset.name);
      const model = this._inhouseSelectedModel;
      const analysis = this._inhouseSelectedAnalysis;
      if (!model || !analysis) return;
      const provider = this.resolveProviderForPreset(
        preset.variables,
        model,
        analysis,
      );
      if (provider !== "inhouse") {
        this.setInhouseWarning(
          "Preset fallback to cloud not yet wired. Add in-house variables to use this preset.",
        );
        return;
      }
      const variableIds = preset.variables
        .map((canonical) => this.getInhouseVariableId(canonical, model))
        .filter(Boolean);
      const missing = variableIds.filter(
        (id) => !this._inhouseVariables.includes(id),
      );
      if (missing.length) {
        this.setInhouseWarning(
          `Missing variables for preset: ${missing.join(", ")}`,
        );
        return;
      }
      variableIds.forEach(async (variable) => {
        const baseUrl = this.getVariableBaseUrl(model, analysis, variable);
        const manifest = await this.fetchJson<InhouseManifest>(
          `${baseUrl}/manifest.json`,
        );
        if (manifest.analysisTime !== analysis) {
          this.setInhouseWarning(
            `Manifest analysisTime mismatch for ${variable}`,
          );
          return;
        }
        const times = resolveManifestTimes(manifest);
        const id = `${model}:${analysis}:${variable}`;
        if (!this._inhouseLayers.find((l) => l.id === id)) {
          this._inhouseLayers.push({
            id,
            model,
            analysis,
            variable,
            manifest,
            times,
            visible: true,
            image: null,
            scalar: null,
            rasterScalar: null,
            renderMode: this.resolveInhouseRenderMode(variable),
          });
        }
      });
      this.renderInhouseLayersList();
      this.syncInhouseTimeToTimeline();
      void this.loadInhouseFrameSet();
    });

    // Add layer button
    inhouseAddLayerBtn?.addEventListener("click", async () => {
      const {
        inhouseModelSelect,
        inhouseAnalysisSelect,
        inhouseVariableSelect: varSelect,
      } = this.deps.dom;
      const debugModel = this._inhouseSelectedModel || inhouseModelSelect.value;
      const debugAnalysis =
        this._inhouseSelectedAnalysis || inhouseAnalysisSelect.value;
      const debugVariable =
        this._inhouseSelectedVariable || varSelect?.value || "";
      if (this.deps.isDev)
        console.log("[inhouse] add layer clicked", {
          model: debugModel,
          analysis: debugAnalysis,
          variable: debugVariable,
        });
      this.setInhouseWarning(
        `Debug: Add layer clicked (${debugModel} · ${debugAnalysis} · ${debugVariable})`,
      );
      this.clearTextureCaches();
      const model = this._inhouseSelectedModel || inhouseModelSelect.value;
      const analysis =
        this._inhouseSelectedAnalysis || inhouseAnalysisSelect.value;
      const variable = this._inhouseSelectedVariable || varSelect?.value || "";
      if (!model || !analysis || !variable) return;
      const baseUrl = this.getVariableBaseUrl(model, analysis, variable);
      try {
        const manifest = await this.fetchJson<InhouseManifest>(
          `${baseUrl}/manifest.json`,
        );
        if (manifest.analysisTime !== analysis) {
          this.setInhouseWarning("Manifest analysisTime mismatch.");
          return;
        }
        if (manifest.times && manifest.times.length !== manifest.count) {
          this.setInhouseWarning("Manifest times length mismatch.");
        }
        const times = resolveManifestTimes(manifest);
        const id = `${model}:${analysis}:${variable}`;
        if (!this._inhouseLayers.find((l) => l.id === id)) {
          this._inhouseLayers.push({
            id,
            model,
            analysis,
            variable,
            manifest,
            times,
            visible: true,
            image: null,
            scalar: null,
            rasterScalar: null,
            renderMode: this.resolveInhouseRenderMode(variable),
          });
        }
        this.renderInhouseLayersList();
        this.syncInhouseTimeToTimeline();
        void this.loadInhouseFrameSet();
      } catch (error) {
        this.setInhouseWarning(
          `Failed to load manifest: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async handleModelChange(
    nextModel: string,
    callbacks: {
      setLayerMode: (mode: InhouseGroupId) => void;
      getLayerMode: () => InhouseGroupId;
      renderLayerGroupList: () => void;
      easeToDefaultView: () => void;
      updateTimelineControlForMode: (mode: InhouseGroupId) => void;
      syncWindControls: () => void;
      syncTooltipAndLegendForMode: (mode: InhouseGroupId) => void;
      scheduleUpdateLayers: () => void;
      schedulePersistState: () => void;
    },
  ) {
    const resolve = resolveSelectionChange({
      action: "modelChange",
      fromModel: this.inhouseSelectedModel,
      fromLayer: callbacks.getLayerMode(),
      toModel: nextModel,
      defaults: {
        defaultModelForNonWaves: DEFAULT_NON_WAVES_MODEL,
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: (groupId) =>
        this.isGroupAvailableForModel(groupId),
    });
    // Reset the centering guard so the new model's domain is always centered.
    // Without this, switching A→B→A could skip centering on A the second time if the
    // same model+analysis key was already used, leaving the map at B's camera position.
    this._lastCenteredInhouseKey = "";
    this.setInhouseWarning(t("status.loadingModel"));
    if (resolve.model === GWES_MODEL_ID) {
      callbacks.setLayerMode("waves");
      callbacks.renderLayerGroupList();
      callbacks.easeToDefaultView();
    } else if (resolve.appliedException === "LEAVE_GWES_BY_MODEL") {
      callbacks.setLayerMode("temperature");
      callbacks.renderLayerGroupList();
    }
    await this.loadInhouseAnalyses(resolve.model);
    const fallbackGroup = this.pickValidGroupForModel(resolve.model);
    if (!fallbackGroup) {
      this.setInhouseWarning(
        `No compatible layers found for ${resolve.model}.`,
      );
      this.inhouseLayers.length = 0;
      this.renderInhouseLayersList();
      callbacks.scheduleUpdateLayers();
      return;
    }
    const desiredLayer =
      resolve.appliedException === "LEAVE_GWES_BY_MODEL"
        ? "temperature"
        : this.isGroupAvailableForModel(resolve.layer as InhouseGroupId)
          ? (resolve.layer as InhouseGroupId)
          : fallbackGroup;
    callbacks.setLayerMode(desiredLayer);
    callbacks.renderLayerGroupList();
    await this.ensureInhouseGroupLayers(desiredLayer);
    callbacks.updateTimelineControlForMode(desiredLayer);
    callbacks.syncWindControls();
    callbacks.syncTooltipAndLegendForMode(desiredLayer);
    callbacks.scheduleUpdateLayers();
    callbacks.schedulePersistState();
  }
}
