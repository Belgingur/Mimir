import "./meteogram.css";
// Registers the <bel-meteogram> custom element. Vendored bundle — see
// src/vendor/bel-meteogram/README.md. It ships inside this dynamically
// imported feature chunk, so disabled builds still contain no meteogram code.
import "../../vendor/bel-meteogram/bel-meteogram.js";
import {
  MeteogramController,
  type MeteogramWidget,
} from "./MeteogramController";
import { resolveMeteogramClientName } from "./meteogramConfig";
import { injectMeteogramModal } from "./meteogramModal";
import { createMeteogramTrigger } from "./meteogramTrigger";

export interface SetupMeteogramDeps {
  /** `.map-wrap` element the modal and mobile trigger are appended to. */
  readonly mapWrap: HTMLElement;
  readonly getSelectedModel: () => string;
  readonly getLayerMode: () => string;
  readonly getLocale: () => string;
  /** Current map centre — the point the mobile crosshair trigger loads. */
  readonly getMapCenter: () => { lng: number; lat: number };
  /** True when a map click at the centre would resolve to a meteogram. */
  readonly isMeteogramTarget: () => boolean;
  /** Domain bounds of the selected model `[minLon, minLat, maxLon, maxLat]`,
   *  or null when unknown — for the early out-of-domain hint. */
  readonly getModelBounds: () => [number, number, number, number] | null;
  /** Authoritative model run / last-update times (ISO UTC) from the selected
   *  model's manifest, or null when unknown — for the widget's footer (C2). */
  readonly getAnalysisInfo: () => {
    analysisTimeISO?: string;
    generatedAt?: string;
  } | null;
  /** Name of the place at a point (clicked city label, else nearest place), or
   *  undefined when nothing is close enough to fairly label it. */
  readonly getPlaceLabel?: (lng: number, lat: number) => string | undefined;
  /** Drop/remove the selected-point pin on the map (docked-panel layout). */
  readonly showPin: (lng: number, lat: number, label: string) => void;
  readonly removePin: () => void;
  readonly isDev: boolean;
}

const DEFAULT_API_BASE = "https://wod-odinn.belgingur.is";

/**
 * Origin of the WOD API the widget fetches its config + forecast data from.
 * `VITE_METEOGRAM_API_BASE` wins; a legacy `VITE_METEOGRAM_EMBED_URL` (which
 * pointed at the old widgets-2 bundle path on the same host) still works —
 * its origin is reused so existing deployments don't break.
 */
function resolveApiBase(): string {
  const explicit = import.meta.env.VITE_METEOGRAM_API_BASE as
    | string
    | undefined;
  if (explicit) return explicit.replace(/\/+$/, "");
  const legacyEmbed = import.meta.env.VITE_METEOGRAM_EMBED_URL as
    | string
    | undefined;
  if (legacyEmbed) {
    try {
      return new URL(legacyEmbed).origin;
    } catch {
      /* malformed override — fall through to the default */
    }
  }
  return DEFAULT_API_BASE;
}

/**
 * Injects the meteogram modal and returns a ready `MeteogramController`.
 * Called only when {@link isMeteogramEnabled} is true, from a guarded dynamic
 * import in `controllerFactory.ts`.
 */
export function setupMeteogram(deps: SetupMeteogramDeps): MeteogramController {
  const dom = injectMeteogramModal(deps.mapWrap);
  const apiBase = resolveApiBase();

  const controller = new MeteogramController({
    dom,
    createWidget: (clientName: string): MeteogramWidget => {
      const el = document.createElement("bel-meteogram");
      el.id = "meteogram-widget";
      el.setAttribute("client-name", clientName);
      // The widget derives the config URL from its own script origin by
      // default; bundled into Mimir that would be Mimir's origin, so the
      // full config URL is passed explicitly.
      el.setAttribute(
        "api-url",
        `${apiBase}/api/v2/widget/meteo/config/${clientName}`,
      );
      el.setAttribute("hours", "48");
      el.setAttribute("mode", "full");
      el.setAttribute("view", "graph");
      // Always show the exact clicked coordinate, never snap the label to the
      // nearest station (the point is a map click, not a station pick).
      el.setAttribute("prefer-coordinates", "");
      // The widget renders its own ✕ (and emits bel-meteogram-close) so the
      // modal needs no white chrome of its own — see meteogram.css.
      el.setAttribute("closable", "");
      // The widget authenticates its forecast-data requests with HTTP Basic
      // auth built from these attributes. Without them the data fetch is
      // unauthenticated and fails — most visibly on devices with no existing
      // WOD session, e.g. a phone. The feature is only enabled when both are
      // present (see enabled.ts).
      const user = import.meta.env.VITE_WOD_API_USER as string | undefined;
      const password = import.meta.env.VITE_WOD_API_PASSWORD as
        | string
        | undefined;
      if (user) el.setAttribute("api-user", user);
      if (password) el.setAttribute("api-password", password);
      return el;
    },
    getSelectedModel: deps.getSelectedModel,
    resolveClientName: resolveMeteogramClientName,
    getLocale: deps.getLocale,
    getLayerMode: deps.getLayerMode,
    isMeteogramTarget: deps.isMeteogramTarget,
    getModelBounds: deps.getModelBounds,
    getAnalysisInfo: deps.getAnalysisInfo,
    getPlaceLabel: deps.getPlaceLabel,
    showPin: deps.showPin,
    removePin: deps.removePin,
    isDev: deps.isDev,
  });

  // Mobile trigger: an icon button in the on-map zoom/grid stack that opens the
  // meteogram for the centre-crosshair point. Falls back to .map-wrap if the
  // zoom controls aren't present (shouldn't happen, but keeps setup total).
  const mount =
    deps.mapWrap.querySelector<HTMLElement>(".zoom-buttons") ?? deps.mapWrap;
  const trigger = createMeteogramTrigger({
    mount,
    isMeteogramTarget: deps.isMeteogramTarget,
    onActivate: () => {
      const center = deps.getMapCenter();
      void controller.openAt(center.lng, center.lat);
    },
  });
  controller.bindTrigger(trigger);

  return controller;
}
