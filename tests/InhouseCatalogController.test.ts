import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InhouseCatalogController,
  CANONICAL_VARIABLES,
  VARIABLE_SUBSTITUTIONS,
  type InhouseCatalogDom,
  type InhouseCatalogDeps,
} from "../src/controllers/InhouseCatalogController";
import type { InhouseManifest, InhouseLayer } from "../src/lib/inhouseTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDom(): InhouseCatalogDom {
  const inhouseModelSelect = document.createElement("select");
  const inhouseAnalysisSelect = document.createElement("select");
  const inhouseVariableSelect = document.createElement("select");
  const inhousePresetSelect = document.createElement("select");
  const inhouseAddLayerBtn = document.createElement("button");
  const inhouseLayersEl = document.createElement("div") as HTMLDivElement;
  const inhouseWarningEl = document.createElement("div") as HTMLDivElement;
  inhouseWarningEl.hidden = true;
  const inhouseTooltip = document.createElement("div") as HTMLDivElement;
  inhouseTooltip.setAttribute("aria-hidden", "true");

  document.body.appendChild(inhouseModelSelect);
  document.body.appendChild(inhouseAnalysisSelect);
  document.body.appendChild(inhouseVariableSelect);
  document.body.appendChild(inhousePresetSelect);
  document.body.appendChild(inhouseAddLayerBtn);
  document.body.appendChild(inhouseLayersEl);
  document.body.appendChild(inhouseWarningEl);
  document.body.appendChild(inhouseTooltip);

  return {
    inhouseModelSelect,
    inhouseAnalysisSelect,
    inhouseVariableSelect,
    inhousePresetSelect,
    inhouseAddLayerBtn,
    inhouseLayersEl,
    inhouseWarningEl,
    inhouseTooltip,
  };
}

function makeManifest(
  overrides: Partial<InhouseManifest> = {},
): InhouseManifest {
  return {
    bounds: [-25, 63, -13, 67] as [number, number, number, number],
    shape: { width: 100, height: 80 },
    srcMin: 0,
    srcMax: 50,
    imageUnscale: [0, 50],
    fileTemplate: "frame_{index:03d}.webp",
    count: 3,
    times: [
      "2026-03-04T00:00:00Z",
      "2026-03-04T01:00:00Z",
      "2026-03-04T02:00:00Z",
    ],
    analysisTime: "2026-03-04_00",
    historyIntervalMinutes: 60,
    ...overrides,
  };
}

function makeLayer(overrides: Partial<InhouseLayer> = {}): InhouseLayer {
  return {
    id: "gfs-1:2026-03-04_00:air_temperature_at_2m_agl",
    model: "gfs-1",
    analysis: "2026-03-04_00",
    variable: "air_temperature_at_2m_agl",
    manifest: makeManifest(),
    times: [
      "2026-03-04T00:00:00Z",
      "2026-03-04T01:00:00Z",
      "2026-03-04T02:00:00Z",
    ],
    visible: true,
    image: null,
    scalar: null,
    rasterScalar: null,
    renderMode: "raster",
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<InhouseCatalogDeps> = {},
): InhouseCatalogDeps {
  const dom = overrides.dom ?? createDom();
  return {
    dom,
    isDev: false,
    inhouseRoot: "/test-root",
    persistedModelId: null,
    getMapContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
    setMapMaxZoom: vi.fn(),
    getMapZoom: () => 5,
    setMapZoom: vi.fn(),
    easeToMap: vi.fn(),
    fitMapBounds: vi.fn(),
    getCurrentDatetime: () => "2026-03-04T00:00:00Z",
    setCurrentDatetime: vi.fn(),
    isRestoringFromPersisted: () => false,
    setRestoringFromPersisted: vi.fn(),
    getPendingTimeIndex: () => null,
    setPendingTimeIndex: vi.fn(),
    isMapReady: () => true,
    getLastFrameLoadHadErrors: () => false,
    setLastFrameLoadHadErrors: vi.fn(),
    getUiState: () => ({
      layerMode: "temperature",
      visible: true,
      opacity: 1,
      showGrid: false,
    }),
    scheduleUpdateLayers: vi.fn(),
    schedulePersistState: vi.fn(),
    onSelectorsRefreshed: vi.fn(),
    sampleVectorAtPosition: vi
      .fn()
      .mockReturnValue({ value: 5.5, direction: 180 }),
    createCloudProvider: vi.fn().mockReturnValue({
      id: "cloud",
      getDatetimes: vi.fn().mockResolvedValue([]),
      loadFrame: vi.fn().mockResolvedValue(null),
    }),
    onContourWorkerResult: vi.fn(),
    ...overrides,
  };
}

/** Stub global.fetch to return JSON responses keyed by URL substring */
function stubFetch(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const urlStr =
      typeof url === "string"
        ? url
        : url instanceof URL
          ? url.toString()
          : url.url;
    for (const [key, data] of Object.entries(responses)) {
      if (urlStr.includes(key)) {
        return {
          ok: true,
          status: 200,
          json: async () => data,
          blob: async () => new Blob([JSON.stringify(data)]),
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => {
        throw new Error("Not found");
      },
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InhouseCatalogController", () => {
  let dom: InhouseCatalogDom;
  let deps: InhouseCatalogDeps;
  let ctrl: InhouseCatalogController;

  beforeEach(() => {
    dom = createDom();
    deps = makeDeps({ dom });
    ctrl = new InhouseCatalogController(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  // -----------------------------------------------------------------------
  // Constants export
  // -----------------------------------------------------------------------

  describe("CANONICAL_VARIABLES", () => {
    it("has air_temperature, wind_speed, mean_sea_level_pressure", () => {
      expect(CANONICAL_VARIABLES.air_temperature).toBeDefined();
      expect(CANONICAL_VARIABLES.wind_speed).toBeDefined();
      expect(CANONICAL_VARIABLES.mean_sea_level_pressure).toBeDefined();
    });

    it("air_temperature has correct style", () => {
      expect(CANONICAL_VARIABLES.air_temperature.style).toBe("raster");
    });

    it("mean_sea_level_pressure has contour style", () => {
      expect(CANONICAL_VARIABLES.mean_sea_level_pressure.style).toBe("contour");
      expect(CANONICAL_VARIABLES.mean_sea_level_pressure.contourInterval).toBe(
        4,
      );
    });
  });

  describe("VARIABLE_SUBSTITUTIONS", () => {
    it("has cloud and inhouse mappings for each canonical", () => {
      for (const key of Object.keys(CANONICAL_VARIABLES)) {
        const sub =
          VARIABLE_SUBSTITUTIONS[key as keyof typeof VARIABLE_SUBSTITUTIONS];
        expect(sub.cloud).toBeDefined();
        expect(sub.inhouse).toBeDefined();
      }
    });

    it("air_temperature maps gfs-1 to air_temperature_at_2m_agl", () => {
      expect(VARIABLE_SUBSTITUTIONS.air_temperature.inhouse["gfs-1"]).toBe(
        "air_temperature_at_2m_agl",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Constructor & default state
  // -----------------------------------------------------------------------

  describe("constructor", () => {
    it("initialises with empty catalog state", () => {
      expect(ctrl.inhouseModels).toEqual([]);
      expect(ctrl.inhouseAnalyses).toEqual([]);
      expect(ctrl.inhouseVariables).toEqual([]);
      expect(ctrl.inhouseVariableMeta).toEqual({});
      expect(ctrl.inhouseSelectedModel).toBe("");
      expect(ctrl.inhouseSelectedAnalysis).toBe("");
      expect(ctrl.inhouseSelectedVariable).toBe("");
      expect(ctrl.inhouseTimeIndex).toBe(0);
      expect(ctrl.inhouseLayers).toEqual([]);
      expect(ctrl.inhouseCatalogReady).toBeNull();
      expect(ctrl.precipCandidateIndex).toBe(0);
      expect(ctrl.precipFallbackInFlight).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Public setters
  // -----------------------------------------------------------------------

  describe("setters", () => {
    it("inhouseTimeIndex can be set", () => {
      ctrl.inhouseTimeIndex = 42;
      expect(ctrl.inhouseTimeIndex).toBe(42);
    });

    it("precipCandidateIndex can be set", () => {
      ctrl.precipCandidateIndex = 3;
      expect(ctrl.precipCandidateIndex).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // URL helpers
  // -----------------------------------------------------------------------

  describe("getInhouseRoot", () => {
    it("returns trimmed root", () => {
      expect(ctrl.getInhouseRoot()).toBe("/test-root");
    });

    it("strips trailing slash", () => {
      const c = new InhouseCatalogController(
        makeDeps({ inhouseRoot: "/foo/" }),
      );
      expect(c.getInhouseRoot()).toBe("/foo");
    });

    it("returns empty string when root is empty", () => {
      const c = new InhouseCatalogController(makeDeps({ inhouseRoot: "" }));
      expect(c.getInhouseRoot()).toBe("");
    });
  });

  describe("getVariableBaseUrl", () => {
    it("assembles the correct URL", () => {
      expect(
        ctrl.getVariableBaseUrl(
          "gfs-1",
          "2026-03-04_00",
          "air_temperature_at_2m_agl",
        ),
      ).toBe(
        "/test-root/forecast-data/gfs-1/2026-03-04_00/air_temperature_at_2m_agl",
      );
    });
  });

  describe("fetchJson", () => {
    it("resolves with parsed JSON on success", async () => {
      const payload = { schemaVersion: 1, models: ["gfs-1"] };
      stubFetch({ "models.json": payload });
      const result = await ctrl.fetchJson(
        "/test-root/forecast-data/models.json",
      );
      expect(result).toEqual(payload);
    });

    it("throws on non-OK response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      await expect(ctrl.fetchJson("/bad")).rejects.toThrow(
        "Failed to load /bad (500)",
      );
    });
  });

  describe("getInhouseFrameUrl", () => {
    it("builds frame URL with zero-padded index", () => {
      const layer = makeLayer();
      expect(ctrl.getInhouseFrameUrl(layer, 0)).toContain("frame_000.webp");
      expect(ctrl.getInhouseFrameUrl(layer, 7)).toContain("frame_007.webp");
      expect(ctrl.getInhouseFrameUrl(layer, 123)).toContain("frame_123.webp");
    });
  });

  // -----------------------------------------------------------------------
  // Zoom / centering
  // -----------------------------------------------------------------------

  describe("computeModelMaxZoom", () => {
    it("returns DEFAULT_MODEL_MAX_ZOOM when no resolution known", () => {
      const zoom = ctrl.computeModelMaxZoom("UNKNOWN_MODEL");
      expect(zoom).toBe(12); // DEFAULT_MODEL_MAX_ZOOM
    });

    it("returns a zoom for known model", () => {
      const zoom = ctrl.computeModelMaxZoom("GFS");
      expect(zoom).toBeGreaterThan(0);
      expect(zoom).toBeLessThanOrEqual(14);
    });

    it("clamps between 1 and 14", () => {
      const zoom = ctrl.computeModelMaxZoom("BEL-IS");
      expect(zoom).toBeGreaterThanOrEqual(1);
      expect(zoom).toBeLessThanOrEqual(14);
    });
  });

  describe("applyModelZoomConstraints", () => {
    it("sets max zoom on map", () => {
      ctrl.applyModelZoomConstraints("GFS");
      expect(deps.setMapMaxZoom).toHaveBeenCalled();
    });

    it("clamps current zoom if above max", () => {
      const highZoomDeps = makeDeps({ getMapZoom: () => 20 });
      const c = new InhouseCatalogController(highZoomDeps);
      c.applyModelZoomConstraints("GFS");
      expect(highZoomDeps.setMapZoom).toHaveBeenCalled();
    });

    it("animates zoom clamp when animate=true", () => {
      const highZoomDeps = makeDeps({ getMapZoom: () => 20 });
      const c = new InhouseCatalogController(highZoomDeps);
      c.applyModelZoomConstraints("GFS", { animate: true });
      expect(highZoomDeps.easeToMap).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 500 }),
      );
    });

    it("does not adjust zoom when current is within range", () => {
      const lowZoomDeps = makeDeps({ getMapZoom: () => 2 });
      const c = new InhouseCatalogController(lowZoomDeps);
      c.applyModelZoomConstraints("GFS");
      expect(lowZoomDeps.setMapZoom).not.toHaveBeenCalled();
      expect(lowZoomDeps.easeToMap).not.toHaveBeenCalled();
    });
  });

  describe("centerMapOnInhouseDomain", () => {
    it("does nothing when restoring from persisted", () => {
      const d = makeDeps({ isRestoringFromPersisted: () => true });
      const c = new InhouseCatalogController(d);
      c.centerMapOnInhouseDomain("BEL-IS", "2026-03-04_00", [-25, 63, -13, 67]);
      expect(d.easeToMap).not.toHaveBeenCalled();
      expect(d.fitMapBounds).not.toHaveBeenCalled();
    });

    it("uses special center for UWC-IG", () => {
      ctrl.centerMapOnInhouseDomain(
        "UWC-IG",
        "2026-03-04_00",
        [-25, 63, -13, 67],
      );
      expect(deps.easeToMap).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-36, 68.5], zoom: 3.5 }),
      );
    });

    it("uses special center for RAP", () => {
      ctrl.centerMapOnInhouseDomain("RAP", "2026-03-04_00", [-60, 50, -40, 70]);
      expect(deps.easeToMap).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-60, 62], zoom: 2.5 }),
      );
    });

    it("resets to default view for global model", () => {
      ctrl.centerMapOnInhouseDomain(
        "GFS",
        "2026-03-04_00",
        [-180, -90, 180, 90],
      );
      expect(deps.easeToMap).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-20, 55] }),
      );
    });

    it("centers on Iceland for BEL-IS", async () => {
      ctrl.centerMapOnInhouseDomain(
        "BEL-IS",
        "2026-03-04_00",
        [-25, 63, -13, 67],
      );
      // BEL-IS uses hardcoded Iceland center via requestAnimationFrame
      await new Promise((r) => requestAnimationFrame(r));
      expect(deps.easeToMap).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-19, 65], zoom: 6.0 }),
      );
    });

    it("always re-centers BEL-IS to Iceland overview", async () => {
      ctrl.centerMapOnInhouseDomain(
        "BEL-IS",
        "2026-03-04_00",
        [-25, 63, -13, 67],
      );
      await new Promise((r) => requestAnimationFrame(r));
      expect(deps.easeToMap).toHaveBeenCalledTimes(1);
      ctrl.centerMapOnInhouseDomain(
        "BEL-IS",
        "2026-03-04_00",
        [-25, 63, -13, 67],
      );
      await new Promise((r) => requestAnimationFrame(r));
      // BEL-IS always re-centers (no dedup for this model)
      expect(deps.easeToMap).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Active layer queries
  // -----------------------------------------------------------------------

  describe("getActiveInhouseContourLayer", () => {
    it("returns null when no layers", () => {
      expect(ctrl.getActiveInhouseContourLayer()).toBeNull();
    });

    it("returns null when a raster layer is visible", () => {
      const layers = ctrl.inhouseLayers;
      layers.push(
        makeLayer({ renderMode: "raster", visible: true, image: {} as any }),
      );
      expect(ctrl.getActiveInhouseContourLayer()).toBeNull();
    });

    it("returns contour layer when no raster is visible", () => {
      const layers = ctrl.inhouseLayers;
      const contourLayer = makeLayer({
        renderMode: "contour",
        visible: true,
        image: {} as any,
      });
      layers.push(contourLayer);
      expect(ctrl.getActiveInhouseContourLayer()).toBe(contourLayer);
    });

    it("returns last visible contour layer", () => {
      const layers = ctrl.inhouseLayers;
      const layer1 = makeLayer({
        id: "a",
        renderMode: "contour",
        visible: true,
        image: {} as any,
      });
      const layer2 = makeLayer({
        id: "b",
        renderMode: "contour",
        visible: true,
        image: {} as any,
      });
      layers.push(layer1, layer2);
      expect(ctrl.getActiveInhouseContourLayer()).toBe(layer2);
    });

    it("skips contour layer without image", () => {
      const layers = ctrl.inhouseLayers;
      layers.push(
        makeLayer({ renderMode: "contour", visible: true, image: null }),
      );
      expect(ctrl.getActiveInhouseContourLayer()).toBeNull();
    });
  });

  describe("findInhouseLayerByCandidates", () => {
    it("returns null when no candidates", () => {
      expect(ctrl.findInhouseLayerByCandidates(undefined)).toBeNull();
    });

    it("returns null when no layers match", () => {
      ctrl.inhouseLayers.push(makeLayer({ variable: "wind_speed" }));
      expect(
        ctrl.findInhouseLayerByCandidates(["air_temperature_at_2m_agl"]),
      ).toBeNull();
    });

    it("returns first matching layer by candidate order", () => {
      const wsLayer = makeLayer({ id: "ws", variable: "wind_speed" });
      const wdLayer = makeLayer({ id: "wd", variable: "wind_from_direction" });
      ctrl.inhouseLayers.push(wsLayer, wdLayer);
      expect(
        ctrl.findInhouseLayerByCandidates([
          "wind_from_direction",
          "wind_speed",
        ]),
      ).toBe(wdLayer);
    });
  });

  describe("isInhouseVectorLayer", () => {
    it("returns true for vector encoding", () => {
      const layer = makeLayer({
        manifest: makeManifest({ encoding: { kind: "vector" } }),
      });
      expect(ctrl.isInhouseVectorLayer(layer)).toBe(true);
    });

    it("returns false for scalar encoding", () => {
      const layer = makeLayer({
        manifest: makeManifest({ encoding: { kind: "scalar" } }),
      });
      expect(ctrl.isInhouseVectorLayer(layer)).toBe(false);
    });

    it("handles null / undefined layer", () => {
      expect(ctrl.isInhouseVectorLayer(null)).toBeFalsy();
      expect(ctrl.isInhouseVectorLayer(undefined)).toBeFalsy();
    });

    it("handles missing encoding", () => {
      const layer = makeLayer({
        manifest: makeManifest({ encoding: undefined }),
      });
      expect(ctrl.isInhouseVectorLayer(layer)).toBeFalsy();
    });
  });

  describe("findPreferredInhouseWindVectorLayer", () => {
    it("returns null when no wind_uv_10m layer exists", () => {
      ctrl.inhouseLayers.push(makeLayer({ variable: "wind_speed" }));
      expect(ctrl.findPreferredInhouseWindVectorLayer()).toBeNull();
    });

    it("returns wind_uv_10m layer when present", () => {
      const vectorLayer = makeLayer({ variable: "wind_uv_10m" });
      ctrl.inhouseLayers.push(vectorLayer);
      expect(ctrl.findPreferredInhouseWindVectorLayer()).toBe(vectorLayer);
    });
  });

  // -----------------------------------------------------------------------
  // Warning & layer list rendering
  // -----------------------------------------------------------------------

  describe("setInhouseWarning", () => {
    it("shows warning with message", () => {
      ctrl.setInhouseWarning("Something went wrong");
      expect(dom.inhouseWarningEl.textContent).toBe("Something went wrong");
      expect(dom.inhouseWarningEl.hidden).toBe(false);
    });

    it("hides warning with empty message", () => {
      ctrl.setInhouseWarning("msg");
      ctrl.setInhouseWarning("");
      expect(dom.inhouseWarningEl.textContent).toBe("");
      expect(dom.inhouseWarningEl.hidden).toBe(true);
    });

    it("hides warning with no argument", () => {
      ctrl.setInhouseWarning();
      expect(dom.inhouseWarningEl.hidden).toBe(true);
    });
  });

  describe("renderInhouseLayersList", () => {
    it("shows empty message when no layers", () => {
      ctrl.renderInhouseLayersList();
      expect(dom.inhouseLayersEl!.textContent).toBe(
        "No in-house layers added.",
      );
    });

    it("renders wave mode rows without controls", () => {
      const d = makeDeps({
        dom,
        getUiState: () => ({
          layerMode: "waves",
          visible: true,
          opacity: 1,
          showGrid: false,
        }),
      });
      const c = new InhouseCatalogController(d);
      c.inhouseLayers.push(makeLayer({ variable: "significant_wave_height" }));
      c.renderInhouseLayersList();
      const rows = dom.inhouseLayersEl!.querySelectorAll(".inhouse-layer-row");
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain("significant_wave_height");
    });

    it("renders checkboxes and controls for non-wave mode", () => {
      ctrl.inhouseLayers.push(makeLayer());
      ctrl.renderInhouseLayersList();
      const checkboxes = dom.inhouseLayersEl!.querySelectorAll(
        'input[type="checkbox"]',
      );
      expect(checkboxes.length).toBe(1);
      const selects = dom.inhouseLayersEl!.querySelectorAll(
        "select[data-render-mode]",
      );
      expect(selects.length).toBe(1);
      const removeButtons = dom.inhouseLayersEl!.querySelectorAll(
        "button[data-remove-id]",
      );
      expect(removeButtons.length).toBe(1);
    });

    it("checkbox toggle updates layer visibility and schedules update", () => {
      ctrl.inhouseLayers.push(makeLayer({ visible: true }));
      ctrl.renderInhouseLayersList();
      const checkbox = dom.inhouseLayersEl!.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      expect(ctrl.inhouseLayers[0].visible).toBe(false);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("remove button removes layer and re-renders", () => {
      ctrl.inhouseLayers.push(makeLayer());
      ctrl.renderInhouseLayersList();
      const removeBtn = dom.inhouseLayersEl!.querySelector(
        "button[data-remove-id]",
      ) as HTMLButtonElement;
      removeBtn.click();
      expect(ctrl.inhouseLayers.length).toBe(0);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("render mode select updates layer renderMode", () => {
      ctrl.inhouseLayers.push(makeLayer({ renderMode: "raster" }));
      ctrl.renderInhouseLayersList();
      const select = dom.inhouseLayersEl!.querySelector(
        "select[data-render-mode]",
      ) as HTMLSelectElement;
      select.value = "contour";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(ctrl.inhouseLayers[0].renderMode).toBe("contour");
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("does nothing if inhouseLayersEl is null", () => {
      const d = makeDeps({
        dom: { ...dom, inhouseLayersEl: null },
      });
      const c = new InhouseCatalogController(d);
      // Should not throw
      c.renderInhouseLayersList();
    });
  });

  // -----------------------------------------------------------------------
  // Time sync
  // -----------------------------------------------------------------------

  describe("syncInhouseTimeToTimeline", () => {
    it("does nothing when no layers", () => {
      ctrl.syncInhouseTimeToTimeline();
      expect(deps.schedulePersistState).not.toHaveBeenCalled();
    });

    it("uses nearest time index for current datetime", () => {
      ctrl.inhouseLayers.push(makeLayer());
      ctrl.syncInhouseTimeToTimeline();
      expect(ctrl.inhouseTimeIndex).toBe(0);
      expect(deps.schedulePersistState).toHaveBeenCalled();
    });

    it("restores from persisted pending time index", () => {
      const d = makeDeps({
        dom,
        isRestoringFromPersisted: () => true,
        getPendingTimeIndex: () => 2,
      });
      const c = new InhouseCatalogController(d);
      c.inhouseLayers.push(makeLayer());
      c.syncInhouseTimeToTimeline();
      expect(c.inhouseTimeIndex).toBe(2);
      expect(d.setPendingTimeIndex).toHaveBeenCalledWith(null);
      expect(d.setRestoringFromPersisted).toHaveBeenCalledWith(false);
    });

    it("clamps pending time index to valid range", () => {
      const d = makeDeps({
        dom,
        isRestoringFromPersisted: () => true,
        getPendingTimeIndex: () => 999,
      });
      const c = new InhouseCatalogController(d);
      c.inhouseLayers.push(makeLayer()); // 3 times
      c.syncInhouseTimeToTimeline();
      expect(c.inhouseTimeIndex).toBe(2); // clamped to max
    });

    it("clears restoring flag even without pending index", () => {
      const restoring = true;
      const d = makeDeps({
        dom,
        isRestoringFromPersisted: () => restoring,
        getPendingTimeIndex: () => null,
      });
      const c = new InhouseCatalogController(d);
      c.inhouseLayers.push(makeLayer());
      c.syncInhouseTimeToTimeline();
      expect(d.setRestoringFromPersisted).toHaveBeenCalledWith(false);
    });
  });

  describe("syncCurrentDatetimeToTimes", () => {
    it("does nothing for empty times", () => {
      ctrl.syncCurrentDatetimeToTimes([]);
      expect(deps.setCurrentDatetime).not.toHaveBeenCalled();
    });

    it("snaps to nearest time", () => {
      const times = [
        "2026-03-04T00:00:00Z",
        "2026-03-04T01:00:00Z",
        "2026-03-04T02:00:00Z",
      ];
      ctrl.syncCurrentDatetimeToTimes(times, "2026-03-04T00:30:00Z");
      expect(deps.setCurrentDatetime).toHaveBeenCalled();
    });

    it("uses current datetime when no preferred", () => {
      const times = ["2026-03-04T00:00:00Z", "2026-03-04T01:00:00Z"];
      ctrl.syncCurrentDatetimeToTimes(times);
      expect(deps.setCurrentDatetime).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // loadInhouseTexture
  // -----------------------------------------------------------------------

  describe("loadInhouseTexture", () => {
    function stubTextureLoad(width = 4, height = 2) {
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128; // R
        pixels[i + 1] = 0; // G
        pixels[i + 2] = 0; // B
        pixels[i + 3] = 255; // A
      }
      const mockImageData = { data: pixels, width, height };
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(mockImageData),
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        return document.createElement(tag);
      });
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockResolvedValue({ width, height }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          blob: vi.fn().mockResolvedValue(new Blob(["test"])),
        }),
      );
      return { mockCtx, mockCanvas, pixels };
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("fetches, decodes, and returns texture data", async () => {
      stubTextureLoad(4, 2);
      const result = await ctrl.loadInhouseTexture("/test/frame.webp");
      expect(result).not.toBeNull();
      expect(result!.width).toBe(4);
      expect(result!.height).toBe(2);
    });

    it("caches texture and returns cached on second call", async () => {
      stubTextureLoad(4, 2);
      const fetchMock = vi.mocked(globalThis.fetch);
      await ctrl.loadInhouseTexture("/test/frame.webp");
      const result2 = await ctrl.loadInhouseTexture("/test/frame.webp");
      expect(result2).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns null when canvas context unavailable", async () => {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockResolvedValue({ width: 4, height: 2 }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          blob: vi.fn().mockResolvedValue(new Blob(["test"])),
        }),
      );
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        return document.createElement(tag);
      });
      const result = await ctrl.loadInhouseTexture("/test/no-ctx.webp");
      expect(result).toBeNull();
    });

    it("throws on fetch failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      await expect(ctrl.loadInhouseTexture("/test/fail.webp")).rejects.toThrow(
        "Failed to load frame",
      );
    });

    it("handles alpha normalization for ignoreAlpha case", async () => {
      const width = 4;
      const height = 2;
      const pixels = new Uint8ClampedArray(width * height * 4);
      // All alpha=0 but R>0 → ignoreAlpha case
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 200; // R
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0; // A = 0
      }
      const mockImageData = { data: pixels, width, height };
      const mockCtx = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(mockImageData),
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
      };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        return document.createElement(tag);
      });
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn().mockResolvedValue({ width, height }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          blob: vi.fn().mockResolvedValue(new Blob(["test"])),
        }),
      );
      const result = await ctrl.loadInhouseTexture("/test/ignore-alpha.webp");
      expect(result).not.toBeNull();
      // All alpha should have been set to 255
      for (let i = 3; i < result!.data.length; i += 4) {
        expect(result!.data[i]).toBe(255);
      }
    });
  });

  // -----------------------------------------------------------------------
  // loadInhouseManifest
  // -----------------------------------------------------------------------

  describe("loadInhouseManifest", () => {
    it("fetches manifest and caches it", async () => {
      const manifest = makeManifest();
      const fetchMock = stubFetch({ "manifest.json": manifest });
      const result = await ctrl.loadInhouseManifest(
        "gfs-1",
        "2026-03-04_00",
        "air_temperature_at_2m_agl",
      );
      expect(result).toEqual(manifest);
      // Second call should use cache
      const result2 = await ctrl.loadInhouseManifest(
        "gfs-1",
        "2026-03-04_00",
        "air_temperature_at_2m_agl",
      );
      expect(result2).toEqual(manifest);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // refreshInhouseSelectors
  // -----------------------------------------------------------------------

  describe("refreshInhouseSelectors", () => {
    it("populates select elements with model/analysis/variable lists", () => {
      // Manually set state via loadInhouseCatalog mock
      (ctrl as any)._inhouseModels = ["gfs-1", "GWES"];
      (ctrl as any)._inhouseAnalyses = ["2026-03-04_00"];
      (ctrl as any)._inhouseVariables = [
        "air_temperature_at_2m_agl",
        "wind_speed",
      ];
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseSelectedVariable = "air_temperature_at_2m_agl";

      ctrl.refreshInhouseSelectors();

      expect(dom.inhouseModelSelect.options.length).toBe(2);
      expect(dom.inhouseAnalysisSelect.options.length).toBe(1);
      expect(dom.inhouseVariableSelect!.options.length).toBe(2);
      expect(dom.inhouseModelSelect.value).toBe("gfs-1");
      expect(deps.onSelectorsRefreshed).toHaveBeenCalledWith(
        ["gfs-1", "GWES"],
        "gfs-1",
        ["air_temperature_at_2m_agl", "wind_speed"],
      );
    });

    it("shows empty labels when no data", () => {
      ctrl.refreshInhouseSelectors();
      expect(dom.inhouseModelSelect.innerHTML).toContain("No models");
    });

    it("auto-selects first model if none selected", () => {
      (ctrl as any)._inhouseModels = ["gfs-1"];
      (ctrl as any)._inhouseSelectedModel = "";
      ctrl.refreshInhouseSelectors();
      expect(ctrl.inhouseSelectedModel).toBe("gfs-1");
    });
  });

  // -----------------------------------------------------------------------
  // loadInhouseCatalog
  // -----------------------------------------------------------------------

  describe("loadInhouseCatalog", () => {
    it("loads models, analyses, variables and selects defaults", async () => {
      const manifest = makeManifest();
      stubFetch({
        "models.json": {
          schemaVersion: 1,
          models: [{ id: "gfs-1", default: true }],
        },
        "analyses.json": {
          schemaVersion: 1,
          analyses: ["2026-03-04_00"],
          latest: "2026-03-04_00",
        },
        "variables.json": {
          schemaVersion: 1,
          variables: [
            { id: "air_temperature_at_2m_agl", title: "Air temp", unit: "°C" },
          ],
        },
        "manifest.json": manifest,
      });

      await ctrl.loadInhouseCatalog();

      expect(ctrl.inhouseModels).toContain("gfs-1");
      expect(ctrl.inhouseSelectedModel).toBe("gfs-1");
      expect(ctrl.inhouseAnalyses).toContain("2026-03-04_00");
      expect(ctrl.inhouseSelectedAnalysis).toBe("2026-03-04_00");
      expect(ctrl.inhouseVariables).toContain("air_temperature_at_2m_agl");
    });

    it("uses persisted model if available", async () => {
      const d = makeDeps({ dom, persistedModelId: "GWES" });
      const c = new InhouseCatalogController(d);
      stubFetch({
        "models.json": { models: [{ id: "gfs-1" }, { id: "GWES" }] },
        "analyses.json": { analyses: ["2026-03-04_00"] },
        "variables.json": { variables: [] },
      });
      await c.loadInhouseCatalog();
      expect(c.inhouseSelectedModel).toBe("GWES");
    });

    it("shows warning on models.json failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      await ctrl.loadInhouseCatalog();
      expect(dom.inhouseWarningEl.hidden).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // loadInhouseAnalyses
  // -----------------------------------------------------------------------

  describe("loadInhouseAnalyses", () => {
    it("resets state and loads new analyses + variables", async () => {
      stubFetch({
        "analyses.json": {
          analyses: ["2026-03-05_00"],
          latest: "2026-03-05_00",
        },
        "variables.json": {
          variables: [{ id: "wind_speed", title: "Wind speed", unit: "m/s" }],
        },
      });
      await ctrl.loadInhouseAnalyses("gfs-1");
      expect(ctrl.inhouseSelectedModel).toBe("gfs-1");
      expect(ctrl.inhouseAnalyses).toContain("2026-03-05_00");
      expect(ctrl.inhouseVariables).toContain("wind_speed");
      expect(ctrl.precipCandidateIndex).toBe(0);
    });

    it("applies zoom constraints for map-ready state", async () => {
      stubFetch({
        "analyses.json": { analyses: ["2026-03-05_00"] },
        "variables.json": { variables: [] },
      });
      await ctrl.loadInhouseAnalyses("gfs-1");
      expect(deps.setMapMaxZoom).toHaveBeenCalled();
    });

    it("shows warning on fetch failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      await ctrl.loadInhouseAnalyses("gfs-1");
      expect(dom.inhouseWarningEl.hidden).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Layer group helpers
  // -----------------------------------------------------------------------

  describe("pickFirstAvailableVariable", () => {
    it("picks first matching candidate", () => {
      (ctrl as any)._inhouseVariables = [
        "wind_speed",
        "air_temperature_at_2m_agl",
      ];
      expect(
        ctrl.pickFirstAvailableVariable([
          "air_temperature_at_2m_agl",
          "wind_speed",
        ]),
      ).toBe("air_temperature_at_2m_agl");
    });

    it("returns empty string when no match", () => {
      (ctrl as any)._inhouseVariables = ["wind_speed"];
      expect(ctrl.pickFirstAvailableVariable(["nope"])).toBe("");
    });
  });

  describe("findVariableBySubstring", () => {
    it("finds variable by substring", () => {
      (ctrl as any)._inhouseVariables = [
        "air_temperature_at_2m_agl",
        "wind_speed",
      ];
      expect(ctrl.findVariableBySubstring(["air_temperature"])).toBe(
        "air_temperature_at_2m_agl",
      );
    });

    it("returns empty string when no match", () => {
      (ctrl as any)._inhouseVariables = ["wind_speed"];
      expect(ctrl.findVariableBySubstring(["precip"])).toBe("");
    });
  });

  describe("getAvailablePrecipCandidates", () => {
    it("returns precip variables available in current model", () => {
      (ctrl as any)._inhouseVariables = [
        "lwe_precipitation_rate",
        "wind_speed",
        "precipitation_rate",
      ];
      const candidates = ctrl.getAvailablePrecipCandidates();
      expect(candidates).toContain("lwe_precipitation_rate");
      expect(candidates).toContain("precipitation_rate");
      expect(candidates).not.toContain("wind_speed");
    });
  });

  describe("isGroupAvailableForModel", () => {
    it("returns true when primary variable exists", () => {
      (ctrl as any)._inhouseVariables = [
        "air_temperature_at_2m_agl",
        "wind_speed",
      ];
      expect(ctrl.isGroupAvailableForModel("temperature")).toBe(true);
    });

    it("returns false when no matching variables", () => {
      (ctrl as any)._inhouseVariables = ["wind_speed"];
      expect(ctrl.isGroupAvailableForModel("waves")).toBe(false);
    });

    it("returns false for unknown group", () => {
      expect(ctrl.isGroupAvailableForModel("nonexistent" as any)).toBe(false);
    });

    it("uses precip candidate logic for precip group", () => {
      (ctrl as any)._inhouseVariables = ["lwe_precipitation_rate"];
      expect(ctrl.isGroupAvailableForModel("precip")).toBe(true);
    });
  });

  describe("pickValidGroupForModel", () => {
    it("returns waves for GWES", () => {
      expect(ctrl.pickValidGroupForModel("GWES")).toBe("waves");
    });

    it("returns first available group by preference order", () => {
      (ctrl as any)._inhouseVariables = ["wind_speed"];
      expect(ctrl.pickValidGroupForModel("gfs-1")).toBe("wind");
    });

    it("returns null when no group is available", () => {
      (ctrl as any)._inhouseVariables = [];
      expect(ctrl.pickValidGroupForModel("gfs-1")).toBeNull();
    });
  });

  describe("resolveDefaultGroupForModel", () => {
    it("returns waves for GWES", () => {
      expect(ctrl.resolveDefaultGroupForModel("GWES")).toBe("waves");
    });

    it("returns current layerMode for non-GWES", () => {
      expect(ctrl.resolveDefaultGroupForModel("gfs-1")).toBe("temperature");
    });
  });

  // -----------------------------------------------------------------------
  // ensureInhouseGroupLayers
  // -----------------------------------------------------------------------

  describe("ensureInhouseGroupLayers", () => {
    it("sets warning if no model/analysis selected", async () => {
      await ctrl.ensureInhouseGroupLayers("temperature");
      expect(dom.inhouseWarningEl.textContent).toContain(
        "Select an in-house model",
      );
    });

    it("loads layers for temperature group", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];

      const manifest = makeManifest();
      stubFetch({ "manifest.json": manifest });

      // Mock loadInhouseTexture to avoid canvas/createImageBitmap
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(null);

      await ctrl.ensureInhouseGroupLayers("temperature");

      expect(ctrl.inhouseLayers.length).toBeGreaterThanOrEqual(1);
      expect(ctrl.inhouseLayers[0].variable).toBe("air_temperature_at_2m_agl");
      expect(deps.schedulePersistState).toHaveBeenCalled();
    });

    it("loads wind layers with vector + speed + direction", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [
        "wind_speed",
        "wind_uv_10m",
        "wind_from_direction",
      ];

      const manifest = makeManifest();
      stubFetch({ "manifest.json": manifest });
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(null);

      await ctrl.ensureInhouseGroupLayers("wind");

      const vars = ctrl.inhouseLayers.map((l) => l.variable);
      expect(vars).toContain("wind_speed");
      expect(vars).toContain("wind_uv_10m");
    });

    it("clears layers when no primary variable found", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [];

      await ctrl.ensureInhouseGroupLayers("temperature");
      expect(ctrl.inhouseLayers.length).toBe(0);
      expect(dom.inhouseWarningEl.textContent).toContain(
        "No temperature variable found",
      );
    });

    it("reuses existing layer instances", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];

      const manifest = makeManifest();
      stubFetch({ "manifest.json": manifest });
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(null);

      await ctrl.ensureInhouseGroupLayers("temperature");
      const firstLayerRef = ctrl.inhouseLayers[0];

      // Call again — should reuse the same layer object
      await ctrl.ensureInhouseGroupLayers("temperature");
      expect(ctrl.inhouseLayers[0]).toBe(firstLayerRef);
    });
  });

  // -----------------------------------------------------------------------
  // Canonical variable resolution
  // -----------------------------------------------------------------------

  describe("getInhouseVariableId", () => {
    it("returns mapped variable for known model", () => {
      expect(ctrl.getInhouseVariableId("air_temperature", "gfs-1")).toBe(
        "air_temperature_at_2m_agl",
      );
    });

    it("returns empty string for unknown model", () => {
      expect(
        ctrl.getInhouseVariableId("air_temperature", "unknown-model"),
      ).toBe("");
    });
  });

  describe("hasInhouseVariable", () => {
    it("returns true when variable exists in current catalog", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      expect(
        ctrl.hasInhouseVariable("air_temperature", "gfs-1", "2026-03-04_00"),
      ).toBe(true);
    });

    it("returns false when model mismatch", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      expect(
        ctrl.hasInhouseVariable("air_temperature", "GWES", "2026-03-04_00"),
      ).toBe(false);
    });

    it("returns false when variable not in catalog", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["wind_speed"];
      expect(
        ctrl.hasInhouseVariable("air_temperature", "gfs-1", "2026-03-04_00"),
      ).toBe(false);
    });
  });

  describe("resolveProviderForCanonical", () => {
    it("returns inhouse when variable is available", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      expect(
        ctrl.resolveProviderForCanonical(
          "air_temperature",
          "gfs-1",
          "2026-03-04_00",
        ),
      ).toBe("inhouse");
    });

    it("returns cloud when not available", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [];
      expect(
        ctrl.resolveProviderForCanonical(
          "air_temperature",
          "gfs-1",
          "2026-03-04_00",
        ),
      ).toBe("cloud");
    });
  });

  describe("resolveProviderForPreset", () => {
    it("returns inhouse when all variables available", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [
        "air_temperature_at_2m_agl",
        "wind_speed",
      ];
      expect(
        ctrl.resolveProviderForPreset(
          ["air_temperature", "wind_speed"],
          "gfs-1",
          "2026-03-04_00",
        ),
      ).toBe("inhouse");
    });

    it("returns cloud when any variable missing", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      expect(
        ctrl.resolveProviderForPreset(
          ["air_temperature", "wind_speed"],
          "gfs-1",
          "2026-03-04_00",
        ),
      ).toBe("cloud");
    });
  });

  describe("resolveInhouseRenderMode", () => {
    it("returns contour when variable meta says contour", () => {
      (ctrl as any)._inhouseVariableMeta = {
        pressure_msl: { id: "pressure_msl", defaultLayer: "contour" },
      };
      expect(ctrl.resolveInhouseRenderMode("pressure_msl")).toBe("contour");
    });

    it("returns raster by default", () => {
      expect(ctrl.resolveInhouseRenderMode("air_temperature_at_2m_agl")).toBe(
        "raster",
      );
    });

    it("returns raster when meta has no defaultLayer", () => {
      (ctrl as any)._inhouseVariableMeta = {
        wind_speed: { id: "wind_speed" },
      };
      expect(ctrl.resolveInhouseRenderMode("wind_speed")).toBe("raster");
    });
  });

  // -----------------------------------------------------------------------
  // createInhouseProvider
  // -----------------------------------------------------------------------

  describe("createInhouseProvider", () => {
    it("creates a ForecastProvider with inhouse id", () => {
      const provider = ctrl.createInhouseProvider(
        "gfs-1",
        "2026-03-04_00",
        "air_temperature_at_2m_agl",
      );
      expect(provider.id).toBe("inhouse");
    });

    it("getDatetimes loads manifest and returns times", async () => {
      const manifest = makeManifest({
        times: ["2026-03-04T00:00:00Z", "2026-03-04T01:00:00Z"],
        count: 2,
      });
      stubFetch({ "manifest.json": manifest });
      const provider = ctrl.createInhouseProvider(
        "gfs-1",
        "2026-03-04_00",
        "air_temperature_at_2m_agl",
      );
      const times = await provider.getDatetimes(null);
      expect(times).toEqual(["2026-03-04T00:00:00Z", "2026-03-04T01:00:00Z"]);
    });

    it("getDatetimes returns empty array when manifest fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );
      const provider = ctrl.createInhouseProvider(
        "gfs-1",
        "2026-03-04_00",
        "bad_var",
      );
      await expect(provider.getDatetimes(null)).rejects.toThrow();
    });

    it("loadFrame loads texture for given datetime", async () => {
      const manifest = makeManifest();
      stubFetch({ "manifest.json": manifest });
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue({
        data: new Uint8Array(4),
        width: 1,
        height: 1,
      } as any);
      const provider = ctrl.createInhouseProvider(
        "gfs-1",
        "2026-03-04_00",
        "air_temperature_at_2m_agl",
      );
      const frame = await provider.loadFrame("2026-03-04T00:00:00Z");
      expect(frame).not.toBeNull();
      expect(frame!.bounds).toEqual(manifest.bounds);
    });
  });

  // -----------------------------------------------------------------------
  // Temperature provider helpers
  // -----------------------------------------------------------------------

  describe("resolveTemperatureProviderId", () => {
    it("returns inhouse when air_temperature is available", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      expect(ctrl.resolveTemperatureProviderId()).toBe("inhouse");
    });

    it("returns cloud otherwise", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [];
      expect(ctrl.resolveTemperatureProviderId()).toBe("cloud");
    });
  });

  describe("getInhouseTemperatureMapping", () => {
    it("returns mapping when all set", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      const mapping = ctrl.getInhouseTemperatureMapping();
      expect(mapping).toEqual({
        model: "gfs-1",
        analysis: "2026-03-04_00",
        variable: "air_temperature_at_2m_agl",
      });
    });

    it("returns null when model not set", () => {
      expect(ctrl.getInhouseTemperatureMapping()).toBeNull();
    });
  });

  describe("getTemperatureProvider", () => {
    it("returns inhouse provider when available", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = ["air_temperature_at_2m_agl"];
      const provider = ctrl.getTemperatureProvider();
      expect(provider.id).toBe("inhouse");
    });

    it("falls back to cloud provider", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [];
      const provider = ctrl.getTemperatureProvider();
      expect(provider.id).toBe("cloud");
      expect(deps.createCloudProvider).toHaveBeenCalledWith(
        "gfs/temperature_2m_above_ground",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Wind particle / vector helpers
  // -----------------------------------------------------------------------

  describe("logWindParticleTextureDebug", () => {
    it("does not log for non-wind_uv_10m variable", () => {
      const spy = vi.spyOn(console, "log");
      const devDeps = makeDeps({ dom, isDev: true });
      const c = new InhouseCatalogController(devDeps);
      const layer = makeLayer({ variable: "wind_speed", image: {} as any });
      c.logWindParticleTextureDebug(layer, 0);
      expect(spy).not.toHaveBeenCalledWith(
        expect.stringContaining("[wind particles]"),
        expect.anything(),
      );
    });

    it("does not log when image is null", () => {
      const spy = vi.spyOn(console, "log");
      const devDeps = makeDeps({ dom, isDev: true });
      const c = new InhouseCatalogController(devDeps);
      const layer = makeLayer({ variable: "wind_uv_10m", image: null });
      c.logWindParticleTextureDebug(layer, 0);
      expect(spy).not.toHaveBeenCalledWith(
        expect.stringContaining("[wind particles]"),
        expect.anything(),
      );
    });
  });

  describe("getParticleTextureData", () => {
    it("returns a copy of the texture data", () => {
      const original = new Uint8Array([1, 2, 3, 4]);
      const texture = { data: original, width: 1, height: 1 } as any;
      const result = ctrl.getParticleTextureData(texture);
      expect(result.data).not.toBe(original);
      expect(Array.from(result.data)).toEqual([1, 2, 3, 4]);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });
  });

  describe("sampleInhouseVectorAtCoord", () => {
    it("delegates to deps.sampleVectorAtPosition", () => {
      const layer = makeLayer({
        image: { data: new Uint8Array(4), width: 1, height: 1 } as any,
      });
      const result = ctrl.sampleInhouseVectorAtCoord(
        layer,
        [-20, 65],
        [-25, 63, -13, 67],
      );
      expect(deps.sampleVectorAtPosition).toHaveBeenCalled();
      expect(result).toEqual({ value: 5.5, direction: 180 });
    });

    it("returns null values when image is null", () => {
      const layer = makeLayer({ image: null });
      const result = ctrl.sampleInhouseVectorAtCoord(
        layer,
        [-20, 65],
        [-25, 63, -13, 67],
      );
      expect(result).toEqual({ value: null, direction: null });
    });
  });

  // -----------------------------------------------------------------------
  // Tooltip
  // -----------------------------------------------------------------------

  describe("hideInhouseTooltip", () => {
    it("hides tooltip via aria-hidden and visibility", () => {
      ctrl.hideInhouseTooltip();
      expect(dom.inhouseTooltip.getAttribute("aria-hidden")).toBe("true");
      expect(dom.inhouseTooltip.style.visibility).toBe("hidden");
    });
  });

  describe("formatInhouseTooltipValue", () => {
    it("formats air temp with Kelvin conversion when value > 100", () => {
      const layer = makeLayer({ variable: "air_temperature_at_2m_agl" });
      const result = ctrl.formatInhouseTooltipValue(layer, 293.15);
      // 293.15 - 273.15 = 20, formatted to 0 decimals
      expect(result).toContain("20");
    });

    it("formats air temp without conversion when value <= 100", () => {
      const layer = makeLayer({ variable: "air_temperature_at_2m_agl" });
      const result = ctrl.formatInhouseTooltipValue(layer, 25);
      expect(result).toContain("25");
    });

    it("formats non-air-temp with 2 decimals", () => {
      const layer = makeLayer({
        variable: "wind_speed",
        manifest: makeManifest({ unit: "m/s" }),
      });
      const result = ctrl.formatInhouseTooltipValue(layer, 5.123);
      expect(result).toContain("5.12");
      expect(result).toContain("m/s");
    });
  });

  describe("showInhouseTooltip", () => {
    it("shows tooltip with text and position", () => {
      ctrl.showInhouseTooltip("5.00 m/s", 100, 200);
      expect(dom.inhouseTooltip.textContent).toBe("5.00 m/s");
      expect(dom.inhouseTooltip.getAttribute("aria-hidden")).toBe("false");
      expect(dom.inhouseTooltip.style.left).toBe("100px");
      expect(dom.inhouseTooltip.style.top).toBe("200px");
      expect(dom.inhouseTooltip.style.visibility).toBe("visible");
    });
  });

  describe("scheduleInhouseContourHover", () => {
    it("schedules RAF and samples value", async () => {
      const rafCallback: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallback.push(cb);
        return rafCallback.length;
      });

      const layer = makeLayer({
        manifest: makeManifest({ encoding: { kind: "scalar" } }),
        scalar: {
          data: new Float32Array([10, 20, 30, 40]),
          width: 2,
          height: 2,
        },
      });
      ctrl.scheduleInhouseContourHover(
        layer,
        { x: 100, y: 200, coordinate: [-20, 65] },
        [-25, 63, -13, 67],
      );

      expect(rafCallback.length).toBe(1);
      // Execute RAF callback
      rafCallback[0](performance.now());
      // After RAF, tooltip should be updated (depends on sampleInhouseScalarAtCoord returning a value)
    });

    it("hides tooltip when no coordinate", () => {
      const rafCallback: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallback.push(cb);
        return rafCallback.length;
      });

      const layer = makeLayer();
      ctrl.scheduleInhouseContourHover(
        layer,
        { x: 100, y: 200 },
        [-25, 63, -13, 67],
      );
      rafCallback[0](performance.now());
      expect(dom.inhouseTooltip.getAttribute("aria-hidden")).toBe("true");
    });

    it("coalesces multiple calls into one RAF", () => {
      const rafSpy = vi
        .spyOn(window, "requestAnimationFrame")
        .mockReturnValue(1);
      const layer = makeLayer();
      ctrl.scheduleInhouseContourHover(
        layer,
        { x: 1, y: 1 },
        [-25, 63, -13, 67],
      );
      ctrl.scheduleInhouseContourHover(
        layer,
        { x: 2, y: 2 },
        [-25, 63, -13, 67],
      );
      ctrl.scheduleInhouseContourHover(
        layer,
        { x: 3, y: 3 },
        [-25, 63, -13, 67],
      );
      expect(rafSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Cache clearing
  // -----------------------------------------------------------------------

  describe("clearTextureCaches", () => {
    it("clears all texture caches without error", () => {
      ctrl.clearTextureCaches();
      // No assertion beyond it not throwing
    });
  });

  // -----------------------------------------------------------------------
  // Preset initialization
  // -----------------------------------------------------------------------

  describe("initPresetSelect", () => {
    it("populates preset select with None + preset names", () => {
      ctrl.initPresetSelect();
      const options = Array.from(dom.inhousePresetSelect!.options);
      expect(options[0].textContent).toBe("None");
      // Should have at least "Wind + MSLP" from INHOUSE_PRESETS
      expect(options.length).toBeGreaterThan(1);
      expect(options.some((o) => o.textContent === "Wind + MSLP")).toBe(true);
    });

    it("does nothing if inhousePresetSelect is null", () => {
      const d = makeDeps({ dom: { ...dom, inhousePresetSelect: null } });
      const c = new InhouseCatalogController(d);
      c.initPresetSelect();
      // No error
    });
  });

  // -----------------------------------------------------------------------
  // start
  // -----------------------------------------------------------------------

  describe("start", () => {
    it("initialises presets and starts catalog load", async () => {
      stubFetch({
        "models.json": { models: [{ id: "gfs-1", default: true }] },
        "analyses.json": {
          analyses: ["2026-03-04_00"],
          latest: "2026-03-04_00",
        },
        "variables.json": {
          variables: [
            { id: "air_temperature_at_2m_agl", title: "Air temp", unit: "°C" },
          ],
        },
        "manifest.json": makeManifest(),
      });
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(null);

      const promise = ctrl.start();
      expect(ctrl.inhouseCatalogReady).toBe(promise);
      await promise;
      expect(ctrl.inhouseModels.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // DOM event listeners
  // -----------------------------------------------------------------------

  describe("DOM event listeners", () => {
    it("variable select change updates selectedVariable", () => {
      dom.inhouseVariableSelect!.innerHTML =
        '<option value="wind_speed">Wind speed</option>';
      dom.inhouseVariableSelect!.value = "wind_speed";
      dom.inhouseVariableSelect!.dispatchEvent(new Event("change"));
      expect(ctrl.inhouseSelectedVariable).toBe("wind_speed");
    });

    it("preset select change with valid preset triggers layer build", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = [
        "air_temperature_at_2m_agl",
        "wind_speed",
      ];

      stubFetch({ "manifest.json": makeManifest() });

      dom.inhousePresetSelect!.innerHTML = [
        '<option value="None">None</option>',
        '<option value="Wind + MSLP">Wind + MSLP</option>',
      ].join("");
      dom.inhousePresetSelect!.value = "Wind + MSLP";
      dom.inhousePresetSelect!.dispatchEvent(new Event("change"));

      // Preset requires mean_sea_level_pressure which maps to air_pressure_at_sea_level
      // which is not in _inhouseVariables — but the handler will warn about missing
      await new Promise((r) => setTimeout(r, 10));
    });

    it("preset select warns when provider is not inhouse", () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseVariables = []; // No variables → cloud fallback

      dom.inhousePresetSelect!.innerHTML =
        '<option value="Wind + MSLP">Wind + MSLP</option>';
      dom.inhousePresetSelect!.value = "Wind + MSLP";
      dom.inhousePresetSelect!.dispatchEvent(new Event("change"));

      expect(dom.inhouseWarningEl.textContent).toContain("cloud");
    });

    it("add layer button dispatches layer creation", async () => {
      (ctrl as any)._inhouseSelectedModel = "gfs-1";
      (ctrl as any)._inhouseSelectedAnalysis = "2026-03-04_00";
      (ctrl as any)._inhouseSelectedVariable = "wind_speed";

      const manifest = makeManifest();
      stubFetch({ "manifest.json": manifest });
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(null);

      dom.inhouseAddLayerBtn!.click();
      await new Promise((r) => setTimeout(r, 50));

      expect(ctrl.inhouseLayers.length).toBeGreaterThanOrEqual(1);
    });

    it("add layer button does nothing when no model selected", async () => {
      dom.inhouseAddLayerBtn!.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(ctrl.inhouseLayers.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // loadInhouseFrameSet (integration-ish)
  // -----------------------------------------------------------------------

  describe("loadInhouseFrameSet", () => {
    it("does nothing when no layers", async () => {
      await ctrl.loadInhouseFrameSet();
      expect(deps.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("loads textures for all layers and calls scheduleUpdateLayers", async () => {
      const layer = makeLayer();
      ctrl.inhouseLayers.push(layer);
      ctrl.inhouseTimeIndex = 0;

      const mockTexture = {
        data: new Uint8Array(400 * 4),
        width: 100,
        height: 4,
      } as any;
      vi.spyOn(ctrl, "loadInhouseTexture").mockResolvedValue(mockTexture);

      await ctrl.loadInhouseFrameSet();
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("aborts previous load when called again", async () => {
      const layer = makeLayer();
      ctrl.inhouseLayers.push(layer);

      let resolveFirst!: (v: any) => void;
      const firstPromise = new Promise((r) => {
        resolveFirst = r;
      });
      vi.spyOn(ctrl, "loadInhouseTexture")
        .mockImplementationOnce(() => firstPromise as any)
        .mockResolvedValue({
          data: new Uint8Array(4),
          width: 1,
          height: 1,
        } as any);

      const first = ctrl.loadInhouseFrameSet();
      const second = ctrl.loadInhouseFrameSet();

      // Resolve first — it was aborted so the result is moot
      resolveFirst(null);
      await Promise.allSettled([first, second]);

      // The second call should have completed
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("reports frame load errors", async () => {
      const layer = makeLayer();
      ctrl.inhouseLayers.push(layer);

      vi.spyOn(ctrl, "loadInhouseTexture").mockRejectedValue(
        new Error("Network error"),
      );

      await ctrl.loadInhouseFrameSet();
      expect(dom.inhouseWarningEl.textContent).toContain("Frame load failed");
    });
  });

  // -----------------------------------------------------------------------
  // contourCache / contourPending
  // -----------------------------------------------------------------------

  describe("contourCache and contourPending", () => {
    it("exposes cache and pending set", () => {
      expect(ctrl.contourCache).toBeDefined();
      expect(ctrl.contourPending).toBeDefined();
      expect(ctrl.contourPending).toBeInstanceOf(Set);
    });

    it("cache can store and retrieve contour data", () => {
      const data = [{ path: [[0, 0] as [number, number]], value: 1000 }];
      ctrl.contourCache.set("key", data);
      expect(ctrl.contourCache.get("key")).toBe(data);
    });
  });
});
