/**
 * Polish locale — Phase 1 & 2: visible UI + internal/dev strings.
 *
 * Translation notes:
 *   - Meteorological terminology follows IMGW-PIB (Polish national met institute) conventions.
 *   - UI verbs use 2nd-person imperative or short infinitive — standard for Polish web apps
 *     (yr.no PL, windy.com PL, meteo.pl, pogodynka.pl all follow this pattern).
 *   - Compass abbreviations: international single-letter codes (N/S/E/W) are universally
 *     kept in Polish meteorology; full 16-point abbreviations also match IMGW notation.
 *   - "Streamlines" → "linie prądu" (standard fluid dynamics term in Polish).
 *   - "Particles" as a wind visualisation → "cząsteczki" (used by windy.com PL).
 *   - Wave height: "Znacząca wysokość fali" — IMGW/BHMW standard phrase.
 *   - Pressure labels: "Ciśnienie atmosferyczne na poziomie morza" (IMGW usage).
 *   - {{param}} placeholders preserved verbatim.
 */
export const pl: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Prognoza",
  "nav.icons": "Ikony",
  "nav.iconography": "Ikonografia",
  "nav.forecastIcons": "Ikony prognozy",

  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Klasyczny",
  "iconStyle.compact": "Kompaktowy",
  "iconStyle.classicTip": "Widżet klasyczny (ikona + wiatr + temperatura)",
  "iconStyle.compactTip":
    "Tekst kompaktowy (temperatura i prędkość/kierunek wiatru jako tekst)",

  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Przybliż",
  "map.zoomOut": "Oddal",
  "map.grid": "Siatka",
  "map.gridOn": "Siatka: włączona",
  "map.gridOff": "Siatka: wyłączona",
  "map.info": "Informacje o mapie",
  "map.controls": "Sterowanie mapą",
  "map.viewMode": "Tryb widoku",
  "map.layerControls": "Sterowanie warstwami",
  "map.toggleLayers": "Przełącz warstwy",
  "map.infoControls": "Sterowanie informacjami",
  "map.close": "Zamknij",
  "map.variable": "Zmienna",
  "map.variables": "Zmienne",

  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Temperatura",
  "layer.wind": "Wiatr",
  "layer.precip": "Opady",
  "layer.cloud": "Zachmurzenie",
  "layer.snow": "Grubość pokrywy śnieżnej",
  "layer.waves": "Fale",

  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Strzałki",
  "wind.particles": "Cząsteczki",
  "wind.streamlines": "Linie prądu",

  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Wymaga wind_uv_10m",
  "wind.noFirefox": "Cząsteczki nieobsługiwane w przeglądarce Firefox",
  "wind.noWebGL2": "Cząsteczki wymagają WebGL2",
  "wind.unavailable": "Cząsteczki niedostępne",
  "wind.uvRequired": "Cząsteczki i linie prądu wymagają wind_uv_10m.",
  "wind.firefoxFallback":
    "Warstwa cząsteczek nie jest obsługiwana w przeglądarce Firefox; przełączono na strzałki.",
  "wind.webgl2Fallback": "Warstwa cząsteczek wymaga WebGL2.",
  "wind.fallbackArrows":
    "Warstwa cząsteczek niedostępna; przełączono na strzałki.",

  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Temperatura powietrza",
  "var.windSpeed": "Prędkość wiatru",
  "var.mslp": "Ciśnienie atmosferyczne na poziomie morza",
  "var.temperature": "Temperatura",
  "var.precipRate": "Opad",
  "var.windDirection": "Kierunek wiatru",
  "var.humidity": "Wilgotność względna",
  "var.pressure": "Ciśnienie na poziomie morza",
  "var.radiation": "Strumień promieniowania krótkofalowego",
  "var.windGust": "Porywy wiatru",

  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Znacząca wysokość fali",

  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/godz.",
  "unit.hPa": "hPa",
  "unit.degrees": "stopnie",
  "unit.percent": "%",
  "unit.wm2": "W/m²",
  "unit.seconds": "s",
  "unit.metres": "m",

  // ── Compass directions (16-point) ────────────────────────────────────
  // International abbreviations are standard in Polish meteorology (IMGW notation).
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
  "status.loadingFrame": "Wczytywanie klatki…",
  "status.loadingModel": "Wczytywanie modelu…",
  "status.loadingWavegram": "Wczytywanie wykresu falowania…",
  "status.noData": "Brak dostępnych danych.",
  "status.noNumericData":
    "Brak danych liczbowych dla tej zmiennej/zakresu czasu.",

  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Wykres falowania",

  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Czas trwania",
  "wavegram.hours": "{{n}} godz.",
  "wavegram.downloadPng": "Pobierz PNG",
  "wavegram.print": "Drukuj",
  "wavegram.showTech": "Pokaż szczegóły techniczne",
  "wavegram.failed": "Nie udało się wczytać wykresu falowania.",
  "wavegram.unconfigured":
    "Usługa wykresu falowania nie jest skonfigurowana. Ustaw VITE_BELGINGUR_BASE_URL, aby ją włączyć.",
  "wavegram.downloadFail":
    "Pobieranie nie powiodło się. Otwórz obraz w nowej karcie, aby go zapisać.",

  // ── External links ──────────────────────────────────────────────────

  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Warstwa widoczna",
  "legacy.latLonGrid": "Siatka szer./dług. geogr.",
  "legacy.opacity": "Przezroczystość",
  "legacy.addLayer": "Dodaj warstwę",

  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════

  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "Nie dodano żadnych warstw wewnętrznych.",
  "inhouse.render": "Renderuj",
  "inhouse.raster": "Raster",
  "inhouse.contour": "Izolinia",
  "inhouse.remove": "Usuń",

  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • czas trwania {{duration}} godz. • tz UTC",
  "wavegram.downloadError":
    "Pobieranie nie powiodło się. Otwórz obraz w nowej karcie, aby go zapisać. ({{message}})",
  "wavegram.printTitle": "Wykres falowania",

  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",

  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  "day.0": "Nd",
  "day.1": "Pn",
  "day.2": "Wt",
  "day.3": "Śr",
  "day.4": "Cz",
  "day.5": "Pt",
  "day.6": "So",

  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Odtwórz oś czasu",
  "timeline.selectedTime": "Wybrany czas",

  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "Nie udało się zaktualizować warstw",
  "error.countryOutlines": "Nie udało się wczytać granic państw",
  "error.windData": "Nie udało się wczytać danych o wietrze.",
  "error.precipData": "Nie udało się wczytać danych o opadach.",
  "error.precipUnavail": "Zbiór danych o opadach jest niedostępny.",
  "error.styleFallback":
    "Przełączono na styl demonstracyjny MapLibre: {{message}}",

  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback":
    "Warstwa cząsteczek niedostępna, przełączono na strzałki.",
};
