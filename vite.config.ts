import { defineConfig, type Plugin } from "vite";
import {
  WEATHER_LOOP_CSS_SLOT,
  WEATHER_LOOP_ICON_CSS,
  WEATHER_LOOP_ICON_SVG,
  WEATHER_LOOP_SVG_SLOT,
} from "./src/lib/weatherLoopIcon";

/** Write the animated weather icon into index.html, so the boot splash has it
 *  in the first paint with no JavaScript, from the same source the in-app
 *  loading overlay uses. */
const weatherLoopIcon = (): Plugin => ({
  name: "mimir-weather-loop-icon",
  transformIndexHtml(html) {
    for (const slot of [WEATHER_LOOP_CSS_SLOT, WEATHER_LOOP_SVG_SLOT]) {
      if (!html.includes(slot)) {
        throw new Error(`index.html lost its ${slot} placeholder`);
      }
    }
    return html
      .replace(WEATHER_LOOP_CSS_SLOT, `<style>${WEATHER_LOOP_ICON_CSS}</style>`)
      .replace(WEATHER_LOOP_SVG_SLOT, WEATHER_LOOP_ICON_SVG);
  },
});

export default defineConfig({
  plugins: [weatherLoopIcon()],
  define: {
    global: "globalThis",
  },
  build: {
    rolldownOptions: {
      output: {
        // rolldown's own grouping. The manualChunks compatibility shim it
        // replaces ignored some of the names it was given: luma.gl was always
        // folded into deckgl, and the preload-helper split below had no effect.
        codeSplitting: {
          groups: [
            // Vite's dynamic-import preload helper is shared by the entry and
            // the lazy chunks. Left to itself it lands in the deckgl chunk,
            // and the entry importing it from there made the browser fetch
            // and evaluate all of deck.gl before main.ts could start the map.
            { name: "preload-helper", test: /vite\/preload-helper/, priority: 30 },
            { name: "maplibre", test: /node_modules[\\/]maplibre-gl[\\/]/, priority: 20 },
            // luma.gl stays with deck.gl, as it has in every build so far.
            { name: "deckgl", test: /node_modules[\\/]@(deck|luma)\.gl[\\/]/, priority: 20 },
            { name: "weatherlayers", test: /node_modules[\\/]weatherlayers-gl[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
});
