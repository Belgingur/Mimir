/**
 * English locale — Phase 1 & 2: visible UI + internal/dev strings.
 *
 * Keys use dot-notation grouped by feature area.
 * Values may contain {{param}} placeholders for interpolation.
 */
export const en: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Forecast",
  "nav.icons": "Icons",
  "nav.iconography": "Iconography",
  "nav.forecastIcons": "Forecast icons",

  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Classic",
  "iconStyle.compact": "Compact",
  "iconStyle.classicTip": "Classic widget (yr.no icon + wind + temperature)",
  "iconStyle.compactTip":
    "Compact text (temperature and wind speed/direction as text)",

  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Zoom in",
  "map.zoomOut": "Zoom out",
  "map.grid": "Grid",
  "map.gridOn": "Grid: On",
  "map.gridOff": "Grid: Off",
  "map.info": "Map info",
  "map.controls": "Map controls",
  "map.viewMode": "View mode",
  "map.layerControls": "Layer controls",
  "map.toggleLayers": "Toggle layers",
  "map.infoControls": "Map info controls",
  "map.close": "Close",
  "map.variable": "Variable",
  "map.variables": "Variables",

  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Temperature",
  "layer.wind": "Wind",
  "layer.precip": "Precipitation",
  "layer.cloud": "Cloud Cover",
  "layer.snow": "Snow Depth",
  "layer.waves": "Waves",

  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Arrows",
  "wind.particles": "Particles",
  "wind.streamlines": "Streamlines",

  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Requires wind_uv_10m",
  "wind.noFirefox": "Particles unsupported in Firefox",
  "wind.noWebGL2": "Particles require WebGL2",
  "wind.unavailable": "Particles unavailable",
  "wind.uvRequired": "Particles and streamlines require wind_uv_10m.",
  "wind.firefoxFallback":
    "Particle layer is not supported in Firefox; falling back to arrows.",
  "wind.webgl2Fallback": "Particle layer requires WebGL2.",
  "wind.fallbackArrows": "Particle layer unavailable; falling back to arrows.",

  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Air temperature",
  "var.windSpeed": "Wind speed",
  "var.mslp": "Mean sea level pressure",
  "var.temperature": "Temperature",
  "var.precipRate": "Precipitation rate",
  "var.windDirection": "Wind direction",
  "var.humidity": "Relative humidity",
  "var.pressure": "Sea level pressure",
  "var.radiation": "Downward shortwave flux",
  "var.windGust": "Wind gust",

  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Significant wave height",

  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/hr",
  "unit.hPa": "hPa",
  "unit.degrees": "degrees",
  "unit.percent": "%",
  "unit.wm2": "W/m²",
  "unit.seconds": "s",
  "unit.metres": "m",

  // ── Compass directions (16-point) ────────────────────────────────────
  "dir.N": "N",
  "dir.NNE": "NNE",
  "dir.NE": "NE",
  "dir.ENE": "ENE",
  "dir.E": "E",
  "dir.ESE": "ESE",
  "dir.SE": "SE",
  "dir.SSE": "SSE",
  "dir.S": "S",
  "dir.SSW": "SSW",
  "dir.SW": "SW",
  "dir.WSW": "WSW",
  "dir.W": "W",
  "dir.WNW": "WNW",
  "dir.NW": "NW",
  "dir.NNW": "NNW",

  // ── Graticule cardinal labels ────────────────────────────────────────
  "cardinal.N": "N",
  "cardinal.S": "S",
  "cardinal.E": "E",
  "cardinal.W": "W",

  // ── Loading / status ─────────────────────────────────────────────────
  "status.loadingFrame": "Loading frame…",
  "status.loadingModel": "Loading model...",
  "status.loadingWavegram": "Loading wavegram…",
  "status.noData": "No data available.",
  "status.noNumericData": "No numeric data for this variable/time range.",

  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Spread wavegram",

  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Duration",
  "wavegram.hours": "{{n}} hours",
  "wavegram.downloadPng": "Download PNG",
  "wavegram.print": "Print",
  "wavegram.showTech": "Show technical details",
  "wavegram.failed": "Failed to load wavegram.",
  "wavegram.unconfigured":
    "Wavegram service is not configured. Set VITE_BELGINGUR_BASE_URL to enable it.",
  "wavegram.downloadFail": "Download failed. Open image in new tab to save.",

  // ── External links ──────────────────────────────────────────────────

  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Layer visible",
  "legacy.latLonGrid": "Lat/Lon grid",
  "legacy.opacity": "Opacity",
  "legacy.addLayer": "Add layer",

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════

  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "No in-house layers added.",
  "inhouse.render": "Render",
  "inhouse.raster": "Raster",
  "inhouse.contour": "Contour",
  "inhouse.remove": "Remove",

  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • duration {{duration}} hours • tz UTC",
  "wavegram.downloadError":
    "Download failed. Open image in new tab to save. ({{message}})",
  "wavegram.printTitle": "Spread wavegram",

  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.wave": "{{height}} {{period}} {{dir}}",
  "tooltip.waveNoDir": "{{height}} {{period}}",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",

  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  "day.0": "Sun",
  "day.1": "Mon",
  "day.2": "Tue",
  "day.3": "Wed",
  "day.4": "Thu",
  "day.5": "Fri",
  "day.6": "Sat",

  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Play timeline",
  "timeline.selectedTime": "Selected time",

  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "Failed to update layers",
  "error.countryOutlines": "Failed to load country outlines",
  "error.windData": "Failed to load wind data.",
  "error.precipData": "Failed to load precipitation data.",
  "error.precipUnavail": "Precipitation dataset unavailable.",
  "error.styleFallback": "Falling back to MapLibre demo style: {{message}}",

  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback":
    "Particle layer unavailable, falling back to arrows.",
};
