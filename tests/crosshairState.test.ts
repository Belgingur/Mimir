import { describe, expect, it, vi } from "vitest";
import {
  CrosshairStateMachine,
  isCrosshairActionable,
  isCrosshairVisible,
  type CrosshairState,
} from "../src/lib/crosshairState";
import {
  CROSSHAIR_HIDE_DELAY_MS,
  CROSSHAIR_HIDE_DELAY_SHORT_MS,
  VALUE_PENDING_TIMEOUT_MS,
} from "../src/lib/crosshairTimings";

/**
 * Deterministic stand-in for window.setTimeout/clearTimeout. `advance` fires
 * every timer due within the window, in due order, so nested scheduling from a
 * callback behaves like it would in a real event loop.
 */
function makeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimeout(fn: () => void, ms: number): number {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id: number): void {
      timers.delete(id);
    },
    advance(ms: number): void {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = target;
    },
    get pendingCount(): number {
      return timers.size;
    },
  };
}

function makeMachine() {
  const clock = makeClock();
  const machine = new CrosshairStateMachine({
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
    clearTimeout: (id) => clock.clearTimeout(id),
  });
  return { clock, machine };
}

/** Drive the machine from HIDDEN to SETTLED the way a real pan does. */
function panAndRelease(machine: CrosshairStateMachine): void {
  machine.setTouchCount(1);
  machine.setTouchCount(0);
  machine.movementEnd();
}

describe("crosshair state derivations", () => {
  it("renders the crosshair in every state but HIDDEN", () => {
    expect(isCrosshairVisible("HIDDEN")).toBe(false);
    expect(isCrosshairVisible("ACTIVE")).toBe(true);
    expect(isCrosshairVisible("SETTLED")).toBe(true);
    expect(isCrosshairVisible("PINNED")).toBe(true);
  });

  it("offers the action only once the map has stopped", () => {
    expect(isCrosshairActionable("HIDDEN")).toBe(false);
    expect(isCrosshairActionable("ACTIVE")).toBe(false);
    expect(isCrosshairActionable("SETTLED")).toBe(true);
    expect(isCrosshairActionable("PINNED")).toBe(true);
  });
});

describe("CrosshairStateMachine — transition table", () => {
  it("starts HIDDEN", () => {
    const { machine } = makeMachine();
    expect(machine.state).toBe("HIDDEN");
  });

  it("HIDDEN -> ACTIVE on touchstart", () => {
    const { machine } = makeMachine();
    machine.setTouchCount(1);
    expect(machine.state).toBe("ACTIVE");
  });

  it("HIDDEN -> ACTIVE on a programmatic gesture start", () => {
    const { machine } = makeMachine();
    machine.gestureStart();
    expect(machine.state).toBe("ACTIVE");
  });

  it("ACTIVE -> SETTLED once movement ends and the finger is up", () => {
    const { machine } = makeMachine();
    panAndRelease(machine);
    expect(machine.state).toBe("SETTLED");
    expect(machine.hidePending).toBe(true);
  });

  it("SETTLED -> HIDDEN when the hide timer elapses", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 1);
    expect(machine.state).toBe("SETTLED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("SETTLED -> ACTIVE on a new gesture, cancelling the hide", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.gestureStart();
    expect(machine.state).toBe("ACTIVE");
    expect(machine.hidePending).toBe(false);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("ACTIVE");
  });

  it("SETTLED -> PINNED on a reticle tap", () => {
    const { machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    expect(machine.state).toBe("PINNED");
  });

  it("HIDDEN -> SETTLED on a stationary tap", () => {
    const { machine } = makeMachine();
    // A tap is still a touchstart first, so it passes through ACTIVE.
    machine.setTouchCount(1);
    machine.setTouchCount(0);
    machine.stationaryTap();
    expect(machine.state).toBe("SETTLED");
    expect(machine.hidePending).toBe(true);
  });

  it("PINNED -> HIDDEN on dismiss (tap outside / Esc)", () => {
    const { machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    machine.dismiss();
    expect(machine.state).toBe("HIDDEN");
  });

  it("PINNED -> ACTIVE on a pan, rather than hiding mid-gesture", () => {
    // Documented deviation from the original table: hiding here would break the
    // rule that the crosshair never disappears while a finger is down.
    const { machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    machine.setTouchCount(1);
    expect(machine.state).toBe("ACTIVE");
  });
});

describe("CrosshairStateMachine — never hides while a finger is down", () => {
  it("does not settle on moveend while a finger is still on the screen", () => {
    const { clock, machine } = makeMachine();
    machine.setTouchCount(1);
    machine.movementEnd();
    expect(machine.state).toBe("ACTIVE");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("ACTIVE");
  });

  it("settles once the last finger lifts after movement already ended", () => {
    const { machine } = makeMachine();
    machine.setTouchCount(2);
    machine.movementEnd();
    machine.setTouchCount(1);
    expect(machine.state).toBe("ACTIVE");
    machine.setTouchCount(0);
    expect(machine.state).toBe("SETTLED");
  });

  it("keeps the crosshair up when a finger lands during the grace window", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 100);
    machine.setTouchCount(1);
    expect(machine.state).toBe("ACTIVE");
    // The old timer must be gone, not merely superseded.
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("ACTIVE");
  });

  it("restarts the full grace window after the interrupting touch, no flicker", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 100);
    machine.setTouchCount(1);
    machine.setTouchCount(0);
    machine.movementEnd();
    expect(machine.state).toBe("SETTLED");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 1);
    expect(machine.state).toBe("SETTLED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("emits no intermediate HIDDEN when a gesture interrupts the grace window", () => {
    const { clock, machine } = makeMachine();
    const seen: CrosshairState[] = [];
    machine.subscribe((state) => seen.push(state));
    panAndRelease(machine);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 50);
    machine.gestureStart();
    expect(seen).toEqual(["ACTIVE", "SETTLED", "ACTIVE"]);
  });
});

describe("CrosshairStateMachine — value still resolving", () => {
  it("defers the hide while the value is pending, then uses the short delay", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.setValuePending(true);
    // Well past the grace window, but short of the watchdog that would give up
    // on the value — so the deferral here is the pending flag, nothing else.
    expect(VALUE_PENDING_TIMEOUT_MS).toBeGreaterThan(CROSSHAIR_HIDE_DELAY_MS);
    clock.advance(VALUE_PENDING_TIMEOUT_MS - 1);
    expect(machine.state).toBe("SETTLED");

    machine.setValuePending(false);
    clock.advance(CROSSHAIR_HIDE_DELAY_SHORT_MS - 1);
    expect(machine.state).toBe("SETTLED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("hides normally when the value resolves before the timer fires", () => {
    const { clock, machine } = makeMachine();
    machine.setValuePending(true);
    panAndRelease(machine);
    machine.setValuePending(false);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
  });

  it("gives up on a value that never resolves rather than staying visible", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.setValuePending(true);
    clock.advance(VALUE_PENDING_TIMEOUT_MS - 1);
    expect(machine.state).toBe("SETTLED");
    // Watchdog fires, standing in for the request aborting; the shortened
    // window then runs to completion.
    clock.advance(1 + CROSSHAIR_HIDE_DELAY_SHORT_MS);
    expect(machine.state).toBe("HIDDEN");
  });

  it("cancels the watchdog once the value resolves", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.setValuePending(true);
    machine.setValuePending(false);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
    expect(clock.pendingCount).toBe(0);
  });

  it("leaves no watchdog behind on destroy", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.setValuePending(true);
    expect(clock.pendingCount).toBeGreaterThan(0);
    machine.destroy();
    expect(clock.pendingCount).toBe(0);
  });

  it("drops an owed hide when a new gesture arrives while still pending", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.setValuePending(true);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 2);
    machine.gestureStart();
    machine.setValuePending(false);
    expect(machine.state).toBe("ACTIVE");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("ACTIVE");
  });
});

describe("CrosshairStateMachine — external interaction (timeline scrub)", () => {
  it("summons the crosshair from HIDDEN with a fresh grace window", () => {
    const { clock, machine } = makeMachine();
    machine.externalInteraction();
    expect(machine.state).toBe("SETTLED");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 1);
    expect(machine.state).toBe("SETTLED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("restarts the grace window when scrubbing while SETTLED", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 100);
    machine.externalInteraction();
    expect(machine.state).toBe("SETTLED");
    // Would already have hidden had the window not restarted.
    clock.advance(200);
    expect(machine.state).toBe("SETTLED");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
  });

  it("stays ACTIVE when scrubbing mid-gesture", () => {
    const { machine } = makeMachine();
    machine.setTouchCount(1);
    machine.externalInteraction();
    expect(machine.state).toBe("ACTIVE");
  });

  it("leaves a pinned crosshair pinned", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    machine.externalInteraction();
    expect(machine.state).toBe("PINNED");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("PINNED");
  });
});

describe("CrosshairStateMachine — holds", () => {
  it("does not hide while the meteogram is open, and re-grants a full window", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    clock.advance(100);
    machine.acquireHold("meteogram-open");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 5);
    expect(machine.state).toBe("SETTLED");

    machine.releaseHold("meteogram-open");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS - 1);
    expect(machine.state).toBe("SETTLED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("holds for the duration of a press on the action chip", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.acquireHold("action-press");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 3);
    expect(machine.state).toBe("SETTLED");
    machine.releaseHold("action-press");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
  });

  it("requires every hold to be released before hiding resumes", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.acquireHold("action-press");
    machine.acquireHold("meteogram-open");
    machine.releaseHold("action-press");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 3);
    expect(machine.state).toBe("SETTLED");
    machine.releaseHold("meteogram-open");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
  });

  it("ignores release of a hold that was never acquired", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.releaseHold("never-taken");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS);
    expect(machine.state).toBe("HIDDEN");
  });
});

describe("CrosshairStateMachine — pinning", () => {
  it("does not auto-dismiss while PINNED_AUTO_DISMISS_MS is 0", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    clock.advance(60 * 60 * 1000);
    expect(machine.state).toBe("PINNED");
    expect(clock.pendingCount).toBe(0);
  });

  it("auto-dismisses when a timeout is configured", () => {
    const clock = makeClock();
    const machine = new CrosshairStateMachine({
      timings: { PINNED_AUTO_DISMISS_MS: 5000 },
      setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
      clearTimeout: (id) => clock.clearTimeout(id),
    });
    panAndRelease(machine);
    machine.reticleTap();
    clock.advance(4999);
    expect(machine.state).toBe("PINNED");
    clock.advance(1);
    expect(machine.state).toBe("HIDDEN");
  });

  it("ignores a reticle tap while hidden", () => {
    const { machine } = makeMachine();
    machine.reticleTap();
    expect(machine.state).toBe("HIDDEN");
  });

  it("treats a second reticle tap as idempotent", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    machine.reticleTap();
    expect(machine.state).toBe("PINNED");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);
    expect(machine.state).toBe("PINNED");
  });

  it("ignores a stationary tap while pinned (dismiss handles that case)", () => {
    const { machine } = makeMachine();
    panAndRelease(machine);
    machine.reticleTap();
    machine.stationaryTap();
    expect(machine.state).toBe("PINNED");
  });
});

describe("CrosshairStateMachine — teardown", () => {
  it("clears a pending hide timer on destroy", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    expect(clock.pendingCount).toBe(1);
    machine.destroy();
    expect(clock.pendingCount).toBe(0);
  });

  it("emits nothing and changes nothing after destroy", () => {
    const { clock, machine } = makeMachine();
    panAndRelease(machine);
    const listener = vi.fn();
    machine.subscribe(listener);
    machine.destroy();

    machine.gestureStart();
    machine.movementEnd();
    machine.setTouchCount(1);
    machine.setTouchCount(0);
    machine.stationaryTap();
    machine.reticleTap();
    machine.externalInteraction();
    machine.dismiss();
    machine.setValuePending(true);
    machine.acquireHold("x");
    machine.releaseHold("x");
    clock.advance(CROSSHAIR_HIDE_DELAY_MS * 10);

    expect(listener).not.toHaveBeenCalled();
    expect(machine.state).toBe("SETTLED");
    expect(clock.pendingCount).toBe(0);
  });

  it("is safe to destroy twice", () => {
    const { machine } = makeMachine();
    panAndRelease(machine);
    machine.destroy();
    expect(() => machine.destroy()).not.toThrow();
  });

  it("stops notifying an unsubscribed listener", () => {
    const { machine } = makeMachine();
    const listener = vi.fn();
    const unsubscribe = machine.subscribe(listener);
    machine.gestureStart();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    machine.movementEnd();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("CrosshairStateMachine — listener notification", () => {
  it("reports the previous state alongside the new one", () => {
    const { machine } = makeMachine();
    const seen: Array<[CrosshairState, CrosshairState]> = [];
    machine.subscribe((state, previous) => seen.push([previous, state]));
    panAndRelease(machine);
    expect(seen).toEqual([
      ["HIDDEN", "ACTIVE"],
      ["ACTIVE", "SETTLED"],
    ]);
  });

  it("does not notify for a no-op transition", () => {
    const { machine } = makeMachine();
    machine.gestureStart();
    const listener = vi.fn();
    machine.subscribe(listener);
    machine.gestureStart();
    expect(listener).not.toHaveBeenCalled();
  });

  it("survives a listener unsubscribing during notification", () => {
    const { machine } = makeMachine();
    const second = vi.fn();
    const unsubscribeFirst = machine.subscribe(() => unsubscribeFirst());
    machine.subscribe(second);
    expect(() => machine.gestureStart()).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
