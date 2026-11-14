import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MENU_OPEN_KEY,
  MENU_OPEN_MEDIA,
  applyInitialMenuState,
  initMobileDrawer,
  initialMenuOpen,
  readMenuPreference,
} from "../src/lib/mobileDrawer";

/** A window of a given size with an in-memory store. */
function fakeWindow(
  { width, height }: { width: number; height: number },
  store: Map<string, string> | "blocked" | "throws" = new Map(),
) {
  const storage =
    store === "blocked" || store === "throws"
      ? ({
          getItem() {
            throw new Error("SecurityError");
          },
          setItem() {
            throw new Error("QuotaExceededError");
          },
        } as unknown as Storage)
      : ({
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
        } as unknown as Storage);
  const win = {
    matchMedia: (query: string) => ({
      matches:
        query === MENU_OPEN_MEDIA ? width >= 1024 && height >= 700 : false,
    }),
  } as unknown as Pick<Window, "matchMedia" | "localStorage">;
  Object.defineProperty(win, "localStorage", {
    get() {
      if (store === "blocked") throw new Error("SecurityError");
      return storage;
    },
  });
  return win;
}

const DESKTOP = { width: 1400, height: 900 };
const SMALLEST = { width: 1024, height: 700 };
const SHORT = { width: 1280, height: 699 };
const NARROW = { width: 1023, height: 900 };
const PHONE = { width: 390, height: 844 };

function mountMenu() {
  document.body.className = "";
  document.body.innerHTML = `
    <button id="layer-toggle-trigger" aria-expanded="false"></button>
    <div id="layer-group-list" hidden></div>`;
  return {
    trigger: document.getElementById("layer-toggle-trigger")!,
    list: document.getElementById("layer-group-list")!,
  };
}

const isOpen = () => document.body.classList.contains("chrome-open");

describe("the menu's starting state", () => {
  it("is open at 1024 × 700 and up when nothing is stored", () => {
    expect(initialMenuOpen(fakeWindow(DESKTOP))).toBe(true);
    expect(initialMenuOpen(fakeWindow(SMALLEST))).toBe(true);
  });

  it("stays closed below 1024 × 700, whatever is stored", () => {
    for (const size of [SHORT, NARROW, PHONE]) {
      expect(initialMenuOpen(fakeWindow(size))).toBe(false);
      expect(
        initialMenuOpen(fakeWindow(size, new Map([[MENU_OPEN_KEY, "1"]]))),
      ).toBe(false);
    }
  });

  it("follows the stored choice on a large screen", () => {
    expect(
      initialMenuOpen(fakeWindow(DESKTOP, new Map([[MENU_OPEN_KEY, "0"]]))),
    ).toBe(false);
    expect(
      initialMenuOpen(fakeWindow(DESKTOP, new Map([[MENU_OPEN_KEY, "1"]]))),
    ).toBe(true);
  });

  it("falls back to the default when storage is blocked, throws or holds junk", () => {
    expect(readMenuPreference(fakeWindow(DESKTOP, "blocked"))).toBeNull();
    expect(readMenuPreference(fakeWindow(DESKTOP, "throws"))).toBeNull();
    expect(initialMenuOpen(fakeWindow(DESKTOP, "blocked"))).toBe(true);
    expect(initialMenuOpen(fakeWindow(DESKTOP, "throws"))).toBe(true);
    expect(
      initialMenuOpen(fakeWindow(DESKTOP, new Map([[MENU_OPEN_KEY, "yes"]]))),
    ).toBe(true);
  });
});

describe("the Menu button", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  it("applies the starting state to the body, the list and the button", () => {
    const { trigger, list } = mountMenu();
    applyInitialMenuState(fakeWindow(DESKTOP, store));
    expect(isOpen()).toBe(true);
    expect(list.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.classList.contains("is-open")).toBe(true);
  });

  it("doesn't change the state when it is wired up later", () => {
    mountMenu();
    const win = fakeWindow(DESKTOP, store);
    applyInitialMenuState(win);
    initMobileDrawer(win);
    expect(isOpen()).toBe(true);
  });

  it("remembers the toggle on a large screen, and the next load follows it", () => {
    const { trigger } = mountMenu();
    const win = fakeWindow(DESKTOP, store);
    applyInitialMenuState(win);
    initMobileDrawer(win);
    trigger.click();
    expect(isOpen()).toBe(false);
    expect(store.get(MENU_OPEN_KEY)).toBe("0");

    mountMenu();
    applyInitialMenuState(fakeWindow(DESKTOP, store));
    expect(isOpen()).toBe(false);

    const again = mountMenu();
    initMobileDrawer(win);
    again.trigger.click();
    expect(isOpen()).toBe(true);
    expect(store.get(MENU_OPEN_KEY)).toBe("1");
  });

  it("toggles on a phone as before, without writing a preference", () => {
    const { trigger } = mountMenu();
    const win = fakeWindow(PHONE, store);
    applyInitialMenuState(win);
    initMobileDrawer(win);
    expect(isOpen()).toBe(false);
    trigger.click();
    expect(isOpen()).toBe(true);
    trigger.click();
    expect(isOpen()).toBe(false);
    expect(store.size).toBe(0);
  });

  it("still toggles when storage is blocked", () => {
    const { trigger } = mountMenu();
    const win = fakeWindow(DESKTOP, "blocked");
    applyInitialMenuState(win);
    initMobileDrawer(win);
    expect(() => trigger.click()).not.toThrow();
    expect(isOpen()).toBe(false);
  });
});

describe("before the first paint", () => {
  const main = readFileSync(resolve(process.cwd(), "src/main.ts"), "utf8");

  it("main.ts sets the starting state before it creates the map", () => {
    const applied = main.indexOf("applyInitialMenuState();");
    expect(applied).toBeGreaterThan(-1);
    expect(applied).toBeLessThan(main.indexOf("new maplibregl.Map("));
    expect(applied).toBeLessThan(main.indexOf('import("./lib/controllerFactory")'));
  });

  it("hides the variable card while its list is still empty", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/layout/chrome-collapse.css"),
      "utf8",
    );
    expect(css).toMatch(
      /body\.chrome-open \.layer-switch-card:has\(> \.layer-group-list:empty\) \{\s*display: none !important;/,
    );
  });
});
