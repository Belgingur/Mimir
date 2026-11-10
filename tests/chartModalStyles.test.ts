import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom runs no CSS animations, so whether anything animates in a closed modal
 * is checked in a browser (document.getAnimations()). What is locked down here
 * is the scoping it depends on: a closed modal is only visibility-hidden, so
 * every infinite animation inside it must require `.chart-modal.is-open`.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/styles/components/chart-modal.css"),
  "utf8",
);

/** Every rule's selector list paired with its declarations, comments removed. */
function rules(): { selector: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

describe("chart-modal.css — animations only in an open modal", () => {
  it("runs the status pulse only while the modal is open", () => {
    const pulse = rules().filter((r) => /animation:\s*status-pulse/.test(r.body));
    expect(pulse.length).toBeGreaterThan(0);
    for (const rule of pulse) {
      for (const selector of rule.selector.split(",")) {
        expect(selector.trim()).toMatch(/^\.chart-modal\.is-open\s/);
      }
    }
  });

  it("scopes every infinite animation in a modal to the open one", () => {
    const infinite = rules().filter(
      (r) => /animation:[^;]*infinite/.test(r.body) && !r.selector.startsWith("@"),
    );
    for (const rule of infinite) {
      for (const selector of rule.selector.split(",")) {
        expect(selector.trim(), rule.selector).toMatch(/^\.chart-modal\.is-open\s/);
      }
    }
  });
});
