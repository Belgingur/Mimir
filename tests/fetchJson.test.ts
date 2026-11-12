import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithTimeout, JSON_TIMEOUT_MS } from "../src/lib/fetchJson";

/** Rejects as fetch does when its signal aborts, and never otherwise. */
function untilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchJsonWithTimeout", () => {
  it("resolves with the parsed body, and leaves no timer behind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ models: ["a"] }) })),
    );
    await expect(fetchJsonWithTimeout("/models.json")).resolves.toEqual({
      models: ["a"],
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects for a response that isn't ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    await expect(fetchJsonWithTimeout("/models.json")).rejects.toThrow(
      "Failed to load /models.json (404)",
    );
  });

  it("rejects after the timeout when the request never answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => untilAborted(init.signal!)),
    );
    const settled = vi.fn();
    const request = fetchJsonWithTimeout("/models.json");
    request.then(settled, settled);

    // Just short of the limit it is still pending…
    await vi.advanceTimersByTimeAsync(JSON_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    // …and at the limit it is given up.
    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      `Timed out after ${JSON_TIMEOUT_MS / 1000} s: /models.json`,
    );
  });

  it("rejects after the timeout when the headers come and the body never does", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => ({
        ok: true,
        json: () => untilAborted(init.signal!),
      })),
    );
    const request = fetchJsonWithTimeout("/manifest.json", undefined, 5_000);
    const outcome = expect(request).rejects.toThrow(
      "Timed out after 5 s: /manifest.json",
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await outcome;
  });

  it("still lets the caller's own signal cancel the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => untilAborted(init.signal!)),
    );
    const caller = new AbortController();
    const request = fetchJsonWithTimeout("/a.json", { signal: caller.signal });
    const outcome = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    caller.abort();
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });
});
