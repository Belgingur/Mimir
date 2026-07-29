# Contributing to Mímir

Thanks for your interest in contributing.

## Development setup

Node **26+** is required (see `.nvmrc` and `engines` in `package.json`).

```bash
nvm use            # or: nvm install
npm install        # runs patch-package via postinstall
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc -b && vite build
npm test           # vitest
npm run lint       # eslint
```

Copy `.env.example` to `.env` and set `VITE_BELGINGUR_BASE_URL` to point at a
forecast backend. The bundled sample dataset under `public/forecast-data/`
lets the app run without one.

## Before opening a pull request

- `npm run build`, `npm test` and `npm run lint` must pass. CI runs all of
  these plus `npm run meteogram:check` on every PR.
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Add or update tests for behaviour changes; the suite lives in `tests/`.

## The meteogram widget

The forecast panel is rendered by the `<bel-meteogram>` web component from
[github.com/Belgingur/meteogram](https://github.com/Belgingur/meteogram),
vendored into [`src/vendor/bel-meteogram/`](src/vendor/bel-meteogram/) and
pinned to a tagged release. Don't hand-edit the vendored bundle — change it
upstream, cut a release, then update `manifest.json` and run
`npm run meteogram:sync`. CI's `meteogram:check` fails if the committed copy
drifts from the pinned checksum. See that directory's README for details.
