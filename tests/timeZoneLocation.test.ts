import { describe, expect, it } from "vitest";
import { timeZoneLocation } from "../src/lib/timeZoneLocation";

describe("timeZoneLocation", () => {
  it("places a zone at its principal city", () => {
    expect(timeZoneLocation("Atlantic/Reykjavik")).toEqual({ lat: 64.2, lon: -21.8 });
    expect(timeZoneLocation("America/Sao_Paulo")).toEqual({ lat: -23.5, lon: -46.6 });
  });

  it("understands the older ids Chrome still reports", () => {
    // V8 resolves Atlantic/Faroe to CLDR's "Atlantic/Faeroe", and the like.
    expect(timeZoneLocation("Atlantic/Faeroe")).toEqual(timeZoneLocation("Atlantic/Faroe"));
    expect(timeZoneLocation("Asia/Calcutta")).toEqual(timeZoneLocation("Asia/Kolkata"));
    expect(timeZoneLocation("Europe/Kiev")).toEqual(timeZoneLocation("Europe/Kyiv"));
    expect(timeZoneLocation("America/Godthab")).toEqual(timeZoneLocation("America/Nuuk"));
  });

  it("keeps a zone in its own place when the tz database links it by clock rules", () => {
    // tzdata links Iceland's rules to Africa/Abidjan; Reykjavík stays in Iceland.
    expect(timeZoneLocation("Atlantic/Reykjavik")?.lat).toBeGreaterThan(60);
    // And a renamed id whose link now crosses a border goes to its own place.
    expect(timeZoneLocation("America/Coral_Harbour")).toEqual(
      timeZoneLocation("America/Atikokan"),
    );
  });

  it("has no place for a zone that is not one", () => {
    expect(timeZoneLocation("UTC")).toBeNull();
    expect(timeZoneLocation("Etc/GMT+3")).toBeNull();
    expect(timeZoneLocation("")).toBeNull();
    expect(timeZoneLocation("constructor")).toBeNull();
  });

  it("reads the browser's zone by default", () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(timeZoneLocation()).toEqual(timeZoneLocation(zone));
  });
});
