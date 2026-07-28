/**
 * Center-of-screen readout (touch / small screens).
 *
 * Draws a fixed crosshair at the map centre and, in forecast view, shows the
 * value of the currently selected variable sampled at map.getCenter(). On
 * mobile the cursor-following hover/tooltip popups are suppressed; any extra
 * detail they would show (wind direction, wave period, …) is folded in here.
 */
import type maplibregl from "maplibre-gl";
import type { InhouseCatalogController } from "../controllers/InhouseCatalogController";
import type { UiState, InhouseGroupId, InhouseLayer } from "./inhouseTypes";
import { INHOUSE_GROUP_VARIABLES } from "./inhouseTypes";
import { sampleInhouseScalarAtCoord } from "./gridSampling";
import { getInhouseLayerBounds } from "./inhouseLayerHelpers";
import { resolveInhouseUnit } from "./inhouseCatalogHelpers";
import { t } from "./i18n";
import {
  CENTER_READOUT_MEDIA,
  isCenterReadoutViewport,
} from "./centerReadoutViewport";

export interface CenterReadoutDeps {
  map: maplibregl.Map;
  getCatalogController: () => InhouseCatalogController;
  getViewMode: () => "forecast" | "iconography";
  getUiState: () => UiState;
  formatCardinalDirection: (direction: number | null) => string | null;
}

export interface CenterReadout {
  refresh: () => void;
}

const THROTTLE_MS = 120;

function isInBounds(
  coord: [number, number],
  bounds: [number, number, number, number],
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const [lon, lat] = coord;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function sampleScalar(
  catalog: InhouseCatalogController,
  candidates: string[] | undefined,
  coord: [number, number],
  bounds: [number, number, number, number],
): number | null {
  if (!candidates) return null;
  const layer = catalog.findInhouseLayerByCandidates(candidates);
  if (!layer?.scalar) return null;
  const value = sampleInhouseScalarAtCoord(layer, coord, bounds);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sampleWindExtras(
  catalog: InhouseCatalogController,
  coord: [number, number],
  bounds: [number, number, number, number],
  groupId: "wind" | "precip",
): { speed: number | null; direction: number | null } {
  const group = INHOUSE_GROUP_VARIABLES[groupId];
  const vectorLayer = catalog.findPreferredInhouseWindVectorLayer(groupId);
  if (vectorLayer) {
    const sample = catalog.sampleInhouseVectorAtCoord(
      vectorLayer,
      coord,
      getInhouseLayerBounds(vectorLayer),
    );
    return { speed: sample.value, direction: sample.direction };
  }
  return {
    speed: sampleScalar(catalog, group.windSpeed, coord, bounds),
    direction: sampleScalar(catalog, group.windDir, coord, bounds),
  };
}

function formatPrecipRate(layer: InhouseLayer, value: number): string {
  const name = layer.variable;
  const srcMax = layer.manifest.srcMax;
  const isMmPerSecond = name.includes("rate") && srcMax < 0.1;
  const mmPerHour = isMmPerSecond ? value * 3600 : value;
  const rawUnit = layer.manifest.unit ?? resolveInhouseUnit(layer.variable);
  const unit = rawUnit === "mm hr-1" ? "mm/h" : rawUnit || "mm/h";
  const formatted = mmPerHour < 1 ? mmPerHour.toFixed(2) : mmPerHour.toFixed(1);
  return `${formatted} ${unit}`;
}

function buildReadout(
  mode: InhouseGroupId,
  layer: InhouseLayer,
  value: number,
  coord: [number, number],
  bounds: [number, number, number, number],
  catalog: InhouseCatalogController,
  formatCardinalDirection: (direction: number | null) => string | null,
): string | null {
  const name = layer.variable;
  const srcMax = layer.manifest.srcMax;

  switch (mode) {
    case "temperature": {
      const isKelvin = name.startsWith("air_temperature") && srcMax > 200;
      const celsius = isKelvin || value > 100 ? value - 273.15 : value;
      return `${Math.round(celsius)} °C`;
    }
    case "wind": {
      const speed = `${value.toFixed(1)} m/s`;
      const { direction } = sampleWindExtras(catalog, coord, bounds, "wind");
      const cardinal = formatCardinalDirection(direction);
      return cardinal ? `${speed} ${cardinal}` : speed;
    }
    case "precip": {
      const precip = formatPrecipRate(layer, value);
      const { speed, direction } = sampleWindExtras(
        catalog,
        coord,
        bounds,
        "precip",
      );
      const parts = [precip];
      if (typeof speed === "number" && Number.isFinite(speed)) {
        parts.push(`${speed.toFixed(1)} m/s`);
      }
      const cardinal = formatCardinalDirection(direction);
      if (cardinal) parts.push(cardinal);
      return parts.join(" · ");
    }
    case "waves": {
      const unit = layer.manifest.unit ?? resolveInhouseUnit(layer.variable);
      const unitLabel = unit === "m" ? "m" : unit;
      const height = `${value.toFixed(1)}${unitLabel ? ` ${unitLabel}` : ""}`;
      const period = sampleScalar(
        catalog,
        INHOUSE_GROUP_VARIABLES.waves.windSpeed,
        coord,
        bounds,
      );
      const direction = sampleScalar(
        catalog,
        INHOUSE_GROUP_VARIABLES.waves.windDir,
        coord,
        bounds,
      );
      const parts = [height];
      if (typeof period === "number" && Number.isFinite(period)) {
        parts.push(t("tooltip.wavePeriod", { value: period.toFixed(1) }));
      }
      const cardinal = formatCardinalDirection(direction);
      if (cardinal) parts.push(cardinal);
      return parts.join(" · ");
    }
    case "cloud": {
      const decodeMax = layer.manifest.imageUnscale?.[1] ?? srcMax ?? 1;
      const fraction = decodeMax > 1 ? value / decodeMax : value;
      const clamped = Math.max(0, Math.min(1, fraction));
      return `${Math.round(clamped * 100)} %`;
    }
    case "snow":
      return `${value.toFixed(2)} m`;
    default:
      return null;
  }
}

export function initCenterReadout(deps: CenterReadoutDeps): CenterReadout {
  const { map } = deps;

  const root = document.createElement("div");
  root.className = "center-readout";
  root.setAttribute("aria-hidden", "true");
  const valueEl = document.createElement("span");
  valueEl.className = "center-readout__value";
  const crossEl = document.createElement("span");
  crossEl.className = "center-readout__cross";
  root.append(valueEl, crossEl);
  map.getContainer().appendChild(root);

  const mql = window.matchMedia(CENTER_READOUT_MEDIA);

  const readValue = (): string | null => {
    if (!isCenterReadoutViewport() || deps.getViewMode() !== "forecast") {
      return null;
    }
    const layerMode = deps.getUiState().layerMode as InhouseGroupId;
    const group = INHOUSE_GROUP_VARIABLES[layerMode];
    if (!group) return null;

    const catalog = deps.getCatalogController();
    const layer = catalog.findInhouseLayerByCandidates(group.primary);
    if (!layer?.scalar) return null;

    const center = map.getCenter();
    const coord: [number, number] = [center.lng, center.lat];
    const bounds = layer.manifest.bounds;
    if (!isInBounds(coord, bounds)) return null;

    const raw = sampleInhouseScalarAtCoord(layer, coord, bounds);
    if (raw === null || !Number.isFinite(raw)) return null;

    return buildReadout(
      layerMode,
      layer,
      raw,
      coord,
      bounds,
      catalog,
      deps.formatCardinalDirection,
    );
  };

  const compute = () => {
    const text = readValue();
    if (text) {
      if (valueEl.textContent !== text) valueEl.textContent = text;
      root.classList.add("has-value");
    } else {
      root.classList.remove("has-value");
    }
  };

  let timer: number | null = null;
  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      compute();
    }, THROTTLE_MS);
  };

  map.on("move", schedule);
  map.on("zoom", schedule);
  map.on("render", schedule);
  mql.addEventListener("change", schedule);

  schedule();
  return { refresh: schedule };
}
