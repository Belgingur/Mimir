import { describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import {
  applyPlaceLabelStyle,
  COUNTRY_LABEL_LAYER_IDS,
  COUNTRY_TEXT_COLOR,
  KEPT_SETTLEMENT_LAYER_IDS,
  KEPT_SETTLEMENT_MIN_ZOOM,
  LABEL_HALO_COLOR,
  REGION_LABEL_LAYER_IDS,
  REPLACED_CITY_LAYER_IDS,
  SETTLEMENT_MAX_ZOOM,
  SETTLEMENT_TEXT_COLOR,
} from "../src/lib/placeLabelStyle";
import { SETTLEMENT_LAYER_IDS } from "../src/lib/placeLabelPick";

const ALL_IDS = [
  ...SETTLEMENT_LAYER_IDS,
  ...COUNTRY_LABEL_LAYER_IDS,
  ...REGION_LABEL_LAYER_IDS,
];

function makeMap(options: { presentLayers?: readonly string[] } = {}) {
  const present = new Set(options.presentLayers ?? ALL_IDS);
  const setPaintProperty = vi.fn();
  const setLayoutProperty = vi.fn();
  const setLayerZoomRange = vi.fn();
  const map = {
    // positron caps settlement labels at z12–15; mirror a value so the helper
    // has a minzoom to preserve.
    getLayer: (id: string) => (present.has(id) ? { id, minzoom: 3 } : undefined),
    setPaintProperty,
    setLayoutProperty,
    setLayerZoomRange,
  };
  return {
    map: map as unknown as maplibregl.Map,
    setPaintProperty,
    setLayoutProperty,
    setLayerZoomRange,
  };
}

/** Paint calls for one layer, as a property→value record. */
function paintFor(setPaintProperty: ReturnType<typeof vi.fn>, layerId: string) {
  const out: Record<string, unknown> = {};
  for (const [id, prop, value] of setPaintProperty.mock.calls as [
    string,
    string,
    unknown,
  ][]) {
    if (id === layerId) out[prop] = value;
  }
  return out;
}

describe("applyPlaceLabelStyle", () => {
  it("recolours every settlement layer to dark text on a white halo", () => {
    const { map, setPaintProperty } = makeMap();
    applyPlaceLabelStyle(map);
    for (const id of KEPT_SETTLEMENT_LAYER_IDS) {
      const paint = paintFor(setPaintProperty, id);
      expect(paint["text-color"]).toBe(SETTLEMENT_TEXT_COLOR);
      expect(paint["text-halo-color"]).toBe(LABEL_HALO_COLOR);
      // The washed-out default was a light halo *and* light text; the halo has
      // to be wide enough to carry dark text over dark weather.
      expect(paint["text-halo-width"]).toBeGreaterThan(1);
    }
  });

  it("gives country labels their own, less prominent colour", () => {
    const { map, setPaintProperty } = makeMap();
    applyPlaceLabelStyle(map);
    for (const id of COUNTRY_LABEL_LAYER_IDS) {
      expect(paintFor(setPaintProperty, id)["text-color"]).toBe(
        COUNTRY_TEXT_COLOR,
      );
    }
    expect(COUNTRY_TEXT_COLOR).not.toBe(SETTLEMENT_TEXT_COLOR);
  });

  it("hides admin-region labels so city names win the collision", () => {
    const { map, setLayoutProperty } = makeMap();
    applyPlaceLabelStyle(map);
    for (const id of REGION_LABEL_LAYER_IDS) {
      expect(setLayoutProperty).toHaveBeenCalledWith(id, "visibility", "none");
    }
  });

  it("does not hide country labels", () => {
    const { map, setLayoutProperty } = makeMap();
    applyPlaceLabelStyle(map);
    const hidden = (setLayoutProperty.mock.calls as [string, string, unknown][])
      .filter(([, prop, value]) => prop === "visibility" && value === "none")
      .map(([id]) => id);
    for (const id of COUNTRY_LABEL_LAYER_IDS) {
      expect(hidden).not.toContain(id);
    }
  });

  it("lifts the settlement zoom ceiling so city names survive zooming in", () => {
    const { map, setLayerZoomRange } = makeMap();
    applyPlaceLabelStyle(map);
    for (const id of KEPT_SETTLEMENT_LAYER_IDS) {
      const call = (
        setLayerZoomRange.mock.calls as [string, number, number][]
      ).find(([layerId]) => layerId === id);
      expect(call?.[2]).toBe(SETTLEMENT_MAX_ZOOM);
    }
    expect(SETTLEMENT_MAX_ZOOM).toBeGreaterThan(15);
  });

  it("keeps small places off the far-out view", () => {
    const { map, setLayerZoomRange } = makeMap();
    applyPlaceLabelStyle(map);
    const minZoomFor = (id: string) =>
      (setLayerZoomRange.mock.calls as [string, number, number][]).find(
        ([layerId]) => layerId === id,
      )?.[1];
    // Positron gives these no minzoom, so hamlets would compete for space on a
    // continental view. Smaller places must arrive later than bigger ones.
    expect(minZoomFor("place_town")).toBe(KEPT_SETTLEMENT_MIN_ZOOM.place_town);
    expect(minZoomFor("place_town")).toBeGreaterThan(0);
    expect(minZoomFor("place_village")).toBeGreaterThan(
      minZoomFor("place_town") as number,
    );
    expect(minZoomFor("place_other")).toBeGreaterThan(
      minZoomFor("place_village") as number,
    );
  });

  it("leaves country label zoom ranges alone", () => {
    const { map, setLayerZoomRange } = makeMap();
    applyPlaceLabelStyle(map);
    const touched = (setLayerZoomRange.mock.calls as [string][]).map(
      ([id]) => id,
    );
    for (const id of COUNTRY_LABEL_LAYER_IDS) {
      expect(touched).not.toContain(id);
    }
  });

  it("hides the basemap city layers its own layer replaces", () => {
    const { map, setLayoutProperty } = makeMap();
    applyPlaceLabelStyle(map);
    for (const id of REPLACED_CITY_LAYER_IDS) {
      expect(setLayoutProperty).toHaveBeenCalledWith(id, "visibility", "none");
    }
    // ...and does not restyle what it is about to hide.
    expect(KEPT_SETTLEMENT_LAYER_IDS).not.toContain("place_city");
    expect(KEPT_SETTLEMENT_LAYER_IDS).toContain("place_town");
    expect(KEPT_SETTLEMENT_LAYER_IDS).toContain("place_village");
  });

  it("skips layers the current style does not have", () => {
    const { map, setPaintProperty, setLayerZoomRange } = makeMap({
      presentLayers: ["place_town"],
    });
    applyPlaceLabelStyle(map);
    const touched = new Set(
      (setPaintProperty.mock.calls as [string][]).map(([id]) => id),
    );
    expect(touched).toEqual(new Set(["place_town"]));
    expect(setLayerZoomRange).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for a style with no place layers", () => {
    const { map, setPaintProperty, setLayoutProperty } = makeMap({
      presentLayers: [],
    });
    expect(() => applyPlaceLabelStyle(map)).not.toThrow();
    expect(setPaintProperty).not.toHaveBeenCalled();
    expect(setLayoutProperty).not.toHaveBeenCalled();
  });

  it("survives a style swap mid-call", () => {
    const { map } = makeMap();
    vi.spyOn(map, "setPaintProperty").mockImplementation(() => {
      throw new Error("style is not done loading");
    });
    expect(() => applyPlaceLabelStyle(map)).not.toThrow();
  });

  it("is idempotent, so re-running on every styledata is safe", () => {
    const { map, setPaintProperty } = makeMap();
    applyPlaceLabelStyle(map);
    const first = paintFor(setPaintProperty, "place_city");
    applyPlaceLabelStyle(map);
    expect(paintFor(setPaintProperty, "place_city")).toEqual(first);
  });
});
