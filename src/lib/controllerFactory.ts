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
import { setupLegendDrag } from "./legendDrag";
import { initMobileDrawer } from "./mobileDrawer";
import { getLocale, onLocaleChange } from "./i18n";
import { LanguageSwitcherController } from "../controllers/LanguageSwitcherController";

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
  let timelineController: TimelineController | undefined;
  let timelineCurrentDatetime = "";
  let timelineLastFrameLoadHadErrors = false;
  let restoringFromPersisted = !!persistedState?.mapCamera;
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
  dom.inhouseModelSelect.addEventListener("change", () => {
    void catalogController.handleModelChange(dom.inhouseModelSelect.value, {
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
  });

  dom.inhouseAnalysisSelect.addEventListener("change", async () => {
    await catalogController.handleAnalysisChange(
      dom.inhouseAnalysisSelect.value,
    );
    void catalogController.ensureInhouseGroupLayers(
      uiState.layerMode === "waves" ? "waves" : uiState.layerMode,
    );
    timelineController?.updateTimelineControlForMode(
      uiState.layerMode === "waves" ? "waves" : uiState.layerMode,
    );
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

  attachMapEventHandlers(map, {
    getOverlay: () => overlay,
    getLayerComposer: () => layerComposer,
    getCatalogController: () => catalogController,
    getLayerGroupController: () => layerGroupController,
    getTooltipController: () => tooltipController,
    getIconographyController: () => iconographyController,
    getWavegramController: () => wavegramController,
    getUiState: () => uiState,
    getPersistedState: () => persistedState,
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
  initMobileDrawer();

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
  });
}
