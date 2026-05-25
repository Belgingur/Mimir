import type { TextureData } from "./imageProcessing";

export const expandLandMask = (
  mask: Uint8Array,
  width: number,
  height: number,
  bufferPx: number,
) => {
  if (bufferPx <= 0) return mask;
  const expanded = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      for (let dy = -bufferPx; dy <= bufferPx; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -bufferPx; dx <= bufferPx; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          expanded[ny * width + nx] = 1;
        }
      }
    }
  }
  return expanded;
};

export const applyLandMask = (
  image: TextureData,
  mask: Uint8Array,
  bufferPx = 0,
): TextureData => {
  const { data, width, height } = image as {
    data: Float32Array;
    width: number;
    height: number;
  };
  const output = new Float32Array(data.length);
  output.set(data);
  const expanded = expandLandMask(mask, width, height, bufferPx);
  for (let i = 0; i < output.length; i += 1) {
    if (expanded[i]) {
      output[i] = Number.NaN;
    }
  }
  return { data: output, width, height };
};
