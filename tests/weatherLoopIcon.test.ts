import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  WEATHER_LOOP_CSS_SLOT,
  WEATHER_LOOP_SVG_SLOT,
  createWeatherLoopIcon,
} from "../src/lib/weatherLoopIcon";

describe("weather loop icon", () => {
  it("builds a fresh svg element each time", () => {
    const a = createWeatherLoopIcon();
    const b = createWeatherLoopIcon();
    expect(a.tagName.toLowerCase()).toBe("svg");
    expect(a.classList.contains("weather-loop")).toBe(true);
    expect(a).not.toBe(b);
    for (const part of ["wl-cloud", "wl-sun", "wl-snow", "wl-rain"]) {
      expect(a.querySelector(`.${part}`)).not.toBeNull();
    }
  });

  it("keeps both build-time slots in index.html for the boot splash", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(WEATHER_LOOP_CSS_SLOT);
    expect(html).toContain(WEATHER_LOOP_SVG_SLOT);
  });
});
