import { defineConfig } from "vite";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) requires the function form of manualChunks; the
        // former object form silently broke on the v7→v8 bump.
        manualChunks(id: string) {
          if (id.includes("node_modules/maplibre-gl")) return "maplibre";
          if (id.includes("node_modules/@deck.gl/")) return "deckgl";
          if (id.includes("node_modules/@luma.gl/")) return "luma";
          if (id.includes("node_modules/weatherlayers-gl")) return "weatherlayers";
          return undefined;
        },
      },
    },
  },
});
