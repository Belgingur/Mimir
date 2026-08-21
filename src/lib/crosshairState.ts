/**
 * Visibility state machine for the transient centre crosshair (mobile).
 *
 * The crosshair is not permanently visible: it appears while the user
 * manipulates the map and fades out once the map has settled. This module owns
 * that lifecycle and nothing else — no DOM, no map, no sampling — so every
 * transition is unit-testable with an injected clock.
 *
 *   HIDDEN   --gesture start / touchstart on map-->  ACTIVE
 *   ACTIVE   --map movement + inertia end-->         SETTLED  (start hide timer)
 *   SETTLED  --hide timer elapsed-->                 HIDDEN
 *   SETTLED  --new gesture start-->                  ACTIVE   (cancel hide timer)
 *   SETTLED  --tap on reticle hit area-->            PINNED
 *   HIDDEN   --stationary tap on map-->              SETTLED  (start hide timer)
 *   PINNED   --tap outside / Esc-->                  HIDDEN
 *   PINNED   --pan-->                                ACTIVE
 *
 * Two deliberate deviations from the original transition table:
 *
 * 1. `PINNED --pan--> ACTIVE`, not `--> HIDDEN`. Hiding on pan would break the
 *    hard rule that the crosshair never disappears while a finger is down (and
 *    would fight the rule that starting a pan always shows it). Panning
 *    therefore un-pins and rejoins the normal fade lifecycle; only a tap outside
 *    the reticle, or Esc, dismisses straight to HIDDEN.
 * 2. A second tap on the reticle while PINNED is idempotent rather than an
 *    un-pin, matching the transition table literally.
 */
import {
  CROSSHAIR_TIMINGS,
  type CrosshairTimings,
} from "./crosshairTimings";

export type CrosshairState = "HIDDEN" | "ACTIVE" | "SETTLED" | "PINNED";

/** The crosshair and readout are rendered in every state but HIDDEN. */
export function isCrosshairVisible(state: CrosshairState): boolean {
  return state !== "HIDDEN";
}

/**
 * Whether the meteogram button is *operable*. It is drawn for as long as the
 * crosshair is visible — including mid-pan, so it does not blink in and out on
 * every settle — but it only accepts input once the map has stopped, so it
 * cannot be hit while the map is still moving. See the pointer-events split in
 * styles/components/center-readout.css.
 */
export function isCrosshairActionable(state: CrosshairState): boolean {
  return state === "SETTLED" || state === "PINNED";
}

export type CrosshairStateListener = (
  state: CrosshairState,
  previous: CrosshairState,
) => void;

export interface CrosshairMachineOptions {
  /** Overrides for individual timings; the rest fall back to the defaults. */
  readonly timings?: Partial<CrosshairTimings>;
  /** Injectable for tests. Defaults to `window.setTimeout`. */
  readonly setTimeout?: (handler: () => void, ms: number) => number;
  /** Injectable for tests. Defaults to `window.clearTimeout`. */
  readonly clearTimeout?: (handle: number) => void;
}

export class CrosshairStateMachine {
  private _state: CrosshairState = "HIDDEN";
  private readonly timings: CrosshairTimings;
  private readonly schedule: (handler: () => void, ms: number) => number;
  private readonly unschedule: (handle: number) => void;
  private readonly listeners = new Set<CrosshairStateListener>();

  /** Fingers currently on the screen. The hide timer never runs above zero. */
  private touchCount = 0;
  /** True once the map has reported movement (incl. inertia) finished. */
  private movementEnded = false;
  private hideHandle: number | null = null;
  /**
   * A hide that is due but blocked (finger down, value in flight, meteogram
   * open). Holds the delay to use once the blocker clears; null when nothing is
   * owed.
   */
  private owedDelay: number | null = null;
  /** True while the value for the current frame has not resolved yet. */
  private valuePending = false;
  /** Watchdog bounding how long a pending value may defer the hide. */
  private valuePendingHandle: number | null = null;
  /** Named reasons the crosshair must stay put (button press, open meteogram). */
  private readonly holds = new Set<string>();
  private destroyed = false;

  constructor(options: CrosshairMachineOptions = {}) {
    this.timings = { ...CROSSHAIR_TIMINGS, ...options.timings };
    this.schedule =
      options.setTimeout ??
      ((handler, ms) => window.setTimeout(handler, ms));
    this.unschedule =
      options.clearTimeout ?? ((handle) => window.clearTimeout(handle));
  }

  get state(): CrosshairState {
    return this._state;
  }

  /** True when a hide is scheduled and will fire unless something cancels it. */
  get hidePending(): boolean {
    return this.hideHandle !== null;
  }

  subscribe(listener: CrosshairStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * A gesture (or a programmatic camera move) has begun. Always shows the
   * crosshair and always cancels a pending hide. Also un-pins: see deviation 1.
   */
  gestureStart(): void {
    if (this.destroyed) return;
    this.cancelOwedHide();
    this.movementEnded = false;
    this.transition("ACTIVE");
  }

  /**
   * The map has stopped moving — `moveend` / `zoomend`, which MapLibre fires
   * after inertia has run out. Settling still waits for the last finger to lift.
   */
  movementEnd(): void {
    if (this.destroyed) return;
    if (this._state !== "ACTIVE") return;
    this.movementEnded = true;
    this.maybeSettle();
  }

  /**
   * Fingers currently touching the map. Raising the count from zero counts as a
   * gesture start; dropping it to zero may complete a settle that was waiting on
   * the finger, or release a hide that was owed.
   */
  setTouchCount(count: number): void {
    if (this.destroyed) return;
    const next = Math.max(0, Math.floor(count));
    const wasDown = this.touchCount > 0;
    this.touchCount = next;
    if (next > 0) {
      if (!wasDown) this.gestureStart();
      else this.cancelOwedHide();
      return;
    }
    this.maybeSettle();
    this.resumeOwedHide();
  }

  /**
   * A touch ended without the map having moved, so no `moveend` is coming. Shows
   * the crosshair and starts the grace window (`HIDDEN -> SETTLED`).
   */
  stationaryTap(): void {
    if (this.destroyed) return;
    if (this._state === "PINNED") return;
    this.movementEnded = true;
    if (this._state === "HIDDEN") this.transition("ACTIVE");
    this.maybeSettle();
  }

  /** A tap landed inside the reticle hit area: hold the crosshair open. */
  reticleTap(): void {
    if (this.destroyed) return;
    if (this._state === "HIDDEN") return;
    this.cancelOwedHide();
    this.transition("PINNED");
    if (this.timings.PINNED_AUTO_DISMISS_MS > 0) {
      this.startHideTimer(this.timings.PINNED_AUTO_DISMISS_MS);
    }
  }

  /** Tap outside the reticle while pinned, or Esc: hide immediately. */
  dismiss(): void {
    if (this.destroyed) return;
    this.cancelOwedHide();
    this.transition("HIDDEN");
  }

  /**
   * An interaction that is not a map gesture — timeline scrubbing, a keyboard
   * action, geolocate. Shows the crosshair with a fresh grace window so the new
   * value is seen, and always cancels any pending hide. Pinned stays pinned.
   */
  externalInteraction(): void {
    if (this.destroyed) return;
    this.cancelOwedHide();
    if (this._state === "PINNED") return;
    if (this.touchCount > 0 || this._state === "ACTIVE") {
      this.transition("ACTIVE");
      return;
    }
    this.movementEnded = true;
    this.transition("SETTLED");
    this.startHideTimer(this.timings.CROSSHAIR_HIDE_DELAY_MS);
  }

  /**
   * Whether the value under the crosshair is still resolving. While true the
   * crosshair will not hide; when it clears, an owed hide resumes on the
   * shortened delay.
   */
  setValuePending(pending: boolean): void {
    if (this.destroyed) return;
    if (pending === this.valuePending) return;
    this.valuePending = pending;
    this.clearValuePendingTimer();
    if (pending) {
      // Bound the deferral. A value that never resolves — a catalog that failed
      // to load, say — must not hold the crosshair on screen indefinitely; the
      // watchdog stands in for the request aborting.
      this.valuePendingHandle = this.schedule(() => {
        this.valuePendingHandle = null;
        if (!this.valuePending) return;
        this.valuePending = false;
        this.resumeOwedHide();
      }, this.timings.VALUE_PENDING_TIMEOUT_MS);
      return;
    }
    this.resumeOwedHide();
  }

  /**
   * Hold the crosshair open for a named reason — a press on the action chip, an
   * open meteogram. Re-entrant across distinct reasons; releasing the last one
   * restarts the full grace window rather than the remainder, so the user gets a
   * fresh chance to reach the button after a modal closes.
   */
  acquireHold(reason: string): void {
    if (this.destroyed) return;
    this.holds.add(reason);
    if (this.hideHandle !== null) {
      this.clearHideTimer();
      this.owedDelay = this.timings.CROSSHAIR_HIDE_DELAY_MS;
    }
  }

  releaseHold(reason: string): void {
    if (this.destroyed) return;
    if (!this.holds.delete(reason)) return;
    this.resumeOwedHide();
  }

  /** Clear every timer and listener. Safe to call more than once. */
  destroy(): void {
    this.destroyed = true;
    this.clearHideTimer();
    this.clearValuePendingTimer();
    this.owedDelay = null;
    this.holds.clear();
    this.listeners.clear();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private maybeSettle(): void {
    if (this._state !== "ACTIVE") return;
    if (this.touchCount > 0) return;
    if (!this.movementEnded) return;
    this.transition("SETTLED");
    this.startHideTimer(this.timings.CROSSHAIR_HIDE_DELAY_MS);
  }

  private blocked(): boolean {
    return this.holds.size > 0 || this.touchCount > 0 || this.valuePending;
  }

  private startHideTimer(delay: number): void {
    this.clearHideTimer();
    // Never tick down while a finger is on the screen, the value is in flight,
    // or something is explicitly holding the crosshair open.
    if (this.blocked()) {
      this.owedDelay = delay;
      return;
    }
    this.owedDelay = null;
    this.hideHandle = this.schedule(() => this.onHideElapsed(), delay);
  }

  private onHideElapsed(): void {
    this.hideHandle = null;
    if (this.blocked()) {
      // Raced with a blocker that appeared without cancelling the timer.
      this.owedDelay = this.timings.CROSSHAIR_HIDE_DELAY_SHORT_MS;
      return;
    }
    this.transition("HIDDEN");
  }

  private resumeOwedHide(): void {
    if (this.owedDelay === null) return;
    if (this.blocked()) return;
    if (this._state !== "SETTLED") {
      this.owedDelay = null;
      return;
    }
    const delay = this.owedDelay;
    this.owedDelay = null;
    this.startHideTimer(delay);
  }

  private cancelOwedHide(): void {
    this.clearHideTimer();
    this.owedDelay = null;
  }

  private clearHideTimer(): void {
    if (this.hideHandle === null) return;
    this.unschedule(this.hideHandle);
    this.hideHandle = null;
  }

  private clearValuePendingTimer(): void {
    if (this.valuePendingHandle === null) return;
    this.unschedule(this.valuePendingHandle);
    this.valuePendingHandle = null;
  }

  private transition(next: CrosshairState): void {
    if (this._state === next) return;
    const previous = this._state;
    this._state = next;
    if (next === "HIDDEN") {
      this.movementEnded = false;
      this.owedDelay = null;
    }
    // Copy: a listener may subscribe/unsubscribe while we notify.
    for (const listener of [...this.listeners]) listener(next, previous);
  }
}
