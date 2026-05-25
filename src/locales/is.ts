/**
 * Icelandic locale — is
 *
 * Keys mirror en.ts exactly. Edit the values on the right-hand side.
 * Lines marked  // TODO  are technical / dev strings — translate or leave
 * as-is depending on your audience.
 *
 * To activate:
 *   import { is } from '../locales/is';
 *   import { registerLocale, setLocale } from '../lib/i18n';
 *   registerLocale('is', is);
 *   setLocale('is');
 */
export const is: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Veðurspá",
  "nav.icons": "Tákn",
  "nav.iconography": "Táknmyndaspá",
  "nav.forecastIcons": "Spátákn",

  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Klassískt",
  "iconStyle.compact": "Þétt",
  "iconStyle.classicTip": "Klassísk gluggi (yr.no tákn + vindur + hiti)",
  "iconStyle.compactTip": "Þéttur texti (hiti og vindhraði/átt sem texti)",

  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Þysja inn",
  "map.zoomOut": "Þysja út",
  "map.grid": "Hnitanet",
  "map.gridOn": "Hnitanet: Kveikt",
  "map.gridOff": "Hnitanet: Slökkt",
  "map.info": "Kortaupplýsingar",
  "map.controls": "Kortastýringar",
  "map.viewMode": "Skoðunarhamur",
  "map.layerControls": "Lagastýringar",
  "map.toggleLayers": "Víxla lögum",
  "map.infoControls": "Upplýsingastýringar",
  "map.close": "Loka",
  "map.variable": "Breyta",
  "map.variables": "Breytur",

  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Hiti",
  "layer.wind": "Vindur",
  "layer.precip": "Úrkoma",
  "layer.cloud": "Skýjahula",
  "layer.snow": "Snjódýpt",
  "layer.waves": "Ölduhæð",

  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Örvar",
  "wind.particles": "Agnir",
  "wind.streamlines": "Straumlínur",

  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Krefst wind_uv_10m", // TODO
  "wind.noFirefox": "Agnir ekki studdar í Firefox",
  "wind.noWebGL2": "Agnir krefjast WebGL2",
  "wind.unavailable": "Agnir ekki tiltækar",
  "wind.uvRequired": "Agnir og straumlínur krefjast wind_uv_10m.",
  "wind.firefoxFallback": "Agnalag er ekki stutt í Firefox; fer aftur í örvar.",
  "wind.webgl2Fallback": "Agnalag krefst WebGL2.",
  "wind.fallbackArrows": "Agnalag ekki tiltækt; fer aftur í örvar.",

  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Lofthiti",
  "var.windSpeed": "Vindhraði",
  "var.mslp": "Meðalloftþrýstingur við sjávarmál",
  "var.temperature": "Hiti",
  "var.precipRate": "Úrkoma",
  "var.windDirection": "Vindátt",
  "var.humidity": "Loftraki",
  "var.pressure": "Loftþrýstingur við sjávarmál",
  "var.radiation": "Stuttbylgjugeislun",
  "var.windGust": "Vindhviða",

  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Ölduhæð",

  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/klst",
  "unit.hPa": "hPa",
  "unit.degrees": "gráður",
  "unit.percent": "%",
  "unit.wm2": "W/m²",
  "unit.seconds": "s",
  "unit.metres": "m",

  // ── Compass directions (16-point) ────────────────────────────────────
  "dir.N": "N",
  "dir.NNE": "NNA",
  "dir.NE": "NA",
  "dir.ENE": "ANA",
  "dir.E": "A",
  "dir.ESE": "ASA",
  "dir.SE": "SA",
  "dir.SSE": "SSA",
  "dir.S": "S",
  "dir.SSW": "SSV",
  "dir.SW": "SV",
  "dir.WSW": "VSV",
  "dir.W": "V",
  "dir.WNW": "VNV",
  "dir.NW": "NV",
  "dir.NNW": "NNV",

  // ── Graticule cardinal labels ────────────────────────────────────────
  "cardinal.N": "N",
  "cardinal.S": "S",
  "cardinal.E": "A",
  "cardinal.W": "V",

  // ── Loading / status ─────────────────────────────────────────────────
  "status.loadingFrame": "Sæki ramma…",
  "status.loadingModel": "Sæki líkani…",
  "status.loadingWavegram": "Hleð bylgjurit…",
  "status.noData": "Vantar gögn.",
  "status.noNumericData": "Vantar gögn fyrir þessa breytu/tímabil.",

  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Öldurit",

  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Tímalengd",
  "wavegram.hours": "{{n}} klukkustundir",
  "wavegram.downloadPng": "Hleð niður PNG",
  "wavegram.print": "Prenta",
  "wavegram.showTech": "Birta tæknilegar upplýsingar",
  "wavegram.failed": "Tókst ekki að sækja bylgjurit.",
  "wavegram.unconfigured":
    "Bylgjuritsþjónusta er ekki stillt. Settu VITE_BELGINGUR_BASE_URL til að virkja hana.",
  "wavegram.downloadFail":
    "Niðurhal mistókst. Opnaðu mynd í nýjum flipa til að vista.",

  // ── External links ───────────────────────────────────────────────────

  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Lag sýnilegt",
  "legacy.latLonGrid": "Hnitanet",
  "legacy.opacity": "Gegnsæi",
  "legacy.addLayer": "Bæta við lagi",

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════

  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "Engum lögum bætt við.",
  "inhouse.render": "Birta",
  "inhouse.raster": "Raster", // TODO
  "inhouse.contour": "Hæðarlínur",
  "inhouse.remove": "Fjarlægja",

  // ── Tooltip ──────────────────────────────────────────────────────────
  "tooltip.wave": "{{height}} {{period}} {{dir}}",
  "tooltip.waveNoDir": "{{height}} {{period}}",

  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • tímalengd {{duration}} klukkustundir • tz UTC",
  "wavegram.downloadError":
    "Niðurhal mistókst. Opnaðu mynd í nýjum flipa til að vista. ({{message}})",
  "wavegram.printTitle": "Öldurit",

  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",

  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  "day.0": "sun",
  "day.1": "mán",
  "day.2": "þri",
  "day.3": "mið",
  "day.4": "fim",
  "day.5": "fös",
  "day.6": "lau",

  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Spila tímalínu",
  "timeline.selectedTime": "Valinn tími",

  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "Tókst ekki að uppfæra lag",
  "error.countryOutlines": "Tókst ekki að hlaða landamærum",
  "error.windData": "Tókst ekki að hlaða vindgögnum.",
  "error.precipData": "Tókst ekki að hlaða úrkomugögnum.",
  "error.precipUnavail": "Úrkomugagnasafn ekki tiltækt.",
  "error.styleFallback": "Fer aftur í MapLibre sýnikort: {{message}}", // TODO

  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback": "Agnalag ekki tiltækt, fer aftur í örvar.",
};
