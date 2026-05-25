import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getFixedRightInset,
  getVisibleViewportRect,
} from "../src/lib/visibleViewport";

describe("visibleViewport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes visible viewport from client width when visualViewport is unavailable", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 444,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
    const rect = getVisibleViewportRect(null);
    expect(rect.right).toBe(444);
    expect(rect.width).toBe(444);
  });

  it("intersects the viewport with the map bounds", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { offsetLeft: 0, offsetTop: 0, width: 444, height: 900 },
    });
    const mapWrap = document.createElement("div");
    vi.spyOn(mapWrap, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 800,
      width: 400,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const rect = getVisibleViewportRect(mapWrap);
    expect(rect.right).toBe(400);
    expect(rect.bottom).toBe(800);
  });

  it("adds the layout-visible delta to the fixed right inset", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 467,
    });
    expect(getFixedRightInset(444, 12)).toBe(35);
  });
});
