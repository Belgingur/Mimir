import type { PersistedStateV1 } from "./viewerTypes";

const STORAGE_KEY = "wl-viewer-state-v1";

export function loadPersistedState(): PersistedStateV1 | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedStateV1;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedStateV1) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function createPersistScheduler(
  gatherState: () => PersistedStateV1,
): () => void {
  let handle: number | null = null;
  return () => {
    if (handle !== null) return;
    handle = window.setTimeout(() => {
      handle = null;
      savePersistedState(gatherState());
    }, 200);
  };
}
