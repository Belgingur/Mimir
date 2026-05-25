import * as WeatherLayers from "weatherlayers-gl";
import type { AppDom } from "./domRegistry";
import type { UiState } from "./inhouseTypes";
import { getGridStepForZoom } from "./zoomSteps";
import { TimelineController } from "../controllers/TimelineController";
import type { InhouseCatalogController } from "../controllers/InhouseCatalogController";
import type { LayerComposer } from "../controllers/LayerComposer";
import type { LayerGroupController } from "../controllers/LayerGroupController";
import type { TooltipController } from "../controllers/TooltipController";
import type { IconographyController } from "../controllers/IconographyController";
import type { WavegramController } from "../controllers/WavegramController";

export interface InitWeatherDeps {
  dom: Pick<AppDom, "mapWrap" | "timelineHost" | "gridLabelsContainer">;
  isDev: boolean;
  getUiState: () => UiState;
  getMapZoom: () => number;
  schedulePersistState: () => void;
  scheduleUpdateLayers: () => void;
  updateLayers: () => void;
  getCatalogController: () => InhouseCatalogController;
  getLayerComposer: () => LayerComposer;
  getLayerGroupController: () => LayerGroupController;
  getTooltipController: () => TooltipController;
  getIconographyController: () => IconographyController | undefined;
  getWavegramController: () => WavegramController;
  setTimelineCurrentDatetime: (dt: string) => void;
}

export interface InitWeatherResult {
  timelineController: TimelineController;
}

export async function initWeather(
  deps: InitWeatherDeps,
): Promise<InitWeatherResult> {
  const { dom, isDev } = deps;
  const uiState = deps.getUiState();
  const catalogController = deps.getCatalogController();
  const layerComposer = deps.getLayerComposer();

  const timelineController = new TimelineController({
    dom: { mapWrap: dom.mapWrap },
    isDev,
    schedulePersistState: deps.schedulePersistState,
    scheduleUpdateLayers: deps.scheduleUpdateLayers,
    setStatus: (_message: string) => {},
    updateLayers: deps.updateLayers,
    getInhouseLayers: () => deps.getCatalogController().inhouseLayers,
    syncInhouseTimeToTimeline: () =>
      deps.getCatalogController().syncInhouseTimeToTimeline(),
    loadInhouseFrameSet: async () => {
      await deps.getCatalogController().loadInhouseFrameSet();
      const iconCtrl = deps.getIconographyController();
      if (iconCtrl?.isActive) {
        iconCtrl.onTimeChange();
      }
    },
    isWavegramOpen: () => deps.getWavegramController().isOpen,
    renderGridLabels: (step, visible) =>
      deps
        .getLayerComposer()
        .renderGridLabels(dom.gridLabelsContainer, step, visible),
    getGridStepForZoom: () => getGridStepForZoom(deps.getMapZoom()),
    isGridVisible: () => deps.getUiState().showGrid,
    createTimelineControl: (config) =>
      new WeatherLayers.TimelineControl(
        config as WeatherLayers.TimelineControlConfig,
      ),
    offsetDatetimeRange: (iso, back, fwd) =>
      WeatherLayers.offsetDatetimeRange(iso, back, fwd),
  });
  timelineController.timelineRange = WeatherLayers.offsetDatetimeRange(
    new Date().toISOString(),
    0,
    24,
  );
  await catalogController.inhouseCatalogReady;
  await catalogController.ensureInhouseGroupLayers(uiState.layerMode);

  const datetimes = timelineController.getTimelineDatetimesForMode(
    uiState.layerMode,
  );
  if (datetimes.length) {
    timelineController.timelineDatetimes = datetimes.slice();
    timelineController.activeTimelineDatetimes = datetimes.slice();
    timelineController.currentDatetime = datetimes[0];
    deps.setTimelineCurrentDatetime(datetimes[0]);
  }

  timelineController.ensureCustomTimeline(dom.timelineHost);
  timelineController.initTimeline(dom.timelineHost, datetimes, isDev);

  layerComposer.initLegends();

  deps.getTooltipController().initControl();
  void deps.getLayerGroupController().updateMode(uiState.layerMode);
  deps.scheduleUpdateLayers();

  return { timelineController };
}
