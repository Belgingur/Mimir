import { describe, it, expect } from "vitest";
import {
  buildGraticuleLines,
  buildGraticuleLabels,
} from "../src/lib/graticule";

describe("buildGraticuleLines", () => {
  it("generates horizontal and vertical lines for full globe with step 10", () => {
    const lines = buildGraticuleLines([-180, -90, 180, 90], 10);
    // horizontal: from -90 to 90 every 10 => 19 lines
    // vertical: from -180 to 180 every 10 => 37 lines
    expect(lines.length).toBe(19 + 37);
  });

  it("generates correct horizontal line endpoints", () => {
    const lines = buildGraticuleLines([-180, -90, 180, 90], 10);
    const horizontal = lines.filter((l) => l.source[1] === l.target[1]);
    expect(horizontal.length).toBe(19);
    // all span full longitude range
    horizontal.forEach((l) => {
      expect(l.source[0]).toBe(-180);
      expect(l.target[0]).toBe(180);
    });
  });

  it("generates correct vertical line endpoints", () => {
    const lines = buildGraticuleLines([-180, -90, 180, 90], 10);
    const vertical = lines.filter((l) => l.source[0] === l.target[0]);
    expect(vertical.length).toBe(37);
    vertical.forEach((l) => {
      expect(l.source[1]).toBe(-90);
      expect(l.target[1]).toBe(90);
    });
  });

  it("respects custom step", () => {
    const lines = buildGraticuleLines([-180, -90, 180, 90], 30);
    // horizontal: -90, -60, -30, 0, 30, 60, 90 => 7
    // vertical: -180, -150, ..., 180 => 13
    const horizontal = lines.filter((l) => l.source[1] === l.target[1]);
    const vertical = lines.filter((l) => l.source[0] === l.target[0]);
    expect(horizontal.length).toBe(7);
    expect(vertical.length).toBe(13);
  });

  it("uses default step of 10", () => {
    const lines = buildGraticuleLines([-180, -90, 180, 90]);
    expect(lines.length).toBe(19 + 37);
  });

  it("handles sub-global bounds", () => {
    const lines = buildGraticuleLines([0, 0, 30, 30], 10);
    // horizontal: 0, 10, 20, 30 => 4
    // vertical: 0, 10, 20, 30 => 4
    expect(lines.length).toBe(8);
  });

  it("handles bounds that do not align to step", () => {
    const lines = buildGraticuleLines([-5, -5, 25, 25], 10);
    // horizontal: ceil(-5/10)*10=0, 10, 20 => 3
    // vertical: 0, 10, 20 => 3
    expect(lines.length).toBe(6);
  });

  it("returns empty for tiny bounds with large step", () => {
    const lines = buildGraticuleLines([1, 1, 3, 3], 10);
    // ceil(1/10)*10 = 10 > 3, no lines
    expect(lines.length).toBe(0);
  });
});

describe("buildGraticuleLabels", () => {
  it("generates latitude and longitude labels", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90], 20);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("formats latitude labels with N/S suffix", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90], 30);
    const latLabels = labels.filter(
      (l) => l.text.includes("N") || l.text.includes("S"),
    );
    expect(latLabels.length).toBeGreaterThan(0);
    // equator
    const equator = latLabels.find((l) => l.text === "0°N");
    expect(equator).toBeDefined();
    // southern
    const south60 = latLabels.find((l) => l.text === "60°S");
    expect(south60).toBeDefined();
    // northern
    const north30 = latLabels.find((l) => l.text === "30°N");
    expect(north30).toBeDefined();
  });

  it("formats longitude labels with E/W suffix", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90], 30);
    const lonLabels = labels.filter(
      (l) => l.text.includes("E") || l.text.includes("W"),
    );
    expect(lonLabels.length).toBeGreaterThan(0);
    const east90 = lonLabels.find((l) => l.text === "90°E");
    expect(east90).toBeDefined();
    const west120 = lonLabels.find((l) => l.text === "120°W");
    expect(west120).toBeDefined();
  });

  it("places latitude labels offset from left edge", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90], 30);
    const latLabels = labels.filter(
      (l) => l.text.includes("N") || l.text.includes("S"),
    );
    latLabels.forEach((l) => {
      expect(l.position[0]).toBe(-178); // minLon + 2
    });
  });

  it("places longitude labels offset from top edge", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90], 30);
    const lonLabels = labels.filter(
      (l) => l.text.includes("E") || l.text.includes("W"),
    );
    lonLabels.forEach((l) => {
      expect(l.position[1]).toBe(88); // maxLat - 2
    });
  });

  it("uses default step of 20", () => {
    const labels = buildGraticuleLabels([-180, -90, 180, 90]);
    // lat: -80, -60, ..., 80 => 9 labels  (ceil(-90/20)*20 = -80 ... 80)
    // lon: -180, -160, ..., 180 => 19 labels
    expect(labels.length).toBe(9 + 19);
  });

  it("handles sub-global bounds", () => {
    const labels = buildGraticuleLabels([0, 0, 40, 40], 20);
    // lat: 0, 20, 40 => 3
    // lon: 0, 20, 40 => 3
    expect(labels.length).toBe(6);
  });
});
