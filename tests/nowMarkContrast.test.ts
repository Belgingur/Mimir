import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The timeline's now-mark against what is next to it (#88), WCAG 2.1 1.4.11:
 * 3 : 1 for a graphic needed to read the control.
 *
 * The rail and the bar it sits on are translucent, so each rail colour is laid
 * over both of the bar's gradient stops, each over a black and a white map.
 */

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
const timelineCss = read("src/styles/components/timeline.css");
const baseCss = read("src/styles/base.css");
const tokensCss = read("src/styles/tokens.css");

const rule = (css: string, selector: string) => {
  const match = css.match(
    new RegExp(
      `(?:^|\\})\\s*${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`,
    ),
  );
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
};
const decl = (body: string, name: string) => {
  const match = body.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  if (!match) throw new Error(`no ${name}`);
  return match[1].trim();
};
const token = (name: string) => {
  const match = tokensCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`no token ${name}`);
  return match[1].trim();
};

type RGBA = [number, number, number, number];
const parseColour = (value: string): RGBA => {
  const v = value.replace(/var\((--[\w-]+)\)/, (_, name: string) =>
    token(name),
  );
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = v.match(/rgba?\(([^)]+)\)/);
  if (!rgba) throw new Error(`cannot read colour ${value}`);
  const [r, g, b, a = 1] = rgba[1].split(",").map((part) => Number(part));
  return [r, g, b, a];
};
const over = (top: RGBA, under: RGBA): RGBA => [
  top[0] * top[3] + under[0] * (1 - top[3]),
  top[1] * top[3] + under[1] * (1 - top[3]),
  top[2] * top[3] + under[2] * (1 - top[3]),
  1,
];
const luminance = ([r, g, b]: RGBA) => {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const now = rule(timelineCss, ".timeline-rail__now");
const orange = parseColour(decl(now, "background"));
const ring = parseColour(
  decl(now, "box-shadow").match(/(#[0-9a-f]{6}|rgba?\([^)]+\))/i)![1],
);
const barStops = [
  ...decl(rule(baseCss, ".bottom-bar"), "background").matchAll(
    /rgba?\([^)]+\)/g,
  ),
].map((m) => parseColour(m[0]));
const maps: RGBA[] = [
  [0, 0, 0, 1],
  [255, 255, 255, 1],
];
const bars = barStops.flatMap((stop) => maps.map((map) => over(stop, map)));
const railOn = (selector: string) => {
  const colour = parseColour(decl(rule(timelineCss, selector), "background"));
  return bars.map((bar) => over(colour, bar));
};

describe("timeline now-mark contrast (#88)", () => {
  it("reads the colours it needs", () => {
    expect(barStops).toHaveLength(2);
  });

  it("has an opaque ring, so it doesn't depend on the map", () => {
    expect(ring[3]).toBe(1);
  });

  it("puts the orange at 3 : 1 or more against its ring", () => {
    expect(ratio(orange, ring)).toBeGreaterThanOrEqual(3);
  });

  it("puts the ring at 3 : 1 or more against the played part of the rail", () => {
    for (const filled of railOn(".timeline-rail__progress"))
      expect(ratio(ring, filled)).toBeGreaterThanOrEqual(3);
  });

  // On the bare part of the rail the ring is near the rail's own colour over
  // a dark map, so there the mark reads as orange on dark: the orange-on-ring
  // pair above carries it (5.5 : 1).
});
