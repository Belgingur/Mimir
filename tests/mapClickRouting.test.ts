import { describe, expect, it } from "vitest";
import { resolveMapClickTarget } from "../src/lib/mapClickRouting";

describe("resolveMapClickTarget", () => {
  it("routes GWES clicks to wavegram", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GWES",
        layerMode: "waves",
      }),
    ).toBe("wavegram");
  });

  it("does not route non-GWES forecast clicks", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "temperature",
      }),
    ).toBe("none");
  });

  it("keeps non-GWES waves mode disabled if it ever occurs", () => {
    expect(
      resolveMapClickTarget({
        selectedModel: "GFS",
        layerMode: "waves",
      }),
    ).toBe("none");
  });
});
