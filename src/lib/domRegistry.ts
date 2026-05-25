export interface AppDom {
  // -- map chrome --
  mapWrap: HTMLDivElement;
  zoomIn: HTMLButtonElement;
  zoomOut: HTMLButtonElement;
  infoButton: HTMLButtonElement;
  infoPanel: HTMLDivElement;

  // -- view mode buttons --
  viewForecastBtn: HTMLButtonElement;
  viewIconographyBtn: HTMLButtonElement | null;
  localeSwitcherBtn: HTMLButtonElement | null;

  // -- iconography style switcher --
  iconStyleClassicBtn: HTMLButtonElement | null;
  iconStyleCompactBtn: HTMLButtonElement | null;

  // -- tooltip --
  tooltipHost: HTMLDivElement;

  // -- wavegram --
  wavegramModal: HTMLDivElement;
  wavegramClose: HTMLButtonElement;
  wavegramSubtitle: HTMLDivElement;
  wavegramStatus: HTMLDivElement;
  wavegramDurationSelect: HTMLSelectElement;
  wavegramTechToggle: HTMLInputElement;
  wavegramImage: HTMLImageElement;
  wavegramDownload: HTMLButtonElement;
  wavegramPrint: HTMLButtonElement;

  // -- legends --
  legendHost: HTMLDivElement;
  waveLegendHost: HTMLDivElement;
  windLegendHost: HTMLDivElement;
  precipLegendHost: HTMLDivElement;
  cloudLegendHost: HTMLDivElement;
  snowDepthLegendHost: HTMLDivElement;
  legendStackCardEl: HTMLDivElement | null;

  // -- layer group / grid --
  layerGroupList: HTMLDivElement;
  gridToggleButton: HTMLButtonElement | null;
  layerSwitchCardEl: HTMLDivElement | null;
  gridToggleCardEl: HTMLDivElement | null;
  viewToggleCardEl: HTMLDivElement | null;
  modelCardEl: HTMLDivElement | null;
  gridLabelsContainer: HTMLDivElement;

  // -- inhouse catalog selectors --
  inhouseModelSelect: HTMLSelectElement;
  inhouseAnalysisSelect: HTMLSelectElement;
  inhouseVariableSelect: HTMLSelectElement | null;
  inhousePresetSelect: HTMLSelectElement | null;
  inhouseAddLayerBtn: HTMLButtonElement | null;
  inhouseLayersEl: HTMLDivElement | null;
  inhouseWarningEl: HTMLDivElement;
  inhouseTooltip: HTMLDivElement;

  // -- model bar / panel --
  modelBarEl: HTMLDivElement | null;
  modelPanelEl: HTMLDivElement | null;

  // -- model pill --
  modelPillBtn: HTMLButtonElement | null;
  modelPopoverEl: HTMLDivElement | null;
  modelPillNameEl: HTMLSpanElement | null;
  modelPillMetaEl: HTMLSpanElement | null;

  // -- wind style --
  windStyleWarningEl: HTMLDivElement | null;
  windParticlesAdvanced: HTMLDivElement | null;
  windParticlesCountInput: HTMLInputElement | null;
  windParticlesCountValue: HTMLDivElement | null;
  windParticlesAgeInput: HTMLInputElement | null;
  windParticlesAgeValue: HTMLDivElement | null;
  windParticlesSpeedInput: HTMLInputElement | null;
  windParticlesSpeedValue: HTMLDivElement | null;

  // -- layer / grid / opacity controls --
  layerToggle: HTMLInputElement;
  gridToggle: HTMLInputElement;
  opacityInput: HTMLInputElement;
  opacityValue: HTMLDivElement;

  // -- timeline --
  timelineHost: HTMLDivElement;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function byIdOrNull<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function bySelector<T extends HTMLElement>(selector: string): T {
  return document.querySelector(selector) as T;
}

function bySelectorOrNull<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

export function queryDom(): AppDom {
  return {
    // map chrome
    mapWrap: bySelector<HTMLDivElement>(".map-wrap"),
    zoomIn: byId<HTMLButtonElement>("zoom-in"),
    zoomOut: byId<HTMLButtonElement>("zoom-out"),
    infoButton: byId<HTMLButtonElement>("info-button"),
    infoPanel: byId<HTMLDivElement>("info-panel"),

    // view mode
    viewForecastBtn: byId<HTMLButtonElement>("view-forecast"),
    viewIconographyBtn: byIdOrNull<HTMLButtonElement>("view-iconography"),
    localeSwitcherBtn: byIdOrNull<HTMLButtonElement>("locale-switcher"),

    // iconography style switcher
    iconStyleClassicBtn: byIdOrNull<HTMLButtonElement>("icon-style-classic"),
    iconStyleCompactBtn: byIdOrNull<HTMLButtonElement>("icon-style-compact"),

    // tooltip
    tooltipHost: byId<HTMLDivElement>("tooltip-host"),

    // wavegram
    wavegramModal: byId<HTMLDivElement>("wavegram-modal"),
    wavegramClose: byId<HTMLButtonElement>("wavegram-close"),
    wavegramSubtitle: byId<HTMLDivElement>("wavegram-subtitle"),
    wavegramStatus: byId<HTMLDivElement>("wavegram-status"),
    wavegramDurationSelect: byId<HTMLSelectElement>("wavegram-duration"),
    wavegramTechToggle: byId<HTMLInputElement>("wavegram-tech-toggle"),
    wavegramImage: byId<HTMLImageElement>("wavegram-image"),
    wavegramDownload: byId<HTMLButtonElement>("wavegram-download"),
    wavegramPrint: byId<HTMLButtonElement>("wavegram-print"),

    // legends
    legendHost: byId<HTMLDivElement>("legend-control"),
    waveLegendHost: byId<HTMLDivElement>("wave-legend-control"),
    windLegendHost: byId<HTMLDivElement>("wind-legend-control"),
    precipLegendHost: byId<HTMLDivElement>("precip-legend-control"),
    cloudLegendHost: byId<HTMLDivElement>("cloud-legend-control"),
    snowDepthLegendHost: byId<HTMLDivElement>("snow-depth-legend-control"),
    legendStackCardEl: bySelectorOrNull<HTMLDivElement>(".legend-stack-card"),

    // layer group / grid
    layerGroupList: byId<HTMLDivElement>("layer-group-list"),
    gridToggleButton: byIdOrNull<HTMLButtonElement>("grid-toggle-button"),
    layerSwitchCardEl: bySelectorOrNull<HTMLDivElement>(".layer-switch-card"),
    gridToggleCardEl: bySelectorOrNull<HTMLDivElement>(".utility-toggle"),
    viewToggleCardEl: bySelectorOrNull<HTMLDivElement>(".view-toggle--map"),
    modelCardEl: bySelectorOrNull<HTMLDivElement>(".model-card"),
    gridLabelsContainer: byId<HTMLDivElement>("grid-labels"),

    // inhouse catalog selectors
    inhouseModelSelect: byId<HTMLSelectElement>("inhouse-model"),
    inhouseAnalysisSelect: byId<HTMLSelectElement>("inhouse-analysis"),
    inhouseVariableSelect: byIdOrNull<HTMLSelectElement>("inhouse-variable"),
    inhousePresetSelect: byIdOrNull<HTMLSelectElement>("inhouse-preset"),
    inhouseAddLayerBtn: byIdOrNull<HTMLButtonElement>("inhouse-add-layer"),
    inhouseLayersEl: byIdOrNull<HTMLDivElement>("inhouse-layers"),
    inhouseWarningEl: byId<HTMLDivElement>("inhouse-warning"),
    inhouseTooltip: byId<HTMLDivElement>("inhouse-tooltip"),

    // model bar / panel
    modelBarEl: byIdOrNull<HTMLDivElement>("model-bar"),
    modelPanelEl: byIdOrNull<HTMLDivElement>("model-panel"),

    // model pill
    modelPillBtn: bySelectorOrNull<HTMLButtonElement>(".model-pill"),
    modelPopoverEl: byIdOrNull<HTMLDivElement>("model-popover"),
    modelPillNameEl: bySelectorOrNull<HTMLSpanElement>(".model-pill__name"),
    modelPillMetaEl: bySelectorOrNull<HTMLSpanElement>(".model-pill__meta"),

    // wind style
    windStyleWarningEl: byIdOrNull<HTMLDivElement>("wind-style-warning"),
    windParticlesAdvanced: byIdOrNull<HTMLDivElement>(
      "wind-particles-advanced",
    ),
    windParticlesCountInput: byIdOrNull<HTMLInputElement>(
      "wind-particles-count",
    ),
    windParticlesCountValue: byIdOrNull<HTMLDivElement>(
      "wind-particles-count-value",
    ),
    windParticlesAgeInput: byIdOrNull<HTMLInputElement>("wind-particles-age"),
    windParticlesAgeValue: byIdOrNull<HTMLDivElement>(
      "wind-particles-age-value",
    ),
    windParticlesSpeedInput: byIdOrNull<HTMLInputElement>(
      "wind-particles-speed",
    ),
    windParticlesSpeedValue: byIdOrNull<HTMLDivElement>(
      "wind-particles-speed-value",
    ),

    // layer / grid / opacity
    layerToggle: byId<HTMLInputElement>("layer-toggle"),
    gridToggle: byId<HTMLInputElement>("grid-toggle"),
    opacityInput: byId<HTMLInputElement>("opacity"),
    opacityValue: byId<HTMLDivElement>("opacity-value"),

    // timeline
    timelineHost: byId<HTMLDivElement>("timeline-control"),
  };
}
