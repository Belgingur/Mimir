import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcherController } from "../src/controllers/LanguageSwitcherController";
import { getLocale, registerLocale, setLocale } from "../src/lib/i18n";

afterEach(() => {
  setLocale("en");
  document.body.innerHTML = "";
});

function makeBtn(): HTMLButtonElement {
  const btn = document.createElement("button");
  document.body.appendChild(btn);
  return btn;
}

describe("LanguageSwitcherController", () => {
  it("sets button text to current locale on construction", () => {
    const btn = makeBtn();
    new LanguageSwitcherController({ btn, schedulePersistState: vi.fn() });
    expect(btn.textContent).toBe("EN");
  });

  it("does not throw when btn is null", () => {
    expect(
      () =>
        new LanguageSwitcherController({
          btn: null,
          schedulePersistState: vi.fn(),
        }),
    ).not.toThrow();
  });

  it("sync() updates button text to current locale", () => {
    registerLocale("fr", { "nav.forecast": "Prévisions" });
    const btn = makeBtn();
    const ctrl = new LanguageSwitcherController({
      btn,
      schedulePersistState: vi.fn(),
    });
    setLocale("fr");
    ctrl.sync();
    expect(btn.textContent).toBe("FR");
    setLocale("en");
  });

  it("clicking cycles to next registered locale", () => {
    registerLocale("de", {});
    const btn = makeBtn();
    const schedulePersistState = vi.fn();
    new LanguageSwitcherController({ btn, schedulePersistState });
    btn.click();
    // After click, locale should have changed from 'en'
    expect(getLocale()).not.toBe("en");
  });

  it("click calls schedulePersistState", () => {
    const btn = makeBtn();
    const schedulePersistState = vi.fn();
    new LanguageSwitcherController({ btn, schedulePersistState });
    btn.click();
    expect(schedulePersistState).toHaveBeenCalledOnce();
  });

  it("sync() after click reflects the newly active locale", () => {
    registerLocale("ww", {});
    setLocale("ww");
    const btn = makeBtn();
    const ctrl = new LanguageSwitcherController({
      btn,
      schedulePersistState: vi.fn(),
    });
    expect(btn.textContent).toBe("WW");
    btn.click(); // cycles locale away from "ww"
    ctrl.sync(); // must call sync() explicitly to refresh text
    expect(btn.textContent).not.toBe("WW");
  });
});
