# Third-party notices

Mímir bundles or displays material from the projects below. Licences that
require their notice to travel with the work are reproduced in full.

---

## Weather symbols — Yr

The weather condition icons (`public/weather-icons/`) come from
[`@yr/weather-symbols`](https://github.com/YR/weather-symbols), published by Yr
(a joint service of the Norwegian Meteorological Institute and NRK).

Credited in the app's map info panel as "Weather icons © Yr (MIT)".

```
The MIT License (MIT)

Copyright (c) 2015-2017 Yr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

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
