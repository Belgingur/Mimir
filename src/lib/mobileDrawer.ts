/**
 * Menu button ("hamburger") — reveals/hides the whole control stack on every
 * screen size. A single tap toggles `chrome-open` on <body>, which the CSS uses
 * to show/hide the mode bar (Forecast / Icons / language …) and the variable
 * picker together (see layout/chrome-collapse.css for the stacked layout and
 * layout/landscape.css for the horizontal one). The `hidden` attribute on the
 * variable list is kept in sync so its [hidden] styling and a11y state match.
 */
export function initMobileDrawer(): void {
  const trigger = document.getElementById(
    "layer-toggle-trigger",
  ) as HTMLButtonElement | null;
  const layerList = document.getElementById(
    "layer-group-list",
  ) as HTMLElement | null;
  if (!trigger || !layerList) return;

  function toggle() {
    const isOpen = !layerList!.hidden;
    layerList!.hidden = isOpen;
    trigger!.classList.toggle("is-open", !isOpen);
    trigger!.setAttribute("aria-expanded", String(!isOpen));
    document.body.classList.toggle("chrome-open", !isOpen);
  }

  trigger.addEventListener("click", toggle);
}
