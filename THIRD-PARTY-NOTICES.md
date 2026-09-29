# Third-party notices

Mímir bundles or displays material from the projects below. Licences that
require their notice to travel with the work are reproduced in full.

---

## Weather symbols — Yr

The weather condition icons (`public/weather-icons/`) are the Yr weather
symbols © 2015 Yr/NRK (Yr is a joint service of the Norwegian Meteorological
Institute and NRK), licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
The originals are at [nrkno/yr-weather-symbols](https://github.com/nrkno/yr-weather-symbols).

Mímir ships them unmodified: the SVGs and the 48 px PNGs as distributed in the
`@yr/weather-symbols` package (`dist/png/48/` for the PNGs).

Credited in the app's map info panel as "Weather icons © Yr/NRK, CC BY 4.0",
with links to the source and the licence, as CC BY 4.0 requires.

Older copies of these symbols, including the `@yr/weather-symbols` package and
MET Norway's [metno/weathericons](https://github.com/metno/weathericons) mirror,
still say MIT. Upstream relicensed from MIT to CC BY 4.0 on 2023-09-25, so the
upstream LICENSE is authoritative. The same symbols are also inlined in the
vendored `bel-meteogram` widget, whose bundle carries its own attribution
banner.

---

## Basemap — MapTiler and OpenStreetMap

Vector tiles and style are served by [MapTiler](https://www.maptiler.com/);
the underlying map data is © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, licensed under the Open Database License (ODbL).

Credited in the app's map info panel, as both providers' terms require.

---

## Place names

Settlement names are built from public-domain sources by
`scripts/build-places.mjs`; no attribution is required.

---

Runtime dependencies (MapLibre GL, deck.gl, WeatherLayers GL and others) carry
their own licences in `node_modules/*/LICENSE`; none of them require a notice in
the shipped UI.
