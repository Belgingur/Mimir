import { describe, expect, it, vi } from "vitest";
import { initWeather, type InitWeatherDeps } from "../src/lib/initWeather";

vi.mock("weatherlayers-gl", () => ({}));

describe("initWeather without a forecast to show", () => {
  it("rejects before it builds any of the forecast's UI", async () => {
    const timelineHost = document.createElement("div");
    const layerComposer = { initLegends: vi.fn() };
    const tooltipController = { initControl: vi.fn() };
    const ensureInhouseGroupLayers = vi.fn(async () => {});
    const deps = {
      dom: {
        mapWrap: document.createElement("div"),
        timelineHost,
        gridLabelsContainer: document.createElement("div"),
      },
      isDev: false,
      getUiState: () => ({ layerMode: "temperature" }),
      // The catalog didn't load: there are no layers to build.
      getCatalogController: () => ({
        inhouseCatalogReady: Promise.resolve(),
        ensureInhouseGroupLayers,
        inhouseLayers: [],
      }),
      getLayerComposer: () => layerComposer,
      getTooltipController: () => tooltipController,
      setTimelineCurrentDatetime: vi.fn(),
      scheduleUpdateLayers: vi.fn(),
    } as unknown as InitWeatherDeps;

    await expect(initWeather(deps)).rejects.toThrow("could not be loaded");

    expect(ensureInhouseGroupLayers).toHaveBeenCalledWith("temperature");
    // Nothing half-built is left for a retry to trip over.
    expect(timelineHost.childElementCount).toBe(0);
    expect(timelineHost.className).toBe("");
    expect(layerComposer.initLegends).not.toHaveBeenCalled();
    expect(tooltipController.initControl).not.toHaveBeenCalled();
    expect(deps.setTimelineCurrentDatetime).not.toHaveBeenCalled();
  });
});
