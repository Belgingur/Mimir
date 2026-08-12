# Vendored: bel-meteogram

`bel-meteogram.js` is the built, dependency-free ES module of the
`<bel-meteogram>` web component from
[github.com/Belgingur/meteogram](https://github.com/Belgingur/meteogram).
Desktop (≥900px) uses the map-panel layout: a draggable panel with a yr-style
meteogram, a fullscreen overlay, and `mimirMapPanelState` persistence shared
with Mimir.

It is vendored (rather than an npm dependency) so `npm ci` works in CI and from
a fresh clone offline, and so the app has no runtime dependency on a bundle
served elsewhere.

## Pinning

The exact upstream release is recorded in [`manifest.json`](./manifest.json):
the release `tag`, the source `commit`, and the `sha256` of the bundle. CI runs
`npm run meteogram:check`, which fails the build if `bel-meteogram.js` drifts
from that checksum.

### Currently vendored: an unreleased build

`manifest.json` presently records `tag: "unreleased"` — the committed bundle is
a **local build** of `Belgingur/meteogram@542eb9f` (branch
`feat/unified-chart-geometry`, on top of the `v0.1.3` release), vendored ahead
of a release so the chart-geometry work can be tested on real devices.

What that changes:

- `npm run meteogram:check` still passes. It only compares the committed file
  against `manifest.sha256`, which is the local build's hash.
- **`npm run meteogram:sync` cannot restore this file.** It downloads
  `releases/download/<tag>/<asset>`, and there is no such release to download.
  Running it will fail until the release is cut.

To return to normal: publish the release upstream, then set `version`, `tag`,
`commit` and `sha256` to the published values, drop the `unreleased` block from
`manifest.json`, and run `npm run meteogram:sync` to confirm the downloaded
asset matches.

## Updating to a new widget release

1. Cut a release of `Belgingur/meteogram` (its release notes publish the built
   `bel-meteogram.js` and its sha256).
2. Edit `manifest.json` here — set `version`, `tag`, `commit`, and `sha256` to
   the new release.
3. Run `npm run meteogram:sync`. It downloads the pinned release asset, verifies
   the checksum matches `manifest.json`, and writes `bel-meteogram.js`.
4. Update `bel-meteogram.d.ts` if the widget's public surface changed — it is
   hand-written (attributes/events live in the widget's `src/bel-meteogram.ts`).

`bel-meteogram.d.ts` is not generated; keep it in sync manually.
