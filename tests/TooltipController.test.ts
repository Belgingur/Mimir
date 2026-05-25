import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as WeatherLayers from "weatherlayers-gl";
import {
  TooltipController,
  type TooltipDeps,
} from "../src/controllers/TooltipController";

function createTooltipDom() {
  const tooltipHost = document.createElement("div") as HTMLDivElement;
  const root = document.createElement("div");
  root.className = "weatherlayers-tooltip-control";
  const container = document.createElement("div");
  const valueSpan = document.createElement("span");
  valueSpan.className = "base-value";
  valueSpan.textContent = "1.0";
  container.appendChild(valueSpan);
  root.appendChild(container);
  tooltipHost.appendChild(root);
  document.body.appendChild(tooltipHost);
  return { tooltipHost, container, valueSpan };
}

function createDeps(overrides: Partial<TooltipDeps> = {}): {
  deps: TooltipDeps;
  formatDirection: ReturnType<typeof vi.fn>;
  formatValueWithUnit: ReturnType<typeof vi.fn>;
} {
  const { tooltipHost } = createTooltipDom();
  const formatDirection = vi.fn((direction: number) =>
    direction >= 180 ? "S" : "N",
  );
  const formatValueWithUnit = vi.fn(
    (value: number, format: WeatherLayers.UnitFormat) =>
      `${value.toFixed(format.decimals)} ${format.unit}`,
  );
  const deps: TooltipDeps = {
    dom: { tooltipHost },
    getWindUnitFormat: () => null,
    formatDirection,
    formatValueWithUnit,
    directionTypeInward: "inward",
    directionFormatCardinal3: "cardinal3",
    unitSystemMetric: "metric",
    ...overrides,
  };
  return { deps, formatDirection, formatValueWithUnit };
}

describe("TooltipController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("normalizeDirection", () => {
    it("returns null for null and non-finite numbers", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      expect(ctrl.normalizeDirection(null)).toBeNull();
      expect(ctrl.normalizeDirection(Number.NaN)).toBeNull();
      expect(ctrl.normalizeDirection(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it("normalizes wrapped and negative values", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      expect(ctrl.normalizeDirection(0)).toBe(0);
      expect(ctrl.normalizeDirection(361)).toBe(1);
      expect(ctrl.normalizeDirection(-10)).toBe(350);
      expect(ctrl.normalizeDirection(720)).toBe(0);
    });
  });

  describe("finiteDirectionOrUndefined", () => {
    it("returns undefined for null/non-finite and number for finite", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      expect(ctrl.finiteDirectionOrUndefined(null)).toBeUndefined();
      expect(ctrl.finiteDirectionOrUndefined(Number.NaN)).toBeUndefined();
      expect(ctrl.finiteDirectionOrUndefined(42)).toBe(42);
    });
  });

  describe("updateWindDirectionDebug", () => {
    it("creates direction span and formats/accentuates direction", () => {
      const { deps, formatDirection } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateWindDirectionDebug(190);
      const el = deps.dom.tooltipHost.querySelector(
        ".tooltip-wind-direction",
      ) as HTMLSpanElement | null;
      expect(el).not.toBeNull();
      expect(el?.textContent).toBe("S");
      expect(el?.style.display).toBe("inline-block");
      expect(el?.style.marginLeft).toBe("6px");
      expect(formatDirection).toHaveBeenCalledWith(190, "inward", "cardinal3");
    });

    it("hides duplicate/acronym and undefined spans, keeps m/s span visible", () => {
      const { deps, container } = (() => {
        const dom = createTooltipDom();
        const formatDirection = vi.fn(() => "N");
        const formatValueWithUnit = vi.fn((value: number) => `${value} m/s`);
        const d: TooltipDeps = {
          dom: { tooltipHost: dom.tooltipHost },
          getWindUnitFormat: () => null,
          formatDirection,
          formatValueWithUnit,
          directionTypeInward: "inward",
          directionFormatCardinal3: "cardinal3",
          unitSystemMetric: "metric",
        };
        return { deps: d, container: dom.container };
      })();
      const acronym = document.createElement("span");
      acronym.textContent = "N";
      const undef = document.createElement("span");
      undef.textContent = "undefined";
      const numeric = document.createElement("span");
      numeric.textContent = "123";
      const wind = document.createElement("span");
      wind.textContent = "2.0 m/s";
      container.append(acronym, undef, numeric, wind);

      const ctrl = new TooltipController(deps);
      ctrl.updateWindDirectionDebug(10);

      expect(acronym.style.display).toBe("none");
      expect(undef.style.display).toBe("none");
      expect(numeric.style.display).toBe("none");
      expect(wind.style.display).not.toBe("none");
    });

    it("hides direction span when passed null", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateWindDirectionDebug(90);
      ctrl.updateWindDirectionDebug(null);
      const el = deps.dom.tooltipHost.querySelector(
        ".tooltip-wind-direction",
      ) as HTMLSpanElement;
      expect(el.textContent).toBe("");
      expect(el.style.display).toBe("none");
    });
  });

  describe("updateTooltipWindSpeed", () => {
    it("creates, formats and shows wind speed span with fallback metric format", () => {
      const { deps, formatValueWithUnit } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateTooltipWindSpeed(5.56);
      const el = deps.dom.tooltipHost.querySelector(
        ".tooltip-wind-speed",
      ) as HTMLSpanElement;
      expect(el.textContent).toBe("5.6 m/s");
      expect(el.style.display).toBe("inline-block");
      expect(el.style.marginLeft).toBe("6px");
      expect(formatValueWithUnit).toHaveBeenCalled();
    });

    it("uses provided wind unit format when available", () => {
      const { tooltipHost } = createTooltipDom();
      const formatValueWithUnit = vi.fn(
        (value: number, format: WeatherLayers.UnitFormat) =>
          `${value.toFixed(format.decimals)} ${format.unit}`,
      );
      const ctrl = new TooltipController({
        dom: { tooltipHost },
        getWindUnitFormat: () => ({
          system: "x" as unknown as WeatherLayers.UnitSystem,
          unit: "kn",
          decimals: 0,
        }),
        formatDirection: vi.fn(() => "N"),
        formatValueWithUnit,
        directionTypeInward: "inward",
        directionFormatCardinal3: "cardinal3",
        unitSystemMetric: "metric",
      });
      ctrl.updateTooltipWindSpeed(12.2);
      expect(
        (tooltipHost.querySelector(".tooltip-wind-speed") as HTMLSpanElement)
          .textContent,
      ).toBe("12 kn");
    });

    it("hides element on null", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateTooltipWindSpeed(1);
      ctrl.updateTooltipWindSpeed(null);
      const el = deps.dom.tooltipHost.querySelector(
        ".tooltip-wind-speed",
      ) as HTMLSpanElement;
      expect(el.textContent).toBe("");
      expect(el.style.display).toBe("none");
    });
  });

  describe("updateTooltipWindSpeedBeforeDirection", () => {
    it("inserts wind speed element before direction element", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateWindDirectionDebug(90);
      ctrl.updateTooltipWindSpeedBeforeDirection(4.4);
      const container = deps.dom.tooltipHost.querySelector(
        ".weatherlayers-tooltip-control > div",
      ) as HTMLDivElement;
      const windEl = container.querySelector(
        ".tooltip-wind-speed",
      ) as HTMLSpanElement;
      const dirEl = container.querySelector(
        ".tooltip-wind-direction",
      ) as HTMLSpanElement;
      expect(container.children.length).toBeGreaterThan(2);
      expect(
        container.children[Array.from(container.children).indexOf(windEl) + 1],
      ).toBe(dirEl);
    });
  });

  describe("updateTooltipWavePeriod and updateTooltipMslp", () => {
    it("creates, shows and hides wave period span", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateTooltipWavePeriod(8.44);
      const period = deps.dom.tooltipHost.querySelector(
        ".tooltip-wave-period",
      ) as HTMLSpanElement;
      expect(period.textContent).toBe("8.4 s");
      expect(period.style.display).toBe("inline-block");
      ctrl.updateTooltipWavePeriod(null);
      expect(period.textContent).toBe("");
      expect(period.style.display).toBe("none");
    });

    it("creates, rounds, shows and hides mslp span", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      ctrl.updateTooltipMslp(1000.6);
      const mslp = deps.dom.tooltipHost.querySelector(
        ".tooltip-mslp",
      ) as HTMLSpanElement;
      expect(mslp.textContent).toBe("1001 hPa");
      expect(mslp.style.display).toBe("inline-block");
      ctrl.updateTooltipMslp(null);
      expect(mslp.textContent).toBe("");
      expect(mslp.style.display).toBe("none");
    });
  });

  describe("updateTooltipValueOverride", () => {
    it("writes text to first value span and keeps existing text when null", () => {
      const { deps, valueSpan } = (() => {
        const dom = createTooltipDom();
        const d: TooltipDeps = {
          dom: { tooltipHost: dom.tooltipHost },
          getWindUnitFormat: () => null,
          formatDirection: vi.fn(() => "N"),
          formatValueWithUnit: vi.fn(() => "1.0 m/s"),
          directionTypeInward: "inward",
          directionFormatCardinal3: "cardinal3",
          unitSystemMetric: "metric",
        };
        return { deps: d, valueSpan: dom.valueSpan };
      })();
      const ctrl = new TooltipController(deps);
      ctrl.updateTooltipValueOverride("10 °C");
      expect(valueSpan.textContent).toBe("10 °C");
      ctrl.updateTooltipValueOverride(null);
      expect(valueSpan.textContent).toBe("10 °C");
    });
  });

  describe("control/state plumbing", () => {
    it("delegates updatePickingInfo to tooltip control and clearAllAddons clears all addon fields", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      const updatePickingInfo = vi.fn();
      ctrl.tooltipControl = {
        updatePickingInfo,
      } as unknown as WeatherLayers.TooltipControl;

      ctrl.updateTooltipWindSpeed(3.3);
      ctrl.updateTooltipWavePeriod(5.5);
      ctrl.updateTooltipMslp(999.2);
      ctrl.updateWindDirectionDebug(270);
      ctrl.clearAllAddons();

      expect(updatePickingInfo).toHaveBeenCalledWith(null);
      expect(
        (
          deps.dom.tooltipHost.querySelector(
            ".tooltip-wind-speed",
          ) as HTMLSpanElement
        ).style.display,
      ).toBe("none");
      expect(
        (
          deps.dom.tooltipHost.querySelector(
            ".tooltip-wave-period",
          ) as HTMLSpanElement
        ).style.display,
      ).toBe("none");
      expect(
        (deps.dom.tooltipHost.querySelector(".tooltip-mslp") as HTMLSpanElement)
          .style.display,
      ).toBe("none");
      expect(
        (
          deps.dom.tooltipHost.querySelector(
            ".tooltip-wind-direction",
          ) as HTMLSpanElement
        ).style.display,
      ).toBe("none");
    });

    it("tracks tooltipControl and temporary hover state getters/setters", () => {
      const { deps } = createDeps();
      const ctrl = new TooltipController(deps);
      expect(ctrl.tooltipControl).toBeNull();
      expect(ctrl.tempRasterHoverActive).toBe(false);
      expect(ctrl.tempRasterHoverTs).toBe(0);

      const control = {
        updatePickingInfo: vi.fn(),
      } as unknown as WeatherLayers.TooltipControl;
      ctrl.tooltipControl = control;
      ctrl.tempRasterHoverActive = true;
      ctrl.tempRasterHoverTs = 12345;

      expect(ctrl.tooltipControl).toBe(control);
      expect(ctrl.tempRasterHoverActive).toBe(true);
      expect(ctrl.tempRasterHoverTs).toBe(12345);
    });
  });
});
