import { VARIABLE_META } from "./variableMeta";
import type { InhouseManifest } from "./inhouseTypes";

export const resolveVariableMeta = (key: string) => {
  if (key in VARIABLE_META) {
    return VARIABLE_META[key as keyof typeof VARIABLE_META];
  }
  const match = Object.entries(VARIABLE_META).find(([metaKey]) =>
    key.startsWith(metaKey),
  );
  return match ? match[1] : null;
};

export const resolveInhouseUnit = (variable: string) =>
  resolveVariableMeta(variable)?.unit ?? "";

export const formatIndex = (index: number, width = 3) =>
  String(index).padStart(width, "0");

export const resolveManifestTimes = (manifest: InhouseManifest) => {
  if (
    Array.isArray(manifest.times) &&
    manifest.times.length === manifest.count
  ) {
    return manifest.times.slice();
  }
  const [datePart, hourPart] = manifest.analysisTime.split("_");
  const baseIso = `${datePart}T${hourPart}:00:00Z`;
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base) || manifest.historyIntervalMinutes == null) {
    // Unparseable analysisTime, or non-uniform series (e.g. ICON-EU) that omits
    // historyIntervalMinutes.  Either way we can't reconstruct meaningful times
    // here — fall back to hourly spacing as a safe placeholder.
    return Array.from({ length: manifest.count }, (_, i) =>
      new Date(Date.now() + i * 3600000).toISOString(),
    );
  }
  const stepMs = manifest.historyIntervalMinutes * 60 * 1000;
  return Array.from({ length: manifest.count }, (_, i) =>
    new Date(base + i * stepMs).toISOString(),
  );
};
