import { describe, it, expect, vi } from "vitest";
import {
  CONTEXT_LOSS_RELOAD_COOLDOWN_MS,
  CONTEXT_LOSS_RELOAD_KEY,
  reloadAfterContextLoss,
} from "../src/lib/contextLossReload";

const setup = (opts: { visible?: boolean; lastReloadAt?: number } = {}) => {
  let visibility: DocumentVisibilityState = opts.visible === false ? "hidden" : "visible";
  const docEvents = new EventTarget();
  const doc = {
    get visibilityState() {
      return visibility;
    },
    addEventListener: docEvents.addEventListener.bind(docEvents),
    removeEventListener: docEvents.removeEventListener.bind(docEvents),
  } as unknown as Document;

  const stored = new Map<string, string>();
  if (opts.lastReloadAt !== undefined) {
    stored.set(CONTEXT_LOSS_RELOAD_KEY, String(opts.lastReloadAt));
  }
  const storage = {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  };

  const handlers = new Map<string, () => void>();
  const map = {
    on: (type: string, fn: () => void) => void handlers.set(type, fn),
  };

  const reload = vi.fn();
  const now = 1_000_000;
  reloadAfterContextLoss(map as never, { doc, storage, reload, now: () => now });

  return {
    reload,
    stored,
    now,
    loseContext: () => handlers.get("webglcontextlost")?.(),
    setVisible: (visible: boolean) => {
      visibility = visible ? "visible" : "hidden";
      docEvents.dispatchEvent(new Event("visibilitychange"));
    },
  };
};

describe("reloadAfterContextLoss", () => {
  it("does nothing while the context is intact", () => {
    const t = setup();
    t.setVisible(false);
    t.setVisible(true);
    expect(t.reload).not.toHaveBeenCalled();
  });

  it("reloads at once when the reader is looking at the tab", () => {
    const t = setup({ visible: true });
    t.loseContext();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("waits for a background tab to come back before reloading", () => {
    const t = setup({ visible: false });
    t.loseContext();
    expect(t.reload).not.toHaveBeenCalled();
    t.setVisible(true);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once, however often the tab is flipped afterwards", () => {
    const t = setup({ visible: false });
    t.loseContext();
    t.loseContext();
    t.setVisible(true);
    t.setVisible(false);
    t.setVisible(true);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("records when it reloaded, for the loop guard", () => {
    const t = setup({ visible: true });
    t.loseContext();
    expect(t.stored.get(CONTEXT_LOSS_RELOAD_KEY)).toBe(String(t.now));
  });

  it("does not reload again right after an automatic reload", () => {
    const t = setup({ visible: true, lastReloadAt: 1_000_000 - 5_000 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    t.loseContext();
    expect(t.reload).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reloads again once the cooldown has passed", () => {
    const t = setup({
      visible: true,
      lastReloadAt: 1_000_000 - CONTEXT_LOSS_RELOAD_COOLDOWN_MS - 1,
    });
    t.loseContext();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads when storage is unavailable", () => {
    const docEvents = new EventTarget();
    const doc = {
      visibilityState: "visible",
      addEventListener: docEvents.addEventListener.bind(docEvents),
      removeEventListener: docEvents.removeEventListener.bind(docEvents),
    } as unknown as Document;
    let lost: (() => void) | undefined;
    const reload = vi.fn();
    reloadAfterContextLoss(
      { on: (_type: string, fn: () => void) => void (lost = fn) } as never,
      { doc, storage: null, reload },
    );
    lost?.();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
