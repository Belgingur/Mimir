import { describe, it, expect } from "vitest";
import { declutterPlaces, widgetFootprint } from "../src/lib/declutterPlaces";

const place = (name: string, lon: number, lat: number, rank: number) => ({
  name,
  lon,
  lat,
  rank,
});

describe("declutterPlaces", () => {
  const reykjavik = place("Reykjavík", -21.9, 64.15, 1);
  const kopavogur = place("Kópavogur", -21.88, 64.11, 2);
  const akureyri = place("Akureyri", -18.1, 65.68, 1);

  it("drops the less important of two overlapping places", () => {
    const kept = declutterPlaces(
      [kopavogur, reykjavik, akureyri],
      6,
      widgetFootprint(63),
    );
    expect(kept.map((p) => p.name)).toEqual(["Reykjavík", "Akureyri"]);
  });

  it("keeps both once zoomed in far enough to separate them", () => {
    const kept = declutterPlaces(
      [reykjavik, kopavogur],
      12,
      widgetFootprint(72),
    );
    expect(kept).toHaveLength(2);
  });

  it("shows more places as the zoom increases", () => {
    const grid = Array.from({ length: 100 }, (_, i) =>
      place(`p${i}`, -24 + (i % 10), 63.5 + Math.floor(i / 10) * 0.35, 2),
    );
    const at = (z: number) =>
      declutterPlaces(grid, z, widgetFootprint(63)).length;
    expect(at(5)).toBeLessThan(at(6));
    expect(at(6)).toBeLessThan(at(8));
    expect(at(9)).toBe(100);
  });

  it("does not depend on input order within a rank beyond the tie-break", () => {
    const a = declutterPlaces([reykjavik, kopavogur], 6, widgetFootprint(63));
    const b = declutterPlaces([kopavogur, reykjavik], 6, widgetFootprint(63));
    expect(a).toEqual(b);
  });
});
