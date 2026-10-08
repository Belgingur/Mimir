import { describe, expect, it } from "vitest";
import { domainMaskContains } from "../src/lib/domainMask";
import type { DomainMask, ModelBBox } from "../src/lib/inhouseTypes";

// A 4x2 grid over lon 0..4, lat 0..2: one degree per cell.
const bbox: ModelBBox = { west: 0, south: 0, east: 4, north: 2 };

describe("domainMaskContains", () => {
  it("reads row 0 as the north edge", () => {
    // North row: nodata, data, data, nodata. South row: all nodata.
    const mask: DomainMask = { cols: 4, rows: 2, runs: "1.2/4" };
    expect(domainMaskContains(mask, bbox, 1.5, 1.5)).toBe(true);
    expect(domainMaskContains(mask, bbox, 1.5, 2.5)).toBe(true);
    expect(domainMaskContains(mask, bbox, 0.5, 1.5)).toBe(false);
  });

  it("treats a row's cells after its last run as nodata", () => {
    const mask: DomainMask = { cols: 4, rows: 2, runs: "0.1/0.4" };
    expect(domainMaskContains(mask, bbox, 1.5, 0.5)).toBe(true);
    expect(domainMaskContains(mask, bbox, 1.5, 3.5)).toBe(false);
    expect(domainMaskContains(mask, bbox, 0.5, 3.5)).toBe(true);
  });

  it("alternates nodata and data runs along a row", () => {
    const mask: DomainMask = { cols: 4, rows: 2, runs: "0.1.2.1/4" };
    const north = [0.5, 1.5, 2.5, 3.5].map((lon) =>
      domainMaskContains(mask, bbox, 1.5, lon),
    );
    expect(north).toEqual([true, false, false, true]);
  });

  it("is false outside the bbox, and true on its far edges", () => {
    const mask: DomainMask = { cols: 4, rows: 2, runs: "0.4/0.4" };
    expect(domainMaskContains(mask, bbox, 2.5, 1)).toBe(false);
    expect(domainMaskContains(mask, bbox, 1, -0.5)).toBe(false);
    expect(domainMaskContains(mask, bbox, 2, 4)).toBe(true);
    expect(domainMaskContains(mask, bbox, 0, 0)).toBe(true);
  });
});
