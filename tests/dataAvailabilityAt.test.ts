import { describe, expect, it } from "vitest";
import { InhouseCatalogController } from "../src/controllers/InhouseCatalogController";
import type { InhouseLayer } from "../src/lib/inhouseTypes";

/**
 * A 2x2 temperature raster over a 10-degree box whose LEFT column is outside the
 * model domain (alpha 0 = nodata), standing in for the shape that caused the
 * complaint: a bounding box that covers water the grid has no values for.
 */
function layerWithHalfDomain(): InhouseLayer {
  const width = 2;
  const height = 2;
  // RGBA, row-major from the north edge. alpha 0 marks nodata.
  const data = new Uint8Array([
    120, 0, 0, 0, 120, 0, 0, 255, // north row: left nodata, right data
    120, 0, 0, 0, 120, 0, 0, 255, // south row: same
  ]);
  return {
    id: "t",
    variable: "air_temperature_at_2m_agl",
    model: "M",
    analysis: "A",
    times: ["2026-01-01T00:00:00Z"],
    manifest: {
      bounds: [0, 0, 10, 10],
      imageUnscale: [-50, 50],
      shape: { width, height },
    },
    image: { data, width, height },
    scalar: {
      // Decoded values: NaN where the mask is off, a real reading where it is on.
      data: Float32Array.from([NaN, 5, NaN, 6]),
      width,
      height,
    },
  } as unknown as InhouseLayer;
}

function controllerWith(layers: InhouseLayer[]): InhouseCatalogController {
  const c = new InhouseCatalogController({
    dom: {},
    isDev: false,
  } as never);
  // The layer list is private; seed it the way the real load path would.
  const internal = c as unknown as { _inhouseLayers: InhouseLayer[] };
  internal._inhouseLayers.length = 0;
  internal._inhouseLayers.push(...layers);
  return c;
}

describe("dataAvailabilityAt", () => {
  it("reports 'none' outside the raster's bounds", () => {
    const c = controllerWith([layerWithHalfDomain()]);
    // The exact shape of the reported bug: a point beyond the grid's edge that
    // used to open a panel, fetch, and 404.
    expect(c.dataAvailabilityAt(-5, 5, "temperature")).toBe("none");
    expect(c.dataAvailabilityAt(5, 40, "temperature")).toBe("none");
  });

  it("reports 'none' inside the bounds but outside the domain mask", () => {
    const c = controllerWith([layerWithHalfDomain()]);
    // Inside the bbox, but this half of the grid carries no values — the case a
    // rectangle can never catch.
    expect(c.dataAvailabilityAt(2, 5, "temperature")).toBe("none");
  });

  it("reports 'available' where the raster has a reading", () => {
    const c = controllerWith([layerWithHalfDomain()]);
    expect(c.dataAvailabilityAt(8, 5, "temperature")).toBe("available");
  });

  it("reports 'unknown' while nothing has loaded, so clicks are not refused", () => {
    const c = controllerWith([]);
    expect(c.dataAvailabilityAt(8, 5, "temperature")).toBe("unknown");
  });

  // Waves render through contours rather than a sampled float grid, so their
  // layer often has no `scalar` at all. Falling back to the image's own nodata
  // alpha — which every manifest declares as `A==0` — is what lets the check
  // refuse a click on land instead of shrugging "unknown" forever.
  it("still answers from the nodata alpha when no float grid was built", () => {
    const layer = layerWithHalfDomain();
    (layer as { scalar: unknown }).scalar = null;
    const c = controllerWith([layer]);
    expect(c.dataAvailabilityAt(8, 5, "temperature")).toBe("available");
    expect(c.dataAvailabilityAt(2, 5, "temperature")).toBe("none");
  });

  it("reports 'unknown' when there is no decoded image to consult", () => {
    const layer = layerWithHalfDomain();
    (layer as { scalar: unknown }).scalar = null;
    (layer as { image: unknown }).image = null;
    const c = controllerWith([layer]);
    expect(c.dataAvailabilityAt(8, 5, "temperature")).toBe("unknown");
  });

  it("reports 'none' when the mode has no layer at all", () => {
    const c = controllerWith([layerWithHalfDomain()]);
    // Waves has no raster here, but the catalog is not empty — so this is a
    // definite "no", not "still loading".
    expect(c.dataAvailabilityAt(8, 5, "waves")).toBe("none");
  });
});
