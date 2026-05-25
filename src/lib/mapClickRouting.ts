export type MapClickTarget = "none" | "wavegram";

export function resolveMapClickTarget(input: {
  selectedModel: string;
  layerMode: string;
}): MapClickTarget {
  const { selectedModel, layerMode } = input;
  if (selectedModel === "GWES") return "wavegram";
  if (layerMode === "waves") return "none";
  return "none";
}
