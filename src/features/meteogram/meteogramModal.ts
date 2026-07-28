import { translateDOM } from "../../lib/i18n";
import type { MeteogramDomRefs } from "./MeteogramController";

/**
 * Build the meteogram modal and append it to `.map-wrap`, returning typed refs
 * to the elements the controller needs. The markup reuses the shared
 * `.chart-modal` classes (see `styles/components/chart-modal.css`) so it inherits
 * the existing responsive tablet/mobile/landscape overrides for free.
 *
 * Injecting the modal here — rather than hard-coding it in `index.html` — keeps
 * the feature self-contained: nothing about the meteogram exists in the DOM when
 * the feature is disabled.
 */
export function injectMeteogramModal(mapWrap: HTMLElement): MeteogramDomRefs {
  const existing = document.getElementById("meteogram-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "meteogram-modal";
  modal.className = "chart-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="chart-modal__card" role="dialog" aria-label="Meteogram">
      <div class="chart-modal__header">
        <div>
          <div class="chart-modal__title" data-i18n="modal.meteogram">Meteogram</div>
          <div id="meteogram-location" class="chart-modal__subtitle"></div>
        </div>
        <button
          id="meteogram-close"
          class="chart-modal__close"
          type="button"
          aria-label="Close"
          data-i18n="map.close"
          data-i18n-attr="aria-label"
        >×</button>
      </div>
      <div id="meteogram-status" class="chart-modal__status"></div>
      <div id="meteogram-host" class="chart-modal__host meteogram-host"></div>
    </div>
  `;

  mapWrap.appendChild(modal);
  // Localize the freshly inserted data-i18n nodes immediately. They live in
  // `document` now, so setLocale()'s translateDOM() will re-localize them later.
  translateDOM(modal);

  return {
    modal: modal as HTMLDivElement,
    close: modal.querySelector<HTMLButtonElement>("#meteogram-close")!,
    location: modal.querySelector<HTMLDivElement>("#meteogram-location")!,
    status: modal.querySelector<HTMLDivElement>("#meteogram-status")!,
    widgetHost: modal.querySelector<HTMLElement>("#meteogram-host")!,
  };
}
