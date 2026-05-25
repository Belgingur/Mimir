import {
  streamlines,
  type StreamlineFeatureCollection,
} from "../vendor/raster-streamlines/streamlines";
import { reshape } from "../lib/reshape";

type StreamlineWorkerRequest = {
  key: string;
  width: number;
  height: number;
  u: Float32Array;
  v: Float32Array;
  geotransform: [number, number, number, number, number, number];
  density: number;
  flip: boolean;
  minSpeed: number;
};

type StreamlineWorkerResponse = {
  key: string;
  featureCollection: StreamlineFeatureCollection;
};

self.onmessage = (event: MessageEvent<StreamlineWorkerRequest>) => {
  const { key, width, height, u, v, geotransform, density, flip, minSpeed } =
    event.data;
  const featureCollection = streamlines(
    reshape(u, width, height),
    reshape(v, width, height),
    {
      geotransform,
      density,
      flip,
      minSpeed,
    },
  );
  const response: StreamlineWorkerResponse = { key, featureCollection };
  self.postMessage(response);
};
