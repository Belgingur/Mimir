import type maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { PersistedStateV1 } from "./viewerTypes";
import type { UiState } from "./inhouseTypes";
import { resolveMapClickTarget } from "./mapClickRouting";
import { t } from "./i18n";
import { sampleInhouseScalarAtCoord } from "./gridSampling";
import { INHOUSE_GROUP_VARIABLES } from "./inhouseTypes";
import type { LayerComposer } from "../controllers/LayerComposer";
import type { InhouseCatalogController } from "../controllers/InhouseCatalogController";
import type { LayerGroupController } from "../controllers/LayerGroupController";
import type { TooltipController } from "../controllers/TooltipController";
import type { IconographyController } from "../controllers/IconographyController";
import type { WavegramController } from "../controllers/WavegramController";

export interface MapEventDeps {
  getOverlay: () => MapboxOverlay;
  getLayerComposer: () => LayerComposer;
  getCatalogController: () => InhouseCatalogController;
  getLayerGroupController: () => LayerGroupController;
  getTooltipController: () => TooltipController;
  getIconographyController: () => IconographyController | undefined;
  getWavegramController: () => WavegramController;
  getUiState: () => UiState;
  getPersistedState: () => PersistedStateV1 | null;
  setMapReady: (ready: boolean) => void;
  initWeather: () => Promise<void>;
  scheduleUpdateLayers: () => void;
  schedulePersistState: () => void;
}

export function attachMapEventHandlers(
  map: maplibregl.Map,
  deps: MapEventDeps,
): void {
  let styleFallbackApplied = false;
  map.on("error", (event: maplibregl.ErrorEvent) => {
    const message =
      (event as { error?: { message?: string } })?.error?.message ??
      "Unknown map error";
    if (!styleFallbackApplied) {
      styleFallbackApplied = true;
      console.warn(t("error.styleFallback", { message }));
      map.setStyle("https://demotiles.maplibre.org/style.json");
    }
  });

  map.on("load", () => {
    document.body.classList.remove("is-loading");
    deps.setMapReady(true);
    const persisted = deps.getPersistedState();
    if (persisted?.mapCamera) {
      map.jumpTo(persisted.mapCamera);
    }
    map.addControl(deps.getOverlay());
    void deps.initWeather();
    void deps.getLayerComposer().loadCountryOutlines();
    void deps.getCatalogController().inhouseCatalogReady;
  });

  map.on("click", (event: maplibregl.MapMouseEvent) => {
    const clickTarget = resolveMapClickTarget({
      selectedModel: deps.getCatalogController().inhouseSelectedModel,
      layerMode: deps.getUiState().layerMode,
    });
    if (clickTarget === "wavegram") {
      deps.getWavegramController().open([event.lngLat.lng, event.lngLat.lat]);
      return;
    }
  });

  map.on("mousemove", (event: maplibregl.MapMouseEvent) => {
    if (deps.getLayerGroupController().viewMode !== "forecast") return;

    const catalogController = deps.getCatalogController();
    const contourLayer = catalogController.getActiveInhouseContourLayer();
    if (contourLayer) {
      catalogController.scheduleInhouseContourHover(
        contourLayer,
        {
          x: event.point.x,
          y: event.point.y,
          coordinate: [event.lngLat.lng, event.lngLat.lat],
        },
        contourLayer.manifest.bounds,
      );
    } else {
      catalogController.hideInhouseTooltip();
    }

    const tooltipController = deps.getTooltipController();
    const uiState = deps.getUiState();
    if (
      tooltipController.tooltipControl &&
      uiState.layerMode === "temperature" &&
      !(
        tooltipController.tempRasterHoverActive &&
        Date.now() - tooltipController.tempRasterHoverTs < 120
      )
    ) {
      const tempLayer =
        catalogController.findInhouseLayerByCandidates(
          INHOUSE_GROUP_VARIABLES.temperature.primary,
        ) ??
        catalogController.inhouseLayers.find((layer) =>
          layer.variable.includes("air_temperature"),
        ) ??
        null;
      if (tempLayer?.scalar) {
        const coord: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        const [minLon, minLat, maxLon, maxLat] = tempLayer.manifest.bounds;
        const inBounds =
          coord[0] >= minLon &&
          coord[0] <= maxLon &&
          coord[1] >= minLat &&
          coord[1] <= maxLat;
        const value = inBounds
          ? sampleInhouseScalarAtCoord(
              tempLayer,
              coord,
              tempLayer.manifest.bounds,
            )
          : null;
        if (typeof value === "number" && Number.isFinite(value)) {
          tooltipController.updatePickingInfo({
            coordinate: coord,
            x: event.point.x,
            y: event.point.y,
            raster: { value },
          });
          const displayValue = value > 100 ? value - 273.15 : value;
          tooltipController.updateTooltipValueOverride(
            `${displayValue.toFixed(0)} °C`,
          );
        }
      }
    }
  });

  map.getCanvas().addEventListener("mouseleave", () => {
    deps.getCatalogController().hideInhouseTooltip();
  });

  map.getContainer().addEventListener("mouseleave", () => {
    deps.getTooltipController().clearAllAddons();
    deps.getCatalogController().hideInhouseTooltip();
  });

  map.on("moveend", () => {
    const layerComposer = deps.getLayerComposer();
    layerComposer.setLastStableView({
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
    deps.schedulePersistState();
    layerComposer.setGridLabelsDirty(true);
    layerComposer.scheduleLabelRender();
    deps.scheduleUpdateLayers();
    deps.getIconographyController()?.onMapMove();
  });

  map.on("zoomend", () => {
    const layerComposer = deps.getLayerComposer();
    deps.getIconographyController()?.onMapMove();
    layerComposer.setZooming(false);
    layerComposer.setGridLabelsDirty(true);
    layerComposer.scheduleLabelRender();
    layerComposer.updateGridOnly();
    deps.scheduleUpdateLayers();
  });

  map.on("zoomstart", () => {
    deps.getLayerComposer().setZooming(true);
    deps.scheduleUpdateLayers();
  });
}
