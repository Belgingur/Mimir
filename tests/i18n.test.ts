import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAvailableLocales,
  getLocale,
  hasLocale,
  onLocaleChange,
  registerLocale,
  setLocale,
  t,
  translateDOM,
} from "../src/lib/i18n";

afterEach(() => {
  setLocale("en");
});

describe("t", () => {
  it("returns the English translation for a known key", () => {
    expect(t("nav.forecast")).toBe("Forecast");
  });

  it("returns the raw key when no translation exists", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("interpolates params into the translated string", () => {
    registerLocale("test-interp", { "greet.msg": "Hello {{name}}!" });
    setLocale("test-interp");
    expect(t("greet.msg", { name: "World" })).toBe("Hello World!");
  });

  it("falls back to English when the active locale lacks the key", () => {
    registerLocale("partial", { "only.this": "only" });
    setLocale("partial");
    expect(t("nav.forecast")).toBe("Forecast");
  });
});

describe("registerLocale / setLocale / getLocale", () => {
  it("getLocale returns 'en' by default", () => {
    expect(getLocale()).toBe("en");
  });

  it("setLocale switches the active locale", () => {
    registerLocale("xx", { "nav.forecast": "Prognose" });
    setLocale("xx");
    expect(getLocale()).toBe("xx");
    expect(t("nav.forecast")).toBe("Prognose");
  });

  it("setLocale ignores unknown codes and keeps current locale", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setLocale("definitely-unknown");
    expect(getLocale()).toBe("en");
    warnSpy.mockRestore();
  });

  it("emits a console.warn for unknown locale", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setLocale("no-such-locale");
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("hasLocale", () => {
  it("returns true for the built-in English locale", () => {
    expect(hasLocale("en")).toBe(true);
  });

  it("returns false for an unregistered locale", () => {
    expect(hasLocale("zz")).toBe(false);
  });

  it("returns true after registering a locale", () => {
    registerLocale("yy", {});
    expect(hasLocale("yy")).toBe(true);
  });
});

describe("getAvailableLocales", () => {
  it("includes 'en' by default", () => {
    expect(getAvailableLocales()).toContain("en");
  });

  it("includes newly registered locales", () => {
    registerLocale("ab", {});
    expect(getAvailableLocales()).toContain("ab");
  });
});

describe("onLocaleChange", () => {
  it("fires the callback when the locale changes", () => {
    const cb = vi.fn();
    registerLocale("cb-locale", {});
    const unsubscribe = onLocaleChange(cb);
    setLocale("cb-locale");
    expect(cb).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("does not fire the callback after unsubscribing", () => {
    const cb = vi.fn();
    registerLocale("unsub-locale", {});
    const unsubscribe = onLocaleChange(cb);
    unsubscribe();
    setLocale("unsub-locale");
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not fire when setLocale is called with an unknown code", () => {
    const cb = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unsubscribe = onLocaleChange(cb);
    setLocale("definitely-not-registered");
    expect(cb).not.toHaveBeenCalled();
    unsubscribe();
    warnSpy.mockRestore();
  });
});

describe("translateDOM", () => {
  it("translates elements with data-i18n attribute via textContent", () => {
    const div = document.createElement("div");
    div.setAttribute("data-i18n", "nav.forecast");
    document.body.appendChild(div);
    translateDOM();
    expect(div.textContent).toBe("Forecast");
    document.body.removeChild(div);
  });

  it("translates into a specified attribute via data-i18n-attr", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-i18n", "nav.forecast");
    btn.setAttribute("data-i18n-attr", "aria-label");
    document.body.appendChild(btn);
    translateDOM();
    expect(btn.getAttribute("aria-label")).toBe("Forecast");
    document.body.removeChild(btn);
  });

  it("supports multiple comma-separated attributes in data-i18n-attr", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-i18n", "nav.forecast");
    btn.setAttribute("data-i18n-attr", "aria-label,title");
    document.body.appendChild(btn);
    translateDOM();
    expect(btn.getAttribute("aria-label")).toBe("Forecast");
    expect(btn.getAttribute("title")).toBe("Forecast");
    document.body.removeChild(btn);
  });

  it("uses a custom root when provided", () => {
    const container = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-i18n", "nav.forecast");
    container.appendChild(span);
    translateDOM(container);
    expect(span.textContent).toBe("Forecast");
  });

  it("re-translates DOM nodes on setLocale", () => {
    const span = document.createElement("span");
    span.setAttribute("data-i18n", "nav.forecast");
    document.body.appendChild(span);
    registerLocale("dom-test", { "nav.forecast": "Prognose" });
    setLocale("dom-test");
    expect(span.textContent).toBe("Prognose");
    document.body.removeChild(span);
  });
});
