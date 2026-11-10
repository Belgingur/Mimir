import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom has no layout, so whether the docked panel covers the timeline's time
 * label is checked in a browser. What is locked down here is the declaration
 * that keeps it clear: on desktop the widget's host box (the modal card) ends
 * above the bottom bar, with room for the label, and the widget keeps its panel
 * inside that box.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/features/meteogram/meteogram.css"),
  "utf8",
);

function desktopRule(selector: string): string {
  const media = css.indexOf("@media (min-width: 900px)");
  expect(media, "missing the desktop block").toBeGreaterThan(-1);
  const index = css.indexOf(`${selector} {`, media);
  expect(index, `missing rule for "${selector}"`).toBeGreaterThan(-1);
  const open = css.indexOf("{", index);
  return css.slice(open + 1, css.indexOf("}", open));
}

describe("meteogram.css — docked panel and the timeline", () => {
  it("ends the panel's box above the bottom bar and its time label", () => {
    const rule = desktopRule("#meteogram-modal .chart-modal__card");
    const inset = rule.match(/(?:^|;|\s)inset:\s*([^;]+);/)?.[1]?.trim() ?? "";
    const bottom = inset.match(
      /^0 0 calc\(var\(--bottom-bar-height\) \+ var\(--safe-area-bottom\) \+ (\d+)px\)$/,
    );
    expect(bottom, `inset was "${inset}"`).not.toBeNull();
    const clearance = Number(bottom?.[1]);
    // The label stands ~18px above the bar and grows to ~30px while hovered.
    expect(clearance).toBeGreaterThanOrEqual(30);
  });
});
