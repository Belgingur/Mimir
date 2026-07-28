import { processTexturePixels } from "../lib/textureProcessing";

/**
 * Off-thread WebP frame decode + pixel processing (task B1). Receives a fetched
 * frame Blob, decodes it with createImageBitmap, reads the pixels via
 * OffscreenCanvas, runs the shared processing, and transfers the result buffer
 * back — keeping getImageData + the per-pixel loops off the main thread.
 */
type DecodeRequest = { id: number; blob: Blob };

// The default lib types `self` as a Window; cast to the minimal worker surface
// so postMessage accepts a transfer list (and onmessage is a plain assignment).
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, blob } = event.data;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      ctx.postMessage({ id, ok: false, error: "no 2d context" });
      bitmap.close();
      return;
    }
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    const srcData = new Uint8Array(imageData.data.buffer.slice(0));
    const processed = processTexturePixels(srcData, bitmap.width, bitmap.height);
    ctx.postMessage({ id, ok: true, processed }, [
      processed.data.buffer as ArrayBuffer,
    ]);
  } catch (error) {
    ctx.postMessage({ id, ok: false, error: String(error) });
  }
};
