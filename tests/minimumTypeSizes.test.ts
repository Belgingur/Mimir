import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compactWidgetFontSize } from "../src/lib/CompactWidgetRenderer";
import { widgetTextSizes } from "../src/lib/WeatherWidgetRenderer";

/**
 * The smallest type Mímir draws (#95): 12 px for text the reader needs to
 * read (times, day names, model names, values) and 11 px for captions (units,
 * resolutions, run times). The forecast panel is the widget's own and is not
 * checked here.
 */
const CAPTION_MIN_PX = 11;
const TEXT_MIN_PX = 12;

const root = resolve(process.cwd(), "src");
const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });

/** Every font size written in px, em or rem, in px (1 rem = 1 em = 16 px). */
const fontSizes = (css: string) =>
  [
    ...css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .matchAll(/font(?:-size)?\s*:[^;{}]*?(?<![\w.-])(\d*\.?\d+)(px|r?em)\b/g),
  ].map(([text, value, unit]) => ({
    text: text.trim(),
    px: Number(value) * (unit === "px" ? 1 : 16),
  }));

describe("type sizes in Mímir's CSS", () => {
  const files = cssFiles(root);

  it("finds the stylesheets", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it(`sets no font size below ${CAPTION_MIN_PX} px`, () => {
    const tooSmall = files.flatMap((file) =>
      fontSizes(readFileSync(file, "utf8"))
        .filter(({ px }) => px < CAPTION_MIN_PX)
        .map(({ text }) => `${relative(root, file)}: ${text}`),
    );
    expect(tooSmall).toEqual([]);
  });

  it("reads a size the check would miss as too small", () => {
    expect(fontSizes(".a { font-size: 9px; }")[0].px).toBe(9);
    expect(fontSizes(".a { font: 700 0.5rem/1 sans-serif; }")[0].px).toBe(8);
  });
});

describe("text on the map's forecast symbols", () => {
  // Every icon size the map uses is between these, at any zoom and in
  // either symbol style.
  const iconSizes = Array.from({ length: 100 }, (_, i) => i + 1);

  it(`draws values at ${TEXT_MIN_PX} px and units at ${CAPTION_MIN_PX} px at least`, () => {
    for (const size of iconSizes) {
      const { fontSize, unitFontSz } = widgetTextSizes(size);
      expect(fontSize).toBeGreaterThanOrEqual(TEXT_MIN_PX);
      expect(unitFontSz).toBeGreaterThanOrEqual(CAPTION_MIN_PX);
      expect(compactWidgetFontSize(size)).toBeGreaterThanOrEqual(TEXT_MIN_PX);
    }
  });

  it("still grows the text with the icon", () => {
    expect(widgetTextSizes(72).fontSize).toBe(19);
    expect(compactWidgetFontSize(72)).toBe(19);
  });
});
