/**
 * The animated weather icon used wherever Mímir is loading: snow falling from
 * a cloud, then rain, the sun breaking through, clear sky, and back — one 6 s
 * loop. Under prefers-reduced-motion it holds on a still partly-cloudy frame.
 *
 * It has to be in the very first paint (the boot splash in index.html), before
 * any JavaScript runs, so vite.config.ts writes both strings into index.html at
 * build time. The CSS therefore lives in the page head for the whole session,
 * and runtime callers only need the markup: see createWeatherLoopIcon.
 */

export const WEATHER_LOOP_ICON_SVG = `<svg class="weather-loop" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="weather-loop-cloud" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#d6dee4" />
    </linearGradient>
  </defs>
  <g class="wl-sun">
    <g class="wl-rays" stroke="#f2a93b" stroke-width="4" stroke-linecap="round">
      <path d="M60 8v7M60 61v7M30 38h7M83 38h7M38.8 16.8l5 5M76.2 54.2l5 5M38.8 59.2l5-5M76.2 21.8l5-5" />
    </g>
    <circle cx="60" cy="38" r="14" fill="#f2a93b" />
  </g>
  <path class="wl-cloud" fill="url(#weather-loop-cloud)" d="M27 70h40a15 15 0 0 0 1.5-29.9A20 20 0 0 0 30.2 44 13 13 0 0 0 27 70z" />
  <g class="wl-snow" fill="#6f9fcc">
    <circle class="wl-flake" cx="34" cy="78" r="3.6" />
    <circle class="wl-flake" cx="46" cy="81" r="3.6" />
    <circle class="wl-flake" cx="58" cy="78" r="3.6" />
    <circle class="wl-flake" cx="68" cy="81" r="3.6" />
  </g>
  <g class="wl-rain" stroke="#3d82c4" stroke-width="3.5" stroke-linecap="round">
    <path class="wl-drop" d="M38 76l-2 6" />
    <path class="wl-drop" d="M50 78l-2 6" />
    <path class="wl-drop" d="M62 76l-2 6" />
  </g>
</svg>`;

export const WEATHER_LOOP_ICON_CSS = `
.weather-loop { overflow: visible; }
.weather-loop * { transform-box: fill-box; transform-origin: center; }
.wl-cloud {
  filter: drop-shadow(0 6px 12px rgba(20, 32, 43, 0.22));
  animation: wl-cloud 6s ease-in-out infinite;
}
.wl-sun { animation: wl-sun 6s ease-in-out infinite; }
.wl-rays { animation: wl-spin 9s linear infinite; }
.wl-snow { animation: wl-snow 6s ease-in-out infinite; }
.wl-rain { animation: wl-rain 6s ease-in-out infinite; }
.wl-flake { animation: wl-flake 1.5s ease-in infinite; }
.wl-drop { animation: wl-drop 0.75s cubic-bezier(0.5, 0, 1, 1) infinite; }
.wl-flake:nth-child(2), .wl-drop:nth-child(2) { animation-delay: -0.5s; }
.wl-flake:nth-child(3) { animation-delay: -1s; }
.wl-flake:nth-child(4), .wl-drop:nth-child(3) { animation-delay: -0.25s; }
@keyframes wl-snow {
  0%, 22% { opacity: 1; }
  28%, 94% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes wl-rain {
  0%, 22% { opacity: 0; }
  28%, 46% { opacity: 1; }
  52%, 100% { opacity: 0; }
}
@keyframes wl-sun {
  0%, 44% { opacity: 0; transform: translate(-10px, 12px) scale(0.55); }
  56%, 84% { opacity: 1; transform: translate(0, 0) scale(1); }
  90%, 100% { opacity: 0; transform: translate(-10px, 12px) scale(0.55); }
}
@keyframes wl-cloud {
  0%, 70% { opacity: 1; transform: translate(0, 0) scale(1); }
  79%, 88% { opacity: 0; transform: translate(34px, 6px) scale(0.85); }
  96%, 100% { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes wl-spin { to { transform: rotate(360deg); } }
@keyframes wl-flake {
  0% { opacity: 0; transform: translate(0, -6px) rotate(0deg); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translate(3px, 18px) rotate(90deg); }
}
@keyframes wl-drop {
  0% { opacity: 0; transform: translate(0, -6px); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translate(-4px, 18px); }
}
@media (prefers-reduced-motion: reduce) {
  .weather-loop, .weather-loop * { animation: none !important; }
  /* Hold on the partly-cloudy frame: sun behind the cloud, no weather. */
  .wl-snow, .wl-rain { opacity: 0; }
}
`;

/** Placeholders in index.html that vite.config.ts fills with the two above. */
export const WEATHER_LOOP_CSS_SLOT = "<!-- weather-loop-icon:css -->";
export const WEATHER_LOOP_SVG_SLOT = "<!-- weather-loop-icon:svg -->";

export function createWeatherLoopIcon(doc: Document = document): SVGSVGElement {
  const tpl = doc.createElement("template");
  tpl.innerHTML = WEATHER_LOOP_ICON_SVG;
  return tpl.content.firstElementChild as SVGSVGElement;
}
