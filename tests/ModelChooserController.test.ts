import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ModelChooserController,
  type ModelChooserControllerDeps,
} from "../src/controllers/ModelChooserController";

function makeRect(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height: 34,
    top: 0,
    right: width,
    bottom: 34,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeDeps(
  overrides: Partial<ModelChooserControllerDeps> = {},
): ModelChooserControllerDeps {
  const barEl = document.createElement("div") as HTMLDivElement;
  const panelEl = document.createElement("div") as HTMLDivElement;
  const modelCard = document.createElement("div");
  modelCard.className = "model-card";
  modelCard.appendChild(barEl);
  modelCard.appendChild(panelEl);
  document.body.appendChild(modelCard);

  return {
    dom: {
      barEl,
      panelEl,
      pillBtn: null,
      popoverEl: null,
      pillNameEl: null,
      pillMetaEl: null,
    },
    getViewMode: () => "forecast",
    getModels: () => ["gfs-1", "harmonie-2", "icon-3"],
    getSelectedModel: () => "gfs-1",
    getModelResolutionMeters: (model: string) => {
      if (model === "gfs-1") return 25000;
      if (model === "harmonie-2") return 2500;
      if (model === "icon-3") return 500;
      return null;
    },
    onModelSelect: vi.fn(),
    ...overrides,
  };
}

describe("ModelChooserController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  describe("formatResolutionLabel", () => {
    it("returns km for resolutions >= 1000 that are multiples of 1000", () => {
      const ctrl = new ModelChooserController(makeDeps());
      expect(ctrl.formatResolutionLabel("gfs-1")).toBe("25km");
    });

    it("returns meters for sub-km resolutions", () => {
      const ctrl = new ModelChooserController(makeDeps());
      expect(ctrl.formatResolutionLabel("icon-3")).toBe("500m");
    });

    it("returns meters for non-multiples of 1000", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModelResolutionMeters: () => 2500,
        }),
      );
      expect(ctrl.formatResolutionLabel("harmonie-2")).toBe("2.5km");
    });

    it("returns empty string for unknown models", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModelResolutionMeters: () => null,
        }),
      );
      expect(ctrl.formatResolutionLabel("unknown")).toBe("");
    });

    it("returns empty string for zero resolution", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModelResolutionMeters: () => 0,
        }),
      );
      expect(ctrl.formatResolutionLabel("test")).toBe("");
    });
  });

  describe("getCollapsedSlots", () => {
    it("returns up to 3 visible models with selected model first", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["gfs-1", "harmonie-2", "icon-3", "extra-4"],
          getSelectedModel: () => "harmonie-2",
        }),
      );
      const result = ctrl.getCollapsedSlots();
      expect(result.visible).toEqual(["harmonie-2", "gfs-1", "icon-3"]);
      expect(result.remaining).toBe(1);
    });

    it("returns all models when <= 3", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["gfs-1", "harmonie-2"],
          getSelectedModel: () => "gfs-1",
        }),
      );
      const result = ctrl.getCollapsedSlots();
      expect(result.visible).toEqual(["gfs-1", "harmonie-2"]);
      expect(result.remaining).toBe(0);
    });

    it("returns empty when no models", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => [],
        }),
      );
      const result = ctrl.getCollapsedSlots();
      expect(result.visible).toEqual([]);
      expect(result.remaining).toBe(0);
    });

    it("handles selected model not in list", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b", "c", "d"],
          getSelectedModel: () => "missing",
        }),
      );
      const result = ctrl.getCollapsedSlots();
      expect(result.visible).toEqual(["a", "b", "c"]);
      expect(result.remaining).toBe(1);
    });

    it("handles exactly 3 models", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b", "c"],
          getSelectedModel: () => "a",
        }),
      );
      const result = ctrl.getCollapsedSlots();
      expect(result.visible).toEqual(["a", "b", "c"]);
      expect(result.remaining).toBe(0);
    });
  });

  describe("selectModel", () => {
    it("calls onModelSelect for a new model", () => {
      const onModelSelect = vi.fn();
      const ctrl = new ModelChooserController(makeDeps({ onModelSelect }));
      ctrl.selectModel("harmonie-2");
      expect(onModelSelect).toHaveBeenCalledWith("harmonie-2");
    });

    it("does not call onModelSelect when selecting the current model", () => {
      const onModelSelect = vi.fn();
      const ctrl = new ModelChooserController(
        makeDeps({
          getSelectedModel: () => "gfs-1",
          onModelSelect,
        }),
      );
      ctrl.selectModel("gfs-1");
      expect(onModelSelect).not.toHaveBeenCalled();
    });

    it("does not call onModelSelect for empty string", () => {
      const onModelSelect = vi.fn();
      const ctrl = new ModelChooserController(makeDeps({ onModelSelect }));
      ctrl.selectModel("");
      expect(onModelSelect).not.toHaveBeenCalled();
    });

    it("collapses the panel after selection", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.selectModel("harmonie-2");
      expect(ctrl.isExpanded).toBe(false);
    });
  });

  describe("render", () => {
    it("creates buttons for visible models in bar", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.render();
      const barButtons =
        ctrl["deps"].dom.barEl!.querySelectorAll(".model-slot");
      expect(barButtons.length).toBe(3);
    });

    it("marks selected model as active", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getSelectedModel: () => "harmonie-2",
        }),
      );
      ctrl.render();
      const activeButtons = ctrl["deps"].dom.barEl!.querySelectorAll(
        ".model-slot--active",
      );
      expect(activeButtons.length).toBe(1);
      expect(
        activeButtons[0].querySelector(".model-slot__name")!.textContent,
      ).toBe("harmonie-2");
    });

    it('shows "more" button when models exceed 3', () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b", "c", "d", "e"],
          getSelectedModel: () => "a",
        }),
      );
      ctrl.render();
      const moreBtn =
        ctrl["deps"].dom.barEl!.querySelector(".model-slot--more");
      expect(moreBtn).not.toBeNull();
      expect(moreBtn!.textContent).toContain("2 more");
    });

    it('does not show "more" button when models <= 3', () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b"],
          getSelectedModel: () => "a",
        }),
      );
      ctrl.render();
      const moreBtn =
        ctrl["deps"].dom.barEl!.querySelector(".model-slot--more");
      expect(moreBtn).toBeNull();
    });

    it("populates panel with all models", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b", "c", "d"],
          getSelectedModel: () => "a",
        }),
      );
      ctrl.render();
      const panelButtons =
        ctrl["deps"].dom.panelEl!.querySelectorAll(".model-slot");
      expect(panelButtons.length).toBe(4);
    });

    it("hides panel when not expanded", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.render();
      expect(ctrl["deps"].dom.panelEl!.hidden).toBe(true);
    });

    it("hides model card outside forecast and iconography modes", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getViewMode: () => "unknown",
        }),
      );
      ctrl.render();
      const modelCard = ctrl["deps"].dom.barEl!.closest(
        ".model-card",
      ) as HTMLElement;
      expect(modelCard.hidden).toBe(true);
      expect(modelCard.style.display).toBe("");
    });

    it("hides model card when no models", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => [],
        }),
      );
      ctrl.render();
      const modelCard = ctrl["deps"].dom.barEl!.closest(
        ".model-card",
      ) as HTMLElement;
      expect(modelCard.hidden).toBe(true);
      expect(modelCard.style.display).toBe("");
    });

    it("shows model card without writing inline display styles", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.render();
      const modelCard = ctrl["deps"].dom.barEl!.closest(
        ".model-card",
      ) as HTMLElement;
      expect(modelCard.hidden).toBe(false);
      expect(modelCard.style.display).toBe("");
    });

    it("keeps model card hidden until a real width is measurable", () => {
      const ctrl = new ModelChooserController(makeDeps());
      const modelCard = ctrl["deps"].dom.barEl!.closest(
        ".model-card",
      ) as HTMLElement;
      const frameQueue: FrameRequestCallback[] = [];
      let rafId = 0;
      let measuredWidth = 6;

      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frameQueue.push(callback);
          rafId += 1;
          return rafId;
        },
      );
      vi.stubGlobal("cancelAnimationFrame", vi.fn());

      ctrl["deps"].dom.barEl!.getBoundingClientRect = () =>
        makeRect(measuredWidth);
      modelCard.getBoundingClientRect = () => makeRect(measuredWidth);

      ctrl.render();
      expect(modelCard.hidden).toBe(false);
      expect(modelCard.dataset.renderState).toBe("staging");
      expect(modelCard.style.visibility).toBe("hidden");
      expect(modelCard.style.opacity).toBe("0");
      expect(modelCard.style.pointerEvents).toBe("none");

      const runNextFrame = () => {
        const callback = frameQueue.shift();
        expect(callback).toBeTypeOf("function");
        callback!(0);
      };

      runNextFrame();
      expect(modelCard.dataset.renderState).toBe("staging");

      measuredWidth = 248;
      runNextFrame();
      expect(modelCard.dataset.renderState).toBe("staging");
      expect(modelCard.style.pointerEvents).toBe("none");

      runNextFrame();
      expect(modelCard.dataset.renderState).toBeUndefined();
      expect(modelCard.style.visibility).toBe("");
      expect(modelCard.style.opacity).toBe("");
      expect(modelCard.style.pointerEvents).toBe("");
    });

    it("shows resolution labels in buttons", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["gfs-1"],
          getSelectedModel: () => "gfs-1",
        }),
      );
      ctrl.render();
      const meta = ctrl["deps"].dom.barEl!.querySelector(".model-slot__meta");
      expect(meta).not.toBeNull();
      expect(meta!.textContent).toBe("25km");
    });

    it("toggles expanded state via more button click", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["a", "b", "c", "d"],
          getSelectedModel: () => "a",
        }),
      );
      ctrl.render();
      expect(ctrl.isExpanded).toBe(false);
      const moreBtn = ctrl["deps"].dom.barEl!.querySelector(
        ".model-slot--more",
      ) as HTMLButtonElement;
      moreBtn.click();
      expect(ctrl.isExpanded).toBe(true);
    });

    it("returns early when barEl is null", () => {
      const ctrl = new ModelChooserController(
        makeDeps({
          dom: {
            barEl: null,
            panelEl: null,
            pillBtn: null,
            popoverEl: null,
            pillNameEl: null,
            pillMetaEl: null,
          },
        }),
      );
      ctrl.render();
    });

    it("selects model on bar button click", () => {
      const onModelSelect = vi.fn();
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["gfs-1", "harmonie-2"],
          getSelectedModel: () => "gfs-1",
          onModelSelect,
        }),
      );
      ctrl.render();
      const buttons = ctrl["deps"].dom.barEl!.querySelectorAll(
        ".model-slot:not(.model-slot--more)",
      );
      (buttons[1] as HTMLButtonElement).click();
      expect(onModelSelect).toHaveBeenCalledWith("harmonie-2");
    });

    it("selects model on panel button click", () => {
      const onModelSelect = vi.fn();
      const ctrl = new ModelChooserController(
        makeDeps({
          getModels: () => ["gfs-1", "harmonie-2"],
          getSelectedModel: () => "gfs-1",
          onModelSelect,
        }),
      );
      ctrl.render();
      const panelButtons =
        ctrl["deps"].dom.panelEl!.querySelectorAll(".model-slot");
      (panelButtons[1] as HTMLButtonElement).click();
      expect(onModelSelect).toHaveBeenCalledWith("harmonie-2");
    });
  });

  describe("handleOutsideClick", () => {
    it("closes panel on click outside", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.render();
      const moreBtn =
        ctrl["deps"].dom.barEl!.querySelector(".model-slot--more");
      if (moreBtn) (moreBtn as HTMLButtonElement).click();
      ctrl["expanded"] = true;
      expect(ctrl.isExpanded).toBe(true);
      ctrl.handleOutsideClick(document.body);
      expect(ctrl.isExpanded).toBe(false);
    });

    it("does not close panel on click inside barEl", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl["expanded"] = true;
      ctrl.handleOutsideClick(ctrl["deps"].dom.barEl!);
      expect(ctrl.isExpanded).toBe(true);
    });

    it("does not close panel on click inside panelEl", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl["expanded"] = true;
      ctrl.handleOutsideClick(ctrl["deps"].dom.panelEl!);
      expect(ctrl.isExpanded).toBe(true);
    });

    it("does nothing when not expanded", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.handleOutsideClick(document.body);
      expect(ctrl.isExpanded).toBe(false);
    });
  });

  describe("handleEscapeKey", () => {
    it("closes panel on Escape", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl["expanded"] = true;
      ctrl.handleEscapeKey(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(ctrl.isExpanded).toBe(false);
    });

    it("ignores non-Escape keys", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl["expanded"] = true;
      ctrl.handleEscapeKey(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(ctrl.isExpanded).toBe(true);
    });

    it("does nothing when not expanded", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.handleEscapeKey(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(ctrl.isExpanded).toBe(false);
    });
  });

  describe("lastNonWavesModel/Analysis", () => {
    it("saves and restores non-waves selection", () => {
      const ctrl = new ModelChooserController(makeDeps());
      expect(ctrl.restoreNonWavesSelection()).toBeNull();
      ctrl.saveNonWavesSelection("harmonie-2", "2026-03-19_00");
      const saved = ctrl.restoreNonWavesSelection();
      expect(saved).toEqual({ model: "harmonie-2", analysis: "2026-03-19_00" });
    });

    it("returns null when no selection saved", () => {
      const ctrl = new ModelChooserController(makeDeps());
      expect(ctrl.restoreNonWavesSelection()).toBeNull();
    });

    it("exposes lastNonWavesModel and lastNonWavesAnalysis getters", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl.saveNonWavesSelection("icon-3", "2026-03-18_12");
      expect(ctrl.lastNonWavesModel).toBe("icon-3");
      expect(ctrl.lastNonWavesAnalysis).toBe("2026-03-18_12");
    });
  });

  describe("destroy", () => {
    it("collapses the panel", () => {
      const ctrl = new ModelChooserController(makeDeps());
      ctrl["expanded"] = true;
      ctrl.destroy();
      expect(ctrl.isExpanded).toBe(false);
    });
  });
});
