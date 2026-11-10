import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KEYMAP,
  handlesOwnArrowKeys,
  keyAction,
  listenForKeyActions,
} from "../src/lib/keymap";

const press = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true, ...init });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("KEYMAP", () => {
  it("maps ← and → to timeline steps, and nothing else yet", () => {
    expect(KEYMAP).toEqual({
      ArrowLeft: "timeline.stepBack",
      ArrowRight: "timeline.stepForward",
    });
  });
});

describe("handlesOwnArrowKeys", () => {
  const make = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    return host.firstElementChild as HTMLElement;
  };

  it("is true for text fields, textareas, selects and editable regions", () => {
    for (const type of ["text", "search", "number", "email", "range", "radio"]) {
      expect(handlesOwnArrowKeys(make(`<input type="${type}">`)), type).toBe(true);
    }
    expect(handlesOwnArrowKeys(make("<textarea></textarea>"))).toBe(true);
    expect(handlesOwnArrowKeys(make("<select></select>"))).toBe(true);
    const editable = make('<div contenteditable="true"><span>x</span></div>');
    expect(handlesOwnArrowKeys(editable.firstElementChild)).toBe(true);
  });

  it("is true inside an arrow-driven ARIA widget", () => {
    const slider = make('<div role="slider" tabindex="0"><span>12:00</span></div>');
    expect(handlesOwnArrowKeys(slider)).toBe(true);
    expect(handlesOwnArrowKeys(slider.firstElementChild)).toBe(true);
  });

  it("is false for buttons, checkboxes, plain elements and no target", () => {
    expect(handlesOwnArrowKeys(make('<input type="checkbox">'))).toBe(false);
    expect(handlesOwnArrowKeys(make('<input type="button">'))).toBe(false);
    expect(handlesOwnArrowKeys(make("<button>Play</button>"))).toBe(false);
    expect(handlesOwnArrowKeys(make("<canvas></canvas>"))).toBe(false);
    expect(handlesOwnArrowKeys(null)).toBe(false);
    expect(handlesOwnArrowKeys(window)).toBe(false);
  });
});

describe("keyAction", () => {
  it("names the action for a mapped key on a plain element", () => {
    const canvas = document.body.appendChild(document.createElement("canvas"));
    const event = press("ArrowLeft");
    let seen: string | null = "unset";
    canvas.addEventListener("keydown", (e) => (seen = keyAction(e)));
    canvas.dispatchEvent(event);
    expect(seen).toBe("timeline.stepBack");
  });

  it("ignores unmapped keys, modified keys and keys already handled", () => {
    expect(keyAction(press("ArrowUp"))).toBeNull();
    expect(keyAction(press("+"))).toBeNull();
    expect(keyAction(press("ArrowRight", { altKey: true }))).toBeNull();
    expect(keyAction(press("ArrowRight", { metaKey: true }))).toBeNull();
    expect(keyAction(press("ArrowRight", { ctrlKey: true }))).toBeNull();
    const handled = press("ArrowRight");
    handled.preventDefault();
    expect(keyAction(handled)).toBeNull();
  });
});

describe("listenForKeyActions", () => {
  it("leaves a key from an editable field inside a shadow root alone", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    input.type = "search";
    root.appendChild(input);
    const run = vi.fn(() => true);
    const stop = listenForKeyActions(window, run);
    try {
      const event = press("ArrowLeft");
      input.dispatchEvent(event);
      // Retargeted: outside the shadow root the event seems to come from the host.
      expect(event.target).toBe(host);
      expect(run).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    } finally {
      stop();
    }
  });

  it("leaves a key on a slider inside a shadow root alone", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = host.attachShadow({ mode: "open" });
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    slider.tabIndex = 0;
    root.appendChild(slider);
    const run = vi.fn(() => true);
    const sliderHandler = vi.fn();
    slider.addEventListener("keydown", sliderHandler);
    const stop = listenForKeyActions(window, run);
    try {
      slider.dispatchEvent(press("ArrowRight"));
      expect(run).not.toHaveBeenCalled();
      expect(sliderHandler).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });

  it("consumes a key it acts on, before listeners further down see it", () => {
    const container = document.body.appendChild(document.createElement("div"));
    const canvas = container.appendChild(document.createElement("canvas"));
    const below = vi.fn();
    container.addEventListener("keydown", below);
    document.addEventListener("keydown", below);
    const run = vi.fn(() => true);
    const stop = listenForKeyActions(window, run);
    try {
      const event = press("ArrowRight");
      canvas.dispatchEvent(event);
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith("timeline.stepForward");
      expect(event.defaultPrevented).toBe(true);
      expect(below).not.toHaveBeenCalled();
    } finally {
      stop();
      document.removeEventListener("keydown", below);
    }
  });

  it("lets the key go on when the action declines it", () => {
    const container = document.body.appendChild(document.createElement("div"));
    const canvas = container.appendChild(document.createElement("canvas"));
    const below = vi.fn();
    container.addEventListener("keydown", below);
    const stop = listenForKeyActions(window, () => false);
    try {
      const event = press("ArrowRight");
      canvas.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(below).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });

  it("lets ↑, ↓, + and − through to the map", () => {
    const container = document.body.appendChild(document.createElement("div"));
    const canvas = container.appendChild(document.createElement("canvas"));
    const mapHandler = vi.fn();
    container.addEventListener("keydown", mapHandler);
    const run = vi.fn(() => true);
    const stop = listenForKeyActions(window, run);
    try {
      for (const key of ["ArrowUp", "ArrowDown", "+", "-"]) canvas.dispatchEvent(press(key));
      expect(run).not.toHaveBeenCalled();
      expect(mapHandler).toHaveBeenCalledTimes(4);
    } finally {
      stop();
    }
  });

  it("stops listening when disposed", () => {
    const canvas = document.body.appendChild(document.createElement("canvas"));
    const run = vi.fn(() => true);
    listenForKeyActions(window, run)();
    canvas.dispatchEvent(press("ArrowRight"));
    expect(run).not.toHaveBeenCalled();
  });
});
