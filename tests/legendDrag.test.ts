import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { setupLegendDrag } from "../src/lib/legendDrag";

beforeAll(() => {
  if (typeof globalThis.PointerEvent === "undefined") {
    (globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit & MouseEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    };
  }
});

describe("setupLegendDrag", () => {
  let card: HTMLDivElement;
  let constraint: HTMLElement;

  beforeEach(() => {
    card = document.createElement("div");
    constraint = document.createElement("div");

    vi.spyOn(constraint, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      right: 300,
      bottom: 200,
      width: 200,
      height: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    setupLegendDrag(card, constraint);
  });

  it("adds is-dragging class on pointerdown", () => {
    const event = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 0,
    });
    card.dispatchEvent(event);
    expect(card.classList.contains("is-dragging")).toBe(true);
  });

  it("ignores non-primary button", () => {
    const event = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 2,
    });
    card.dispatchEvent(event);
    expect(card.classList.contains("is-dragging")).toBe(false);
  });

  it("updates position on pointermove after pointerdown", () => {
    const down = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 0,
    });
    card.dispatchEvent(down);

    const move = new PointerEvent("pointermove", {
      clientX: 200,
      clientY: 200,
    });
    window.dispatchEvent(move);

    expect(card.style.left).not.toBe("");
    expect(card.style.top).not.toBe("");
    expect(card.style.right).toBe("auto");
    expect(card.style.bottom).toBe("auto");
  });

  it("removes is-dragging on pointerup", () => {
    const down = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 0,
    });
    card.dispatchEvent(down);
    expect(card.classList.contains("is-dragging")).toBe(true);

    window.dispatchEvent(new PointerEvent("pointerup"));
    expect(card.classList.contains("is-dragging")).toBe(false);
  });

  it("removes is-dragging on pointercancel", () => {
    const down = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 0,
    });
    card.dispatchEvent(down);

    window.dispatchEvent(new PointerEvent("pointercancel"));
    expect(card.classList.contains("is-dragging")).toBe(false);
  });

  it("clamps position to constraint boundaries", () => {
    const down = new PointerEvent("pointerdown", {
      clientX: 150,
      clientY: 120,
      button: 0,
    });
    card.dispatchEvent(down);

    const move = new PointerEvent("pointermove", {
      clientX: -500,
      clientY: -500,
    });
    window.dispatchEvent(move);

    expect(parseInt(card.style.left)).toBeGreaterThanOrEqual(0);
    expect(parseInt(card.style.top)).toBeGreaterThanOrEqual(0);
  });

  it("does not move when not dragging", () => {
    const move = new PointerEvent("pointermove", {
      clientX: 200,
      clientY: 200,
    });
    window.dispatchEvent(move);
    expect(card.style.left).toBe("");
  });
});
