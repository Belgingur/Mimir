import maplibregl from "maplibre-gl";
import { queryDom } from "./lib/domRegistry";
import { loadPersistedState } from "./lib/persistence";
import { initEdgeHitWiring } from "./lib/edgeHitWiring";
import { createControllers } from "./lib/controllerFactory";
import { translateDOM, registerLocale, setLocale, hasLocale } from "./lib/i18n";
import { is } from "./locales/is";
import { pl } from "./locales/pl";
import { es } from "./locales/es";
import { pt } from "./locales/pt";
import { fo } from "./locales/fo";
import "./styles/index.css";

registerLocale("is", is);
registerLocale("pl", pl);
registerLocale("es", es);
registerLocale("pt", pt);
registerLocale("fo", fo);

const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;
if (!mapTilerKey) {
  throw new Error(
    "Missing VITE_MAPTILER_KEY environment variable. See README for setup instructions.",
  );
}

// Apply i18n translations to all data-i18n DOM nodes before anything renders.
translateDOM();

document.body.classList.add("is-loading");

let map: maplibregl.Map;
try {
  map = new maplibregl.Map({
    container: "map",
    style: `https://api.maptiler.com/maps/positron/style.json?key=${mapTilerKey}`,
    // Iceland overview as the initial paint (the app is Iceland-centric); on a
    // first visit applyInitialCamera() then refines this to the user's location
    // or the Reykjavík fallback once the map loads (task A1).
    center: [-19, 65],
    zoom: 5.5,
    pitch: 0,
    bearing: 0,
    // Lock the map to a flat, north-up 2D view: no rotation, no tilt.
    // dragRotate/pitchWithRotate/touchPitch kill the mouse + two-finger
    // gestures; maxPitch: 0 prevents any tilt from any source.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    canvasContextAttributes: { contextType: "webgl2" },
  });
} catch (err) {
  document.body.classList.remove("is-loading");
  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;font-family:sans-serif;color:#555;padding:24px;text-align:center;">
        <strong style="font-size:16px;">Map could not be initialised</strong>
        <span style="font-size:13px;">The browser blocked WebGL — this usually resolves itself after a page reload.</span>
        <button onclick="location.reload()" style="margin-top:8px;padding:8px 20px;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-size:13px;">Reload</button>
      </div>`;
  }
  throw err;
}

// Keep two-finger pinch-zoom but strip the rotation it would otherwise apply,
// so the map stays north-up while zooming on touch.
map.touchZoomRotate.disableRotation();

// iOS Safari ignores `user-scalable=no` and pinch-zooms the whole page, which
// steals the two-finger gesture from the map. Suppressing the proprietary
// `gesture*` events lets MapLibre own the pinch so it zooms the map instead of
// the document. Harmless on browsers that never fire these events.
const preventNativeGesture = (event: Event) => event.preventDefault();
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, preventNativeGesture, { passive: false });
}

const persistedState = loadPersistedState();

// Locale resolution: URL param (?lang=is) > URL path (/is or /en) > persisted preference > browser language > 'en'
const urlLocale = new URLSearchParams(location.search)
  .get("lang")
  ?.toLowerCase();
const pathLocale = location.pathname
  .split("/")
  .find((seg) => seg.length > 0)
  ?.toLowerCase();
const savedLocale = persistedState?.locale;
const browserLocale = navigator.language?.split("-")[0].toLowerCase();
const resolvedLocale =
  urlLocale && hasLocale(urlLocale)
    ? urlLocale
    : pathLocale && hasLocale(pathLocale)
      ? pathLocale
      : savedLocale && hasLocale(savedLocale)
        ? savedLocale
        : hasLocale(browserLocale)
          ? browserLocale
          : "en";
setLocale(resolvedLocale);

// Only hide the language toggle when locale comes from a ?lang= query param —
// that pattern is used for WordPress/iframe embedding where the host page
// controls the language.  Path-based locale (/en, /is) is a regular navigated
// URL; the toggle stays visible so the user can see (and override) the locale.
const localeIsUrlDriven = !!(urlLocale && hasLocale(urlLocale));

map.addControl(
  new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
  "bottom-left",
);

const isDev = import.meta.env.DEV;

if (!isDev) {
  document.querySelector('label[for="inhouse-variable"]')?.remove();
  document.getElementById("inhouse-variable")?.remove();
  document.getElementById("inhouse-add-layer")?.remove();
  document.querySelector('label[for="inhouse-preset"]')?.remove();
  document.getElementById("inhouse-preset")?.remove();
}

const dom = queryDom();
initEdgeHitWiring(dom);

createControllers({ map, dom, isDev, persistedState, localeIsUrlDriven });
