export type MapClickTarget = "none" | "wavegram" | "meteogram";

export function resolveMapClickTarget(input: {
  selectedModel: string;
  layerMode: string;
  /** Current top-level view. The meteogram is a forecast-view feature only;
   *  when omitted the check is skipped (treated as forecast) for callers that
   *  never leave forecast view. */
  viewMode?: string;
  /** True only when the optional meteogram feature is enabled for this build. */
  meteogramEnabled?: boolean;
}): MapClickTarget {
  const { selectedModel, layerMode, viewMode, meteogramEnabled } = input;
  if (selectedModel === "GWES") return "wavegram";
  if (layerMode === "waves") return "none";
  // Meteogram opens on a forecast-view map click only; the iconography ("icons")
  // view has no click-to-open meteogram.
  if (viewMode && viewMode !== "forecast") return "none";
  return meteogramEnabled ? "meteogram" : "none";
}
