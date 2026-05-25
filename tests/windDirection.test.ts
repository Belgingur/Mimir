import { describe, expect, it } from "vitest";
import { windDirectionBin } from "../src/lib/windDirection";

describe("windDirectionBin", () => {
  it("returns N for 0 degrees", () => {
    expect(windDirectionBin(0)).toBe("N");
  });

  it("returns N for 360 degrees", () => {
    expect(windDirectionBin(360)).toBe("N");
  });

  it("returns S for 180 degrees", () => {
    expect(windDirectionBin(180)).toBe("S");
  });

  it("returns E for 90 degrees", () => {
    expect(windDirectionBin(90)).toBe("E");
  });

  it("returns W for 270 degrees", () => {
    expect(windDirectionBin(270)).toBe("W");
  });

  it("returns NE for 45 degrees", () => {
    expect(windDirectionBin(45)).toBe("NE");
  });

  it("returns SE for 135 degrees", () => {
    expect(windDirectionBin(135)).toBe("SE");
  });

  it("returns SW for 225 degrees", () => {
    expect(windDirectionBin(225)).toBe("SW");
  });

  it("returns NW for 315 degrees", () => {
    expect(windDirectionBin(315)).toBe("NW");
  });

  it("handles negative degrees by normalising to positive range", () => {
    expect(windDirectionBin(-90)).toBe("W");
  });

  it("handles large degrees beyond 360 by normalising", () => {
    expect(windDirectionBin(720)).toBe("N");
    expect(windDirectionBin(450)).toBe("E");
  });

  it("returns NNE for 22.5 degrees", () => {
    expect(windDirectionBin(22.5)).toBe("NNE");
  });

  it("returns NNW for 337.5 degrees", () => {
    expect(windDirectionBin(337.5)).toBe("NNW");
  });
});
