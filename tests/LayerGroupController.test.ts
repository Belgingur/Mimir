import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as WeatherLayers from "weatherlayers-gl";

const { mockResolveSelectionChange, mockSyncGridToggleButtonState } =
  vi.hoisted(() => ({
    mockResolveSelectionChange: vi.fn(),
    mockSyncGridToggleButtonState: vi.fn(),
  }));

vi.mock("../src/lib/selectionRules", async () => {
  const actual = await vi.importActual<
    typeof import("../src/lib/selectionRules")
  >("../src/lib/selectionRules");
  return {
    ...actual,
    GWES_MODEL_ID: "GWES",
    resolveSelectionChange: mockResolveSelectionChange,
  };
});

vi.mock("../src/lib/gridToggleUi", () => ({
  syncGridToggleButtonState: mockSyncGridToggleButtonState,
}));

import { DEFAULT_VIEW } from "../src/lib/modelConfig";
import { LAYER_GROUPS, type UiState } from "../src/lib/inhouseTypes";
import {
  LayerGroupController,
  type LayerGroupDeps,
  type LayerGroupDom,
} from "../src/controllers/LayerGroupController";

function makeDom(): LayerGroupDom {
  const viewForecastBtn = document.createElement("button");
  const layerGroupList = document.createElement("div") as HTMLDivElement;
  const viewIconographyBtn = document.createElement("button");
  const gridToggleButton = document.createElement("button");
  const gridToggle = document.createElement("input") as HTMLInputElement;
  const layerToggle = document.createElement("input") as HTMLInputElement;
  const legendHost = document.createElement("div") as HTMLDivElement;
  const waveLegendHost = document.createElement("div") as HTMLDivElement;
  const windLegendHost = document.createElement("div") as HTMLDivElement;
  const precipLegendHost = document.createElement("div") as HTMLDivElement;
  const cloudLegendHost = document.createElement("div") as HTMLDivElement;
  const snowDepthLegendHost = document.createElement("div") as HTMLDivElement;
  const legendStackCardEl = document.createElement("div") as HTMLDivElement;
  document.body.append(
    viewForecastBtn,
    viewIconographyBtn,
    layerGroupList,
    gridToggleButton,
    gridToggle,
    layerToggle,
    legendHost,
    waveLegendHost,
    windLegendHost,
    precipLegendHost,
    cloudLegendHost,
    snowDepthLegendHost,
    legendStackCardEl,
  );
  return {
    viewForecastBtn,
    viewIconographyBtn,
    layerGroupList,
    gridToggleButton,
    gridToggle,
    layerToggle,
    legendHost,
    waveLegendHost,
    windLegendHost,
    precipLegendHost,
    cloudLegendHost,
    snowDepthLegendHost,
    legendStackCardEl,
  };
}

function makeDeps(overrides: Partial<LayerGroupDeps> = {}): {
  deps: LayerGroupDeps;
  uiState: UiState;
  setSelectedModel: (model: string) => void;
  setSelectedAnalysis: (analysis: string) => void;
} {
  const dom = makeDom();
  const uiState: UiState = {
    visible: true,
    opacity: 1,
    layerMode: "temperature",
    showGrid: false,
    iconographyStyle: "compact",
  };
  let selectedModel = "GFS";
  let selectedAnalysis = "2026-01-01_00";
  const mapView = {
    center: { lng: -20, lat: 55 },
    zoom: 4,
    bearing: 0,
    pitch: 0,
  };
  const deps: LayerGroupDeps = {
    dom,
    isDev: false,
    defaultLayerMode: "temperature",
    getUiState: () => uiState,
    getWindUnitFormat: () => null,
    getMapView: () => mapView,
    easeToMap: vi.fn(),
    resizeMap: vi.fn(),
    jumpToMap: vi.fn(),
    scheduleUpdateLayers: vi.fn(),
    schedulePersistState: vi.fn(),
    setGridLabelsDirty: vi.fn(),
    scheduleLabelRender: vi.fn(),
    isDebugRoute: vi.fn(() => false),
    activateIconography: vi.fn(),
    deactivateIconography: vi.fn(),
    mountForecast: vi.fn(),
    syncInhouseTimeToTimeline: vi.fn(),
    getInhouseSelectedModel: vi.fn(() => selectedModel),
    getInhouseSelectedAnalysis: vi.fn(() => selectedAnalysis),
    getInhouseModels: vi.fn(() => ["GFS", "GWES"]),
    isGroupAvailableForModel: vi.fn(() => true),
    loadInhouseAnalyses: vi.fn(async () => {}),
    ensureInhouseGroupLayers: vi.fn(),
    saveNonWavesSelection: vi.fn(),
    restoreNonWavesSelection: vi.fn(() => null),
    updateLayers: vi.fn(),
    updateGridOnly: vi.fn(),
    syncWindControls: vi.fn(),
    detachWindSlot: vi.fn(),
    getWindFormatLabel: vi.fn(() => "Arrows"),
    getWindBadge: vi.fn(() => "A"),
    attachWindToSlot: vi.fn(),
    updateTimelineControlForMode: vi.fn(),
    setTooltipConfig: vi.fn(),
    hasTooltipControl: vi.fn(() => true),
    syncLegendForMode: vi.fn(),
    getIconographyStyle: vi.fn(() => uiState.iconographyStyle),
    setIconographyStyle: vi.fn((style) => {
      uiState.iconographyStyle = style;
    }),
    WL_UnitSystem_METRIC: "metric",
    WL_Placement_TOP: "top",
    WL_DirectionType_INWARD: "inward",
    WL_DirectionFormat_CARDINAL3: "cardinal3",
    WL_DirectionFormat_VALUE: "value",
    ...overrides,
  } as LayerGroupDeps;

  return {
    deps,
    uiState,
    setSelectedModel: (model: string) => {
      selectedModel = model;
    },
    setSelectedAnalysis: (analysis: string) => {
      selectedAnalysis = analysis;
    },
  };
}

describe("LayerGroupController", () => {
  let deps: LayerGroupDeps;
  let uiState: UiState;
  let ctrl: LayerGroupController;
  let setSelectedModel: (model: string) => void;
  let setSelectedAnalysis: (analysis: string) => void;

  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    mockResolveSelectionChange.mockImplementation(
      (input: {
        fromModel: string;
        fromLayer: UiState["layerMode"];
        toLayer?: UiState["layerMode"];
      }) => ({
        model: input.fromModel,
        layer: input.toLayer ?? input.fromLayer,
        appliedException: null,
      }),
    );
    const h = makeDeps();
    deps = h.deps;
    uiState = h.uiState;
    setSelectedModel = h.setSelectedModel;
    setSelectedAnalysis = h.setSelectedAnalysis;
    ctrl = new LayerGroupController(deps);
  });

  describe("initial state", () => {
    it("starts with forecast view mode", () => {
      expect(ctrl.viewMode).toBe("forecast");
    });

    it("starts with forecast last view mode", () => {
      expect(ctrl.lastViewMode).toBe("forecast");
    });

    it("allows setting lastViewMode via setter", () => {
      ctrl.lastViewMode = "iconography";
      expect(ctrl.lastViewMode).toBe("iconography");
    });
  });

  describe("setViewMode", () => {
    it("is no-op for same mode when not forced", () => {
      ctrl.setViewMode("forecast");
      expect(deps.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("applies same mode when forced", () => {
      ctrl.setViewMode("forecast", true);
      // prev is 'forecast' so no deactivation, just re-mount
      expect(deps.mountForecast).toHaveBeenCalledTimes(1);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
    });

    it("switching to iconography activates iconography", () => {
      ctrl.setViewMode("iconography");
      expect(ctrl.viewMode).toBe("iconography");
      expect(deps.activateIconography).toHaveBeenCalledTimes(1);
      expect(deps.mountForecast).not.toHaveBeenCalled();
    });

    it("switching from iconography deactivates and mounts forecast", () => {
      ctrl.setViewMode("iconography");
      vi.clearAllMocks();
      ctrl.setViewMode("forecast");
      expect(deps.deactivateIconography).toHaveBeenCalledTimes(1);
      expect(deps.mountForecast).toHaveBeenCalledTimes(1);
    });

    it("always syncs inhouse timeline when mode changes", () => {
      ctrl.setViewMode("iconography");
      expect(deps.syncInhouseTimeToTimeline).toHaveBeenCalledTimes(1);
    });

    it("updates lastViewMode when not in dev debug route", () => {
      ctrl.setViewMode("iconography");
      expect(ctrl.lastViewMode).toBe("iconography");
    });

    it("does not update lastViewMode on dev debug route", () => {
      const h = makeDeps({ isDev: true, isDebugRoute: vi.fn(() => true) });
      const c = new LayerGroupController(h.deps);
      c.setViewMode("iconography");
      expect(c.lastViewMode).toBe("forecast");
    });

    it("updates lastViewMode in dev when route is not debug", () => {
      const h = makeDeps({ isDev: true, isDebugRoute: vi.fn(() => false) });
      const c = new LayerGroupController(h.deps);
      c.setViewMode("iconography");
      expect(c.lastViewMode).toBe("iconography");
    });

    it("syncs mode UI on changes", () => {
      const spy = vi.spyOn(ctrl, "syncViewModeUi");
      ctrl.setViewMode("iconography");
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("syncViewModeUi", () => {
    it("applies forecast classes and aria", () => {
      ctrl.setViewMode("forecast", true);
      expect(deps.dom.viewForecastBtn.classList.contains("is-active")).toBe(
        true,
      );
      expect(deps.dom.viewIconographyBtn?.classList.contains("is-active")).toBe(
        false,
      );
      expect(deps.dom.viewForecastBtn.getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(deps.dom.viewIconographyBtn?.getAttribute("aria-pressed")).toBe(
        "false",
      );
    });

    it("applies iconography classes and aria", () => {
      ctrl.setViewMode("iconography");
      expect(document.body.classList.contains("view-iconography")).toBe(true);
      expect(deps.dom.viewForecastBtn.classList.contains("is-active")).toBe(
        false,
      );
      expect(deps.dom.viewIconographyBtn?.classList.contains("is-active")).toBe(
        true,
      );
      expect(deps.dom.viewForecastBtn.getAttribute("aria-pressed")).toBe(
        "false",
      );
      expect(deps.dom.viewIconographyBtn?.getAttribute("aria-pressed")).toBe(
        "true",
      );
    });
  });

  describe("renderLayerGroupList", () => {
    it("clears previous content and detaches wind slot", () => {
      deps.dom.layerGroupList.innerHTML = '<div class="old">x</div>';
      ctrl.renderLayerGroupList();
      expect(deps.dom.layerGroupList.querySelector(".old")).toBeNull();
      expect(deps.detachWindSlot).toHaveBeenCalledTimes(1);
    });

    it("creates one button per LAYER_GROUPS entry", () => {
      ctrl.renderLayerGroupList();
      const buttons =
        deps.dom.layerGroupList.querySelectorAll("button.layer-slot");
      expect(buttons.length).toBe(LAYER_GROUPS.length);
    });

    it("sets data-layer-mode from group id on each button", () => {
      ctrl.renderLayerGroupList();
      LAYER_GROUPS.forEach((group) => {
        const btn = deps.dom.layerGroupList.querySelector(
          `button[data-layer-mode="${group.id}"]`,
        ) as HTMLButtonElement | null;
        expect(btn).not.toBeNull();
        expect(btn?.dataset.layerMode).toBe(group.id);
      });
    });

    it("marks uiState layer as aria-pressed", () => {
      uiState.layerMode = "precip";
      ctrl.renderLayerGroupList();
      const pressed = Array.from(
        deps.dom.layerGroupList.querySelectorAll("button[data-layer-mode]"),
      ).find((el) => el.getAttribute("aria-pressed") === "true") as
        | HTMLButtonElement
        | undefined;
      expect(pressed?.dataset.layerMode).toBe("precip");
    });

    it("adds wind-specific class, badge and flyout", () => {
      ctrl.renderLayerGroupList();
      const windBtn = deps.dom.layerGroupList.querySelector(
        "button.layer-slot--wind",
      ) as HTMLButtonElement | null;
      expect(windBtn).not.toBeNull();
      expect(windBtn?.dataset.windStyleBadge).toBe("A");
      // Flyout is a sibling of the button inside .layer-slot-wrap, not a child
      const wrap = windBtn?.closest(".layer-slot-wrap");
      const flyout = (wrap ?? windBtn)?.querySelector(
        ".wind-style-flyout",
      ) as HTMLDivElement | null;
      expect(flyout).not.toBeNull();
      expect(flyout?.getAttribute("role")).toBe("group");
      expect(flyout?.getAttribute("aria-label")).toBe("Wind");
    });

    it("calls attachWindToSlot once for wind group", () => {
      ctrl.renderLayerGroupList();
      expect(deps.attachWindToSlot).toHaveBeenCalledTimes(1);
      const [btnArg, flyoutArg] = (
        deps.attachWindToSlot as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [HTMLButtonElement, HTMLDivElement];
      expect(btnArg.classList.contains("layer-slot--wind")).toBe(true);
      expect(flyoutArg.classList.contains("wind-style-flyout")).toBe(true);
    });

    it("uses wind label formatter for wind title and data-label", () => {
      ctrl.renderLayerGroupList();
      const windBtn = deps.dom.layerGroupList.querySelector(
        "button.layer-slot--wind",
      ) as HTMLButtonElement;
      expect(windBtn.title).toBe("Wind: Arrows");
      expect(windBtn.dataset.label).toBe("Wind: Arrows");
    });

    it("uses group title for non-wind labels", () => {
      ctrl.renderLayerGroupList();
      const firstNonWind = deps.dom.layerGroupList.querySelector(
        "button:not(.layer-slot--wind)",
      ) as HTMLButtonElement;
      expect(firstNonWind.title.length).toBeGreaterThan(0);
      expect(firstNonWind.dataset.label).toBe(firstNonWind.title);
    });

    it("wires click to updateMode for non-wind button", () => {
      ctrl.renderLayerGroupList();
      const spy = vi.spyOn(ctrl, "updateMode").mockResolvedValue();
      const windBtn = deps.dom.layerGroupList.querySelector(
        'button[data-layer-mode="wind"]',
      ) as HTMLButtonElement;
      windBtn.click();
      expect(spy).not.toHaveBeenCalled();

      const tempBtn = deps.dom.layerGroupList.querySelector(
        'button[data-layer-mode="temperature"]',
      ) as HTMLButtonElement;
      tempBtn.click();
      expect(spy).toHaveBeenCalledWith("temperature");
    });

    it("shows waves button when GWES is in models list", () => {
      ctrl.renderLayerGroupList(); // default deps has ["GFS", "GWES"]
      const wavesBtn = deps.dom.layerGroupList.querySelector(
        'button[data-layer-mode="waves"]',
      );
      expect(wavesBtn).not.toBeNull();
    });

    it("hides waves button when GWES is not in models list", () => {
      const h = makeDeps({ getInhouseModels: vi.fn(() => ["GFS", "RAP"]) });
      const c = new LayerGroupController(h.deps);
      c.renderLayerGroupList();
      const wavesBtn = h.deps.dom.layerGroupList.querySelector(
        'button[data-layer-mode="waves"]',
      );
      expect(wavesBtn).toBeNull();
    });

    it("renders one fewer button when GWES absent", () => {
      const h = makeDeps({ getInhouseModels: vi.fn(() => ["GFS"]) });
      const c = new LayerGroupController(h.deps);
      c.renderLayerGroupList();
      const buttons = h.deps.dom.layerGroupList.querySelectorAll(
        "button.layer-slot",
      );
      expect(buttons.length).toBe(LAYER_GROUPS.length - 1);
    });
  });

  describe("getLayerSlotButtons / getSelectedLayerMode", () => {
    it("returns all layer-mode buttons from list", () => {
      ctrl.renderLayerGroupList();
      expect(ctrl.getLayerSlotButtons()).toHaveLength(LAYER_GROUPS.length);
    });

    it("returns current uiState layerMode", () => {
      ctrl.renderLayerGroupList();
      uiState.layerMode = "waves";
      expect(ctrl.getSelectedLayerMode()).toBe("waves");
    });

    it("falls back to defaultLayerMode when uiState has no layerMode", () => {
      ctrl.renderLayerGroupList();
      expect(ctrl.getSelectedLayerMode()).toBe("temperature");
    });

    it("falls back to defaultLayerMode when there are no buttons", () => {
      document.body.innerHTML = "";
      expect(ctrl.getSelectedLayerMode()).toBe("temperature");
    });
  });

  describe("syncGridToggleButton", () => {
    it("delegates to syncGridToggleButtonState with current showGrid=false", () => {
      uiState.showGrid = false;
      ctrl.syncGridToggleButton();
      expect(mockSyncGridToggleButtonState).toHaveBeenCalledWith(
        deps.dom.gridToggleButton,
        false,
      );
    });

    it("delegates to syncGridToggleButtonState with current showGrid=true", () => {
      uiState.showGrid = true;
      ctrl.syncGridToggleButton();
      expect(mockSyncGridToggleButtonState).toHaveBeenCalledWith(
        deps.dom.gridToggleButton,
        true,
      );
    });
  });

  describe("updateMode", () => {
    it("passes current state into resolveSelectionChange", async () => {
      uiState.layerMode = "temperature";
      await ctrl.updateMode("wind");
      expect(mockResolveSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "layerChange",
          fromModel: "GFS",
          fromLayer: "temperature",
          toLayer: "wind",
          defaults: {
            defaultModelForNonWaves: "GFS",
            defaultLayer: "temperature",
          },
        }),
      );
    });

    it("updates uiState layer mode from resolved layer", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "precip",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(uiState.layerMode).toBe("precip");
    });

    it("loads analyses when resolved model switches", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "RAP",
        layer: "wind",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.loadInhouseAnalyses).toHaveBeenCalledWith("RAP");
    });

    it("does not load analyses when model does not switch", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.loadInhouseAnalyses).not.toHaveBeenCalledWith("RAP");
    });

    it("uses first non-GWES model as defaultModelForNonWaves when GFS absent", async () => {
      const h = makeDeps({ getInhouseModels: vi.fn(() => ["RAP", "GWES"]) });
      const c = new LayerGroupController(h.deps);
      mockResolveSelectionChange.mockReturnValue({
        model: "RAP",
        layer: "temperature",
        appliedException: "LEAVE_GWES_BY_LAYER",
      });
      await c.updateMode("temperature");
      expect(mockResolveSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaults: expect.objectContaining({ defaultModelForNonWaves: "RAP" }),
        }),
      );
    });

    it("switching to waves eases map to default view", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.easeToMap).toHaveBeenCalledWith({
        center: DEFAULT_VIEW.center,
        zoom: DEFAULT_VIEW.zoom,
        duration: 800,
      });
    });

    it("applies LEAVE_GWES_BY_LAYER exception map easing for non-waves", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: "LEAVE_GWES_BY_LAYER",
      });
      await ctrl.updateMode("wind");
      expect(deps.easeToMap).toHaveBeenCalledWith({
        center: DEFAULT_VIEW.center,
        zoom: DEFAULT_VIEW.zoom,
        duration: 800,
      });
    });

    it("schedules persist and syncs wind controls", async () => {
      await ctrl.updateMode("wind");
      expect(deps.schedulePersistState).toHaveBeenCalledTimes(1);
      expect(deps.syncWindControls).toHaveBeenCalledTimes(1);
    });

    it("sets legend visibility for temperature", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "temperature",
        appliedException: null,
      });
      await ctrl.updateMode("temperature");
      expect(deps.dom.legendHost.style.display).toBe("block");
      expect(deps.dom.windLegendHost.style.display).toBe("none");
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
    });

    it("sets legend visibility for wind", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.dom.legendHost.style.display).toBe("none");
      expect(deps.dom.windLegendHost.style.display).toBe("block");
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
    });

    it("sets legend visibility for precip", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "precip",
        appliedException: null,
      });
      await ctrl.updateMode("precip");
      expect(deps.dom.legendHost.style.display).toBe("none");
      expect(deps.dom.windLegendHost.style.display).toBe("none");
      expect(deps.dom.precipLegendHost.style.display).toBe("block");
    });

    it("sets legend visibility for waves", async () => {
      // The waves path defers syncTooltipAndLegendForMode via rAF; run it synchronously here.
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) => {
          cb(0);
          return 1;
        },
      );
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.dom.waveLegendHost.style.display).toBe("block");
      expect(deps.dom.legendHost.style.display).toBe("none");
      expect(deps.dom.windLegendHost.style.display).toBe("none");
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
    });

    it("sets legend visibility for snow", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "snow",
        appliedException: null,
      });
      await ctrl.updateMode("snow");
      expect(deps.dom.legendHost.style.display).toBe("none");
      expect(deps.dom.windLegendHost.style.display).toBe("none");
      expect(deps.dom.precipLegendHost.style.display).toBe("none");
      expect(deps.dom.snowDepthLegendHost.style.display).toBe("block");
    });

    it("on waves saves non-waves selection for non-GWES model", async () => {
      setSelectedModel("GFS");
      setSelectedAnalysis("2026-05-01_06");
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.saveNonWavesSelection).toHaveBeenCalledWith(
        "GFS",
        "2026-05-01_06",
      );
    });

    it("on waves does not save when already on GWES model", async () => {
      setSelectedModel("GWES");
      mockResolveSelectionChange.mockReturnValue({
        model: "GWES",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.saveNonWavesSelection).not.toHaveBeenCalled();
    });

    it("on waves loads GWES analyses when GWES exists and current model is not GWES", async () => {
      setSelectedModel("GFS");
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.loadInhouseAnalyses).toHaveBeenCalledWith("GWES");
    });

    it("on waves does not load GWES analyses when GWES not in model list", async () => {
      const h = makeDeps({ getInhouseModels: vi.fn(() => ["GFS", "RAP"]) });
      const c = new LayerGroupController(h.deps);
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await c.updateMode("waves");
      expect(h.deps.loadInhouseAnalyses).not.toHaveBeenCalledWith("GWES");
    });

    it("on waves ensures waves layers", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });
      await ctrl.updateMode("waves");
      expect(deps.ensureInhouseGroupLayers).toHaveBeenCalledWith("waves");
    });

    it("on non-waves restores saved selection when currently on GWES", async () => {
      setSelectedModel("GWES");
      (
        deps.restoreNonWavesSelection as ReturnType<typeof vi.fn>
      ).mockReturnValue({ model: "GFS", analysis: "2026-02-01_00" });
      mockResolveSelectionChange.mockReturnValue({
        model: "GWES",
        layer: "temperature",
        appliedException: null,
      });
      await ctrl.updateMode("temperature");
      expect(deps.loadInhouseAnalyses).toHaveBeenCalledWith("GFS");
    });

    it("on non-waves does not restore when no saved selection", async () => {
      setSelectedModel("GWES");
      (
        deps.restoreNonWavesSelection as ReturnType<typeof vi.fn>
      ).mockReturnValue(null);
      mockResolveSelectionChange.mockReturnValue({
        model: "GWES",
        layer: "wind",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.loadInhouseAnalyses).not.toHaveBeenCalledWith("GFS");
    });

    it("on non-waves ensures resolved non-waves layers", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "precip",
        appliedException: null,
      });
      await ctrl.updateMode("precip");
      expect(deps.ensureInhouseGroupLayers).toHaveBeenCalledWith("precip");
    });

    it("does not restore saved non-waves selection when leaving GWES by layer", async () => {
      setSelectedModel("GWES");
      (
        deps.restoreNonWavesSelection as ReturnType<typeof vi.fn>
      ).mockReturnValue({ model: "UWC-IG", analysis: "2026-02-01_00" });
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "temperature",
        appliedException: "LEAVE_GWES_BY_LAYER",
      });

      await ctrl.updateMode("temperature");

      expect(deps.loadInhouseAnalyses).toHaveBeenCalledWith("GFS");
      expect(deps.loadInhouseAnalyses).not.toHaveBeenCalledWith("UWC-IG");
    });

    it("marks grid labels dirty and schedules label render", async () => {
      await ctrl.updateMode("wind");
      expect(deps.setGridLabelsDirty).toHaveBeenCalledTimes(1);
      expect(deps.scheduleLabelRender).toHaveBeenCalledTimes(1);
    });

    it("updates timeline and legend sync using resolved mode", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "precip",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.updateTimelineControlForMode).toHaveBeenCalledWith("precip");
      expect(deps.syncLegendForMode).toHaveBeenCalledWith("precip");
    });

    it("configures tooltip for wind with fallback metric unit when no wind unit format", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });
      await ctrl.updateMode("wind");
      expect(deps.setTooltipConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          unitFormat: { system: "metric", unit: "m/s", decimals: 1 },
          directionFormat: "cardinal3",
        }),
      );
    });

    it("configures tooltip for wind with provided wind unit format", async () => {
      const windFormat = {
        system: "metric",
        unit: "kt",
        decimals: 0,
      } as unknown as WeatherLayers.UnitFormat;
      const h = makeDeps({ getWindUnitFormat: vi.fn(() => windFormat) });
      const c = new LayerGroupController(h.deps);
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });
      await c.updateMode("wind");
      expect(h.deps.setTooltipConfig).toHaveBeenCalledWith(
        expect.objectContaining({ unitFormat: windFormat }),
      );
    });

    it("configures tooltip for temperature with value direction format", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "temperature",
        appliedException: null,
      });
      await ctrl.updateMode("temperature");
      expect(deps.setTooltipConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          unitFormat: { system: "metric", unit: "", decimals: 0 },
          directionFormat: "value",
        }),
      );
    });

    it("configures tooltip for precip with cardinal direction format", async () => {
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "precip",
        appliedException: null,
      });
      await ctrl.updateMode("precip");
      expect(deps.setTooltipConfig).toHaveBeenCalledWith(
        expect.objectContaining({ directionFormat: "cardinal3" }),
      );
    });

    it("skips tooltip config when tooltip control is absent", async () => {
      const h = makeDeps({ hasTooltipControl: vi.fn(() => false) });
      const c = new LayerGroupController(h.deps);
      await c.updateMode("wind");
      expect(h.deps.setTooltipConfig).not.toHaveBeenCalled();
    });

    it("schedules layer updates at end of mode update", async () => {
      await ctrl.updateMode("wind");
      expect(deps.scheduleUpdateLayers).toHaveBeenCalledTimes(1);
    });

    it("restores previous view via rAF + 0ms + 50ms when not switching to/from waves", async () => {
      uiState.layerMode = "temperature";
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });
      const rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb: FrameRequestCallback) => {
          cb(0);
          return 1;
        });
      const timeoutSpy = vi.spyOn(window, "setTimeout").mockImplementation(((
        handler: TimerHandler,
        _timeout?: number,
      ) => {
        if (typeof handler === "function") handler();
        return 1 as unknown as number;
      }) as typeof window.setTimeout);

      await ctrl.updateMode("wind");

      expect(rafSpy).toHaveBeenCalledTimes(1);
      expect(timeoutSpy).toHaveBeenCalledTimes(2);
      expect(timeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 0);
      expect(timeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 50);
      expect(deps.resizeMap).toHaveBeenCalledTimes(3);
      expect(deps.jumpToMap).toHaveBeenCalledTimes(3);
      expect(deps.jumpToMap).toHaveBeenLastCalledWith(
        expect.objectContaining({ center: { lng: -20, lat: 55 }, zoom: 4 }),
      );
    });

    it("resizes once and skips view restore when switching to waves", async () => {
      uiState.layerMode = "temperature";
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "waves",
        appliedException: null,
      });

      await ctrl.updateMode("waves");

      // rAF is used to defer legend sync (not for view restore), so only resizeMap fires once
      // and jumpToMap is never called on this path.
      expect(deps.resizeMap).toHaveBeenCalledTimes(1);
      expect(deps.jumpToMap).not.toHaveBeenCalled();
    });

    it("resizes once and skips view restore when previous mode is waves", async () => {
      uiState.layerMode = "waves";
      mockResolveSelectionChange.mockReturnValue({
        model: "GFS",
        layer: "wind",
        appliedException: null,
      });

      await ctrl.updateMode("wind");

      // rAF is used to defer legend sync (not for view restore), so only resizeMap fires once.
      expect(deps.resizeMap).toHaveBeenCalledTimes(1);
    });
  });
});
