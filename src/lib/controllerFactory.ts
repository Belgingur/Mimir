import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import * as WeatherLayers from "weatherlayers-gl";
import * as WeatherLayersClient from "weatherlayers-gl/client";
import type { AppDom } from "./domRegistry";
import type { PersistedStateV1, LayerMode } from "./viewerTypes";
import { createPersistScheduler } from "./persistence";
import { initWeather } from "./initWeather";
import { DEFAULT_VIEW, getModelResolutionMeters } from "./modelConfig";
import { LAYER_GROUPS } from "./inhouseTypes";
import type { UiState, InhouseGroupId } from "./inhouseTypes";
import { WavegramController } from "../controllers/WavegramController";
import { WindStyleController } from "../controllers/WindStyleController";
import { ModelChooserController } from "../controllers/ModelChooserController";
import {
  InhouseCatalogController,
  createCloudForecastProvider,
} from "../controllers/InhouseCatalogController";
import type { TimelineController } from "../controllers/TimelineController";
import { TooltipController } from "../controllers/TooltipController";
import { LayerGroupController } from "../controllers/LayerGroupController";
import { LayerComposer } from "../controllers/LayerComposer";
import { IconographyController } from "../controllers/IconographyController";
import { attachMapEventHandlers } from "./mapEventHandlers";
import { resolveMapClickTarget } from "./mapClickRouting";
import { setupLegendDrag } from "./legendDrag";
import { initMobileDrawer } from "./mobileDrawer";
import { initCenterReadout } from "./centerReadout";
import { getLocale, onLocaleChange, t } from "./i18n";
import {
  readStoredLocation,
  requestBrowserLocation,
  createLocateControl,
  REYKJAVIK_VIEW,
  LOCATED_ZOOM,
} from "./initialCamera";
import { createDatasetLoadingOverlay } from "./datasetLoadingOverlay";
import { LanguageSwitcherController } from "../controllers/LanguageSwitcherController";
import { isMeteogramEnabled } from "../features/meteogram/enabled";
import type { MeteogramController } from "../features/meteogram/MeteogramController";

export interface ControllerFactoryConfig {
  map: maplibregl.Map;
  dom: AppDom;
  isDev: boolean;
  persistedState: PersistedStateV1 | null;
  localeIsUrlDriven?: boolean;
}

export function createControllers(config: ControllerFactoryConfig) {
  const { map, dom, isDev, persistedState, localeIsUrlDriven } = config;

  // --- Shared mutable state ---
  let mapReady = false;
  // Populated asynchronously (and only when the feature is enabled) by the
  // guarded dynamic import below; stays null in the default public build.
  let meteogramController: MeteogramController | null = null;
  let timelineController: TimelineController | undefined;
  let timelineCurrentDatetime = "";
  let timelineLastFrameLoadHadErrors = false;
  let restoringFromPersisted = !!persistedState?.mapCamera;
  // First visit (no persisted camera) AND a cached user location: the located
  // view owns the camera, so the model's domain auto-centre is suppressed until
  // the user explicitly switches models. Armed here (before any async catalog
  // centering can race) and cleared in handleModelChange. With no cached
  // location we let the model domain centre normally (Iceland overview fallback).
  // Returning users (persisted camera) are unaffected. See applyInitialCamera (A1).
  const storedUserLocation = readStoredLocation();
  let suppressInitialAutoCenter =
    !persistedState?.mapCamera && !!storedUserLocation;
  // Forward reference to the programmatic model switcher (defined once all
  // controllers exist); used by the empty-model safety net and locate button.
  let switchModelFn: (model: string) => void = () => {};
  let pendingTimeIndex: number | null =
    persistedState?.mapCamera && Number.isFinite(persistedState.timeIndex)
      ? persistedState.timeIndex
      : null;

  const inhouseRoot = import.meta.env.VITE_INHOUSE_ROOT ?? "";

  const defaultLayerMode =
    LAYER_GROUPS.find((group) => group.default)?.id ?? "temperature";
  const uiState: UiState = {
    visible: persistedState?.visible ?? true,
    opacity: persistedState?.opacity ?? 1,
    layerMode: persistedState?.layerMode ?? defaultLayerMode,
    showGrid: false,
    // The style switcher is hidden and compact is the only offered style, so
    // always start compact — ignoring any stale 'classic' in localStorage.
    iconographyStyle: "compact",
  };

  // --- Shared callbacks ---
  function scheduleUpdateLayers() {
    // Keep the mobile meteogram trigger's availability in sync — this fires on
    // every model/layer-mode/analysis change (and map moves), which is exactly
    // when the click target may flip between meteogram / wavegram / none.
    meteogramController?.refreshMobileTrigger();
    // ...and reconcile an already-open meteogram with the new state: close it
    // when the selection no longer targets a meteogram (icons view, waves,
    // GWES), or reload it when the bottom model selector picked another model.
    meteogramController?.syncOpenState();
    if (!layerComposer) return;
    layerComposer.scheduleUpdateLayers();
  }

  function updateLayers() {
    if (!layerComposer) return;
    layerComposer.updateLayers();
  }

  const schedulePersistState = createPersistScheduler(() => {
    const center = map.getCenter();
    return {
      version: 1,
      modelId: catalogController.inhouseSelectedModel,
      layerMode: uiState.layerMode,
      analysisId: catalogController.inhouseSelectedAnalysis,
      timeIndex: catalogController.inhouseTimeIndex,
      opacity: uiState.opacity,
      visible: uiState.visible,
      iconographyStyle: uiState.iconographyStyle,
      locale: getLocale(),
      mapCamera: {
        center: [center.lng, center.lat] as [number, number],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      },
    };
  });

  // --- Platform detection ---
  const supportsWebGL2 = Boolean(
    document.createElement("canvas").getContext("webgl2"),
  );
  const isFirefox = /firefox/i.test(window.navigator.userAgent);
  const supportsWindParticlesPlatform = supportsWebGL2 && !isFirefox;

  // --- WeatherLayers client ---
  const accessToken = import.meta.env.VITE_WEATHERLAYERS_TOKEN ?? "";
  const client = new WeatherLayersClient.Client({
    accessToken,
    datetimeInterpolate: true,
  });
  const imageUnscaleDefault: [number, number] = [-128, 127];

  // --- Overlay ---
  const overlay = new MapboxOverlay({
    interleaved: true,
    layers: [],
    onError: (error: unknown, layer?: { id?: string } | null) => {
      if (layer?.id?.startsWith("wind-particles-")) {
        windStyleController.handleParticleFailure(error);
        return;
      }
      throw error;
    },
  });

  // --- Controllers ---
  const wavegramController = new WavegramController({
    dom: {
      modal: dom.wavegramModal,
      close: dom.wavegramClose,
      subtitle: dom.wavegramSubtitle,
      status: dom.wavegramStatus,
      durationSelect: dom.wavegramDurationSelect,
      techToggle: dom.wavegramTechToggle,
      image: dom.wavegramImage,
      download: dom.wavegramDownload,
      print: dom.wavegramPrint,
    },
    getBaseUrl: () =>
      (
        import.meta.env.VITE_BELGINGUR_BASE_URL ?? "https://wod.belgingur.is"
      ).trim(),
    isDev,
    scheduleUpdateLayers,
  });

  const windStyleController = new WindStyleController({
    dom: {
      warningEl: dom.windStyleWarningEl,
      particlesAdvanced: dom.windParticlesAdvanced,
      particlesCountInput: dom.windParticlesCountInput,
      particlesCountValue: dom.windParticlesCountValue,
      particlesAgeInput: dom.windParticlesAgeInput,
      particlesAgeValue: dom.windParticlesAgeValue,
      particlesSpeedInput: dom.windParticlesSpeedInput,
      particlesSpeedValue: dom.windParticlesSpeedValue,
    },
    supportsWindParticlesPlatform,
    isFirefox,
    isDev,
    getLayerMode: () => uiState.layerMode,
    scheduleUpdateLayers,
    onSlotClick: () => {
      void layerGroupController?.updateMode("wind");
    },
  });
  windStyleController.syncControls();

  const modelChooserController: ModelChooserController =
    new ModelChooserController({
      dom: {
        barEl: dom.modelBarEl,
        panelEl: dom.modelPanelEl,
        pillBtn: dom.modelPillBtn,
        popoverEl: dom.modelPopoverEl,
        pillNameEl: dom.modelPillNameEl,
        pillMetaEl: dom.modelPillMetaEl,
      },
      getViewMode: () => layerGroupController?.viewMode ?? "forecast",
      getModels: () => catalogController.inhouseModels,
      getSelectedModel: () => catalogController.inhouseSelectedModel,
      getModelResolutionMeters,
      onModelSelect: (model: string) => {
        dom.inhouseModelSelect.value = model;
        dom.inhouseModelSelect.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
      },
      isDev,
    });
  modelChooserController.initPill();

  const tooltipController = new TooltipController({
    dom: { tooltipHost: dom.tooltipHost },
    getWindUnitFormat: () => layerComposer.windUnitFormat,
    formatDirection: (direction, directionType, directionFormat) =>
      WeatherLayers.formatDirection(
        direction,
        directionType as WeatherLayers.DirectionType,
        directionFormat as WeatherLayers.DirectionFormat,
      ),
    formatValueWithUnit: (value, format) =>
      WeatherLayers.formatValueWithUnit(
        value,
        format as WeatherLayers.UnitFormat,
      ),
    directionTypeInward: WeatherLayers.DirectionType.INWARD,
    directionFormatCardinal3: WeatherLayers.DirectionFormat.CARDINAL3,
    unitSystemMetric: WeatherLayers.UnitSystem.METRIC,
    createTooltipControl: (config) =>
      new WeatherLayers.TooltipControl(
        config as WeatherLayers.TooltipControlConfig,
      ),
    placementTop: WeatherLayers.Placement.TOP,
    directionFormatValue: WeatherLayers.DirectionFormat.VALUE,
  });

  const layerComposer: LayerComposer = new LayerComposer({
    dom: {
      inhouseTooltip: dom.inhouseTooltip,
      gridLabelsContainer: dom.gridLabelsContainer,
      tooltipHost: dom.tooltipHost,
      mapWrap: dom.mapWrap,
      legendHost: dom.legendHost,
      waveLegendHost: dom.waveLegendHost,
      windLegendHost: dom.windLegendHost,
      precipLegendHost: dom.precipLegendHost,
      cloudLegendHost: dom.cloudLegendHost,
      snowDepthLegendHost: dom.snowDepthLegendHost,
    },
    getMapZoom: () => map.getZoom(),
    getMapBounds: () => map.getBounds(),
    getMapCenter: () => map.getCenter(),
    getMapBearing: () => map.getBearing(),
    getMapPitch: () => map.getPitch(),
    projectMap: (coord) => map.project(coord),
    unprojectMap: (point) => map.unproject(point),
    getMapCanvas: () => map.getCanvas(),
    getMapContainer: () => map.getContainer(),
    resizeMap: () => map.resize(),
    jumpToMap: (view) => map.jumpTo(view),
    easeToMap: (options) => map.easeTo(options),
    setOverlayProps: (props) => overlay.setProps(props),
    getUiState: () => uiState,
    isMapReady: () => mapReady,
    getCatalogController: () => catalogController,
    getTimelineController: () => timelineController as TimelineController,
    getTooltipController: () => tooltipController,
    getWindStyleController: () => windStyleController,
    getIconographyController: () => iconographyController,
    getLayerGroupController: () => layerGroupController,
    getWavegramController: () => wavegramController,
    getIconographyStyle: () => uiState.iconographyStyle,
    schedulePersistState,
    client,
    createContourWorker: () =>
      new Worker(new URL("../workers/waveContoursWorker.ts", import.meta.url), {
        type: "module",
      }),
    createMslpContourWorker: () =>
      new Worker(new URL("../workers/mslpContoursWorker.ts", import.meta.url), {
        type: "module",
      }),
    createWindStreamlineWorker: () =>
      new Worker(
        new URL("../workers/windStreamlinesWorker.ts", import.meta.url),
        { type: "module" },
      ),
    isDev,
    supportsWindParticlesPlatform,
    isFirefox,
    inhouseRoot,
  });

  const catalogController = new InhouseCatalogController({
    dom: {
      inhouseModelSelect: dom.inhouseModelSelect,
      inhouseAnalysisSelect: dom.inhouseAnalysisSelect,
      inhouseVariableSelect: dom.inhouseVariableSelect,
      inhousePresetSelect: dom.inhousePresetSelect,
      inhouseAddLayerBtn: dom.inhouseAddLayerBtn,
      inhouseLayersEl: dom.inhouseLayersEl,
      inhouseWarningEl: dom.inhouseWarningEl,
      inhouseTooltip: dom.inhouseTooltip,
    },
    isDev,
    inhouseRoot,
    persistedModelId: persistedState?.modelId ?? null,
    getMapContainer: () => map.getContainer(),
    setMapMaxZoom: (z) => map.setMaxZoom(z),
    getMapZoom: () => map.getZoom(),
    setMapZoom: (z) => map.setZoom(z),
    easeToMap: (o) => map.easeTo(o),
    fitMapBounds: (b, o) => map.fitBounds(b, o),
    getCurrentDatetime: () =>
      timelineController?.currentDatetime ?? timelineCurrentDatetime,
    setCurrentDatetime: (dt) => {
      timelineCurrentDatetime = dt;
      if (timelineController) {
        timelineController.currentDatetime = dt;
      }
    },
    isRestoringFromPersisted: () => restoringFromPersisted,
    setRestoringFromPersisted: (v) => {
      restoringFromPersisted = v;
    },
    isInitialAutoCenterSuppressed: () => suppressInitialAutoCenter,
    clearInitialAutoCenterSuppression: () => {
      suppressInitialAutoCenter = false;
    },
    // Coverage-aware selection uses the cached location, else the Reykjavík
    // fallback (finest healthy model for Iceland — fixes landing on an empty
    // default model). See selectModel / task A1/A3.
    getAutoSelectLocation: () =>
      readStoredLocation() ?? {
        lat: REYKJAVIK_VIEW.center[1],
        lon: REYKJAVIK_VIEW.center[0],
      },
    switchToModel: (model: string) => switchModelFn(model),
    getPendingTimeIndex: () => pendingTimeIndex,
    setPendingTimeIndex: (v) => {
      pendingTimeIndex = v;
    },
    isMapReady: () => mapReady,
    getLastFrameLoadHadErrors: () => timelineLastFrameLoadHadErrors,
    setLastFrameLoadHadErrors: (v) => {
      timelineLastFrameLoadHadErrors = v;
      if (timelineController) {
        timelineController.lastFrameLoadHadErrors = v;
      }
    },
    getUiState: () => uiState,
    scheduleUpdateLayers,
    schedulePersistState,
    onSelectorsRefreshed: (_models, selectedModel, variables) => {
      modelChooserController.render();
      modelChooserController.syncPill();
      windStyleController.updateAvailability(variables);
      layerGroupController.renderLayerGroupList();
    },
    sampleVectorAtPosition: (image, imageUnscale, bounds, position) =>
      layerComposer.sampleVectorAtPosition(
        image,
        imageUnscale,
        bounds,
        position,
      ),
    createCloudProvider: (datasetId) =>
      createCloudForecastProvider(datasetId, {
        loadDatasetSlice: (id, range) =>
          client.loadDatasetSlice(
            id,
            range as ReturnType<typeof WeatherLayers.offsetDatetimeRange>,
          ),
        loadDatasetData: (id, dt) => client.loadDatasetData(id, dt),
        offsetDatetimeRange: (iso, back, fwd) =>
          WeatherLayers.offsetDatetimeRange(iso, back, fwd),
        imageTypeScalar: WeatherLayers.ImageType.SCALAR,
        imageUnscaleDefault,
      }),
    onContourWorkerResult: () => {},
  });

  void catalogController.start();

  const iconographyController = new IconographyController({
    inhouseRoot,
    isDev,
    loadInhouseTexture: (url, signal) =>
      catalogController.loadInhouseTexture(url, signal),
    loadInhouseManifest: (model, analysis, variable) =>
      catalogController.loadInhouseManifest(model, analysis, variable),
    getVariableBaseUrl: (model, analysis, variable) =>
      catalogController.getVariableBaseUrl(model, analysis, variable),
    getSelectedModel: () => catalogController.inhouseSelectedModel,
    getSelectedAnalysis: () => catalogController.inhouseSelectedAnalysis,
    getTimeIndex: () => catalogController.inhouseTimeIndex,
    getCurrentDatetime: () =>
      catalogController.inhouseLayers[0]?.times[
        catalogController.inhouseTimeIndex
      ] ?? "",
    getMapBounds: () => map.getBounds(),
    getMapZoom: () => map.getZoom(),
    scheduleUpdateLayers,
  });

  const layerGroupController = new LayerGroupController({
    dom: {
      viewForecastBtn: dom.viewForecastBtn,
      viewIconographyBtn: dom.viewIconographyBtn,
      layerGroupList: dom.layerGroupList,
      gridToggleButton: dom.gridToggleButton,
      gridToggle: dom.gridToggle,
      layerToggle: dom.layerToggle,
      legendHost: dom.legendHost,
      waveLegendHost: dom.waveLegendHost,
      windLegendHost: dom.windLegendHost,
      precipLegendHost: dom.precipLegendHost,
      cloudLegendHost: dom.cloudLegendHost,
      snowDepthLegendHost: dom.snowDepthLegendHost,
      legendStackCardEl: dom.legendStackCardEl,
      iconStyleClassicBtn: dom.iconStyleClassicBtn,
      iconStyleCompactBtn: dom.iconStyleCompactBtn,
    },
    isDev,
    defaultLayerMode,
    getUiState: () => uiState,
    getWindUnitFormat: () => layerComposer.windUnitFormat,
    getMapView: () => ({
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    }),
    easeToMap: (options) => map.easeTo(options),
    resizeMap: () => map.resize(),
    jumpToMap: (view) => map.jumpTo(view),
    scheduleUpdateLayers,
    schedulePersistState,
    setGridLabelsDirty: () => layerComposer.setGridLabelsDirty(true),
    scheduleLabelRender: () => layerComposer.scheduleLabelRender(),
    updateLayers: () => layerComposer.updateLayers(),
    updateGridOnly: () => layerComposer.updateGridOnly(),
    isDebugRoute: () => false,
    activateIconography: () => iconographyController?.activate(),
    deactivateIconography: () => iconographyController?.deactivate(),
    mountForecast: () => {
      document.body.classList.remove("view-iconography");
    },
    syncInhouseTimeToTimeline: () =>
      catalogController.syncInhouseTimeToTimeline(),
    getInhouseSelectedModel: () => catalogController.inhouseSelectedModel,
    getInhouseSelectedAnalysis: () => catalogController.inhouseSelectedAnalysis,
    getInhouseModels: () => catalogController.inhouseModels,
    isGroupAvailableForModel: (groupId) =>
      catalogController.isGroupAvailableForModel(groupId as InhouseGroupId),
    loadInhouseAnalyses: (model) =>
      catalogController.loadInhouseAnalyses(model),
    ensureInhouseGroupLayers: (groupId) => {
      void catalogController.ensureInhouseGroupLayers(
        groupId as InhouseGroupId,
      );
    },
    saveNonWavesSelection: (model, analysis) =>
      modelChooserController.saveNonWavesSelection(model, analysis),
    restoreNonWavesSelection: () =>
      modelChooserController.restoreNonWavesSelection(),
    syncWindControls: () => windStyleController.syncControls(),
    detachWindSlot: () => windStyleController.detachSlot(),
    getWindFormatLabel: () => windStyleController.formatLabel(),
    getWindBadge: () => windStyleController.getBadge(),
    attachWindToSlot: (label, flyout) =>
      windStyleController.attachToSlot(label, flyout),
    updateTimelineControlForMode: (mode) =>
      timelineController?.updateTimelineControlForMode(mode),
    setTooltipConfig: (config) => {
      if (tooltipController.tooltipControl) {
        tooltipController.tooltipControl.setConfig(
          config as WeatherLayers.TooltipControlConfig,
        );
      }
    },
    hasTooltipControl: () => !!tooltipController.tooltipControl,
    syncLegendForMode: (mode) => layerComposer.syncLegendForMode(mode),
    getIconographyStyle: () => uiState.iconographyStyle,
    setIconographyStyle: (style) => {
      uiState.iconographyStyle = style;
      layerGroupController.syncIconographyStyleButtons();
      scheduleUpdateLayers();
      schedulePersistState();
    },
    WL_UnitSystem_METRIC: WeatherLayers.UnitSystem.METRIC,
    WL_Placement_TOP: WeatherLayers.Placement.TOP,
    WL_DirectionType_INWARD: WeatherLayers.DirectionType.INWARD,
    WL_DirectionFormat_CARDINAL3: WeatherLayers.DirectionFormat.CARDINAL3,
    WL_DirectionFormat_VALUE: WeatherLayers.DirectionFormat.VALUE,
  });

  // --- DOM event handlers ---
  // Loading/error overlay shown while switching model or analysis (task B2).
  const datasetLoader = createDatasetLoadingOverlay(dom.mapWrap);
  const setSelectorsBusy = (busy: boolean) => {
    dom.inhouseModelSelect.setAttribute("aria-busy", String(busy));
    dom.inhouseAnalysisSelect.setAttribute("aria-busy", String(busy));
  };

  // Programmatic model switch, running the exact same flow as the model
  // `<select>`. Reused by the empty-model safety net and the locate button.
  // Shows the loader immediately, then an explicit error (with a way back) if
  // the target model has no compatible layers — never a silent frozen state.
  const changeModel = async (nextModel: string): Promise<void> => {
    const prevModel = catalogController.inhouseSelectedModel;
    if (dom.inhouseModelSelect.value !== nextModel) {
      dom.inhouseModelSelect.value = nextModel;
    }
    datasetLoader.begin(t("status.loadingDataset", { model: nextModel }));
    setSelectorsBusy(true);
    try {
      await catalogController.handleModelChange(nextModel, {
      setLayerMode: (mode: LayerMode) => {
        uiState.layerMode = mode;
      },
      getLayerMode: () => uiState.layerMode,
      renderLayerGroupList: () => layerGroupController.renderLayerGroupList(),
      easeToDefaultView: () =>
        map.easeTo({
          center: DEFAULT_VIEW.center,
          zoom: DEFAULT_VIEW.zoom,
          duration: 800,
        }),
      updateTimelineControlForMode: (mode: LayerMode) =>
        timelineController?.updateTimelineControlForMode(mode),
      syncWindControls: () => windStyleController.syncControls(),
      syncTooltipAndLegendForMode: (mode: LayerMode) =>
        layerGroupController.syncTooltipAndLegendForMode(mode),
      scheduleUpdateLayers: () => {
        iconographyController?.onModelChange();
        scheduleUpdateLayers();
      },
      schedulePersistState,
      });
    } finally {
      setSelectorsBusy(false);
    }
    // Outcome: an empty layer list means the model has no compatible data —
    // show an explicit error with a way back instead of a silent frozen map.
    if (catalogController.inhouseLayers.length === 0) {
      const canGoBack = !!prevModel && prevModel !== nextModel;
      datasetLoader.fail({
        message: t("status.datasetFailed", { model: nextModel }),
        backLabel: canGoBack
          ? t("action.backToModel", { model: prevModel })
          : undefined,
        onBack: canGoBack ? () => void changeModel(prevModel) : undefined,
      });
    } else {
      datasetLoader.end();
    }
  };
  // Bind the forward reference so the catalog controller's safety net can switch.
  switchModelFn = (model: string) => void changeModel(model);
  dom.inhouseModelSelect.addEventListener("change", () => {
    void changeModel(dom.inhouseModelSelect.value);
  });

  // "Use my location" control (task A1): the ONLY entry point to the browser
  // Geolocation prompt. On success it re-selects the covering model (if any)
  // and centres on the user's point; failures are surfaced as a transient warning.
  map.addControl(
    createLocateControl({
      label: t("map.myLocation"),
      onClick: () => {
        requestBrowserLocation({
          onLocated: (loc) => {
            const next = catalogController.selectModelForLocation(
              loc.lat,
              loc.lon,
            );
            const switched =
              next && next !== catalogController.inhouseSelectedModel
                ? changeModel(next)
                : Promise.resolve();
            void switched.then(() => {
              map.easeTo({
                center: [loc.lon, loc.lat],
                zoom: LOCATED_ZOOM,
                duration: 800,
              });
            });
          },
          onError: () => {
            catalogController.setInhouseWarning(t("map.locationUnavailable"));
          },
        });
      },
    }),
    "top-right",
  );

  dom.inhouseAnalysisSelect.addEventListener("change", async () => {
    const mode = uiState.layerMode === "waves" ? "waves" : uiState.layerMode;
    datasetLoader.begin(
      t("status.loadingDataset", {
        model: catalogController.inhouseSelectedModel,
      }),
    );
    setSelectorsBusy(true);
    try {
      await catalogController.handleAnalysisChange(
        dom.inhouseAnalysisSelect.value,
      );
      await catalogController.ensureInhouseGroupLayers(mode);
    } finally {
      setSelectorsBusy(false);
      datasetLoader.end();
    }
    timelineController?.updateTimelineControlForMode(mode);
    schedulePersistState();
  });

  dom.viewForecastBtn.addEventListener("click", () =>
    layerGroupController?.setViewMode("forecast"),
  );
  dom.viewIconographyBtn?.addEventListener("click", () =>
    layerGroupController?.setViewMode("iconography"),
  );

  dom.iconStyleClassicBtn?.addEventListener("click", () =>
    layerGroupController?.selectIconographyStyle("classic"),
  );
  dom.iconStyleCompactBtn?.addEventListener("click", () =>
    layerGroupController?.selectIconographyStyle("compact"),
  );

  document.addEventListener("pointerdown", (event) => {
    modelChooserController.handleOutsideClick(event.target as Node);
  });

  document.addEventListener("keydown", (event) => {
    modelChooserController.handleEscapeKey(event);
    timelineController?.handleTimelineKeydown(event);
  });

  const renderRoute = () => {
    if (layerGroupController) layerGroupController.handleRouteChange();
  };
  window.addEventListener("hashchange", renderRoute);

  document.addEventListener("pointerdown", (event) => {
    windStyleController.handleOutsideClick(event.target as Node);
  });

  // --- initWeather wrapper ---
  async function doInitWeather() {
    try {
      const result = await initWeather({
        dom: {
          mapWrap: dom.mapWrap,
          timelineHost: dom.timelineHost,
          gridLabelsContainer: dom.gridLabelsContainer,
        },
        isDev,
        getUiState: () => uiState,
        getMapZoom: () => map.getZoom(),
        schedulePersistState,
        scheduleUpdateLayers,
        updateLayers,
        getCatalogController: () => catalogController,
        getLayerComposer: () => layerComposer,
        getLayerGroupController: () => layerGroupController,
        getTooltipController: () => tooltipController,
        getIconographyController: () => iconographyController,
        getWavegramController: () => wavegramController,
        setTimelineCurrentDatetime: (dt) => {
          timelineCurrentDatetime = dt;
        },
      });
      timelineController = result.timelineController;
      // Wire the on-map forecast-time bubble to the freshly-created controller.
      // doInitWeather builds a NEW TimelineController on every (re)load, so this
      // must happen here — not at factory-construction time, when the controller
      // doesn't exist yet — or the controller never gets the bubble reference and
      // it stays hidden forever.
      if (dom.mapTimeBubbleEl) {
        timelineController.setMapTimeBubble(
          dom.mapTimeBubbleEl,
          dom.mapTimeBubbleTextEl,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }

  // --- Post-construction setup ---
  layerGroupController.renderLayerGroupList();
  renderRoute();

  dom.gridToggle.checked = uiState.showGrid;
  layerGroupController.syncGridToggleButton();
  if (!persistedState?.layerMode) {
    uiState.layerMode = layerGroupController.getSelectedLayerMode();
  }
  dom.layerToggle.checked = uiState.visible;
  dom.opacityInput.value = uiState.opacity.toFixed(2);
  dom.opacityValue.textContent = uiState.opacity.toFixed(2);
  layerGroupController.attachToggleHandlers();

  dom.zoomIn.addEventListener("click", () => {
    map.zoomIn({ duration: 200 });
  });
  dom.zoomOut.addEventListener("click", () => {
    map.zoomOut({ duration: 200 });
  });
  dom.infoButton.addEventListener("click", () => {
    dom.infoPanel.classList.toggle("is-open");
    dom.infoPanel.setAttribute(
      "aria-hidden",
      dom.infoPanel.classList.contains("is-open") ? "false" : "true",
    );
  });
  dom.opacityInput.addEventListener("input", () => {
    const v = parseFloat(dom.opacityInput.value);
    uiState.opacity = Number.isFinite(v) ? v : 1;
    dom.opacityValue.textContent = uiState.opacity.toFixed(2);
    scheduleUpdateLayers();
    schedulePersistState();
  });

  // --- Optional meteogram feature (opt-in via WOD credentials) ---
  // The guard uses the raw `import.meta.env.*` expressions (not the
  // isMeteogramEnabled() helper) on purpose: Vite inlines them to string
  // literals at build time, so when the credentials are absent this whole
  // branch folds to `if (false)` and the dynamically-imported meteogram chunk
  // (code + CSS + modal DOM) is dead-code-eliminated from the build entirely.
  // isMeteogramEnabled() below is the runtime equivalent, used for wiring.
  if (import.meta.env.VITE_WOD_API_USER && import.meta.env.VITE_WOD_API_PASSWORD) {
    void import("../features/meteogram/setup")
      .then(({ setupMeteogram }) => {
        // Selected-point pin for the docked-panel layout. A maplibre Marker
        // tracks the map on pan/zoom on its own; we just add/remove it.
        let meteogramPin: maplibregl.Marker | null = null;
        const removePin = (): void => {
          meteogramPin?.remove();
          meteogramPin = null;
        };
        const showPin = (lng: number, lat: number, label: string): void => {
          removePin();
          const el = document.createElement("div");
          el.className = "meteogram-pin";
          const labelEl = document.createElement("div");
          labelEl.className = "meteogram-pin__label";
          labelEl.textContent = label;
          const stalk = document.createElement("div");
          stalk.className = "meteogram-pin__stalk";
          const dot = document.createElement("div");
          dot.className = "meteogram-pin__dot";
          el.append(labelEl, stalk, dot);
          meteogramPin = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([lng, lat])
            .addTo(map);
        };
        meteogramController = setupMeteogram({
          mapWrap: dom.mapWrap,
          getSelectedModel: () => catalogController.inhouseSelectedModel,
          getLayerMode: () => uiState.layerMode,
          getLocale,
          getMapCenter: () => {
            const c = map.getCenter();
            return { lng: c.lng, lat: c.lat };
          },
          isMeteogramTarget: () =>
            resolveMapClickTarget({
              selectedModel: catalogController.inhouseSelectedModel,
              layerMode: uiState.layerMode,
              viewMode: layerGroupController.viewMode,
              meteogramEnabled: true,
            }) === "meteogram",
          getModelBounds: () =>
            catalogController.inhouseLayers[0]?.manifest.bounds ?? null,
          getAnalysisInfo: () => {
            const manifest = catalogController.inhouseLayers[0]?.manifest;
            return manifest
              ? {
                  analysisTimeISO: manifest.analysisTimeISO,
                  generatedAt: manifest.generatedAt,
                }
              : null;
          },
          showPin,
          removePin,
          isDev,
        });
        // State may have loaded while the chunk was fetching — sync once now.
        meteogramController.refreshMobileTrigger();
        // Restore the persisted point only once the map has restored its own
        // camera (the "load" handler above jumps to persisted.mapCamera). If we
        // dropped the pin first, the subsequent camera jump would make it appear
        // to slide across the map on reload. When the map is already loaded (the
        // chunk resolved late), restore immediately.
        const restorePoint = (): void => {
          void meteogramController?.restorePersistedPoint();
        };
        if (map.loaded()) restorePoint();
        else map.once("load", restorePoint);
      })
      .catch((error) => {
        console.error("Failed to initialise meteogram feature", error);
      });
  }

  attachMapEventHandlers(map, {
    getOverlay: () => overlay,
    getLayerComposer: () => layerComposer,
    getCatalogController: () => catalogController,
    getLayerGroupController: () => layerGroupController,
    getTooltipController: () => tooltipController,
    getIconographyController: () => iconographyController,
    getWavegramController: () => wavegramController,
    getMeteogramController: () => meteogramController,
    meteogramEnabled: isMeteogramEnabled(),
    getUiState: () => uiState,
    getPersistedState: () => persistedState,
    suppressNextAutoCenter: () => {
      suppressInitialAutoCenter = true;
    },
    setMapReady: (ready) => {
      mapReady = ready;
    },
    initWeather: doInitWeather,
    scheduleUpdateLayers,
    schedulePersistState,
  });

  if (dom.legendStackCardEl) {
    setupLegendDrag(dom.legendStackCardEl, dom.mapWrap);
  }
  if (dom.mapTimeBubbleEl) {
    // Drag wiring lives on the element, so it only needs doing once. The
    // controller wiring (setMapTimeBubble) happens in doInitWeather instead,
    // because the TimelineController doesn't exist yet at this point.
    setupLegendDrag(dom.mapTimeBubbleEl, dom.mapWrap);
  }
  initMobileDrawer();

  initCenterReadout({
    map,
    getCatalogController: () => catalogController,
    getViewMode: () => layerGroupController.viewMode,
    getUiState: () => uiState,
    formatCardinalDirection: (direction) =>
      tooltipController.formatCardinalDirection(direction),
  });

  // ── Language switcher ────────────────────────────────────────────────────
  if (localeIsUrlDriven && dom.localeSwitcherBtn) {
    dom.localeSwitcherBtn.hidden = true;
    dom.localeSwitcherBtn.style.display = "none";
  }
  const languageSwitcher = new LanguageSwitcherController({
    btn: localeIsUrlDriven ? null : dom.localeSwitcherBtn,
    schedulePersistState,
  });

  // Re-render all JS-driven UI when the locale changes at runtime.
  onLocaleChange(() => {
    languageSwitcher.sync();
    layerGroupController.renderLayerGroupList();
    windStyleController.syncControls();
    // Refresh every pre-cached legend (not just the visible one) so that
    // hidden legends pick up the new locale before the user switches to them.
    layerComposer.refreshLegends(uiState.layerMode);
    timelineController?.renderCustomTimeline();
    // Re-render the meteogram widget's strings in the new locale (data-i18n
    // chrome is already retranslated by setLocale). The widget repaints in
    // place — no refetch, no view reset.
    meteogramController?.applyLocale();
  });
}
