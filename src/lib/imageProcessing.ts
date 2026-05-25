export type TextureDataArray = Uint8Array | Uint8ClampedArray | Float32Array;

export interface TextureData {
  data: TextureDataArray;
  width: number;
  height: number;
}

export const normalizeScalarImage = (image: TextureData) => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  if (bands === 1) {
    return { image, bands };
  }
  if (bands === 4) {
    const scalar = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      scalar[j] = data[i] ?? 0;
    }
    return { image: { data: scalar, width, height }, bands };
  }
  return { image, bands };
};

export const expandBounds = (
  bounds: [number, number, number, number],
  padDegrees: number,
): [number, number, number, number] => {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  return [
    Math.max(-180, minLon - padDegrees),
    Math.max(-90, minLat - padDegrees),
    Math.min(180, maxLon + padDegrees),
    Math.min(90, maxLat + padDegrees),
  ];
};

export const decodeScalarGrid = (
  image: TextureData,
  imageUnscale: [number, number] | null,
  imageScale?: string | null,
): { data: Float32Array; width: number; height: number } => {
  const { data, width, height, widthMeta } = image as {
    data: Uint8Array | Uint8ClampedArray | Float32Array;
    width: number;
    height: number;
    widthMeta?: number;
  };
  const alphaOn = (image as { alphaOn?: number }).alphaOn ?? 0;
  const alphaValid = alphaOn > 0;
  const logicalWidth = widthMeta ?? width;
  if (data instanceof Float32Array) {
    return { data, width, height };
  }
  const bands = Math.max(1, Math.round(data.length / (width * height)));
  const output = new Float32Array(logicalWidth * height);
  const min = imageUnscale ? imageUnscale[0] : 0;
  const max = imageUnscale ? imageUnscale[1] : 255;
  const isLog1p = imageScale === "log1p";
  const log1pMax = isLog1p ? Math.log1p(max) : 0;
  const scale = imageUnscale ? (max - min) / 255 : 1;
  for (let y = 0; y < height; y += 1) {
    const srcRow = y * width * bands;
    const dstRow = y * logicalWidth;
    for (let x = 0; x < logicalWidth; x += 1) {
      const idx = srcRow + x * bands;
      const outIdx = dstRow + x;
      const raw = data[idx] ?? 0;
      const alpha = bands >= 4 && alphaValid ? (data[idx + 3] ?? 255) : 255;
      if (alphaValid && alpha < 255) {
        output[outIdx] = Number.NaN;
        continue;
      }
      if (isLog1p) {
        output[outIdx] = Math.expm1((raw / 255) * log1pMax);
      } else {
        output[outIdx] = imageUnscale ? min + raw * scale : Number(raw);
      }
    }
  }
  return { data: output, width: logicalWidth, height };
};

export const padFloatGridToWidthMultipleOf4 = (grid: {
  data: Float32Array;
  width: number;
  height: number;
}): { data: Float32Array; width: number; height: number } => {
  if (grid.width % 4 === 0) return grid;
  const paddedWidth = grid.width + (4 - (grid.width % 4));
  const next = new Float32Array(paddedWidth * grid.height);
  next.fill(Number.NaN);
  for (let y = 0; y < grid.height; y += 1) {
    const srcRow = y * grid.width;
    const dstRow = y * paddedWidth;
    next.set(grid.data.subarray(srcRow, srcRow + grid.width), dstRow);
  }
  return { data: next, width: paddedWidth, height: grid.height };
};

export const maybeConvertToHpa = (grid: {
  data: Float32Array;
  width: number;
  height: number;
}) => {
  let max = -Infinity;
  for (let i = 0; i < grid.data.length; i += 1) {
    const value = grid.data[i];
    if (Number.isFinite(value) && value > max) max = value;
  }
  if (max > 2000) {
    const converted = new Float32Array(grid.data.length);
    for (let i = 0; i < grid.data.length; i += 1) {
      const value = grid.data[i];
      converted[i] = Number.isFinite(value) ? value / 100 : value;
    }
    return { data: converted, width: grid.width, height: grid.height };
  }
  return grid;
};

export const buildMslpThresholds = (grid: { data: Float32Array }) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < grid.data.length; i += 1) {
    const value = grid.data[i];
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const step = 4;
  const start = Math.ceil(min / step) * step;
  const end = Math.floor(max / step) * step;
  const thresholds: number[] = [];
  for (let v = start; v <= end; v += step) {
    thresholds.push(Number(v.toFixed(2)));
  }
  return thresholds;
};

export const cropScalarImageToBounds = (
  image: TextureData,
  imageBounds: [number, number, number, number],
  cropBounds: [number, number, number, number],
): { image: TextureData; bounds: [number, number, number, number] } => {
  const [minLon, minLat, maxLon, maxLat] = imageBounds;
  const [cropMinLon, cropMinLat, cropMaxLon, cropMaxLat] = cropBounds;
  const [finalMinLon, finalMinLat, finalMaxLon, finalMaxLat] = [
    Math.max(minLon, cropMinLon),
    Math.max(minLat, cropMinLat),
    Math.min(maxLon, cropMaxLon),
    Math.min(maxLat, cropMaxLat),
  ];
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const { data, width, height } = image as {
    data: Float32Array;
    width: number;
    height: number;
  };
  if (lonSpan <= 0 || latSpan <= 0) {
    return { image, bounds: imageBounds };
  }
  const x0 = Math.max(
    0,
    Math.min(
      width - 1,
      Math.floor(((finalMinLon - minLon) / lonSpan) * (width - 1)),
    ),
  );
  const x1 = Math.max(
    0,
    Math.min(
      width - 1,
      Math.ceil(((finalMaxLon - minLon) / lonSpan) * (width - 1)),
    ),
  );
  const y0 = Math.max(
    0,
    Math.min(
      height - 1,
      Math.floor(((maxLat - finalMaxLat) / latSpan) * (height - 1)),
    ),
  );
  const y1 = Math.max(
    0,
    Math.min(
      height - 1,
      Math.ceil(((maxLat - finalMinLat) / latSpan) * (height - 1)),
    ),
  );
  const nextWidth = Math.max(1, x1 - x0 + 1);
  const nextHeight = Math.max(1, y1 - y0 + 1);
  if (nextWidth === width && nextHeight === height) {
    return { image, bounds: imageBounds };
  }
  const next = new Float32Array(nextWidth * nextHeight);
  for (let y = 0; y < nextHeight; y += 1) {
    const srcRow = (y0 + y) * width + x0;
    const dstRow = y * nextWidth;
    for (let x = 0; x < nextWidth; x += 1) {
      next[dstRow + x] = data[srcRow + x];
    }
  }
  return {
    image: { data: next, width: nextWidth, height: nextHeight },
    bounds: [finalMinLon, finalMinLat, finalMaxLon, finalMaxLat],
  };
};

export const clampScalarImage = (
  image: TextureData,
  imageUnscale: [number, number] | null | undefined,
  minValue: number,
  maxValue: number,
): TextureData => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  const min = imageUnscale?.[0] ?? 0;
  const max = imageUnscale?.[1] ?? 255;
  const scale = imageUnscale ? (max - min) / 255 : 1;
  const out = new Uint8Array(width * height * bands);
  const range = Math.max(1e-6, maxValue - minValue);
  for (let i = 0, j = 0; i < data.length; i += bands, j += 1) {
    const alpha = bands >= 4 ? (data[i + 3] ?? 255) : 255;
    if (bands >= 4 && alpha < 255) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = alpha;
      continue;
    }
    const raw = imageUnscale ? min + (data[i] ?? 0) * scale : (data[i] ?? 0);
    const clamped = Math.min(maxValue, Math.max(minValue, raw));
    const t = (clamped - minValue) / range;
    const encoded = Math.round(t * 255);
    out[i] = encoded;
    if (bands >= 2) out[i + 1] = encoded;
    if (bands >= 3) out[i + 2] = encoded;
    if (bands >= 4) out[i + 3] = alpha;
  }
  return { data: out, width, height };
};

/**
 * Convert a log1p-encoded scalar image to a linearly-encoded one so that
 * weatherlayers-gl can apply its standard linear imageUnscale correctly.
 *
 * Encoding invariant (must match make_image in netcdf2image.py):
 *   encoded_pixel = log1p(value) / log1p(srcMax) * 255
 *
 * This function inverts that to produce a linear pixel:
 *   linear_pixel = expm1(raw / 255 * log1p(srcMax)) / srcMax * 255
 *
 * After this transform, imageUnscale [0, srcMax] gives the correct physical
 * value when applied linearly by weatherlayers-gl.
 *
 * Handles LA (2-band), single-channel (1-band), and RGBA (4-band) images.
 * Alpha is preserved; fully transparent pixels are passed through as-is.
 */
export const linearizeLog1pScalarImage = (
  image: TextureData,
  srcMax: number,
): TextureData => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  const log1pMax = Math.log1p(srcMax);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += bands) {
    const alpha =
      bands === 2
        ? (data[i + 1] ?? 255)
        : bands >= 4
          ? (data[i + 3] ?? 255)
          : 255;
    if (alpha === 0) {
      // Transparent pixel — leave output bytes as zero (already initialised).
      continue;
    }
    const raw = data[i] ?? 0;
    const value = Math.expm1((raw / 255) * log1pMax);
    const encoded = Math.round(
      Math.min(255, Math.max(0, (value / srcMax) * 255)),
    );
    out[i] = encoded;
    if (bands === 2) {
      out[i + 1] = alpha; // LA: second band is alpha
    } else if (bands >= 3) {
      out[i + 1] = encoded; // RGB/RGBA: replicate to G and B
      out[i + 2] = encoded;
      if (bands >= 4) out[i + 3] = alpha;
    }
  }
  return { data: out, width, height };
};

export const normalizeVectorImage = (image: TextureData) => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  if (
    bands !== 4 ||
    !(data instanceof Uint8Array || data instanceof Uint8ClampedArray)
  ) {
    return image;
  }
  let alphaMax = 0;
  for (let i = 3; i < data.length; i += 4) {
    alphaMax = Math.max(alphaMax, data[i] ?? 0);
  }
  if (alphaMax > 0) {
    return image;
  }
  const next = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    next[i] = data[i] ?? 0;
    next[i + 1] = data[i + 1] ?? 0;
    next[i + 2] = data[i + 2] ?? 0;
    next[i + 3] = 255;
  }
  return { data: next, width, height };
};

export const decodeVectorComponents = (
  image: TextureData,
  imageUnscale: [number, number] | null | undefined,
): { u: Float32Array; v: Float32Array; width: number; height: number } => {
  const { data, width, height } = normalizeVectorImage(image) as {
    data: Uint8Array | Uint8ClampedArray;
    width: number;
    height: number;
  };
  const min = imageUnscale?.[0] ?? 0;
  const max = imageUnscale?.[1] ?? 255;
  const scale = imageUnscale ? (max - min) / 255 : 1;
  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 255) {
      u[p] = Number.NaN;
      v[p] = Number.NaN;
      continue;
    }
    u[p] = imageUnscale ? min + (data[i] ?? 0) * scale : Number(data[i] ?? 0);
    v[p] = imageUnscale
      ? min + (data[i + 1] ?? 0) * scale
      : Number(data[i + 1] ?? 0);
  }
  return { u, v, width, height };
};

export const quantizeFloatToUint8 = (
  image: TextureData,
  minValue: number,
  maxValue: number,
) => {
  const { data, width, height } = image as {
    data: Float32Array;
    width: number;
    height: number;
  };
  const range = Math.max(1e-6, maxValue - minValue);
  const out = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    if (!Number.isFinite(value)) {
      out[i] = 0;
      continue;
    }
    const t = Math.min(1, Math.max(0, (value - minValue) / range));
    out[i] = Math.round(t * 255);
  }
  return { data: out, width, height };
};

export const getScalarRange = (
  image: TextureData,
  imageUnscale: [number, number] | null | undefined,
) => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  if (imageUnscale) {
    return { min: imageUnscale[0], max: imageUnscale[1] };
  }
  for (let i = 0; i < data.length; i += bands) {
    const value = data[i] ?? 0;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
};

export const vectorToSpeedImage = (
  image: TextureData,
  imageUnscale: [number, number] | null | undefined,
): TextureData => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  const scalar = new Float32Array(width * height);
  if (bands < 2) {
    return { data: scalar, width, height };
  }
  const min = imageUnscale?.[0] ?? 0;
  const max = imageUnscale?.[1] ?? 255;
  const scale = (max - min) / 255;
  for (let i = 0, j = 0; i < data.length; i += bands, j += 1) {
    if (bands >= 4 && (data[i + 3] ?? 0) === 0) {
      scalar[j] = Number.NaN;
      continue;
    }
    const u = min + (data[i] ?? 0) * scale;
    const v = min + (data[i + 1] ?? 0) * scale;
    scalar[j] = Math.hypot(u, v);
  }
  return { data: scalar, width, height };
};

export const vectorToSpeedImageSigned = (image: TextureData): TextureData => {
  const { data, width, height } = image;
  const bands = Math.round(data.length / (width * height));
  const scalar = new Float32Array(width * height);
  if (bands < 2) {
    return { data: scalar, width, height };
  }
  for (let i = 0, j = 0; i < data.length; i += bands, j += 1) {
    if (bands >= 4 && (data[i + 3] ?? 0) === 0) {
      scalar[j] = Number.NaN;
      continue;
    }
    const u = (data[i] ?? 0) - 128;
    const v = (data[i + 1] ?? 0) - 128;
    scalar[j] = Math.hypot(u, v);
  }
  return { data: scalar, width, height };
};

export const getSpeedRange = (image: TextureData | null) => {
  if (!image) {
    return { min: 0, max: 0 };
  }
  const { data } = image as { data: Float32Array };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!Number.isFinite(min)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
};
