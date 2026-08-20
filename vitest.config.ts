import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // The timeline renders its labels on the viewer's own clock, so run the
    // suite in a fixed non-UTC zone: on a UTC machine a reverted getUTCDate()
    // would pass every assertion and the regression would ship unnoticed.
    env: { TZ: "America/Sao_Paulo" },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/vendor/**",
        "src/types/**",
        "src/style.css",
        "src/main.ts",
      ],
    },
  },
});
