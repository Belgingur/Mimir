import { describe, expect, it } from "vitest";
import {
  normalizeMeteogramModelId,
  resolveMeteogramClientName,
} from "../src/features/meteogram/meteogramConfig";

describe("normalizeMeteogramModelId", () => {
  it("trims and upper-cases the model id", () => {
    expect(normalizeMeteogramModelId("  gfs ")).toBe("GFS");
    expect(normalizeMeteogramModelId("icon-eu")).toBe("ICON-EU");
  });
});

describe("resolveMeteogramClientName", () => {
  it("returns the normalized model id as the deployment client name", () => {
    expect(resolveMeteogramClientName("gfs")).toBe("GFS");
    expect(resolveMeteogramClientName("GWES")).toBe("GWES");
  });
});
