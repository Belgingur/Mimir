import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Text on Mímir's orange fills: every pair the stylesheets set up has to reach
 * WCAG AA's 4.5 : 1 for normal-size text.
 *
 * A rule is an orange fill when its background names an orange token or an
 * orange colour. Its text colour is taken from the same rule; the colours of
 * rules nested under it (`.fill .child`) and of its own BEM elements
 * (`.model-pill__meta` under `.model-pill`) are checked against it as well.
 * Each stop of a gradient counts as a fill. Translucent text is laid over the
 * fill before it is measured.
 */

const STYLES = resolve(process.cwd(), "src/styles");
const MIN_RATIO = 4.5;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? cssFiles(join(dir, entry.name))
      : entry.name.endsWith(".css")
        ? [join(dir, entry.name)]
        : [],
  );
}

type Rule = { file: string; selectors: string[]; decls: Map<string, string> };

/** Innermost blocks only: enough for these stylesheets (no nesting). */
function parse(file: string): Rule[] {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = new Map<string, string>();
    for (const decl of match[2].split(";")) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      decls.set(
        decl.slice(0, colon).trim(),
        decl
          .slice(colon + 1)
          .replace(/!important/, "")
          .trim(),
      );
    }
    rules.push({
      file: relative(process.cwd(), file),
      selectors: match[1]
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, " "))
        .filter(Boolean),
      decls,
    });
  }
  return rules;
}

const rules = cssFiles(STYLES).flatMap(parse);
const tokens = new Map<string, string>();
for (const rule of rules)
  if (rule.selectors.includes(":root"))
    for (const [name, value] of rule.decls)
      if (name.startsWith("--")) tokens.set(name, value);

/** Replace var(--x[, fallback]) with the token's value, repeatedly. */
function resolveVars(value: string): string {
  let out = value;
  for (let i = 0; i < 5 && out.includes("var("); i++)
    out = out.replace(
      /var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
      (_, name: string, fallback?: string) =>
        tokens.get(name) ?? fallback ?? "",
    );
  return out;
}

type RGBA = [number, number, number, number];

function colours(value: string): RGBA[] {
  const found: RGBA[] = [];
  for (const m of value.matchAll(
    /#([0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(([^)]+)\)|\b(white)\b/gi,
  )) {
    if (m[1]) {
      const hex =
        m[1].length === 3
          ? [...m[1]].map((c) => c + c).join("")
          : m[1];
      found.push([
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ]);
    } else if (m[2]) {
      const [r, g, b, a = "1"] = m[2].split(/[\s,/]+/).filter(Boolean);
      found.push([Number(r), Number(g), Number(b), Number(a)]);
    } else found.push([255, 255, 255, 1]);
  }
  return found;
}

/** Orange: red well above blue, green in between (hue roughly 15–45°). */
function isOrange([r, g, b]: RGBA): boolean {
  return r > 120 && r - b > 90 && g > b && r - g > 40;
}

function luminance([r, g, b]: RGBA): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function over([r, g, b, a]: RGBA, [br, bg, bb]: RGBA): RGBA {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function contrast(text: RGBA, fill: RGBA): number {
  const [l1, l2] = [luminance(over(text, fill)), luminance(fill)].sort(
    (x, y) => y - x,
  );
  return (l1 + 0.05) / (l2 + 0.05);
}

const hex = ([r, g, b]: RGBA) =>
  "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

function background(rule: Rule): RGBA[] {
  const value = rule.decls.get("background") ?? rule.decls.get("background-color");
  return value ? colours(resolveVars(value)) : [];
}

const fills = rules.filter((rule) => {
  const bg = background(rule);
  return bg.length > 0 && bg.filter((c) => c[3] > 0).every(isOrange);
});

type Pair = {
  where: string;
  text: RGBA;
  fill: RGBA;
  ratio: number;
  opacity: number;
};

function textRulesFor(fill: Rule): Rule[] {
  const blocks = fill.selectors
    .map((s) => s.match(/^\.([\w-]+?)(?:--[\w-]+)?(?=[.:\s[]|$)/)?.[1])
    .filter((b): b is string => !!b);
  return rules.filter(
    (rule) =>
      rule === fill ||
      rule.selectors.some(
        (sel) =>
          fill.selectors.some((f) => sel.startsWith(`${f} `)) ||
          // BEM elements of a fill whose selector is the bare block: the
          // block is orange in every state, so its elements sit on orange.
          blocks.some(
            (b) =>
              fill.selectors.includes(`.${b}`) && sel.startsWith(`.${b}__`),
          ),
      ),
  );
}

/** A `:hover` fill with no colour of its own keeps the resting rule's text. */
function restingColour(fill: Rule): string | undefined {
  for (const sel of fill.selectors.filter((s) => s.endsWith(":hover"))) {
    const base = rules.find((r) =>
      r.selectors.includes(sel.replace(/:hover$/, "")),
    );
    const colour = base?.decls.get("color");
    if (colour) return colour;
  }
  return undefined;
}

const pairs: Pair[] = [];
for (const fill of fills) {
  for (const rule of textRulesFor(fill)) {
    const colour =
      rule.decls.get("color") ??
      (rule === fill ? restingColour(fill) : undefined);
    const opacity = Number(rule.decls.get("opacity") ?? "1");
    const textColours = colour ? colours(resolveVars(colour)) : [];
    for (const text of textColours)
      for (const stop of background(fill))
        pairs.push({
          where: `${fill.file}: ${rule.selectors.join(", ")}`,
          text,
          fill: stop,
          ratio: contrast(text, stop),
          opacity,
        });
    if (!colour && opacity < 1)
      pairs.push({
        where: `${fill.file}: ${rule.selectors.join(", ")}`,
        text: [255, 255, 255, 1],
        fill: background(fill)[0],
        ratio: 0,
        opacity,
      });
  }
}

/** The pairs as a table, for the PR description: `PRINT_PAIRS=1 npx vitest run tests/orangeContrast.test.ts`. */
if (process.env.PRINT_PAIRS)
  console.log(
    pairs
      .map(
        (p) =>
          `${p.ratio.toFixed(2)} : 1  ${hex(p.text)}${p.text[3] < 1 ? ` at ${p.text[3]}` : ""} on ${hex(p.fill)}  ${p.where}`,
      )
      .join("\n"),
  );

describe("text on the orange fills", () => {
  it("finds the fills the app has", () => {
    // The time bubble, the time on the map, the model pill, the active model
    // in the chooser and in the card, and the active-state buttons.
    expect(fills.length).toBeGreaterThanOrEqual(10);
    expect(pairs.length).toBeGreaterThanOrEqual(fills.length);
  });

  it("reaches 4.5 : 1 for every text-on-orange pair", () => {
    const failing = pairs
      .filter((p) => p.ratio < MIN_RATIO || p.opacity < 1)
      .map(
        (p) =>
          `${p.where}: ${hex(p.text)} on ${hex(p.fill)} is ${p.ratio.toFixed(2)} : 1${p.opacity < 1 ? `, opacity ${p.opacity}` : ""}`,
      );
    expect(failing).toEqual([]);
  });

  it("darkens an orange fill on hover rather than lightening it", () => {
    for (const rule of rules) {
      for (const sel of rule.selectors.filter((s) => s.endsWith(":hover"))) {
        const base = rules.find((r) =>
          r.selectors.includes(sel.replace(/:hover$/, "")),
        );
        const hovered = background(rule);
        const resting = base ? background(base) : [];
        if (!hovered.length || !resting.length || !resting.every(isOrange))
          continue;
        expect(luminance(hovered[0]), sel).toBeLessThanOrEqual(
          luminance(resting[0]),
        );
      }
    }
  });

  it("keeps the decoration orange away from text", () => {
    for (const name of ["--accent-orange-decor", "--accent-orange-decor-light"])
      for (const rule of rules) {
        const bg =
          rule.decls.get("background") ?? rule.decls.get("background-color");
        if (bg?.includes(name))
          expect(rule.decls.has("color"), rule.selectors.join(", ")).toBe(false);
      }
  });
});
