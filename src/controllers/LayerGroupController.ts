import type * as WeatherLayers from "weatherlayers-gl";
import { resolveSelectionChange, GWES_MODEL_ID } from "../lib/selectionRules";
import { DEFAULT_VIEW, DEFAULT_NON_WAVES_MODEL } from "../lib/modelConfig";
import { LAYER_GROUPS } from "../lib/inhouseTypes";
import type { UiState, ViewMode } from "../lib/inhouseTypes";
import type { IconographyStyle } from "../lib/viewerTypes";
import { syncGridToggleButtonState } from "../lib/gridToggleUi";
import { t } from "../lib/i18n";

const LAYER_GROUP_ICONS: Record<UiState["layerMode"], string> = {
  temperature:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 14.76V3.5a2 2 0 1 0-4 0v11.26a4 4 0 1 0 4 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8h9a3 3 0 1 0-3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h15a2.5 2.5 0 1 1-2.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16h8a2 2 0 1 1-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  precip:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 18h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  waves:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 9c1.2 0 1.8.9 2.5 1.8C5.2 11.7 5.8 12.6 7 12.6s1.8-.9 2.5-1.8C10.2 9.9 10.8 9 12 9s1.8.9 2.5 1.8c.7.9 1.3 1.8 2.5 1.8s1.8-.9 2.5-1.8C20.2 9.9 20.8 9 22 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14.2c1.2 0 1.8.9 2.5 1.8.7.9 1.3 1.8 2.5 1.8s1.8-.9 2.5-1.8c.7-.9 1.3-1.8 2.5-1.8s1.8.9 2.5 1.8c.7.9 1.3 1.8 2.5 1.8s1.8-.9 2.5-1.8c.7-.9 1.3-1.8 2.5-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cloud:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 12a1 1 0 1 1 0 9H9.006a7 7 0 1 1 6.702-9z"/><path d="M21.832 9A3 3 0 0 0 19 7h-2.207a5.5 5.5 0 0 0-10.72.61"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></svg>',
};

export interface LayerGroupDom {
  viewForecastBtn: HTMLButtonElement;
  viewIconographyBtn: HTMLButtonElement | null;
  layerGroupList: HTMLDivElement;
  gridToggleButton: HTMLButtonElement | null;
  gridToggle: HTMLInputElement;
  layerToggle: HTMLInputElement;
  legendHost: HTMLDivElement;
  waveLegendHost: HTMLDivElement;
  windLegendHost: HTMLDivElement;
  precipLegendHost: HTMLDivElement;
  cloudLegendHost: HTMLDivElement;
  snowDepthLegendHost: HTMLDivElement;
  legendStackCardEl: HTMLDivElement | null;
  iconStyleClassicBtn: HTMLButtonElement | null;
  iconStyleCompactBtn: HTMLButtonElement | null;
}

type MapView = {
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
};

export interface LayerGroupDeps {
  dom: LayerGroupDom;
  isDev: boolean;
  defaultLayerMode: UiState["layerMode"];

  getUiState: () => UiState;
  getWindUnitFormat: () => WeatherLayers.UnitFormat | null;

  getMapView: () => MapView;
  easeToMap: (options: {
    center?: [number, number] | { lng: number; lat: number };
    zoom?: number;
    duration?: number;
  }) => void;
  resizeMap: () => void;
  jumpToMap: (view: MapView) => void;

  scheduleUpdateLayers: () => void;
  schedulePersistState: () => void;
  setGridLabelsDirty: () => void;
  scheduleLabelRender: () => void;
  updateLayers: () => void;
  updateGridOnly: () => void;

  isDebugRoute: () => boolean;
  activateIconography: () => void;
  deactivateIconography: () => void;
  mountForecast: () => void;
  syncInhouseTimeToTimeline: () => void;

  getInhouseSelectedModel: () => string;
  getInhouseSelectedAnalysis: () => string;
  getInhouseModels: () => string[];
  isGroupAvailableForModel: (groupId: string) => boolean;
  loadInhouseAnalyses: (model: string) => Promise<void>;
  ensureInhouseGroupLayers: (groupId: string) => void;

  saveNonWavesSelection: (model: string, analysis: string) => void;
  restoreNonWavesSelection: () => { model: string; analysis?: string } | null;

  syncWindControls: () => void;
  detachWindSlot: () => void;
  getWindFormatLabel: () => string;
  getWindBadge: () => string;
  attachWindToSlot: (button: HTMLButtonElement, flyout: HTMLDivElement) => void;

  updateTimelineControlForMode: (mode: UiState["layerMode"]) => void;

  setTooltipConfig: (config: unknown) => void;
  hasTooltipControl: () => boolean;

  syncLegendForMode: (mode: UiState["layerMode"]) => void;

  getIconographyStyle: () => IconographyStyle;
  setIconographyStyle: (style: IconographyStyle) => void;

  WL_UnitSystem_METRIC: unknown;
  WL_Placement_TOP: unknown;
  WL_DirectionType_INWARD: unknown;
  WL_DirectionFormat_CARDINAL3: unknown;
  WL_DirectionFormat_VALUE: unknown;
}

export class LayerGroupController {
  private readonly deps: LayerGroupDeps;
  private _viewMode: ViewMode = "forecast";
  private _lastViewMode: ViewMode = "forecast";

  constructor(deps: LayerGroupDeps) {
    this.deps = deps;
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  /** Switch the iconography rendering style and re-render. */
  selectIconographyStyle(style: IconographyStyle): void {
    this.deps.setIconographyStyle(style);
  }

  get lastViewMode(): ViewMode {
    return this._lastViewMode;
  }

  set lastViewMode(mode: ViewMode) {
    this._lastViewMode = mode;
  }

  setViewMode(mode: ViewMode, force = false): void {
    if (!force && this._viewMode === mode) return;

    // Iconography requires non-waves data. If we are currently on GWES (which
    // only has wave layers), kick off a model switch to the default non-waves
    // model before activating iconography so the map has something to render.
    if (
      mode === "iconography" &&
      this.deps.getInhouseSelectedModel() === GWES_MODEL_ID
    ) {
      void this.updateMode("temperature");
    }

    const prev = this._viewMode;
    this._viewMode = mode;
    this.syncViewModeUi();

    // Deactivate previous mode
    if (prev === "iconography") {
      this.deps.deactivateIconography();
    }

    // Activate new mode
    if (this._viewMode === "iconography") {
      this.deps.activateIconography();
    } else {
      this.deps.mountForecast();
    }

    this.deps.scheduleUpdateLayers();
    if (!(this.deps.isDev && this.deps.isDebugRoute())) {
      this._lastViewMode = this._viewMode;
    }
    this.deps.syncInhouseTimeToTimeline();
  }

  syncViewModeUi(): void {
    const isIconography = this._viewMode === "iconography";
    document.body.classList.toggle("view-iconography", isIconography);
    this.deps.dom.viewForecastBtn.classList.toggle(
      "is-active",
      this._viewMode === "forecast",
    );
    this.deps.dom.viewIconographyBtn?.classList.toggle(
      "is-active",
      isIconography,
    );
    this.deps.dom.viewForecastBtn.setAttribute(
      "aria-pressed",
      this._viewMode === "forecast" ? "true" : "false",
    );
    this.deps.dom.viewIconographyBtn?.setAttribute(
      "aria-pressed",
      isIconography ? "true" : "false",
    );
    // Icon-style switcher is hidden for now; compact is the only offered style.
    if (isIconography) this.syncIconographyStyleButtons();
  }

  syncIconographyStyleButtons(): void {
    const style = this.deps.getIconographyStyle();
    const { iconStyleClassicBtn, iconStyleCompactBtn } = this.deps.dom;
    iconStyleClassicBtn?.classList.toggle("is-active", style === "classic");
    iconStyleClassicBtn?.setAttribute(
      "aria-pressed",
      style === "classic" ? "true" : "false",
    );
    iconStyleCompactBtn?.classList.toggle("is-active", style === "compact");
    iconStyleCompactBtn?.setAttribute(
      "aria-pressed",
      style === "compact" ? "true" : "false",
    );
  }

  renderLayerGroupList(): void {
    if (!this.deps.dom.layerGroupList) return;
    this.deps.dom.layerGroupList.innerHTML = "";
    this.deps.detachWindSlot();
    const uiState = this.deps.getUiState();
    LAYER_GROUPS.forEach((group) => {
      if (
        group.id === "waves" &&
        !this.deps.getInhouseModels().includes(GWES_MODEL_ID)
      ) {
        return;
      }
      const isWindGroup = group.id === "wind";
      const isSelected = uiState.layerMode === group.id;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-slot";
      button.dataset.layerMode = group.id;
      const groupTitle = t(group.title);
      button.title = isWindGroup
        ? `${t("layer.wind")}: ${this.deps.getWindFormatLabel()}`
        : groupTitle;
      button.dataset.label = isWindGroup
        ? `${t("layer.wind")}: ${this.deps.getWindFormatLabel()}`
        : groupTitle;
      button.setAttribute("aria-label", groupTitle);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isWindGroup) {
        button.classList.add("layer-slot--wind");
        button.dataset.windStyleBadge = this.deps.getWindBadge();
      }
      button.innerHTML = `
        <span class="layer-slot__button${isSelected ? " is-active" : ""}">
          <span class="layer-slot__icon" aria-hidden="true">${LAYER_GROUP_ICONS[group.id]}</span>
          <span class="layer-slot__sr">${groupTitle}</span>
        </span>
      `;

      if (!isWindGroup) {
        button.addEventListener("click", () => {
          void this.updateMode(group.id as UiState["layerMode"]);
        });
        this.deps.dom.layerGroupList.appendChild(button);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "layer-slot-wrap";
        wrap.appendChild(button);

        const flyout = document.createElement("div");
        flyout.className = "wind-style-flyout";
        flyout.setAttribute("aria-label", t("layer.wind"));
        flyout.setAttribute("role", "group");
        flyout.innerHTML = `
          <button type="button" class="wind-style-flyout__option" data-wind-style="arrows" aria-label="${t("wind.arrows")}" title="${t("wind.arrows")}">
            <span class="wind-style-flyout__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 3H13V6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </button>
          <button type="button" class="wind-style-flyout__option" data-wind-style="particles" aria-label="${t("wind.particles")}" title="${t("wind.particles")}">
            <span class="wind-style-flyout__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="5" r="1.35"/><circle cx="8.5" cy="3.5" r="1.1"/><circle cx="11.5" cy="6.5" r="1.25"/><circle cx="5.5" cy="10.5" r="1.15"/><circle cx="10.5" cy="11.5" r="1.4"/><circle cx="13" cy="9.5" r="1"/></svg></span>
          </button>
          <button type="button" class="wind-style-flyout__option" data-wind-style="streamlines" aria-label="${t("wind.streamlines")}" title="${t("wind.streamlines")}">
            <span class="wind-style-flyout__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5C4 2.5 6.5 2.5 8 4.5C9.5 6.5 12 6.5 13.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.5 8C4.2 6.3 6.1 6.3 7.8 8C9.5 9.7 11.4 9.7 13.1 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.5 11.5C4 9.5 6.5 9.5 8 11.5C9.5 13.5 12 13.5 13.5 11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
          </button>
        `;
        wrap.appendChild(flyout);
        this.deps.attachWindToSlot(button, flyout);
        this.deps.dom.layerGroupList.appendChild(wrap);
      }
    });
  }

  getLayerSlotButtons(): HTMLButtonElement[] {
    return Array.from(
      this.deps.dom.layerGroupList.querySelectorAll<HTMLButtonElement>(
        "button[data-layer-mode]",
      ),
    );
  }

  getSelectedLayerMode(): UiState["layerMode"] {
    return this.deps.getUiState().layerMode;
  }

  syncCheckedState(): void {
    const mode = this.deps.getUiState().layerMode;
    this.getLayerSlotButtons().forEach((btn) => {
      const isActive = btn.dataset.layerMode === mode;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      const inner = btn.querySelector<HTMLElement>(".layer-slot__button");
      if (inner) inner.classList.toggle("is-active", isActive);
    });
  }

  syncGridToggleButton(): void {
    syncGridToggleButtonState(
      this.deps.dom.gridToggleButton,
      this.deps.getUiState().showGrid,
    );
  }

  async updateMode(mode: UiState["layerMode"]): Promise<void> {
    const uiState = this.deps.getUiState();
    const prevMode = uiState.layerMode;
    const view = this.deps.getMapView();
    const availableModels = this.deps.getInhouseModels();
    const defaultModelForNonWaves = availableModels.includes(
      DEFAULT_NON_WAVES_MODEL,
    )
      ? DEFAULT_NON_WAVES_MODEL
      : (availableModels.find((m) => m !== GWES_MODEL_ID) ??
        DEFAULT_NON_WAVES_MODEL);
    const resolve = resolveSelectionChange({
      action: "layerChange",
      fromModel: this.deps.getInhouseSelectedModel(),
      fromLayer: prevMode,
      toLayer: mode,
      defaults: {
        defaultModelForNonWaves,
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: (groupId) =>
        this.deps.isGroupAvailableForModel(groupId),
    });
    const nextMode = resolve.layer;
    const modelSwitched = resolve.model !== this.deps.getInhouseSelectedModel();
    const isSwitchingToWaves = nextMode === "waves";
    if (isSwitchingToWaves) {
      this.deps.easeToMap({
        center: DEFAULT_VIEW.center,
        zoom: DEFAULT_VIEW.zoom,
        duration: 800,
      });
    } else if (resolve.appliedException === "LEAVE_GWES_BY_LAYER") {
      this.deps.easeToMap({
        center: DEFAULT_VIEW.center,
        zoom: DEFAULT_VIEW.zoom,
        duration: 800,
      });
    }
    if (modelSwitched) {
      await this.deps.loadInhouseAnalyses(resolve.model);
    }
    uiState.layerMode = nextMode;
    this.syncCheckedState();
    this.deps.schedulePersistState();
    this.deps.syncWindControls();
    if (nextMode === "waves") {
      if (
        this.deps.getInhouseSelectedModel() &&
        this.deps.getInhouseSelectedModel() !== GWES_MODEL_ID
      ) {
        this.deps.saveNonWavesSelection(
          this.deps.getInhouseSelectedModel(),
          this.deps.getInhouseSelectedAnalysis(),
        );
      }
      if (
        this.deps.getInhouseModels().includes(GWES_MODEL_ID) &&
        this.deps.getInhouseSelectedModel() !== GWES_MODEL_ID
      ) {
        await this.deps.loadInhouseAnalyses(GWES_MODEL_ID);
      }
      void this.deps.ensureInhouseGroupLayers("waves");
    } else {
      const saved = this.deps.restoreNonWavesSelection();
      if (
        resolve.appliedException !== "LEAVE_GWES_BY_LAYER" &&
        this.deps.getInhouseSelectedModel() === GWES_MODEL_ID &&
        saved
      ) {
        await this.deps.loadInhouseAnalyses(saved.model);
      }
      void this.deps.ensureInhouseGroupLayers(nextMode);
    }
    this.deps.setGridLabelsDirty();
    this.deps.scheduleLabelRender();
    this.deps.updateTimelineControlForMode(nextMode);
    this.deps.scheduleUpdateLayers();
    if (!isSwitchingToWaves && prevMode !== "waves") {
      this.syncTooltipAndLegendForMode(nextMode);
      const restoreView = () => {
        // Skip for models that manage their own initial centering (e.g. BEL-IS).
        if (this.deps.getInhouseSelectedModel() === "BEL-IS") return;
        this.deps.resizeMap();
        this.deps.jumpToMap(view);
      };
      window.requestAnimationFrame(restoreView);
      window.setTimeout(restoreView, 0);
      window.setTimeout(restoreView, 50);
    } else {
      // Resize first, then show the legend in the next animation frame so that
      // MapLibre's layout recalculation does not interfere with the absolute
      // positioning of .legend-stack-card.
      this.deps.resizeMap();
      window.requestAnimationFrame(() =>
        this.syncTooltipAndLegendForMode(nextMode),
      );
    }
  }

  syncTooltipAndLegendForMode(mode: UiState["layerMode"]): void {
    // Reset any drag-applied inline position so the CSS-defined bottom/right
    // takes effect. The drag handler writes top/left/right:auto/bottom:auto as
    // inline styles; clearing them here lets the CSS rule take back control on
    // every mode switch, so the legend always snaps back to its default corner.
    if (this.deps.dom.legendStackCardEl) {
      const card = this.deps.dom.legendStackCardEl;
      card.style.top = "";
      card.style.left = "";
      card.style.right = "";
      card.style.bottom = "";
    }
    this.deps.dom.legendHost.style.display =
      mode === "temperature" ? "block" : "none";
    this.deps.dom.waveLegendHost.style.display =
      mode === "waves" ? "block" : "none";
    this.deps.dom.windLegendHost.style.display =
      mode === "wind" ? "block" : "none";
    this.deps.dom.precipLegendHost.style.display =
      mode === "precip" ? "block" : "none";
    this.deps.dom.cloudLegendHost.style.display =
      mode === "cloud" ? "block" : "none";
    this.deps.dom.snowDepthLegendHost.style.display =
      mode === "snow" ? "block" : "none";
    if (this.deps.hasTooltipControl()) {
      this.deps.setTooltipConfig({
        unitFormat:
          mode === "wind"
            ? (this.deps.getWindUnitFormat() ?? {
                system: this.deps.WL_UnitSystem_METRIC,
                unit: "m/s",
                decimals: 1,
              })
            : {
                system: this.deps.WL_UnitSystem_METRIC,
                unit: "",
                decimals: 0,
              },
        followCursor: true,
        followCursorOffset: 12,
        followCursorPlacement: this.deps.WL_Placement_TOP,
        directionType: this.deps.WL_DirectionType_INWARD,
        directionFormat:
          mode === "wind" || mode === "precip" || mode === "waves"
            ? this.deps.WL_DirectionFormat_CARDINAL3
            : this.deps.WL_DirectionFormat_VALUE,
      });
    }
    this.deps.syncLegendForMode(mode);
  }

  attachToggleHandlers() {
    const { gridToggle, layerToggle, gridToggleButton } = this.deps.dom;

    layerToggle.addEventListener("change", () => {
      this.deps.getUiState().visible = layerToggle.checked;
      this.deps.updateLayers();
      this.deps.schedulePersistState();
    });

    gridToggle.addEventListener("change", () => {
      this.deps.getUiState().showGrid = gridToggle.checked;
      this.deps.setGridLabelsDirty();
      this.deps.scheduleLabelRender();
      this.deps.updateGridOnly();
      this.deps.schedulePersistState();
      this.syncGridToggleButton();
    });

    gridToggleButton?.addEventListener("click", () => {
      gridToggle.checked = !gridToggle.checked;
      gridToggle.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  handleRouteChange() {
    document.body.classList.toggle("is-dev", this.deps.isDev);
    this.setViewMode(this._lastViewMode, true);
    this.syncViewModeUi();
  }
}
