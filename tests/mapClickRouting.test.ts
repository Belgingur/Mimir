import { describe, expect, it } from "vitest";
import { resolveMapClickTarget } from "../src/lib/mapClickRouting";

describe("resolveMapClickTarget", () => {
  it("routes GWES clicks to wavegram (even in waves mode)", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GWES",
        layerMode: "waves",
        meteogramEnabled: true,
      }),
    ).toBe("wavegram");
  });

  it("routes non-GWES forecast clicks to meteogram when enabled", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
        meteogramEnabled: true,
      }),
    ).toBe("meteogram");
  });

  it("does not route non-GWES forecast clicks when meteogram is disabled", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
        meteogramEnabled: false,
      }),
    ).toBe("none");
  });

  it("treats a missing meteogramEnabled flag as disabled", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
      }),
    ).toBe("none");
  });

  it("never opens a meteogram in waves mode for a non-GWES model", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "waves",
        meteogramEnabled: true,
      }),
    ).toBe("none");
  });

  it("does not open a meteogram outside forecast view (icons view)", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
        viewMode: "iconography",
        meteogramEnabled: true,
      }),
    ).toBe("none");
  });

  it("opens a meteogram in forecast view", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
        viewMode: "forecast",
        meteogramEnabled: true,
      }),
    ).toBe("meteogram");
  });
});
