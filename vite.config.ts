import { execFileSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import {
  COMMIT_ENV_VAR,
  COMMIT_META_NAME,
  resolveBuildCommit,
  versionJson,
  type GitState,
} from "./src/lib/buildInfo";
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

/** Ask git which commit is checked out, or null when git can't tell us (a
 *  build from a tarball, or with no git installed). */
function readGitState(): GitState | null {
  const git = (...args: string[]) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    const shortSha = git("rev-parse", "--short", "HEAD").trim();
    const dirty = git("status", "--porcelain", "--untracked-files=no").trim() !== "";
    return { shortSha, dirty };
  } catch {
    return null;
  }
}

/** Record which commit a production build came from: a meta tag in
 *  index.html and a version.json beside it. See src/lib/buildInfo.ts. */
const buildCommitInfo = (): Plugin => {
  let commit = "unknown";
  return {
    name: "mimir-build-commit",
    apply: "build",
    buildStart() {
      commit = resolveBuildCommit(readGitState(), process.env[COMMIT_ENV_VAR]);
    },
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: COMMIT_META_NAME, content: commit }, injectTo: "head" }];
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: versionJson(commit, new Date()) });
    },
  };
};

export default defineConfig({
  plugins: [weatherLoopIcon(), buildCommitInfo()],
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
