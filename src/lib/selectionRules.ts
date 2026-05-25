import type { LayerMode } from "./viewerTypes";

export const GWES_MODEL_ID = "GWES";

export type InhouseGroupId = LayerMode;

export const PREFERRED_LAYER_ORDER: InhouseGroupId[] = [
  "temperature",
  "wind",
  "precip",
  "cloud",
  "snow",
  "waves",
];

export const normalizeIdList = (data: unknown, defaultKey?: string) => {
  if (Array.isArray(data)) {
    return data.map(String);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const listKey = obj.models
      ? "models"
      : obj.analyses
        ? "analyses"
        : obj.variables
          ? "variables"
          : null;
    const list =
      listKey && Array.isArray(obj[listKey]) ? (obj[listKey] as unknown[]) : [];
    let ids = list
      .map((item) =>
        item && typeof item === "object"
          ? (item as Record<string, unknown>).id
          : item,
      )
      .filter(Boolean)
      .map(String);
    if (
      !ids.length &&
      listKey &&
      obj[listKey] &&
      typeof obj[listKey] === "object" &&
      !Array.isArray(obj[listKey])
    ) {
      ids = Object.keys(obj[listKey] as Record<string, unknown>);
    }
    const def =
      list.find(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as Record<string, unknown>).default,
      ) ?? (defaultKey ? (obj[defaultKey] as unknown) : null);
    const defId =
      def && typeof def === "object"
        ? (def as Record<string, unknown>).id
        : def;
    return { ids, defaultId: defId ? String(defId) : "" };
  }
  return { ids: [], defaultId: "" };
};

export const normalizeVariableList = (data: unknown) => {
  const meta: Record<
    string,
    {
      id: string;
      title?: string;
      unit?: string;
      defaultLayer?: string;
      contourInterval?: number;
      majorInterval?: number;
    }
  > = {};
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = Array.isArray(obj.variables)
      ? (obj.variables as unknown[])
      : [];
    const ids = list
      .map((item) => {
        if (typeof item === "string") {
          meta[item] = { id: item };
          return item;
        }
        if (item && typeof item === "object") {
          const entry = item as Record<string, unknown>;
          const id = entry.id ? String(entry.id) : "";
          if (id) {
            meta[id] = {
              id,
              title: entry.title ? String(entry.title) : undefined,
              unit: entry.unit ? String(entry.unit) : undefined,
              defaultLayer: entry.defaultLayer
                ? String(entry.defaultLayer)
                : undefined,
              contourInterval:
                typeof entry.contourInterval === "number"
                  ? entry.contourInterval
                  : undefined,
              majorInterval:
                typeof entry.majorInterval === "number"
                  ? entry.majorInterval
                  : undefined,
            };
          }
          return id;
        }
        return "";
      })
      .filter(Boolean);
    const def =
      list.find(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as Record<string, unknown>).default,
      ) ?? (obj.default as unknown);
    const defId =
      def && typeof def === "object"
        ? (def as Record<string, unknown>).id
        : def;
    return { ids, meta, defaultId: defId ? String(defId) : "" };
  }
  return { ids: [], meta, defaultId: "" };
};

export const pickDefaultId = (
  ids: string[],
  defaultId: string | null | undefined,
) => (defaultId && defaultId.trim().length ? defaultId : ids[0]) ?? "";

export const pickValidGroupForModel = (
  model: string,
  isGroupAvailableForModel: (group: InhouseGroupId, model: string) => boolean,
): InhouseGroupId | null => {
  if (model === GWES_MODEL_ID) return "waves";
  for (const candidate of PREFERRED_LAYER_ORDER) {
    if (candidate === "waves") continue;
    if (isGroupAvailableForModel(candidate, model)) return candidate;
  }
  if (isGroupAvailableForModel("waves", model)) return "waves";
  return null;
};

export const resolveSelectionChange = (input: {
  action: "modelChange" | "layerChange";
  fromModel: string;
  fromLayer: LayerMode;
  toModel?: string;
  toLayer?: LayerMode;
  defaults: { defaultModelForNonWaves: string; defaultLayer: LayerMode };
  isGroupAvailableForModel: (group: InhouseGroupId, model: string) => boolean;
}) => {
  const {
    action,
    fromModel,
    fromLayer,
    toModel,
    toLayer,
    defaults,
    isGroupAvailableForModel,
  } = input;
  if (
    action === "layerChange" &&
    toLayer === "waves" &&
    fromModel !== GWES_MODEL_ID
  ) {
    return {
      model: GWES_MODEL_ID,
      layer: "waves" as LayerMode,
      appliedException: "GWES_DEFAULT" as const,
    };
  }
  if (action === "modelChange" && toModel === GWES_MODEL_ID) {
    return {
      model: GWES_MODEL_ID,
      layer: "waves" as LayerMode,
      appliedException: "GWES_DEFAULT" as const,
    };
  }
  if (
    fromModel === GWES_MODEL_ID &&
    fromLayer === "waves" &&
    action === "modelChange" &&
    toModel
  ) {
    const fallback =
      pickValidGroupForModel(toModel, isGroupAvailableForModel) ??
      defaults.defaultLayer;
    return {
      model: toModel,
      layer: isGroupAvailableForModel("temperature", toModel)
        ? "temperature"
        : fallback,
      appliedException: "LEAVE_GWES_BY_MODEL" as const,
    };
  }
  if (
    fromModel === GWES_MODEL_ID &&
    fromLayer === "waves" &&
    action === "layerChange" &&
    toLayer
  ) {
    return {
      model: defaults.defaultModelForNonWaves,
      layer: toLayer,
      appliedException: "LEAVE_GWES_BY_LAYER" as const,
    };
  }
  const nextModel = toModel ?? fromModel;
  const requestedLayer = toLayer ?? fromLayer;
  if (isGroupAvailableForModel(requestedLayer, nextModel)) {
    return { model: nextModel, layer: requestedLayer, appliedException: null };
  }
  return {
    model: nextModel,
    layer:
      pickValidGroupForModel(nextModel, isGroupAvailableForModel) ??
      defaults.defaultLayer,
    appliedException: "FALLBACK" as const,
  };
};
