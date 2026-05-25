import { describe, it, expect } from "vitest";
import {
  parseHexColor,
  rescalePalette,
  rescalePaletteIfNeeded,
  getDefaultInhousePalette,
} from "../src/lib/paletteUtils";

describe("parseHexColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseHexColor("#ff8000")).toEqual([255, 128, 0, 255]);
  });

  it("parses 8-digit hex with alpha", () => {
    expect(parseHexColor("#ff800080")).toEqual([255, 128, 0, 128]);
  });

  it("handles missing # prefix", () => {
    expect(parseHexColor("00ff00")).toEqual([0, 255, 0, 255]);
  });

  it("returns white for invalid hex", () => {
    expect(parseHexColor("#abc")).toEqual([255, 255, 255, 255]);
    expect(parseHexColor("")).toEqual([255, 255, 255, 255]);
  });

  it("parses black", () => {
    expect(parseHexColor("#000000")).toEqual([0, 0, 0, 255]);
  });
});

describe("rescalePalette", () => {
  it("rescales palette from ref range to src range", () => {
    const palette: [number, string][] = [
      [0, "#000"],
      [100, "#fff"],
    ];
    const result = rescalePalette(palette, -10, 10, 0, 100);
    expect(result[0][0]).toBe(-10);
    expect(result[1][0]).toBe(10);
  });

  it("returns original palette for zero-span ref range", () => {
    const palette: [number, string][] = [[5, "#000"]];
    expect(rescalePalette(palette, 0, 10, 5, 5)).toBe(palette);
  });

  it("preserves colors", () => {
    const palette: [number, string][] = [
      [0, "#ff0000"],
      [1, "#0000ff"],
    ];
    const result = rescalePalette(palette, 0, 100, 0, 1);
    expect(result[0][1]).toBe("#ff0000");
    expect(result[1][1]).toBe("#0000ff");
  });
});

describe("rescalePaletteIfNeeded", () => {
  it("returns original palette when src is within ref range", () => {
    const palette: [number, string][] = [
      [0, "#000"],
      [100, "#fff"],
    ];
    expect(rescalePaletteIfNeeded(palette, 20, 80, 0, 100)).toBe(palette);
  });

  it("rescales when src exceeds ref range", () => {
    const palette: [number, string][] = [
      [0, "#000"],
      [100, "#fff"],
    ];
    const result = rescalePaletteIfNeeded(palette, -10, 110, 0, 100);
    expect(result[0][0]).toBe(-10);
    expect(result[1][0]).toBe(110);
  });

  it("returns original for non-finite src values", () => {
    const palette: [number, string][] = [[0, "#000"]];
    expect(rescalePaletteIfNeeded(palette, NaN, 100, 0, 100)).toBe(palette);
    expect(rescalePaletteIfNeeded(palette, 0, Infinity, 0, 100)).toBe(palette);
  });
});

describe("getDefaultInhousePalette", () => {
  it("returns 3-stop blue-yellow-red palette", () => {
    const result = getDefaultInhousePalette(-10, 10);
    expect(result).toHaveLength(3);
    expect(result[0][0]).toBe(-10);
    expect(result[1][0]).toBe(0);
    expect(result[2][0]).toBe(10);
  });

  it("uses correct hex colors", () => {
    const result = getDefaultInhousePalette(0, 100);
    expect(result[0][1]).toBe("#2b83ba");
    expect(result[1][1]).toBe("#ffffbf");
    expect(result[2][1]).toBe("#d7191c");
  });
});
