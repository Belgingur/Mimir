/**
 * Faroese locale — fo
 *
 * Keys mirror en.ts exactly. Edit the values on the right-hand side.
 * Lines marked  // TODO  are technical / dev strings — translate or leave
 * as-is depending on your audience.
 *
 */
export const fo: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Veðurforsøgn",
  "nav.icons": "Tekn",
  "nav.iconography": "Veðurtekn",
  "nav.forecastIcons": "Forsagnartekn",

  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Klassiskt",
  "iconStyle.compact": "Tætt",
  "iconStyle.classicTip": "Klassiskur gluggi (yr.no tekn + vindur + hiti)",
  "iconStyle.compactTip": "Tættur tekstur (hiti og vindferð/vindætt sum tekstur)",

  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Suma inn",
  "map.zoomOut": "Suma út",
  "map.grid": "Kortnet",
  "map.gridOn": "Kortnet: Tendrað",
  "map.gridOff": "Kortnet: Sløkt",
  "map.info": "Kortupplýsingar",
  "map.controls": "Kortstýring",
  "map.viewMode": "Vísingarháttur",
  "map.layerControls": "Lagstýring",
  "map.toggleLayers": "Skift løg",
  "map.infoControls": "Stýring av kortupplýsingum",
  "map.close": "Lat aftur",
  "map.myLocation": "Brúka mína staðseting",
  "map.locationUnavailable": "Kundi ikki finna staðseting tína.",
  "map.noForecastHere": "Eingin forsøgn her — punktið er uttanfyri spáøkið.",
  "map.variable": "Stødd",
  "map.variables": "Støddir",
  "map.menu": "Skrá",

  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Hiti",
  "layer.wind": "Vindur",
  "layer.precip": "Avfall",
  "layer.cloud": "Skýggj",
  "layer.snow": "Kavi (vatnsvirði)",
  "layer.waves": "Øldur",

  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Pílar",
  "wind.particles": "Partiklar",
  "wind.streamlines": "Streymlinjur",

  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Krevur wind_uv_10m", // TODO
  "wind.noFirefox": "Partiklar virka ikki í Firefox",
  "wind.noWebGL2": "Partiklar krevja WebGL2",
  "wind.unavailable": "Partiklar ikki tøkir",
  "wind.uvRequired": "Partiklar og streymlinjur krevja wind_uv_10m.",
  "wind.firefoxFallback": "Partikullagið virkar ikki í Firefox; vísi pílar í staðin.",
  "wind.webgl2Fallback": "Partikullagið krevur WebGL2.",
  "wind.fallbackArrows": "Partikullagið er ikki tøkt; vísi pílar í staðin.",

  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Lofthiti",
  "var.windSpeed": "Vindferð",
  "var.mslp": "Lufttrýst við havflatan",
  "var.temperature": "Hiti",
  "var.precipRate": "Avfall",
  "var.windDirection": "Vindætt",
  "var.humidity": "Luftvæta",
  "var.pressure": "Lufttrýst við havflatan",
  "var.radiation": "Stuttbylgjugeislan",
  "var.windGust": "Vindkast",

  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Alduhædd",

  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/t",
  "unit.hPa": "hPa",
  "unit.degrees": "stig",
  "unit.percent": "%",
  "unit.wm2": "W/m²",
  "unit.seconds": "s",
  "unit.metres": "m",

  // ── Compass directions (16-point) ────────────────────────────────────
  // norður, eystur, suður, vestur
  "dir.N": "N",
  "dir.NNE": "NNE",
  "dir.NE": "NE",
  "dir.ENE": "ENE",
  "dir.E": "E",
  "dir.ESE": "ESE",
  "dir.SE": "SE",
  "dir.SSE": "SSE",
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
  "cardinal.E": "E",
  "cardinal.W": "V",

  // ── Loading / status ─────────────────────────────────────────────────
  "status.loadingFrame": "Heinti mynd…",
  "status.loadingModel": "Heinti líkan…",
  "status.loadingDataset": "Heinti {{model}}…",
  "status.datasetFailed": "Kundi ikki heinta {{model}}. Kanska eru eingi dátur tøk júst nú.",
  "action.backToModel": "Aftur til {{model}}",
  "status.newRun": "Nýggjari forsøgn er tøk.",
  "status.modelOutsideView": "Hetta spálíkanið fevnir ikki um økið tú hyggur at.",
  "action.useCoveringModel": "Brúka eitt líkan sum fevnir um",
  "action.updateForecast": "Dagfør veðurforsøgn",
  "action.dismiss": "Lat aftur",
  "status.loadingWavegram": "Heinti aldurit…",
  "status.loadingMeteogram": "Heinti veðurrit…",
  "status.noData": "Eingi dátur tøk.",
  "status.noNumericData": "Eingi talvirði fyri hesa stødd/hetta tíðarskeiðið.",

  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Aldurit",
  "modal.meteogram": "Veðurrit",

  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Tíðarlongd",
  "wavegram.hours": "{{n}} tímar",
  "wavegram.downloadPng": "Tak niður PNG",
  "wavegram.print": "Prenta",
  "wavegram.zoomIn": "Størri",
  "wavegram.zoomOut": "Minni",
  "wavegram.zoomReset": "Laga til breiddina",
  "wavegram.showTech": "Vís tøkniligar upplýsingar",
  "wavegram.failed": "Kundi ikki heinta aldurit.",
  "meteogram.loadFailed": "Kundi ikki heinta veðurrit fyri {{model}} — staðurin kann vera uttanfyri spáøkið hjá líkanum. Royn eitt annað líkan ella ein annan stað. ({{message}})",
  "meteogram.outsideDomain": "Hesin staðurin kann vera uttanfyri spáøkið hjá {{model}}.",
  "meteogram.openAtCenter": "Vís veðurrit fyri merkta punktið",
  "wavegram.unconfigured":
    "Alduritstænastan er ikki sett upp. Set VITE_BELGINGUR_BASE_URL fyri at virkja hana.",
  "wavegram.downloadFail":
    "Niðurtøkan miseydnaðist. Lat myndina upp í nýggjum teigi fyri at goyma hana.",

  // ── External links ───────────────────────────────────────────────────

  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Lag sjónligt",
  "legacy.latLonGrid": "Breiddar-/longdarnet",
  "legacy.opacity": "Ógjøgnumskygni",
  "legacy.addLayer": "Legg lag afturat",

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════

  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "Eingi løg løgd afturat.",
  "inhouse.render": "Vís",
  "inhouse.raster": "Raster", // TODO
  "inhouse.contour": "Javnlinjur",
  "inhouse.remove": "Tak burtur",

  // ── Tooltip ──────────────────────────────────────────────────────────
  "tooltip.wave": "{{height}} {{period}} {{dir}}",
  "tooltip.waveNoDir": "{{height}} {{period}}",

  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • tíðarlongd {{duration}} tímar • tz UTC",
  "wavegram.downloadError":
    "Niðurtøkan miseydnaðist. Lat myndina upp í nýggjum teigi fyri at goyma hana. ({{message}})",
  "wavegram.printTitle": "Aldurit",

  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",

  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  // sunnudagur, mánadagur, týsdagur, mikudagur, hósdagur, fríggjadagur,
  // leygardagur
  "day.0": "sun",
  "day.1": "mán",
  "day.2": "týs",
  "day.3": "mik",
  "day.4": "hós",
  "day.5": "frí",
  "day.6": "ley",

  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Spæl tíðarlinjuna",
  "timeline.selectedTime": "Valda tíðin",
  "timeline.now": "Nú",

  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "Kundi ikki dagføra løgini",
  "error.countryOutlines": "Kundi ikki heinta landamørk",
  "error.windData": "Kundi ikki heinta vinddátur.",
  "error.precipData": "Kundi ikki heinta avfallsdátur.",
  "error.precipUnavail": "Avfallsdátur eru ikki tøk.",
  "error.styleFallback": "Brúki einfalt útlinjukort í staðin: {{message}}",

  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback": "Partikullagið er ikki tøkt, vísi pílar í staðin.",
};
