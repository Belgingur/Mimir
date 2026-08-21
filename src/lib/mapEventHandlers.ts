import type maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { PersistedStateV1 } from "./viewerTypes";
import type { UiState } from "./inhouseTypes";
import { resolveMapClickTarget } from "./mapClickRouting";
import { applyInitialCamera } from "./initialCamera";
import { getPresentSettlementLayerIds, pickPlaceLabel } from "./placeLabelPick";
import type { PlaceResolver, ResolvedPlace } from "./resolveClickedPlace";
import { t } from "./i18n";
import { sampleInhouseScalarAtCoord } from "./gridSampling";
import { INHOUSE_GROUP_VARIABLES } from "./inhouseTypes";
import { isCenterReadoutViewport } from "./centerReadoutViewport";
import type { LayerComposer } from "../controllers/LayerComposer";
import type { InhouseCatalogController } from "../controllers/InhouseCatalogController";
import type { LayerGroupController } from "../controllers/LayerGroupController";
import type { TooltipController } from "../controllers/TooltipController";
import type { IconographyController } from "../controllers/IconographyController";
import type { WavegramController } from "../controllers/WavegramController";
import type { MeteogramController } from "../features/meteogram/MeteogramController";

export interface MapEventDeps {
  getOverlay: () => MapboxOverlay;
  getLayerComposer: () => LayerComposer;
  getCatalogController: () => InhouseCatalogController;
  getLayerGroupController: () => LayerGroupController;
  getTooltipController: () => TooltipController;
  getIconographyController: () => IconographyController | undefined;
  getWavegramController: () => WavegramController;
  /** Optional: only present when the meteogram feature is enabled for this build. */
  getMeteogramController?: () => MeteogramController | null;
  meteogramEnabled?: boolean;
  getUiState: () => UiState;
  getPersistedState: () => PersistedStateV1 | null;
  /** Suppress the next model domain auto-centre so it doesn't clobber the
   *  first-visit geolocation camera (see applyInitialCamera). */
  suppressNextAutoCenter?: () => void;
  /** Resolves a clicked point to a named place — basemap label first, bundled
   *  dataset as fallback. Optional so the handlers still work headless. */
  getPlaceResolver?: () => PlaceResolver | null;
  /** Called with the resolved place (or null) on every map click, together with
   *  the clicked coordinate the result belongs to. */
  onPlaceResolved?: (
    place: ResolvedPlace | null,
    lngLat: { lng: number; lat: number },
  ) => void;
  /** Applied once the style has loaded (and again after any style swap): the
   *  weather overlay's draw-order anchor and the place-label presentation. */
  onStyleReady?: () => void;
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

  let mapLoadHandled = false;
  const handleMapLoad = async () => {
    if (mapLoadHandled) return;
    mapLoadHandled = true;
    deps.setMapReady(true);
    // Inside the load handler: reading or restyling the style before it has
    // loaded either throws or silently no-ops.
    deps.onStyleReady?.();
    const persisted = deps.getPersistedState();
    if (persisted?.mapCamera) {
      map.jumpTo(persisted.mapCamera);
    } else {
      // First visit (no saved camera): centre on a cached location if we have
      // one (no permission prompt); otherwise stay put and let the coverage-aware
      // model picker centre on its domain (Iceland overview fallback). Task A1.
      applyInitialCamera(map, {
        suppressAutoCenter: deps.suppressNextAutoCenter,
      });
    }
    map.addControl(deps.getOverlay());
    await deps.initWeather();

    // Let the layer update queued by the first frame run before declaring the
    // initial view ready. The loading bar now tracks usable forecast data, not
    // merely the basemap style.
    await new Promise<void>((resolve) => {
      const raf = globalThis.requestAnimationFrame;
      if (typeof raf === "function") raf(() => resolve());
      else setTimeout(resolve, 0);
    });
    document.body.classList.remove("is-loading");

    // Country outlines are a large ancillary asset. Load them only after the
    // first forecast paint, during idle time, so they do not compete with the
    // catalog, manifests, or active frame.
    const loadOutlines = () => {
      void deps.getLayerComposer().loadCountryOutlines();
    };
    const idle = (
      globalThis as {
        requestIdleCallback?: (
          callback: () => void,
          options?: { timeout: number },
        ) => void;
      }
    ).requestIdleCallback;
    if (typeof idle === "function") idle(loadOutlines, { timeout: 2000 });
    else setTimeout(loadOutlines, 0);
  };

  map.once("load", () => void handleMapLoad());
  // Deferred controller loading can attach after MapLibre has already emitted
  // `load`. The guard keeps this and the event path exactly-once.
  if (map.loaded()) void handleMapLoad();

  // The style can be replaced at runtime (see the demotiles error fallback
  // above), which discards both the resolved anchor and the label restyling.
  // Layer ids are never hardcoded, so re-applying is all that's needed.
  map.on("styledata", () => {
    deps.onStyleReady?.();
  });

  map.on("click", (event: maplibregl.MapMouseEvent) => {
    // Resolve the clicked place on every click, independently of what the click
    // goes on to open. Synchronous, and both paths are local — no geocoding.
    const resolved =
      deps
        .getPlaceResolver?.()
        ?.resolve(
          { x: event.point.x, y: event.point.y },
          { lng: event.lngLat.lng, lat: event.lngLat.lat },
        ) ?? null;
    deps.onPlaceResolved?.(resolved, {
      lng: event.lngLat.lng,
      lat: event.lngLat.lat,
    });

    // Selecting a city means selecting its location, not just its name: a
    // "label" result carries the city's own point (a station's exact position
    // where one matches), so the forecast is fetched there. Every other click
    // keeps the raw coordinate — clicking open ground must forecast that spot.
    const target =
      resolved?.source === "label"
        ? { lng: resolved.longitude, lat: resolved.latitude }
        : { lng: event.lngLat.lng, lat: event.lngLat.lat };

    // A pending single-click open is cancelled the moment a new click arrives;
    // a genuine double-click (map zoom) then leaves nothing queued.
    deps.getMeteogramController?.()?.cancelPendingClick();
    const clickTarget = resolveMapClickTarget({
      selectedModel: deps.getCatalogController().inhouseSelectedModel,
      layerMode: deps.getUiState().layerMode,
      viewMode: deps.getLayerGroupController().viewMode,
      meteogramEnabled: deps.meteogramEnabled,
    });
    if (clickTarget === "wavegram") {
      deps.getWavegramController().open([target.lng, target.lat]);
      return;
    }
    if (clickTarget === "meteogram") {
      // On touch / small screens the meteogram is opened via the centre-crosshair
      // button (see meteogramTrigger) so it never competes with pan/zoom taps.
      if (!isCenterReadoutViewport()) {
        deps.getMeteogramController?.()?.handleMapClick(target);
      }
      return;
    }
  });

  map.on("dblclick", () => {
    deps.getMeteogramController?.()?.cancelPendingClick();
  });

  map.on("mousemove", (event: maplibregl.MapMouseEvent) => {
    if (deps.getLayerGroupController().viewMode !== "forecast") return;
    // Mobile uses the fixed centre readout instead of cursor-following tooltips.
    if (isCenterReadoutViewport()) return;

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

  // Pointer affordance over the basemap's city labels, so that clicking a city
  // name is discoverable. Kept in its own handler because the main mousemove
  // handler returns early outside forecast view, while the affordance applies
  // everywhere. Uses the same hit box as the click path, so the cursor changes
  // exactly where a click would actually register a label hit.
  //
  // The cursor is expressed as a class, not a style write. deck.gl owns the
  // canvas cursor in interleaved mode and re-applies its own getCursor result
  // as an inline style, so a direct `canvas.style.cursor = "pointer"` is
  // reverted within a frame or two. The class drives an `!important` rule in
  // base.css, which outranks deck's inline style without racing it.
  const PLACE_HOVER_CLASS = "mimir-place-label-hover";
  let labelHoverActive = false;
  const setLabelHover = (hovering: boolean) => {
    if (hovering === labelHoverActive) return;
    labelHoverActive = hovering;
    map.getCanvasContainer().classList.toggle(PLACE_HOVER_CLASS, hovering);
  };

  map.on("mousemove", (event: maplibregl.MapMouseEvent) => {
    if (getPresentSettlementLayerIds(map).length === 0) return;
    setLabelHover(
      Boolean(pickPlaceLabel(map, { x: event.point.x, y: event.point.y })),
    );
  });

  map.getCanvas().addEventListener("mouseleave", () => {
    setLabelHover(false);
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
