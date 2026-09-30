/**
 * The boot splash is static HTML and CSS in index.html, so it is in the first
 * paint long before the map's JavaScript arrives. This fades it out once the
 * basemap has drawn, then takes it out of the DOM.
 */

/** Matches the opacity transition on `.boot-splash` in index.html. */
const FADE_MS = 400;

/** If the map never reports `load` (a blocked style request, say), stop
 *  covering the page anyway so its own error state can be seen. */
export const BOOT_SPLASH_MAX_MS = 12_000;

export function dismissBootSplash(doc: Document = document): void {
  const el = doc.getElementById("boot-splash");
  if (!el || el.classList.contains("is-done")) return;
  el.classList.add("is-done");
  el.removeAttribute("role");
  setTimeout(() => el.remove(), FADE_MS + 50);
}
