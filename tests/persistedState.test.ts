import { describe, expect, it } from "vitest";
import { restorePersistedViewerState } from "../src/lib/persistedState";
import type { LayerMode, PersistedStateV1 } from "../src/lib/viewerTypes";

const models = ["gfs-1", "bel-is", "GWES"];
const analysesByModel = {
  "gfs-1": { ids: ["2026-03-19_00", "2026-03-19_06"], latest: "2026-03-19_06" },
  "bel-is": { ids: ["2026-03-19_03"], latest: "2026-03-19_03" },
  GWES: { ids: ["2026-03-19_00"], latest: "2026-03-19_00" },
};
const support: Record<string, LayerMode[]> = {
  "gfs-1": ["temperature", "wind", "precip"],
  "bel-is": ["temperature", "wind"],
  GWES: ["waves"],
};

const persistedBase: PersistedStateV1 = {
  version: 1,
  modelId: "gfs-1",
  layerMode: "wind",
  analysisId: "2026-03-19_06",
  timeIndex: 2,
  opacity: 1,
  visible: true,
  mapCamera: { center: [-20, 55], zoom: 4, bearing: 0, pitch: 0 },
};

describe("restorePersistedViewerState", () => {
  it("restores saved model/layer/time/camera when values are valid", () => {
    const result = restorePersistedViewerState({
      persistedState: persistedBase,
      availableModels: models,
      getAnalysesForModel: (model) =>
        analysesByModel[model as keyof typeof analysesByModel],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a", "b", "c", "d"],
    });

    expect(result).toEqual({
      modelId: "gfs-1",
      layerMode: "wind",
      analysisId: "2026-03-19_06",
      timeIndex: 2,
      mapCamera: persistedBase.mapCamera,
    });
  });

  it("applies graceful fallback when saved values are invalid", () => {
    const invalidState: PersistedStateV1 = {
      ...persistedBase,
      modelId: "unknown-model",
      layerMode: "waves",
      analysisId: "bad-analysis",
      timeIndex: 99,
    };

    const result = restorePersistedViewerState({
      persistedState: invalidState,
      availableModels: models,
      getAnalysesForModel: (model) =>
        analysesByModel[model as keyof typeof analysesByModel],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a", "b"],
    });

    expect(result).toEqual({
      modelId: "gfs-1",
      layerMode: "temperature",
      analysisId: "2026-03-19_06",
      timeIndex: 1,
      mapCamera: persistedBase.mapCamera,
    });
  });

  it("selects the latest analysis when the previous one is invalid for the restored model", () => {
    const result = restorePersistedViewerState({
      persistedState: {
        ...persistedBase,
        modelId: "bel-is",
        layerMode: "wind",
        analysisId: "2026-03-19_06",
      },
      availableModels: models,
      getAnalysesForModel: (model) =>
        analysesByModel[model as keyof typeof analysesByModel],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a"],
    });

    expect(result.analysisId).toBe("2026-03-19_03");
    expect(result.layerMode).toBe("wind");
  });

  it("returns defaults when persistedState is null", () => {
    const result = restorePersistedViewerState({
      persistedState: null,
      availableModels: models,
      getAnalysesForModel: (model) =>
        analysesByModel[model as keyof typeof analysesByModel],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a", "b", "c"],
    });

    expect(result.modelId).toBe("gfs-1");
    expect(result.layerMode).toBe("temperature");
    expect(result.analysisId).toBe("2026-03-19_06");
    expect(result.timeIndex).toBe(0);
    expect(result.mapCamera).toBeNull();
  });

  it("falls back to default analysis when latest is empty and persistedState is null", () => {
    const noLatest = {
      "gfs-1": {
        ids: ["2026-03-19_00", "2026-03-19_06"],
        latest: null,
        defaultId: "2026-03-19_00",
      },
      "bel-is": { ids: ["2026-03-19_03"], latest: "2026-03-19_03" },
      GWES: { ids: ["2026-03-19_00"], latest: "2026-03-19_00" },
    };

    const result = restorePersistedViewerState({
      persistedState: null,
      availableModels: models,
      getAnalysesForModel: (model) => noLatest[model as keyof typeof noLatest],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a"],
    });

    expect(result.analysisId).toBe("2026-03-19_00");
  });

  it("falls back to pickDefaultId for analysis when latest is empty for persisted state", () => {
    const noLatest = {
      "gfs-1": {
        ids: ["2026-03-19_00", "2026-03-19_06"],
        latest: null,
        defaultId: "2026-03-19_00",
      },
      "bel-is": { ids: ["2026-03-19_03"], latest: "2026-03-19_03" },
      GWES: { ids: ["2026-03-19_00"], latest: "2026-03-19_00" },
    };

    const result = restorePersistedViewerState({
      persistedState: { ...persistedBase, analysisId: "invalid-analysis" },
      availableModels: models,
      getAnalysesForModel: (model) => noLatest[model as keyof typeof noLatest],
      isLayerAvailableForModel: (layer, model) =>
        support[model]?.includes(layer) ?? false,
      defaultModelForNonWaves: "gfs-1",
      defaultLayer: "temperature",
      getDatetimesForSelection: () => ["a", "b"],
    });

    expect(result.analysisId).toBe("2026-03-19_00");
  });
});
