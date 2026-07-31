import { describe, expect, it } from "vitest";
import { resolveWeatherBeforeId } from "../src/lib/mapLayerOrder";

/** Abridged positron layer stack, preserving the ordering that matters. */
const POSITRON_LAYERS = [
  { id: "background", type: "background" },
  { id: "water", type: "fill", "source-layer": "water" },
  { id: "water_name", type: "symbol", "source-layer": "water_name" },
  { id: "building", type: "fill", "source-layer": "building" },
  { id: "highway_major_inner", type: "line", "source-layer": "transportation" },
  {
    id: "highway_name_other",
    type: "symbol",
    "source-layer": "transportation_name",
  },
  { id: "boundary_country_z5-", type: "line", "source-layer": "boundary" },
  { id: "place_other", type: "symbol", "source-layer": "place" },
  { id: "place_village", type: "symbol", "source-layer": "place" },
  { id: "place_city", type: "symbol", "source-layer": "place" },
  { id: "place_country_major", type: "symbol", "source-layer": "place" },
];

describe("resolveWeatherBeforeId", () => {
  it("anchors before the first place-label layer, not the first symbol layer", () => {
    // water_name and highway_name_other are symbol layers that come earlier,
    // but anchoring there would let roads and buildings paint over the weather.
    expect(resolveWeatherBeforeId({ layers: POSITRON_LAYERS })).toBe(
      "place_other",
    );
  });

  it("falls back to the first symbol layer when no place layer exists", () => {
    const layers = POSITRON_LAYERS.filter(
      (layer) => layer["source-layer"] !== "place",
    );
    expect(resolveWeatherBeforeId({ layers })).toBe("water_name");
  });

  it("returns undefined when the style has no symbol layers", () => {
    const layers = POSITRON_LAYERS.filter((layer) => layer.type !== "symbol");
    expect(resolveWeatherBeforeId({ layers })).toBeUndefined();
  });

  it("returns undefined for an unloaded or empty style", () => {
    expect(resolveWeatherBeforeId(null)).toBeUndefined();
    expect(resolveWeatherBeforeId(undefined)).toBeUndefined();
    expect(resolveWeatherBeforeId({})).toBeUndefined();
    expect(resolveWeatherBeforeId({ layers: [] })).toBeUndefined();
  });

  it("tracks a reordered style rather than a fixed id", () => {
    // A MapTiler style update that renames the first place layer must not leave
    // the overlay unanchored — the id is always read from the live style.
    const renamed = POSITRON_LAYERS.map((layer) =>
      layer.id === "place_other" ? { ...layer, id: "place_minor" } : layer,
    );
    expect(resolveWeatherBeforeId({ layers: renamed })).toBe("place_minor");
  });
});
