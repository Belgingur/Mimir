import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissBootSplash } from "../src/lib/bootSplash";

describe("dismissBootSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML =
      '<div id="boot-splash" class="boot-splash" role="status"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fades the splash out, then removes it", () => {
    dismissBootSplash();
    const el = document.getElementById("boot-splash");
    expect(el?.classList.contains("is-done")).toBe(true);
    expect(el?.hasAttribute("role")).toBe(false);
    vi.advanceTimersByTime(500);
    expect(document.getElementById("boot-splash")).toBeNull();
  });

  it("is safe to call again, or with no splash on the page", () => {
    dismissBootSplash();
    expect(() => dismissBootSplash()).not.toThrow();
    vi.advanceTimersByTime(500);
    expect(() => dismissBootSplash()).not.toThrow();
  });
});
