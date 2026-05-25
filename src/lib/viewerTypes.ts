export type LayerMode =
  | "temperature"
  | "wind"
  | "precip"
  | "waves"
  | "cloud"
  | "snow";

export type WindStyle = "arrows" | "particles" | "streamlines";

export type IconographyStyle = "classic" | "compact";

export type PersistedStateV1 = {
  version: 1;
  modelId: string;
  layerMode: LayerMode;
  analysisId: string;
  timeIndex: number;
  opacity: number;
  visible: boolean;
  iconographyStyle?: IconographyStyle;
  locale?: string;
  mapCamera: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
};
