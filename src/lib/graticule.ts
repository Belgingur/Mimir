import { t } from "./i18n";

export type GraticuleLine = {
  source: [number, number];
  target: [number, number];
};
export type GraticuleLabel = { position: [number, number]; text: string };

export const buildGraticuleLines = (
  bounds: [number, number, number, number],
  step = 10,
): GraticuleLine[] => {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lines: GraticuleLine[] = [];
  for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) {
    lines.push({ source: [minLon, lat], target: [maxLon, lat] });
  }
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) {
    lines.push({ source: [lon, minLat], target: [lon, maxLat] });
  }
  return lines;
};

export const buildGraticuleLabels = (
  bounds: [number, number, number, number],
  step = 20,
): GraticuleLabel[] => {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const labels: GraticuleLabel[] = [];
  for (let lat = Math.ceil(minLat / step) * step; lat <= maxLat; lat += step) {
    labels.push({
      position: [minLon + 2, lat],
      text: `${Math.abs(lat)}°${lat >= 0 ? t("cardinal.N") : t("cardinal.S")}`,
    });
  }
  for (let lon = Math.ceil(minLon / step) * step; lon <= maxLon; lon += step) {
    labels.push({
      position: [lon, maxLat - 2],
      text: `${Math.abs(lon)}°${lon >= 0 ? t("cardinal.E") : t("cardinal.W")}`,
    });
  }
  return labels;
};
