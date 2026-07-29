import { translateDOM } from "../../lib/i18n";

export interface MeteogramTrigger {
  readonly el: HTMLButtonElement;
  /** Re-evaluate whether the button should be offered for the current state. */
  refresh(): void;
  destroy(): void;
}

/**
 * An icon-only button added to the on-map zoom/grid control stack, shown on
 * touch / small screens only. Touch maps have no hover pointer, and tapping the
 * map to open a popup fights with pan/zoom gestures — so on mobile the meteogram
 * is opened for the centre-crosshair point via this control instead. Visibility
 * is governed by CSS (mobile viewport + forecast view) combined with the
 * `is-available` class, which reflects whether a map click would resolve to a
 * meteogram (i.e. not GWES/waves). No text label: it reads as one of the +/-/grid
 * buttons; the localized name is exposed via aria-label/title only.
 */
export function createMeteogramTrigger(opts: {
  /** The `.zoom-buttons` control stack the button is appended to. */
  mount: HTMLElement;
  isMeteogramTarget: () => boolean;
  onActivate: () => void;
}): MeteogramTrigger {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "zoom-buttons__meteogram forecast-only";
  btn.setAttribute("data-i18n", "meteogram.openAtCenter");
  btn.setAttribute("data-i18n-attr", "aria-label,title");
  btn.innerHTML = `
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" />
      <circle cx="12" cy="8" r="2" />
      <path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" />
    </svg>
  `;

  const onClick = () => opts.onActivate();
  btn.addEventListener("click", onClick);
  opts.mount.appendChild(btn);
  translateDOM(btn);

  const refresh = () => {
    btn.classList.toggle("is-available", opts.isMeteogramTarget());
  };
  refresh();

  return {
    el: btn,
    refresh,
    destroy() {
      btn.removeEventListener("click", onClick);
      btn.remove();
    },
  };
}
