import { describe, it, expect } from "vitest";

import { formatWholeDegrees } from "../src/lib/formatTemperature";

describe("formatWholeDegrees", () => {
  it("never writes -0", () => {
    // −0.196 °C is the encoded step just below the 0 °C break.
    for (const value of [-0.196, -0.4, -0, 0, 0.4]) {
      expect(formatWholeDegrees(value)).toBe("0");
    }
  });

  it("rounds other values to whole degrees", () => {
    expect(formatWholeDegrees(-1.6)).toBe("-2");
    expect(formatWholeDegrees(-0.6)).toBe("-1");
    expect(formatWholeDegrees(0.5)).toBe("1");
    expect(formatWholeDegrees(12.4)).toBe("12");
  });
});
