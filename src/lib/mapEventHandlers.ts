import type * as maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { InhouseGroupId, UiState } from "./inhouseTypes";
import { resolveMapClickTarget } from "./mapClickRouting";
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
import type { StartOutcome } from "./mapStartup";

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
  /** Called inside every `styledata` event, before the re-apply that follows
   *  it one task later. It must not add layers: the map is mid-frame. It is
   *  the place to let go of whatever the changed style can no longer hold. */
  onStyleData?: () => void;
  /** Resolves when the map's style has loaded (see whenStyleLoads). main.ts
   *  makes it when it creates the map, so it holds whenever these handlers
   *  attach. */
  styleLoaded: Promise<void>;
  /** Told when the start has ended, and how (see MapStartup.finished). */
  onStartFinished?: (outcome: StartOutcome) => void;
  /** Brief, self-clearing message for an action that was declined — used when a
   *  click lands where the forecast has no data, so the click never just goes
   *  nowhere. Optional: headless callers simply get silence. */
  showTransientNotice?: (message: string) => void;
  setMapReady: (ready: boolean) => void;
  /** Resolves false when it ended with its own error on screen instead of
   *  the forecast (see ForecastStart.start). */
  initWeather: () => Promise<boolean | void>;
  scheduleUpdateLayers: () => void;
  schedulePersistState: () => void;
}

export function attachMapEventHandlers(
  map: maplibregl.Map,
  deps: MapEventDeps,
): void {
  let startHandled = false;

  const startForecast = async () => {
    if (startHandled) return;
    startHandled = true;
    let outcome: StartOutcome = "forecast";
    try {
      deps.setMapReady(true);
      // Only now: reading or restyling the style before it has loaded either
      // throws or silently no-ops.
      deps.onStyleReady?.();
      // No camera move here: main.ts builds the map where it should open (the
      // saved camera, or the first-visit view), so there is nothing to correct.
      map.addControl(deps.getOverlay());
      if ((await deps.initWeather()) === false) outcome = "error";

      // Let the layer update queued by the first frame run before declaring
      // the initial view ready. The loading bar now tracks usable forecast
      // data, not merely the basemap style.
      await new Promise<void>((resolve) => {
        const raf = globalThis.requestAnimationFrame;
        if (typeof raf === "function") raf(() => resolve());
        else setTimeout(resolve, 0);
      });
    } catch (error) {
      outcome = "failed";
      console.error("The first load failed", error);
    } finally {
      // However the start ended, the page must not stay loading.
      document.body.classList.remove("is-loading");
      deps.onStartFinished?.(outcome);
    }
  };

  // Start when the style is in, not on MapLibre's `load`.
  //
  // `load` waits for every basemap request: the tiles in view, the sprite and
  // the glyphs. One that never answered kept the forecast from ever starting.
  // And `load` fires once: controllers that attached after it had to rely on
  // map.loaded(), which is false whenever tiles are loading, so a map being
  // moved at that moment never started either.
  //
  // The style is all the start needs: it anchors the weather layers below the
  // place labels. A basemap request that never answers now leaves a gap in
  // the basemap, not a page that loads for good.
  void deps.styleLoaded.then(() => startForecast());

  // The style can be replaced at runtime (see the fallback style in
  // mapStartup), which discards both the resolved anchor and the label
  // restyling.
  // Layer ids are never hardcoded, so re-applying is all that's needed.
  //
  // Not from inside the event, though. MapLibre fires `styledata` in the
  // middle of a frame, after it has evaluated the style's layers and before
  // it draws them. A layer added there is drawn in that frame unevaluated,
  // and its draw throws. So the re-apply runs one task later, outside the
  // frame, and the next frame evaluates the new layers before drawing them.
  // Events that arrive before it has run share that one call.
  let styleReadyQueued = false;
  map.on("styledata", () => {
    deps.onStyleData?.();
    if (styleReadyQueued) return;
    styleReadyQueued = true;
    setTimeout(() => {
      styleReadyQueued = false;
      deps.onStyleReady?.();
    }, 0);
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
    // Don't open a panel we already know will come back empty.
    //
    // The forecast raster on screen carries a domain mask, so whether this point
    // has data is knowable before any request — and clicking sea ice off the
    // edge of a rotated-pole grid, or open land in a wave model, used to open a
    // panel, fetch, 404, and leave an error where a forecast should be. Saying
    // "nothing here" straight away is both faster and truthful.
    //
    // Only a definite "none" refuses. While a frame is still decoding the answer
    // is "unknown" and the click goes through, with the fetch as the authority —
    // exactly as before.
    if (clickTarget === "wavegram" || clickTarget === "meteogram") {
      const availability = deps
        .getCatalogController()
        .dataAvailabilityAt(
          target.lng,
          target.lat,
          deps.getUiState().layerMode as InhouseGroupId,
        );
      if (availability === "none") {
        deps.showTransientNotice?.(t("map.noForecastHere"));
        return;
      }
    }
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
    // With the meteogram open, its pin is the only value on the map.
    if (deps.getMeteogramController?.()?.isOpen) {
      deps.getCatalogController().hideInhouseTooltip();
      return;
    }

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
