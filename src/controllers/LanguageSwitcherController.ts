import { getLocale, getAvailableLocales, setLocale } from "../lib/i18n";

export interface LanguageSwitcherDeps {
  btn: HTMLButtonElement | null;
  schedulePersistState: () => void;
}

/**
 * Manages the language toggle button in the nav panel.
 *
 * Clicking the button cycles through all registered locales and persists
 * the choice so it survives page reloads.
 */
export class LanguageSwitcherController {
  private readonly deps: LanguageSwitcherDeps;

  constructor(deps: LanguageSwitcherDeps) {
    this.deps = deps;
    this.sync();

    deps.btn?.addEventListener("click", () => {
      const locales = getAvailableLocales();
      const current = getLocale();
      const next = locales[(locales.indexOf(current) + 1) % locales.length];
      setLocale(next); // triggers onLocaleChange callbacks + translateDOM
      this.deps.schedulePersistState();
    });
  }

  /** Update button label to the current locale code (uppercased). */
  sync(): void {
    if (this.deps.btn) {
      this.deps.btn.textContent = getLocale().toUpperCase();
    }
  }
}
