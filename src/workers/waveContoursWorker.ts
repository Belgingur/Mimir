import { contours as d3Contours } from "d3-contour";
import { downsampleScalarGrid, chaikinSmooth } from "../lib/contourUtils";
import { expandLandMask, downsampleMask } from "../lib/waveContourUtils";

type WaveContourRequest = {
  key: string;
  image: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number];
  landMask: Uint8Array | null;
  bufferPx: number;
  downsample: number;
  thresholds?: number[];
};

type WaveContourResponse = {
  key: string;
  paths: { path: [number, number][]; value: number }[];
};

export const buildWavePeriodContourPaths = (request: WaveContourRequest) => {
  const { image, width, height, bounds, landMask, bufferPx, downsample } =
    request;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const thresholds: number[] =
    request.thresholds && request.thresholds.length
      ? request.thresholds
      : (() => {
          const fallback: number[] = [];
          for (let value = 1; value <= 20; value += 1) {
            fallback.push(value);
          }
          return fallback;
        })();

  const downsampled = downsampleScalarGrid(image, width, height, downsample);
  const contourData = new Float32Array(downsampled.data.length);
  for (let i = 0; i < downsampled.data.length; i += 1) {
    const value = downsampled.data[i];
    contourData[i] = Number.isFinite(value) ? value : -999;
  }
  const contourGen = d3Contours()
    .size([downsampled.width, downsampled.height])
    .thresholds(thresholds);
  const contourFeatures = contourGen(contourData as unknown as number[]);

  const downsampledMask = landMask
    ? downsampleMask(landMask, width, height, downsample)
    : null;
  const expandedMask = downsampledMask
    ? expandLandMask(
        downsampledMask.mask,
        downsampledMask.width,
        downsampledMask.height,
        bufferPx,
      )
    : null;

  const isLandPixel = (x: number, y: number) => {
    if (!expandedMask || !downsampledMask) return false;
    const ix = Math.max(0, Math.min(downsampledMask.width - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(downsampledMask.height - 1, Math.round(y)));
    return expandedMask[iy * downsampledMask.width + ix] === 1;
  };

  const toLonLat = (x: number, y: number): [number, number] => {
    const lon = minLon + (x / (downsampled.width - 1)) * lonSpan;
    const lat = maxLat - (y / (downsampled.height - 1)) * latSpan;
    return [lon, lat];
  };

  const paths: { path: [number, number][]; value: number }[] = [];
  contourFeatures.forEach(
    (contour: { value: number; coordinates: number[][][][] }) => {
      const value = contour.value;
      const polygons = contour.coordinates;
      polygons.forEach((rings) => {
        rings.forEach((ring) => {
          let segment: [number, number][] = [];
          for (const [x, y] of ring) {
            if (isLandPixel(x, y)) {
              if (segment.length > 1) {
                paths.push({ path: chaikinSmooth(segment, 1), value });
              }
              segment = [];
              continue;
            }
            segment.push(toLonLat(x, y));
          }
          if (segment.length > 1) {
            paths.push({ path: chaikinSmooth(segment, 1), value });
          }
        });
      });
    },
  );
  return paths;
};

self.onmessage = (event: MessageEvent<WaveContourRequest>) => {
  const request = event.data;
  const paths = buildWavePeriodContourPaths(request);
  const response: WaveContourResponse = { key: request.key, paths };
  self.postMessage(response);
};
