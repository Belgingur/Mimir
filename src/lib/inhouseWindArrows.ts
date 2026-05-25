import type { InhouseLayer } from "./inhouseTypes";
import { WAVE_DIRECTION_IS_FROM } from "./inhouseTypes";
import { sampleScalarGridAtCoord } from "./gridSampling";

export type ArrowLine = { source: [number, number]; target: [number, number] };

export const buildInhouseWindLines = (
  speedLayer: InhouseLayer,
  dirLayer: InhouseLayer,
  stepDegrees = 10,
): ArrowLine[] => {
  const bounds = speedLayer.manifest.bounds;
  if (!speedLayer.scalar || !dirLayer.scalar) return [];
  const positions: [number, number][] = [];
  const [minLon, minLat, maxLon, maxLat] = bounds;
  for (let lat = minLat; lat <= maxLat; lat += stepDegrees) {
    for (let lon = minLon; lon <= maxLon; lon += stepDegrees) {
      positions.push([lon, lat]);
    }
  }
  const lines: ArrowLine[] = [];
  const scale = 0.125;
  const minLineLength = 0.5;
  const headAngle = (25 * Math.PI) / 180;
  positions.forEach((coord) => {
    const speed = sampleScalarGridAtCoord(speedLayer.scalar!, bounds, coord);
    const direction = sampleScalarGridAtCoord(dirLayer.scalar!, bounds, coord);
    if (!Number.isFinite(speed ?? NaN) || !Number.isFinite(direction ?? NaN))
      return;
    const radians = (((direction as number) + 180) * Math.PI) / 180;
    const cappedValue = Math.min(speed as number, 25);
    const lineLength = Math.max(cappedValue * scale, minLineLength);
    const dx = Math.sin(radians) * lineLength;
    const dy = Math.cos(radians) * lineLength;
    const tip: [number, number] = [coord[0] + dx, coord[1] + dy];
    lines.push({ source: coord, target: tip });
    const headLength = Math.max(0.5, Math.min(1.4, (speed as number) * 0.04));
    const leftAngle = radians + Math.PI - headAngle;
    const rightAngle = radians + Math.PI + headAngle;
    lines.push({
      source: tip,
      target: [
        tip[0] + Math.sin(leftAngle) * headLength,
        tip[1] + Math.cos(leftAngle) * headLength,
      ],
    });
    lines.push({
      source: tip,
      target: [
        tip[0] + Math.sin(rightAngle) * headLength,
        tip[1] + Math.cos(rightAngle) * headLength,
      ],
    });
  });
  return lines;
};

export const buildInhouseWaveArrows = (
  periodLayer: InhouseLayer,
  dirLayer: InhouseLayer,
  stepDegrees = 8,
): ArrowLine[] => {
  const bounds = periodLayer.manifest.bounds;
  if (!periodLayer.scalar || !dirLayer.scalar) return [];
  const positions: [number, number][] = [];
  const [minLon, minLat, maxLon, maxLat] = bounds;
  for (let lat = minLat; lat <= maxLat; lat += stepDegrees) {
    for (let lon = minLon; lon <= maxLon; lon += stepDegrees) {
      positions.push([lon, lat]);
    }
  }
  const lines: ArrowLine[] = [];
  const scale = 0.18;
  const minLineLength = 0.6;
  const maxLineLength = 3.0;
  const headAngle = (25 * Math.PI) / 180;
  positions.forEach((coord) => {
    const period = sampleScalarGridAtCoord(periodLayer.scalar!, bounds, coord);
    const direction = sampleScalarGridAtCoord(dirLayer.scalar!, bounds, coord);
    if (!Number.isFinite(period ?? NaN) || !Number.isFinite(direction ?? NaN))
      return;
    const dir = direction as number;
    const radians =
      (((WAVE_DIRECTION_IS_FROM ? dir + 180 : dir) as number) * Math.PI) / 180;
    const capped = Math.max(0, Math.min(period as number, 20));
    const lineLength = Math.max(
      minLineLength,
      Math.min(maxLineLength, capped * scale),
    );
    const dx = Math.sin(radians) * lineLength;
    const dy = Math.cos(radians) * lineLength;
    const tip: [number, number] = [coord[0] + dx, coord[1] + dy];
    lines.push({ source: coord, target: tip });
    const headLength = Math.max(0.5, Math.min(1.2, capped * 0.08));
    const leftAngle = radians + Math.PI - headAngle;
    const rightAngle = radians + Math.PI + headAngle;
    lines.push({
      source: tip,
      target: [
        tip[0] + Math.sin(leftAngle) * headLength,
        tip[1] + Math.cos(leftAngle) * headLength,
      ],
    });
    lines.push({
      source: tip,
      target: [
        tip[0] + Math.sin(rightAngle) * headLength,
        tip[1] + Math.cos(rightAngle) * headLength,
      ],
    });
  });
  return lines;
};
