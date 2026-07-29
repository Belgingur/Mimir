import { t } from "../../lib/i18n";
import type { BelMeteogramLocationDetail } from "../../vendor/bel-meteogram/bel-meteogram";
import type { MeteogramTrigger } from "./meteogramTrigger";
import { readMapPanelPoint, writeMapPanelPoint, clearMapPanelPoint } from "./mapPanelState";

/**
 * Pin/subtitle label for a resolved meteogram point. Prefers the place name
 * with the "now" temperature ("{place} · {temp}°" per the map-panel handoff),
 * falling back to the raw coordinates when either is missing.
 */
function formatPinLabel(detail: BelMeteogramLocationDetail): string {
  const name = detail.name?.trim();
  const place =
    name && name.length > 0
      ? name
      : `${detail.lat.toFixed(3)}, ${detail.lon.toFixed(3)}`;
  return typeof detail.tempC === "number" ? `${place} · ${detail.tempC}°` : place;
}

export interface MeteogramDomRefs {
  readonly modal: HTMLDivElement;
  readonly close: HTMLButtonElement;
  readonly location: HTMLDivElement;
  readonly status: HTMLDivElement;
  readonly widgetHost: HTMLElement;
}

/**
 * The `<bel-meteogram>` web component (vendored in src/vendor/bel-meteogram,
 * replacing the old `<belgingur-meteogram>` widgets-2 embed). The widget owns
 * its loading skeleton, error + retry UI and language switching, so this
 * controller only creates/points it and mirrors errors into the modal status
 * line via the widget's "bel-meteogram-status" events.
 */
export interface MeteogramWidget extends HTMLElement {
  loadChartLocation(lat: number, lon: number, name?: string): void;
}

export interface MeteogramControllerDeps {
  readonly dom: MeteogramDomRefs;
  readonly createWidget: (clientName: string) => MeteogramWidget;
  readonly getSelectedModel: () => string;
  readonly resolveClientName: (modelId: string) => string;
  readonly getLocale: () => string;
  readonly getLayerMode: () => string;
  /** True when the current model/layer/view selection would resolve a map click
   *  to a meteogram. Used to reconcile an already-open panel with state changes
   *  (see {@link MeteogramController.syncOpenState}). Optional so the controller
   *  still works headless / in tests. */
  readonly isMeteogramTarget?: () => boolean;
  /** Domain bounds `[minLon, minLat, maxLon, maxLat]` of the currently selected
   *  model, or null when unknown (no layer loaded yet). Used for an early
   *  out-of-domain hint before the widget's own fetch resolves. It's a proxy
   *  for the WOD forecast domain (the model's render extent), so it never
   *  blocks — a successful load clears the hint. */
  readonly getModelBounds?: () => [number, number, number, number] | null;
  /** Authoritative model run / last-update times for the selected model, from
   *  Mímir's manifest — passed to the widget so its "Greiningartími" footer is
   *  correct (the WOD meteogram.json it fetches may not carry them). Both are
   *  ISO 8601 UTC. Returns null when unknown (no layer loaded yet). */
  readonly getAnalysisInfo?: () => {
    analysisTimeISO?: string;
    generatedAt?: string;
  } | null;
  /** Drop a pin at the clicked map point (map-panel layout). Optional so the
   *  controller still works headless / in tests without a live map. */
  readonly showPin?: (lng: number, lat: number, label: string) => void;
  readonly removePin?: () => void;
  readonly isDev: boolean;
}

export class MeteogramController {
  private clickTimer: number | null = null;
  private widget: MeteogramWidget | null = null;
  private currentClientName: string | null = null;
  /** True when the point last opened/reloaded fell outside the selected model's
   *  domain bounds. Held across the widget's "loading" phase so the early hint
   *  survives until the fetch confirms (error) or refutes (ready) it. */
  private pendingOutOfBounds = false;
  private trigger: MeteogramTrigger | null = null;
  private readonly deps: MeteogramControllerDeps;
  private readonly boundOnEscape: (event: KeyboardEvent) => void;

  constructor(deps: MeteogramControllerDeps) {
    this.deps = deps;
    this.boundOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !this.isOpen) return;
      // Desktop (map-panel 2a): Esc exits widget fullscreen; the panel
      // closes via its own ✕. Mobile keeps Esc-to-dismiss the sheet.
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(min-width: 900px)").matches
      ) {
        return;
      }
      this.close();
    };
    this.attachDomListeners();
  }

  private attachDomListeners(): void {
    const { dom } = this.deps;
    dom.close.addEventListener("click", () => this.close());
    dom.modal.addEventListener("click", (event) => {
      if (event.target === dom.modal) {
        this.close();
      }
    });
    window.addEventListener("keydown", this.boundOnEscape);
  }

  handleMapClick(lngLat: { lng: number; lat: number }): void {
    // Defensive: routing already excludes 'waves', but guard anyway so a direct
    // caller can't open a meteogram for a layer that has none.
    if (this.deps.getLayerMode() === "waves") return;
    if (this.clickTimer) {
      window.clearTimeout(this.clickTimer);
    }
    // 220ms debounce so a double-click (map zoom) does not open the popup.
    this.clickTimer = window.setTimeout(() => {
      void this.openAt(lngLat.lng, lngLat.lat);
    }, 220);
  }

  cancelPendingClick(): void {
    if (this.clickTimer) {
      window.clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
  }

  close(): void {
    const { dom } = this.deps;
    dom.modal.classList.remove("is-open");
    dom.modal.setAttribute("aria-hidden", "true");
    this.pendingOutOfBounds = false;
    this.deps.removePin?.();
    clearMapPanelPoint();
  }

  /**
   * Whether a point falls outside the selected model's domain bounds. Returns
   * false when the bounds are unknown (no layer loaded yet) so the widget's own
   * fetch stays the source of truth. See {@link MeteogramControllerDeps.getModelBounds}.
   */
  private isPointOutsideModel(lng: number, lat: number): boolean {
    const bounds = this.deps.getModelBounds?.();
    if (!bounds) return false;
    const [minLon, minLat, maxLon, maxLat] = bounds;
    return lng < minLon || lng > maxLon || lat < minLat || lat > maxLat;
  }

  get isOpen(): boolean {
    return this.deps.dom.modal.classList.contains("is-open");
  }

  /** Exposed for tests. Returns the currently mounted widget element, if any. */
  getWidget(): MeteogramWidget | null {
    return this.widget;
  }

  /** Attach the mobile centre-crosshair trigger button (see setupMeteogram). */
  bindTrigger(trigger: MeteogramTrigger): void {
    this.trigger = trigger;
  }

  /** Re-evaluate the mobile trigger's availability after a state change. */
  refreshMobileTrigger(): void {
    this.trigger?.refresh();
  }

  resolveClientNameForModel(modelId: string): string {
    return this.deps.resolveClientName(modelId);
  }

  /** Locales the widget ships strings for (mirrors Mímir's registered locales).
   *  Any other app locale falls back to English. */
  private static readonly WIDGET_LOCALES = new Set([
    "is",
    "en",
    "fo",
    "pl",
    "es",
    "pt",
  ]);

  /** Pass the app locale straight through when the widget supports it. */
  private widgetLanguage(): string {
    const locale = this.deps.getLocale();
    return MeteogramController.WIDGET_LOCALES.has(locale) ? locale : "en";
  }

  /**
   * Apply the current app locale to the widget. The widget re-renders its
   * strings in place (no refetch, no view reset), so this is safe to call on
   * every app-level language change, open or closed.
   */
  applyLocale(): void {
    this.widget?.setAttribute("language", this.widgetLanguage());
  }

  /**
   * Ensure the widget in `dom.widgetHost` targets `clientName` and `lat/lng`.
   * A new element is created when the client changes; its attributes are set
   * before it is appended so the widget loads exactly once, with the right
   * config, on connect.
   */
  configureMeteogram(
    clientName: string,
    lat: number,
    lng: number,
  ): { clientName: string } {
    const label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    // Show Mímir's own model name in the widget rather than the WOD config's
    // (e.g. "ISLAND-9" instead of "Ísafjörður - 2.5km"). See the widget's
    // `forecast-label` attribute.
    const modelLabel = this.deps.getSelectedModel();
    if (this.widget && this.currentClientName === clientName) {
      this.widget.setAttribute("language", this.widgetLanguage());
      this.widget.setAttribute("forecast-label", modelLabel);
      this.applyAnalysisAttrs(this.widget);
      this.widget.loadChartLocation(lat, lng, label);
      return { clientName };
    }
    if (this.widget) {
      this.widget.remove();
    }
    const fresh = this.deps.createWidget(clientName);
    fresh.setAttribute("language", this.widgetLanguage());
    fresh.setAttribute("forecast-label", modelLabel);
    fresh.setAttribute("location-lat", String(lat));
    fresh.setAttribute("location-lon", String(lng));
    this.applyAnalysisAttrs(fresh);
    this.attachWidgetListeners(fresh);
    this.deps.dom.widgetHost.appendChild(fresh);
    this.widget = fresh;
    this.currentClientName = clientName;
    return { clientName };
  }

  /**
   * Push Mímir's authoritative analysis / last-update times (from the selected
   * model's manifest) onto the widget so its footer shows the correct
   * "Greiningartími" (task C2). Cleared when unknown so the widget falls back to
   * its own data.
   */
  private applyAnalysisAttrs(widget: MeteogramWidget): void {
    const info = this.deps.getAnalysisInfo?.();
    const set = (attr: string, val?: string): void => {
      if (val) widget.setAttribute(attr, val);
      else widget.removeAttribute(attr);
    };
    set("analysis-time", info?.analysisTimeISO);
    set("last-updated", info?.generatedAt);
  }

  /**
   * Mirror the widget's load state into the modal status line and honour its
   * built-in ✕ (the `closable` attribute). The widget shows its own skeleton
   * and error-with-retry card; the status line adds a localized message (the
   * widget itself is is/en only) with the underlying error, which the old
   * polling-based flow surfaced via timeouts.
   */
  private attachWidgetListeners(widget: MeteogramWidget): void {
    widget.addEventListener("bel-meteogram-status", (event) => {
      if (this.widget !== widget) return;
      const detail = (
        event as CustomEvent<{ status: string; error?: string }>
      ).detail;
      // The widget can't tell us *why* a load failed, but by far the most
      // common cause for a valid map click is a point outside the selected
      // model's forecast domain — so the message names the model and points at
      // that, while still carrying the underlying error for diagnosis.
      if (detail.status === "error") {
        this.deps.dom.status.textContent = t("meteogram.loadFailed", {
          model: this.deps.getSelectedModel(),
          message: detail.error ?? "unknown",
        });
      } else if (detail.status === "ready") {
        // A successful load refutes the early out-of-domain guess.
        this.pendingOutOfBounds = false;
        this.deps.dom.status.textContent = "";
      } else {
        // "loading": keep the early out-of-domain hint (set in openAt) visible
        // through the spinner; otherwise clear the line.
        this.deps.dom.status.textContent = this.pendingOutOfBounds
          ? t("meteogram.outsideDomain", { model: this.deps.getSelectedModel() })
          : "";
      }
    });
    widget.addEventListener("bel-meteogram-close", () => {
      if (this.widget === widget) this.close();
    });
    // The widget announces its resolved point on every successful load —
    // initial, a station picked in its overlay, or a model change. Move the
    // map pin (and modal subtitle) to follow it so the selected station is
    // always shown on the map.
    widget.addEventListener("bel-meteogram-location", (event) => {
      if (this.widget !== widget) return;
      const detail = (event as CustomEvent<BelMeteogramLocationDetail>).detail;
      const label = formatPinLabel(detail);
      this.deps.dom.location.textContent = label;
      this.deps.showPin?.(detail.lon, detail.lat, label);
    });
  }

  async openAt(lng: number, lat: number): Promise<void> {
    const { dom } = this.deps;
    const modelId = this.deps.getSelectedModel();
    const clientName = this.resolveClientNameForModel(modelId);
    writeMapPanelPoint(lat, lng);
    dom.modal.classList.add("is-open");
    dom.modal.setAttribute("aria-hidden", "false");
    const label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    dom.location.textContent = label;
    // Early out-of-domain hint: if the point is outside the selected model's
    // known bounds we say so immediately, before the widget's fetch resolves.
    // It's held through the widget's loading phase and cleared if the load
    // actually succeeds (see attachWidgetListeners) — a proxy check that warns
    // but never blocks.
    this.pendingOutOfBounds = this.isPointOutsideModel(lng, lat);
    dom.status.textContent = this.pendingOutOfBounds
      ? t("meteogram.outsideDomain", { model: modelId })
      : "";
    // Drop the selected-point pin on the map (desktop docked-panel layout;
    // harmless on mobile where the pin sits behind the full-screen sheet).
    this.deps.showPin?.(lng, lat, label);

    if (this.deps.isDev) {
      console.debug(
        `Opening meteogram for model ${modelId} using deployment ${clientName}`,
      );
    }

    try {
      this.configureMeteogram(clientName, lat, lng);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dom.status.textContent = t("meteogram.loadFailed", {
        model: modelId,
        message,
      });
    }
  }

  /**
   * Reconcile an already-open panel with the live app state. Called from
   * `scheduleUpdateLayers`, i.e. on every model / layer-group / view change.
   *
   * - Closes the panel when the selection no longer targets a meteogram — the
   *   icons (iconography) view, the waves layer, or the GWES model — so the
   *   meteogram is only ever open in forecast view (request 1).
   * - Otherwise, when the bottom model selector picked a model that resolves to
   *   a different WOD deployment, reloads the chart at the same point so the
   *   selector drives the meteogram (request 2).
   *
   * A no-op while closed, and while open with an unchanged target/model (so map
   * pans and zooms don't reload it).
   */
  syncOpenState(): void {
    if (!this.isOpen) return;
    if (this.deps.isMeteogramTarget && !this.deps.isMeteogramTarget()) {
      this.close();
      return;
    }
    const point = readMapPanelPoint();
    if (!point) return;
    const clientName = this.resolveClientNameForModel(
      this.deps.getSelectedModel(),
    );
    if (clientName !== this.currentClientName) {
      void this.openAt(point.lon, point.lat);
    }
  }

  /**
   * Re-open the panel at the last map click stored in `mimirMapPanelState`
   * (development.md §7). Called once after the feature chunk loads.
   */
  async restorePersistedPoint(): Promise<void> {
    const point = readMapPanelPoint();
    if (!point) return;
    await this.openAt(point.lon, point.lat);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundOnEscape);
    this.cancelPendingClick();
    this.trigger?.destroy();
    this.trigger = null;
  }
}
