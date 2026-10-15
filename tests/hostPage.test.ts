import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectHostPage,
  isEmbedded,
  keepsLanguageMenu,
  withLangParam,
} from "../src/lib/hostPage";

/** A stand-in window shown inside a parent page, at `href`. */
function embeddedWindow(href: string) {
  const parent = { postMessage: vi.fn() };
  const history = {
    state: null,
    replaceState: vi.fn((_state: unknown, _title: string, url: string) => {
      win.location.href = url;
    }),
  };
  const win = { parent, history, location: { href } };
  return win as unknown as Window & {
    parent: { postMessage: ReturnType<typeof vi.fn> };
    history: { replaceState: ReturnType<typeof vi.fn> };
  };
}

describe("isEmbedded", () => {
  it("is false for a top-level page", () => {
    expect(isEmbedded(window)).toBe(false);
  });

  it("is true inside another page", () => {
    expect(isEmbedded(embeddedWindow("https://mimir.example/"))).toBe(true);
  });
});

describe("keepsLanguageMenu", () => {
  it("is off unless the page asks for it", () => {
    expect(keepsLanguageMenu("")).toBe(false);
    expect(keepsLanguageMenu("?lang=is")).toBe(false);
    expect(keepsLanguageMenu("?lang=is&lang_menu=0")).toBe(false);
  });

  it("is on for lang_menu=1 and its spellings", () => {
    for (const value of ["1", "true", "YES", "on", ""]) {
      expect(keepsLanguageMenu(`?lang=is&lang_menu=${value}`)).toBe(true);
    }
    expect(keepsLanguageMenu("?lang=is&lang_menu")).toBe(true);
  });
});

describe("withLangParam", () => {
  it("swaps the language and keeps everything else", () => {
    expect(
      withLangParam("https://mimir.example/?lang=is&lang_menu=1#x", "pl"),
    ).toBe("https://mimir.example/?lang=pl&lang_menu=1#x");
  });

  it("leaves an address without ?lang= alone", () => {
    expect(withLangParam("https://mimir.example/", "pl")).toBeNull();
  });

  it("leaves an address that already says that language alone", () => {
    expect(withLangParam("https://mimir.example/?lang=pl", "pl")).toBeNull();
  });
});

describe("connectHostPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tells the embedding page the language", () => {
    const win = embeddedWindow("https://mimir.example/?lang=is&lang_menu=1");
    connectHostPage(win).announceLocale("is");
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { source: "mimir", type: "locale", locale: "is" },
      "*",
    );
  });

  it("keeps ?lang= on the reader's choice so a reload keeps it", () => {
    const win = embeddedWindow("https://mimir.example/?lang=is&lang_menu=1");
    const host = connectHostPage(win);
    host.announceLocale("is");
    expect(win.history.replaceState).not.toHaveBeenCalled();
    host.announceLocale("fo");
    expect(win.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "https://mimir.example/?lang=fo&lang_menu=1",
    );
  });

  it("says the start screen has gone only once", () => {
    const win = embeddedWindow("https://mimir.example/");
    const host = connectHostPage(win);
    host.announceReady();
    host.announceReady();
    expect(win.parent.postMessage).toHaveBeenCalledTimes(1);
    expect(win.parent.postMessage).toHaveBeenCalledWith(
      { source: "mimir", type: "ready" },
      "*",
    );
  });

  it("sends nothing when Mímir is not embedded", () => {
    const post = vi.spyOn(window, "postMessage");
    const host = connectHostPage(window);
    host.announceLocale("en");
    host.announceReady();
    expect(post).not.toHaveBeenCalled();
  });
});
