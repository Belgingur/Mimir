import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFrameBlob,
  FRAME_STALL_MS,
  FrameStalledError,
} from "../src/lib/fetchFrame";

const abortError = () =>
  new DOMException("The operation was aborted.", "AbortError");

/** Rejects as fetch does when its signal aborts, and never otherwise. */
function untilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(abortError()));
  });
}

/**
 * A response whose body the test sends piece by piece. A read that is waiting
 * rejects when the request's signal aborts, as a real body's does.
 */
function streamedResponse(signal: AbortSignal, type = "image/webp") {
  type Result = { done: boolean; value?: Uint8Array };
  const ready: Result[] = [];
  let waiting: {
    resolve: (result: Result) => void;
    reject: (error: unknown) => void;
  } | null = null;
  signal.addEventListener("abort", () => {
    waiting?.reject(abortError());
    waiting = null;
  });
  const push = (result: Result) => {
    if (waiting) {
      waiting.resolve(result);
      waiting = null;
    } else ready.push(result);
  };
  const response = {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name === "content-type" ? type : null) },
    body: {
      getReader: () => ({
        read: () =>
          new Promise<Result>((resolve, reject) => {
            const next = ready.shift();
            if (next) resolve(next);
            else if (signal.aborted) reject(abortError());
            else waiting = { resolve, reject };
          }),
      }),
    },
  };
  return {
    response,
    send: (bytes: number) => push({ done: false, value: new Uint8Array(bytes) }),
    close: () => push({ done: true }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchFrameBlob", () => {
  it("resolves with the whole body and its type, and leaves no timer behind", async () => {
    let body!: ReturnType<typeof streamedResponse>;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = streamedResponse(init.signal!);
        return body.response;
      }),
    );
    const request = fetchFrameBlob("/frame_000.webp");
    await vi.advanceTimersByTimeAsync(0);
    body.send(3);
    body.send(4);
    body.close();
    const blob = await request;
    expect(blob.size).toBe(7);
    expect(blob.type).toBe("image/webp");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects for a response that isn't ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    await expect(fetchFrameBlob("/frame_000.webp")).rejects.toThrow(
      "Failed to load frame /frame_000.webp (404)",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up a request that never answers at the limit, and not before", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => untilAborted(init.signal!)),
    );
    const settled = vi.fn();
    const request = fetchFrameBlob("/frame_000.webp");
    request.then(settled, settled);

    await vi.advanceTimersByTimeAsync(FRAME_STALL_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toBeInstanceOf(FrameStalledError);
    await expect(request).rejects.toThrow(
      `No data for ${FRAME_STALL_MS / 1000} s: /frame_000.webp`,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves a body that is still arriving to finish, however long it takes", async () => {
    let body!: ReturnType<typeof streamedResponse>;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = streamedResponse(init.signal!);
        return body.response;
      }),
    );
    const settled = vi.fn();
    const request = fetchFrameBlob("/slow.webp", undefined, 1_000);
    request.then(settled, settled);
    // Ten pieces, each just inside the limit: ten times the limit in all.
    for (let piece = 0; piece < 10; piece += 1) {
      await vi.advanceTimersByTimeAsync(999);
      body.send(5);
    }
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    body.close();
    expect((await request).size).toBe(50);
  });

  it("starts the clock again when the headers arrive", async () => {
    let answer!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((resolve) => {
            answer = () => resolve(streamedResponse(init.signal!).response);
          }),
      ),
    );
    const settled = vi.fn();
    const request = fetchFrameBlob("/headers-only.webp", undefined, 1_000);
    request.then(settled, settled);
    await vi.advanceTimersByTimeAsync(900);
    answer(null);
    // 900 ms to the headers, then nothing: given up 1000 ms after them.
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toBeInstanceOf(FrameStalledError);
  });

  it("gives up a body that stops arriving part of the way", async () => {
    let body!: ReturnType<typeof streamedResponse>;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = streamedResponse(init.signal!);
        return body.response;
      }),
    );
    const request = fetchFrameBlob("/half.webp", undefined, 1_000);
    const outcome = expect(request).rejects.toThrow(
      "No data for 1 s: /half.webp",
    );
    await vi.advanceTimersByTimeAsync(500);
    body.send(8);
    await vi.advanceTimersByTimeAsync(1_000);
    await outcome;
  });

  it("still lets the caller's own signal cancel the request, with the abort's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => untilAborted(init.signal!)),
    );
    const caller = new AbortController();
    const request = fetchFrameBlob("/frame_000.webp", caller.signal);
    const outcome = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    caller.abort();
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reads a response that has no stream as a whole", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        blob: async () => new Blob(["test"]),
      })),
    );
    expect((await fetchFrameBlob("/frame_000.webp")).size).toBe(4);
  });
});
