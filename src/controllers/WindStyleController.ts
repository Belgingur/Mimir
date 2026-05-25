import type { WindStyle } from "../lib/viewerTypes";
import {
  getWindStyleAvailability,
  resolveWindStyleAfterContextChange,
} from "../lib/windStyleRules";
import { t } from "../lib/i18n";

export interface WindStyleDomRefs {
  readonly warningEl: HTMLDivElement | null;
  readonly particlesAdvanced: HTMLDivElement | null;
  readonly particlesCountInput: HTMLInputElement | null;
  readonly particlesCountValue: HTMLDivElement | null;
  readonly particlesAgeInput: HTMLInputElement | null;
  readonly particlesAgeValue: HTMLDivElement | null;
  readonly particlesSpeedInput: HTMLInputElement | null;
  readonly particlesSpeedValue: HTMLDivElement | null;
}

export interface WindStyleControllerDeps {
  readonly dom: WindStyleDomRefs;
  readonly supportsWindParticlesPlatform: boolean;
  readonly isFirefox: boolean;
  readonly isDev: boolean;
  readonly getLayerMode: () => string;
  readonly scheduleUpdateLayers: () => void;
  readonly onSlotClick: () => void;
}

export class WindStyleController {
  private _style: WindStyle = "arrows";
  private _hasWindUv10m = false;
  private _runtimeAvailable = true;
  private _numParticles = 900;
  private _maxAge = 10;
  private _speedFactor = 20;

  private slotEl: HTMLButtonElement | null = null;
  private flyoutEl: HTMLDivElement | null = null;
  private flyoutButtons: HTMLButtonElement[] = [];
  private flyoutOpen = false;
  private flyoutOpenTimer: number | null = null;
  private flyoutCloseTimer: number | null = null;
  private openFlyoutAfterModeChange = false;

  constructor(private readonly deps: WindStyleControllerDeps) {
    this.attachParticleInputListeners();
  }

  get style(): WindStyle {
    return this._style;
  }
  get hasWindUv10m(): boolean {
    return this._hasWindUv10m;
  }
  get runtimeAvailable(): boolean {
    return this._runtimeAvailable;
  }
  get numParticles(): number {
    return this._numParticles;
  }
  get maxAge(): number {
    return this._maxAge;
  }
  get speedFactor(): number {
    return this._speedFactor;
  }
  get isFlyoutOpen(): boolean {
    return this.flyoutOpen;
  }

  setStyle(next: WindStyle): void {
    this._style = next;
  }

  formatLabel(style?: WindStyle): string {
    const s = style ?? this._style;
    if (s === "particles") return t("wind.particles");
    if (s === "streamlines") return t("wind.streamlines");
    return t("wind.arrows");
  }

  getBadge(style?: WindStyle): string {
    const s = style ?? this._style;
    if (s === "particles") return "P";
    if (s === "streamlines") return "S";
    return "A";
  }

  selectStyle(next: WindStyle): void {
    const { supportsWindParticlesPlatform, isFirefox, scheduleUpdateLayers } =
      this.deps;
    const { enabled } = getWindStyleAvailability(next, {
      hasWindUv10m: this._hasWindUv10m,
      supportsWindParticlesPlatform,
      windParticlesRuntimeAvailable: this._runtimeAvailable,
      isFirefox,
    });
    if (!enabled) {
      if (
        (next === "particles" || next === "streamlines") &&
        !this._hasWindUv10m
      ) {
        this.setWarning("Particles and streamlines require wind_uv_10m.");
      } else if (next === "particles" && !supportsWindParticlesPlatform) {
        this.setWarning(
          isFirefox
            ? "Particle layer is not supported in Firefox."
            : "Particle layer requires WebGL2.",
        );
      } else if (next === "particles" && !this._runtimeAvailable) {
        this.setWarning(t("wind.fallbackArrows"));
      }
      this.syncControls();
      return;
    }
    this._style = next;
    this.setWarning("");
    this.syncControls();
    scheduleUpdateLayers();
  }

  handleParticleFailure(error?: unknown): void {
    if (error) {
      console.warn(t("wind.particleFallback"), error);
    }
    this._runtimeAvailable = false;
    if (this._style === "particles") {
      this._style = "arrows";
    }
    this.setWarning(t("wind.fallbackArrows"));
    this.syncControls();
    this.deps.scheduleUpdateLayers();
  }

  updateAvailability(inhouseVariables: string[]): void {
    const { supportsWindParticlesPlatform, isFirefox } = this.deps;
    this._hasWindUv10m = inhouseVariables.includes("wind_uv_10m");
    const resolved = resolveWindStyleAfterContextChange(this._style, {
      hasWindUv10m: this._hasWindUv10m,
      supportsWindParticlesPlatform,
      windParticlesRuntimeAvailable: this._runtimeAvailable,
      isFirefox,
    });
    this._style = resolved.style;
    const layerMode = this.deps.getLayerMode();
    if (resolved.warning) {
      this.setWarning(resolved.warning);
    } else if (!this._hasWindUv10m && layerMode === "wind") {
      this.setWarning("");
    } else if (!supportsWindParticlesPlatform && layerMode === "wind") {
      this.setWarning(
        isFirefox
          ? "Particle layer is not supported in Firefox."
          : "Particle layer requires WebGL2.",
      );
    } else if (!this._runtimeAvailable && layerMode === "wind") {
      this.setWarning(t("wind.fallbackArrows"));
    } else if (
      this._hasWindUv10m &&
      layerMode === "wind" &&
      this._style !== "particles" &&
      this._style !== "streamlines"
    ) {
      this.setWarning("");
    }
    this.syncControls();
  }

  setWarning(message = ""): void {
    const { warningEl } = this.deps.dom;
    if (!warningEl) return;
    warningEl.textContent = message;
  }

  syncControls(): void {
    const { dom, isDev, supportsWindParticlesPlatform, isFirefox } = this.deps;
    const layerMode = this.deps.getLayerMode();
    const windLabel =
      layerMode === "wind"
        ? `${t("layer.wind")}: ${this.formatLabel()}`
        : t("layer.wind");
    if (this.slotEl) {
      this.slotEl.dataset.label = windLabel;
      this.slotEl.title = windLabel;
      this.slotEl.dataset.windStyleBadge = this.getBadge();
      this.slotEl.classList.toggle("is-wind-active", layerMode === "wind");
    }
    this.flyoutButtons.forEach((button) => {
      const style = button.dataset.windStyle as WindStyle;
      const { enabled, hint } = getWindStyleAvailability(style, {
        hasWindUv10m: this._hasWindUv10m,
        supportsWindParticlesPlatform,
        windParticlesRuntimeAvailable: this._runtimeAvailable,
        isFirefox,
      });
      const isActive = this._style === style;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-disabled", !enabled);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
      button.title = hint;
    });
    if (layerMode !== "wind") {
      this.closeFlyout(true);
    } else if (this.openFlyoutAfterModeChange) {
      this.openFlyout(true);
      this.openFlyoutAfterModeChange = false;
    }
    if (dom.particlesCountInput) {
      dom.particlesCountInput.value = String(this._numParticles);
    }
    if (dom.particlesCountValue) {
      dom.particlesCountValue.textContent = String(this._numParticles);
    }
    if (dom.particlesAgeInput) {
      dom.particlesAgeInput.value = String(this._maxAge);
    }
    if (dom.particlesAgeValue) {
      dom.particlesAgeValue.textContent = String(this._maxAge);
    }
    if (dom.particlesSpeedInput) {
      dom.particlesSpeedInput.value = String(this._speedFactor);
    }
    if (dom.particlesSpeedValue) {
      dom.particlesSpeedValue.textContent = this._speedFactor.toFixed(1);
    }
    if (dom.particlesAdvanced) {
      dom.particlesAdvanced.style.display =
        isDev && layerMode === "wind" && this._style === "particles"
          ? "grid"
          : "none";
    }
  }

  setOpenFlyoutAfterModeChange(): void {
    this.openFlyoutAfterModeChange = true;
  }

  openFlyout(immediate = false): void {
    const layerMode = this.deps.getLayerMode();
    if (!this.slotEl || !this.flyoutEl || layerMode !== "wind") return;
    this.clearCloseTimer();
    if (immediate) {
      this.clearOpenTimer();
      this.flyoutOpen = true;
      this.slotEl.classList.add("is-wind-flyout-open");
      this.flyoutEl.classList.add("is-open");
      return;
    }
    this.clearOpenTimer();
    this.flyoutOpenTimer = window.setTimeout(() => {
      this.flyoutOpen = true;
      this.slotEl?.classList.add("is-wind-flyout-open");
      this.flyoutEl?.classList.add("is-open");
      this.flyoutOpenTimer = null;
    }, FLYOUT_DELAY_MS);
  }

  closeFlyout(immediate = false): void {
    this.clearOpenTimer();
    if (immediate) {
      this.clearCloseTimer();
      this.flyoutOpen = false;
      this.slotEl?.classList.remove("is-wind-flyout-open");
      this.flyoutEl?.classList.remove("is-open");
      return;
    }
    this.clearCloseTimer();
    this.flyoutCloseTimer = window.setTimeout(() => {
      this.flyoutOpen = false;
      this.slotEl?.classList.remove("is-wind-flyout-open");
      this.flyoutEl?.classList.remove("is-open");
      this.flyoutCloseTimer = null;
    }, FLYOUT_DELAY_MS);
  }

  attachToSlot(slotEl: HTMLButtonElement, flyoutEl: HTMLDivElement): void {
    this.slotEl = slotEl;
    this.flyoutEl = flyoutEl;
    this.flyoutButtons = Array.from(
      flyoutEl.querySelectorAll("[data-wind-style]"),
    ) as HTMLButtonElement[];

    this.flyoutButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectStyle(button.dataset.windStyle as WindStyle);
        this.closeFlyout(true);
      });
    });

    slotEl.addEventListener("click", () => {
      if (this.deps.getLayerMode() === "wind") {
        if (this.flyoutOpen) {
          this.closeFlyout(true);
        } else {
          this.openFlyout(true);
        }
      } else {
        this.openFlyoutAfterModeChange = true;
        void this.deps.onSlotClick();
      }
    });
  }

  /** Call from a document-level pointerdown to close the flyout on outside clicks. */
  handleOutsideClick(target: Node): void {
    if (!this.flyoutOpen || !this.slotEl) return;
    if (this.slotEl.contains(target)) return;
    // The flyout may live outside the label (as a sibling in a wrapper div)
    // so we also need to check if the click landed inside the flyout itself.
    if (this.flyoutEl?.contains(target)) return;
    this.closeFlyout(true);
  }

  detachSlot(): void {
    this.slotEl = null;
    this.flyoutEl = null;
    this.flyoutButtons = [];
  }

  destroy(): void {
    this.clearOpenTimer();
    this.clearCloseTimer();
    this.detachSlot();
  }

  private clearOpenTimer(): void {
    if (this.flyoutOpenTimer !== null) {
      window.clearTimeout(this.flyoutOpenTimer);
      this.flyoutOpenTimer = null;
    }
  }

  private clearCloseTimer(): void {
    if (this.flyoutCloseTimer !== null) {
      window.clearTimeout(this.flyoutCloseTimer);
      this.flyoutCloseTimer = null;
    }
  }

  private attachParticleInputListeners(): void {
    const { dom, scheduleUpdateLayers } = this.deps;
    dom.particlesCountInput?.addEventListener("input", () => {
      this._numParticles =
        Number(dom.particlesCountInput!.value) || this._numParticles;
      this.syncControls();
      scheduleUpdateLayers();
    });
    dom.particlesAgeInput?.addEventListener("input", () => {
      this._maxAge = Number(dom.particlesAgeInput!.value) || this._maxAge;
      this.syncControls();
      scheduleUpdateLayers();
    });
    dom.particlesSpeedInput?.addEventListener("input", () => {
      this._speedFactor =
        Number(dom.particlesSpeedInput!.value) || this._speedFactor;
      this.syncControls();
      scheduleUpdateLayers();
    });
  }
}

const FLYOUT_DELAY_MS = 120;
