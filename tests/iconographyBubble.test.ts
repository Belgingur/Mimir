import { describe, expect, it } from "vitest";
import { getBubbleMetrics } from "../src/lib/iconographyBubble";

describe("getBubbleMetrics", () => {
  it("returns an object with all expected fields", () => {
    const m = getBubbleMetrics(60);
    expect(m).toHaveProperty("hPad");
    expect(m).toHaveProperty("vPad");
    expect(m).toHaveProperty("radius");
    expect(m).toHaveProperty("pointerH");
    expect(m).toHaveProperty("pointerBaseW");
    expect(m).toHaveProperty("shadowRoom");
  });

  it("scales proportionally with iconSize", () => {
    const small = getBubbleMetrics(30);
    const large = getBubbleMetrics(90);
    expect(large.hPad).toBeGreaterThan(small.hPad);
    expect(large.vPad).toBeGreaterThan(small.vPad);
    expect(large.radius).toBeGreaterThan(small.radius);
    expect(large.pointerH).toBeGreaterThan(small.pointerH);
    expect(large.pointerBaseW).toBeGreaterThan(small.pointerBaseW);
  });

  it("enforces minimum values at tiny iconSize", () => {
    const m = getBubbleMetrics(1);
    expect(m.hPad).toBe(5);
    expect(m.vPad).toBe(4);
    expect(m.radius).toBe(6);
    expect(m.pointerH).toBe(7);
    expect(m.pointerBaseW).toBe(10);
    expect(m.shadowRoom).toBe(5);
  });

  it("returns expected values at iconSize=60", () => {
    const m = getBubbleMetrics(60);
    expect(m.hPad).toBe(Math.max(5, Math.round(60 * 0.17)));
    expect(m.vPad).toBe(Math.max(4, Math.round(60 * 0.12)));
    expect(m.radius).toBe(Math.max(6, Math.round(60 * 0.17)));
    expect(m.pointerH).toBe(Math.max(7, Math.round(60 * 0.2)));
    expect(m.pointerBaseW).toBe(Math.max(10, Math.round(60 * 0.3)));
    expect(m.shadowRoom).toBe(Math.max(5, Math.round(60 * 0.12)));
  });

  it("all values are positive integers", () => {
    const m = getBubbleMetrics(48);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
