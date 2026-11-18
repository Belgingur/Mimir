import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The names beside the icons in the open menu (styles/components/menu-label.css).
 * jsdom can't lay them out, so whether the longest name fits is checked in a
 * browser; this guards the markup and the rules that the check relies on.
 */
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const html = read("index.html");
const css = read("src/styles/components/menu-label.css");

const doc = new DOMParser().parseFromString(html, "text/html");

describe("the Forecast and Icons buttons", () => {
  for (const id of ["view-forecast", "view-iconography"]) {
    it(`${id} shows its name and has it read once`, () => {
      const btn = doc.getElementById(id)!;
      expect(btn.classList.contains("has-menu-label")).toBe(true);
      const label = btn.querySelector(".menu-label")!;
      expect(label).not.toBeNull();
      expect(label.getAttribute("aria-hidden")).toBe("true");
      // aria-label and the visible label come from the same translation key,
      // so they say the same thing in every language.
      expect(btn.getAttribute("data-i18n")).toBe(label.getAttribute("data-i18n"));
      expect(btn.getAttribute("data-i18n-attr")?.split(",")).toContain(
        "aria-label",
      );
      expect(btn.getAttribute("aria-label")).toBe(label.textContent?.trim());
    });
  }
});

describe("menu-label.css", () => {
  it("hides the labels unless the vertical menu is open", () => {
    expect(css).toMatch(/^\.menu-label \{\s*display: none;\s*\}/m);
    expect(css).toMatch(
      /@media not all and \(max-height: 500px\) and \(orientation: landscape\) \{[\s\S]*body\.chrome-open \.has-menu-label > \.menu-label \{/,
    );
  });

  it("keeps each name on one line, left of its icon", () => {
    const rule = css.slice(
      css.indexOf("body.chrome-open .has-menu-label > .menu-label {"),
    );
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toMatch(/white-space: nowrap;/);
    expect(body).toMatch(/order: -1;/);
    expect(body).toMatch(/display: block !important;/);
  });

  it("is loaded with the other components", () => {
    expect(read("src/styles/index.css")).toContain(
      '@import "./components/menu-label.css";',
    );
  });
});
