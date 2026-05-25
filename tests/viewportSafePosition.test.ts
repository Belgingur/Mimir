import { describe, expect, it } from "vitest";
import {
  computeViewportSafeShift,
  normalizeViewportPadding,
} from "../src/lib/viewportSafePosition";

const bounds = {
  left: 0,
  top: 0,
  right: 100,
  bottom: 100,
  width: 100,
  height: 100,
};

describe("viewportSafePosition", () => {
  it("returns zero shift when rect is fully inside bounds", () => {
    expect(
      computeViewportSafeShift(
        { left: 10, top: 10, right: 40, bottom: 40, width: 30, height: 30 },
        bounds,
        8,
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("shifts left when rect overflows the right edge", () => {
    expect(
      computeViewportSafeShift(
        { left: 80, top: 10, right: 120, bottom: 40, width: 40, height: 30 },
        bounds,
        8,
      ),
    ).toEqual({ x: -28, y: 0 });
  });

  it("shifts right when rect overflows the left edge", () => {
    expect(
      computeViewportSafeShift(
        { left: -10, top: 10, right: 20, bottom: 40, width: 30, height: 30 },
        bounds,
        8,
      ),
    ).toEqual({ x: 18, y: 0 });
  });

  it("shifts up when rect overflows the bottom edge", () => {
    expect(
      computeViewportSafeShift(
        { left: 10, top: 80, right: 40, bottom: 120, width: 30, height: 40 },
        bounds,
        8,
      ),
    ).toEqual({ x: 0, y: -28 });
  });

  it("pins oversized rects to the padded top-left corner", () => {
    expect(
      computeViewportSafeShift(
        { left: 20, top: 20, right: 140, bottom: 140, width: 120, height: 120 },
        bounds,
        8,
      ),
    ).toEqual({ x: -12, y: -12 });
  });

  it("normalizes partial padding", () => {
    expect(normalizeViewportPadding({ right: 12, bottom: 4 })).toEqual({
      top: 0,
      right: 12,
      bottom: 4,
      left: 0,
    });
  });
});
