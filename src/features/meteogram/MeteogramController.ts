import { distance } from "geokdbush";
import { t } from "../../lib/i18n";
import type {
  BelMeteogramLocationDetail,
  BelMeteogramTimeDetail,
} from "../../vendor/bel-meteogram/bel-meteogram";
import type { MeteogramTrigger } from "./meteogramTrigger";
import { meteogramTargetKey, type MeteogramTarget } from "./meteogramConfig";
import { readMapPanelPoint, writeMapPanelPoint, clearMapPanelPoint } from "./mapPanelState";
import { SAME_POINT_EPSILON_DEG } from "../../lib/placeLabeller";

/**
 * A forecast point this far or further from the centre of the place clicked
 * (the label's point) gets the widget's "forecast for the weather station
 * N km from …" line. Nearer, it is the place for any reader.
 */
export const STATION_NOTE_MIN_KM = 0.5;

/** Pin/subtitle name for a resolved meteogram point: the place name, else
 *  the raw coordinates. */
function formatPinName(detail: BelMeteogramLocationDetail): string {
  const name = detail.name?.trim();
  return name && name.length > 0
    ? name
    : `${detail.lat.toFixed(3)}, ${detail.lon.toFixed(3)}`;
}

/**
 * Pin/subtitle label for a resolved meteogram point from a widget without
 * `selected-time` (0.7.0): the name with the "now" temperature
 * ("{place} · {temp}°" per the map-panel handoff), or the name alone when the
 * temperature is missing.
 */
function formatPinLabel(detail: BelMeteogramLocationDetail): string {
  const place = formatPinName(detail);
  return typeof detail.tempC === "number" ? `${place} · ${detail.tempC}°` : place;
}

/**
 * Whether the registered `<bel-meteogram>` takes a host's hour through
 * `selected-time` (widget 0.8.0 and later). An older widget does not, and the
 * pin then keeps showing its "now" value.
 */
export function widgetSupportsSelectedTime(): boolean {
  const ctor = customElements.get("bel-meteogram") as
    | { observedAttributes?: readonly string[] }
    | undefined;
  return ctor?.observedAttributes?.includes("selected-time") ?? false;
}

/** An instant as the absolute UTC ISO string the widget's `selected-time`
 *  takes, or null when there is none or it isn't a date. */
function toUtcIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
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
  readonly createWidget: (target: MeteogramTarget) => MeteogramWidget;
  readonly getSelectedModel: () => string;
  readonly resolveTarget: (modelId: string) => MeteogramTarget;
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
  /** Name of the place at a point — the city label clicked on the map, else the
   *  nearest place from the bundled dataset — or undefined when nothing is close
   *  enough to fairly label the point, in which case the raw coordinate is used.
   *  See lib/resolveClickedPlace.ts. */
  readonly getPlaceLabel?: (lng: number, lat: number) => string | undefined;
  /** When a point is a place's station, not the place (a city label clicked and
   *  snapped to its station): the place's name and its own point. */
  readonly getSnappedFrom?: (
    lng: number,
    lat: number,
  ) => { name: string; lng: number; lat: number } | undefined;
  /** Drop a pin at the clicked map point (map-panel layout). Optional so the
   *  controller still works headless / in tests without a live map.
   *  `placeName` is the place the pin names, or undefined for a bare point;
   *  the map hides that place's own label while the pin stands in for it. */
  readonly showPin?: (
    lng: number,
    lat: number,
    label: string,
    placeName: string | undefined,
  ) => void;
  readonly removePin?: () => void;
  /** Change only the text of the pin {@link showPin} dropped, without moving
   *  it or touching the map's labels. Optional; without it the pin is dropped
   *  again through {@link showPin}. */
  readonly updatePinLabel?: (label: string) => void;
  /** The hour selected on the map's timeline, as an ISO instant, or null
   *  before there is one. A widget created later starts at this hour. */
  readonly getSelectedTime?: () => string | null | undefined;
  /** The reader moved the panel's hour (widget 0.8.0's `bel-meteogram-time`
   *  with `source: "user"`). Moves the map's timeline to the frame at, else
   *  nearest, that time, and returns that frame's time, or null when there is
   *  no timeline. */
  readonly onUserSelectTime?: (time: string) => string | null;
  /** Called whenever the panel opens or closes. The transient centre crosshair
   *  uses this to hold itself visible for as long as the meteogram it launched is
   *  on screen. Only fired on an actual change, so repeated opens at the same
   *  point don't churn. */
  readonly onOpenStateChange?: (open: boolean) => void;
  readonly isDev: boolean;
}

export class MeteogramController {
  private clickTimer: number | null = null;
  private widget: MeteogramWidget | null = null;
  /** {@link meteogramTargetKey} of the target the widget was created for. */
  private currentTargetKey: string | null = null;
  /** True when the point last opened/reloaded fell outside the selected model's
   *  domain bounds. Held across the widget's "loading" phase so the early hint
   *  survives until the fetch confirms (error) or refutes (ready) it. */
  private pendingOutOfBounds = false;
  /** The point last opened, and the place name it was opened under (a city
   *  label clicked on the map), if any. */
  private opened: { lng: number; lat: number; name?: string } | null = null;
  private trigger: MeteogramTrigger | null = null;
  /** The map timeline's hour as a UTC ISO instant (see {@link setSelectedTime}). */
  private selectedTime: string | null = null;
  /** The hour the mounted widget shows as far as the host knows: the last
   *  `selected-time` given, or the hour the reader committed in the panel. */
  private widgetTime: string | null = null;
  /** Where the pin stands once the widget has resolved the current load, and
   *  what it names; null until then (the pin shows the name alone). Only used
   *  with a widget that supports `selected-time`. */
  private pinTarget: {
    lng: number;
    lat: number;
    name: string;
    placeName: string | undefined;
  } | null = null;
  /** The label the pin was last given from a time event, to skip repeats. */
  private pinLabel: string | null = null;
  /** A bare point's pin was dropped without text and the widget hasn't named
   *  the point yet (see openAt and nameBarePinAfterFailure). */
  private pinWaitsForName = false;
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
    if (!dom.modal.classList.contains("is-open")) {
      dom.modal.toggleAttribute("inert", true);
    }
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
    const wasOpen = this.isOpen;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && dom.modal.contains(focused)) {
      focused.blur();
    }
    dom.modal.toggleAttribute("inert", true);
    dom.modal.classList.remove("is-open");
    dom.modal.setAttribute("aria-hidden", "true");
    this.pendingOutOfBounds = false;
    // A failed load's message would otherwise stay in the hidden modal (and,
    // before the pulse was scoped to an open modal, keep animating).
    dom.status.textContent = "";
    this.opened = null;
    this.pinTarget = null;
    this.pinLabel = null;
    this.pinWaitsForName = false;
    this.deps.removePin?.();
    clearMapPanelPoint();
    if (wasOpen) this.deps.onOpenStateChange?.(false);
  }

  /** Resolved place name for a point, or undefined when there isn't a usable one. */
  private placeNameAt(lng: number, lat: number): string | undefined {
    const name = this.deps.getPlaceLabel?.(lng, lat)?.trim();
    return name ? name : undefined;
  }

  /**
   * Mímir's own text for a bare point, used only when a load fails before the
   * widget names the point. The widget is never given it as a name: it labels
   * a bare point itself, in its own format and language, and the pin follows.
   */
  private coordinateLabel(lng: number, lat: number): string {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }

  /**
   * The load failed before the widget named a bare point: give its blank pin,
   * and the subtitle, Mímir's coordinate text, so the point still says where
   * it is. A later load that succeeds (Retry) names it as usual.
   */
  private nameBarePinAfterFailure(): void {
    const opened = this.opened;
    if (!this.pinWaitsForName || !opened) return;
    this.pinWaitsForName = false;
    const label = this.coordinateLabel(opened.lng, opened.lat);
    this.deps.dom.location.textContent = label;
    this.deps.showPin?.(opened.lng, opened.lat, label, undefined);
  }

  /**
   * Tell the widget what to call this point. `location-name` outranks the
   * widget's own name resolution, so it is only set when a place actually
   * resolved; otherwise it is removed so `prefer-coordinates` shows the raw
   * coordinate as before (and a stale name from a previous point cannot leak).
   * The widget drops the attribute itself when the user picks a station in its
   * overlay, so this never fights a manual pick.
   */
  private applyLocationName(
    widget: MeteogramWidget,
    lng: number,
    lat: number,
  ): void {
    const name = this.placeNameAt(lng, lat);
    if (name) widget.setAttribute("location-name", name);
    else widget.removeAttribute("location-name");
  }

  /**
   * The place a pin at the widget's resolved point names: the name the point
   * was opened under, or, once the widget has moved the point (a station
   * picked in its list), the widget's name for it. A point opened on open
   * ground keeps no place name, though the widget labels it with coordinates.
   */
  private pinPlaceName(
    detail: BelMeteogramLocationDetail,
  ): string | undefined {
    const opened = this.opened;
    if (
      opened &&
      Math.abs(opened.lng - detail.lon) < SAME_POINT_EPSILON_DEG &&
      Math.abs(opened.lat - detail.lat) < SAME_POINT_EPSILON_DEG
    ) {
      return opened.name;
    }
    const name = detail.name?.trim();
    return name ? name : undefined;
  }

  /**
   * Tell the widget when its point is a station standing in for the place
   * clicked, and how far it is from the place's centre, so the panel can say
   * so (`station-place`, `station-place-km`; the widget words and translates
   * the line). Only from {@link STATION_NOTE_MIN_KM}; otherwise both go, so a
   * note can't outlive the point it was about.
   */
  private applyStationPlace(
    widget: MeteogramWidget,
    lng: number,
    lat: number,
  ): void {
    const from = this.deps.getSnappedFrom?.(lng, lat);
    const km = from ? distance(lng, lat, from.lng, from.lat) : 0;
    if (from && km >= STATION_NOTE_MIN_KM) {
      widget.setAttribute("station-place", from.name);
      widget.setAttribute("station-place-km", km.toFixed(2));
    } else {
      widget.removeAttribute("station-place");
      widget.removeAttribute("station-place-km");
    }
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

  resolveTargetForModel(modelId: string): MeteogramTarget {
    return this.deps.resolveTarget(modelId);
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
   * Ensure the widget in `dom.widgetHost` shows `target` at `lat/lng`. A new
   * element is created when the config or forecast changes, since the widget
   * reads both once; its attributes are set before it is appended so it loads
   * exactly once, with the right forecast, on connect.
   */
  configureMeteogram(
    target: MeteogramTarget,
    lat: number,
    lng: number,
  ): { target: MeteogramTarget } {
    // Show Mímir's own model name in the widget rather than the WOD config's
    // (e.g. "ISLAND-9" instead of "Ísafjörður - 2.5km"). See the widget's
    // `forecast-label` attribute.
    const modelLabel = this.deps.getSelectedModel();
    const key = meteogramTargetKey(target);
    if (this.widget && this.currentTargetKey === key) {
      this.widget.setAttribute("language", this.widgetLanguage());
      this.widget.setAttribute("forecast-label", modelLabel);
      this.applyLocationName(this.widget, lng, lat);
      this.applyStationPlace(this.widget, lng, lat);
      this.seedSelectedTime();
      this.pushSelectedTime();
      // Only a resolved place name. A bare point gets none, so the widget names
      // it itself, in its own format, as it does for a newly created widget.
      this.widget.loadChartLocation(lat, lng, this.placeNameAt(lng, lat));
      return { target };
    }
    if (this.widget) {
      this.widget.remove();
    }
    const fresh = this.deps.createWidget(target);
    fresh.setAttribute("language", this.widgetLanguage());
    fresh.setAttribute("forecast-label", modelLabel);
    fresh.setAttribute("location-lat", String(lat));
    fresh.setAttribute("location-lon", String(lng));
    this.applyLocationName(fresh, lng, lat);
    this.applyStationPlace(fresh, lng, lat);
    this.attachWidgetListeners(fresh);
    this.widget = fresh;
    this.widgetTime = null;
    this.currentTargetKey = key;
    // The timeline's hour goes on before the widget connects, so its first
    // load already shows that hour.
    this.seedSelectedTime();
    this.pushSelectedTime();
    this.deps.dom.widgetHost.appendChild(fresh);
    return { target };
  }

  /**
   * The hour selected on the map's timeline, as an ISO instant (null for
   * none). Called on every timeline step, playback included, so it only sets
   * the open widget's `selected-time` — and only when that hour changed:
   * the widget moves its cursor in place, without a refetch. A closed panel's
   * widget catches up when it opens.
   */
  setSelectedTime(time: string | null | undefined): void {
    this.selectedTime = toUtcIso(time);
    if (this.isOpen) this.pushSelectedTime();
  }

  /** Take the timeline's current hour, for a widget being (re)pointed. */
  private seedSelectedTime(): void {
    if (this.deps.getSelectedTime) {
      this.selectedTime = toUtcIso(this.deps.getSelectedTime());
    }
  }

  /** Give the mounted widget the timeline's hour, when it shows another. */
  private pushSelectedTime(): void {
    const widget = this.widget;
    if (!widget || !widgetSupportsSelectedTime()) return;
    const time = this.selectedTime;
    if (
      time === this.widgetTime &&
      time === widget.getAttribute("selected-time")
    ) {
      return;
    }
    if (time) widget.setAttribute("selected-time", time);
    else widget.removeAttribute("selected-time");
    this.widgetTime = time;
  }

  /**
   * The widget's hour changed (widget 0.8.0's `bel-meteogram-time`). The pin
   * shows the panel's value at that hour, and a move the reader committed in
   * the panel moves the map's timeline with it.
   */
  private onWidgetTime(detail: BelMeteogramTimeDetail): void {
    // Pin first: following the reader can set `selected-time` again (the
    // nearest frame), whose own event must have the last word.
    this.showPinValue(detail);
    if (detail.source === "user") this.followReader(detail.time);
  }

  /**
   * Label the pin "{name} · {temp}°" with the panel's value at its selected
   * hour, or the name alone when the hour is outside the meteogram or has no
   * value. Waits for the current load's location event, so a value never
   * lands on a point it isn't for. Only the text changes: the pin and the
   * map's labels stay as they are.
   */
  private showPinValue(detail: BelMeteogramTimeDetail): void {
    const pin = this.pinTarget;
    if (!pin) return;
    const label =
      detail.time !== null && typeof detail.tempC === "number"
        ? `${pin.name} · ${detail.tempC}°`
        : pin.name;
    if (label === this.pinLabel) return;
    this.pinLabel = label;
    this.deps.dom.location.textContent = label;
    if (this.deps.updatePinLabel) this.deps.updatePinLabel(label);
    else this.deps.showPin?.(pin.lng, pin.lat, label, pin.placeName);
  }

  /**
   * The reader committed another hour in the panel: move the map's timeline
   * to the frame at (else nearest) it, and the widget to that frame when it
   * isn't the hour picked. The timeline then reports the frame back through
   * {@link setSelectedTime}, which finds the widget already there, so nothing
   * bounces between the two.
   */
  private followReader(time: string | null): void {
    const picked = toUtcIso(time);
    if (!picked) return;
    this.widgetTime = picked;
    const frame = toUtcIso(this.deps.onUserSelectTime?.(picked));
    if (!frame) return;
    this.selectedTime = frame;
    this.pushSelectedTime();
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
      // A load still running when the panel closed reports later; its status
      // belongs to a panel that is gone, so the line close() cleared stays so.
      if (this.widget !== widget || !this.isOpen) return;
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
        this.nameBarePinAfterFailure();
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
      // The widget resolves its point asynchronously, so this can land *after*
      // the user has already closed the panel. Without this guard the late
      // event re-drops the map pin — a stray "place · temp" label stuck on the
      // map with nothing open — which is exactly what happens when the panel is
      // dismissed quickly. close() has already removed the pin; leave it gone.
      if (!this.isOpen) return;
      this.pinWaitsForName = false;
      const detail = (event as CustomEvent<BelMeteogramLocationDetail>).detail;
      if (widgetSupportsSelectedTime()) {
        // The value comes from the time event that follows this load; until
        // then the pin names the point alone, never a stale value.
        const name = formatPinName(detail);
        const placeName = this.pinPlaceName(detail);
        this.pinTarget = { lng: detail.lon, lat: detail.lat, name, placeName };
        this.pinLabel = name;
        this.deps.dom.location.textContent = name;
        this.deps.showPin?.(detail.lon, detail.lat, name, placeName);
        return;
      }
      const label = formatPinLabel(detail);
      this.deps.dom.location.textContent = label;
      this.deps.showPin?.(
        detail.lon,
        detail.lat,
        label,
        this.pinPlaceName(detail),
      );
    });
    widget.addEventListener("bel-meteogram-time", (event) => {
      if (this.widget !== widget || !this.isOpen) return;
      this.onWidgetTime((event as CustomEvent<BelMeteogramTimeDetail>).detail);
    });
  }

  async openAt(lng: number, lat: number): Promise<void> {
    const { dom } = this.deps;
    const modelId = this.deps.getSelectedModel();
    const target = this.resolveTargetForModel(modelId);
    const wasOpen = this.isOpen;
    writeMapPanelPoint(lat, lng);
    dom.modal.removeAttribute("inert");
    dom.modal.classList.add("is-open");
    dom.modal.setAttribute("aria-hidden", "false");
    if (!wasOpen) this.deps.onOpenStateChange?.(true);
    const placeName = this.placeNameAt(lng, lat);
    this.opened = { lng, lat, name: placeName };
    // A new point: its pin names it alone until the widget's load reports
    // the point and its value.
    this.pinTarget = null;
    this.pinLabel = null;
    // A bare point's pin has no text until the widget names it, in its own
    // format and language. Mímir's coordinate text would show for as long as
    // the load takes, seconds for a point the server hasn't answered before;
    // it only stands in if the load fails (nameBarePinAfterFailure).
    const label = placeName ?? "";
    this.pinWaitsForName = !placeName;
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
    this.deps.showPin?.(lng, lat, label, placeName);

    if (this.deps.isDev) {
      console.debug(
        `Opening meteogram for model ${modelId} using ${meteogramTargetKey(target)}`,
      );
    }

    try {
      this.configureMeteogram(target, lat, lng);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dom.status.textContent = t("meteogram.loadFailed", {
        model: modelId,
        message,
      });
      this.nameBarePinAfterFailure();
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
   *   a different WOD config or forecast, reloads the chart at the same point so the
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
    const target = this.resolveTargetForModel(this.deps.getSelectedModel());
    if (meteogramTargetKey(target) !== this.currentTargetKey) {
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
