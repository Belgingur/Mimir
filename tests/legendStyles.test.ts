import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom has no layout engine, so whether every label of a legend is inside
 * its card on a phone can't be measured here; that is checked in a browser.
 *
 * What this guards is the pair of declarations it depends on. On a touch
 * device nothing can scroll the legend's card, so the card must not be made
 * to scroll: the legend has to fit instead.
 */
const read = (file: string) =>
  readFileSync(resolve(process.cwd(), "src/styles", file), "utf8");
const phone = read("layout/mobile-small.css");
const legend = read("components/legend.css");

/** Every declaration block for a selector in `css`, as written. */
function rulesFor(css: string, selector: string): string[] {
  const rules: string[] = [];
  for (
    let index = css.indexOf(`${selector} {`);
    index > -1;
    index = css.indexOf(`${selector} {`, index + 1)
  ) {
    const open = css.indexOf("{", index);
    rules.push(css.slice(open + 1, css.indexOf("}", open)));
  }
  return rules;
}

describe("the legend on phones (mobile-small.css)", () => {
  it("lets a touch on the legend through to the map", () => {
    const touch = legend.slice(
      legend.indexOf("@media (hover: none) and (pointer: coarse)"),
    );
    expect(rulesFor(touch, "  .legend-stack-card")[0]).toMatch(
      /pointer-events:\s*none/,
    );
  });

  it("doesn't cut the card and leave it to scroll, which a touch can't do", () => {
    const rules = rulesFor(phone, "  .legend-stack-card");
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).not.toMatch(/max-height/);
      expect(rule).not.toMatch(/overflow/);
    }
  });

  it("fits the scale to the window's height instead, between 180px and its full 220px", () => {
    const [rule] = rulesFor(phone, "  .legend-stack-card .precip-legend__scale");
    expect(rule).toBeDefined();
    // The last declaration wins: dynamic viewport units where there are any.
    const heights = [...rule.matchAll(/min-height:\s*([^;]+);/g)].map(
      (match) => match[1],
    );
    expect(heights).toEqual([
      "clamp(180px, calc(35vh - 40px), 220px)",
      "clamp(180px, calc(35dvh - 40px), 220px)",
    ]);
  });

  it("keeps the full 220px as the scale's height everywhere else", () => {
    expect(rulesFor(legend, ".precip-legend__scale")[0]).toMatch(
      /min-height:\s*220px/,
    );
  });
});

describe("the legend's layout (#80)", () => {
  it("puts the values in the first column and the bar in the last", () => {
    expect(rulesFor(legend, ".precip-legend__scale")[0]).toMatch(
      /grid-template-columns:\s*max-content\s+\d+px;/,
    );
  });

  it("leaves no padding to the right of the bar", () => {
    expect(rulesFor(legend, ".precip-legend")[0]).toMatch(
      /padding:\s*\S+\s+0\s+\S+\s+\S+;/,
    );
  });

  it("right-aligns the values against the bar, with the freezing mark between them", () => {
    expect(rulesFor(legend, ".precip-legend__label")[0]).toMatch(/right:\s*0;/);
    expect(
      rulesFor(legend, ".precip-legend__label--freezing::before")[0],
    ).toMatch(/left:\s*100%;/);
  });
});
