/**
 * Center-of-screen readout (touch / small screens).
 *
 * Draws a crosshair at the map centre and, in forecast view, shows the value of
 * the currently selected variable sampled at map.getCenter(). On mobile the
 * cursor-following hover/tooltip popups are suppressed; any extra detail they
 * would show (wind direction, wave period, …) is folded in here.
 *
 * Two implementations live here, chosen by the `TRANSIENT_CROSSHAIR` flag:
 *
 * - **transient** (default): the crosshair is hidden at rest, appears while the
 *   map is manipulated and fades once it settles, and carries the meteogram
 *   button in a slot beside the value pill. See crosshairState.ts for the
 *   lifecycle and crosshairTimings.ts for every delay.
 * - **legacy** (flag off): the previous always-visible crosshair, unchanged.
 */
import type maplibregl from "maplibre-gl";
import type { InhouseCatalogController } from "../controllers/InhouseCatalogController";
import type { UiState, InhouseGroupId, InhouseLayer } from "./inhouseTypes";
import { INHOUSE_GROUP_VARIABLES } from "./inhouseTypes";
import { sampleInhouseScalarAtCoord } from "./gridSampling";
import { getInhouseLayerBounds } from "./inhouseLayerHelpers";
import { resolveDisplayUnit } from "./inhouseCatalogHelpers";
import { t } from "./i18n";
import {
  CENTER_READOUT_MEDIA,
  isCenterReadoutViewport,
} from "./centerReadoutViewport";
import {
  CrosshairStateMachine,
  isCrosshairActionable,
  isCrosshairVisible,
  type CrosshairState,
} from "./crosshairState";
import {
  classifyTouch,
  isWithinRect,
  isWithinReticleHit,
} from "./crosshairTap";
import { RETICLE_HIT_PX } from "./crosshairTimings";
import { isTransientCrosshairEnabled } from "./transientCrosshairFlag";

export interface CenterReadoutDeps {
  map: maplibregl.Map;
  getCatalogController: () => InhouseCatalogController;
  getViewMode: () => "forecast" | "iconography";
  getUiState: () => UiState;
  formatCardinalDirection: (direction: number | null) => string | null;
}

export interface CenterReadout {
  /** Re-sample the value under the crosshair (throttled). */
  refresh: () => void;
  /**
   * An interaction outside the map gestures — timeline scrub, geolocate,
   * keyboard. Shows the crosshair with a fresh grace window. No-op on the
   * legacy always-visible crosshair.
   */
  notifyInteraction: () => void;
  /**
   * Mount the meteogram button into the slot beside the value pill. Returns
   * false when this readout has no slot (legacy path), so the caller can fall
   * back to the top-left control stack.
   *
   * `isAvailable` reports whether the button is currently offered at all (it is
   * withheld for selections with no meteogram, e.g. GWES / waves). The readout
   * needs it because tapping the *value pill* also activates the button, and
   * that shortcut must be dead whenever the button itself is.
   */
  mountAction: (el: HTMLElement, isAvailable: () => boolean) => boolean;
  /** Hold the crosshair open while the meteogram is on screen. */
  setMeteogramOpen: (open: boolean) => void;
  /**
   * The map-centre coordinate the currently displayed value was sampled at.
   * Captured at sample time rather than read at tap time, so the button can
   * never open a point a frame of movement away from what the readout showed.
   */
  getActionPoint: () => { lng: number; lat: number } | null;
  /** Remove all DOM, listeners and timers. */
  destroy: () => void;
}

const THROTTLE_MS = 120;

/**
 * Outcome of sampling the value under the crosshair.
 *
 * `pending` exists so the crosshair can defer hiding while a value is still
 * resolving. Sampling itself is synchronous and local — it reads already-decoded
 * raster data, and issues no network request — so "in flight" here means the
 * frame's texture has not finished decoding yet, which is the only latency this
 * readout is ever subject to.
 */
type ReadoutSample =
  | { status: "ok"; text: string }
  | { status: "unavailable" }
  | { status: "pending" };

function isInBounds(
  coord: [number, number],
  bounds: [number, number, number, number],
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const [lon, lat] = coord;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function sampleScalar(
  catalog: InhouseCatalogController,
  candidates: string[] | undefined,
  coord: [number, number],
  bounds: [number, number, number, number],
): number | null {
  if (!candidates) return null;
  const layer = catalog.findInhouseLayerByCandidates(candidates);
  if (!layer?.scalar) return null;
  const value = sampleInhouseScalarAtCoord(layer, coord, bounds);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sampleWindExtras(
  catalog: InhouseCatalogController,
  coord: [number, number],
  bounds: [number, number, number, number],
  groupId: "wind" | "precip",
): { speed: number | null; direction: number | null } {
  const group = INHOUSE_GROUP_VARIABLES[groupId];
  const vectorLayer = catalog.findPreferredInhouseWindVectorLayer(groupId);
  if (vectorLayer) {
    const sample = catalog.sampleInhouseVectorAtCoord(
      vectorLayer,
      coord,
      getInhouseLayerBounds(vectorLayer),
    );
    return { speed: sample.value, direction: sample.direction };
  }
  return {
    speed: sampleScalar(catalog, group.windSpeed, coord, bounds),
    direction: sampleScalar(catalog, group.windDir, coord, bounds),
  };
}

function formatPrecipRate(layer: InhouseLayer, value: number): string {
  const name = layer.variable;
  const srcMax = layer.manifest.srcMax;
  const isMmPerSecond = name.includes("rate") && srcMax < 0.1;
  const mmPerHour = isMmPerSecond ? value * 3600 : value;
  const unit =
    resolveDisplayUnit(layer.variable, layer.manifest.unit) || t("unit.mmhr");
  const formatted = mmPerHour < 1 ? mmPerHour.toFixed(2) : mmPerHour.toFixed(1);
  return `${formatted} ${unit}`;
}

function buildReadout(
  mode: InhouseGroupId,
  layer: InhouseLayer,
  value: number,
  coord: [number, number],
  bounds: [number, number, number, number],
  catalog: InhouseCatalogController,
  formatCardinalDirection: (direction: number | null) => string | null,
): string | null {
  const name = layer.variable;
  const srcMax = layer.manifest.srcMax;

  switch (mode) {
    case "temperature": {
      const isKelvin = name.startsWith("air_temperature") && srcMax > 200;
      const celsius = isKelvin || value > 100 ? value - 273.15 : value;
      return `${Math.round(celsius)} °C`;
    }
    case "wind": {
      const speed = `${value.toFixed(1)} m/s`;
      const { direction } = sampleWindExtras(catalog, coord, bounds, "wind");
      const cardinal = formatCardinalDirection(direction);
      return cardinal ? `${speed} ${cardinal}` : speed;
    }
    case "precip": {
      const precip = formatPrecipRate(layer, value);
      const { speed, direction } = sampleWindExtras(
        catalog,
        coord,
        bounds,
        "precip",
      );
      const parts = [precip];
      if (typeof speed === "number" && Number.isFinite(speed)) {
        parts.push(`${speed.toFixed(1)} m/s`);
      }
      const cardinal = formatCardinalDirection(direction);
      if (cardinal) parts.push(cardinal);
      return parts.join(" · ");
    }
    case "waves": {
      const unitLabel = resolveDisplayUnit(layer.variable, layer.manifest.unit);
      const height = `${value.toFixed(1)}${unitLabel ? ` ${unitLabel}` : ""}`;
      const period = sampleScalar(
        catalog,
        INHOUSE_GROUP_VARIABLES.waves.windSpeed,
        coord,
        bounds,
      );
      const direction = sampleScalar(
        catalog,
        INHOUSE_GROUP_VARIABLES.waves.windDir,
        coord,
        bounds,
      );
      const parts = [height];
      if (typeof period === "number" && Number.isFinite(period)) {
        parts.push(t("tooltip.wavePeriod", { value: period.toFixed(1) }));
      }
      const cardinal = formatCardinalDirection(direction);
      if (cardinal) parts.push(cardinal);
      return parts.join(" · ");
    }
    case "cloud": {
      const decodeMax = layer.manifest.imageUnscale?.[1] ?? srcMax ?? 1;
      const fraction = decodeMax > 1 ? value / decodeMax : value;
      const clamped = Math.max(0, Math.min(1, fraction));
      return `${Math.round(clamped * 100)} %`;
    }
    case "snow":
      return `${value.toFixed(2)} m`;
    default:
      return null;
  }
}

/**
 * Sample the readout at an explicit coordinate. Split out from the old inline
 * `readValue` so the transient crosshair can capture the exact centre it
 * sampled, and so "no value yet" can be told apart from "no value here".
 */
function readSampleAtCoord(
  deps: CenterReadoutDeps,
  coord: [number, number],
): ReadoutSample {
  if (!isCenterReadoutViewport() || deps.getViewMode() !== "forecast") {
    return { status: "unavailable" };
  }
  const layerMode = deps.getUiState().layerMode as InhouseGroupId;
  const group = INHOUSE_GROUP_VARIABLES[layerMode];
  if (!group) return { status: "unavailable" };

  const catalog = deps.getCatalogController();
  const layer = catalog.findInhouseLayerByCandidates(group.primary);
  if (!layer) {
    // No matching layer at all: still loading if the catalog holds nothing yet,
    // otherwise this variable genuinely has no raster for the selection.
    return catalog.inhouseLayers.length === 0
      ? { status: "pending" }
      : { status: "unavailable" };
  }
  // The layer exists but its texture has not been decoded for this frame yet.
  if (!layer.scalar) return { status: "pending" };

  const bounds = layer.manifest.bounds;
  if (!isInBounds(coord, bounds)) return { status: "unavailable" };

  const raw = sampleInhouseScalarAtCoord(layer, coord, bounds);
  if (raw === null || !Number.isFinite(raw)) return { status: "unavailable" };

  const text = buildReadout(
    layerMode,
    layer,
    raw,
    coord,
    bounds,
    catalog,
    deps.formatCardinalDirection,
  );
  return text ? { status: "ok", text } : { status: "unavailable" };
}

export function initCenterReadout(deps: CenterReadoutDeps): CenterReadout {
  return isTransientCrosshairEnabled()
    ? initTransientCenterReadout(deps)
    : initLegacyCenterReadout(deps);
}

// ───────────────────────────────────────────────────────────────────────────
// Legacy: always-visible crosshair (flag off). Behaviour unchanged.
// ───────────────────────────────────────────────────────────────────────────

function initLegacyCenterReadout(deps: CenterReadoutDeps): CenterReadout {
  const { map } = deps;

  const root = document.createElement("div");
  root.className = "center-readout";
  root.setAttribute("aria-hidden", "true");
  const valueEl = document.createElement("span");
  valueEl.className = "center-readout__value";
  const crossEl = document.createElement("span");
  crossEl.className = "center-readout__cross";
  root.append(valueEl, crossEl);
  map.getContainer().appendChild(root);

  const mql = window.matchMedia(CENTER_READOUT_MEDIA);

  const compute = () => {
    const center = map.getCenter();
    const sample = readSampleAtCoord(deps, [center.lng, center.lat]);
    if (sample.status === "ok") {
      if (valueEl.textContent !== sample.text) valueEl.textContent = sample.text;
      root.classList.add("has-value");
    } else {
      root.classList.remove("has-value");
    }
  };

  let timer: number | null = null;
  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      compute();
    }, THROTTLE_MS);
  };

  map.on("move", schedule);
  map.on("zoom", schedule);
  map.on("render", schedule);
  mql.addEventListener("change", schedule);

  schedule();
  return {
    refresh: schedule,
    notifyInteraction: () => {},
    mountAction: () => false,
    setMeteogramOpen: () => {},
    getActionPoint: () => {
      const center = map.getCenter();
      return { lng: center.lng, lat: center.lat };
    },
    destroy: () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      map.off("move", schedule);
      map.off("zoom", schedule);
      map.off("render", schedule);
      mql.removeEventListener("change", schedule);
      root.remove();
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Transient: state-machine-driven crosshair with an attached action slot.
// ───────────────────────────────────────────────────────────────────────────

const HOLD_ACTION_PRESS = "action-press";
const HOLD_METEOGRAM_OPEN = "meteogram-open";

/**
 * Whether the chip will fire its own click for a pointer landing on it. True
 * only where it has pointer events — mice. `pointer-events` is inherited, so
 * this picks up the rule set on the enclosing slot.
 */
function isChipSelfActivating(el: HTMLElement): boolean {
  if (typeof window.getComputedStyle !== "function") return false;
  return window.getComputedStyle(el).pointerEvents !== "none";
}

function initTransientCenterReadout(deps: CenterReadoutDeps): CenterReadout {
  const { map } = deps;
  const container = map.getContainer();

  // ── DOM ────────────────────────────────────────────────────────────────
  // The overlay is pointer-events:none throughout; only the action slot opts
  // back in. The reticle deliberately has *no* interactive element — a pinch
  // that starts on it must still reach MapLibre — so its 44×44 hit area is
  // hit-tested geometrically against the container centre instead.
  const root = document.createElement("div");
  root.className = "center-readout center-readout--transient";
  root.dataset.crosshairState = "HIDDEN";

  const group = document.createElement("div");
  group.className = "center-readout__group";

  const valueEl = document.createElement("span");
  valueEl.className = "center-readout__value";
  // The pill's text is announced through the live region below, not twice.
  valueEl.setAttribute("aria-hidden", "true");

  const actionSlot = document.createElement("span");
  actionSlot.className = "center-readout__action";
  // The slot always occupies its width so the pill never shifts sideways. The
  // chip inside is drawn as soon as the crosshair appears, but stays inert (and
  // hidden from assistive tech) until the map settles — visible early, operable
  // only once it is safe to hit. Inert rather than removed, which would collapse
  // the reserved space.
  actionSlot.setAttribute("aria-hidden", "true");
  actionSlot.toggleAttribute("inert", true);

  group.append(valueEl, actionSlot);

  const reticle = document.createElement("span");
  reticle.className = "center-readout__reticle";
  reticle.setAttribute("aria-hidden", "true");
  const crossEl = document.createElement("span");
  crossEl.className = "center-readout__cross";
  reticle.appendChild(crossEl);

  // One announcement per settle, instead of one per sampled frame.
  const liveEl = document.createElement("span");
  liveEl.className = "center-readout__sr";
  liveEl.setAttribute("role", "status");
  liveEl.setAttribute("aria-live", "polite");

  root.append(group, reticle, liveEl);
  container.appendChild(root);

  // ── State ──────────────────────────────────────────────────────────────
  const machine = new CrosshairStateMachine();
  const mql = window.matchMedia(CENTER_READOUT_MEDIA);

  let rafHandle: number | null = null;
  let destroyed = false;
  /** Centre the displayed value was sampled at — the point the button opens. */
  let sampledCentre: { lng: number; lat: number } | null = null;
  /** The mounted meteogram button, if the feature is built and wired. */
  let mountedAction: {
    el: HTMLElement;
    isAvailable: () => boolean;
  } | null = null;
  /** Single-finger touch in progress, for tap-vs-pan classification. */
  let tracked: {
    id: number;
    startX: number;
    startY: number;
    startedAt: number;
    maxMovePx: number;
    /**
     * Whether the crosshair was pinned when this touch began. Read at touchend
     * rather than the live state, because touchstart has already un-pinned to
     * ACTIVE by then (a pan must un-pin without hiding). Only once the touch is
     * known to have been a tap outside the reticle does the un-pin become a
     * dismissal.
     */
    pinnedAtStart: boolean;
    /**
     * Whether the action was operable when this touch began — same reasoning as
     * `pinnedAtStart`. What matters is the state the user was looking at when
     * they reached for the control, not the ACTIVE state that their own
     * touchstart has already moved the machine into.
     */
    actionableAtStart: boolean;
  } | null = null;

  const sampleNow = (): void => {
    if (destroyed) return;
    // Read the centre once and keep it: the value and the coordinate the action
    // button will use must describe the same point.
    const centre = map.getCenter();
    const coord: [number, number] = [centre.lng, centre.lat];
    const sample = readSampleAtCoord(deps, coord);
    sampledCentre = { lng: centre.lng, lat: centre.lat };
    machine.setValuePending(sample.status === "pending");
    if (sample.status === "ok") {
      if (valueEl.textContent !== sample.text) valueEl.textContent = sample.text;
      root.classList.add("has-value");
    } else {
      root.classList.remove("has-value");
    }
  };

  const scheduleFrame = (): void => {
    if (destroyed || rafHandle !== null) return;
    rafHandle = window.requestAnimationFrame(() => {
      rafHandle = null;
      sampleNow();
    });
  };

  /** Re-sample only while something is on screen to sample for. */
  const scheduleIfVisible = (): void => {
    if (isCrosshairVisible(machine.state)) scheduleFrame();
  };

  const announce = (): void => {
    const value = root.classList.contains("has-value")
      ? (valueEl.textContent ?? "")
      : "";
    const actionName =
      actionSlot.firstElementChild?.getAttribute("aria-label") ?? "";
    const message = [value, actionName].filter(Boolean).join(". ");
    // Re-assigning the same string does not re-announce; a leading space is the
    // conventional nudge to force it.
    liveEl.textContent = liveEl.textContent === message ? `${message} ` : message;
  };

  const applyState = (state: CrosshairState): void => {
    root.dataset.crosshairState = state;
    const visible = isCrosshairVisible(state);
    const actionable = isCrosshairActionable(state);
    root.classList.toggle("is-visible", visible);
    root.classList.toggle("is-actionable", actionable);
    actionSlot.toggleAttribute("inert", !actionable);
    if (actionable) actionSlot.removeAttribute("aria-hidden");
    else actionSlot.setAttribute("aria-hidden", "true");

    if (!visible) {
      // Deliberately keep the last text: clearing it would blank the pill
      // mid-fade. The next appearance re-samples within a frame.
      liveEl.textContent = "";
      return;
    }
    if (state === "ACTIVE") {
      scheduleFrame();
      return;
    }
    // SETTLED / PINNED: the map has stopped, so take the final sample now and
    // announce the value together with the button that just became available.
    sampleNow();
    announce();
  };

  machine.subscribe(applyState);

  // ── Map wiring ─────────────────────────────────────────────────────────
  // movestart/zoomstart cover programmatic camera moves (geolocate, timeline
  // fly-to) as well as gestures, which is what the "any new interaction shows
  // the crosshair and cancels a pending hide" rule asks for.
  const onGestureStart = () => machine.gestureStart();
  const onMovementEnd = () => machine.movementEnd();

  map.on("movestart", onGestureStart);
  map.on("zoomstart", onGestureStart);
  map.on("move", scheduleIfVisible);
  map.on("zoom", scheduleIfVisible);
  map.on("moveend", onMovementEnd);
  map.on("zoomend", onMovementEnd);
  // New raster data for the current frame arrives as a repaint; re-sample so a
  // SETTLED readout is not left showing the previous frame's value.
  map.on("render", scheduleIfVisible);

  const onMediaChange = () => scheduleIfVisible();
  mql.addEventListener("change", onMediaChange);

  // ── Touch wiring ───────────────────────────────────────────────────────
  // All listeners are passive: this overlay never calls preventDefault, so it
  // cannot interfere with MapLibre's pan / pinch / double-tap handling.
  const onTouchStart = (event: TouchEvent): void => {
    // Sampled before the machine is told: a gesture start un-pins, and moves
    // the machine to ACTIVE, which would erase both of these.
    const pinnedAtStart = machine.state === "PINNED";
    const actionableAtStart = isCrosshairActionable(machine.state);
    machine.setTouchCount(event.touches.length);
    if (event.touches.length !== 1) {
      // Multi-finger: never a tap.
      tracked = null;
      return;
    }
    const touch = event.touches[0];
    tracked = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      startedAt: event.timeStamp,
      maxMovePx: 0,
      pinnedAtStart,
      actionableAtStart,
    };
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (!tracked) return;
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier !== tracked.id) continue;
      const dx = touch.clientX - tracked.startX;
      const dy = touch.clientY - tracked.startY;
      tracked.maxMovePx = Math.max(tracked.maxMovePx, Math.hypot(dx, dy));
    }
  };

  const onTouchEnd = (event: TouchEvent): void => {
    const gesture = tracked;
    const stillDown = event.touches.length;
    // Update the count first: the machine must know the finger is up before it
    // is asked to settle.
    machine.setTouchCount(stillDown);
    tracked = null;
    if (!gesture || stillDown > 0) return;

    const kind = classifyTouch({
      maxMovePx: gesture.maxMovePx,
      durationMs: event.timeStamp - gesture.startedAt,
    });
    if (kind !== "tap") return;

    const point = { clientX: gesture.startX, clientY: gesture.startY };
    if (isWithinReticleHit(point, container.getBoundingClientRect(), RETICLE_HIT_PX)) {
      machine.reticleTap();
      return;
    }
    if (gesture.actionableAtStart && activateActionFromTap(point)) return;
    if (gesture.pinnedAtStart) {
      machine.dismiss();
      return;
    }
    machine.stationaryTap();
  };

  /**
   * Open the meteogram when a tap lands anywhere on the readout group — the
   * value pill as well as the chip. The chip alone is a 44×44 target floating
   * over a moving map, which is genuinely fiddly to hit; treating the whole
   * group as one control roughly triples it.
   *
   * Done by hit-testing rather than by giving the pill `pointer-events: auto`,
   * so a pinch that begins on the pill still reaches MapLibre. Taps that land on
   * the chip are skipped: the chip is a real button with its own pointer events,
   * and it has already fired its own click — handling it here too would open the
   * meteogram twice.
   *
   * The caller checks that the action was operable when the touch *began* —
   * this touch's own touchstart has already moved the machine to ACTIVE.
   *
   * Returns true when the tap was consumed.
   */
  const activateActionFromTap = (point: {
    clientX: number;
    clientY: number;
  }): boolean => {
    const action = mountedAction;
    if (!action || !action.isAvailable()) return false;
    if (!isWithinRect(point, group.getBoundingClientRect())) return false;
    // Skip the chip only where it can genuinely fire its own click, i.e. where
    // it still has pointer events (fine pointers — see center-readout.css).
    // On touch it does not, so the chip's own rect must be handled here too, or
    // tapping the icon does nothing at all.
    if (
      isChipSelfActivating(action.el) &&
      isWithinRect(point, action.el.getBoundingClientRect())
    ) {
      return true;
    }
    action.el.click();
    return true;
  };

  const onTouchCancel = (event: TouchEvent): void => {
    tracked = null;
    machine.setTouchCount(event.touches.length);
  };

  container.addEventListener("touchstart", onTouchStart, { passive: true });
  container.addEventListener("touchmove", onTouchMove, { passive: true });
  container.addEventListener("touchend", onTouchEnd, { passive: true });
  container.addEventListener("touchcancel", onTouchCancel, { passive: true });

  // ── Action-slot press hold ─────────────────────────────────────────────
  // Delegated so it holds for whatever button is mounted into the slot.
  const onActionPressStart = () => machine.acquireHold(HOLD_ACTION_PRESS);
  const onActionPressEnd = () => machine.releaseHold(HOLD_ACTION_PRESS);
  actionSlot.addEventListener("pointerdown", onActionPressStart);
  actionSlot.addEventListener("touchstart", onActionPressStart, {
    passive: true,
  });
  window.addEventListener("pointerup", onActionPressEnd);
  window.addEventListener("pointercancel", onActionPressEnd);
  window.addEventListener("touchend", onActionPressEnd, { passive: true });
  window.addEventListener("touchcancel", onActionPressEnd, { passive: true });

  // ── Esc dismisses a pinned crosshair ───────────────────────────────────
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (machine.state !== "PINNED") return;
    machine.dismiss();
  };
  window.addEventListener("keydown", onKeyDown);

  applyState(machine.state);

  return {
    refresh: scheduleIfVisible,
    notifyInteraction: () => machine.externalInteraction(),
    mountAction: (el: HTMLElement, isAvailable: () => boolean) => {
      actionSlot.replaceChildren(el);
      mountedAction = { el, isAvailable };
      return true;
    },
    setMeteogramOpen: (open: boolean) => {
      if (open) machine.acquireHold(HOLD_METEOGRAM_OPEN);
      else machine.releaseHold(HOLD_METEOGRAM_OPEN);
    },
    getActionPoint: () => sampledCentre,
    destroy: () => {
      destroyed = true;
      if (rafHandle !== null) window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
      machine.destroy();
      map.off("movestart", onGestureStart);
      map.off("zoomstart", onGestureStart);
      map.off("move", scheduleIfVisible);
      map.off("zoom", scheduleIfVisible);
      map.off("moveend", onMovementEnd);
      map.off("zoomend", onMovementEnd);
      map.off("render", scheduleIfVisible);
      mql.removeEventListener("change", onMediaChange);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchCancel);
      actionSlot.removeEventListener("pointerdown", onActionPressStart);
      actionSlot.removeEventListener("touchstart", onActionPressStart);
      window.removeEventListener("pointerup", onActionPressEnd);
      window.removeEventListener("pointercancel", onActionPressEnd);
      window.removeEventListener("touchend", onActionPressEnd);
      window.removeEventListener("touchcancel", onActionPressEnd);
      window.removeEventListener("keydown", onKeyDown);
      root.remove();
    },
  };
}
