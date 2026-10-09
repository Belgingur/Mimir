import type * as maplibregl from "maplibre-gl";

/**
 * Reload the page after the browser takes the map's WebGL context away.
 *
 * Browsers drop the GPU context of a tab when they want the resources back:
 * Chrome when too many pages hold one (the oldest goes first), any browser
 * across a sleep/wake or a GPU switch, iOS for tabs left in the background.
 * MapLibre restores its own basemap afterwards, but the forecast is drawn by
 * deck.gl custom layers that MapLibre cannot restore, so a reader coming back
 * to an old tab found a bare map with the timeline still ticking over it.
 *
 * Rebuilding in place is not worth the risk: luma.gl keeps its device on the
 * GL context object, so a fresh deck.gl overlay would attach to the dead one.
 * A reload is what the reader would do anyway, and the saved state brings the
 * model and the camera back.
 *
 * The reload waits until the tab is visible. A background tab reloading on its
 * own spends the reader's data on a page nobody is looking at, and may lose its
 * context again before they return.
 *
 * Guarded against a loop: a context lost again soon after an automatic reload
 * means the GPU is not coming back by itself, and reloading again would only
 * flash the page. That case is left to the reader's own reload.
 */

/** sessionStorage key holding the time of the last automatic reload. */
export const CONTEXT_LOSS_RELOAD_KEY = "mimir-context-loss-reload-at";

/** No second automatic reload within this long of the first. */
export const CONTEXT_LOSS_RELOAD_COOLDOWN_MS = 60_000;

export interface ContextLossReloadDeps {
  /** Injectable for tests; defaults to the page's document. */
  doc?: Pick<
    Document,
    "visibilityState" | "addEventListener" | "removeEventListener"
  >;
  /** Injectable for tests; defaults to sessionStorage, null when unavailable. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** Injectable for tests; defaults to window.location.reload. */
  reload?: () => void;
  /** Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export function reloadAfterContextLoss(
  map: Pick<maplibregl.Map, "on">,
  deps: ContextLossReloadDeps = {},
): void {
  const doc = deps.doc ?? document;
  const storage =
    deps.storage !== undefined ? deps.storage : defaultSessionStorage();
  const reload = deps.reload ?? (() => window.location.reload());
  const now = deps.now ?? Date.now;
  let pending = false;

  const reloadWhenVisible = () => {
    if (doc.visibilityState !== "visible") return;
    doc.removeEventListener("visibilitychange", reloadWhenVisible);
    try {
      storage?.setItem(CONTEXT_LOSS_RELOAD_KEY, String(now()));
    } catch {
      // Storage unavailable: the reload still happens, only unguarded.
    }
    reload();
  };

  map.on("webglcontextlost", () => {
    if (pending) return;
    if (reloadedRecently(storage, now())) {
      console.warn(
        "[mimir] WebGL context lost again soon after a reload; not reloading automatically",
      );
      return;
    }
    pending = true;
    doc.addEventListener("visibilitychange", reloadWhenVisible);
    reloadWhenVisible();
  });
}

function reloadedRecently(
  storage: Pick<Storage, "getItem"> | null,
  at: number,
): boolean {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(CONTEXT_LOSS_RELOAD_KEY) ?? null;
  } catch {
    return false;
  }
  const last = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(last) && at - last < CONTEXT_LOSS_RELOAD_COOLDOWN_MS;
}

function defaultSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
