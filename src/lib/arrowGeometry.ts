import type { FeatureCollection } from "geojson";
import type { InhouseLayer } from "./inhouseTypes";
import type { TextureData } from "./imageProcessing";
import { decodeScalarGrid } from "./imageProcessing";
import {
  compassBearingToIconAngle,
  bearingFromCoordinates,
  mapMagnitudeToArrowSize,
  clamp,
} from "./mathUtils";
import {
  getInhouseLayerUnscale,
  getInhouseLayerImageScale,
  ensureScalar,
} from "./inhouseLayerHelpers";

export const ARROW_ICON = {
  url: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path fill="white" stroke="none" d="M2 11h14V7l6 5-6 5v-4H2z"/>
    </svg>`,
  )}`,
  width: 24,
  height: 24,
  anchorX: 12,
  anchorY: 12,
  mask: true,
};

export const ARROW_HEAD_ICON = {
  url: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path fill="white" stroke="none" d="M6 4l12 8-12 8 3-8z"/>
    </svg>`,
  )}`,
  width: 24,
  height: 24,
  anchorX: 12,
  anchorY: 12,
  mask: true,
};

export type ArrowPoint = {
  position: [number, number];
  angle: number;
  size: number;
};

export type WindLabelPoint = {
  position: [number, number];
  text: string;
};

const arrowDataCache = new Map<string, ArrowPoint[]>();
const windLabelCache = new Map<string, WindLabelPoint[]>();
const vectorFieldCache = new Map<
  string,
  { texture: TextureData; unscale: [number, number]; maxMagnitude: number }
>();

export const buildStreamlineArrowHeads = (
  featureCollection: FeatureCollection,
  key: string,
  size: number,
): ArrowPoint[] => {
  const cached = arrowDataCache.get(key);
  if (cached) return cached;
  const points: ArrowPoint[] = [];
  for (const feature of featureCollection.features) {
    if (feature.geometry?.type !== "LineString") continue;
    const coordinates = feature.geometry.coordinates as [number, number][];
    if (coordinates.length < 4) continue;
    const stride = Math.max(3, Math.round(coordinates.length / 6));
    for (let i = stride; i < coordinates.length; i += stride) {
      const prev = coordinates[i - 1];
      const next = coordinates[i];
      const bearing = bearingFromCoordinates(prev, next);
      if (!Number.isFinite(bearing)) continue;
      points.push({
        position: [(prev[0] + next[0]) / 2, (prev[1] + next[1]) / 2],
        angle: compassBearingToIconAngle(bearing),
        size,
      });
    }
  }
  arrowDataCache.set(key, points);
  return points;
};

export const buildArrowPoints = (
  magLayer: InhouseLayer,
  dirLayer: InhouseLayer,
  pointTowardFlow: boolean,
  bounds: [number, number, number, number],
  step: number,
  minSize: number,
  maxSize: number,
  cacheKey: string,
  magnitudeMin?: number,
  magnitudeMax?: number,
  stepX?: number,
  stepY?: number,
) => {
  if (arrowDataCache.has(cacheKey)) {
    return arrowDataCache.get(cacheKey) ?? [];
  }
  ensureScalar(magLayer);
  ensureScalar(dirLayer);
  if (!magLayer.scalar || !dirLayer.scalar) {
    return [];
  }
  const width = magLayer.scalar.width;
  const height = magLayer.scalar.height;
  if (dirLayer.scalar.width !== width || dirLayer.scalar.height !== height) {
    return [];
  }
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (lonSpan <= 0 || latSpan <= 0) {
    return [];
  }
  const sx = stepX ?? step;
  const sy = stepY ?? step;
  const points: ArrowPoint[] = [];
  for (let y = 0; y < height; y += sy) {
    const lat = maxLat - (y / (height - 1)) * latSpan;
    for (let x = 0; x < width; x += sx) {
      const mag = magLayer.scalar.data[y * width + x];
      const dir = dirLayer.scalar.data[y * width + x];
      if (!Number.isFinite(mag) || !Number.isFinite(dir)) continue;
      const bearing = (((pointTowardFlow ? dir + 180 : dir) % 360) + 360) % 360;
      const angle = compassBearingToIconAngle(bearing);
      const size =
        typeof magnitudeMin === "number" && typeof magnitudeMax === "number"
          ? mapMagnitudeToArrowSize(
              mag,
              magnitudeMin,
              magnitudeMax,
              minSize,
              maxSize,
            )
          : Math.min(maxSize, Math.max(minSize, mag));
      const lon = minLon + (x / (width - 1)) * lonSpan;
      points.push({ position: [lon, lat], angle, size });
    }
  }
  arrowDataCache.set(cacheKey, points);
  return points;
};

export const buildVectorFieldTexture = (
  magLayer: InhouseLayer,
  dirLayer: InhouseLayer,
  directionIsFrom: boolean,
  cacheKey: string,
) => {
  ensureScalar(magLayer);
  ensureScalar(dirLayer);
  if (!magLayer.scalar || !dirLayer.scalar) {
    if (import.meta.env.DEV) {
      console.warn("[arrows] missing scalar", {
        mag: Boolean(magLayer.scalar),
        dir: Boolean(dirLayer.scalar),
        magVar: magLayer.variable,
        dirVar: dirLayer.variable,
      });
    }
    return null;
  }
  if (
    magLayer.scalar.width !== dirLayer.scalar.width ||
    magLayer.scalar.height !== dirLayer.scalar.height
  ) {
    if (import.meta.env.DEV) {
      console.warn("[arrows] size mismatch", {
        mag: [magLayer.scalar.width, magLayer.scalar.height],
        dir: [dirLayer.scalar.width, dirLayer.scalar.height],
      });
    }
    return null;
  }
  if (vectorFieldCache.has(cacheKey)) {
    return vectorFieldCache.get(cacheKey) ?? null;
  }
  const width = magLayer.scalar.width;
  const height = magLayer.scalar.height;
  const uvs = new Float32Array(width * height * 2);
  const magData = magLayer.scalar.data;
  const dirData = dirLayer.scalar.data;
  let maxMagnitude = 0;
  for (let i = 0; i < width * height; i += 1) {
    const mag = magData[i];
    const dir = dirData[i];
    const outIdx = i * 2;
    if (!Number.isFinite(mag) || !Number.isFinite(dir)) {
      uvs[outIdx] = Number.NaN;
      uvs[outIdx + 1] = Number.NaN;
      continue;
    }
    const degrees = directionIsFrom ? dir + 180 : dir;
    const radians = (degrees * Math.PI) / 180;
    const u = mag * Math.cos(radians);
    const v = mag * Math.sin(radians);
    uvs[outIdx] = u;
    uvs[outIdx + 1] = v;
    const magnitude = Math.hypot(u, v);
    if (magnitude > maxMagnitude) maxMagnitude = magnitude;
  }
  if (import.meta.env.DEV) {
    console.log("[arrows] built vector field", {
      cacheKey,
      width,
      height,
      sample: [uvs[0], uvs[1]],
    });
  }
  const scale = maxMagnitude > 0 ? maxMagnitude : 1;
  const min = -scale;
  const max = scale;
  const range = max - min;
  const packed = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const srcIdx = i * 2;
    const dstIdx = i * 4;
    const u = uvs[srcIdx];
    const v = uvs[srcIdx + 1];
    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      packed[dstIdx] = 0;
      packed[dstIdx + 1] = 0;
      packed[dstIdx + 2] = 0;
      packed[dstIdx + 3] = 0;
      continue;
    }
    const uNorm = Math.min(1, Math.max(0, (u - min) / range));
    const vNorm = Math.min(1, Math.max(0, (v - min) / range));
    packed[dstIdx] = Math.round(uNorm * 255);
    packed[dstIdx + 1] = Math.round(vNorm * 255);
    packed[dstIdx + 2] = 0;
    packed[dstIdx + 3] = 255;
  }
  const texture: TextureData = { data: packed, width, height };
  const payload = {
    texture,
    unscale: [min, max] as [number, number],
    maxMagnitude: maxMagnitude || 1,
  };
  vectorFieldCache.set(cacheKey, payload);
  return payload;
};

export const buildWindLabelPoints = (
  speedLayer: InhouseLayer,
  bounds: [number, number, number, number],
  step: number,
  cacheKey: string,
  lonOffsetFactor = 0,
  latOffsetFactor = 0,
) => {
  if (windLabelCache.has(cacheKey)) {
    return windLabelCache.get(cacheKey) ?? [];
  }
  if (!speedLayer.scalar) {
    if (!speedLayer.image || speedLayer.image instanceof Promise) {
      return [];
    }
    const grid = decodeScalarGrid(
      speedLayer.image,
      getInhouseLayerUnscale(speedLayer),
      getInhouseLayerImageScale(speedLayer),
    );
    if (speedLayer.domainMask) {
      const max = Math.min(speedLayer.domainMask.length, grid.data.length);
      for (let i = 0; i < max; i += 1) {
        if (speedLayer.domainMask[i] === 0) grid.data[i] = Number.NaN;
      }
    }
    speedLayer.scalar = grid;
  }
  const grid = speedLayer.scalar;
  if (!grid) {
    return [];
  }
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (lonSpan <= 0 || latSpan <= 0) {
    return [];
  }
  const points: WindLabelPoint[] = [];
  for (let y = 0; y < grid.height; y += step) {
    const lat = maxLat - (y / Math.max(1, grid.height - 1)) * latSpan;
    for (let x = 0; x < grid.width; x += step) {
      const value = grid.data[y * grid.width + x];
      if (!Number.isFinite(value)) continue;
      const lonBase = minLon + (x / Math.max(1, grid.width - 1)) * lonSpan;
      const lonOffset =
        (lonSpan / Math.max(1, grid.width - 1)) * lonOffsetFactor;
      const latOffset =
        (latSpan / Math.max(1, grid.height - 1)) * latOffsetFactor;
      const lon = clamp(lonBase + lonOffset, minLon, maxLon);
      const shiftedLat = clamp(lat + latOffset, minLat, maxLat);
      points.push({
        position: [lon, shiftedLat],
        text: `${Math.round(value)}`,
      });
    }
  }
  windLabelCache.set(cacheKey, points);
  return points;
};
