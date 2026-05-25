/**
 * Lightweight i18n module for WeatherLayers.
 *
 * Design principles:
 *  - Zero external dependencies
 *  - Flat dot-notated keys: t('nav.forecast')
 *  - Optional interpolation: t('wind.value', { speed: '3.2' })  → "3.2 m/s"
 *  - Locale switching at runtime with re-translation of data-i18n DOM nodes
 *
 * Phase 1 covers the most visible UI strings (nav, layer names, tooltips,
 * modals, units).  Internal / dev-only strings are left for a later phase.
 */

import { en } from "../locales/en";

// ── Types ──────────────────────────────────────────────────────────────────

type LocaleStrings = Record<string, string>;
type Params = Record<string, string | number>;

// ── State ──────────────────────────────────────────────────────────────────

const locales: Record<string, LocaleStrings> = { en };
let active: LocaleStrings = en;
let activeCode = "en";
const changeCallbacks: (() => void)[] = [];

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Register an additional locale.  Call before `setLocale`.
 *
 * ```ts
 * import { is } from '../locales/is';
 * registerLocale('is', is);
 * ```
 */
export function registerLocale(code: string, strings: LocaleStrings): void {
  locales[code] = strings;
}

/**
 * Switch the active locale.  Also re-translates any DOM node carrying a
 * `data-i18n` attribute (see `translateDOM`).
 */
export function setLocale(code: string): void {
  const loc = locales[code];
  if (!loc) {
    console.warn(`[i18n] unknown locale "${code}", keeping "${activeCode}"`);
    return;
  }
  active = loc;
  activeCode = code;
  translateDOM();
  changeCallbacks.forEach((cb) => cb());
}

/** Return the currently active locale code (e.g. `'en'`). */
export function getLocale(): string {
  return activeCode;
}

/** Returns true if the given locale code has been registered. */
export function hasLocale(code: string): boolean {
  return code in locales;
}

/** Returns all registered locale codes in registration order. */
export function getAvailableLocales(): string[] {
  return Object.keys(locales);
}

/**
 * Register a callback to be called whenever the active locale changes.
 * Returns an unsubscribe function.
 */
export function onLocaleChange(cb: () => void): () => void {
  changeCallbacks.push(cb);
  return () => {
    const idx = changeCallbacks.indexOf(cb);
    if (idx >= 0) changeCallbacks.splice(idx, 1);
  };
}

/**
 * Translate a key.  Returns the localised string with optional
 * `{{param}}` interpolation, or the raw key if no translation is found
 * (makes missing translations obvious without crashing).
 *
 * ```ts
 * t('nav.forecast')                        // "Forecast"
 * t('units.wind', { value: '3.2' })        // "3.2 m/s"
 * ```
 */
export function t(key: string, params?: Params): string {
  let str = active[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }
  return str;
}

// ── DOM helpers ────────────────────────────────────────────────────────────

/**
 * Walk the document and translate every element with a `data-i18n`
 * attribute.  Supports several targets via an optional `data-i18n-attr`:
 *
 *   <span data-i18n="nav.forecast">Forecast</span>         → textContent
 *   <button data-i18n="nav.close" data-i18n-attr="aria-label" …>  → attribute
 *   <button data-i18n="nav.close" data-i18n-attr="title" …>      → attribute
 *
 * Multiple attributes can be separated by commas:
 *   data-i18n-attr="aria-label,title"
 *
 * Called automatically by `setLocale`, but can also be invoked manually
 * after dynamic DOM mutations.
 */
export function translateDOM(root: ParentNode = document): void {
  const nodes = root.querySelectorAll<HTMLElement>("[data-i18n]");
  nodes.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    // Gather interpolation params from data-i18n-* attributes (excluding
    // data-i18n itself and data-i18n-attr which is used for targeting).
    const params: Params = {};
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith("data-i18n-") && attr !== "data-i18n-attr") {
        const paramName = attr.slice("data-i18n-".length);
        params[paramName] = el.getAttribute(attr)!;
      }
    }
    const text = t(key, Object.keys(params).length > 0 ? params : undefined);
    const attrs = el.getAttribute("data-i18n-attr");
    if (attrs) {
      for (const attr of attrs.split(",")) {
        el.setAttribute(attr.trim(), text);
      }
    } else {
      el.textContent = text;
    }
  });
}
