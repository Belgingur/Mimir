import { describe, expect, it } from "vitest";
import {
  GWES_MODEL_ID,
  resolveSelectionChange,
  normalizeIdList,
  normalizeVariableList,
  pickDefaultId,
  pickValidGroupForModel,
} from "../src/lib/selectionRules";
import type { LayerMode } from "../src/lib/viewerTypes";

const modelSupport: Record<string, LayerMode[]> = {
  "gfs-1": ["temperature", "wind", "precip"],
  "bel-is": ["temperature", "wind"],
  [GWES_MODEL_ID]: ["waves"],
};

const isLayerAvailableForModel = (layer: LayerMode, model: string) =>
  modelSupport[model]?.includes(layer) ?? false;

describe("resolveSelectionChange", () => {
  it("preserves the current layer when switching models if the new model supports it", () => {
    const result = resolveSelectionChange({
      action: "modelChange",
      fromModel: "gfs-1",
      fromLayer: "wind",
      toModel: "bel-is",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: "bel-is",
      layer: "wind",
      appliedException: null,
    });
  });

  it("falls back correctly when the current layer is invalid for the new model", () => {
    const result = resolveSelectionChange({
      action: "modelChange",
      fromModel: "gfs-1",
      fromLayer: "precip",
      toModel: "bel-is",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: "bel-is",
      layer: "temperature",
      appliedException: "FALLBACK",
    });
  });

  it("defaults GWES to waves when switching to that model", () => {
    const result = resolveSelectionChange({
      action: "modelChange",
      fromModel: "gfs-1",
      fromLayer: "temperature",
      toModel: GWES_MODEL_ID,
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: GWES_MODEL_ID,
      layer: "waves",
      appliedException: "GWES_DEFAULT",
    });
  });

  it("switching layer to waves from a non-GWES model switches to GWES/waves", () => {
    const result = resolveSelectionChange({
      action: "layerChange",
      fromModel: "gfs-1",
      fromLayer: "wind",
      toLayer: "waves",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: GWES_MODEL_ID,
      layer: "waves",
      appliedException: "GWES_DEFAULT",
    });
  });

  it("leaving GWES/waves by changing model switches to temperature on the new model", () => {
    const result = resolveSelectionChange({
      action: "modelChange",
      fromModel: GWES_MODEL_ID,
      fromLayer: "waves",
      toModel: "bel-is",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: "bel-is",
      layer: "temperature",
      appliedException: "LEAVE_GWES_BY_MODEL",
    });
  });

  it("leaving GWES/waves by changing layer switches model to gfs-1 and keeps the requested layer", () => {
    const result = resolveSelectionChange({
      action: "layerChange",
      fromModel: GWES_MODEL_ID,
      fromLayer: "waves",
      toLayer: "wind",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: isLayerAvailableForModel,
    });

    expect(result).toEqual({
      model: "gfs-1",
      layer: "wind",
      appliedException: "LEAVE_GWES_BY_LAYER",
    });
  });

  it("leaving GWES/waves by changing layer keeps the requested layer even if current-model availability says otherwise", () => {
    const result = resolveSelectionChange({
      action: "layerChange",
      fromModel: GWES_MODEL_ID,
      fromLayer: "waves",
      toLayer: "temperature",
      defaults: {
        defaultModelForNonWaves: "gfs-1",
        defaultLayer: "temperature",
      },
      isGroupAvailableForModel: () => false,
    });

    expect(result).toEqual({
      model: "gfs-1",
      layer: "temperature",
      appliedException: "LEAVE_GWES_BY_LAYER",
    });
  });
});

describe("normalizeIdList", () => {
  it("handles raw array", () => {
    expect(normalizeIdList(["a", "b"])).toEqual(["a", "b"]);
  });

  it("handles object with models array", () => {
    const result = normalizeIdList({
      models: [{ id: "gfs-1", default: true }, { id: "bel-is" }],
    });
    expect(result).toEqual({ ids: ["gfs-1", "bel-is"], defaultId: "gfs-1" });
  });

  it("handles object with analyses array", () => {
    const result = normalizeIdList({ analyses: ["2026-01-01", "2026-01-02"] });
    expect(result).toEqual({
      ids: ["2026-01-01", "2026-01-02"],
      defaultId: "",
    });
  });

  it("returns empty for non-object non-array", () => {
    expect(normalizeIdList(null)).toEqual({ ids: [], defaultId: "" });
    expect(normalizeIdList(42)).toEqual({ ids: [], defaultId: "" });
  });

  it("uses defaultKey fallback", () => {
    const result = normalizeIdList(
      { models: [{ id: "a" }], latest: "a" },
      "latest",
    );
    expect(result).toEqual({ ids: ["a"], defaultId: "a" });
  });
});

describe("normalizeVariableList", () => {
  it("parses object variable items with metadata", () => {
    const result = normalizeVariableList({
      variables: [
        {
          id: "temp",
          title: "Temperature",
          unit: "°C",
          defaultLayer: "raster",
        },
        { id: "wind", title: "Wind speed" },
      ],
    });
    expect(result.ids).toEqual(["temp", "wind"]);
    expect(result.meta["temp"].title).toBe("Temperature");
    expect(result.meta["temp"].unit).toBe("°C");
    expect(result.meta["wind"].unit).toBeUndefined();
  });

  it("parses string variable items", () => {
    const result = normalizeVariableList({
      variables: ["temp", "wind"],
    });
    expect(result.ids).toEqual(["temp", "wind"]);
    expect(result.meta["temp"]).toEqual({ id: "temp" });
  });

  it("filters out non-object/non-string items", () => {
    const result = normalizeVariableList({
      variables: [{ id: "temp" }, null, 42, { id: "wind" }],
    });
    expect(result.ids).toEqual(["temp", "wind"]);
  });

  it("returns empty for non-object input", () => {
    const result = normalizeVariableList(null);
    expect(result.ids).toEqual([]);
    expect(result.defaultId).toBe("");
  });

  it("picks default from item with default: true", () => {
    const result = normalizeVariableList({
      variables: [{ id: "temp" }, { id: "wind", default: true }],
    });
    expect(result.defaultId).toBe("wind");
  });

  it("falls back to obj.default for defaultId", () => {
    const result = normalizeVariableList({
      variables: [{ id: "temp" }],
      default: "temp",
    });
    expect(result.defaultId).toBe("temp");
  });
});

describe("pickDefaultId", () => {
  it("returns defaultId when valid", () => {
    expect(pickDefaultId(["a", "b"], "b")).toBe("b");
  });

  it("returns first id when defaultId is empty", () => {
    expect(pickDefaultId(["a", "b"], "")).toBe("a");
  });

  it("returns first id when defaultId is null", () => {
    expect(pickDefaultId(["a", "b"], null)).toBe("a");
  });

  it("returns empty when ids is empty and no defaultId", () => {
    expect(pickDefaultId([], null)).toBe("");
  });
});

describe("pickValidGroupForModel", () => {
  it("returns waves for GWES", () => {
    expect(pickValidGroupForModel(GWES_MODEL_ID, () => true)).toBe("waves");
  });

  it("returns first available non-waves group for non-GWES model", () => {
    const isAvailable = (group: string) => group === "wind";
    expect(pickValidGroupForModel("gfs-1", isAvailable)).toBe("wind");
  });

  it("falls back to waves if only waves is available for non-GWES model", () => {
    const isAvailable = (group: string) => group === "waves";
    expect(pickValidGroupForModel("mixed-model", isAvailable)).toBe("waves");
  });

  it("returns null when no group is available", () => {
    expect(pickValidGroupForModel("empty-model", () => false)).toBeNull();
  });
});
