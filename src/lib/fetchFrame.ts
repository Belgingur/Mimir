/**
 * How long a frame's request may go without a byte arriving before it is
 * given up. Not a limit on the whole request: a frame that is still arriving
 * on a slow connection is left to finish, however long it takes. See the pull
 * request that added it for the measurements behind the value.
 */
export const FRAME_STALL_MS = 30_000;

/** A frame's request was given up: nothing arrived for the stall limit. */
export class FrameStalledError extends Error {
  constructor(url: string, stallMs: number) {
    super(`No data for ${stallMs / 1000} s: ${url}`);
    this.name = "FrameStalledError";
  }
}

/**
 * fetch() a frame's file, and reject with a {@link FrameStalledError} if no
 * byte of it has arrived for `stallMs`.
 *
 * A fetch has no timeout of its own: a request the server never answers stays
 * pending for good, and whatever awaits it never continues. The clock here
 * starts with the request and starts again with every sign of life: the
 * response's headers, and each piece of the body.
 *
 * Rejects for a response that isn't ok too. The caller's own signal still
 * cancels the request, with the abort's own error.
 */
export async function fetchFrameBlob(
  url: string,
  signal?: AbortSignal,
  stallMs: number = FRAME_STALL_MS,
): Promise<Blob> {
  const controller = new AbortController();
  const abortFromOuter = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromOuter();
  else signal?.addEventListener("abort", abortFromOuter, { once: true });

  let stalled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const restartClock = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallMs);
  };
  restartClock();
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load frame ${url} (${response.status})`);
    }
    restartClock();
    const reader = response.body?.getReader();
    // No stream to watch: the limit is then on the rest of the body as a whole.
    if (!reader) return await response.blob();
    const type = response.headers.get("content-type") ?? "";
    const pieces: BlobPart[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pieces.push(value);
      restartClock();
    }
    return new Blob(pieces, { type });
  } catch (error) {
    if (stalled) throw new FrameStalledError(url, stallMs);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromOuter);
  }
}
