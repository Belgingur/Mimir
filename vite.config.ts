import { defineConfig } from "vite";

export default defineConfig({
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
