/** Shared with bel-meteogram (development.md §7). Mimir writes `point`; the
 *  widget writes panel UI fields (view, scrubIdx, panelPos, fs, …). */
const KEY = "mimirMapPanelState";

export interface MapPanelState {
  point?: { lat: number; lon: number };
  selectedDay?: number;
  scrubIdx?: number;
  view?: "table" | "graph";
  panelPos?: { x: number; y: number };
  /** Widget-owned panel size (map-panel 2a resize grip). Preserved by the
   *  point-only writers below. */
  panelSize?: { w: number; h: number };
}

export function readMapPanelState(): MapPanelState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as MapPanelState;
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

export function writeMapPanelPoint(lat: number, lon: number): void {
  try {
    const prev = readMapPanelState();
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...prev, point: { lat, lon } }),
    );
  } catch {
    /* storage unavailable */
  }
}

/** Drop the saved map click while keeping widget UI fields (panelPos, scrubIdx, …). */
export function clearMapPanelPoint(): void {
  try {
    const { point: _removed, ...rest } = readMapPanelState();
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable */
  }
}

export function readMapPanelPoint(): { lat: number; lon: number } | null {
  const p = readMapPanelState().point;
  if (
    p &&
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon)
  ) {
    return p;
  }
  return null;
}
