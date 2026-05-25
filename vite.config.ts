import { defineConfig } from "vite";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ["maplibre-gl"],
          deckgl: ["@deck.gl/core", "@deck.gl/layers", "@deck.gl/mapbox"],
          luma: ["@luma.gl/core", "@luma.gl/engine", "@luma.gl/webgl"],
          weatherlayers: ["weatherlayers-gl"],
        },
      },
    },
  },
});
