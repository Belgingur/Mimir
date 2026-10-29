import { describe, expect, it } from "vitest";
import {
  forecastAttributes,
  meteogramTargetKey,
  normalizeMeteogramModelId,
  resolveMeteogramTarget,
} from "../src/features/meteogram/meteogramConfig";

describe("normalizeMeteogramModelId", () => {
  it("trims and upper-cases the model id", () => {
    expect(normalizeMeteogramModelId("  gfs ")).toBe("GFS");
    expect(normalizeMeteogramModelId("icon-eu")).toBe("ICON-EU");
  });
});

describe("resolveMeteogramTarget", () => {
  it("uses the config and forecast the catalog gives the model", () => {
    expect(
      resolveMeteogramTarget("gfs", { client: "site", forecast: "upstream/gfs" }),
    ).toEqual({ client: "site", forecast: "upstream/gfs" });
  });

  it("falls back to a config named after the model", () => {
    expect(resolveMeteogramTarget("gfs")).toEqual({ client: "GFS" });
    expect(resolveMeteogramTarget("GWES")).toEqual({ client: "GWES" });
  });

  it("falls back when the catalog's forecast id is malformed", () => {
    expect(
      resolveMeteogramTarget("gfs", { client: "site", forecast: "gfs" }),
    ).toEqual({ client: "GFS" });
  });
});

describe("meteogramTargetKey", () => {
  it("tells forecasts of one config apart", () => {
    const a = meteogramTargetKey({ client: "site", forecast: "upstream/a" });
    const b = meteogramTargetKey({ client: "site", forecast: "upstream/b" });
    expect(a).not.toBe(b);
    expect(meteogramTargetKey({ client: "site", forecast: "upstream/a" })).toBe(a);
    expect(meteogramTargetKey({ client: "GFS" })).toBe("GFS");
  });
});

describe("forecastAttributes", () => {
  it("splits upstream and scheduled forecast ids", () => {
    expect(forecastAttributes("upstream/gfs")).toEqual({
      type: "upstream",
      name: "gfs",
    });
    expect(forecastAttributes("schedule/region-1/2")).toEqual({
      type: "schedule",
      name: "region-1",
      domain: "2",
    });
  });

  it("rejects ids of any other shape", () => {
    for (const id of ["", "gfs", "upstream/gfs/1", "schedule/region-1", "a/b/c/d"]) {
      expect(forecastAttributes(id)).toBeNull();
    }
  });
});
