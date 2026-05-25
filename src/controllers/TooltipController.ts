import type * as WeatherLayers from "weatherlayers-gl";
import { t } from "../lib/i18n";

type TooltipControlLike = WeatherLayers.TooltipControl & {
  updatePickingInfo: (info: unknown) => void;
};

export interface TooltipDom {
  tooltipHost: HTMLDivElement;
}

export interface TooltipDeps {
  dom: TooltipDom;
  getWindUnitFormat: () => WeatherLayers.UnitFormat | null;
  formatDirection: (
    direction: number,
    directionType: unknown,
    directionFormat: unknown,
  ) => string;
  formatValueWithUnit: (
    value: number,
    format: WeatherLayers.UnitFormat,
  ) => string;
  directionTypeInward: unknown;
  directionFormatCardinal3: unknown;
  unitSystemMetric: unknown;
  createTooltipControl?: (config: unknown) => WeatherLayers.TooltipControl;
  placementTop?: unknown;
  directionFormatValue?: unknown;
}

export class TooltipController {
  private readonly DEBUG_SHOW_WIND_DEGREES = false;
  private readonly deps: TooltipDeps;

  private _tooltipControl: TooltipControlLike | null = null;
  private _tempRasterHoverActive = false;
  private _tempRasterHoverTs = 0;

  constructor(deps: TooltipDeps) {
    this.deps = deps;
  }

  get tooltipControl(): WeatherLayers.TooltipControl | null {
    return this._tooltipControl;
  }

  set tooltipControl(value: WeatherLayers.TooltipControl | null) {
    this._tooltipControl = value as TooltipControlLike | null;
  }

  get tempRasterHoverActive(): boolean {
    return this._tempRasterHoverActive;
  }
  set tempRasterHoverActive(value: boolean) {
    this._tempRasterHoverActive = value;
  }

  get tempRasterHoverTs(): number {
    return this._tempRasterHoverTs;
  }
  set tempRasterHoverTs(value: number) {
    this._tempRasterHoverTs = value;
  }

  initControl(): void {
    if (!this.deps.createTooltipControl) return;
    const tempUnitFormat = {
      system: this.deps.unitSystemMetric,
      unit: "°C",
      decimals: 0,
    };
    const tc = this.deps.createTooltipControl({
      unitFormat: tempUnitFormat,
      followCursor: true,
      followCursorOffset: 12,
      followCursorPlacement: this.deps.placementTop,
      directionType: this.deps.directionTypeInward,
      directionFormat: this.deps.directionFormatValue,
    });
    tc.addTo(this.deps.dom.tooltipHost);
    this._tooltipControl = tc as TooltipControlLike;
  }

  normalizeDirection(direction: number | null): number | null {
    if (typeof direction !== "number" || !Number.isFinite(direction)) {
      return null;
    }
    return ((direction % 360) + 360) % 360;
  }

  finiteDirectionOrUndefined(direction: number | null): number | undefined {
    return typeof direction === "number" && Number.isFinite(direction)
      ? direction
      : undefined;
  }

  /** Returns a 3-letter cardinal abbreviation (e.g. "NNW") for an inward wave direction, or null. */
  formatCardinalDirection(direction: number | null): string | null {
    const normalized = this.normalizeDirection(direction);
    if (normalized === null) return null;
    return this.deps.formatDirection(
      normalized,
      this.deps.directionTypeInward,
      this.deps.directionFormatCardinal3,
    );
  }

  updateWindDirectionDebug(direction: number | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) return;
    let directionText = container.querySelector(
      ".tooltip-wind-direction",
    ) as HTMLSpanElement | null;
    if (!directionText) {
      directionText = document.createElement("span");
      directionText.className = "tooltip-wind-direction";
      const valueSpan = container.querySelector(
        "span",
      ) as HTMLSpanElement | null;
      if (valueSpan?.className) {
        directionText.className = `${valueSpan.className} tooltip-wind-direction`;
      }
      const periodEl = container.querySelector(
        ".tooltip-wave-period",
      ) as HTMLSpanElement | null;
      if (periodEl && periodEl.parentElement === container) {
        periodEl.insertAdjacentElement("afterend", directionText);
      } else {
        container.appendChild(directionText);
      }
    }
    if (typeof direction === "number" && Number.isFinite(direction)) {
      const normalized = this.normalizeDirection(direction) ?? 0;
      const acronym = this.deps.formatDirection(
        normalized,
        this.deps.directionTypeInward,
        this.deps.directionFormatCardinal3,
      );
      directionText.textContent = this.DEBUG_SHOW_WIND_DEGREES
        ? `${acronym} ${Math.round(normalized)}°`
        : `${acronym}`;
      directionText.style.display = "inline-block";
      directionText.style.marginLeft = "6px";
      const spans = Array.from(
        container.querySelectorAll("span"),
      ) as HTMLSpanElement[];
      spans.forEach((span) => {
        if (span === directionText) return;
        if (span.querySelector("svg")) return;
        const text = span.textContent?.trim() ?? "";
        if (!text) return;
        if (text.includes("m/s")) return;
        if (text.toLowerCase() === "undefined" && span.children.length === 0) {
          span.style.display = "none";
          return;
        }
        if (text === acronym && span.children.length === 0) {
          span.style.display = "none";
          return;
        }
        const isNumeric = /^[0-9]+(\.[0-9]+)?$/.test(text);
        const isDegree = /^[0-9]+(\.[0-9]+)?°$/.test(text);
        if ((isNumeric || isDegree) && span.children.length === 0) {
          span.style.display = "none";
        } else if (span.style.display === "none") {
          span.style.display = "";
        }
      });
    } else {
      directionText.textContent = "";
      directionText.style.display = "none";
    }
  }

  updateTooltipWindSpeed(speed: number | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) {
      return;
    }
    let windSpeedEl = container.querySelector(
      ".tooltip-wind-speed",
    ) as HTMLSpanElement | null;
    if (!windSpeedEl) {
      windSpeedEl = document.createElement("span");
      windSpeedEl.className = "tooltip-wind-speed";
      const valueSpan = container.querySelector(
        "span",
      ) as HTMLSpanElement | null;
      if (valueSpan?.className) {
        windSpeedEl.className = `${valueSpan.className} tooltip-wind-speed`;
      }
      container.appendChild(windSpeedEl);
    }
    if (typeof speed === "number" && Number.isFinite(speed)) {
      const format =
        this.deps.getWindUnitFormat() ??
        ({
          system: this.deps.unitSystemMetric,
          unit: "m/s",
          decimals: 1,
        } as unknown as WeatherLayers.UnitFormat);
      const windText = this.deps.formatValueWithUnit(speed, format);
      windSpeedEl.textContent = `${windText}`;
      windSpeedEl.style.display = "inline-block";
      windSpeedEl.style.marginLeft = "6px";
    } else {
      windSpeedEl.textContent = "";
      windSpeedEl.style.display = "none";
    }
  }

  updateTooltipWindSpeedBeforeDirection(speed: number | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) {
      return;
    }
    let windSpeedEl = container.querySelector(
      ".tooltip-wind-speed",
    ) as HTMLSpanElement | null;
    if (!windSpeedEl) {
      windSpeedEl = document.createElement("span");
      windSpeedEl.className = "tooltip-wind-speed";
      const valueSpan = container.querySelector(
        "span",
      ) as HTMLSpanElement | null;
      if (valueSpan?.className) {
        windSpeedEl.className = `${valueSpan.className} tooltip-wind-speed`;
      }
    }
    if (typeof speed === "number" && Number.isFinite(speed)) {
      const format =
        this.deps.getWindUnitFormat() ??
        ({
          system: this.deps.unitSystemMetric,
          unit: "m/s",
          decimals: 1,
        } as unknown as WeatherLayers.UnitFormat);
      const windText = this.deps.formatValueWithUnit(speed, format);
      windSpeedEl.textContent = `${windText}`;
      windSpeedEl.style.display = "inline-block";
      windSpeedEl.style.marginLeft = "6px";
      const directionEl = container.querySelector(".tooltip-wind-direction");
      if (directionEl) {
        container.insertBefore(windSpeedEl, directionEl);
      } else {
        container.appendChild(windSpeedEl);
      }
    } else {
      windSpeedEl.textContent = "";
      windSpeedEl.style.display = "none";
    }
  }

  updateTooltipWavePeriod(period: number | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) {
      return;
    }
    let periodEl = container.querySelector(
      ".tooltip-wave-period",
    ) as HTMLSpanElement | null;
    if (!periodEl) {
      periodEl = document.createElement("span");
      periodEl.className = "tooltip-wave-period";
      const valueSpan = container.querySelector(
        "span",
      ) as HTMLSpanElement | null;
      if (valueSpan?.className) {
        periodEl.className = `${valueSpan.className} tooltip-wave-period`;
      }
      container.appendChild(periodEl);
    }
    if (typeof period === "number" && Number.isFinite(period)) {
      periodEl.textContent = t("tooltip.wavePeriod", {
        value: period.toFixed(1),
      });
      periodEl.style.display = "inline-block";
      periodEl.style.marginLeft = "6px";
    } else {
      periodEl.textContent = "";
      periodEl.style.display = "none";
    }
  }

  updateTooltipMslp(value: number | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) {
      return;
    }
    let mslpEl = container.querySelector(
      ".tooltip-mslp",
    ) as HTMLSpanElement | null;
    if (!mslpEl) {
      mslpEl = document.createElement("span");
      mslpEl.className = "tooltip-mslp";
      const valueSpan = container.querySelector(
        "span",
      ) as HTMLSpanElement | null;
      if (valueSpan?.className) {
        mslpEl.className = `${valueSpan.className} tooltip-mslp`;
      }
      container.appendChild(mslpEl);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      mslpEl.textContent = t("tooltip.mslp", {
        value: String(Math.round(value)),
      });
      mslpEl.style.display = "inline-block";
      mslpEl.style.marginLeft = "6px";
    } else {
      mslpEl.textContent = "";
      mslpEl.style.display = "none";
    }
  }

  updateTooltipValueOverride(text: string | null): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) {
      return;
    }
    const container = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!container) {
      return;
    }
    const valueSpan = container.querySelector("span") as HTMLSpanElement | null;
    if (!valueSpan) {
      return;
    }
    if (text) {
      valueSpan.textContent = text;
    }
  }

  updatePickingInfo(info: unknown): void {
    this._tooltipControl?.updatePickingInfo(info);
  }

  /**
   * Re-centres the tooltip bubble horizontally over the cursor after content
   * changes (e.g. updateTooltipValueOverride) have altered its width.
   *
   * The weatherlayers-gl library measures the value span width at
   * updatePickingInfo() time to calculate the inner-div's `left` offset.
   * If we later replace that text with something wider/narrower the stored
   * offset is stale and the bubble drifts off-centre.  Calling this after
   * all content mutations corrects it by re-measuring the final width.
   */
  recenterBubble(): void {
    const tooltip = this.deps.dom.tooltipHost.querySelector(
      ".weatherlayers-tooltip-control",
    );
    if (!tooltip) return;
    const inner = tooltip.querySelector("div") as HTMLDivElement | null;
    if (!inner) return;
    const width = inner.getBoundingClientRect().width;
    if (width > 0) {
      inner.style.left = `${-width / 2}px`;
    }
  }

  clearAllAddons(): void {
    this.updatePickingInfo(null);
    this.updateTooltipWindSpeed(null);
    this.updateTooltipWavePeriod(null);
    this.updateTooltipMslp(null);
    this.updateWindDirectionDebug(null);
  }
}
