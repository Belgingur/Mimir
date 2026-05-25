import { contours as d3Contours } from "d3-contour";
import { downsampleScalarGrid, chaikinSmooth } from "../lib/contourUtils";

type MslpContourRequest = {
  key: string;
  image: Float32Array;
  width: number;
  height: number;
  bounds: [number, number, number, number];
  thresholds: number[];
  downsample: number;
  smoothIterations: number;
};

type MslpContourResponse = {
  key: string;
  paths: { path: [number, number][]; value: number }[];
};

export const buildContours = (request: MslpContourRequest) => {
  const {
    image,
    width,
    height,
    bounds,
    thresholds,
    downsample,
    smoothIterations,
  } = request;
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;

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
          const segment: [number, number][] = ring.map(([x, y]) =>
            toLonLat(x, y),
          );
          if (segment.length > 1) {
            paths.push({
              path: chaikinSmooth(segment, smoothIterations),
              value,
            });
          }
        });
      });
    },
  );
  return paths;
};

self.onmessage = (event: MessageEvent<MslpContourRequest>) => {
  const request = event.data;
  const paths = buildContours(request);
  const response: MslpContourResponse = { key: request.key, paths };
  self.postMessage(response);
};
