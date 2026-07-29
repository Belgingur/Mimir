import type { ProcessedTexture } from "./textureProcessing";

/**
 * Main-thread client for the off-thread WebP decoder (task B1). Lazily spins up
 * a single module worker and routes id-keyed requests to it. Returns null from
 * `decodeTextureOffThread` when workers / OffscreenCanvas are unavailable (or
 * the worker has failed), so callers can fall back to main-thread decoding.
 */

type PendingResolvers = {
  resolve: (value: ProcessedTexture) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let workerUnavailable = false;
let nextId = 1;
const pending = new Map<number, PendingResolvers>();

function failAll(message: string): void {
  for (const { reject } of pending.values()) reject(new Error(message));
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerUnavailable) return null;
  if (
    typeof Worker === "undefined" ||
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    workerUnavailable = true;
    return null;
  }
  try {
    worker = new Worker(
      new URL("../workers/textureDecoderWorker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<
        | { id: number; ok: true; processed: ProcessedTexture }
        | { id: number; ok: false; error: string }
      >,
    ) => {
      const msg = event.data;
      const resolvers = pending.get(msg.id);
      if (!resolvers) return;
      pending.delete(msg.id);
      if (msg.ok) resolvers.resolve(msg.processed);
      else resolvers.reject(new Error(msg.error));
    };
    worker.onerror = () => {
      // Disable the worker for the rest of the session; callers fall back.
      workerUnavailable = true;
      worker?.terminate();
      worker = null;
      failAll("texture decoder worker error");
    };
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/**
 * Decode + process a frame Blob off the main thread. Resolves to the processed
 * texture, or returns null synchronously when off-thread decoding is not
 * available (caller should decode on the main thread instead).
 */
export function decodeTextureOffThread(
  blob: Blob,
): Promise<ProcessedTexture> | null {
  const w = getWorker();
  if (!w) return null;
  const id = nextId++;
  return new Promise<ProcessedTexture>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, blob });
  });
}
