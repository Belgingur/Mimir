import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  readMapPanelPoint,
  readMapPanelState,
  writeMapPanelPoint,
  clearMapPanelPoint,
} from "../src/features/meteogram/mapPanelState";

describe("mapPanelState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("merges point without clobbering widget-owned keys", () => {
    localStorage.setItem(
      "mimirMapPanelState",
      JSON.stringify({ scrubIdx: 5, view: "graph" }),
    );
    writeMapPanelPoint(64.1, -21.9);
    expect(readMapPanelState()).toEqual({
      scrubIdx: 5,
      view: "graph",
      point: { lat: 64.1, lon: -21.9 },
    });
  });

  it("readMapPanelPoint returns null when missing or invalid", () => {
    expect(readMapPanelPoint()).toBeNull();
    localStorage.setItem(
      "mimirMapPanelState",
      JSON.stringify({ point: { lat: NaN, lon: 0 } }),
    );
    expect(readMapPanelPoint()).toBeNull();
  });

  it("clearMapPanelPoint removes point without clobbering widget keys", () => {
    localStorage.setItem(
      "mimirMapPanelState",
      JSON.stringify({
        point: { lat: 64, lon: -21 },
        scrubIdx: 3,
        panelPos: { x: 10, y: 20 },
      }),
    );
    clearMapPanelPoint();
    expect(readMapPanelState()).toEqual({
      scrubIdx: 3,
      panelPos: { x: 10, y: 20 },
    });
    expect(readMapPanelPoint()).toBeNull();
  });
});
