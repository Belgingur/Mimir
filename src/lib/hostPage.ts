/**
 * When Mímir runs inside another site's page (an iframe), it tells that page
 * what is happening, so the page can keep its own text and controls in step:
 *
 * - `{ source: "mimir", type: "locale", locale }` once the language is set at
 *   start, and again whenever the reader changes it in Mímir's menu;
 * - `{ source: "mimir", type: "ready" }` once, when the start screen has gone.
 *
 * The messages carry nothing private (a language code), so they go to
 * whichever page embeds Mímir (`targetOrigin` "*"); that page should check
 * `event.origin` before trusting them. Nothing is sent when Mímir is not
 * embedded.
 *
 * An embedding page chooses who owns the language:
 * - `?lang=is` sets the language and hides Mímir's language button, for a
 *   page that offers its own choice;
 * - `?lang=is&lang_menu=1` only sets the starting language: Mímir's button
 *   stays, and the page follows the `locale` messages.
 */

export type HostMessage =
  | { source: "mimir"; type: "locale"; locale: string }
  | { source: "mimir"; type: "ready" };

/** True when the page in `win` is shown inside another page. */
export function isEmbedded(win: Window = window): boolean {
  try {
    return win.parent !== win;
  } catch {
    return true;
  }
}

/** `?lang_menu=1` (or `true` / `yes` / `on`): keep Mímir's language button
 *  even though `?lang=` is set. */
export function keepsLanguageMenu(search: string): boolean {
  const raw = new URLSearchParams(search).get("lang_menu");
  if (raw === null) return false;
  return ["", "1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

/**
 * `href` with its `lang` parameter set to `locale`, or null when there is
 * nothing to change (no `lang` parameter, or it already says `locale`).
 */
export function withLangParam(href: string, locale: string): string | null {
  const url = new URL(href);
  const current = url.searchParams.get("lang");
  if (current === null || current === locale) return null;
  url.searchParams.set("lang", locale);
  return url.toString();
}

export interface HostPage {
  /** Tell the page the language Mímir is showing now. */
  announceLocale(locale: string): void;
  /** Tell the page the start screen has gone (sent once). */
  announceReady(): void;
}

export function connectHostPage(win: Window = window): HostPage {
  const embedded = isEmbedded(win);
  let readySent = false;
  const post = (message: HostMessage) => {
    if (embedded) win.parent.postMessage(message, "*");
  };

  return {
    announceLocale(locale) {
      post({ source: "mimir", type: "locale", locale });
      // A reload (new-run notice, lost WebGL context) reads ?lang= again, so
      // keep it on the reader's latest choice.
      const next = withLangParam(win.location.href, locale);
      if (next) win.history.replaceState(win.history.state, "", next);
    },
    announceReady() {
      if (readySent) return;
      readySent = true;
      post({ source: "mimir", type: "ready" });
    },
  };
}
