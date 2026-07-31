import { describe, expect, it } from "vitest";
import { createPlaceLabeller } from "../src/lib/placeLabeller";
import type { ResolvedPlace } from "../src/lib/resolveClickedPlace";

/** A city the user selected by clicking its label. */
const SELECTED: ResolvedPlace = {
  name: "Reykjavík",
  latitude: 64.143,
  longitude: -21.937,
  source: "label",
  distanceKm: 0,
};

/** The nearest city to a click on open ground — context, not a selection. */
const NEAREST: ResolvedPlace = {
  name: "Selfoss",
  latitude: 63.933,
  longitude: -20.997,
  source: "dataset",
  distanceKm: 18,
};

describe("createPlaceLabeller", () => {
  it("names a point the user selected by clicking its label", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    // Asked about the *resolved* point, which is where the forecast is fetched.
    expect(labeller.labelAt(-21.937, 64.143)).toBe("Reykjavík");
  });

  it("refuses to name a point that was merely near a city", () => {
    // The forecast is for the clicked spot, not for Selfoss — calling it
    // "Selfoss" would label one place while showing another's weather.
    const labeller = createPlaceLabeller();
    labeller.remember(NEAREST, { lng: -21.2, lat: 63.98 });
    expect(labeller.labelAt(-21.2, 63.98)).toBeUndefined();
    expect(labeller.labelAt(-20.997, 63.933)).toBeUndefined();
  });

  it("returns nothing for a point unrelated to the selection", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    expect(labeller.labelAt(-18.1, 65.667)).toBeUndefined();
  });

  it("returns nothing when nothing was resolved", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(null, { lng: -30, lat: 55 });
    expect(labeller.labelAt(-30, 55)).toBeUndefined();
  });

  it("returns nothing before any click (mobile centre trigger)", () => {
    expect(createPlaceLabeller().labelAt(-21.937, 64.143)).toBeUndefined();
  });

  it("tolerates sub-50m coordinate drift in the round trip", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    expect(labeller.labelAt(-21.9372, 64.1432)).toBe("Reykjavík");
  });

  it("replaces the remembered selection on each new click", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    labeller.remember(
      { ...SELECTED, name: "Akureyri", longitude: -18.1, latitude: 65.667 },
      { lng: -18.1, lat: 65.667 },
    );
    expect(labeller.labelAt(-18.1, 65.667)).toBe("Akureyri");
    expect(labeller.labelAt(-21.937, 64.143)).toBeUndefined();
  });

  it("forgets the name once a bare point is clicked", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    labeller.remember(NEAREST, { lng: -21.2, lat: 63.98 });
    expect(labeller.labelAt(-21.937, 64.143)).toBeUndefined();
  });

  it("rejects non-finite coordinates", () => {
    const labeller = createPlaceLabeller();
    labeller.remember(SELECTED, { lng: -21.94, lat: 64.14 });
    expect(labeller.labelAt(Number.NaN, 64.143)).toBeUndefined();
  });
});
