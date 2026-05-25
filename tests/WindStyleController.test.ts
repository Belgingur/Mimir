import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WindStyleController,
  WindStyleDomRefs,
  WindStyleControllerDeps,
} from "../src/controllers/WindStyleController";

function makeEl<T extends HTMLElement>(
  tag: string,
  overrides: Record<string, unknown> = {},
): T {
  const el = document.createElement(tag) as T;
  Object.assign(el, overrides);
  return el;
}

function makeDom(): WindStyleDomRefs {
  return {
    warningEl: makeEl<HTMLDivElement>("div"),
    particlesAdvanced: makeEl<HTMLDivElement>("div"),
    particlesCountInput: (() => {
      const inp = makeEl<HTMLInputElement>("input");
      inp.type = "text";
      inp.value = "900";
      return inp;
    })(),
    particlesCountValue: makeEl<HTMLDivElement>("div"),
    particlesAgeInput: (() => {
      const inp = makeEl<HTMLInputElement>("input");
      inp.type = "text";
      inp.value = "10";
      return inp;
    })(),
    particlesAgeValue: makeEl<HTMLDivElement>("div"),
    particlesSpeedInput: (() => {
      const inp = makeEl<HTMLInputElement>("input");
      inp.type = "text";
      inp.value = "20";
      return inp;
    })(),
    particlesSpeedValue: makeEl<HTMLDivElement>("div"),
  };
}

function makeDeps(
  overrides: Partial<WindStyleControllerDeps> = {},
): WindStyleControllerDeps {
  return {
    dom: makeDom(),
    supportsWindParticlesPlatform: true,
    isFirefox: false,
    isDev: false,
    getLayerMode: () => "wind",
    scheduleUpdateLayers: vi.fn(),
    onSlotClick: vi.fn(),
    ...overrides,
  };
}

function makeFlyout(): { slotEl: HTMLButtonElement; flyoutEl: HTMLDivElement } {
  const slotEl = document.createElement("button");
  const flyoutEl = document.createElement("div");
  (["arrows", "particles", "streamlines"] as const).forEach((style) => {
    const btn = document.createElement("button");
    btn.dataset.windStyle = style;
    btn.classList.add("wind-style-flyout__option");
    flyoutEl.appendChild(btn);
  });
  return { slotEl, flyoutEl };
}

describe("WindStyleController", () => {
  let deps: WindStyleControllerDeps;
  let controller: WindStyleController;

  beforeEach(() => {
    deps = makeDeps();
    controller = new WindStyleController(deps);
  });

  describe("initial state", () => {
    it("starts with arrows style", () => {
      expect(controller.style).toBe("arrows");
    });

    it("starts with no wind_uv_10m", () => {
      expect(controller.hasWindUv10m).toBe(false);
    });

    it("starts runtime available", () => {
      expect(controller.runtimeAvailable).toBe(true);
    });

    it("starts with default particle params", () => {
      expect(controller.numParticles).toBe(900);
      expect(controller.maxAge).toBe(10);
      expect(controller.speedFactor).toBe(20);
    });

    it("starts with flyout closed", () => {
      expect(controller.isFlyoutOpen).toBe(false);
    });
  });

  describe("formatLabel", () => {
    it('returns "Arrows" for arrows', () => {
      expect(controller.formatLabel("arrows")).toBe("Arrows");
    });

    it('returns "Particles" for particles', () => {
      expect(controller.formatLabel("particles")).toBe("Particles");
    });

    it('returns "Streamlines" for streamlines', () => {
      expect(controller.formatLabel("streamlines")).toBe("Streamlines");
    });

    it("uses current style when no argument", () => {
      controller.setStyle("streamlines");
      expect(controller.formatLabel()).toBe("Streamlines");
    });
  });

  describe("getBadge", () => {
    it('returns "A" for arrows', () => {
      expect(controller.getBadge("arrows")).toBe("A");
    });

    it('returns "P" for particles', () => {
      expect(controller.getBadge("particles")).toBe("P");
    });

    it('returns "S" for streamlines', () => {
      expect(controller.getBadge("streamlines")).toBe("S");
    });

    it("uses current style when no argument", () => {
      controller.setStyle("particles");
      expect(controller.getBadge()).toBe("P");
    });
  });

  describe("setStyle", () => {
    it("directly changes style without validation", () => {
      controller.setStyle("particles");
      expect(controller.style).toBe("particles");
    });
  });

  describe("selectStyle", () => {
    it("selects arrows style (always available)", () => {
      controller.selectStyle("arrows");
      expect(controller.style).toBe("arrows");
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("rejects particles when no wind_uv_10m", () => {
      controller.selectStyle("particles");
      expect(controller.style).toBe("arrows");
      expect(deps.dom.warningEl!.textContent).toContain("wind_uv_10m");
      expect(deps.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("rejects streamlines when no wind_uv_10m", () => {
      controller.selectStyle("streamlines");
      expect(controller.style).toBe("arrows");
      expect(deps.dom.warningEl!.textContent).toContain("wind_uv_10m");
    });

    it("allows particles when wind_uv_10m is available", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.selectStyle("particles");
      expect(controller.style).toBe("particles");
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("allows streamlines when wind_uv_10m is available", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.selectStyle("streamlines");
      expect(controller.style).toBe("streamlines");
    });

    it("rejects particles when platform unsupported", () => {
      const d = makeDeps({ supportsWindParticlesPlatform: false });
      const ctrl = new WindStyleController(d);
      ctrl.updateAvailability(["wind_uv_10m"]);
      ctrl.selectStyle("particles");
      expect(ctrl.style).toBe("arrows");
      expect(d.dom.warningEl!.textContent).toContain("WebGL2");
    });

    it("shows Firefox-specific message when isFirefox", () => {
      const d = makeDeps({
        supportsWindParticlesPlatform: false,
        isFirefox: true,
      });
      const ctrl = new WindStyleController(d);
      ctrl.updateAvailability(["wind_uv_10m"]);
      ctrl.selectStyle("particles");
      expect(d.dom.warningEl!.textContent).toContain("Firefox");
    });

    it("rejects particles when runtime unavailable", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.handleParticleFailure(new Error("test"));
      (deps.scheduleUpdateLayers as ReturnType<typeof vi.fn>).mockClear();
      controller.selectStyle("particles");
      expect(controller.style).toBe("arrows");
      expect(deps.dom.warningEl!.textContent).toContain("unavailable");
      expect(deps.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("clears warning on successful selection", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      deps.dom.warningEl!.textContent = "some old warning";
      controller.selectStyle("streamlines");
      expect(deps.dom.warningEl!.textContent).toBe("");
    });
  });

  describe("handleParticleFailure", () => {
    it("sets runtimeAvailable to false", () => {
      controller.handleParticleFailure();
      expect(controller.runtimeAvailable).toBe(false);
    });

    it("falls back to arrows when style is particles", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.setStyle("particles");
      controller.handleParticleFailure(new Error("test"));
      expect(controller.style).toBe("arrows");
    });

    it("does not change style if already arrows", () => {
      controller.handleParticleFailure();
      expect(controller.style).toBe("arrows");
    });

    it("does not change style if streamlines", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.setStyle("streamlines");
      controller.handleParticleFailure();
      expect(controller.style).toBe("streamlines");
    });

    it("sets warning text", () => {
      controller.handleParticleFailure();
      expect(deps.dom.warningEl!.textContent).toContain("unavailable");
    });

    it("calls scheduleUpdateLayers", () => {
      controller.handleParticleFailure();
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("logs to console.warn when error provided", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      controller.handleParticleFailure(new Error("gpu fail"));
      expect(warnSpy).toHaveBeenCalledWith(
        "Particle layer unavailable, falling back to arrows.",
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe("updateAvailability", () => {
    it("detects wind_uv_10m presence", () => {
      controller.updateAvailability(["wind_uv_10m", "temperature"]);
      expect(controller.hasWindUv10m).toBe(true);
    });

    it("detects wind_uv_10m absence", () => {
      controller.updateAvailability(["temperature"]);
      expect(controller.hasWindUv10m).toBe(false);
    });

    it("falls back to arrows when losing wind_uv_10m with particles selected", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      controller.setStyle("particles");
      controller.updateAvailability(["temperature"]);
      expect(controller.style).toBe("arrows");
    });

    it("keeps arrows when wind_uv_10m is absent", () => {
      controller.updateAvailability(["temperature"]);
      expect(controller.style).toBe("arrows");
    });
  });

  describe("setWarning", () => {
    it("sets warning text on the element", () => {
      controller.setWarning("test warning");
      expect(deps.dom.warningEl!.textContent).toBe("test warning");
    });

    it("clears warning with empty string", () => {
      controller.setWarning("some warning");
      controller.setWarning("");
      expect(deps.dom.warningEl!.textContent).toBe("");
    });

    it("clears warning with no argument", () => {
      controller.setWarning("some warning");
      controller.setWarning();
      expect(deps.dom.warningEl!.textContent).toBe("");
    });

    it("does nothing if warningEl is null", () => {
      const d = makeDeps({ dom: { ...makeDom(), warningEl: null } });
      const ctrl = new WindStyleController(d);
      expect(() => ctrl.setWarning("test")).not.toThrow();
    });
  });

  describe("syncControls", () => {
    it("updates slot label and badge when attached", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.syncControls();
      expect(slotEl.dataset.label).toBe("Wind: Arrows");
      expect(slotEl.dataset.windStyleBadge).toBe("A");
    });

    it('shows "Wind" label without style when not in wind mode', () => {
      const d = makeDeps({ getLayerMode: () => "temperature" });
      const ctrl = new WindStyleController(d);
      const { slotEl, flyoutEl } = makeFlyout();
      ctrl.attachToSlot(slotEl, flyoutEl);
      ctrl.syncControls();
      expect(slotEl.dataset.label).toBe("Wind");
    });

    it("toggles is-wind-active class based on layer mode", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.syncControls();
      expect(slotEl.classList.contains("is-wind-active")).toBe(true);

      const d2 = makeDeps({ getLayerMode: () => "temperature" });
      const ctrl2 = new WindStyleController(d2);
      ctrl2.attachToSlot(slotEl, flyoutEl);
      ctrl2.syncControls();
      expect(slotEl.classList.contains("is-wind-active")).toBe(false);
    });

    it("marks active button and disables unavailable ones", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.syncControls();

      const buttons = Array.from(flyoutEl.querySelectorAll("button"));
      const arrowsBtn = buttons.find((b) => b.dataset.windStyle === "arrows")!;
      const particlesBtn = buttons.find(
        (b) => b.dataset.windStyle === "particles",
      )!;

      expect(arrowsBtn.classList.contains("is-active")).toBe(true);
      expect(arrowsBtn.getAttribute("aria-pressed")).toBe("true");
      expect(particlesBtn.classList.contains("is-active")).toBe(false);
      expect(particlesBtn.getAttribute("aria-pressed")).toBe("false");
      expect(particlesBtn.classList.contains("is-disabled")).toBe(false);
    });

    it("disables particles button when no wind_uv_10m", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.syncControls();

      const buttons = Array.from(flyoutEl.querySelectorAll("button"));
      const particlesBtn = buttons.find(
        (b) => b.dataset.windStyle === "particles",
      )!;
      expect(particlesBtn.classList.contains("is-disabled")).toBe(true);
      expect(particlesBtn.getAttribute("aria-disabled")).toBe("true");
    });

    it("updates particle input values", () => {
      controller.syncControls();
      expect(deps.dom.particlesCountInput!.value).toBe("900");
      expect(deps.dom.particlesCountValue!.textContent).toBe("900");
      expect(deps.dom.particlesAgeInput!.value).toBe("10");
      expect(deps.dom.particlesAgeValue!.textContent).toBe("10");
      expect(deps.dom.particlesSpeedInput!.value).toBe("20");
      expect(deps.dom.particlesSpeedValue!.textContent).toBe("20.0");
    });

    it("shows particlesAdvanced in dev mode with wind+particles", () => {
      const d = makeDeps({ isDev: true });
      const ctrl = new WindStyleController(d);
      ctrl.updateAvailability(["wind_uv_10m"]);
      ctrl.setStyle("particles");
      ctrl.syncControls();
      expect(d.dom.particlesAdvanced!.style.display).toBe("grid");
    });

    it("hides particlesAdvanced when not dev", () => {
      controller.syncControls();
      expect(deps.dom.particlesAdvanced!.style.display).toBe("none");
    });

    it("hides particlesAdvanced when not in wind mode", () => {
      const d = makeDeps({ isDev: true, getLayerMode: () => "temperature" });
      const ctrl = new WindStyleController(d);
      ctrl.syncControls();
      expect(d.dom.particlesAdvanced!.style.display).toBe("none");
    });

    it("hides particlesAdvanced when style is not particles", () => {
      const d = makeDeps({ isDev: true });
      const ctrl = new WindStyleController(d);
      ctrl.updateAvailability(["wind_uv_10m"]);
      ctrl.setStyle("streamlines");
      ctrl.syncControls();
      expect(d.dom.particlesAdvanced!.style.display).toBe("none");
    });

    it("closes flyout when leaving wind mode", () => {
      const d = makeDeps({ getLayerMode: () => "wind" });
      const ctrl = new WindStyleController(d);
      const { slotEl, flyoutEl } = makeFlyout();
      ctrl.attachToSlot(slotEl, flyoutEl);
      ctrl.openFlyout(true);
      expect(ctrl.isFlyoutOpen).toBe(true);

      const d2 = makeDeps({ getLayerMode: () => "temperature" });
      const ctrl2 = new WindStyleController(d2);
      ctrl2.attachToSlot(slotEl, flyoutEl);
      ctrl2.openFlyout(true);
      expect(ctrl2.isFlyoutOpen).toBe(false);
    });
  });

  describe("particle input listeners", () => {
    it("updates numParticles on count input", () => {
      deps.dom.particlesCountInput!.value = "1200";
      deps.dom.particlesCountInput!.dispatchEvent(new Event("input"));
      expect(controller.numParticles).toBe(1200);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("updates maxAge on age input", () => {
      deps.dom.particlesAgeInput!.value = "25";
      deps.dom.particlesAgeInput!.dispatchEvent(new Event("input"));
      expect(controller.maxAge).toBe(25);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("updates speedFactor on speed input", () => {
      deps.dom.particlesSpeedInput!.value = "35";
      deps.dom.particlesSpeedInput!.dispatchEvent(new Event("input"));
      expect(controller.speedFactor).toBe(35);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("keeps previous value if input is invalid (NaN)", () => {
      deps.dom.particlesCountInput!.value = "";
      deps.dom.particlesCountInput!.dispatchEvent(new Event("input"));
      expect(controller.numParticles).toBe(900);
    });
  });

  describe("flyout open/close", () => {
    it("opens flyout immediately", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);
      expect(controller.isFlyoutOpen).toBe(true);
      expect(slotEl.classList.contains("is-wind-flyout-open")).toBe(true);
      expect(flyoutEl.classList.contains("is-open")).toBe(true);
    });

    it("closes flyout immediately", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);
      controller.closeFlyout(true);
      expect(controller.isFlyoutOpen).toBe(false);
      expect(slotEl.classList.contains("is-wind-flyout-open")).toBe(false);
      expect(flyoutEl.classList.contains("is-open")).toBe(false);
    });

    it("opens flyout with delay (timer-based)", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(false);
      expect(controller.isFlyoutOpen).toBe(false);
      vi.advanceTimersByTime(120);
      expect(controller.isFlyoutOpen).toBe(true);
      vi.useRealTimers();
    });

    it("closes flyout with delay (timer-based)", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);
      controller.closeFlyout(false);
      expect(controller.isFlyoutOpen).toBe(true);
      vi.advanceTimersByTime(120);
      expect(controller.isFlyoutOpen).toBe(false);
      vi.useRealTimers();
    });

    it("cancels open timer if close is called", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(false);
      controller.closeFlyout(true);
      vi.advanceTimersByTime(200);
      expect(controller.isFlyoutOpen).toBe(false);
      vi.useRealTimers();
    });

    it("cancels close timer if open is called", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);
      controller.closeFlyout(false);
      controller.openFlyout(true);
      vi.advanceTimersByTime(200);
      expect(controller.isFlyoutOpen).toBe(true);
      vi.useRealTimers();
    });

    it("does not open flyout when not in wind mode", () => {
      const d = makeDeps({ getLayerMode: () => "temperature" });
      const ctrl = new WindStyleController(d);
      const { slotEl, flyoutEl } = makeFlyout();
      ctrl.attachToSlot(slotEl, flyoutEl);
      ctrl.openFlyout(true);
      expect(ctrl.isFlyoutOpen).toBe(false);
    });

    it("does not open flyout when slot not attached", () => {
      controller.openFlyout(true);
      expect(controller.isFlyoutOpen).toBe(false);
    });
  });

  describe("attachToSlot", () => {
    it("wires click on flyout buttons to selectStyle", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);

      const buttons = Array.from(flyoutEl.querySelectorAll("button"));
      const streamlinesBtn = buttons.find(
        (b) => b.dataset.windStyle === "streamlines",
      )!;
      streamlinesBtn.click();
      expect(controller.style).toBe("streamlines");
    });

    it("closes flyout after button click", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);

      const buttons = Array.from(flyoutEl.querySelectorAll("button"));
      buttons[0].click();
      expect(controller.isFlyoutOpen).toBe(false);
    });

    it("selects style on click for mobile browsers", () => {
      controller.updateAvailability(["wind_uv_10m"]);
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);

      const buttons = Array.from(flyoutEl.querySelectorAll("button"));
      const particlesBtn = buttons.find(
        (b) => b.dataset.windStyle === "particles",
      )!;
      particlesBtn.click();

      expect(controller.style).toBe("particles");
    });

    it("does not open flyout on pointerenter", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      slotEl.dispatchEvent(new Event("pointerenter"));
      vi.advanceTimersByTime(200);
      expect(controller.isFlyoutOpen).toBe(false);
      vi.useRealTimers();
    });

    it("does not close flyout on pointerleave", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(true);
      slotEl.dispatchEvent(new Event("pointerleave"));
      expect(controller.isFlyoutOpen).toBe(true);
    });

    it("opens flyout on click when wind mode", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      slotEl.click();
      expect(controller.isFlyoutOpen).toBe(true);
    });

    it("closes flyout on second click (toggle)", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      slotEl.click();
      expect(controller.isFlyoutOpen).toBe(true);
      slotEl.click();
      expect(controller.isFlyoutOpen).toBe(false);
    });

    it("calls onSlotClick and sets openFlyoutAfterModeChange when clicking in non-wind mode", () => {
      const d = makeDeps({ getLayerMode: () => "temperature" });
      const ctrl = new WindStyleController(d);
      const { slotEl, flyoutEl } = makeFlyout();
      ctrl.attachToSlot(slotEl, flyoutEl);

      slotEl.click();
      expect(d.onSlotClick).toHaveBeenCalledOnce();
    });
  });

  describe("setOpenFlyoutAfterModeChange", () => {
    it("opens flyout on next syncControls in wind mode", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.setOpenFlyoutAfterModeChange();
      controller.syncControls();
      expect(controller.isFlyoutOpen).toBe(true);
    });

    it("only opens once (flag is cleared)", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.setOpenFlyoutAfterModeChange();
      controller.syncControls();
      expect(controller.isFlyoutOpen).toBe(true);
      controller.closeFlyout(true);
      controller.syncControls();
      expect(controller.isFlyoutOpen).toBe(false);
    });
  });

  describe("detachSlot", () => {
    it("clears internal slot references", () => {
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.detachSlot();
      controller.openFlyout(true);
      expect(controller.isFlyoutOpen).toBe(false);
    });
  });

  describe("destroy", () => {
    it("clears timers and slot", () => {
      vi.useFakeTimers();
      const { slotEl, flyoutEl } = makeFlyout();
      controller.attachToSlot(slotEl, flyoutEl);
      controller.openFlyout(false);
      controller.destroy();
      vi.advanceTimersByTime(200);
      expect(controller.isFlyoutOpen).toBe(false);
      vi.useRealTimers();
    });
  });

  describe("null DOM refs", () => {
    it("handles all null dom refs without throwing", () => {
      const d = makeDeps({
        dom: {
          warningEl: null,
          particlesAdvanced: null,
          particlesCountInput: null,
          particlesCountValue: null,
          particlesAgeInput: null,
          particlesAgeValue: null,
          particlesSpeedInput: null,
          particlesSpeedValue: null,
        },
      });
      const ctrl = new WindStyleController(d);
      expect(() => {
        ctrl.setWarning("test");
        ctrl.syncControls();
        ctrl.selectStyle("arrows");
        ctrl.handleParticleFailure();
      }).not.toThrow();
    });
  });
});
