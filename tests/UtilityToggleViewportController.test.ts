import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UtilityToggleViewportController } from "../src/controllers/UtilityToggleViewportController";

function makeMqStub(matches = false) {
  return {
    matches,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

function makeElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function makeMapWrap(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

let mqStub: ReturnType<typeof makeMqStub>;

beforeEach(() => {
  mqStub = makeMqStub();
  vi.stubGlobal("matchMedia", () => mqStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("UtilityToggleViewportController", () => {
  it("constructs without throwing when element is null", () => {
    expect(
      () =>
        new UtilityToggleViewportController({
          element: null,
          mapWrap: makeMapWrap(),
          safeMargin: 12,
        }),
    ).not.toThrow();
  });

  it("init() does nothing when element is null", () => {
    const ctrl = new UtilityToggleViewportController({
      element: null,
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    expect(() => ctrl.init()).not.toThrow();
  });

  it("init() registers resize and orientationchange listeners", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const ctrl = new UtilityToggleViewportController({
      element: makeElement(),
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    ctrl.init();
    const events = addSpy.mock.calls.map(([event]) => event);
    expect(events).toContain("resize");
    expect(events).toContain("orientationchange");
    addSpy.mockRestore();
  });

  it("destroy() removes the registered listeners", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const ctrl = new UtilityToggleViewportController({
      element: makeElement(),
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    ctrl.init();
    ctrl.destroy();
    const events = removeSpy.mock.calls.map(([event]) => event);
    expect(events).toContain("resize");
    expect(events).toContain("orientationchange");
    removeSpy.mockRestore();
  });

  it("destroy() is safe to call without a prior init()", () => {
    const ctrl = new UtilityToggleViewportController({
      element: makeElement(),
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    expect(() => ctrl.destroy()).not.toThrow();
  });

  it("destroy() is idempotent", () => {
    const ctrl = new UtilityToggleViewportController({
      element: makeElement(),
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    ctrl.init();
    expect(() => {
      ctrl.destroy();
      ctrl.destroy();
    }).not.toThrow();
  });

  it("sync() clears the right style in landscape mode", () => {
    mqStub = makeMqStub(true); // landscape matches
    vi.stubGlobal("matchMedia", () => mqStub);
    const el = makeElement();
    el.style.right = "20px";
    const ctrl = new UtilityToggleViewportController({
      element: el,
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    ctrl.sync();
    expect(el.style.right).toBe("");
  });

  it("sync() sets a right inset in non-landscape mode", () => {
    mqStub = makeMqStub(false);
    const el = makeElement();
    const ctrl = new UtilityToggleViewportController({
      element: el,
      mapWrap: makeMapWrap(),
      safeMargin: 12,
    });
    ctrl.sync();
    expect(el.style.right).toMatch(/px$/);
  });
});
