import type { LayerMode, PersistedStateV1 } from "./viewerTypes";
import { pickDefaultId, resolveSelectionChange } from "./selectionRules";
import { clampSelectedIndex } from "./timelineState";

export const restorePersistedViewerState = (input: {
  persistedState: PersistedStateV1 | null;
  availableModels: string[];
  getAnalysesForModel: (model: string) => {
    ids: string[];
    latest?: string | null;
    defaultId?: string | null;
  };
  isLayerAvailableForModel: (layer: LayerMode, model: string) => boolean;
  defaultModelForNonWaves: string;
  defaultLayer: LayerMode;
  getDatetimesForSelection: (
    model: string,
    analysis: string,
    layer: LayerMode,
  ) => string[];
}) => {
  const {
    persistedState,
    availableModels,
    getAnalysesForModel,
    isLayerAvailableForModel,
    defaultModelForNonWaves,
    defaultLayer,
    getDatetimesForSelection,
  } = input;

  const fallbackModel = pickDefaultId(availableModels, defaultModelForNonWaves);
  if (!persistedState) {
    const analyses = getAnalysesForModel(fallbackModel);
    const analysisId =
      analyses.latest || pickDefaultId(analyses.ids, analyses.defaultId);
    const datetimes = getDatetimesForSelection(
      fallbackModel,
      analysisId,
      defaultLayer,
    );
    return {
      modelId: fallbackModel,
      layerMode: defaultLayer,
      analysisId,
      timeIndex: clampSelectedIndex(0, datetimes),
      mapCamera: null,
    };
  }

  const requestedModel = availableModels.includes(persistedState.modelId)
    ? persistedState.modelId
    : fallbackModel;
  const selection = resolveSelectionChange({
    action: "modelChange",
    fromModel: requestedModel,
    fromLayer: persistedState.layerMode,
    toModel: requestedModel,
    defaults: { defaultModelForNonWaves, defaultLayer },
    isGroupAvailableForModel: isLayerAvailableForModel,
  });

  const analyses = getAnalysesForModel(selection.model);
  const analysisId = analyses.ids.includes(persistedState.analysisId)
    ? persistedState.analysisId
    : analyses.latest || pickDefaultId(analyses.ids, analyses.defaultId);
  const datetimes = getDatetimesForSelection(
    selection.model,
    analysisId,
    selection.layer,
  );
  return {
    modelId: selection.model,
    layerMode: selection.layer,
    analysisId,
    timeIndex: clampSelectedIndex(persistedState.timeIndex, datetimes),
    mapCamera: persistedState.mapCamera,
  };
};
