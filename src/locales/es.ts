/**
 * Configuración regional en español — Fases 1 y 2: interfaz visible + cadenas internas/de desarrollo.
 *
 * Las claves usan notación con puntos, agrupadas por área funcional.
 * Los valores pueden contener marcadores {{param}} para la interpolación.
 *
 */
export const es: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Pronóstico",
  "nav.icons": "Iconos",
  "nav.iconography": "Iconografía",
  "nav.forecastIcons": "Iconos de pronóstico",

  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Clásico",
  "iconStyle.compact": "Compacto",
  "iconStyle.classicTip":
    "Widget clásico (icono de yr.no + viento + temperatura)",
  "iconStyle.compactTip":
    "Texto compacto (temperatura y velocidad/dirección del viento como texto)",

  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Ampliar",
  "map.zoomOut": "Reducir",
  "map.grid": "Rejilla",
  "map.gridOn": "Rejilla: activada",
  "map.gridOff": "Rejilla: desactivada",
  "map.info": "Información del mapa",
  "map.controls": "Controles del mapa",
  "map.viewMode": "Modo de visualización",
  "map.layerControls": "Controles de capa",
  "map.toggleLayers": "Activar o desactivar capas",
  "map.infoControls": "Controles de información del mapa",
  "map.close": "Cerrar",
  "map.variable": "Variable",
  "map.variables": "Variables",

  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Temperatura",
  "layer.wind": "Viento",
  "layer.precip": "Precipitación",
  "layer.cloud": "Nubosidad",
  "layer.snow": "Profundidad de nieve",
  "layer.waves": "Ondas",

  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Flechas",
  "wind.particles": "Partículas",
  "wind.streamlines": "Líneas de corriente",

  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Requiere wind_uv_10m",
  "wind.noFirefox": "Partículas no compatibles con Firefox",
  "wind.noWebGL2": "Partículas requieren WebGL2",
  "wind.unavailable": "Partículas no disponibles",
  "wind.uvRequired":
    "Las partículas y las líneas de corriente requieren wind_uv_10m.",
  "wind.firefoxFallback":
    "La capa de partículas no es compatible con Firefox; se usarán flechas como alternativa.",
  "wind.webgl2Fallback": "La capa de partículas requiere WebGL2.",
  "wind.fallbackArrows":
    "La capa de partículas no está disponible; se usarán flechas como alternativa.",

  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Temperatura del aire",
  "var.windSpeed": "Velocidad del viento",
  "var.mslp": "Presión atmosférica media al nivel del mar",
  "var.temperature": "Temperatura",
  "var.precipRate": "Tasa de precipitación",
  "var.windDirection": "Dirección del viento",
  "var.humidity": "Humedad relativa",
  "var.pressure": "Presión atmosférica al nivel del mar",
  "var.radiation": "Irradiancia descendente de onda corta",
  "var.windGust": "Ráfaga de viento",

  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Altura significativa de la ola",

  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/hr",
  "unit.hPa": "hPa",
  "unit.degrees": "grados",
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
  "dir.SSW": "SSO",
  "dir.SW": "SO",
  "dir.WSW": "OSO",
  "dir.W": "O",
  "dir.WNW": "ONO",
  "dir.NW": "NO",
  "dir.NNW": "NNO",

  // ── Graticule cardinal labels ────────────────────────────────────────
  "cardinal.N": "N",
  "cardinal.S": "S",
  "cardinal.E": "E",
  "cardinal.W": "O",

  // ── Loading / status ─────────────────────────────────────────────────
  "status.loadingFrame": "Cargando vista…",
  "status.loadingModel": "Cargando modelo…",
  "status.loadingWavegram": "Cargando gráfico de oleaje…",
  "status.noData": "No hay datos disponibles.",
  "status.noNumericData":
    "No hay datos numéricos para esta variable o rango temporal.",

  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Gráfico de oleaje ampliado",

  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Duración",
  "wavegram.hours": "{{n}} horas",
  "wavegram.downloadPng": "Descargar PNG",
  "wavegram.print": "Imprimir",
  "wavegram.showTech": "Mostrar detalles técnicos",
  "wavegram.failed": "No se pudo cargar el gráfico de oleaje.",
  "wavegram.unconfigured":
    "El servicio de gráfico de oleaje no está configurado. Define VITE_BELGINGUR_BASE_URL para activarlo.",
  "wavegram.downloadFail":
    "Descarga fallida. Abra la imagen en una pestaña nueva para guardarla.",

  // ── External links ──────────────────────────────────────────────────

  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Capa visible",
  "legacy.latLonGrid": "Cuadrícula lat/lon",
  "legacy.opacity": "Opacidad",
  "legacy.addLayer": "Añadir capa",

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════

  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "No se añadieron capas internas.",
  "inhouse.render": "Renderizar",
  "inhouse.raster": "Ráster",
  "inhouse.contour": "Curvas de nivel",
  "inhouse.remove": "Eliminar",

  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • duración {{duration}} horas • huso horario UTC",
  "wavegram.downloadError":
    "Descarga fallida. Abra la imagen en una pestaña nueva para guardarla. ({{message}})",
  "wavegram.printTitle": "Gráfico de oleaje ampliado",

  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",

  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  "day.0": "Dom",
  "day.1": "Lun",
  "day.2": "Mar",
  "day.3": "Mié",
  "day.4": "Jue",
  "day.5": "Vie",
  "day.6": "Sáb",

  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Reproducir línea de tiempo",
  "timeline.selectedTime": "Hora seleccionada",

  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "No se pudieron actualizar las capas",
  "error.countryOutlines": "No se pudieron cargar los contornos de los países",
  "error.windData": "No se pudieron cargar los datos de viento.",
  "error.precipData": "No se pudieron cargar los datos de precipitación.",
  "error.precipUnavail": "Datos de precipitación no disponibles.",
  "error.styleFallback":
    "Se usará el estilo de demostración de MapLibre como alternativa: {{message}}.",

  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback":
    "La capa de partículas no está disponible; se usarán flechas como alternativa.",
};
