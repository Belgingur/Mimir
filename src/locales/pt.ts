export const pt: Record<string, string> = {
  // ── Navigation / view modes ──────────────────────────────────────────
  "nav.forecast": "Previsão",
  "nav.icons": "Ícones",
  "nav.iconography": "Iconografia",
  "nav.forecastIcons": "Ícones de previsão",
  // ── Icon style sub-buttons ───────────────────────────────────────────
  "iconStyle.classic": "Clássico",
  "iconStyle.compact": "Compacto",
  "iconStyle.classicTip": "Widget clássico (ícone yr.no + vento + temperatura)",
  "iconStyle.compactTip":
    "Texto compacto (temperatura e velocidade/direção do vento em texto)",
  // ── Map controls ─────────────────────────────────────────────────────
  "map.zoomIn": "Mais zoom",
  "map.zoomOut": "Menos zoom",
  "map.grid": "Grade",
  "map.gridOn": "Grade: Ativada",
  "map.gridOff": "Grade: Desativada",
  "map.info": "Informações do mapa",
  "map.controls": "Controles do mapa",
  "map.viewMode": "Modo de visualização",
  "map.layerControls": "Controles de camadas",
  "map.toggleLayers": "Alternar camadas",
  "map.infoControls": "Controles de informações do mapa",
  "map.close": "Fechar",
  "map.variable": "Variável",
  "map.variables": "Variáveis",
  // ── Layer groups ─────────────────────────────────────────────────────
  "layer.temperature": "Temperatura",
  "layer.wind": "Vento",
  "layer.precip": "Precipitação",
  "layer.cloud": "Cobertura de nuvens",
  "layer.snow": "Profundidade de neve",
  "layer.waves": "Ondas",
  // ── Wind style options ───────────────────────────────────────────────
  "wind.arrows": "Setas",
  "wind.particles": "Partículas",
  "wind.streamlines": "Linhas de corrente",
  // ── Wind style warnings ──────────────────────────────────────────────
  "wind.requiresUV": "Requer wind_uv_10m",
  "wind.noFirefox": "Partículas não suportadas no Firefox",
  "wind.noWebGL2": "Partículas requerem WebGL2",
  "wind.unavailable": "Partículas indisponíveis",
  "wind.uvRequired": "Partículas e linhas de corrente requerem wind_uv_10m.",
  "wind.firefoxFallback":
    "Camada de partículas não é suportada no Firefox; usando setas como alternativa.",
  "wind.webgl2Fallback": "Camada de partículas requer WebGL2.",
  "wind.fallbackArrows":
    "Camada de partículas indisponível; usando setas como alternativa.",
  // ── Variable labels (legends / tooltips) ─────────────────────────────
  "var.airTemperature": "Temperatura do ar",
  "var.windSpeed": "Velocidade do vento",
  "var.mslp": "Pressão média ao nível do mar",
  "var.temperature": "Temperatura",
  "var.precipRate": "Taxa de precipitação",
  "var.windDirection": "Direção do vento",
  "var.humidity": "Umidade relativa",
  "var.pressure": "Pressão ao nível do mar",
  "var.radiation": "Fluxo de onda curta descendente",
  "var.windGust": "Rajada de vento",
  // ── Legend titles ─────────────────────────────────────────────────────
  "legend.waveHeight": "Altura significativa das ondas",
  // ── Units ────────────────────────────────────────────────────────────
  "unit.celsius": "°C",
  "unit.ms": "m/s",
  "unit.mmhr": "mm/hr",
  "unit.hPa": "hPa",
  "unit.degrees": "graus",
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
  "status.loadingFrame": "Carregando quadro…",
  "status.loadingModel": "Carregando modelo…",
  "status.loadingWavegram": "Carregando ondograma…",
  "status.noData": "Nenhum dado disponível.",
  "status.noNumericData":
    "Nenhum dado numérico para esta variável/intervalo de tempo.",
  // ── Modal titles ─────────────────────────────────────────────────────
  "modal.wavegram": "Ondograma de dispersão",
  // ── Wavegram controls ────────────────────────────────────────────────
  "wavegram.duration": "Duração",
  "wavegram.hours": "{{n}} horas",
  "wavegram.downloadPng": "Baixar PNG",
  "wavegram.print": "Imprimir",
  "wavegram.showTech": "Exibir detalhes técnicos",
  "wavegram.failed": "Falha ao carregar ondograma.",
  "wavegram.unconfigured":
    "O serviço de ondograma não está configurado. Defina VITE_BELGINGUR_BASE_URL para ativá-lo.",
  "wavegram.downloadFail":
    "Falha no download. Abra a imagem numa nova aba para salvar.",
  // ── External links ──────────────────────────────────────────────────
  // ── Legacy / hidden controls (low priority but in DOM) ───────────────
  "legacy.layerVisible": "Camada visível",
  "legacy.latLonGrid": "Grade Lat/Lon",
  "legacy.opacity": "Opacidade",
  "legacy.addLayer": "Adicionar camada",
  // ══════════════════════════════════════════════════════════════════════
  // Phase 2: internal / dev / error strings
  // ══════════════════════════════════════════════════════════════════════
  // ── Inhouse catalog ──────────────────────────────────────────────────
  "inhouse.noLayers": "Nenhuma camada interna adicionada.",
  "inhouse.render": "Renderizar",
  "inhouse.raster": "Raster",
  "inhouse.contour": "Contorno",
  "inhouse.remove": "Remover",
  // ── Wavegram (additional) ────────────────────────────────────────────
  "wavegram.subtitle":
    "GWES • {{lat}},{{lon}} • duração de {{duration}} horas • fuso UTC",
  "wavegram.downloadError":
    "Falha no download. Abra a imagem numa nova aba para salvar. ({{message}})",
  "wavegram.printTitle": "Ondograma de dispersão",
  // ── Tooltip units / values ───────────────────────────────────────────
  "tooltip.wavePeriod": "{{value}} s",
  "tooltip.mslp": "{{value}} hPa",
  "tooltip.tempValue": "{{value}} °C",
  // ── Weekday abbreviations (UTC day labels on the timeline) ───────────
  "day.0": "Dom",
  "day.1": "Seg",
  "day.2": "Ter",
  "day.3": "Qua",
  "day.4": "Qui",
  "day.5": "Sex",
  "day.6": "Sáb",
  // ── Timeline ─────────────────────────────────────────────────────────
  "timeline.play": "Reproduzir linha do tempo",
  "timeline.selectedTime": "Horário selecionado",
  // ── Error messages ───────────────────────────────────────────────────
  "error.updateLayers": "Falha ao atualizar camadas",
  "error.countryOutlines": "Falha ao carregar contornos de países",
  "error.windData": "Falha ao carregar dados de vento.",
  "error.precipData": "Falha ao carregar dados de precipitação.",
  "error.precipUnavail": "Conjunto de dados de precipitação indisponível.",
  "error.styleFallback":
    "Usando estilo de demonstração do MapLibre como alternativa: {{message}}",
  // ── Wind style fallback (console + UI) ───────────────────────────────
  "wind.particleFallback":
    "Camada de partículas indisponível, usando setas como alternativa.",
};
