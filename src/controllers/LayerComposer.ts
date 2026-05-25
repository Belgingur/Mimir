import type { LayersList } from "@deck.gl/core";
import {
  GeoJsonLayer,
  IconLayer,
  LineLayer,
  PathLayer,
  ScatterplotLayer,
  TextLayer,
} from "@deck.gl/layers";
import type { FeatureCollection } from "geojson";
import * as WeatherLayers from "weatherlayers-gl";
import * as WeatherLayersClient from "weatherlayers-gl/client";
import { BELGINGUR_SCALE } from "../lib/precipitationScale";
import { WIND_SPEED_SCALE } from "../lib/windSpeedScale";
import { WAVE_HEIGHT_SCALE } from "../lib/waveHeightScale";
import { TEMPERATURE_SCALE } from "../lib/temperatureScale";
import { TEMPERATURE_SCALE_TROPICS } from "../lib/temperatureScaleTropics";
import { CLOUD_COVER_SCALE } from "../lib/cloudCoverScale";
import { SNOW_DEPTH_SCALE } from "../lib/snowDepthScale";
import { InhouseCatalogController } from "./InhouseCatalogController";
import { IconographyController } from "./IconographyController";
import { LayerGroupController } from "./LayerGroupController";
import { TimelineController } from "./TimelineController";
import { TooltipController } from "./TooltipController";
import { WavegramController } from "./WavegramController";
import { WindStyleController } from "./WindStyleController";
import { LRUMap } from "../lib/LRUMap";
import { buildGraticuleLabels, buildGraticuleLines } from "../lib/graticule";
import {
  sampleInhouseRasterAtCoord,
  sampleInhouseScalarAtCoord,
} from "../lib/gridSampling";
import {
  clampScalarImage,
  cropScalarImageToBounds,
  decodeScalarGrid,
  decodeVectorComponents,
} from "../lib/imageProcessing";
import {
  getInhouseLayerBounds,
  getInhouseLayerUnscale,
  getInhouseLayerImageScale,
} from "../lib/inhouseLayerHelpers";
import { extractSnowPoints, SnowOverlaySVG } from "../lib/snowOverlay";
import type { SnowPoint } from "../lib/snowOverlay";
import {
  INHOUSE_GROUP_VARIABLES,
  WAVE_DIRECTION_IS_FROM,
  WAVE_HEIGHT_VARIABLE,
} from "../lib/inhouseTypes";
import type { InhouseLayer, UiState } from "../lib/inhouseTypes";
import {
  compassBearingToIconAngle,
  mapMagnitudeToArrowSize,
} from "../lib/mathUtils";
import {
  parseHexColor,
  getDefaultInhousePalette,
  buildLog1pStepPalette,
  buildStepPalette,
} from "../lib/paletteUtils";
import { buildStreamlineGeotransform } from "../lib/streamlineBuilder";
import { resolveInhouseUnit } from "../lib/inhouseCatalogHelpers";
import {
  getArrowStepForModel,
  getGridStepForZoom,
  getInhouseContourDownsample,
  getWaveContourDownsample,
  getWindOverlayStyle,
  getWindStepForZoom,
  getWindStreamlineStyle,
} from "../lib/zoomSteps";
import { getVisibleViewportRect } from "../lib/visibleViewport";
import {
  ARROW_HEAD_ICON,
  ARROW_ICON,
  buildArrowPoints,
  buildStreamlineArrowHeads,
  buildWindLabelPoints,
} from "../lib/arrowGeometry";
import type { ArrowPoint, WindLabelPoint } from "../lib/arrowGeometry";
import { WeatherWidgetRenderer } from "../lib/WeatherWidgetRenderer";
import { CompactWidgetRenderer } from "../lib/CompactWidgetRenderer";
import type { IconographyRenderer } from "../lib/iconographyTypes";
import { t } from "../lib/i18n";

type MapBoundsLike = {
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
};

export interface LayerComposerDeps {
  dom: {
    inhouseTooltip: HTMLDivElement;
    gridLabelsContainer: HTMLDivElement;
    tooltipHost: HTMLDivElement;
    mapWrap: HTMLDivElement;
    legendHost: HTMLDivElement;
    waveLegendHost: HTMLDivElement;
    windLegendHost: HTMLDivElement;
    precipLegendHost: HTMLDivElement;
    cloudLegendHost: HTMLDivElement;
    snowDepthLegendHost: HTMLDivElement;
  };
  getMapZoom: () => number;
  getMapBounds: () => MapBoundsLike;
  getMapCenter: () => { lng: number; lat: number };
  getMapBearing: () => number;
  getMapPitch: () => number;
  projectMap: (coord: [number, number]) => { x: number; y: number };
  unprojectMap: (point: [number, number]) => { lng: number; lat: number };
  getMapCanvas: () => HTMLCanvasElement;
  getMapContainer: () => HTMLElement;
  resizeMap: () => void;
  jumpToMap: (view: any) => void;
  easeToMap: (options: any) => void;
  setOverlayProps: (props: { layers: LayersList }) => void;
  getUiState: () => UiState;
  isMapReady: () => boolean;
  getCatalogController: () => InhouseCatalogController;
  getTimelineController: () => TimelineController;
  getTooltipController: () => TooltipController;
  getWindStyleController: () => WindStyleController;
  getIconographyController: () => IconographyController;
  getLayerGroupController: () => LayerGroupController;
  getIconographyStyle: () => import("../lib/iconographyTypes").IconographyStyle;
  getWavegramController: () => WavegramController;
  schedulePersistState: () => void;
  client: {
    loadDatasetData: (
      id: string,
      datetime?: string,
    ) => Promise<WeatherLayersClient.DatasetData>;
    loadDataset: (id: string) => Promise<WeatherLayersClient.Dataset>;
    loadDatasetSlice: (
      id: string,
      range: WeatherLayersClient.DatetimeISOStringRange,
    ) => Promise<{ datetimes: string[] }>;
  };
  createContourWorker: () => Worker;
  createMslpContourWorker: () => Worker;
  createWindStreamlineWorker: () => Worker;
  isDev: boolean;
  supportsWindParticlesPlatform: boolean;
  isFirefox: boolean;
  inhouseRoot: string;
}

type PaletteArray = Array<[number, string]>;

export class LayerComposer {
  private static readonly MOBILE_RIGHT_HOVER_GUTTER_WIDTH_PX = 72;
  private static readonly MOBILE_RIGHT_HOVER_GUTTER_TOP_PX = 0;
  private readonly deps: LayerComposerDeps;
  private readonly WIND_STREAMLINE_FLIP = false;

  private updateLayersHandle: number | null = null;
  private lastCompositeLayers: unknown[] = [];
  private coarseContoursUntil = 0;

  private _palette: WeatherLayers.Palette | string = [];
  private _unitFormat: WeatherLayers.UnitFormat | null = null;
  private _windPalette: WeatherLayers.Palette | string = [];
  private _windUnitFormat: WeatherLayers.UnitFormat | null = null;

  private legendControl: WeatherLayers.LegendControl | null = null;
  private windLegendControl: WeatherLayers.LegendControl | null = null;

  private datasetMeta: WeatherLayersClient.Dataset | null = null;
  private windData: WeatherLayersClient.DatasetData | null = null;
  private windDatasetMeta: WeatherLayersClient.Dataset | null = null;
  private precipData: WeatherLayersClient.DatasetData | null = null;
  private precipDatasetMeta: WeatherLayersClient.Dataset | null = null;
  private windLayerLoading = false;
  private precipLayerLoading = false;

  private windSpeedCacheKey = "";
  private windSpeedCache: {
    image: WeatherLayers.TextureData | null;
    image2: WeatherLayers.TextureData | undefined;
    min: number;
    max: number;
    type: WeatherLayers.ImageType | null;
  } | null = null;

  private readonly landMaskCache = new LRUMap<string, Uint8Array>(20);
  private countryOutlineData: FeatureCollection | null = null;
  private windArrowRangeLogged = false;

  /**
   * Cache: rasterScalar object → extracted snow points.
   * rasterScalar is replaced each time a new frame loads, so the WeakMap entry
   * is automatically GC'd when the old frame's data is released.
   */
  private readonly snowPointsCache = new WeakMap<object, SnowPoint[]>();

  /** SVG overlay element mounted over the MapLibre canvas. Created on first use. */
  private snowOverlaySVG: SnowOverlaySVG | null = null;

  private readonly temperatureScaleCValue = TEMPERATURE_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly temperatureScaleCValueStep = buildStepPalette(
    this.temperatureScaleCValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;

  private readonly temperatureScaleTropicsValue = TEMPERATURE_SCALE_TROPICS.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly temperatureScaleTropicsStep = buildStepPalette(
    this.temperatureScaleTropicsValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;

  private readonly windSpeedScaleValue = WIND_SPEED_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly windSpeedScaleValueStep = buildStepPalette(
    this.windSpeedScaleValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;

  private readonly precipScaleValue = BELGINGUR_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ).filter(
    ([value]) => (value as number) <= 250,
  ) as unknown as WeatherLayers.Palette;
  private readonly precipMax = 250;
  // Palette remapped to log1p-encoded space with hard step boundaries, used
  // when the raster image itself carries log1p encoding (imageScale === 'log1p').
  private readonly precipScaleValueLog1p = buildLog1pStepPalette(
    this.precipScaleValue as unknown as Parameters<
      typeof buildLog1pStepPalette
    >[0],
    this.precipMax,
  ) as unknown as WeatherLayers.Palette;
  private readonly waveHeightScaleValue = WAVE_HEIGHT_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly waveHeightScaleStep = buildStepPalette(
    this.waveHeightScaleValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;
  private readonly cloudCoverScaleValue = CLOUD_COVER_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly cloudCoverScaleStep = buildStepPalette(
    this.cloudCoverScaleValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;
  private readonly snowDepthMax = 20000;
  private readonly snowDepthScaleValue = SNOW_DEPTH_SCALE.map(
    ([value, hex]: [number, string]) => [value, parseHexColor(hex)],
  ) as unknown as WeatherLayers.Palette;
  private readonly snowDepthScaleStep = buildStepPalette(
    this.snowDepthScaleValue as unknown as Parameters<
      typeof buildStepPalette
    >[0],
  ) as unknown as WeatherLayers.Palette;
  // Palette remapped to log1p-encoded space, used when imageScale === 'log1p'.
  private readonly snowDepthScaleValueLog1p = buildLog1pStepPalette(
    this.snowDepthScaleValue as unknown as Parameters<
      typeof buildLog1pStepPalette
    >[0],
    this.snowDepthMax,
  ) as unknown as WeatherLayers.Palette;
  private readonly precipTicks = (
    this.precipScaleValue as unknown as [
      number,
      [number, number, number, number],
    ][]
  ).map(([value]) => value);

  private readonly windCache = new LRUMap<
    string,
    WeatherLayersClient.DatasetData
  >(50);
  private readonly precipCache = new LRUMap<
    string,
    WeatherLayersClient.DatasetData
  >(50);
  private readonly windLineCache = new LRUMap<
    string,
    { source: [number, number]; target: [number, number] }[]
  >(50);
  private readonly gridLineCache = new LRUMap<
    number,
    { source: [number, number]; target: [number, number] }[]
  >(20);
  private readonly mslpContourCache = new LRUMap<
    string,
    { path: [number, number][]; value: number }[]
  >(50);
  private readonly mslpContourPending = new Map<
    string,
    {
      image: WeatherLayers.TextureData;
      bounds: [number, number, number, number];
      downsample: number;
      thresholds: number[];
    }
  >();
  private readonly windStreamlineCache = new LRUMap<string, FeatureCollection>(
    30,
  );
  private activeWindStreamlineKey = "";

  private _contourWorkerInstance: Worker | null = null;
  private _mslpContourWorkerInstance: Worker | null = null;
  private _windStreamlineWorkerInstance: Worker | null = null;

  private get contourWorker(): Worker {
    if (!this._contourWorkerInstance) {
      this._contourWorkerInstance = this.deps.createContourWorker();
      this._contourWorkerInstance.onmessage = (event: MessageEvent) => {
        const { key, paths } = event.data as {
          key: string;
          paths: { path: [number, number][]; value: number }[];
        };
        const catalogController = this.deps.getCatalogController();
        if (catalogController.contourPending.has(key)) {
          catalogController.contourCache.set(key, paths);
          catalogController.contourPending.delete(key);
        }
        this.updateLayers();
      };
    }
    return this._contourWorkerInstance;
  }

  private get mslpContourWorker(): Worker {
    if (!this._mslpContourWorkerInstance) {
      this._mslpContourWorkerInstance = this.deps.createMslpContourWorker();
      this._mslpContourWorkerInstance.onmessage = (event: MessageEvent) => {
        const { key, paths } = event.data as {
          key: string;
          paths: { path: [number, number][]; value: number }[];
        };
        this.mslpContourCache.set(key, paths);
        this.mslpContourPending.delete(key);
        this.updateLayers();
      };
    }
    return this._mslpContourWorkerInstance;
  }

  private get windStreamlineWorker(): Worker {
    if (!this._windStreamlineWorkerInstance) {
      this._windStreamlineWorkerInstance =
        this.deps.createWindStreamlineWorker();
      this._windStreamlineWorkerInstance.onmessage = (event: MessageEvent) => {
        const { key, featureCollection } = event.data as {
          key: string;
          featureCollection: FeatureCollection;
        };
        this.windStreamlineCache.set(key, featureCollection);
        if (key === this.activeWindStreamlineKey) {
          this.updateLayers();
        }
      };
    }
    return this._windStreamlineWorkerInstance;
  }

  private lastGridLines: {
    source: [number, number];
    target: [number, number];
  }[] = [];
  private lastGridStep = 0;
  private lastWindStep = 0;
  private isZooming = false;

  private gridLabelsDirty = true;
  private labelsFrameHandle: number | null = null;
  private lastStableView: {
    center: any;
    zoom: number;
    bearing: number;
    pitch: number;
  } | null = null;

  private windDatasetId = "gfs/wind_10m_above_ground";
  private precipDatasetId = "gfs/precipitation_3h_accumulation_surface";

  private _classicRendererInstance: WeatherWidgetRenderer | null = null;
  private _compactRendererInstance: CompactWidgetRenderer | null = null;

  private get _iconographyRenderer(): IconographyRenderer {
    if (this.deps.getIconographyStyle() === "compact") {
      if (!this._compactRendererInstance) {
        this._compactRendererInstance = new CompactWidgetRenderer(() =>
          this.scheduleUpdateLayers(),
        );
      }
      return this._compactRendererInstance;
    }
    if (!this._classicRendererInstance) {
      this._classicRendererInstance = new WeatherWidgetRenderer(() =>
        this.scheduleUpdateLayers(),
      );
    }
    return this._classicRendererInstance;
  }

  constructor(deps: LayerComposerDeps) {
    this.deps = deps;
  }

  get palette(): WeatherLayers.Palette | string {
    return this._palette;
  }
  get unitFormat(): WeatherLayers.UnitFormat | null {
    return this._unitFormat;
  }
  get windPalette(): WeatherLayers.Palette | string {
    return this._windPalette;
  }
  get windUnitFormat(): WeatherLayers.UnitFormat | null {
    return this._windUnitFormat;
  }
  get temperatureScaleC(): WeatherLayers.Palette {
    return this.temperatureScaleCValue;
  }
  get windSpeedScale(): WeatherLayers.Palette {
    return this.windSpeedScaleValue;
  }
  get precipScale(): WeatherLayers.Palette {
    return this.precipScaleValue;
  }

  setZooming(value: boolean): void {
    this.isZooming = value;
  }

  setLastStableView(
    view: { center: any; zoom: number; bearing: number; pitch: number } | null,
  ): void {
    this.lastStableView = view;
  }

  setGridLabelsDirty(value: boolean): void {
    this.gridLabelsDirty = value;
  }

  scheduleLabelRender = () => {
    if (this.labelsFrameHandle !== null) return;
    this.labelsFrameHandle = window.requestAnimationFrame(() => {
      this.labelsFrameHandle = null;
      if (this.gridLabelsDirty) {
        this.renderGridLabels(
          this.deps.dom.gridLabelsContainer,
          getGridStepForZoom(this.deps.getMapZoom()) * 2,
          this.deps.getUiState().showGrid,
        );
        this.gridLabelsDirty = false;
      }
    });
  };

  public initLegends(): void {
    if (
      this.deps.dom.legendHost &&
      this.deps.dom.legendHost.children.length === 0
    ) {
      this.renderTempLegend(this.deps.dom.legendHost);
    }

    if (
      this.deps.dom.waveLegendHost &&
      this.deps.dom.waveLegendHost.children.length === 0
    ) {
      this.renderWaveHeightLegend(this.deps.dom.waveLegendHost);
      this.deps.dom.waveLegendHost.style.display = "none";
    }

    if (
      this.deps.dom.windLegendHost &&
      this.deps.dom.windLegendHost.children.length === 0
    ) {
      this.renderWindLegend(this.deps.dom.windLegendHost);
      this.deps.dom.windLegendHost.style.display = "none";
    }

    if (
      this.deps.dom.precipLegendHost &&
      this.deps.dom.precipLegendHost.children.length === 0
    ) {
      this.renderPrecipLegend(this.deps.dom.precipLegendHost);
      this.deps.dom.precipLegendHost.style.display = "none";
    }

    if (
      this.deps.dom.cloudLegendHost &&
      this.deps.dom.cloudLegendHost.children.length === 0
    ) {
      this.renderCloudLegend(this.deps.dom.cloudLegendHost);
      this.deps.dom.cloudLegendHost.style.display = "none";
    }

    if (
      this.deps.dom.snowDepthLegendHost &&
      this.deps.dom.snowDepthLegendHost.children.length === 0
    ) {
      this.renderSnowDepthLegend(this.deps.dom.snowDepthLegendHost);
      this.deps.dom.snowDepthLegendHost.style.display = "none";
    }
  }

  /**
   * Re-render every pre-cached legend with fresh translation strings.
   * Called when the active locale changes so that all legend labels — including
   * those for hidden modes — are updated before the user switches to them.
   * The display property of each host is left unchanged (show/hide is managed
   * by syncTooltipAndLegendForMode).
   */
  public refreshLegends(_currentMode: UiState["layerMode"]): void {
    const dom = this.deps.dom;

    // Remove any WL LegendControl instance before replacing innerHTML.
    if (this.legendControl) {
      this.legendControl.remove();
      this.legendControl = null;
    }

    // Temperature legend — re-render the correct variant for the current model.
    if (dom.legendHost) {
      const currentModel =
        this.deps.getCatalogController().inhouseSelectedModel;
      if (currentModel === "BEL-BR") {
        this.renderTempTropicsLegend(dom.legendHost);
      } else {
        this.renderTempLegend(dom.legendHost);
      }
    }

    if (dom.waveLegendHost) {
      this.renderWaveHeightLegend(dom.waveLegendHost);
    }
    if (dom.windLegendHost) {
      this.renderWindLegend(dom.windLegendHost);
    }
    if (dom.precipLegendHost) {
      this.renderPrecipLegend(dom.precipLegendHost);
    }
    if (dom.cloudLegendHost) {
      this.renderCloudLegend(dom.cloudLegendHost);
    }
    if (dom.snowDepthLegendHost) {
      this.renderSnowDepthLegend(dom.snowDepthLegendHost);
    }
  }

  public scheduleUpdateLayers(): void {
    if (this.updateLayersHandle !== null) return;
    if (this.lastCompositeLayers.length === 0 && this.deps.isMapReady()) {
      this.updateLayers();
      return;
    }
    this.updateLayersHandle = window.requestAnimationFrame(() => {
      this.updateLayersHandle = null;
      try {
        this.updateLayers();
      } catch (error) {
        console.error(t("error.updateLayers"), error);
      }
    });
  }

  public updateGridOnly = () => {
    if (this.lastCompositeLayers.length === 0) {
      this.scheduleUpdateLayers();
      return;
    }
    const uiState = this.deps.getUiState();
    const gridStep = getGridStepForZoom(this.deps.getMapZoom());
    const gridLines = uiState.showGrid
      ? this.getGridLinesForStep(gridStep)
      : [];
    this.lastGridLines = gridLines;
    this.lastGridStep = gridStep;
    const nextLayers = this.lastCompositeLayers.map((layer) => {
      if (
        layer &&
        typeof layer === "object" &&
        "id" in layer &&
        (layer as { id: string }).id === "graticule-lines"
      ) {
        return new LineLayer({
          id: "graticule-lines",
          data: gridLines,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getColor: [60, 60, 60],
          getWidth: 1,
          opacity: 0.35,
          visible: uiState.showGrid,
          parameters: { depthTest: false },
        });
      }
      return layer;
    });
    this.deps.setOverlayProps({ layers: nextLayers as unknown as LayersList });
    this.lastCompositeLayers = nextLayers;
  };

  public async loadCountryOutlines(): Promise<void> {
    try {
      const url = `${import.meta.env.BASE_URL}data/world_countries_generalized.geojson`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load country outlines: ${response.status}`);
      }
      const collection = (await response.json()) as FeatureCollection;
      this.countryOutlineData = collection;
      this.scheduleUpdateLayers();
    } catch (error) {
      console.warn(t("error.countryOutlines"), error);
    }
  }

  public updateLayers(): void {
    if (!this.deps.isMapReady()) {
      return;
    }

    const layerGroupController = this.deps.getLayerGroupController();
    const catalogController = this.deps.getCatalogController();
    const timelineController = this.deps.getTimelineController();
    const tooltipController = this.deps.getTooltipController();
    const windStyleController = this.deps.getWindStyleController();
    const wavegramController = this.deps.getWavegramController();
    const uiState = this.deps.getUiState();

    if (layerGroupController.viewMode === "iconography") {
      // Snow overlay must be hidden when switching to iconography view.
      this.snowOverlaySVG?.update(null, this.deps.projectMap, 0, 0, {
        west: 0,
        south: 0,
        east: 0,
        north: 0,
      });
      const layers = this.buildIconographyLayers();
      this.deps.setOverlayProps({ layers: layers as unknown as LayersList });
      this.lastCompositeLayers = layers;
      return;
    }

    const mapBounds = this.deps.getMapBounds();
    const mapBoundsNormalized =
      mapBounds.getWest() <= mapBounds.getEast()
        ? ([
            mapBounds.getWest() - 2,
            mapBounds.getSouth() - 2,
            mapBounds.getEast() + 2,
            mapBounds.getNorth() + 2,
          ] as [number, number, number, number])
        : null;

    const gridStep = getGridStepForZoom(this.deps.getMapZoom());
    const gridLines = uiState.showGrid
      ? this.getGridLinesForStep(gridStep)
      : [];

    const outlineLayer = this.countryOutlineData
      ? new GeoJsonLayer({
          id: "country-outlines",
          data: this.countryOutlineData,
          filled: false,
          stroked: true,
          getLineColor: [25, 25, 25],
          getLineWidth: 1,
          lineWidthMinPixels: 0.6,
          lineWidthMaxPixels: 2,
          opacity: 0.6,
          parameters: { depthTest: false },
        })
      : null;

    const inhouseRasterLayers = catalogController.inhouseLayers
      .filter(
        (layer) =>
          layer.visible && layer.image && layer.renderMode === "raster",
      )
      .map((layer) => {
        const bounds = layer.manifest.bounds;
        const imageUnscale = getInhouseLayerUnscale(layer);
        const imageScale = getInhouseLayerImageScale(layer);
        const isAirTemp = layer.variable === "air_temperature_at_2m_agl";
        const isWindSpeed =
          INHOUSE_GROUP_VARIABLES.wind.windSpeed?.includes(layer.variable) ||
          layer.variable.includes("wind_speed");
        const isPrecip =
          INHOUSE_GROUP_VARIABLES.precip.primary.includes(layer.variable) ||
          layer.variable.includes("precipitation");
        const isWaveHeight =
          uiState.layerMode === "waves" &&
          (layer.variable === WAVE_HEIGHT_VARIABLE ||
            layer.variable.includes("wave_height"));
        const isCloud =
          INHOUSE_GROUP_VARIABLES.cloud.primary.includes(layer.variable) ||
          layer.variable.includes("cloud_area_fraction");
        const isSnowDepth =
          INHOUSE_GROUP_VARIABLES.snow.primary.includes(layer.variable) ||
          layer.variable.includes("snow_depth");
        const isTropicsModel = layer.model === "BEL-BR";
        const palette = isAirTemp
          ? ((isTropicsModel
              ? this.temperatureScaleTropicsStep
              : this.temperatureScaleCValueStep) as WeatherLayers.Palette)
          : isWindSpeed
            ? (this.windSpeedScaleValueStep as WeatherLayers.Palette)
            : isPrecip
              ? ((imageScale === "log1p"
                  ? this.precipScaleValueLog1p
                  : this.precipScaleValue) as WeatherLayers.Palette)
              : isWaveHeight
                ? (this.waveHeightScaleStep as WeatherLayers.Palette)
                : isCloud
                  ? (this.cloudCoverScaleStep as WeatherLayers.Palette)
                  : isSnowDepth
                    ? ((imageScale === "log1p"
                        ? this.snowDepthScaleValueLog1p
                        : this.snowDepthScaleStep) as WeatherLayers.Palette)
                    : getDefaultInhousePalette(
                        imageUnscale[0],
                        imageUnscale[1],
                      );
        // When a domain mask exists, use the 4-band RGBA layer.image instead of the 1-band
        // rasterScalar. In WebGL, sampling a 1-band (r8unorm) texture always gives Ad.a = 1.0
        // regardless of the source alpha, so WeatherLayers GL's nodata check (Ad.a >= 1.)
        // never fires and nodata pixels outside the model domain are rendered. The 4-band RGBA
        // image preserves A=0 for nodata pixels; the alpha check then correctly discards them.
        const useDomainImage = Boolean(layer.domainMask && layer.image);
        let rasterImage: WeatherLayers.TextureData = useDomainImage
          ? (layer.image as WeatherLayers.TextureData)
          : ((layer.rasterScalar as WeatherLayers.TextureData | null) ??
            (layer.image as WeatherLayers.TextureData));
        let rasterImageUnscale = imageUnscale;
        let imageMinValue =
          layer.rawRange && layer.rawRange[0] > 0
            ? imageUnscale[0] +
              (layer.rawRange[0] - 0.5) *
                ((imageUnscale[1] - imageUnscale[0]) / 255)
            : undefined;
        let imageMaxValue: number | undefined;
        if (useDomainImage) {
          // 4-band RGBA: alpha=0 marks nodata; WeatherLayers GL discards via the alpha check.
          // No imageMinValue needed — it would incorrectly suppress valid minimum-value readings.
          imageMinValue = undefined;
        }
        if (isPrecip) {
          imageMinValue = undefined;
        }
        if (isAirTemp) {
          const activeTempScale = isTropicsModel
            ? this.temperatureScaleTropicsValue
            : this.temperatureScaleCValue;
          const tempPaletteMin = Number(
            (activeTempScale[0] as [number, unknown])[0],
          );
          const tempPaletteMax = Number(
            (
              activeTempScale[activeTempScale.length - 1] as [number, unknown]
            )[0],
          );
          rasterImage = clampScalarImage(
            layer.image as WeatherLayers.TextureData,
            imageUnscale,
            tempPaletteMin,
            tempPaletteMax,
          );
          rasterImageUnscale = [tempPaletteMin, tempPaletteMax];
          // clampScalarImage produces 4-band RGBA with A=0 for nodata; the alpha check handles
          // nodata suppression. No imageMinValue needed.
          imageMinValue = undefined;
          imageMaxValue = undefined;
        }
        // Note: for log1p-encoded images we do NOT linearise the raster pixels
        // here. Instead precipScaleValueLog1p transforms the palette stops into
        // log1p-encoded space so they align with the image pixels directly.
        // This preserves full log1p precision in the colour ramp and avoids the
        // 8-bit quantisation that linearisation would introduce.
        let rasterBounds = bounds;
        const sourceWidth = Array.isArray(layer.manifest.shape)
          ? layer.manifest.shape[0]
          : layer.manifest.shape?.width;
        const logicalWidth =
          (layer.rasterScalar as { widthMeta?: number } | null)?.widthMeta ??
          sourceWidth;
        if (logicalWidth && rasterImage.width !== logicalWidth) {
          const span = bounds[2] - bounds[0];
          const step = span / Math.max(1, logicalWidth - 1);
          const extra = step * (rasterImage.width - logicalWidth);
          rasterBounds = [bounds[0], bounds[1], bounds[2] + extra, bounds[3]];
        }
        const rasterLayer = new WeatherLayers.RasterLayer({
          id: `inhouse-${layer.id}`,
          image: rasterImage,
          imageType: WeatherLayers.ImageType.SCALAR,
          imageUnscale: rasterImageUnscale,
          imageMinValue,
          imageMaxValue,
          imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
          imageSmoothing: 0,
          bounds: rasterBounds,
          palette,
          opacity: uiState.opacity,
          visible: uiState.visible,
          pickable: true,
          parameters: { depthTest: false },
          onClick: (info) => {
            if (uiState.layerMode !== "waves" || !isWaveHeight) return;
            const infoAny = info as any;
            let coord = infoAny?.coordinate as [number, number] | undefined;
            if (
              !coord &&
              typeof infoAny?.x === "number" &&
              typeof infoAny?.y === "number"
            ) {
              const point = this.deps.unprojectMap([infoAny.x, infoAny.y]);
              coord = [point.lng, point.lat];
            }
            if (coord) {
              wavegramController.open(coord);
            }
          },
          onHover: (info) => {
            const infoAny = info as any;
            if (this.shouldSuppressForecastHover(infoAny?.x, infoAny?.y)) {
              tooltipController.clearAllAddons();
              this.deps.getMapCanvas().style.cursor = "";
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "true");
              this.deps.dom.inhouseTooltip.style.visibility = "hidden";
              return;
            }
            let value = infoAny?.raster?.value;
            if (isAirTemp) {
              if (typeof value === "number" && Number.isFinite(value)) {
                tooltipController.tempRasterHoverActive = true;
                tooltipController.tempRasterHoverTs = Date.now();
              } else {
                tooltipController.tempRasterHoverActive = false;
                tooltipController.tempRasterHoverTs = Date.now();
              }
            }
            if (isAirTemp) {
              let coordinate = infoAny?.coordinate as
                | [number, number]
                | undefined;
              if (
                !coordinate &&
                typeof infoAny?.x === "number" &&
                typeof infoAny?.y === "number"
              ) {
                const point = this.deps.unprojectMap([infoAny.x, infoAny.y]);
                coordinate = [point.lng, point.lat];
              }
              if (coordinate) {
                // Use our domain-mask-aware samplers exclusively. WeatherLayers GL's raster.value
                // comes from the GPU pick which ignores the alpha channel for SCALAR imageType, so it
                // returns a value even for nodata pixels (encoded R=0 → tempPaletteMin). We reset
                // value here so a null sample always overrides the WeatherLayers pick result.
                value = undefined;
                const sample = layer.scalar
                  ? sampleInhouseScalarAtCoord(layer, coordinate, rasterBounds)
                  : null;
                if (typeof sample === "number") {
                  value = sample;
                } else {
                  const raw = sampleInhouseRasterAtCoord(
                    layer,
                    coordinate,
                    rasterBounds,
                  );
                  if (typeof raw === "number") {
                    const [min, max] = imageUnscale;
                    value = min + (raw / 255) * (max - min);
                  }
                  // If both samplers return null the coordinate is outside the model domain;
                  // value stays undefined so no tooltip is shown.
                }
                if (
                  import.meta.env.DEV &&
                  (typeof value !== "number" || !Number.isFinite(value))
                ) {
                  console.log("[temp-hover] no value", {
                    coord: coordinate,
                    hasScalar: Boolean(layer.scalar),
                    hasRaster: Boolean(layer.rasterScalar),
                    imageUnscale,
                    rawRange: layer.rawRange,
                  });
                }
              } else {
                value = undefined;
              }
            }
            // Snow depth: always override with our scalar sampler (already expm1-decoded
            // by decodeScalarGrid) so log1p-encoded images yield correct physical values
            // rather than the linearly-decoded value WeatherLayers GL would produce.
            if (isSnowDepth) {
              const coordinate = (info as any)?.coordinate as
                | [number, number]
                | undefined;
              value = undefined;
              if (coordinate) {
                const sample = layer.scalar
                  ? sampleInhouseScalarAtCoord(layer, coordinate, rasterBounds)
                  : null;
                if (typeof sample === "number") {
                  value = sample;
                } else {
                  const raw = sampleInhouseRasterAtCoord(
                    layer,
                    coordinate,
                    rasterBounds,
                  );
                  if (typeof raw === "number") {
                    const [min, max] = imageUnscale;
                    value =
                      imageScale === "log1p"
                        ? Math.expm1((raw / 255) * Math.log1p(max))
                        : min + (raw / 255) * (max - min);
                  }
                }
              }
            }
            if (
              (typeof value !== "number" || !Number.isFinite(value)) &&
              layer.scalar
            ) {
              const coordinate = (info as any)?.coordinate as
                | [number, number]
                | undefined;
              if (coordinate) {
                const [lon, lat] = coordinate;
                const [minLon, minLat, maxLon, maxLat] = rasterBounds;
                const spanLon = maxLon - minLon;
                const spanLat = maxLat - minLat;
                if (spanLon > 0 && spanLat > 0) {
                  const u = (lon - minLon) / spanLon;
                  const v = (maxLat - lat) / spanLat;
                  const widthMeta =
                    (layer.rasterScalar as { widthMeta?: number } | null)
                      ?.widthMeta ?? layer.scalar.width;
                  const x = Math.max(
                    0,
                    Math.min(widthMeta - 1, Math.round(u * (widthMeta - 1))),
                  );
                  const y = Math.max(
                    0,
                    Math.min(
                      layer.scalar.height - 1,
                      Math.round(v * (layer.scalar.height - 1)),
                    ),
                  );
                  const sample = layer.scalar.data[y * layer.scalar.width + x];
                  if (Number.isFinite(sample)) value = sample;
                }
              }
            }
            // Wind speed: reset value and use domain-mask-aware samplers so nodata
            // pixels (raw=0 → decoded 0 m/s from the WeatherLayers GL pick buffer)
            // don't produce false "0.0 m/s" tooltip readings outside the model domain.
            if (isWindSpeed) {
              const wsCoord = (info as any)?.coordinate as
                | [number, number]
                | undefined;
              if (wsCoord) {
                value = undefined;
                if (layer.scalar) {
                  const sample = sampleInhouseScalarAtCoord(
                    layer,
                    wsCoord,
                    rasterBounds,
                  );
                  if (typeof sample === "number") value = sample;
                }
                if (typeof value !== "number" || !Number.isFinite(value)) {
                  const raw = sampleInhouseRasterAtCoord(
                    layer,
                    wsCoord,
                    rasterBounds,
                  );
                  if (typeof raw === "number") {
                    const [min, max] = imageUnscale;
                    value = min + (raw / 255) * (max - min);
                  }
                }
              }
            }
            if (uiState.layerMode === "wind" && isWindSpeed) {
              const coord = (info as any)?.coordinate as
                | [number, number]
                | undefined;
              const vectorLayer = coord
                ? catalogController.findPreferredInhouseWindVectorLayer("wind")
                : null;
              const dirLayer =
                coord && !vectorLayer
                  ? catalogController.findInhouseLayerByCandidates(
                      INHOUSE_GROUP_VARIABLES.wind.windDir,
                    )
                  : null;
              const vectorSample =
                coord && vectorLayer
                  ? catalogController.sampleInhouseVectorAtCoord(
                      vectorLayer,
                      coord,
                      getInhouseLayerBounds(vectorLayer),
                    )
                  : null;
              const direction =
                vectorSample?.direction ??
                (coord && dirLayer
                  ? sampleInhouseScalarAtCoord(dirLayer, coord, rasterBounds)
                  : null);
              if (typeof value === "number" && Number.isFinite(value)) {
                tooltipController.updatePickingInfo({
                  ...(info as any),
                  raster: {
                    value,
                    direction:
                      tooltipController.finiteDirectionOrUndefined(direction),
                  },
                } as any);
                tooltipController.updateTooltipValueOverride(
                  `${value.toFixed(1)} m/s`,
                );
                tooltipController.updateTooltipWindSpeed(null);
                tooltipController.updateWindDirectionDebug(direction);
              } else {
                tooltipController.updatePickingInfo(info as any);
                tooltipController.updateTooltipValueOverride(null);
                tooltipController.updateTooltipWindSpeed(null);
                tooltipController.updateWindDirectionDebug(null);
              }
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "true");
              this.deps.dom.inhouseTooltip.style.visibility = "hidden";
              return;
            }
            if (uiState.layerMode === "precip" && isPrecip) {
              const infoAny = info as any;
              let coord = infoAny?.coordinate as [number, number] | undefined;
              if (
                !coord &&
                typeof infoAny?.x === "number" &&
                typeof infoAny?.y === "number"
              ) {
                const point = this.deps.unprojectMap([infoAny.x, infoAny.y]);
                coord = [point.lng, point.lat];
              }
              const windVectorLayer = coord
                ? catalogController.findPreferredInhouseWindVectorLayer(
                    "precip",
                  )
                : null;
              const windSpeedLayer =
                coord && !windVectorLayer
                  ? catalogController.findInhouseLayerByCandidates(
                      INHOUSE_GROUP_VARIABLES.precip.windSpeed,
                    )
                  : null;
              const windDirLayer =
                coord && !windVectorLayer
                  ? catalogController.findInhouseLayerByCandidates(
                      INHOUSE_GROUP_VARIABLES.precip.windDir,
                    )
                  : null;
              const windVector =
                coord && windVectorLayer
                  ? catalogController.sampleInhouseVectorAtCoord(
                      windVectorLayer,
                      coord,
                      getInhouseLayerBounds(windVectorLayer),
                    )
                  : null;
              const windSpeed =
                windVector?.value ??
                (coord && windSpeedLayer
                  ? sampleInhouseScalarAtCoord(
                      windSpeedLayer,
                      coord,
                      rasterBounds,
                    )
                  : null);
              const windDir =
                windVector?.direction ??
                (coord && windDirLayer
                  ? sampleInhouseScalarAtCoord(
                      windDirLayer,
                      coord,
                      rasterBounds,
                    )
                  : null);
              // Prefer the Float32 scalar grid for precise sub-mm/hr readings.
              // layer.scalar is decoded via expm1 so it has full log1p precision.
              // Fall back to raw raster (8-bit) only when scalar is unavailable.
              // We reset value before our samplers: nodata pixels are encoded as raw=0
              // (same as 0 mm/hr) so WeatherLayers GL returns a finite value=0 even for
              // out-of-domain pixels.  Our samplers check the domain mask and return null
              // for nodata, so we must not let the WeatherLayers pick override them.
              if (coord) {
                value = undefined;
              }
              if (coord && layer.scalar) {
                const sample = sampleInhouseScalarAtCoord(
                  layer,
                  coord,
                  rasterBounds,
                );
                if (typeof sample === "number") {
                  value = sample;
                }
              }
              if (
                (typeof value !== "number" || !Number.isFinite(value)) &&
                coord
              ) {
                const raw = sampleInhouseRasterAtCoord(
                  layer,
                  coord,
                  rasterBounds,
                );
                if (typeof raw === "number") {
                  const [min, max] = imageUnscale;
                  value =
                    imageScale === "log1p"
                      ? Math.expm1((raw / 255) * Math.log1p(max))
                      : min + (raw / 255) * (max - min);
                } else if (this.deps.isDev) {
                  console.log("[precip-hover] no raw sample", {
                    model: layer.model,
                    analysis: layer.analysis,
                    variable: layer.variable,
                    coord,
                    rasterBounds,
                    hasRasterScalar: Boolean(layer.rasterScalar),
                    hasDomainMask: Boolean(layer.domainMask),
                    maskOn: layer.domainMaskOn ?? 0,
                  });
                }
              }
              if (typeof value === "number" && Number.isFinite(value)) {
                tooltipController.updatePickingInfo({
                  ...(infoAny as any),
                  raster: {
                    value,
                    direction:
                      tooltipController.finiteDirectionOrUndefined(windDir),
                  },
                } as any);
                const rawUnit =
                  layer.manifest.unit ?? resolveInhouseUnit(layer.variable);
                const unit = rawUnit === "mm hr-1" ? "mm/hr" : rawUnit;
                const formatted =
                  value < 1 ? value.toFixed(2) : value.toFixed(1);
                tooltipController.updateTooltipValueOverride(
                  `${formatted}${unit ? ` ${unit}` : ""}`,
                );
                tooltipController.updateTooltipWindSpeedBeforeDirection(
                  windSpeed,
                );
                tooltipController.updateWindDirectionDebug(windDir);
                tooltipController.recenterBubble();
              } else {
                tooltipController.updatePickingInfo(info as any);
                tooltipController.updateTooltipValueOverride(null);
                tooltipController.updateTooltipWindSpeedBeforeDirection(null);
                tooltipController.updateWindDirectionDebug(null);
              }
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "true");
              this.deps.dom.inhouseTooltip.style.visibility = "hidden";
              return;
            }
            if (
              isAirTemp &&
              typeof value === "number" &&
              Number.isFinite(value)
            ) {
              tooltipController.clearAllAddons();
              tooltipController.updatePickingInfo(null);
              const displayValue = value > 100 ? value - 273.15 : value;
              this.deps.dom.inhouseTooltip.textContent = t(
                "tooltip.tempValue",
                { value: displayValue.toFixed(0) },
              );
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "false");
              const x = (info as any).x ?? 0;
              const y = (info as any).y ?? 0;
              this.deps.dom.inhouseTooltip.style.left = `${x}px`;
              this.deps.dom.inhouseTooltip.style.top = `${y}px`;
              this.deps.dom.inhouseTooltip.style.visibility = "visible";
              return;
            }
            if (typeof value === "number" && Number.isFinite(value)) {
              const unit =
                layer.manifest.unit ?? resolveInhouseUnit(layer.variable);
              const displayValue = value;
              const formatted = isCloud
                ? displayValue.toFixed(0)
                : displayValue.toFixed(2);
              if (uiState.layerMode === "waves" && isWaveHeight) {
                const wavePeriodLayer =
                  catalogController.findInhouseLayerByCandidates(
                    INHOUSE_GROUP_VARIABLES.waves.windSpeed,
                  );
                const waveDirLayer =
                  catalogController.findInhouseLayerByCandidates(
                    INHOUSE_GROUP_VARIABLES.waves.windDir,
                  );
                const coord = (info as any)?.coordinate as
                  | [number, number]
                  | undefined;
                if (coord && wavePeriodLayer && waveDirLayer) {
                  const period = sampleInhouseScalarAtCoord(
                    wavePeriodLayer,
                    coord,
                    rasterBounds,
                  );
                  const direction = sampleInhouseScalarAtCoord(
                    waveDirLayer,
                    coord,
                    rasterBounds,
                  );
                  const unitLabel = unit === "m" ? "m" : unit;
                  const heightStr = `${value.toFixed(1)}${unitLabel ? ` ${unitLabel}` : ""}`;
                  const periodStr =
                    typeof period === "number" && Number.isFinite(period)
                      ? t("tooltip.wavePeriod", { value: period.toFixed(1) })
                      : null;
                  const dirStr =
                    tooltipController.formatCardinalDirection(direction);
                  // Compass needle: same SVG + rotation formula as the WeatherLayers GL
                  // tooltip control (rotate by (from + 180) % 360 to show travel direction).
                  const normalized =
                    tooltipController.normalizeDirection(direction);
                  const arrowDeg =
                    normalized !== null ? (normalized + 180) % 360 : null;
                  const arrowHtml =
                    arrowDeg !== null
                      ? `<span class="inhouse-tooltip-direction-icon" style="transform:rotate(${arrowDeg}deg)" aria-hidden="true"></span>`
                      : "";
                  let label: string;
                  if (periodStr && dirStr && arrowHtml) {
                    label = `${heightStr} ${arrowHtml} ${dirStr} ${periodStr}`;
                  } else if (periodStr && arrowHtml) {
                    label = `${heightStr} ${arrowHtml} ${periodStr}`;
                  } else if (periodStr) {
                    label = `${heightStr} ${periodStr}`;
                  } else {
                    label = heightStr;
                  }
                  tooltipController.updatePickingInfo(null);
                  this.deps.dom.inhouseTooltip.innerHTML = label;
                  this.deps.dom.inhouseTooltip.setAttribute(
                    "aria-hidden",
                    "false",
                  );
                  const x = (info as any).x ?? 0;
                  const y = (info as any).y ?? 0;
                  this.deps.dom.inhouseTooltip.style.left = `${x}px`;
                  this.deps.dom.inhouseTooltip.style.top = `${y}px`;
                  this.deps.dom.inhouseTooltip.style.visibility = "visible";
                  return;
                }
              }
              this.deps.dom.inhouseTooltip.textContent = `${formatted}${unit ? ` ${unit}` : ""}`;
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "false");
              const x = (info as any).x ?? 0;
              const y = (info as any).y ?? 0;
              this.deps.dom.inhouseTooltip.style.left = `${x}px`;
              this.deps.dom.inhouseTooltip.style.top = `${y}px`;
              this.deps.dom.inhouseTooltip.style.visibility = "visible";
            } else {
              this.deps.dom.inhouseTooltip.setAttribute("aria-hidden", "true");
              this.deps.dom.inhouseTooltip.style.visibility = "hidden";
            }
          },
        });
        return rasterLayer;
      });

    const inhouseContourLayers = catalogController.inhouseLayers
      .filter(
        (layer) =>
          layer.visible && layer.image && layer.renderMode === "contour",
      )
      .map((layer) => {
        const bounds = layer.manifest.bounds;
        const imageUnscale = getInhouseLayerUnscale(layer);
        const grid =
          layer.scalar ??
          decodeScalarGrid(
            layer.image!,
            imageUnscale,
            getInhouseLayerImageScale(layer),
          );
        const contourImage: WeatherLayers.TextureData = {
          data: grid.data,
          width: grid.width,
          height: grid.height,
        };
        const cropped = mapBoundsNormalized
          ? cropScalarImageToBounds(contourImage, bounds, mapBoundsNormalized)
          : { image: contourImage, bounds };
        const { interval } = this.getInhouseContourIntervals(layer);
        let min = Infinity;
        let max = -Infinity;
        for (
          let i = 0;
          i < (cropped.image as { data: Float32Array }).data.length;
          i += 1
        ) {
          const value = (cropped.image as { data: Float32Array }).data[i];
          if (!Number.isFinite(value)) continue;
          if (value < min) min = value;
          if (value > max) max = value;
        }
        const thresholds: number[] = [];
        if (Number.isFinite(min) && Number.isFinite(max) && interval > 0) {
          const start = Math.ceil(min / interval) * interval;
          const end = Math.floor(max / interval) * interval;
          for (let v = start; v <= end; v += interval) {
            thresholds.push(Number(v.toFixed(2)));
          }
        }
        const downsample = getInhouseContourDownsample(this.deps.getMapZoom());
        const contourKey = `${layer.id}:${timelineController.currentDatetime || "latest"}:${cropped.image.width}x${cropped.image.height}:d${downsample}:${cropped.bounds.join(",")}:${interval}`;
        const cached = catalogController.contourCache.get(contourKey);
        let paths: { path: [number, number][]; value: number }[] = [];
        if (cached) {
          paths = cached;
        } else if (thresholds.length) {
          this.scheduleInhouseContours(
            contourKey,
            cropped.image,
            cropped.bounds,
            thresholds,
            downsample,
          );
        }
        return new PathLayer({
          id: `inhouse-contours-${layer.id}`,
          data: paths,
          getPath: (d) => d.path,
          getColor: [20, 20, 20, 180],
          getWidth: 1.1,
          widthUnits: "pixels",
          visible: uiState.visible,
          pickable: false,
          parameters: { depthTest: false },
        });
      });

    const windSpeedLayer = catalogController.findInhouseLayerByCandidates(
      INHOUSE_GROUP_VARIABLES.wind.windSpeed,
    );
    const windVectorLayer =
      catalogController.findPreferredInhouseWindVectorLayer("wind");
    const windDirLayer = windVectorLayer
      ? null
      : catalogController.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.wind.windDir,
        );
    const wavePeriodLayer = catalogController.findInhouseLayerByCandidates(
      INHOUSE_GROUP_VARIABLES.waves.windSpeed,
    );
    const waveDirLayer = catalogController.findInhouseLayerByCandidates(
      INHOUSE_GROUP_VARIABLES.waves.windDir,
    );

    const windOverlayStyle = getWindOverlayStyle(
      windSpeedLayer?.model ?? windVectorLayer?.model ?? null,
      this.deps.getMapZoom(),
    );
    const windStreamlineStyle = getWindStreamlineStyle(this.deps.getMapZoom());
    const arrowStep = windOverlayStyle.arrowStep;
    const arrowStepX = windOverlayStyle.arrowStepX;
    const arrowStepY = windOverlayStyle.arrowStepY;
    const labelStep = windOverlayStyle.labelStep;
    const waveArrowStep = getArrowStepForModel(
      wavePeriodLayer?.model ?? null,
      this.deps.getMapZoom(),
    );

    const windArrowPoints =
      uiState.visible &&
      !this.isZooming &&
      ((uiState.layerMode === "wind" &&
        windStyleController.style === "arrows") ||
        uiState.layerMode === "precip") &&
      ((windVectorLayer &&
        catalogController.isInhouseVectorLayer(windVectorLayer)) ||
        (windSpeedLayer && windDirLayer))
        ? windVectorLayer &&
          catalogController.isInhouseVectorLayer(windVectorLayer)
          ? this.buildArrowPointsFromVectorLayer(
              windVectorLayer,
              getInhouseLayerBounds(windVectorLayer),
              true,
              arrowStep,
              windOverlayStyle.arrowSizeMin,
              windOverlayStyle.arrowSizeMax,
              `windv:${windVectorLayer.id}:${catalogController.inhouseTimeIndex}:sx${arrowStepX}sy${arrowStepY}:m${windOverlayStyle.arrowMagnitudeMin}-${windOverlayStyle.arrowMagnitudeMax}`,
              windOverlayStyle.arrowMagnitudeMin,
              windOverlayStyle.arrowMagnitudeMax,
              arrowStepX,
              arrowStepY,
            )
          : buildArrowPoints(
              windSpeedLayer!,
              windDirLayer!,
              true,
              windSpeedLayer!.manifest.bounds,
              arrowStep,
              windOverlayStyle.arrowSizeMin,
              windOverlayStyle.arrowSizeMax,
              `wind:${windSpeedLayer!.id}:${windDirLayer!.id}:${catalogController.inhouseTimeIndex}:sx${arrowStepX}sy${arrowStepY}:m${windOverlayStyle.arrowMagnitudeMin}-${windOverlayStyle.arrowMagnitudeMax}`,
              windOverlayStyle.arrowMagnitudeMin,
              windOverlayStyle.arrowMagnitudeMax,
              arrowStepX,
              arrowStepY,
            )
        : [];

    const windLabelPoints =
      uiState.visible &&
      !this.isZooming &&
      uiState.layerMode === "wind" &&
      windStyleController.style === "arrows" &&
      windSpeedLayer
        ? buildWindLabelPoints(
            windSpeedLayer,
            windSpeedLayer.manifest.bounds,
            labelStep,
            `wind-labels:${windSpeedLayer.id}:${catalogController.inhouseTimeIndex}:s${labelStep}:o1.8-1.8`,
            1.8,
            1.8,
          )
        : [];

    const shouldRenderWindStreamlines =
      uiState.visible &&
      !this.isZooming &&
      uiState.layerMode === "wind" &&
      windStyleController.style === "streamlines" &&
      Boolean(
        windVectorLayer &&
        catalogController.isInhouseVectorLayer(windVectorLayer),
      );

    const windStreamlineKey =
      shouldRenderWindStreamlines && windVectorLayer
        ? `wind-streamlines:${windVectorLayer.id}:${catalogController.inhouseTimeIndex}:d${windStreamlineStyle.density}:m0.25:f${this.WIND_STREAMLINE_FLIP ? 1 : 0}`
        : "";
    this.activeWindStreamlineKey = windStreamlineKey;
    if (shouldRenderWindStreamlines && windVectorLayer) {
      this.scheduleWindStreamlines(
        windStreamlineKey,
        windVectorLayer,
        windStreamlineStyle.density,
        0.25,
      );
    }
    const windStreamlines =
      windStreamlineKey && this.windStreamlineCache.has(windStreamlineKey)
        ? (this.windStreamlineCache.get(windStreamlineKey) ?? null)
        : null;
    const windStreamlineArrowHeads =
      windStreamlines && windStreamlines.features.length > 0
        ? buildStreamlineArrowHeads(
            windStreamlines,
            `${windStreamlineKey}:a${windStreamlineStyle.arrowSize}`,
            windStreamlineStyle.arrowSize,
          )
        : [];

    const waveArrowPoints =
      uiState.visible &&
      !this.isZooming &&
      uiState.layerMode === "waves" &&
      wavePeriodLayer &&
      waveDirLayer
        ? buildArrowPoints(
            wavePeriodLayer,
            waveDirLayer,
            WAVE_DIRECTION_IS_FROM,
            wavePeriodLayer.manifest.bounds,
            waveArrowStep,
            10,
            28,
            `waves:${wavePeriodLayer.id}:${waveDirLayer.id}:${catalogController.inhouseTimeIndex}:s${waveArrowStep}`,
          )
        : [];

    const shouldRenderWindParticles =
      uiState.visible &&
      uiState.layerMode === "wind" &&
      windStyleController.style === "particles" &&
      this.deps.supportsWindParticlesPlatform &&
      windStyleController.runtimeAvailable &&
      Boolean(
        windVectorLayer &&
        catalogController.isInhouseVectorLayer(windVectorLayer),
      );

    let windParticleLayer: WeatherLayers.ParticleLayer | null = null;
    if (shouldRenderWindParticles && !this.deps.supportsWindParticlesPlatform) {
      windStyleController.setStyle("arrows");
      windStyleController.setWarning(
        this.deps.isFirefox
          ? "Particle layer is not supported in Firefox; falling back to arrows."
          : "Particle layer unavailable; falling back to arrows.",
      );
      windStyleController.syncControls();
    } else if (
      shouldRenderWindParticles &&
      windVectorLayer?.image &&
      !(windVectorLayer.image instanceof Promise)
    ) {
      windStyleController.setWarning("");
      try {
        catalogController.logWindParticleTextureDebug(
          windVectorLayer,
          catalogController.inhouseTimeIndex,
        );
        const particleTexture = catalogController.getParticleTextureData(
          windVectorLayer.image,
        );
        // Blank out velocity (R, G) and alpha for out-of-domain pixels so the particle
        // system doesn't spawn or move particles outside the model domain.
        if (windVectorLayer.domainMask) {
          const mask = windVectorLayer.domainMask;
          const pData = particleTexture.data as Uint8Array;
          for (let pi = 0; pi < mask.length; pi += 1) {
            if (mask[pi] === 0) {
              pData[pi * 4 + 0] = 0; // U = 0
              pData[pi * 4 + 1] = 0; // V = 0
              pData[pi * 4 + 3] = 0; // alpha = 0
            }
          }
        }
        windParticleLayer = new WeatherLayers.ParticleLayer({
          id: `wind-particles-${windVectorLayer.model}-${windVectorLayer.analysis}-${catalogController.inhouseTimeIndex}`,
          image: particleTexture,
          imageType: WeatherLayers.ImageType.VECTOR,
          imageUnscale: getInhouseLayerUnscale(windVectorLayer),
          bounds: getInhouseLayerBounds(windVectorLayer),
          numParticles: windStyleController.numParticles,
          maxAge: windStyleController.maxAge,
          speedFactor: windStyleController.speedFactor,
          width: 2,
          animate: true,
          pickable: false,
        });
      } catch (error) {
        windStyleController.handleParticleFailure(error);
        windParticleLayer = null;
      }
    } else {
      if (uiState.layerMode === "wind" && !windStyleController.hasWindUv10m) {
        windStyleController.setWarning(
          "Particles and streamlines require wind_uv_10m.",
        );
      } else if (
        uiState.layerMode === "wind" &&
        windStyleController.style === "particles" &&
        !windStyleController.runtimeAvailable
      ) {
        windStyleController.setWarning(
          "Particle layer unavailable; falling back to arrows.",
        );
      } else if (
        uiState.layerMode !== "wind" ||
        windStyleController.style !== "particles"
      ) {
        windStyleController.setWarning("");
      }
    }

    const gridLayers = [
      new LineLayer({
        id: "graticule-lines",
        data: gridLines,
        getSourcePosition: (d) => d.source,
        getTargetPosition: (d) => d.target,
        getColor: [60, 60, 60],
        getWidth: 1,
        opacity: 0.35,
        visible: uiState.showGrid,
        parameters: { depthTest: false },
      }),
    ];

    const windArrowLayer =
      windArrowPoints.length > 0
        ? new IconLayer({
            id: "inhouse-wind-arrows",
            data: windArrowPoints,
            getPosition: (d) => (d as ArrowPoint).position,
            getAngle: (d) => (d as ArrowPoint).angle,
            getSize: (d) => (d as ArrowPoint).size,
            getColor: () => [0, 0, 0, 230],
            getIcon: () => ARROW_ICON,
            sizeUnits: "pixels",
            sizeScale: 1,
            alphaCutoff: 0.05,
            visible: uiState.visible,
            pickable: false,
            parameters: { depthTest: false },
          })
        : null;

    const windLabelLayer =
      windLabelPoints.length > 0
        ? new TextLayer({
            id: "inhouse-wind-labels",
            data: windLabelPoints,
            getPosition: (d) => (d as WindLabelPoint).position,
            getText: (d) => (d as WindLabelPoint).text,
            getSize: windOverlayStyle.labelSize,
            sizeUnits: "pixels",
            sizeMinPixels: windOverlayStyle.labelSize,
            sizeMaxPixels: windOverlayStyle.labelSize + 2,
            getColor: [0, 0, 0, 230],
            getTextAnchor: "middle",
            getAlignmentBaseline: "center",
            fontSettings: { sdf: true },
            outlineWidth: 3,
            outlineColor: [255, 255, 255, 230],
            billboard: true,
            pickable: false,
            visible: uiState.visible,
            parameters: { depthTest: false },
          })
        : null;

    const windStreamlineLayer =
      windStreamlines && windStreamlines.features.length > 0
        ? new GeoJsonLayer({
            id: "inhouse-wind-streamlines",
            data: windStreamlines,
            stroked: true,
            filled: false,
            getLineColor: [0, 0, 0, 210],
            getLineWidth: windStreamlineStyle.width,
            lineWidthUnits: "pixels",
            pickable: false,
            visible: uiState.visible,
            parameters: { depthTest: false },
          })
        : null;

    const windStreamlineArrowHeadLayer =
      windStreamlineArrowHeads.length > 0
        ? new IconLayer({
            id: "inhouse-wind-streamline-arrow-heads",
            data: windStreamlineArrowHeads,
            getPosition: (d) => (d as ArrowPoint).position,
            getAngle: (d) => (d as ArrowPoint).angle,
            getSize: (d) => (d as ArrowPoint).size,
            getColor: () => [0, 0, 0, 210],
            getIcon: () => ARROW_HEAD_ICON,
            sizeUnits: "pixels",
            sizeScale: 1,
            alphaCutoff: 0.05,
            visible: uiState.visible,
            pickable: false,
            parameters: { depthTest: false },
          })
        : null;

    const waveArrowLayer =
      waveArrowPoints.length > 0
        ? new IconLayer({
            id: "inhouse-wave-arrows",
            data: waveArrowPoints,
            getPosition: (d) => (d as ArrowPoint).position,
            getAngle: (d) => (d as ArrowPoint).angle,
            getSize: (d) => (d as ArrowPoint).size,
            getColor: () => [0, 0, 0, 230],
            getIcon: () => ARROW_ICON,
            sizeUnits: "pixels",
            sizeScale: 1,
            alphaCutoff: 0.05,
            visible: uiState.visible,
            pickable: false,
            parameters: { depthTest: false },
          })
        : null;

    const waveClickMarkerLayer =
      wavegramController.isLoading && wavegramController.activeCoord
        ? new ScatterplotLayer({
            id: "wavegram-click-marker",
            data: [{ position: wavegramController.activeCoord }],
            getPosition: (d) => (d as { position: [number, number] }).position,
            getRadius: 6,
            radiusUnits: "pixels",
            getFillColor: [20, 20, 20, 200],
            getLineColor: [255, 255, 255, 220],
            lineWidthUnits: "pixels",
            getLineWidth: 1.5,
            pickable: false,
            parameters: { depthTest: false },
          })
        : null;

    // Snow overlay: SVG element mounted over the map, updated on every viewport change.
    (() => {
      const active = uiState.layerMode === "precip" && uiState.visible;
      const snowLayer = active
        ? catalogController.findInhouseLayerByCandidates(["snow_fraction"])
        : null;

      if (!snowLayer?.rasterScalar) {
        // Clear overlay when not in precip mode or no data.
        this.snowOverlaySVG?.update(null, this.deps.projectMap, 0, 0, {
          west: 0,
          south: 0,
          east: 0,
          north: 0,
        });
        return;
      }

      // Lazy-create the SVG element once (mounted to the MapLibre container).
      if (!this.snowOverlaySVG) {
        this.snowOverlaySVG = new SnowOverlaySVG(this.deps.getMapContainer());
      }

      // Extract points; cache by rasterScalar identity so we re-extract only on new frames.
      let points = this.snowPointsCache.get(snowLayer.rasterScalar);
      if (!points) {
        points = extractSnowPoints(snowLayer) ?? [];
        this.snowPointsCache.set(snowLayer.rasterScalar, points);
      }

      const mb = this.deps.getMapBounds();
      this.snowOverlaySVG.update(
        points.length > 0 ? points : null,
        this.deps.projectMap,
        uiState.opacity,
        this.deps.getMapZoom(),
        {
          west: mb.getWest(),
          south: mb.getSouth(),
          east: mb.getEast(),
          north: mb.getNorth(),
        },
        snowLayer.model ?? "",
      );
    })();

    const layers = [
      ...inhouseRasterLayers,
      ...inhouseContourLayers,
      ...(windParticleLayer ? [windParticleLayer] : []),
      ...(windStreamlineLayer ? [windStreamlineLayer] : []),
      ...(windStreamlineArrowHeadLayer ? [windStreamlineArrowHeadLayer] : []),
      ...(windArrowLayer ? [windArrowLayer] : []),
      ...(windLabelLayer ? [windLabelLayer] : []),
      ...(waveArrowLayer ? [waveArrowLayer] : []),
      ...(waveClickMarkerLayer ? [waveClickMarkerLayer] : []),
      ...(outlineLayer ? [outlineLayer] : []),
      ...gridLayers,
    ];

    this.deps.setOverlayProps({ layers: layers as unknown as LayersList });
    this.lastCompositeLayers = layers;
    this.lastGridLines = gridLines;
    this.lastGridStep = gridStep;
    this.lastWindStep = getWindStepForZoom(this.deps.getMapZoom());
  }

  public syncLegendForMode(mode: UiState["layerMode"]): void {
    const host = this.deps.dom.legendHost;
    if (!host) return;

    if (mode === "waves") {
      // Wave height legend lives in its own dedicated host (#wave-legend-control),
      // shown/hidden exactly like wind/precip/cloud/snow — no innerHTML replacement
      // needed here; the host was pre-rendered by initLegends().
      // (Nothing to do in syncLegendForMode for waves.)
    } else if (mode === "temperature") {
      // Remove LegendControl (if coming from waves mode) and render custom HTML.
      if (this.legendControl) {
        this.legendControl.remove();
        this.legendControl = null;
      }
      const currentModel =
        this.deps.getCatalogController().inhouseSelectedModel;
      if (currentModel === "BEL-BR") {
        this.renderTempTropicsLegend(host);
      } else {
        this.renderTempLegend(host);
      }
    }
    // Cloud legend lives in its own host — render/refresh it when switching to cloud mode.
    if (mode === "cloud") {
      const cloudHost = this.deps.dom.cloudLegendHost;
      if (cloudHost) {
        cloudHost.innerHTML = "";
        this.renderCloudLegend(cloudHost);
      }
    }
    // Snow depth legend lives in its own host — render/refresh when switching to snow mode.
    if (mode === "snow") {
      const snowHost = this.deps.dom.snowDepthLegendHost;
      if (snowHost) {
        snowHost.innerHTML = "";
        this.renderSnowDepthLegend(snowHost);
      }
    }
  }

  private getWindSpeedPalette(): PaletteArray {
    return Array.isArray(this.windSpeedScaleValueStep)
      ? (this.windSpeedScaleValueStep as PaletteArray)
      : [];
  }

  private getPrecipScaleFactor(): number {
    return 1;
  }

  private toRgbaCss(color: [number, number, number, number]): string {
    const [r, g, b, a] = color;
    return `rgba(${r}, ${g}, ${b}, ${(a ?? 255) / 255})`;
  }

  private readonly windLegendTicks = [0, 5, 10, 15, 20, 25, 30, 35, 40];
  private readonly windScaleMin = 0;
  private readonly windScaleMax = 40;

  private getWindStopPercent(value: number): number {
    return (
      ((value - this.windScaleMin) / (this.windScaleMax - this.windScaleMin)) *
      100
    );
  }

  private renderWindLegend(host: HTMLDivElement): void {
    const palette = (
      this.windSpeedScaleValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    ).filter(([value]) => (value as number) <= this.windScaleMax);

    const stops = palette
      .map(([value, color]) => ({
        value,
        percent: this.getWindStopPercent(value as number),
        color: this.toRgbaCss(color as [number, number, number, number]),
      }))
      .sort((a, b) => a.value - b.value);

    const gradient = stops
      .flatMap((stop, index) => {
        const next = stops[Math.min(index + 1, stops.length - 1)];
        const start = stop.percent.toFixed(2);
        const end = next.percent.toFixed(2);
        return [`${stop.color} ${start}%`, `${stop.color} ${end}%`];
      })
      .join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__title"><span class="precip-legend__unit">m/s</span></div>
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.windLegendTicks
              .map((value) => {
                const percent = this.getWindStopPercent(value);
                return `<div class="precip-legend__label" style="bottom: ${percent.toFixed(2)}%">${value}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private readonly tempLegendTicks = [
    -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30,
  ];
  private readonly tempScaleMin = -30;
  private readonly tempScaleMax = 30;

  private getTempStopPercent(value: number): number {
    return (
      ((value - this.tempScaleMin) / (this.tempScaleMax - this.tempScaleMin)) *
      100
    );
  }

  private renderTempLegend(host: HTMLDivElement): void {
    const stops = (
      this.temperatureScaleCValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    )
      .map(([value, color]) => ({
        value,
        percent: this.getTempStopPercent(value),
        color: this.toRgbaCss(color as [number, number, number, number]),
      }))
      .sort((a, b) => a.value - b.value);

    const gradient = stops
      .flatMap((stop, index) => {
        const next = stops[Math.min(index + 1, stops.length - 1)];
        const start = stop.percent.toFixed(2);
        const end = next.percent.toFixed(2);
        return [`${stop.color} ${start}%`, `${stop.color} ${end}%`];
      })
      .join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__title"><span class="precip-legend__unit">°C</span></div>
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.tempLegendTicks
              .map((value) => {
                const percent = this.getTempStopPercent(value);
                return `<div class="precip-legend__label" style="bottom: ${percent.toFixed(2)}%">${value}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private readonly tempTropicsLegendTicks = [
    -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40,
  ];
  private readonly tempTropicsScaleMin = -20;
  private readonly tempTropicsScaleMax = 40;

  private getTempTropicsStopPercent(value: number): number {
    return (
      ((value - this.tempTropicsScaleMin) /
        (this.tempTropicsScaleMax - this.tempTropicsScaleMin)) *
      100
    );
  }

  private renderTempTropicsLegend(host: HTMLDivElement): void {
    const stops = (
      this.temperatureScaleTropicsValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    )
      .map(([value, color]) => ({
        value,
        percent: this.getTempTropicsStopPercent(value),
        color: this.toRgbaCss(color as [number, number, number, number]),
      }))
      .sort((a, b) => a.value - b.value);

    const gradient = stops
      .flatMap((stop, index) => {
        const next = stops[Math.min(index + 1, stops.length - 1)];
        const start = stop.percent.toFixed(2);
        const end = next.percent.toFixed(2);
        return [`${stop.color} ${start}%`, `${stop.color} ${end}%`];
      })
      .join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__title"><span class="precip-legend__unit">°C</span></div>
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.tempTropicsLegendTicks
              .map((value) => {
                const percent = this.getTempTropicsStopPercent(value);
                return `<div class="precip-legend__label" style="bottom: ${percent.toFixed(2)}%">${value}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private getPrecipStopPercent(value: number): number {
    const index = this.precipTicks.indexOf(value);
    if (index < 0 || this.precipTicks.length <= 1) {
      return 0;
    }
    const percent = index / (this.precipTicks.length - 1);
    return Math.max(0, Math.min(1, percent)) * 100;
  }

  private renderPrecipLegend(host: HTMLDivElement): void {
    const stops = (
      this.precipScaleValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    )
      .map(([value, color]) => ({
        value,
        percent: this.getPrecipStopPercent(value),
        color: this.toRgbaCss(color as [number, number, number, number]),
      }))
      .sort((a, b) => a.value - b.value);

    const gradient = stops
      .flatMap((stop, index) => {
        const next = stops[Math.min(index + 1, stops.length - 1)];
        const start = stop.percent.toFixed(2);
        const end = next.percent.toFixed(2);
        return [`${stop.color} ${start}%`, `${stop.color} ${end}%`];
      })
      .join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__title"><span class="precip-legend__unit">${t("unit.mmhr")}</span></div>
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.precipTicks
              .map((value) => {
                const percent = this.getPrecipStopPercent(value);
                return `<div class="precip-legend__label" style="bottom: ${percent.toFixed(2)}%">${value}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  // 5 equal-height colour bands (each 20% of the bar), matching cloud_area_fraction_scale.svg.
  // Labels sit at the bottom edge of each band: 0, ¼, ½, ¾, ⁴⁄₄.
  // ⁴⁄₄ uses Unicode superscript-4 + fraction-slash + subscript-4 (no single code point exists).
  private readonly cloudTickLabels = ["0", "1/4", "2/4", "3/4", "4/4"];

  private renderCloudLegend(host: HTMLDivElement): void {
    // The scale has 6 entries (5 bin-start stops + 1 terminal anchor at 100 with the
    // same colour as bin 5).  Drop the terminal so we render exactly 5 equal bands.
    const allColors = (
      this.cloudCoverScaleValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    )
      .slice()
      .sort(([a], [b]) => a - b)
      .map(([, color]) =>
        this.toRgbaCss(color as [number, number, number, number]),
      );
    const colors = allColors.slice(0, -1); // 5 bin colours, terminal dropped

    const n = colors.length; // 5
    const bandPct = 100 / n; // 20 %

    // Build a hard-step gradient: each colour occupies exactly one band.
    const gradientParts: string[] = [];
    colors.forEach((color, i) => {
      const lo = (i * bandPct).toFixed(2);
      const hi = ((i + 1) * bandPct).toFixed(2);
      gradientParts.push(`${color} ${lo}%`, `${color} ${hi}%`);
    });
    const gradient = gradientParts.join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.cloudTickLabels
              .map((label, i) => {
                const bottom = (i * bandPct).toFixed(2);
                return `<div class="precip-legend__label" style="bottom: ${bottom}%; font-size: 1.5em;">${label}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  // Snow depth ticks match the SVG legend: 0,1,5,10,20,50,100,200,500,1K,5K
  // These coincide exactly with the 11 scale stops, so index-based positioning gives
  // each tick the correct visual position on the graduated bar.
  private readonly snowDepthTicks = [
    0, 1, 5, 10, 20, 50, 100, 200, 500, 1000, 5000,
  ];
  private readonly snowDepthTickLabels = [
    "0",
    "1",
    "5",
    "10",
    "20",
    "50",
    "100",
    "200",
    "500",
    "1K",
    "5K",
  ];

  private getSnowDepthStopPercent(value: number): number {
    const scale = this.snowDepthScaleValue as unknown as [number, unknown][];
    const values = scale.map(([v]) => v as number);
    const index = values.indexOf(value);
    if (index < 0 || values.length <= 1) return 0;
    return (index / (values.length - 1)) * 100;
  }

  private renderSnowDepthLegend(host: HTMLDivElement): void {
    const stops = (
      this.snowDepthScaleValue as unknown as [
        number,
        [number, number, number, number],
      ][]
    )
      .map(([value, color]) => ({
        value,
        percent: this.getSnowDepthStopPercent(value),
        color: this.toRgbaCss(color as [number, number, number, number]),
      }))
      .sort((a, b) => a.value - b.value);

    const gradient = stops
      .flatMap((stop, index) => {
        const next = stops[Math.min(index + 1, stops.length - 1)];
        const start = stop.percent.toFixed(2);
        const end = next.percent.toFixed(2);
        return [`${stop.color} ${start}%`, `${stop.color} ${end}%`];
      })
      .join(", ");

    host.innerHTML = `
      <div class="precip-legend">
        <div class="precip-legend__title"><span class="precip-legend__unit">mm</span></div>
        <div class="precip-legend__scale">
          <div class="precip-legend__bar" style="background: linear-gradient(to top, ${gradient});"></div>
          <div class="precip-legend__labels">
            ${this.snowDepthTicks
              .map((value, i) => {
                const percent = this.getSnowDepthStopPercent(value);
                const label = this.snowDepthTickLabels[i] ?? String(value);
                return `<div class="precip-legend__label" style="bottom: ${percent.toFixed(2)}%">${label}</div>`;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  private renderWaveHeightLegend(host: HTMLDivElement): void {
    // 30 discrete 1-m bins from 0–30 m.
    // Replicates the WL GL LegendControl's horizontal layout (title → colour bar → ticks)
    // using the same CSS classes so the visual is identical, but without calling addTo()
    // which triggers DOM side-effects that break positioning on dynamic mode switches.
    const totalRange = 30; // metres
    const scale = WAVE_HEIGHT_SCALE as [number, string][];
    const width = 220;
    const ticksCount = 7; // 0, 5, 10, 15, 20, 25, 30

    const title = t("legend.waveHeight");
    const unit = t("unit.metres");

    // SVG linearGradient with two stops per 1-m band → crisp step boundaries,
    // identical to the pixelated raster and to what WL GL's colorRampCanvas PNG produces.
    const stopElements = scale
      .slice(0, -1) // drop terminal anchor [30, '#00ffff']
      .flatMap(([value, hex], i) => {
        const next = scale[i + 1];
        const start = ((value / totalRange) * 100).toFixed(3);
        const end = ((next[0] / totalRange) * 100).toFixed(3);
        return [
          `<stop offset="${start}%" stop-color="${hex}"/>`,
          `<stop offset="${end}%"   stop-color="${hex}"/>`,
        ];
      })
      .join("");

    const ticks = Array.from({ length: ticksCount }, (_, i) =>
      Math.round((totalRange / (ticksCount - 1)) * i),
    ); // [0, 5, 10, 15, 20, 25, 30]

    const tickElements = ticks
      .map((v, i) => {
        const pct = ((v / totalRange) * 100).toFixed(3);
        const anchor =
          i === 0 ? "start" : i === ticksCount - 1 ? "end" : "middle";
        // Nudge the first/last tick lines inward by 0.5 px so they sit inside the bar
        const lineXform =
          i === 0
            ? ' transform="translate(0.5 0)"'
            : i === ticksCount - 1
              ? ' transform="translate(-0.5 0)"'
              : "";
        return (
          `<g style="transform:translate(${pct}%,0)">` +
          `<line y1="0" y2="10" stroke="currentColor"${lineXform}/>` +
          `<text x="0" y="22" style="text-anchor:${anchor};font-size:11px;">${v}</text>` +
          `</g>`
        );
      })
      .join("");

    // Wrap in .weatherlayers-legend-control so the already-injected WL GL CSS styles it.
    host.innerHTML = `
      <div class="weatherlayers-legend-control" style="width:${width}px;">
        <div>
          <header>
            <span class="weatherlayers-legend-control__text">${title} [${unit}]</span>
          </header>
          <main>
            <svg height="24px" class="weatherlayers-legend-control__legend" style="overflow:visible;">
              <defs>
                <linearGradient id="wave-height-ramp" x1="0" y1="0" x2="1" y2="0">
                  ${stopElements}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="5" fill="url(#wave-height-ramp)"/>
              ${tickElements}
            </svg>
          </main>
        </div>
      </div>
    `;
  }

  private getInhouseContourIntervals(layer: InhouseLayer): {
    interval: number;
    majorInterval: number;
  } {
    const catalogController = this.deps.getCatalogController();
    const meta = catalogController.inhouseVariableMeta[layer.variable];
    if (meta?.contourInterval) {
      return {
        interval: meta.contourInterval,
        majorInterval: meta.majorInterval ?? meta.contourInterval,
      };
    }
    if (layer.variable.includes("pressure")) {
      return { interval: 4, majorInterval: 20 };
    }
    if (layer.variable.includes("temperature")) {
      return { interval: 5, majorInterval: 10 };
    }
    return { interval: 10, majorInterval: 20 };
  }

  private scheduleInhouseContours(
    key: string,
    image: WeatherLayers.TextureData,
    bounds: [number, number, number, number],
    thresholds: number[],
    downsample: number,
  ): void {
    const catalogController = this.deps.getCatalogController();
    if (
      catalogController.contourPending.has(key) ||
      catalogController.contourCache.has(key)
    )
      return;
    catalogController.contourPending.add(key);
    const payload = {
      key,
      image: (image as { data: Float32Array }).data,
      width: image.width,
      height: image.height,
      bounds,
      landMask: null,
      bufferPx: 0,
      downsample,
      thresholds,
    };
    this.contourWorker.postMessage(payload);
  }

  private async ensureWindLayerReady(): Promise<void> {
    const timelineController = this.deps.getTimelineController();
    if (this.windLayerLoading) return;
    if (this.windDatasetMeta && this.windData) return;
    this.windLayerLoading = true;
    try {
      if (!this.windDatasetMeta) {
        const windDataset = await this.deps.client.loadDataset(
          this.windDatasetId,
        );
        this.windDatasetMeta = windDataset;
        this._windPalette = this.windSpeedScaleValue;
        this._windUnitFormat = windDataset.unitFormat ?? null;
        if (this.deps.dom.windLegendHost.children.length === 0) {
          this.renderWindLegend(this.deps.dom.windLegendHost);
        }
      }
      if (
        timelineController.timelineRange &&
        !timelineController.windTimelineDatetimes.length
      ) {
        const windSlice = await this.deps.client.loadDatasetSlice(
          this.windDatasetId,
          timelineController.timelineRange,
        );
        timelineController.windTimelineDatetimes = windSlice.datetimes.slice();
      }
      if (timelineController.currentDatetime) {
        if (!this.windData) {
          const windDatetime = timelineController.resolveDatasetDatetime(
            timelineController.currentDatetime,
            timelineController.windTimelineDatetimes,
            timelineController.activeTimelineDatetimes,
          );
          await this.loadWindData(windDatetime);
        }
      } else {
        this.windData = await this.deps.client.loadDatasetData(
          this.windDatasetId,
        );
      }
      this.scheduleUpdateLayers();
      timelineController.updateTimelineControlForMode("wind");
    } catch (error) {
      console.warn(t("error.windData"), error);
    } finally {
      this.windLayerLoading = false;
    }
  }

  private async ensurePrecipLayerReady(): Promise<void> {
    const timelineController = this.deps.getTimelineController();
    if (this.precipLayerLoading) return;
    this.precipLayerLoading = true;
    try {
      await this.ensureWindLayerReady();
      if (!this.precipDatasetMeta) {
        const resolved = await this.resolvePrecipDatasetId();
        this.precipDatasetMeta = resolved?.dataset ?? null;
        if (
          this.precipDatasetMeta &&
          this.deps.dom.precipLegendHost.children.length === 0
        ) {
          this.renderPrecipLegend(this.deps.dom.precipLegendHost);
        }
      }
      if (this.precipDatasetMeta) {
        if (timelineController.currentDatetime) {
          if (!this.precipData) {
            await this.loadPrecipData(timelineController.currentDatetime);
          }
        } else {
          this.precipData = await this.deps.client.loadDatasetData(
            this.precipDatasetId,
          );
        }
        if (this.windDatasetMeta && timelineController.currentDatetime) {
          const windDatetime = timelineController.resolveDatasetDatetime(
            timelineController.currentDatetime,
            timelineController.windTimelineDatetimes,
            timelineController.activeTimelineDatetimes,
          );
          if (
            !this.windData ||
            (this.windData as { datetime?: string }).datetime !== windDatetime
          ) {
            await this.loadWindData(windDatetime);
          }
        }
        this.scheduleUpdateLayers();
      }
    } catch (error) {
      console.warn(t("error.precipData"), error);
    } finally {
      this.precipLayerLoading = false;
    }
  }

  private setStatus(_message: string): void {}

  private logVectorSamples(image: WeatherLayers.TextureData): void {
    const points = WeatherLayers.getRasterPoints(
      {
        image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.VECTOR,
        imageUnscale: [-128, 127],
        imageMinValue: null,
        imageMaxValue: null,
      },
      [-180, -90, 180, 90],
      [
        [-90, 30],
        [-80, 35],
        [-70, 40],
      ],
    );
    if (this.deps.isDev)
      console.debug(
        "Wind sample points",
        points.features.map((f) => f.properties),
      );
  }

  private sampleScalarValue(
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    position: [number, number],
  ): number | null {
    const points = WeatherLayers.getRasterPoints(
      {
        image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.SCALAR,
        imageUnscale: imageUnscale ?? null,
        imageMinValue: null,
        imageMaxValue: null,
      },
      bounds,
      [position],
    );
    const feature = points.features[0];
    return feature?.properties?.value ?? null;
  }

  private scaleUnscale(
    imageUnscale: [number, number] | null | undefined,
    factor: number,
  ): [number, number] | null | undefined {
    if (!imageUnscale) return imageUnscale ?? null;
    return [imageUnscale[0] * factor, imageUnscale[1] * factor] as [
      number,
      number,
    ];
  }

  private sampleVectorDirection(
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    position: [number, number],
  ): number | null {
    const points = WeatherLayers.getRasterPoints(
      {
        image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.VECTOR,
        imageUnscale: imageUnscale ?? null,
        imageMinValue: null,
        imageMaxValue: null,
      },
      bounds,
      [position],
    );
    const feature = points.features[0];
    return feature?.properties?.direction ?? null;
  }

  sampleVectorAtPosition(
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    position: [number, number],
  ): { value: number | null; direction: number | null } {
    const points = WeatherLayers.getRasterPoints(
      {
        image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.VECTOR,
        imageUnscale: imageUnscale ?? null,
        imageMinValue: null,
        imageMaxValue: null,
      },
      bounds,
      [position],
    );
    const feature = points.features[0];
    const value = feature?.properties?.value ?? null;
    const direction = feature?.properties?.direction ?? null;
    return { value, direction };
  }

  private buildWindLines(
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    stepDegrees = 10,
  ): { source: [number, number]; target: [number, number] }[] {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const positions: [number, number][] = [];
    for (let lat = minLat; lat <= maxLat; lat += stepDegrees) {
      for (let lon = minLon; lon <= maxLon; lon += stepDegrees) {
        positions.push([lon, lat]);
      }
    }
    const points = WeatherLayers.getRasterPoints(
      {
        image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.VECTOR,
        imageUnscale: imageUnscale ?? null,
        imageMinValue: null,
        imageMaxValue: null,
      },
      bounds,
      positions,
    );
    const lines: { source: [number, number]; target: [number, number] }[] = [];
    const scale = 0.125;
    const minLineLength = 0.5;
    const headAngle = (25 * Math.PI) / 180;
    points.features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      const value = feature.properties.value as number | undefined;
      const direction = feature.properties.direction as number | undefined;
      if (!Number.isFinite(value) || !Number.isFinite(direction)) {
        return;
      }
      const dir = direction!;
      const val = value!;
      const radians = ((dir + 180) * Math.PI) / 180;
      const cappedValue = Math.min(val, 25);
      const lineLength = Math.max(cappedValue * scale, minLineLength);
      const dx = Math.sin(radians) * lineLength;
      const dy = Math.cos(radians) * lineLength;
      const tip: [number, number] = [lon + dx, lat + dy];
      lines.push({ source: [lon, lat], target: tip });
      const headLength = Math.max(0.5, Math.min(1.4, val * 0.04));
      const leftAngle = radians + Math.PI - headAngle;
      const rightAngle = radians + Math.PI + headAngle;
      lines.push({
        source: tip,
        target: [
          tip[0] + Math.sin(leftAngle) * headLength,
          tip[1] + Math.cos(leftAngle) * headLength,
        ],
      });
      lines.push({
        source: tip,
        target: [
          tip[0] + Math.sin(rightAngle) * headLength,
          tip[1] + Math.cos(rightAngle) * headLength,
        ],
      });
    });
    return lines;
  }

  private buildWavePeriodLabels(
    image: WeatherLayers.TextureData,
    imageUnscale: [number, number] | null | undefined,
    bounds: [number, number, number, number],
    stepDegrees: number,
  ): { position: [number, number]; text: string }[] {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const labels: { position: [number, number]; text: string }[] = [];
    const baseTolerance =
      stepDegrees <= 2 ? 0.45 : stepDegrees <= 4 ? 0.55 : 0.65;
    const radius = Math.max(0.35, stepDegrees * 0.35);
    const offsets: [number, number][] = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius, radius],
      [-radius, radius],
      [radius, -radius],
      [-radius, -radius],
    ];

    const scan = (tolerance: number) => {
      let latIndex = 0;
      for (let lat = minLat; lat <= maxLat; lat += stepDegrees, latIndex += 1) {
        let lonIndex = 0;
        for (
          let lon = minLon;
          lon <= maxLon;
          lon += stepDegrees, lonIndex += 1
        ) {
          if (stepDegrees <= 6 && (latIndex + lonIndex) % 3 !== 0) {
            continue;
          }
          let best: {
            value: number;
            lon: number;
            lat: number;
            delta: number;
          } | null = null;
          for (const [dx, dy] of offsets) {
            const sampleLon = lon + dx;
            const sampleLat = lat + dy;
            const value = this.sampleScalarValue(image, imageUnscale, bounds, [
              sampleLon,
              sampleLat,
            ]);
            if (!Number.isFinite(value) || (value as number) < 0) {
              continue;
            }
            const rounded = Math.round(value as number);
            if (rounded < 2) {
              continue;
            }
            if (rounded % 2 !== 0) {
              continue;
            }
            const delta = Math.abs((value as number) - rounded);
            if (delta > tolerance) {
              continue;
            }
            if (!best || delta < best.delta) {
              best = {
                value: value as number,
                lon: sampleLon,
                lat: sampleLat,
                delta,
              };
            }
          }

          if (best) {
            labels.push({
              position: [best.lon, best.lat],
              text: `${Math.round(best.value)}`,
            });
          }
        }
      }
    };

    scan(baseTolerance);
    if (labels.length < 4) {
      scan(Math.max(0.9, baseTolerance * 1.6));
    }
    return labels;
  }

  private getActiveWaveContourDownsample(zoom: number): number {
    const timelineController = this.deps.getTimelineController();
    const base = getWaveContourDownsample(zoom);
    if (timelineController.timelineAutoPlay) {
      return Math.min(30, Math.max(base + 4, Math.ceil(base * 2.2)));
    }
    if (Date.now() < this.coarseContoursUntil) {
      return Math.min(24, Math.max(base + 2, Math.ceil(base * 1.8)));
    }
    return base;
  }

  private buildArrowPointsFromVectorLayer(
    vectorLayer: InhouseLayer,
    bounds: [number, number, number, number],
    pointTowardFlow: boolean,
    step: number,
    minSize: number,
    maxSize: number,
    cacheKey: string,
    magnitudeMin?: number,
    magnitudeMax?: number,
    stepX?: number,
    stepY?: number,
  ): ArrowPoint[] {
    void cacheKey;
    if (!vectorLayer.image || vectorLayer.image instanceof Promise) {
      return [];
    }
    const imageUnscale = getInhouseLayerUnscale(vectorLayer);
    const vectorBounds = getInhouseLayerBounds(vectorLayer);
    const [minLon, minLat, maxLon, maxLat] = vectorBounds;
    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    if (lonSpan <= 0 || latSpan <= 0) {
      return [];
    }
    const width = Array.isArray(vectorLayer.manifest.shape)
      ? vectorLayer.manifest.shape[0]
      : vectorLayer.manifest.shape?.width;
    const height = Array.isArray(vectorLayer.manifest.shape)
      ? vectorLayer.manifest.shape[1]
      : vectorLayer.manifest.shape?.height;
    if (!width || !height) {
      return [];
    }
    const domainMask = vectorLayer.domainMask;
    const maskWidth = domainMask ? Math.round(domainMask.length / height) : 0;
    const sx = stepX ?? step;
    const sy = stepY ?? step;

    const positions: [number, number][] = [];
    for (let y = 0; y < height; y += sy) {
      const lat = maxLat - (y / Math.max(1, height - 1)) * latSpan;
      for (let x = 0; x < width; x += sx) {
        // Skip points outside the model domain (alpha=0 in the source image).
        if (domainMask && maskWidth > 0 && domainMask[y * maskWidth + x] === 0)
          continue;
        const lon = minLon + (x / Math.max(1, width - 1)) * lonSpan;
        positions.push([lon, lat]);
      }
    }
    const points = WeatherLayers.getRasterPoints(
      {
        image: vectorLayer.image,
        image2: null,
        imageSmoothing: 0,
        imageInterpolation: WeatherLayers.ImageInterpolation.LINEAR,
        imageWeight: 0,
        imageType: WeatherLayers.ImageType.VECTOR,
        imageUnscale,
        imageMinValue: null,
        imageMaxValue: null,
      },
      vectorBounds,
      positions,
    );
    const arrows: ArrowPoint[] = [];
    for (const feature of points.features) {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      const value = Number(feature.properties?.value);
      const direction = Number(feature.properties?.direction);
      if (!Number.isFinite(value) || !Number.isFinite(direction)) continue;
      const downwindBearing =
        (((direction + (pointTowardFlow ? 180 : 0)) % 360) + 360) % 360;
      const angle = compassBearingToIconAngle(downwindBearing);
      const size =
        typeof magnitudeMin === "number" && typeof magnitudeMax === "number"
          ? mapMagnitudeToArrowSize(
              value,
              magnitudeMin,
              magnitudeMax,
              minSize,
              maxSize,
            )
          : Math.min(maxSize, Math.max(minSize, value));
      arrows.push({ position: [lon, lat], angle, size });
    }
    return arrows;
  }

  private getGridLinesForStep(
    step: number,
  ): { source: [number, number]; target: [number, number] }[] {
    return (
      this.gridLineCache.get(step) ??
      (() => {
        const lines = buildGraticuleLines([-180, -90, 180, 90], step);
        this.gridLineCache.set(step, lines);
        return lines;
      })()
    );
  }

  private scheduleMslpContours(
    key: string,
    image: WeatherLayers.TextureData,
    bounds: [number, number, number, number],
    thresholds: number[],
    downsample: number,
    smoothIterations = 1,
  ): void {
    if (this.mslpContourPending.has(key)) {
      return;
    }
    this.mslpContourPending.set(key, { image, bounds, downsample, thresholds });
    const { data, width, height } = image as {
      data: Float32Array;
      width: number;
      height: number;
    };
    this.mslpContourWorker.postMessage({
      key,
      image: new Float32Array(data),
      width,
      height,
      bounds,
      thresholds,
      downsample,
      smoothIterations,
    });
  }

  renderGridLabels(
    container: HTMLDivElement,
    step: number,
    visible: boolean,
  ): void {
    container.innerHTML = "";
    if (!visible) {
      return;
    }
    const bounds = this.deps.getMapBounds();
    const labels = buildGraticuleLabels(
      [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ],
      step,
    );
    labels.forEach((label) => {
      const point = this.deps.projectMap(label.position as [number, number]);
      const el = document.createElement("div");
      el.className = "grid-label";
      el.textContent = label.text;
      el.style.left = `${point.x}px`;
      el.style.top = `${point.y}px`;
      container.appendChild(el);
    });
  }

  private renderWaveLabels(
    container: HTMLDivElement,
    labels: { position: [number, number]; text: string }[],
    visible: boolean,
  ): void {
    container.innerHTML = "";
    if (!visible) {
      return;
    }
    labels.forEach((label) => {
      const point = this.deps.projectMap(label.position);
      const el = document.createElement("div");
      el.className = "wave-label";
      el.textContent = label.text;
      el.style.left = `${point.x}px`;
      el.style.top = `${point.y}px`;
      container.appendChild(el);
    });
  }

  private rasterizeLandMask(
    collection: FeatureCollection,
    width: number,
    height: number,
    bounds: [number, number, number, number],
  ): Uint8Array {
    const key = `${width}x${height}:${bounds.join(",")}`;
    const cached = this.landMaskCache.get(key);
    if (cached) {
      return cached;
    }
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const empty = new Uint8Array(width * height);
      this.landMaskCache.set(key, empty);
      return empty;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#000";

    const project = (lon: number, lat: number) => {
      const x = Math.round(((lon - minLon) / lonSpan) * (width - 1));
      const y = Math.round(((maxLat - lat) / latSpan) * (height - 1));
      return [x, y] as const;
    };

    const drawRing = (ring: number[][]) => {
      if (!ring.length) return;
      const [startLon, startLat] = ring[0];
      const [startX, startY] = project(startLon, startLat);
      ctx.moveTo(startX, startY);
      for (let i = 1; i < ring.length; i += 1) {
        const [lon, lat] = ring[i];
        const [x, y] = project(lon, lat);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    ctx.beginPath();
    for (const feature of collection.features) {
      const geometry = feature.geometry;
      if (!geometry) continue;
      if (geometry.type === "Polygon") {
        const rings = geometry.coordinates as number[][][];
        rings.forEach((ring) => drawRing(ring));
      } else if (geometry.type === "MultiPolygon") {
        const polygons = geometry.coordinates as number[][][][];
        polygons.forEach((rings) => rings.forEach((ring) => drawRing(ring)));
      }
    }
    ctx.fill("evenodd");

    const data = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      mask[j] = data[i + 3] > 0 ? 1 : 0;
    }
    this.landMaskCache.set(key, mask);
    return mask;
  }

  private scheduleWindStreamlines(
    key: string,
    vectorLayer: InhouseLayer,
    density: number,
    minSpeed: number,
  ): void {
    if (
      !vectorLayer.image ||
      vectorLayer.image instanceof Promise ||
      this.windStreamlineCache.has(key)
    )
      return;
    const decoded = decodeVectorComponents(
      vectorLayer.image,
      getInhouseLayerUnscale(vectorLayer),
    );
    this.windStreamlineWorker.postMessage(
      {
        key,
        width: decoded.width,
        height: decoded.height,
        u: decoded.u,
        v: decoded.v,
        geotransform: buildStreamlineGeotransform(
          getInhouseLayerBounds(vectorLayer),
          decoded.width,
          decoded.height,
        ),
        density,
        flip: this.WIND_STREAMLINE_FLIP,
        minSpeed,
      },
      [decoded.u.buffer, decoded.v.buffer],
    );
  }

  private async loadWindData(datetime: string): Promise<void> {
    if (this.windCache.has(datetime)) {
      this.windData = this.windCache.get(datetime) ?? null;
      return;
    }

    const data = await this.deps.client.loadDatasetData(
      this.windDatasetId,
      datetime,
    );
    this.windCache.set(datetime, data);
    this.windData = data;
  }

  private async loadPrecipData(datetime: string): Promise<void> {
    if (this.precipCache.has(datetime)) {
      this.precipData = this.precipCache.get(datetime) ?? null;
      return;
    }

    const data = await this.deps.client.loadDatasetData(
      this.precipDatasetId,
      datetime,
    );
    this.precipCache.set(datetime, data);
    this.precipData = data;
    if (this.deps.getUiState().layerMode === "precip" && this.lastStableView) {
      window.requestAnimationFrame(() => {
        this.deps.resizeMap();
        this.deps.jumpToMap(this.lastStableView);
      });
    }
  }

  private async resolvePrecipDatasetId(): Promise<{
    id: string;
    dataset: WeatherLayersClient.Dataset;
  } | null> {
    try {
      const dataset = await this.deps.client.loadDataset(this.precipDatasetId);
      return { id: this.precipDatasetId, dataset };
    } catch (error) {
      console.warn(t("error.precipUnavail"), error);
      return null;
    }
  }

  private shouldSuppressForecastHover(
    screenX: number | undefined,
    screenY: number | undefined,
  ): boolean {
    if (window.innerWidth > 480) return false;
    if (typeof screenX !== "number" || typeof screenY !== "number")
      return false;
    const visibleViewport = getVisibleViewportRect(this.deps.dom.mapWrap);
    return (
      screenX >=
        visibleViewport.right -
          LayerComposer.MOBILE_RIGHT_HOVER_GUTTER_WIDTH_PX &&
      screenY >= LayerComposer.MOBILE_RIGHT_HOVER_GUTTER_TOP_PX
    );
  }

  // ── Iconography mode ────────────────────────────────────────────────────────

  // Asterisk icon descriptor (Lucide asterisk, centred anchor so it sits
  // exactly on the station's map coordinate).
  private static readonly ASTERISK_ICON = {
    url: "/data/asterisk.svg",
    width: 24,
    height: 24,
    anchorX: 12,
    anchorY: 12,
  } as const;

  private buildIconographyLayers(): unknown[] {
    const iconographyController = this.deps.getIconographyController();
    const points = iconographyController.iconPoints;
    const iconSize = iconographyController.iconSize;

    if (points.length === 0) return [];

    // ── Composite weather widget (sprite-sheet atlas) ────────────────────────
    // All unique widget canvases are packed into one HTMLCanvasElement that is
    // uploaded to WebGL synchronously — no per-icon async image-load gap, so
    // the time slider advances without any flicker or missing-icon frames.
    const { atlas, mapping, getKey } = this._iconographyRenderer.buildAtlas(
      points,
      iconSize,
    );

    const widgetLayer = new IconLayer({
      id: "iconography-icons",
      data: points,
      getPosition: (d) => d.position,
      iconAtlas: atlas as unknown as string,
      iconMapping: mapping,
      getIcon: (d) => getKey(d),
      getSize: iconSize,
      sizeScale: 1,
      sizeUnits: "pixels",
      billboard: true,
      alphaCutoff: 0.05,
      parameters: { depthTest: false },
      pickable: true,
    });

    // ── City name labels (named-place mode only) ─────────────────────────────
    // The bubble's callout pointer tip sits at the geographic coordinate, so
    // labels just need a small gap below the map point.
    const namedPoints = points.filter((p) => p.name);
    const labelOffset = 5; // px below the pointer tip
    const labelLayer =
      namedPoints.length > 0
        ? new TextLayer({
            id: "iconography-labels",
            data: namedPoints,
            getPosition: (d) => d.position,
            getText: (d) => d.name ?? "",
            getSize: 11,
            getColor: [30, 30, 30, 220],
            getBackgroundColor: [255, 255, 255, 170],
            background: true,
            backgroundPadding: [3, 1, 3, 1],
            fontFamily: "system-ui, sans-serif",
            fontWeight: "500",
            characterSet: "auto",
            getTextAnchor: "middle",
            getAlignmentBaseline: "top",
            getPixelOffset: [0, labelOffset],
            parameters: { depthTest: false },
            pickable: false,
          })
        : null;

    return [widgetLayer, labelLayer].filter(Boolean);
  }
}
