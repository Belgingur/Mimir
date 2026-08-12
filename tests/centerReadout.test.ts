import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The readout samples already-decoded raster data; the sampling itself is not
// under test here, so it is pinned to a constant.
vi.mock("../src/lib/gridSampling", () => ({
  sampleInhouseScalarAtCoord: () => 12,
}));

import { initCenterReadout, type CenterReadout } from "../src/lib/centerReadout";
import type { InhouseCatalogController } from "../src/controllers/InhouseCatalogController";
import type { UiState } from "../src/lib/inhouseTypes";

// ── Fakes ────────────────────────────────────────────────────────────────────

type MapListener = (...args: unknown[]) => void;

function makeMap(container: HTMLElement) {
  const handlers = new Map<string, Set<MapListener>>();
  let centre = { lng: -21.9, lat: 64.14 };
  return {
    getContainer: () => container,
    getCenter: () => centre,
    setCentre(next: { lng: number; lat: number }) {
      centre = next;
    },
    on(type: string, fn: MapListener) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(fn);
    },
    off(type: string, fn: MapListener) {
      handlers.get(type)?.delete(fn);
    },
    emit(type: string) {
      for (const fn of [...(handlers.get(type) ?? [])]) fn();
    },
    listenerCount(): number {
      let total = 0;
      for (const set of handlers.values()) total += set.size;
      return total;
    },
  };
}

const layer = {
  variable: "air_temperature_2m",
  scalar: new Float32Array([12]),
  manifest: {
    bounds: [-30, 60, -10, 70] as [number, number, number, number],
    srcMax: 30,
    unit: "C",
  },
};

function makeCatalog(): InhouseCatalogController {
  return {
    findInhouseLayerByCandidates: () => layer,
    inhouseLayers: [layer],
    findPreferredInhouseWindVectorLayer: () => null,
    sampleInhouseVectorAtCoord: () => ({ value: null, direction: null }),
  } as unknown as InhouseCatalogController;
}

function makeDeps(map: ReturnType<typeof makeMap>) {
  return {
    map: map as never,
    getCatalogController: () => makeCatalog(),
    getViewMode: () => "forecast" as const,
    getUiState: () => ({ layerMode: "temperature" }) as unknown as UiState,
    formatCardinalDirection: () => null,
  };
}

interface FakeTouch {
  identifier: number;
  clientX: number;
  clientY: number;
}

function touchEvent(
  type: string,
  opts: {
    touches?: FakeTouch[];
    changedTouches?: FakeTouch[];
    timeStamp?: number;
  } = {},
): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", { value: opts.touches ?? [] });
  Object.defineProperty(event, "changedTouches", {
    value: opts.changedTouches ?? [],
  });
  Object.defineProperty(event, "timeStamp", { value: opts.timeStamp ?? 0 });
  return event;
}

// ── Harness ──────────────────────────────────────────────────────────────────

const CONTAINER_RECT = { left: 0, top: 0, width: 360, height: 640 };
/** Map centre for CONTAINER_RECT — where the reticle hit area sits. */
const CENTRE = { clientX: 180, clientY: 320 };

let container: HTMLElement;
let map: ReturnType<typeof makeMap>;
let readout: CenterReadout | null = null;

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  // Sample synchronously so assertions do not have to await a frame.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  container = document.createElement("div");
  container.getBoundingClientRect = () =>
    ({ ...CONTAINER_RECT, right: 360, bottom: 640 }) as DOMRect;
  document.body.appendChild(container);
  map = makeMap(container);
});

afterEach(() => {
  readout?.destroy();
  readout = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

function init(): CenterReadout {
  readout = initCenterReadout(makeDeps(map));
  return readout;
}

const root = () =>
  container.querySelector<HTMLElement>(".center-readout") as HTMLElement;
const group = () =>
  container.querySelector<HTMLElement>(".center-readout__group");
const slot = () =>
  container.querySelector<HTMLElement>(".center-readout__action");
const value = () =>
  container.querySelector<HTMLElement>(".center-readout__value");
const state = () => root().dataset.crosshairState;

/** touchstart → touchend at a point, without moving. */
function tapAt(point: { clientX: number; clientY: number }): void {
  const touch = { identifier: 1, ...point };
  container.dispatchEvent(
    touchEvent("touchstart", { touches: [touch], timeStamp: 0 }),
  );
  container.dispatchEvent(
    touchEvent("touchend", { changedTouches: [touch], timeStamp: 80 }),
  );
}

/** A one-finger drag that moves the map and then settles. */
function panAndSettle(): void {
  const start = { identifier: 1, clientX: 40, clientY: 40 };
  container.dispatchEvent(
    touchEvent("touchstart", { touches: [start], timeStamp: 0 }),
  );
  map.emit("movestart");
  container.dispatchEvent(
    touchEvent("touchmove", {
      touches: [{ identifier: 1, clientX: 200, clientY: 300 }],
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 300 }],
      timeStamp: 60,
    }),
  );
  container.dispatchEvent(
    touchEvent("touchend", {
      changedTouches: [{ identifier: 1, clientX: 200, clientY: 300 }],
      timeStamp: 120,
    }),
  );
  map.emit("moveend");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("centerReadout — transient crosshair, resting state", () => {
  it("renders nothing visible until the map is touched", () => {
    init();
    expect(root()).toBeTruthy();
    expect(state()).toBe("HIDDEN");
    expect(root().classList.contains("is-visible")).toBe(false);
    expect(root().classList.contains("is-actionable")).toBe(false);
  });

  it("keeps the whole overlay non-interactive apart from the action slot", () => {
    init();
    // The reticle must not be an interactive element: a pinch that begins on it
    // has to reach MapLibre.
    const reticle = container.querySelector(".center-readout__reticle");
    expect(reticle?.tagName).toBe("SPAN");
    expect(container.querySelector(".center-readout button")).toBeNull();
  });
});

describe("centerReadout — transient crosshair, lifecycle", () => {
  it("appears on touchstart", () => {
    init();
    container.dispatchEvent(
      touchEvent("touchstart", {
        touches: [{ identifier: 1, clientX: 40, clientY: 40 }],
      }),
    );
    expect(state()).toBe("ACTIVE");
    expect(root().classList.contains("is-visible")).toBe(true);
    // The action is withheld mid-gesture so it cannot be hit while panning.
    expect(root().classList.contains("is-actionable")).toBe(false);
  });

  it("settles once the pan ends and the finger is up", () => {
    init();
    panAndSettle();
    expect(state()).toBe("SETTLED");
    expect(root().classList.contains("is-actionable")).toBe(true);
  });

  it("shows the sampled value in the pill", () => {
    init();
    panAndSettle();
    expect(value()?.textContent).toBe("12 °C");
    expect(root().classList.contains("has-value")).toBe(true);
  });

  it("pins on a tap inside the reticle hit area", () => {
    init();
    panAndSettle();
    tapAt(CENTRE);
    expect(state()).toBe("PINNED");
  });

  it("dismisses a pinned crosshair on a tap outside the reticle", () => {
    init();
    panAndSettle();
    tapAt(CENTRE);
    tapAt({ clientX: 20, clientY: 40 });
    expect(state()).toBe("HIDDEN");
  });

  it("un-pins into a normal fade when a pan starts while pinned", () => {
    init();
    panAndSettle();
    tapAt(CENTRE);
    expect(state()).toBe("PINNED");
    // A pan must never hide the crosshair mid-gesture; it rejoins the lifecycle.
    panAndSettle();
    expect(state()).toBe("SETTLED");
  });

  it("dismisses a pinned crosshair on Escape", () => {
    init();
    panAndSettle();
    tapAt(CENTRE);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(state()).toBe("HIDDEN");
  });

  it("summons the crosshair on an external interaction (timeline scrub)", () => {
    const handle = init();
    expect(state()).toBe("HIDDEN");
    handle.notifyInteraction();
    expect(state()).toBe("SETTLED");
  });
});

describe("centerReadout — reserved action slot", () => {
  it("keeps the slot in the layout in every state", () => {
    init();
    const slotEl = slot();
    expect(slotEl).toBeTruthy();
    expect(slotEl?.parentElement).toBe(group());

    // ACTIVE -> SETTLED -> ACTIVE: the slot is never detached, so the pill it
    // sits beside cannot shift sideways when the button fades in or out.
    container.dispatchEvent(
      touchEvent("touchstart", {
        touches: [{ identifier: 1, clientX: 40, clientY: 40 }],
      }),
    );
    expect(state()).toBe("ACTIVE");
    expect(slot()).toBe(slotEl);
    expect(slotEl?.parentElement).toBe(group());

    panAndSettle();
    expect(state()).toBe("SETTLED");
    expect(slot()).toBe(slotEl);

    map.emit("movestart");
    expect(state()).toBe("ACTIVE");
    expect(slot()).toBe(slotEl);
    expect(slotEl?.parentElement).toBe(group());
  });

  it("orders the pill before the slot inside one group", () => {
    init();
    const children = Array.from(group()?.children ?? []);
    expect(children.map((el) => el.className)).toEqual([
      "center-readout__value",
      "center-readout__action",
    ]);
  });

  it("hides the slot from assistive tech until the action is offered", () => {
    init();
    expect(slot()?.getAttribute("aria-hidden")).toBe("true");
    expect(slot()?.hasAttribute("inert")).toBe(true);

    panAndSettle();
    expect(slot()?.getAttribute("aria-hidden")).toBeNull();
    expect(slot()?.hasAttribute("inert")).toBe(false);

    map.emit("movestart");
    expect(slot()?.getAttribute("aria-hidden")).toBe("true");
    expect(slot()?.hasAttribute("inert")).toBe(true);
  });

  it("mounts the meteogram button into the slot and keeps it there", () => {
    const handle = init();
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Open meteogram for this location");
    expect(handle.mountAction(button, () => true)).toBe(true);
    expect(button.parentElement).toBe(slot());

    panAndSettle();
    map.emit("movestart");
    map.emit("moveend");
    expect(button.parentElement).toBe(slot());
  });
});

describe("centerReadout — the whole group opens the meteogram", () => {
  /**
   * jsdom has no layout, so the group and chip rects are declared explicitly.
   * Group spans x 120–240, y 250–294; the chip is its right-hand 44px.
   */
  const GROUP_RECT = { left: 120, top: 250, right: 240, bottom: 294 };
  const CHIP_RECT = { left: 196, top: 250, right: 240, bottom: 294 };
  /** Inside the group, left of the chip — i.e. on the value pill. */
  const ON_PILL = { clientX: 150, clientY: 272 };

  function mountButton(
    handle: CenterReadout,
    isAvailable: () => boolean = () => true,
  ) {
    const button = document.createElement("button");
    button.getBoundingClientRect = () => CHIP_RECT as DOMRect;
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    handle.mountAction(button, isAvailable);
    const groupEl = group() as HTMLElement;
    groupEl.getBoundingClientRect = () => GROUP_RECT as DOMRect;
    return { button, onClick };
  }

  it("opens the meteogram from a tap on the value pill", () => {
    const handle = init();
    const { onClick } = mountButton(handle);
    panAndSettle();
    tapAt(ON_PILL);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("opens the meteogram from a tap on the chip when it cannot self-activate", () => {
    // Touch devices: the chip is pointer-events:none (it would otherwise lose
    // its pointer events mid-gesture and never fire a click at all), so the
    // geometric path has to cover the chip's own rect too.
    const handle = init();
    const { button, onClick } = mountButton(handle);
    button.style.pointerEvents = "none";
    panAndSettle();
    tapAt({ clientX: 220, clientY: 272 });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire when the chip fires its own click", () => {
    // Fine pointers: the chip keeps real pointer events and has already fired;
    // the group hit-test must not fire a second time.
    const handle = init();
    const { button, onClick } = mountButton(handle);
    button.style.pointerEvents = "auto";
    panAndSettle();
    tapAt({ clientX: 220, clientY: 272 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores a pill tap while the map is still moving", () => {
    const handle = init();
    const { onClick } = mountButton(handle);
    // touchstart only: ACTIVE, no settle.
    container.dispatchEvent(
      touchEvent("touchstart", {
        touches: [{ identifier: 1, clientX: 40, clientY: 40 }],
      }),
    );
    expect(state()).toBe("ACTIVE");
    tapAt(ON_PILL);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores a pill tap when the button is not offered for this selection", () => {
    const handle = init();
    const { onClick } = mountButton(handle, () => false);
    panAndSettle();
    tapAt(ON_PILL);
    expect(onClick).not.toHaveBeenCalled();
    // Falls through to the ordinary stationary-tap behaviour.
    expect(state()).toBe("SETTLED");
  });

  it("still pins on a reticle tap rather than opening the meteogram", () => {
    const handle = init();
    const { onClick } = mountButton(handle);
    panAndSettle();
    tapAt(CENTRE);
    expect(onClick).not.toHaveBeenCalled();
    expect(state()).toBe("PINNED");
  });

  it("opens the meteogram from the pill while pinned", () => {
    const handle = init();
    const { onClick } = mountButton(handle);
    panAndSettle();
    tapAt(CENTRE);
    expect(state()).toBe("PINNED");
    tapAt(ON_PILL);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not treat a drag across the pill as a tap", () => {
    const handle = init();
    const { onClick } = mountButton(handle);
    panAndSettle();
    const start = { identifier: 1, ...ON_PILL };
    container.dispatchEvent(
      touchEvent("touchstart", { touches: [start], timeStamp: 0 }),
    );
    container.dispatchEvent(
      touchEvent("touchmove", {
        changedTouches: [
          { identifier: 1, clientX: ON_PILL.clientX + 60, clientY: 272 },
        ],
        timeStamp: 40,
      }),
    );
    container.dispatchEvent(
      touchEvent("touchend", {
        changedTouches: [
          { identifier: 1, clientX: ON_PILL.clientX + 60, clientY: 272 },
        ],
        timeStamp: 90,
      }),
    );
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("centerReadout — action point", () => {
  it("reports the coordinate the displayed value was sampled at", () => {
    const handle = init();
    panAndSettle();
    expect(handle.getActionPoint()).toEqual({ lng: -21.9, lat: 64.14 });
  });

  it("does not follow the map between the sample and the tap", () => {
    const handle = init();
    panAndSettle();
    // A frame of movement lands after the readout settled but before the user
    // reaches the button: the button must still open the point they saw.
    map.setCentre({ lng: 0, lat: 0 });
    expect(handle.getActionPoint()).toEqual({ lng: -21.9, lat: 64.14 });
  });

  it("has no action point before anything has been sampled", () => {
    const handle = init();
    expect(handle.getActionPoint()).toBeNull();
  });
});

describe("centerReadout — meteogram hold", () => {
  it("does not hide while the meteogram it launched is open", () => {
    vi.useFakeTimers();
    try {
      const handle = init();
      panAndSettle();
      handle.setMeteogramOpen(true);
      vi.advanceTimersByTime(60_000);
      expect(state()).toBe("SETTLED");

      handle.setMeteogramOpen(false);
      vi.advanceTimersByTime(60_000);
      expect(state()).toBe("HIDDEN");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("centerReadout — teardown", () => {
  it("removes the overlay and every map listener", () => {
    const handle = init();
    expect(map.listenerCount()).toBeGreaterThan(0);
    handle.destroy();
    readout = null;
    expect(container.querySelector(".center-readout")).toBeNull();
    expect(map.listenerCount()).toBe(0);
  });

  it("leaves no timer able to fire after unmount", () => {
    vi.useFakeTimers();
    try {
      const handle = init();
      panAndSettle();
      handle.destroy();
      readout = null;
      // A surviving hide timer would throw here, writing to detached DOM.
      expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops responding to touches after destroy", () => {
    const handle = init();
    const overlay = root();
    handle.destroy();
    readout = null;
    container.dispatchEvent(
      touchEvent("touchstart", {
        touches: [{ identifier: 1, clientX: 40, clientY: 40 }],
      }),
    );
    expect(overlay.dataset.crosshairState).toBe("HIDDEN");
  });
});

describe("centerReadout — flag off restores the previous behaviour", () => {
  it("builds the legacy always-visible structure", () => {
    vi.stubEnv("VITE_TRANSIENT_CROSSHAIR", "0");
    const handle = init();
    const overlay = root();
    expect(overlay.classList.contains("center-readout--transient")).toBe(false);
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    // Pill and ring as direct children, no group and no action slot.
    expect(Array.from(overlay.children).map((el) => el.className)).toEqual([
      "center-readout__value",
      "center-readout__cross",
    ]);
    expect(group()).toBeNull();
    expect(slot()).toBeNull();
    expect(
      handle.mountAction(document.createElement("button"), () => true),
    ).toBe(false);
  });

  it("never enters a crosshair state or reacts to touches", () => {
    vi.stubEnv("VITE_TRANSIENT_CROSSHAIR", "0");
    init();
    expect(root().dataset.crosshairState).toBeUndefined();
    container.dispatchEvent(
      touchEvent("touchstart", {
        touches: [{ identifier: 1, clientX: 40, clientY: 40 }],
      }),
    );
    expect(root().dataset.crosshairState).toBeUndefined();
    expect(root().classList.contains("is-visible")).toBe(false);
  });

  it("still reports a live map centre for the legacy trigger", () => {
    vi.stubEnv("VITE_TRANSIENT_CROSSHAIR", "0");
    const handle = init();
    expect(handle.getActionPoint()).toEqual({ lng: -21.9, lat: 64.14 });
    map.setCentre({ lng: 0, lat: 0 });
    expect(handle.getActionPoint()).toEqual({ lng: 0, lat: 0 });
  });
});
