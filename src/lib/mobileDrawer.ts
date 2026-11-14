/**
 * Menu button ("hamburger") — reveals/hides the whole control stack on every
 * screen size. A single tap toggles `chrome-open` on <body>, which the CSS uses
 * to show/hide the mode bar (Forecast / Icons / language …) and the variable
 * picker together (see layout/chrome-collapse.css for the stacked layout and
 * layout/landscape.css for the horizontal one). The `hidden` attribute on the
 * variable list is kept in sync so its [hidden] styling and a11y state match.
 *
 * On a large screen (MENU_OPEN_MEDIA) the menu starts open unless the reader
 * closed it before; the toggle is remembered there. Smaller screens start
 * closed, as they always have, and don't write the preference. The state is
 * set while the boot splash still covers the page, so it never visibly opens
 * or closes after the first paint.
 */

/** Where the menu is open by default: 1024 × 700 px and up. */
export const MENU_OPEN_MEDIA = "(min-width: 1024px) and (min-height: 700px)";

/** localStorage key: "1" open, "0" closed, absent for no preference. */
export const MENU_OPEN_KEY = "mimir-menu-open";

type MenuWindow = Pick<Window, "matchMedia" | "localStorage">;

function storageOf(win: MenuWindow): Storage | null {
  try {
    // Reading the property itself throws where storage is blocked.
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The reader's stored choice, or null when there is none or it can't be read. */
export function readMenuPreference(win: MenuWindow): boolean | null {
  try {
    const raw = storageOf(win)?.getItem(MENU_OPEN_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeMenuPreference(win: MenuWindow, open: boolean): void {
  try {
    storageOf(win)?.setItem(MENU_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* storage full or blocked: the choice lasts until the page closes */
  }
}

export function isMenuOpenScreen(win: MenuWindow): boolean {
  try {
    return win.matchMedia(MENU_OPEN_MEDIA).matches;
  } catch {
    return false;
  }
}

/** Whether the menu starts open on this screen. */
export function initialMenuOpen(win: MenuWindow): boolean {
  if (!isMenuOpenScreen(win)) return false;
  return readMenuPreference(win) ?? true;
}

function menuElements() {
  const trigger = document.getElementById(
    "layer-toggle-trigger",
  ) as HTMLButtonElement | null;
  const layerList = document.getElementById(
    "layer-group-list",
  ) as HTMLElement | null;
  return trigger && layerList ? { trigger, layerList } : null;
}

function setMenuOpen(open: boolean): void {
  const els = menuElements();
  if (!els) return;
  els.layerList.hidden = !open;
  els.trigger.classList.toggle("is-open", open);
  els.trigger.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("chrome-open", open);
}

/**
 * Opens or closes the menu for this screen and the stored choice. main.ts
 * calls it before the map is created: the markup is already there, and the
 * boot splash covers the page until the basemap has drawn, so the reader
 * never sees the menu change. (The controllers that wire the button arrive
 * later through a dynamic import, possibly after the splash has gone.)
 */
export function applyInitialMenuState(win: MenuWindow = window): void {
  setMenuOpen(initialMenuOpen(win));
}

/** Wires the Menu button. Leaves the state applyInitialMenuState set. */
export function initMobileDrawer(win: MenuWindow = window): void {
  const els = menuElements();
  if (!els) return;
  els.trigger.addEventListener("click", () => {
    const open = els.layerList.hidden;
    setMenuOpen(open);
    if (isMenuOpenScreen(win)) writeMenuPreference(win, open);
  });
}
