/*!
 * bel-meteogram — Belgingur meteogram web component
 * Copyright (c) 2026 Belgingur. Licensed under the MIT License.
 *
 * Bundled weather symbols: Yr weather symbols (c) 2015 Yr/NRK, modified
 * (re-exported, recoloured and renamed to numeric symbol codes).
 * Licensed under CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
 * Originals: https://github.com/nrkno/yr-weather-symbols
 *
 * Bundled icon: Lucide "award" — https://lucide.dev/icons/award
 * ISC License
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
function l0(e, t, i, n) {
  const o = Math.PI / 180, s = (e + i) / 2 * o, a = (i - e) * o;
  let l = (n - t) * o;
  l > Math.PI && (l -= 2 * Math.PI), l < -Math.PI && (l += 2 * Math.PI);
  const r = l * Math.cos(s);
  return Math.hypot(r, a) * 6371;
}
function K0(e) {
  return e.apiUrl ? e.apiUrl : `${new URL(import.meta.url).origin}/api/v2/widget/meteo/config/${e.clientName}`;
}
const X0 = 3600 * 1e3, R2 = 2e4;
async function r0(e, t, i = {}, n) {
  const o = new AbortController();
  let s = !1;
  const a = setTimeout(() => {
    s = !0, o.abort();
  }, R2), l = () => o.abort(n?.reason);
  n?.aborted ? l() : n?.addEventListener("abort", l, { once: !0 });
  try {
    const r = await fetch(e, { ...i, signal: o.signal });
    if (!r.ok) throw new Error(`${t}: HTTP ${r.status}`);
    return { json: await r.json(), response: r };
  } catch (r) {
    throw s ? new Error(`${t}: timed out after ${R2 / 1e3} s`) : r;
  } finally {
    clearTimeout(a), n?.removeEventListener("abort", l);
  }
}
function W2(e, t) {
  return t ? new Promise((i, n) => {
    const o = () => n(J0(t));
    if (t.aborted) return o();
    t.addEventListener("abort", o, { once: !0 }), e.then(i, n).finally(() => t.removeEventListener("abort", o));
  }) : e;
}
function J0(e) {
  return e.reason ?? new DOMException("The operation was aborted.", "AbortError");
}
const r2 = /* @__PURE__ */ new Map();
function c0(e, t, i) {
  const n = r2.get(e);
  if (n && Date.now() - n.at < X0)
    return W2(n.json, i);
  const o = r0(e, t).then((s) => s.json);
  return r2.set(e, { at: Date.now(), json: o }), o.catch(() => {
    r2.get(e)?.json === o && r2.delete(e);
  }), W2(o, i);
}
async function Z0(e, t) {
  return (await c0(K0(e), "config", t)).forecasts;
}
function Q0(e, t, i) {
  return !e || !t ? "" : e === "schedule" ? `${e}/${t}/${i}` : `${e}/${t}`;
}
function ee(e, t) {
  return t ? e.find((i) => i.id === t) : e[0];
}
function te(e, t) {
  return c0(e, "forecast", t);
}
function y2(e, t, i, n, o) {
  const s = n !== void 0 && Number.isFinite(n) ? `?duration=${n}h` : "", a = o && d0(e) ? `station/${encodeURIComponent(o)}` : `latlon/${t},${i}`;
  return e.station_data_url.replace("[station]", a).replace("meteogram.xml", `meteogram.json${s}`);
}
function d0(e) {
  return !e.forecast_id?.startsWith("upstream/");
}
const ie = 1;
function oe(e, t, i) {
  let n = null, o = ie;
  for (const s of e) {
    if (!s.extra?.ref) continue;
    const a = l0(t, i, s.lat, s.lon);
    a <= o && (n = s, o = a);
  }
  return n;
}
async function w2(e, t, i) {
  const n = new Headers();
  t.user && t.password && n.set("Authorization", "Basic " + btoa(`${t.user}:${t.password}`));
  const { json: o, response: s } = await r0(
    e,
    "meteogram",
    { headers: n },
    i
  ), a = s.headers.get("Last-Modified");
  return {
    data: o,
    lastModified: a ? new Date(a) : null
  };
}
function se(e, t, i, n = /* @__PURE__ */ new Date()) {
  const o = N2(e.meta?.last_modified) ?? t ?? n;
  return { analysisTime: N2(e.meta?.analysis) ?? (i !== void 0 ? new Date(i) : o), lastModified: o };
}
function N2(e) {
  if (!e) return null;
  const t = new Date(e);
  return isNaN(t.getTime()) ? null : t;
}
const w = {
  /** Temperature at or above 0 °C — also the line, the dots and the swatch. */
  temp: "#C81D25",
  /** Temperature below 0 °C. */
  tempCold: "#2E6FB2",
  /** A reading the model does not carry. Also the axis tick labels, so it has
      to pass 4.5:1 as text: the old #94A2AC was 2.6:1 on white. */
  none: "#5E6B76",
  /** Precipitation: bars and swatch. */
  precip: "#3D82C4",
  /** Precipitation as TEXT (values, ticks): the bar blue is 4.0:1 on white,
      short of 4.5:1, so type uses this darker step. Shifted toward cyan so
      it cannot be mistaken for `tempCold`, the sub-zero blue. */
  precipText: "#146C94",
  /** The lighter upper bound of a precipitation range. */
  precipMax: "#A8CBEA",
  /** Wind speed. */
  wind: "#3E8E63",
  /** Wind speed as TEXT, for the same reason as `precipText`. */
  windText: "#2F7C55",
  /** Gusts — the same hue, lightened, always dashed. Held at 3:1 on white
      (non-text minimum); the old #7FB394 was 2.4:1. */
  gust: "#5E9E78",
  /** Direction arrows, hour and day labels: present but not a reading of its
      own. 5.4:1 on white, 4.7:1 on the frost page background. */
  neutral: "#5E6B76",
  /** The "now" marker line — the same accent on the phone and desktop charts.
      3.1:1 on white, the non-text minimum; the old #F0A32F was 2.1:1. */
  now: "#D17F00"
}, ne = {
  nextHours: (e) => `Næstu ${e} klst.`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "dagur" : "dagar"} · til ${t}`,
  swipe: "strjúktu til hliðar →",
  legTemp: "Hiti (°C)",
  legPrecip: "Úrkoma (mm)",
  legPmax: "Hámarksúrkoma (mm)",
  legWind: "Vindur (m/s)",
  legGust: "Vindhviða (m/s)",
  laneTemp: "Hiti",
  lanePrecip: "Úrkoma",
  laneWind: "Vindur",
  loading: "Sæki spá…",
  error: "Ekki tókst að sækja spá",
  retry: "Reyna aftur",
  close: "Loka",
  weekdays: ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."],
  months: [
    "janúar",
    "febrúar",
    "mars",
    "apríl",
    "maí",
    "júní",
    "júlí",
    "ágúst",
    "september",
    "október",
    "nóvember",
    "desember"
  ],
  compass: ["N", "NA", "A", "SA", "S", "SV", "V", "NV"],
  dayLabel: (e, t, i) => `${e} ${t}. ${i}`,
  dateLabel: (e, t) => `${e}. ${t}`,
  now: "Veðrið núna",
  feels: "Líðan",
  precip: "Úrkoma",
  wind: "Vindur",
  table: "Tafla",
  graph: "Graf",
  both: "Bæði",
  today: "Í dag",
  tomorrow: "Á morgun",
  timeCol: "Kl.",
  tempCol: "Hiti",
  settings: "Stillingar",
  forecastModel: "Spálíkan",
  language: "Tungumál",
  location: "Staðsetning",
  search: "Leita að stað eða veðurstöð…",
  analysis: "Greiningartími",
  lastUpdate: "Síðast uppfært",
  next48: "Næstu 48 klst.",
  axTemp: "Hiti (°C)",
  axWind: "Vindur (m/s)",
  fullscreen: "Fullskjár",
  exitFullscreen: "Loka fullskjá",
  scrubSlider: "Tími spár",
  minimize: "Minnka",
  expand: "Stækka",
  resize: "Breyta stærð",
  correctedDetail: (e, t) => `Leiðrétt m.v. mælingar á stöðinni ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `${e}: spá fyrir veðurstöð ${t} km frá miðbænum`,
  noForecastForTime: "Engin spá fyrir þennan tíma",
  monthsShort: [
    "jan",
    "feb",
    "mar",
    "apr",
    "maí",
    "jún",
    "júl",
    "ágú",
    "sep",
    "okt",
    "nóv",
    "des"
  ],
  metaLine: (e, t) => `Greiningartími: ${e} · Síðast uppfært: ${t}`,
  decimal: ","
}, ae = {
  nextHours: (e) => `Next ${e} hours`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "day" : "days"} · to ${t}`,
  swipe: "swipe sideways →",
  legTemp: "Temp (°C)",
  legPrecip: "Precip (mm)",
  legPmax: "Max precip (mm)",
  legWind: "Wind (m/s)",
  legGust: "Gusts (m/s)",
  laneTemp: "Temp",
  lanePrecip: "Precip",
  laneWind: "Wind",
  loading: "Loading forecast…",
  error: "Could not load the forecast",
  retry: "Retry",
  close: "Close",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ],
  compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  dayLabel: (e, t, i) => `${e} ${t} ${i}`,
  dateLabel: (e, t) => `${e} ${t}`,
  now: "The weather now",
  feels: "Feels like",
  precip: "Precipitation",
  wind: "Wind",
  table: "Table",
  graph: "Graph",
  both: "Both",
  today: "Today",
  tomorrow: "Tomorrow",
  timeCol: "Time",
  tempCol: "Temp",
  settings: "Settings",
  forecastModel: "Forecast model",
  language: "Language",
  location: "Location",
  search: "Search for a place or station…",
  analysis: "Analysis",
  lastUpdate: "Last update",
  next48: "Next 48 hours",
  axTemp: "Temp (°C)",
  axWind: "Wind (m/s)",
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
  scrubSlider: "Forecast time",
  minimize: "Minimize",
  expand: "Expand",
  resize: "Resize",
  correctedDetail: (e, t) => `Corrected against observations at ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `Forecast for the weather station ${t} km from ${e} centre`,
  noForecastForTime: "No forecast for this time",
  monthsShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  metaLine: (e, t) => `Analysis: ${e} · Last update: ${t}`,
  decimal: "."
}, le = {
  nextHours: (e) => `Próximas ${e} h`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "día" : "días"} · hasta ${t}`,
  swipe: "desliza de lado →",
  legTemp: "Temp. (°C)",
  legPrecip: "Precip. (mm)",
  legPmax: "Precip. máx. (mm)",
  legWind: "Viento (m/s)",
  legGust: "Rachas (m/s)",
  laneTemp: "Temp.",
  lanePrecip: "Precip.",
  laneWind: "Viento",
  loading: "Cargando pronóstico…",
  error: "No se pudo cargar el pronóstico",
  retry: "Reintentar",
  close: "Cerrar",
  weekdays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  months: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ],
  compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  dayLabel: (e, t, i) => `${e} ${t} ${i}`,
  dateLabel: (e, t) => `${e} ${t}`,
  now: "El tiempo ahora",
  feels: "Sensación",
  precip: "Precipitación",
  wind: "Viento",
  table: "Tabla",
  graph: "Gráfico",
  both: "Ambos",
  today: "Hoy",
  tomorrow: "Mañana",
  timeCol: "Hora",
  tempCol: "Temp.",
  settings: "Ajustes",
  forecastModel: "Modelo de pronóstico",
  language: "Idioma",
  location: "Ubicación",
  search: "Busca un lugar o estación…",
  analysis: "Análisis",
  lastUpdate: "Última actualización",
  next48: "Próximas 48 h",
  axTemp: "Temp. (°C)",
  axWind: "Viento (m/s)",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Salir de pantalla completa",
  scrubSlider: "Hora del pronóstico",
  minimize: "Minimizar",
  expand: "Ampliar",
  resize: "Cambiar tamaño",
  correctedDetail: (e, t) => `Corregida con observaciones en ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `Pronóstico para la estación meteorológica a ${t} km del centro de ${e}`,
  noForecastForTime: "No hay pronóstico para esta hora",
  monthsShort: [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic"
  ],
  metaLine: (e, t) => `Análisis: ${e} · Última actualización: ${t}`,
  decimal: ","
}, re = {
  nextHours: (e) => `Próximas ${e} h`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "dia" : "dias"} · até ${t}`,
  swipe: "deslize para o lado →",
  legTemp: "Temp. (°C)",
  legPrecip: "Precip. (mm)",
  legPmax: "Precip. máx. (mm)",
  legWind: "Vento (m/s)",
  legGust: "Rajadas (m/s)",
  laneTemp: "Temp.",
  lanePrecip: "Precip.",
  laneWind: "Vento",
  loading: "A carregar previsão…",
  error: "Não foi possível carregar a previsão",
  retry: "Tentar de novo",
  close: "Fechar",
  weekdays: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
  months: [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ],
  compass: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
  dayLabel: (e, t, i) => `${e} ${t} ${i}`,
  dateLabel: (e, t) => `${e} ${t}`,
  now: "O tempo agora",
  feels: "Sensação",
  precip: "Precipitação",
  wind: "Vento",
  table: "Tabela",
  graph: "Gráfico",
  both: "Ambos",
  today: "Hoje",
  tomorrow: "Amanhã",
  timeCol: "Hora",
  tempCol: "Temp.",
  settings: "Definições",
  forecastModel: "Modelo de previsão",
  language: "Idioma",
  location: "Localização",
  search: "Procurar um local ou estação…",
  analysis: "Análise",
  lastUpdate: "Última atualização",
  next48: "Próximas 48 h",
  axTemp: "Temp. (°C)",
  axWind: "Vento (m/s)",
  fullscreen: "Ecrã inteiro",
  exitFullscreen: "Sair do ecrã inteiro",
  scrubSlider: "Hora da previsão",
  minimize: "Minimizar",
  expand: "Expandir",
  resize: "Redimensionar",
  correctedDetail: (e, t) => `Corrigida com observações em ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `Previsão para a estação meteorológica a ${t} km do centro de ${e}`,
  noForecastForTime: "Sem previsão para esta hora",
  monthsShort: [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez"
  ],
  metaLine: (e, t) => `Análise: ${e} · Última atualização: ${t}`,
  decimal: ","
}, ce = {
  nextHours: (e) => `Następne ${e} godz.`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "dzień" : "dni"} · do ${t}`,
  swipe: "przesuń w bok →",
  legTemp: "Temp. (°C)",
  legPrecip: "Opad (mm)",
  legPmax: "Maks. opad (mm)",
  legWind: "Wiatr (m/s)",
  legGust: "Porywy (m/s)",
  laneTemp: "Temp.",
  lanePrecip: "Opad",
  laneWind: "Wiatr",
  loading: "Ładowanie prognozy…",
  error: "Nie udało się wczytać prognozy",
  retry: "Ponów",
  close: "Zamknij",
  weekdays: ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."],
  months: [
    "stycznia",
    "lutego",
    "marca",
    "kwietnia",
    "maja",
    "czerwca",
    "lipca",
    "sierpnia",
    "września",
    "października",
    "listopada",
    "grudnia"
  ],
  compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  dayLabel: (e, t, i) => `${e} ${t} ${i}`,
  dateLabel: (e, t) => `${e} ${t}`,
  now: "Pogoda teraz",
  feels: "Odczuwalna",
  precip: "Opady",
  wind: "Wiatr",
  table: "Tabela",
  graph: "Wykres",
  both: "Oba",
  today: "Dziś",
  tomorrow: "Jutro",
  timeCol: "Godz.",
  tempCol: "Temp.",
  settings: "Ustawienia",
  forecastModel: "Model prognozy",
  language: "Język",
  location: "Lokalizacja",
  search: "Szukaj miejsca lub stacji…",
  analysis: "Analiza",
  lastUpdate: "Ostatnia aktualizacja",
  next48: "Następne 48 godz.",
  axTemp: "Temp. (°C)",
  axWind: "Wiatr (m/s)",
  fullscreen: "Pełny ekran",
  exitFullscreen: "Zamknij pełny ekran",
  scrubSlider: "Godzina prognozy",
  minimize: "Zminimalizuj",
  expand: "Powiększ",
  resize: "Zmień rozmiar",
  correctedDetail: (e, t) => `Skorygowana według pomiarów na stacji ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `${e}: prognoza dla stacji pogodowej ${t} km od centrum`,
  noForecastForTime: "Brak prognozy na tę godzinę",
  monthsShort: [
    "sty",
    "lut",
    "mar",
    "kwi",
    "maj",
    "cze",
    "lip",
    "sie",
    "wrz",
    "paź",
    "lis",
    "gru"
  ],
  metaLine: (e, t) => `Analiza: ${e} · Ostatnia aktualizacja: ${t}`,
  decimal: ","
}, de = {
  nextHours: (e) => `Næstu ${e} tímar`,
  forecastSpan: (e, t) => `${e} ${e === 1 ? "dagur" : "dagar"} · til ${t}`,
  swipe: "strúka til viðrar →",
  legTemp: "Hiti (°C)",
  legPrecip: "Avfall (mm)",
  legPmax: "Mest avfall (mm)",
  legWind: "Vindur (m/s)",
  legGust: "Vindhviða (m/s)",
  laneTemp: "Hiti",
  lanePrecip: "Avfall",
  laneWind: "Vindur",
  loading: "Innlesur spá…",
  error: "Kundi ikki innlesa spáðuna",
  retry: "Royn aftur",
  close: "Lat aftur",
  weekdays: ["sun.", "mán.", "týs.", "mik.", "hós.", "frí.", "ley."],
  months: [
    "januar",
    "februar",
    "mars",
    "apríl",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "desember"
  ],
  compass: ["N", "NE", "E", "SE", "S", "SV", "V", "NV"],
  dayLabel: (e, t, i) => `${e} ${t}. ${i}`,
  dateLabel: (e, t) => `${e}. ${t}`,
  now: "Veðrið nú",
  feels: "Kennist sum",
  precip: "Avfall",
  wind: "Vindur",
  table: "Talva",
  graph: "Grafur",
  both: "Bæði",
  today: "Í dag",
  tomorrow: "Í morgin",
  timeCol: "Kl.",
  tempCol: "Hiti",
  settings: "Stillingar",
  forecastModel: "Spálíkan",
  language: "Mál",
  location: "Staður",
  search: "Leita eftir stað ella veðurstöð…",
  analysis: "Greiningartíð",
  lastUpdate: "Seinast dagført",
  next48: "Næstu 48 tímar",
  axTemp: "Hiti (°C)",
  axWind: "Vindur (m/s)",
  fullscreen: "Fullur skermur",
  exitFullscreen: "Lat fullan skerm aftur",
  scrubSlider: "Spátíð",
  minimize: "Minka",
  expand: "Stækka",
  resize: "Broyt stødd",
  correctedDetail: (e, t) => `Rættað eftir mátingum á støðini ${e}${t ? `: ${t.toLowerCase()}` : ""}`,
  stationPlace: (e, t) => `${e}: veðurforsøgn fyri veðurstøðina ${t} km frá miðbýnum`,
  noForecastForTime: "Eingin spá fyri hesa tíðina",
  monthsShort: [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des"
  ],
  metaLine: (e, t) => `Greiningartíð: ${e} · Seinast dagført: ${t}`,
  decimal: ","
}, j2 = { is: ne, en: ae, fo: de, pl: ce, es: le, pt: re }, pe = [
  { code: "is", name: "Íslenska" },
  { code: "en", name: "English" },
  { code: "fo", name: "Føroyskt" },
  { code: "pl", name: "Polski" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" }
];
function W(e, t, i) {
  const n = e.toFixed(t);
  return i.decimal === "." ? n : n.replace(".", i.decimal);
}
function p0(e) {
  return j2[e] ?? j2.is;
}
const he = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2301d__01d__a)'%3e%3cpath%20fill='url(%2301d__01d__b)'%20d='M75.6%2056.9L91%2050l-15.4-6.8%209.8-13.7-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.8-16.7%2016.8%201.7-9.9-13.5z'/%3e%3cpath%20fill='%23FFD348'%20d='M28.284%2062.509c6.901%2011.908%2022.205%2016.01%2034.208%209.206C74.496%2064.91%2078.497%2049.5%2071.695%2037.491c-6.902-11.908-22.206-16.01-34.21-9.206-11.901%206.905-16.002%2022.315-9.2%2034.224z'/%3e%3cpath%20fill='url(%2301d__01d__c)'%20d='M31.8%2060.493c5.798%209.998%2018.695%2013.497%2028.693%207.699%209.998-5.799%2013.497-18.696%207.699-28.694C62.393%2029.5%2049.496%2026%2039.498%2031.799%2029.5%2037.6%2026%2050.496%2031.799%2060.493z'/%3e%3c/g%3e%3cdefs%3e%3cradialGradient%20id='01d__01d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3clinearGradient%20id='01d__01d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3cclipPath%20id='01d__01d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e", ue = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cpath%20fill='url(%2301n__01n__a)'%20d='M51.4%2021c2.4%204.2%203.9%209.1%203.9%2014.3%200%2015.8-12.8%2028.6-28.6%2028.6-1.3%200-2.5-.1-3.7-.3C28%2072.2%2037.2%2078%2047.7%2078c15.8%200%2028.6-12.8%2028.6-28.6%200-14.6-10.8-26.6-24.9-28.4z'/%3e%3cdefs%3e%3clinearGradient%20id='01n__01n__a'%20x1='34.425'%20x2='71.181'%20y1='75.492'%20y2='31.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e", fe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302d__02d__a)'%3e%3cpath%20fill='url(%2302d__02d__b)'%20fill-rule='evenodd'%20d='M79.698%2037.47L85.4%2029.5l-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.35-12.524H53.466c-3.222%200-6.258-1.177-8.55-3.408-2.417-2.292-3.718-5.39-3.78-8.737v-.123c0-3.16%201.24-6.135%203.47-8.365a12.25%2012.25%200%20018.117-3.718c1.673-2.417%204.461-3.842%207.497-3.842h.682C64.248%2039.974%2069.762%2037%2075.649%2037c1.384%200%202.741.163%204.05.47z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M60.178%2072.876c-11.59%205.094-25.43.788-31.894-10.367-6.802-11.909-2.701-27.32%209.202-34.224%2011.991-6.798%2027.276-2.71%2034.188%209.17a18.36%2018.36%200%2000-10.772%207.228h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.765%2011.765%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737%202.292%202.23%205.328%203.408%208.55%203.408h6.712z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__c)'%20fill-rule='evenodd'%20d='M46.356%2070.665C40.454%2069.61%2035.027%2066.058%2031.8%2060.493c-5.798-9.998-2.3-22.895%207.699-28.694%209.774-5.669%2022.32-2.45%2028.294%207.038a18.394%2018.394%200%2000-6.89%205.846h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.766%2011.766%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737.452.44.934.84%201.44%201.197z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__d)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302d__02d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.023-.02.01-.002.017.005.023.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02d__02d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02d__02d__d'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='02d__02d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='02d__02d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02d__02d__e'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1382'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302n__02n__a)'%3e%3cpath%20fill='url(%2302n__02n__b)'%20fill-rule='evenodd'%20d='M48.3%2032.3c0-5.2-1.5-10.1-3.9-14.3%2011.477%201.465%2020.767%209.688%2023.827%2020.57a18.396%2018.396%200%2000-7.461%206.113h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718A11.765%2011.765%200%200041%2060.608v.123c.062%203.346%201.363%206.445%203.78%208.737%201.917%201.866%204.355%202.995%206.986%203.314A28.525%2028.525%200%200140.7%2075C30.2%2075%2021%2069.2%2016%2060.6c1.2.2%202.4.3%203.7.3%2015.8%200%2028.6-12.8%2028.6-28.6z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302n__02n__c)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302n__02n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.022-.02.008-.002.016.005.022.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02n__02n__b'%20x1='27.425'%20x2='64.181'%20y1='72.492'%20y2='28.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02n__02n__c'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='02n__02n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02n__02n__d'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1384'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ge = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303d__03d__a)'%3e%3cpath%20fill='url(%2303d__03d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303d__03d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03d__03d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03d__03d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='03d__03d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='03d__03d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03d__03d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1385'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", xe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303n__03n__a)'%3e%3cpath%20fill='url(%2303n__03n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303n__03n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303n__03n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03n__03n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03n__03n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='03n__03n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03n__03n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1387'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ve = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2304__04__a)'%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2304__04__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2304__04__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='04__04__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='04__04__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='04__04__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1388'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305d__05d__a)'%3e%3cpath%20fill='url(%2305d__05d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305d__05d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05d__05d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05d__05d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='05d__05d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='05d__05d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05d__05d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1389'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", _e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305n__05n__a)'%3e%3cpath%20fill='url(%2305n__05n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305n__05n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305n__05n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05n__05n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05n__05n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='05n__05n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05n__05n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1391'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ye = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307d__07d__a)'%3e%3cpath%20fill='url(%2307d__07d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307d__07d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07d__07d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07d__07d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='07d__07d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='07d__07d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07d__07d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1395'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", we = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307n__07n__a)'%3e%3cpath%20fill='url(%2307n__07n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307n__07n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307n__07n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07n__07n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07n__07n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='07n__07n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07n__07n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1397'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", $e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308d__08d__a)'%3e%3cpath%20fill='url(%2308d__08d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308d__08d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08d__08d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08d__08d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='08d__08d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='08d__08d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08d__08d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1398'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308n__08n__a)'%3e%3cpath%20fill='url(%2308n__08n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308n__08n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308n__08n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08n__08n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08n__08n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='08n__08n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08n__08n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1400'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ke = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2309__09__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2309__09__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2309__09__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='09__09__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='09__09__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='09__09__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1401'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2310__10__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2310__10__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2310__10__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='10__10__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='10__10__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='10__10__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1402'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Se = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2312__12__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2312__12__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2312__12__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='12__12__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='12__12__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='12__12__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1404'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ze = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2313__13__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2313__13__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2313__13__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='13__13__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='13__13__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='13__13__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1405'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ce = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340d__40d__a)'%3e%3cpath%20fill='url(%2340d__40d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340d__40d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40d__40d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40d__40d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='40d__40d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='40d__40d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40d__40d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1439'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Te = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340n__40n__a)'%3e%3cpath%20fill='url(%2340n__40n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340n__40n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340n__40n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40n__40n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40n__40n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='40n__40n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40n__40n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1441'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Fe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341d__41d__a)'%3e%3cpath%20fill='url(%2341d__41d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341d__41d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41d__41d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41d__41d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='41d__41d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='41d__41d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41d__41d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1442'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ee = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341n__41n__a)'%3e%3cpath%20fill='url(%2341n__41n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341n__41n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341n__41n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41n__41n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41n__41n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='41n__41n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41n__41n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1444'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ae = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342d__42d__a)'%3e%3cpath%20fill='url(%2342d__42d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342d__42d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42d__42d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42d__42d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='42d__42d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='42d__42d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42d__42d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1445'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Pe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342n__42n__a)'%3e%3cpath%20fill='url(%2342n__42n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342n__42n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342n__42n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42n__42n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42n__42n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='42n__42n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42n__42n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1447'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Le = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343d__43d__a)'%3e%3cpath%20fill='url(%2343d__43d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343d__43d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43d__43d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43d__43d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='43d__43d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='43d__43d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43d__43d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1448'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ue = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343n__43n__a)'%3e%3cpath%20fill='url(%2343n__43n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343n__43n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343n__43n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43n__43n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43n__43n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='43n__43n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43n__43n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1450'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ge = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344d__44d__a)'%3e%3cpath%20fill='url(%2344d__44d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344d__44d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44d__44d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44d__44d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='44d__44d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='44d__44d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44d__44d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1451'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", De = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344n__44n__a)'%3e%3cpath%20fill='url(%2344n__44n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344n__44n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344n__44n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44n__44n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44n__44n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='44n__44n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44n__44n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1453'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", He = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345d__45d__a)'%3e%3cpath%20fill='url(%2345d__45d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345d__45d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45d__45d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45d__45d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='45d__45d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='45d__45d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45d__45d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1454'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Oe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345n__45n__a)'%3e%3cpath%20fill='url(%2345n__45n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345n__45n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345n__45n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45n__45n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45n__45n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='45n__45n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45n__45n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1456'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ie = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2346__46__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2346__46__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2346__46__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='46__46__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='46__46__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='46__46__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1457'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Re = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2347__47__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2347__47__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2347__47__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='47__47__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='47__47__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='47__47__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1458'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", We = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2348__48__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2348__48__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2348__48__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='48__48__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='48__48__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='48__48__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1459'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ne = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2349__49__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2349__49__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2349__49__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='49__49__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='49__49__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='49__49__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1460'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", je = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2350__50__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2350__50__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2350__50__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='50__50__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='50__50__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='50__50__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1461'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", qe = /* @__PURE__ */ Object.assign({
  "./assets/symbols/01d.svg": he,
  "./assets/symbols/01n.svg": ue,
  "./assets/symbols/02d.svg": fe,
  "./assets/symbols/02n.svg": me,
  "./assets/symbols/03d.svg": ge,
  "./assets/symbols/03n.svg": xe,
  "./assets/symbols/04.svg": ve,
  "./assets/symbols/05d.svg": be,
  "./assets/symbols/05n.svg": _e,
  "./assets/symbols/07d.svg": ye,
  "./assets/symbols/07n.svg": we,
  "./assets/symbols/08d.svg": $e,
  "./assets/symbols/08n.svg": Me,
  "./assets/symbols/09.svg": ke,
  "./assets/symbols/10.svg": Be,
  "./assets/symbols/12.svg": Se,
  "./assets/symbols/13.svg": ze,
  "./assets/symbols/40d.svg": Ce,
  "./assets/symbols/40n.svg": Te,
  "./assets/symbols/41d.svg": Fe,
  "./assets/symbols/41n.svg": Ee,
  "./assets/symbols/42d.svg": Ae,
  "./assets/symbols/42n.svg": Pe,
  "./assets/symbols/43d.svg": Le,
  "./assets/symbols/43n.svg": Ue,
  "./assets/symbols/44d.svg": Ge,
  "./assets/symbols/44n.svg": De,
  "./assets/symbols/45d.svg": He,
  "./assets/symbols/45n.svg": Oe,
  "./assets/symbols/46.svg": Ie,
  "./assets/symbols/47.svg": Re,
  "./assets/symbols/48.svg": We,
  "./assets/symbols/49.svg": Ne,
  "./assets/symbols/50.svg": je
});
function t2(e) {
  return e ? qe[`./assets/symbols/${e}.svg`] ?? "" : "";
}
const A2 = {
  colW: 34,
  // The value axes are pinned strips outside the scroller, so the plot needs no
  // left gutter of its own; `padL` is a plain leading pad and stays 0.
  padL: 0,
  padR: 14,
  height: 358,
  tempTop: 44,
  tempBottom: 140,
  precipBase: 226,
  precipPerMm: 28,
  // Reaches past the divider into the foot of the temperature lane, the way the
  // desktop chart shares the temperature baseline. The two scales sit on
  // opposite strips (temperature left, precipitation right) so their labels
  // never meet, and the temperature line and its haloed labels draw over the
  // bars. A dry week draws exactly as before: the millimetres are the same size.
  precipCap: 100,
  precipMaxW: 20,
  precipW: 16,
  windBase: 306,
  windSpan: 58,
  symbolY: 14,
  symbolSize: 20,
  dividers: [150, 236],
  dayTop: 14,
  dayBottom: 336,
  dayLabelY: 12,
  dayLabelShort: !1,
  tempLabelDy: -9,
  arrowY: 322,
  arrowHalf: 7,
  hourLabelY: 350,
  axisW: 30,
  rightAxisW: 22,
  axisInset: 5,
  axisFont: 10,
  dayFont: 11,
  tempFont: 11,
  hourFont: 10.5,
  scrubTop: 39,
  scrubBottom: 336,
  hasTrack: !0,
  hitY: 24,
  // 44px is the platform floor for a touch target; the old 30 was below it, and
  // this strip is the continuous-drag scrub surface. (A tap anywhere on the plot
  // also works now — see wireTapToScrub.)
  hitH: 44,
  handleR: 5.5,
  dotTempR: 4.5,
  dotWindR: 4
}, Ye = {
  colW: 27,
  padL: 0,
  padR: 12,
  height: 252,
  tempTop: 30,
  tempBottom: 104,
  precipBase: 162,
  precipPerMm: 22,
  precipCap: 46,
  precipMaxW: 16,
  precipW: 12,
  windBase: 228,
  windSpan: 54,
  symbolY: 122,
  symbolSize: 16,
  dividers: [118, 186],
  dayTop: 12,
  dayBottom: 238,
  dayLabelY: 11,
  dayLabelShort: !0,
  tempLabelDy: -8,
  arrowY: 240,
  arrowHalf: 6,
  hourLabelY: 250,
  axisW: 28,
  rightAxisW: 20,
  axisInset: 5,
  axisFont: 9.5,
  dayFont: 10.5,
  tempFont: 10,
  hourFont: 10,
  scrubTop: 18,
  scrubBottom: 238,
  hasTrack: !1,
  hitY: 6,
  hitH: 34,
  handleR: 5,
  dotTempR: 4,
  dotWindR: 3.6
};
function v2(e) {
  return e.some((t) => t.gustMs !== null);
}
const h0 = "rgba(90,112,140,0.055)";
function Ve(e) {
  const t = e.local.getUTCHours();
  return t < 5 || t >= 22;
}
function u0(e, t) {
  const i = [];
  let n = null;
  for (let o = 0; o < e.length; o++) {
    const s = Ve(e[o]);
    if (s && n === null && (n = o), (!s || o === e.length - 1) && n !== null) {
      const a = s && o === e.length - 1 ? o + 1 : o;
      i.push({ x: n * t, w: (a - n) * t }), n = null;
    }
  }
  return i;
}
function s2(e) {
  return e > 0 ? w.temp : e < 0 ? w.tempCold : w.neutral;
}
function f(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function Q(e, t, i, n, o, s, a = "start", l = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${o}" font-weight="${s}" text-anchor="${a}" font-family="Nunito, system-ui, sans-serif"${l ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function $2(e, t, i, n) {
  let o = "", s = !1;
  for (let a = 0; a < e.length; a++) {
    const l = t(e[a]);
    if (l === null) {
      s = !1;
      continue;
    }
    o += `${s ? "L" : "M"}${i(a).toFixed(1)} ${n(l).toFixed(1)} `, s = !0;
  }
  return o.trim();
}
const g2 = w.none, f0 = w.precipText, m0 = 22, Ke = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function g0(e, t) {
  let i = 0;
  for (const s of e)
    Number.isFinite(s.precipMm) && (i = Math.max(i, s.precipMm)), Number.isFinite(s.precipMaxMm) && (i = Math.max(i, s.precipMaxMm));
  if (!(i > t)) return t;
  const n = 10 ** Math.floor(Math.log10(i)), o = Ke.find((s) => s * n >= i - 1e-9) ?? 10;
  return Number((o * n).toFixed(6));
}
const Xe = 0.5;
function P2(e, t) {
  if (!(e > 0)) return 0;
  const { baseMm: i, topMm: n } = t, o = Math.max(Xe, Math.min(1, i / n));
  if (e <= i || !(n > i))
    return Math.min(1, e / i * o);
  const s = Math.log(e / i) / Math.log(n / i);
  return Math.min(1, o + (1 - o) * s);
}
const Je = [2, 1, 5, 10, 20, 50];
function x0(e, t) {
  if (!(e.topMm > 0) || !(t > 0)) return [];
  const i = Math.min(m0, t / 2) - 1e-9, n = e.topMm > e.baseMm + 1e-9, o = [];
  for (const s of [...n ? [e.topMm] : [], ...Je]) {
    if (s > e.topMm + 1e-9) continue;
    const a = P2(s, e) * t;
    o.every((l) => l.mm !== s && Math.abs(l.y - a) >= i) && o.push({ mm: s, y: a });
  }
  return o.map((s) => s.mm).sort((s, a) => s - a);
}
function Ze(e, t = 8) {
  return Math.max(2, Math.min(t, Math.floor(e / m0)));
}
const e2 = 3.5, v0 = 0.705;
function Qe(e, t) {
  const i = t.tempFont * v0, n = Math.max(t.tempTop, t.scrubTop + t.handleR), o = e + t.tempLabelDy;
  return o - i < n ? e - t.tempLabelDy + i : o;
}
const et = 20;
function tt(e) {
  return Number.isInteger(e) && (e <= 2 || e % 5 === 0);
}
function b0(e, t) {
  const i = Math.max(2, Math.floor(t / et));
  let n = e;
  for (let s = i; s >= 2; s--)
    if (tt(e / s)) {
      n = e / s;
      break;
    }
  const o = Math.round(e / n);
  return Array.from({ length: o }, (s, a) => (a + 1) * n);
}
function _0(e) {
  return `${e}°`;
}
function y0(e) {
  return `${e}`;
}
function w0(e, t) {
  const i = `${e}`;
  return t.decimal === "." ? i : i.replace(".", t.decimal);
}
const E2 = 8, it = 10, ot = 500;
function $0(e, t) {
  let i = null;
  e.addEventListener("pointerdown", (n) => {
    const o = n;
    o.pointerType !== "mouse" && (i = { x: o.clientX, y: o.clientY, at: Date.now() });
  }), e.addEventListener("pointercancel", () => {
    i = null;
  }), e.addEventListener("pointerup", (n) => {
    const o = n, s = i;
    i = null, !(!s || o.pointerType === "mouse" || Math.hypot(o.clientX - s.x, o.clientY - s.y) > it || Date.now() - s.at > ot) && t(o);
  });
}
function M0(e, t = () => 1) {
  const i = Array.from(
    e.querySelectorAll("text.day-label")
  );
  if (!i.length) return;
  const n = () => {
    const o = t() || 1, s = e.scrollLeft / o;
    for (const a of i) {
      const l = Number(a.dataset.x0), r = Number(a.dataset.x1);
      if (!Number.isFinite(l) || !Number.isFinite(r)) continue;
      const c = Math.min(Math.max(l, s + E2), Math.max(l, r));
      a.setAttribute("x", String(c));
    }
  };
  e.addEventListener("scroll", n, { passive: !0 }), n();
}
function k0(e) {
  const t = e.filter((c) => Number.isFinite(c));
  if (!t.length) return [0, 2, 4, 6, 8];
  const i = Math.min(...t), n = Math.max(...t), o = [1, 2, 5, 10, 20, 50], s = o.find((c) => Math.ceil(n / c) * c - Math.floor(i / c) * c <= c * 5) ?? o[o.length - 1], a = Math.floor(i / s) * s;
  let l = Math.ceil(n / s) * s;
  l === a && (l = a + s);
  const r = [];
  for (let c = a; c <= l; c += s) r.push(c);
  return r;
}
function B0(e) {
  const t = Math.max(
    0,
    ...e.map((i) => Math.max(i.windMs ?? 0, i.gustMs ?? 0))
  );
  return Math.max(20, Math.ceil(t / 10) * 10);
}
function st(e, t = A2) {
  return t.padL + e * t.colW + t.padR;
}
function nt(e, t) {
  const i = e.map((c) => c.tempC).filter((c) => Number.isFinite(c)), n = k0(i), [o, s] = [n[0], n[n.length - 1]], a = B0(e), l = t.precipCap / t.precipPerMm, r = { baseMm: l, topMm: g0(e, l) };
  return {
    tempTicks: n,
    windTicks: b0(a, t.windSpan),
    precipTicks: x0(r, t.precipCap),
    ty: (c) => t.tempTop + (s - c) / (s - o) * (t.tempBottom - t.tempTop),
    wy: (c) => t.windBase - Math.min(c, a) / a * t.windSpan,
    ph: (c) => t.precipCap * P2(c, r)
  };
}
function L2(e, t) {
  return e.dividers.map(
    (i) => `<line x1="0" x2="${t}" y1="${i}" y2="${i}" stroke="#EAEEF1" stroke-width="1.5"/>`
  ).join("");
}
function at(e, t) {
  const i = e.axisW - e.axisInset, n = [L2(e, e.axisW)];
  for (const o of t.tempTicks)
    n.push(
      Q(i, t.ty(o) + e2, _0(o), g2, e.axisFont, 700, "end")
    );
  for (const o of t.windTicks)
    n.push(
      Q(i, t.wy(o) + e2, y0(o), g2, e.axisFont, 700, "end")
    );
  return `<svg class="mg-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${n.join("")}</svg>`;
}
function lt(e, t, i) {
  const n = [L2(e, e.rightAxisW)];
  for (const o of t.precipTicks)
    n.push(
      Q(
        e.axisInset,
        e.precipBase - t.ph(o) + e2,
        w0(o, i),
        f0,
        e.axisFont,
        700
      )
    );
  return `<svg class="mg-axis-right" width="${e.rightAxisW}" height="${e.height}" viewBox="0 0 ${e.rightAxisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${n.join("")}</svg>`;
}
function rt(e, t, i, n = A2, o = -1) {
  const s = n, a = e.length, l = st(a, s), r = (d) => s.padL + d * s.colW + s.colW / 2, c = v2(e), m = nt(e, s), { ty: u, wy: p, ph: x } = m, v = [];
  for (const d of u0(e, s.colW))
    v.push(
      `<rect x="${s.padL + d.x}" y="${s.dayTop}" width="${d.w}" height="${s.dayBottom - s.dayTop}" fill="${h0}"/>`
    );
  for (const d of m.tempTicks)
    v.push(
      `<line x1="0" x2="${l}" y1="${u(d)}" y2="${u(d)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const d of m.precipTicks) {
    const g = s.precipBase - x(d);
    v.push(
      `<line x1="0" x2="${l}" y1="${g}" y2="${g}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  for (const d of m.windTicks)
    v.push(
      `<line x1="0" x2="${l}" y1="${p(d)}" y2="${p(d)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  const z = [0];
  for (let d = 1; d < a; d++)
    e[d].local.getUTCHours() === 0 && z.push(d);
  for (let d = 0; d < z.length; d++) {
    const g = z[d];
    if (g > 0) {
      const H = r(g);
      v.push(
        `<line x1="${H}" x2="${H}" y1="${s.dayTop}" y2="${s.dayBottom}" stroke="#DCE3E8" stroke-width="1" stroke-dasharray="3 3"/>`
      );
    }
    const F = e[g].local, A = t.weekdays[F.getUTCDay()], I = A.charAt(0).toUpperCase() + A.slice(1), D = s.dayLabelShort ? `${I} ${F.getUTCDate()}` : t.dayLabel(I, F.getUTCDate(), t.months[F.getUTCMonth()]), G = d + 1 < z.length ? z[d + 1] : a, N = (G - g) * s.colW - 8, j = D.length * s.dayFont * 0.6;
    if (j <= N) {
      const H = (g > 0 ? r(g) : s.padL) + 6;
      v.push(
        Q(H, s.dayLabelY, D, w.neutral, s.dayFont, 800).replace(
          "<text ",
          `<text class="day-label" data-x0="${H}" data-x1="${(G < a ? r(G) : s.padL + a * s.colW) - 6 - j}" `
        )
      );
    }
  }
  v.push(L2(s, l));
  for (let d = 0; d < a; d++) {
    const g = e[d].precipMaxMm;
    if (g > 0) {
      const F = x(g);
      v.push(
        `<rect x="${r(d) - s.precipMaxW / 2}" y="${s.precipBase - F}" width="${s.precipMaxW}" height="${F}" rx="2" fill="${w.precipMax}"/>`
      );
    }
  }
  for (let d = 0; d < a; d++) {
    const g = e[d].precipMm;
    if (g > 0) {
      const F = x(g);
      v.push(
        `<rect x="${r(d) - s.precipW / 2}" y="${s.precipBase - F}" width="${s.precipW}" height="${F}" rx="2" fill="${w.precip}"/>`
      );
    }
  }
  v.push(
    `<path d="${$2(e, (d) => d.tempC, r, u)}" fill="none" stroke="${w.temp}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let d = 0; d < a; d += 1) {
    const g = t2(e[d].symbol);
    g && v.push(
      `<image x="${r(d) - s.symbolSize / 2}" y="${s.symbolY}" width="${s.symbolSize}" height="${s.symbolSize}" href="${f(g)}"/>`
    );
  }
  c && v.push(
    `<path d="${$2(e, (d) => d.gustMs, r, p)}" fill="none" stroke="${w.gust}" stroke-width="1.8" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), v.push(
    `<path d="${$2(e, (d) => d.windMs, r, p)}" fill="none" stroke="${w.wind}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let d = 0; d < a; d += 1) {
    const g = e[d].tempC;
    g !== null && v.push(
      Q(r(d), Qe(u(g), s), `${Math.round(g)}°`, s2(Math.round(g)), s.tempFont, 800, "middle", !0)
    );
  }
  const B = s.arrowHalf, b = B / 7, M = `M${(-4 * b).toFixed(1)} ${(2 * b).toFixed(1)} L0 ${(7.5 * b).toFixed(1)} L${(4 * b).toFixed(1)} ${(2 * b).toFixed(1)}`;
  for (let d = 0; d < a; d += 1) {
    const g = e[d].dirDeg;
    g !== null && v.push(
      `<g transform="translate(${r(d)} ${s.arrowY}) rotate(${(g % 360 + 360) % 360})"><line x1="0" y1="${-B}" x2="0" y2="${B}" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${M}" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  for (let d = 0; d < a; d += 3) {
    const g = String(e[d].local.getUTCHours()).padStart(2, "0");
    v.push(Q(r(d), s.hourLabelY, g, w.neutral, s.hourFont, 700, "middle"));
  }
  if (o >= 0 && o < a) {
    const d = r(o), g = e[o].tempC;
    v.push(
      `<line class="chart-now" x1="${d}" x2="${d}" y1="${s.scrubTop}" y2="${s.scrubBottom}" stroke="${w.now}" stroke-width="2"/>`
    ), g !== null && v.push(
      `<circle class="chart-now-dot" cx="${d}" cy="${u(g)}" r="${s.dotTempR}" fill="${w.temp}" stroke="#ffffff" stroke-width="1.5"/>`
    );
  }
  const k = Math.max(0, Math.min(a - 1, i)), $ = r(k), C = e[k]?.tempC ?? null, T = e[k]?.windMs ?? null;
  s.hasTrack && v.push(
    `<line class="scrub-track" x1="${r(0)}" x2="${r(a - 1)}" y1="${s.scrubTop}" y2="${s.scrubTop}" stroke="#DCE3E8" stroke-width="4" stroke-linecap="round"/>`
  ), v.push(
    `<line class="scrub-cursor" x1="${$}" x2="${$}" y1="${s.scrubTop}" y2="${s.scrubBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${$}" cy="${C === null ? 0 : u(C)}" r="${s.dotTempR}" fill="${w.temp}" stroke="#ffffff" stroke-width="1.5"${C === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${$}" cy="${T === null ? 0 : p(T)}" r="${s.dotWindR}" fill="${w.wind}" stroke="#ffffff" stroke-width="1.5"${T === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-handle" cx="${$}" cy="${s.scrubTop}" r="${s.handleR}" fill="#14202B" stroke="#ffffff" stroke-width="2"/>`,
    // Invisible touch strip around the track: drags here scrub; touches
    // elsewhere on the chart scroll it horizontally as normal.
    `<rect class="scrub-hit" x="0" y="${s.hitY}" width="${l}" height="${s.hitH}" fill="transparent" style="touch-action:none;cursor:ew-resize"/>`
  );
  const E = `<svg class="mg-plot" width="${l}" height="${s.height}" viewBox="0 0 ${l} ${s.height}" style="display:block" aria-hidden="true">${v.join("")}</svg>`, h = {
    width: l,
    count: a,
    cx: r,
    tempY: u,
    windY: p,
    indexAt: (d) => Math.max(0, Math.min(a - 1, Math.round((d - s.padL - s.colW / 2) / s.colW)))
  };
  return {
    svg: E,
    axisSvg: at(s, m),
    rightAxisSvg: lt(s, m, t),
    geo: h
  };
}
function n2(e, t, i) {
  return e === null ? "" : `<svg width="${t}" height="${t}" viewBox="0 0 20 20" style="flex:none;transform:rotate(${(e % 360 + 360) % 360}deg)"><g stroke="${i}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="10" y1="3.5" x2="10" y2="15"/><path d="M5.5 11 L10 16 L14.5 11"/></g></svg>`;
}
function b2(e, t) {
  return e === null ? "" : t.compass[Math.round((e % 360 + 360) % 360 / 45) % 8];
}
function i2(e) {
  if (e.windMs === null) return "–";
  const t = Math.round(e.windMs);
  return e.gustMs === null ? `${t}` : `${t} (${Math.round(e.gustMs)})`;
}
function S0(e, t) {
  const i = e.tempC === null ? "–" : `${Math.round(e.tempC)}°`, n = e.windMs === null ? "–" : `${i2(e)} m/s ${b2(e.dirDeg, t)}`.trim();
  return `${_2(e, t)}, ${i}, ${W(e.precipMm, 1, t)} mm, ${n}`;
}
function z0(e, t, i) {
  const n = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageDown: -24,
    PageUp: 24
  }, o = e === "Home" ? 0 : e === "End" ? i - 1 : e in n ? t + n[e] : null;
  return o === null ? null : Math.max(0, Math.min(i - 1, o));
}
function _2(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], o = t.dateLabel(i.getUTCDate(), t.months[i.getUTCMonth()]), s = String(i.getUTCHours()).padStart(2, "0");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${o} · ${s}:00`;
}
function U2(e) {
  return e.length < 2 ? 1 : Math.max(1, Math.round((e[1].utcMs - e[0].utcMs) / 36e5));
}
function C0(e, t) {
  if (e.length < 2) return "";
  const i = e[e.length - 1], n = (i.utcMs - e[0].utcMs) / 36e5, o = Math.max(1, Math.round(n / 24)), s = i.local, a = t.weekdays[s.getUTCDay()], l = a.charAt(0).toUpperCase() + a.slice(1);
  return t.forecastSpan(
    o,
    t.dayLabel(l, s.getUTCDate(), t.months[s.getUTCMonth()])
  );
}
const q2 = 1.5, ct = 10, dt = 4;
function Y2(e, t = Date.now()) {
  let i = 0;
  for (let n = 0; n < e.length && e[n].utcMs <= t; n++) i = n;
  return i;
}
function m2(e, t = Date.now()) {
  let i = 0, n = 1 / 0;
  for (let o = 0; o < e.length; o++) {
    const s = Math.abs(e[o].utcMs - t);
    s < n && (n = s, i = o);
  }
  return i;
}
function T0(e, t = Date.now()) {
  if (!e.length) return -1;
  const i = U2(e) * 36e5, n = e[0].utcMs - i / 2, o = e[e.length - 1].utcMs + i / 2;
  return t < n || t >= o ? -1 : m2(e, t);
}
function pt(e, t, i = Date.now()) {
  if (!e.length) return -1;
  const n = U2(e) * 36e5;
  if (t + n <= i) return -1;
  let o = -1, s = 1 / 0;
  for (let a = 0; a < e.length; a++) {
    const l = Math.abs(e[a].utcMs - t);
    l < s && (s = l, o = a);
  }
  return s <= n / 2 ? o : -1;
}
function ht(e, t) {
  if (!e.length || !Number.isFinite(t)) return -1;
  let i = 0, n = 1 / 0;
  for (let r = 0; r < e.length; r++) {
    const c = Math.abs(e[r].utcMs - t);
    c < n && (n = c, i = r);
  }
  const o = e[i].utcMs, a = (t >= o ? e[i + 1] : e[i - 1]) ?? e[i - 1] ?? e[i + 1], l = a ? Math.abs(a.utcMs - o) : 36e5;
  return n <= l / 2 ? i : -1;
}
function ut(e, t, i) {
  const n = t >= 0 ? e[t] : void 0;
  if (!n) return { time: null, tempC: null, source: i };
  const o = n.tempC === null ? null : Math.round(n.tempC) + 0;
  return { time: new Date(n.utcMs).toISOString(), tempC: o, source: i };
}
function M2(e, t, i) {
  return `<div class="lane-chip-wrap" style="transform:translateY(${e}px)"><div class="lane-chip"><span class="chip-swatch-${t}"></span>${f(i)}</div></div>`;
}
function V2(e, t, i, n, o, s = {}) {
  let a = n < 0 ? -1 : Math.min(t.length - 1, n), l = a;
  const r = s.compact ? Ye : A2, { svg: c, axisSvg: m, rightAxisSvg: u, geo: p } = rt(
    t,
    i,
    a,
    r,
    T0(t)
  ), x = s.compact ? 34 : 38, v = s.bare || s.compact ? "" : `<div class="head">
        <div class="title">${f(C0(t, i) || i.nextHours(t.length * U2(t)))}</div>
        <div class="hint">${f(i.swipe)}</div>
      </div>`, z = s.compact ? "graph-bare graph-compact" : s.bare ? "graph-bare" : "card", B = s.bare || s.compact ? `<div class="${z}">` : `<div class="card">${v}`, b = s.compact ? "" : `${M2(46, "temp", i.laneTemp)}
        ${M2(158, "precip", i.lanePrecip)}
        ${M2(244, "wind", i.laneWind)}`, M = s.compact ? "" : `<span><span class="swatch-pmax"></span>${f(i.legPmax)}</span>`, k = v2(t) ? `<span><span class="swatch-gust"></span>${f(i.legGust)}</span>` : "";
  e.innerHTML = `
    ${B}
      <div class="readout">
        <div>
          <div class="ro-time"></div>
          <div class="ro-vals">
            <span class="ro-temp"></span>
            <span class="ro-precip"></span>
            <span class="ro-wind"><span class="ro-wind-text"></span><span class="ro-arrow"></span><span class="ro-compass"></span></span>
          </div>
        </div>
        <span class="ro-icon"></span>
      </div>
      <div class="mg-chart">
        ${m}
        <div class="scroll" role="slider" tabindex="0" aria-label="${f(i.scrubSlider)}"
             aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${t.length - 1}">
          ${b}
          ${c}
        </div>
        ${u}
      </div>
      <div class="legend">
        <span><span class="swatch-temp"></span>${f(i.legTemp)}</span>
        <span><span class="swatch-precip"></span>${f(i.legPrecip)}</span>
        ${M}
        <span><span class="swatch-wind"></span>${f(i.legWind)}</span>
        ${k}
      </div>
    </div>`;
  const $ = e.querySelector(".mg-plot"), C = (y) => e.querySelector(y), T = C(".scroll"), E = C(".scrub-cursor"), h = C(".scrub-handle"), d = C(".scrub-dot-temp"), g = C(".scrub-dot-wind"), F = C(".ro-time"), A = C(".ro-temp"), I = C(".ro-precip"), D = C(".ro-wind-text"), G = C(".ro-arrow"), N = C(".ro-compass"), j = C(".ro-icon");
  let H, q;
  const J = C(".readout"), _ = e.querySelector(".chart-now-dot"), S = () => {
    const y = t[a], U = !y;
    J.classList.toggle("is-outside", U);
    for (const R of [E, h, d, g])
      U ? R.setAttribute("visibility", "hidden") : R.removeAttribute("visibility");
    if (U ? _?.setAttribute("visibility", "hidden") : _?.removeAttribute("visibility"), U) {
      F.textContent = i.noForecastForTime, T.removeAttribute("aria-valuenow"), T.setAttribute("aria-valuetext", i.noForecastForTime);
      return;
    }
    const Y = p.cx(a);
    if (E.setAttribute("x1", `${Y}`), E.setAttribute("x2", `${Y}`), h.setAttribute("cx", `${Y}`), d.setAttribute("cx", `${Y}`), d.setAttribute("visibility", y.tempC === null ? "hidden" : "visible"), y.tempC !== null && d.setAttribute("cy", `${p.tempY(y.tempC)}`), g.setAttribute("cx", `${Y}`), g.setAttribute("visibility", y.windMs === null ? "hidden" : "visible"), y.windMs !== null && g.setAttribute("cy", `${p.windY(y.windMs)}`), T.setAttribute("aria-valuenow", String(a)), T.setAttribute("aria-valuetext", S0(y, i)), F.textContent = _2(y, i), A.textContent = y.tempC === null ? "–" : `${Math.round(y.tempC)}°`, A.style.color = y.tempC === null ? w.neutral : s2(Math.round(y.tempC)), I.textContent = `${W(y.precipMm, 1, i)} mm`, D.textContent = i2(y), y.dirDeg !== H && (G.innerHTML = n2(y.dirDeg, 14, "#14202B"), H = y.dirDeg), N.textContent = b2(y.dirDeg, i), y.symbol !== q) {
      const R = t2(y.symbol);
      j.innerHTML = R ? `<img src="${f(R)}" width="${x}" height="${x}" alt="">` : "", q = y.symbol;
    }
  };
  S(), M0(T);
  let L = !1;
  const P = () => {
    if (L || !T.clientWidth) return;
    let U = 0;
    e.querySelectorAll(".lane-chip").forEach((R) => {
      U = Math.max(U, R.getBoundingClientRect().width);
    });
    const Y = Math.max(
      q2 * r.colW,
      U ? dt + U + ct : 0
    );
    T.scrollLeft = Math.max(0, p.cx(a) - Y), L = !0;
  };
  if (P(), !L && typeof requestAnimationFrame == "function" && (requestAnimationFrame(P), typeof ResizeObserver < "u")) {
    const y = new ResizeObserver(() => {
      P(), (L || !T.isConnected) && y.disconnect();
    });
    y.observe(T);
  }
  const O = (y, U = !1) => {
    const Y = $.getBoundingClientRect(), R = p.indexAt(y.clientX - Y.left);
    R !== a && (a = R, S(), o?.(R, !1)), U && Z();
  }, Z = () => {
    l = a, o?.(a, !0);
  };
  $.addEventListener("pointermove", (y) => {
    y.pointerType === "mouse" && O(y);
  }), $.addEventListener("pointerdown", (y) => {
    y.pointerType === "mouse" && O(y, !0);
  }), $.addEventListener("pointerleave", (y) => {
    !s.previewHover?.() || y.pointerType !== "mouse" || y.buttons || a !== l && (a = l, S(), o?.(a, !1));
  }), $0($, (y) => O(y, !0)), T.addEventListener("keydown", (y) => {
    const U = z0(y.key, a, t.length);
    U !== null && (y.preventDefault(), y.stopPropagation(), U !== a && (a = U, S(), o?.(a, !1), Z(), a2()));
  });
  const a2 = () => {
    if (a < 0) return;
    const y = p.cx(a), U = q2 * r.colW;
    y < T.scrollLeft + U ? T.scrollLeft = y - U : y > T.scrollLeft + T.clientWidth - U && (T.scrollLeft = y - T.clientWidth + U);
  }, K = e.querySelector(".scrub-hit");
  let o2 = !1;
  K.addEventListener("pointerdown", (y) => {
    try {
      K.setPointerCapture(y.pointerId);
    } catch {
    }
    o2 = !0, O(y);
  }), K.addEventListener("pointermove", (y) => {
    y.buttons > 0 && O(y);
  });
  const l2 = () => {
    o2 && (o2 = !1, Z());
  };
  return K.addEventListener("pointerup", l2), K.addEventListener("pointercancel", l2), {
    // Host-driven: moves the cursor without reporting back (-1 = outside).
    setScrubIdx: (y) => {
      a = y < 0 ? -1 : Math.min(t.length - 1, y), l = a, S(), a2();
    }
  };
}
function ft(e, t) {
  return Number.isFinite(e) ? e < 10 ? `${W(e, 1, t)} km` : `${Math.round(e)} km` : "";
}
function x2(e, t, i) {
  const n = e < 0 ? "S" : "N", o = i.compass[t < 0 ? 6 : 2];
  return `${W(Math.abs(e), 2, i)}°${n} ${W(Math.abs(t), 2, i)}°${o}`;
}
function mt(e) {
  const { places: t, lat: i, lon: n, t: o } = e;
  if (e.locationName) return { name: e.locationName, source: "attribute" };
  if (e.pickedName) return { name: e.pickedName, source: "picked" };
  if (isNaN(i) || isNaN(n)) return { name: t[0]?.name ?? "", source: "station" };
  if (e.preferCoordinates) return { name: x2(i, n, o), source: "coordinates" };
  let s = null, a = 1 / 0;
  for (const l of t) {
    const r = (l.lat - i) ** 2 + (l.lon - n) ** 2 * 0.2;
    r < a && (a = r, s = l);
  }
  return s ? { name: s.name, source: "station" } : { name: x2(i, n, o), source: "coordinates" };
}
function gt(e, t, i, n, o) {
  return (i !== "coordinates" && !isNaN(e) && !isNaN(t) ? f(x2(e, t, o)) : "") + n;
}
function K2(e, t, i, n = 7) {
  if (!e.length) return [];
  const o = (r) => Date.UTC(r.local.getUTCFullYear(), r.local.getUTCMonth(), r.local.getUTCDate()), s = o(e[Math.max(0, Math.min(e.length - 1, i))]), a = /* @__PURE__ */ new Map();
  for (const r of e) {
    const c = o(r);
    if (c < s) continue;
    let m = a.get(c);
    m || a.set(c, m = []), m.push(r);
  }
  const l = [];
  for (const [r, c] of [...a.entries()].sort((m, u) => m[0] - u[0])) {
    if (l.length >= n) break;
    const m = c[0].local, u = Math.round((r - s) / 864e5), p = t.weekdays[m.getUTCDay()], x = u === 0 ? t.today : u === 1 ? t.tomorrow : p.charAt(0).toUpperCase() + p.slice(1), v = c.map((B) => B.tempC).filter((B) => Number.isFinite(B)), z = c.map((B) => B.windMs).filter((B) => Number.isFinite(B));
    l.push({
      name: x,
      date: t.dateLabel(m.getUTCDate(), t.months[m.getUTCMonth()]),
      dateShort: t.dateLabel(m.getUTCDate(), t.monthsShort[m.getUTCMonth()]),
      maxC: v.length ? Math.round(Math.max(...v)) : null,
      minC: v.length ? Math.round(Math.min(...v)) : null,
      windMean: z.length ? Math.round(z.reduce((B, b) => B + b, 0) / z.length) : null,
      precipMm: c.reduce(
        (B, b) => B + (Number.isFinite(b.precipMm) ? b.precipMm : 0),
        0
      ),
      icons: [3, 9, 15, 21].map((B) => c.find((b) => b.local.getUTCHours() === B)?.symbol ?? "").filter(Boolean),
      noonSymbol: xt(c),
      hours: c
    });
  }
  return l;
}
function G2(e, t) {
  const i = t2(e);
  return i ? `<img src="${f(i)}" width="${t}" height="${t}" alt="">` : `<span style="width:${t}px;height:${t}px;display:inline-block"></span>`;
}
function xt(e) {
  let t = "", i = 1 / 0;
  for (const n of e) {
    const o = Math.abs(n.local.getUTCHours() - 15);
    o < i && n.symbol && (i = o, t = n.symbol);
  }
  return t;
}
function c2(e, t, i = 66, n = 76) {
  const o = e.tempC === null ? null : Math.round(e.tempC), s = e.tempC === null || e.windMs === null ? null : Math.round(e.tempC - 0.35 * e.windMs);
  return `
    <div class="now">
      <div class="now-eyebrow">${f(t.now)}</div>
      <div class="now-main">
        <div class="now-temp" style="font-size:${i}px;color:${o === null ? w.none : "#14202B"}">${o === null ? "–" : `${o}°`}</div>
        <div class="now-icon">${G2(e.symbol, n)}</div>
      </div>
      <div class="now-stats">
        <div class="stat">
          <div class="stat-label">${f(t.feels)}</div>
          <div class="stat-value" style="color:${s === null ? w.none : "#14202B"}">${s === null ? "–" : `${s}°`}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${f(t.precip)}</div>
          <div class="stat-value" style="color:${w.precipText}">${W(e.precipMm, 1, t)} mm</div>
        </div>
        <div class="stat stat--wind-card">
          <div class="stat-label">${f(t.wind)}</div>
          <div class="stat-value stat-wind"><span>${f(i2(e))}</span>${n2(e.dirDeg, 17, "#1E8E6B")}</div>
        </div>
      </div>
    </div>`;
}
const vt = (e = "") => `<svg class="${e}" width="14" height="14" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function bt(e) {
  return `<button class="pill" type="button"><span>${f(e)}</span>${vt()}</button>`;
}
function F0(e, t, i = " / ") {
  return e === null || t === null ? "–" : `<span style="color:${s2(e)}">${e}°</span><span class="temp-sep">${i}</span><span style="color:${s2(t)}">${t}°</span>`;
}
function E0(e, t, i) {
  return `<span class="h-time">${String(e.local.getUTCHours()).padStart(2, "0")}</span><span class="h-icon">${G2(e.symbol, t)}</span><span class="h-temp" style="color:${e.tempC === null ? w.none : s2(Math.round(e.tempC))}">${e.tempC === null ? "–" : `${Math.round(e.tempC)}°`}</span><span class="h-precip">${e.precipMm > 0.05 ? W(e.precipMm, 1, i) : "–"}</span><span class="h-wind">${f(i2(e))} ${n2(e.dirDeg, 14, w.neutral)}</span>`;
}
function A0(e) {
  const t = Date.now(), i = e.length > 1 ? e[1].utcMs - e[0].utcMs : 36e5;
  return (n) => t >= n.utcMs && t < n.utcMs + i ? " hrow-now" : "";
}
function P0(e, t) {
  return `<div class="${e} hrow-head"><span>${f(t.timeCol)}</span><span></span><span class="h-temp">${f(t.tempCol)}</span><span class="h-precip">mm</span><span class="h-wind-h">m/s</span></div>`;
}
const _t = '<svg width="11" height="11" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="#8CA3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', yt = '<svg width="15" height="15" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>', wt = '<svg width="9" height="15" viewBox="0 0 9 15" style="flex:none"><g fill="#B4C6D6"><circle cx="2.5" cy="2.5" r="1.4"/><circle cx="6.5" cy="2.5" r="1.4"/><circle cx="2.5" cy="7.5" r="1.4"/><circle cx="6.5" cy="7.5" r="1.4"/><circle cx="2.5" cy="12.5" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/></g></svg>';
function $t(e, t) {
  const i = String(e.getUTCDate()).padStart(2, "0"), n = t.monthsShort[e.getUTCMonth()], o = String(e.getUTCHours()).padStart(2, "0"), s = String(e.getUTCMinutes()).padStart(2, "0");
  return `${i} ${n} ${o}:${s} UTC`;
}
function Mt(e) {
  if (e == null || !Number.isFinite(e)) return null;
  if (e === 0) return "UTC";
  const t = e < 0 ? "-" : "+", i = Math.abs(e), n = Math.floor(i / 60), o = i % 60;
  return o === 0 ? `UTC${t}${n}` : `UTC${t}${n}:${String(o).padStart(2, "0")}`;
}
function X2(e) {
  return e === "table" || e === "graph" ? e : "both";
}
function kt(e, t, i, n, o) {
  const s = (a, l) => `<button class="tab${e === a ? " on" : ""}" type="button" data-exp-view="${a}" aria-pressed="${e === a}">${f(l)}</button>`;
  return `
      <div class="exp-bar">
        <div class="tabs exp-tabs">${s("table", o.table)}${s("graph", o.graph)}${s("both", o.both)}</div>
        ${e === "table" ? n : ""}
      </div>
      <div class="exp-body exp-${e}">
        ${e === "graph" ? "" : `<div class="exp-left">${t}</div>`}
        ${e === "table" ? "" : `<div class="exp-right">${i}</div>`}
      </div>`;
}
function Bt(e) {
  return e ? ".station-search" : ".overlay";
}
function St(e, t) {
  return t && e.source === "coordinates" ? "" : e.name;
}
function zt(e) {
  return [
    e.modelName,
    e.place,
    e.lang,
    Mt(e.tzOffsetMin)
  ].filter((t) => !!t).join(" · ");
}
function Ct(e, t, i) {
  const n = t ? `<button class="header-close" type="button" aria-label="${f(i.close)}">${yt}</button>` : "";
  return `
    <div class="panel-header panel-drag" data-drag-handle>
      ${wt}
      <button class="pill panel-pill" type="button"><span>${f(e)}</span>${_t}</button>
      ${n}
    </div>`;
}
const Tt = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>';
function Ft(e, t) {
  return e.startsWith("air_temperature") ? t.laneTemp : e.startsWith("wind_") ? t.laneWind : e.startsWith("lwe_precipitation") ? t.lanePrecip : null;
}
function Et(e, t, i) {
  if (!e.length) return "";
  const n = [
    ...new Set(
      e.map((s) => Ft(s, i)).filter((s) => !!s)
    )
  ].join(", "), o = i.correctedDetail(t, n);
  return `<span class="corrected" title="${f(o)}" aria-label="${f(o)}" role="img">${Tt}</span>`;
}
function At(e, t, i) {
  const n = e?.trim();
  return !n || !Number.isFinite(t) || t < 0 ? "" : `<div class="loc-note">${f(i.stationPlace(n, W(t, 1, i)))}</div>`;
}
function Pt(e) {
  return `<div class="meta-footer">${f(e)}</div>`;
}
function d2(e, t, i = !0) {
  return `<div class="day-chips"><div class="dc-track">${e.map((o, s) => {
    const a = s === t, l = i ? `<div class="dc-date">${f(o.dateShort)}</div>` : "";
    return `
      <button class="day-chip${a ? " sel" : ""}" type="button" data-day="${s}" aria-pressed="${a}">
        <div class="dc-name">${f(o.name)}</div>
        ${l}
        <div class="dc-icon">${G2(o.noonSymbol, i ? 30 : 26)}</div>
        <div class="dc-temps">${F0(o.maxC, o.minC, "/")}</div>
      </button>`;
  }).join("")}</div></div>`;
}
function L0(e, t) {
  const i = (a, l) => `<div class="sel-stat"><span class="sel-stat-label">${f(a)}</span><span class="sel-stat-value">${l}</span></div>`, n = F0(e.maxC, e.minC, " / "), o = e.precipMm > 0.05 ? `${W(e.precipMm, 1, t)} mm` : "–", s = e.windMean === null ? "–" : `${e.windMean} m/s`;
  return `
        <div class="sel-stats">
          ${i(t.tempCol, n)}
          ${i(t.precip, `<span class="sel-stat-precip">${o}</span>`)}
          ${i(t.wind, s)}
        </div>`;
}
function Lt(e, t) {
  const i = A0(e.hours), n = e.hours.map((o) => `<div class="hrow${i(o)}">${E0(o, 24, t)}</div>`).join("");
  return `
    <div class="sel-card">
      <div class="sel-head">
        <div class="sel-title">${f(e.name)} <span class="sel-date">${f(e.date)}</span></div>
      </div>${L0(e, t)}
      ${P0("hrow", t)}
      ${n}
    </div>`;
}
function k2(e, t) {
  const i = A0(e.hours), n = e.hours.map((o) => `<div class="hrow-p${i(o)}">${E0(o, 22, t)}</div>`).join("");
  return `
    <div class="panel-table">
      ${L0(e, t)}
      ${P0("hrow-p hrow-sticky", t)}
      ${n}
    </div>`;
}
const Ut = 200;
function J2(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ß/g, "ss").trim();
}
function U0(e, t, i, n) {
  const o = '<svg width="14" height="14" viewBox="0 0 16 16" style="flex:none"><path d="M3 8.5l3.5 3.5L13 5" fill="none" stroke="#1E8E6B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', s = J2(i);
  return e.map((a, l) => ({ p: a, i: l })).filter(({ p: a }) => !s || J2(a.name).includes(s)).slice(0, Ut).map(({ p: a, i: l }) => {
    const r = a === t, c = a.distanceKm === void 0 ? "" : `<span class="station-dist">${f(ft(a.distanceKm, n))}</span>`;
    return `
      <button class="station${r ? " sel" : ""}" type="button" data-station="${l}">
        <span class="station-name">${f(a.name)}${r ? ` ${o}` : ""}</span>
        <span class="station-sub">${c}<span class="station-coord">${f(x2(a.lat, a.lon, n))}</span></span>
      </button>`;
  }).join("");
}
function Gt(e, t) {
  return `
            <div class="section-label">${f(t.language)}</div>
            <div class="chips chips-langs">
              ${pe.map(
    (i) => `<button class="chip${e === i.code ? " on" : ""}" type="button" data-lang="${i.code}" aria-pressed="${e === i.code}">${f(i.name)}</button>`
  ).join("")}
            </div>`;
}
function Dt(e, t, i, n, o, s, a, l = !0, r = !0) {
  const c = e.map(
    (x, v) => `<button class="chip${x.id === t ? " on" : ""}" type="button" data-model="${v}" aria-pressed="${x.id === t}">${f(x.name)}</button>`
  ).join(""), m = r ? `
            <div class="section-label">${f(a.forecastModel)}</div>
            <div class="chips chips-models">${c}</div>` : "", u = l ? Gt(i, a) : "", p = m || u ? `
          <div class="ov-col">${m}
            ${u}
          </div>` : "";
  return `
    <div class="backdrop">
      <div class="overlay" role="dialog" aria-modal="true" aria-label="${f(a.settings)}" tabindex="-1">
        <div class="overlay-head">
          <div class="overlay-title">${f(a.settings)}</div>
          <button class="overlay-close" type="button" aria-label="${f(a.close)}">
            <svg width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="ov-cols${p ? "" : " ov-cols--single"}">${p}
          <div class="ov-col ov-col--station">
            <div class="section-label">${f(a.location)}</div>
            <input class="station-search" type="text" enterkeyhint="search" value="${f(s)}" placeholder="${f(a.search)}" aria-label="${f(a.search)}" autocomplete="off">
            <div class="station-list">${U0(n, o, s, a)}</div>
          </div>
        </div>
      </div>
    </div>`;
}
const Ht = 22, p2 = 60;
function Ot(e, t) {
  const { temp: i, gap: n, wind: o } = e, s = i + n + o;
  let a = e.headerPx, l = e.symbolsPx, r = e.arrowsPx;
  const c = a + r;
  t - c - l < p2 && (l = Math.max(
    0,
    Math.min(l, t - c - p2)
  ));
  const m = a + l + r;
  if (t - m < p2 && m > 0) {
    const k = Math.max(0, t - p2) / m;
    a = Math.floor(a * k), l = Math.floor(l * k), r = Math.floor(r * k);
  }
  const p = a + l, x = Math.max(0, t - p - r), v = (k) => p + (s > 0 ? Math.round(k / s * x) : 0), z = p, B = v(i), b = v(i + n), M = v(i + n + o);
  return {
    height: t,
    // The symbol row sits under the header and above the plot; a spec with
    // symbolsPx 0 collapses it to a zero-height band at the plot's ceiling,
    // which is what the pre-band geometry was.
    symbolTop: a,
    symbolsPx: l,
    plotTop: z,
    // The temperature lane starts at the plot's ceiling; the same edge, named
    // twice because the renderer reads it in two different contexts.
    tempTop: z,
    tempBase: B,
    windTop: b,
    windBase: M,
    plotBottom: M
  };
}
function It(e) {
  return e.height - e.plotBottom >= Ht;
}
const Rt = 60, Wt = [
  ".chart-axis",
  ".chart-plot",
  ".chart-axis-right"
];
function G0(e, t, i = Rt) {
  return !(e > 0) || !(t >= i) ? null : { scale: t / e, heightPx: t };
}
function Nt(e, t) {
  return e * t.scale;
}
function jt(e, t) {
  return e * t.scale;
}
const qt = 8;
function Yt(e, t) {
  return {
    dayLabelY: Math.round(t * 1.15),
    // The hour row sits above the SYMBOL row, not above the plot: those are the
    // same edge only when there is no symbol row, and anchoring to the plot put
    // the hours on top of the glyphs.
    hourLabelY: Math.max(
      Math.round(t * 1.15) + 2,
      e.symbolTop - qt
    )
  };
}
function Vt(e, t) {
  return [
    e.plotTop + 8,
    Math.max(e.plotTop + 8, e.tempBase - t - 2),
    e.windTop + 8
  ];
}
const Kt = {
  headerPx: 44,
  symbolsPx: 26,
  arrowsPx: 26,
  temp: 126,
  gap: 16,
  wind: 68
}, Xt = 6;
function D2(e) {
  return { ...Kt, symbolsPx: e + Xt };
}
function Jt(e, t) {
  return e.symbolTop + Math.max(0, Math.round((e.symbolsPx - t) / 2));
}
function H2(e) {
  return e > 0 ? w.temp : e < 0 ? w.tempCold : w.neutral;
}
function O2(e, t, i) {
  const n = Ot(e, t);
  return {
    ...n,
    precipBase: n.tempBase,
    ...Yt(n, i.dayLabelSize),
    laneChipY: Vt(n, i.precipCap)
  };
}
function Zt(e, t) {
  return t === e.height ? e : {
    ...e,
    ...O2(D2(e.symbolSize), t, {
      dayLabelSize: e.dayLabelSize,
      precipCap: e.precipCap
    })
  };
}
const Qt = 240;
function D0(e, t) {
  const i = t ? Math.max(0, t.offsetHeight - t.clientHeight) : 0;
  return e - i;
}
function Z2(e, t, i) {
  const n = D0(e, t);
  return n < Qt ? !1 : n < i || n - i > 2;
}
const ei = {
  colW: 26,
  axisW: 46,
  rightAxisW: 24,
  axisFont: 9.5,
  ...O2(D2(20), 262, { dayLabelSize: 13, precipCap: 44 }),
  tempLo: 0,
  tempHi: 10,
  tempTicks: [0, 5, 10],
  windMax: 15,
  windTicks: [5, 10],
  precipPerMm: 22,
  precipCap: 44,
  precipTopMm: 2,
  precipTicks: [1, 2],
  precipMaxW: 16,
  precipW: 10,
  symbolScale: 0.58,
  symbolSize: 20,
  plotPad: 8,
  dayLabelSize: 13,
  hourLabelSize: 10,
  // Value labels every other column: "12°" is ~17px of type in a 26px column,
  // so every column would collide. Same rule as the symbols below.
  tempLabelEvery: 2,
  tempLabelFont: 10,
  windLabelEvery: 0,
  // Arrows are narrow enough for one per column at colW 26; the 20px weather
  // glyphs are not — hourly data draws them 6px apart and they read as a smear,
  // so the docked panel keeps every second one. The expanded layout has the
  // column width to show them all.
  symbolEvery: 2,
  arrowEvery: 1,
  gridEvery: 2,
  tempStroke: 2.4,
  windStroke: 2.1
}, ti = {
  colW: 42,
  axisW: 52,
  rightAxisW: 28,
  axisFont: 11,
  ...O2(D2(26), 560, { dayLabelSize: 16, precipCap: 84 }),
  tempLo: 0,
  tempHi: 10,
  tempTicks: [0, 5, 10],
  windMax: 20,
  windTicks: [5, 10, 15, 20],
  precipPerMm: 40,
  precipCap: 84,
  precipTopMm: 2.1,
  precipTicks: [1, 2],
  precipMaxW: 18,
  precipW: 12,
  symbolScale: 0.82,
  symbolSize: 26,
  plotPad: 16,
  dayLabelSize: 16,
  hourLabelSize: 11,
  // Temperature values sit on the line in every view now (the meteogram card
  // always did), so the panel reads the same way as the card. Wind values stay
  // off: the wind lane carries a gust line as well, and two numbers per column
  // there was noise — that value is in the scrub readout.
  tempLabelEvery: 1,
  tempLabelFont: 11,
  windLabelEvery: 0,
  symbolEvery: 1,
  arrowEvery: 1,
  gridEvery: 1,
  tempStroke: 2.8,
  windStroke: 2.4
};
function X(e, t, i, n, o, s, a = "start", l = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${o}" font-weight="${s}" text-anchor="${a}" font-family="Nunito, system-ui, sans-serif"${l ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function B2(e, t, i, n) {
  let o = "", s = !1;
  for (let a = 0; a < e.length; a++) {
    const l = t(e[a]);
    if (l === null) {
      s = !1;
      continue;
    }
    o += `${s ? "L" : "M"}${i(a).toFixed(1)} ${n(l).toFixed(1)} `, s = !0;
  }
  return o.trim();
}
function ii(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], o = n.charAt(0).toUpperCase() + n.slice(1), s = t.monthsShort[i.getUTCMonth()], a = String(i.getUTCDate()).padStart(2, "0");
  return `${o} ${a} ${s}`;
}
function oi(e, t) {
  const i = e.map((c) => c.tempC).filter((c) => c !== null), n = k0(i), o = n[0], s = n[n.length - 1];
  if (n.length <= t)
    return { lo: o, hi: s, ticks: n };
  const a = Math.ceil((n.length - 1) / (t - 1)), l = /* @__PURE__ */ new Set();
  for (let c = 0; c < n.length; c += a) l.add(n[c]);
  l.add(s), o < 0 && s > 0 && n.includes(0) && l.add(0);
  const r = [...l].sort((c, m) => c - m);
  return { lo: o, hi: s, ticks: r };
}
function Q2(e, t, i = 1) {
  const n = i > 0 ? i : 1, o = (e.tempBase - e.tempTop) * n, s = (e.windBase - e.windTop) * n, { lo: a, hi: l, ticks: r } = oi(t, Ze(o)), c = Math.max(e.windMax, B0(t)), m = e.precipCap / e.precipPerMm, u = {
    baseMm: m,
    topMm: g0(t, m)
  };
  return {
    ...e,
    tempLo: a,
    tempHi: l,
    tempTicks: r,
    windMax: c,
    // Derived from the shared tick rule rather than hardcoded per layout, so the
    // wind scale reads the same here as on the mobile chart.
    windTicks: b0(c, s),
    precipTopMm: u.topMm,
    precipTicks: x0(u, e.precipCap * n)
  };
}
function si(e, t) {
  const i = (n, o) => n.length === o.length && n.every((s, a) => s === o[a]);
  return i(e.tempTicks, t.tempTicks) && i(e.windTicks, t.windTicks) && i(e.precipTicks, t.precipTicks);
}
function H0(e) {
  const t = {
    baseMm: e.precipCap / e.precipPerMm,
    topMm: e.precipTopMm
  };
  return (i) => e.precipCap * P2(i, t);
}
function O0(e) {
  const t = e.tempHi - e.tempLo;
  return t > 0 ? t : 1;
}
function ni(e) {
  const t = e.height - e.plotBottom;
  return It(e) ? e.plotBottom + t / 2 : e.windBase - 14;
}
function ai(e) {
  const t = (s) => e.tempBase - (s - e.tempLo) / O0(e) * (e.tempBase - e.tempTop), i = (s) => e.windBase - Math.min(s, e.windMax) / e.windMax * (e.windBase - e.windTop), n = [
    `<rect x="0" y="0" width="${e.axisW}" height="${e.height}" fill="#fff"/>`
  ], o = e.axisW - 5;
  for (const s of e.tempTicks)
    n.push(
      X(o, t(s) + e2, _0(s), g2, e.axisFont, 700, "end")
    );
  for (const s of e.windTicks)
    n.push(
      X(o, i(s) + e2, y0(s), g2, e.axisFont, 700, "end")
    );
  return `<svg class="chart-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none">${n.join("")}</svg>`;
}
function li(e, t) {
  const i = e.rightAxisW, n = H0(e), o = e.axisFont, s = [
    `<rect x="0" y="0" width="${i}" height="${e.height}" fill="#fff"/>`
  ];
  for (const a of e.precipTicks)
    s.push(
      X(
        5,
        e.precipBase - n(a) + e2,
        w0(a, t),
        f0,
        o,
        700,
        "start"
      )
    );
  return `<svg class="chart-axis-right" width="${i}" height="${e.height}" viewBox="0 0 ${i} ${e.height}" style="display:block;flex:none">${s.join("")}</svg>`;
}
function I0(e, t, i, n, o) {
  const s = e.length, a = s * o.colW + o.plotPad, l = (h) => h * o.colW + o.colW / 2, r = (h) => o.tempBase - (h - o.tempLo) / O0(o) * (o.tempBase - o.tempTop), c = (h) => o.windBase - Math.min(h, o.windMax) / o.windMax * (o.windBase - o.windTop), m = H0(o), u = [
    `<rect x="0" y="${o.plotTop}" width="${a}" height="${o.plotBottom - o.plotTop}" fill="#FCFDFE"/>`
  ];
  for (const h of u0(e, o.colW))
    u.push(
      `<rect x="${h.x}" y="${o.plotTop}" width="${h.w}" height="${o.plotBottom - o.plotTop}" fill="${h0}"/>`
    );
  for (let h = 0; h < s; h += o.gridEvery)
    u.push(
      `<line x1="${l(h)}" x2="${l(h)}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const h of o.tempTicks)
    u.push(
      `<line x1="0" x2="${a}" y1="${r(h)}" y2="${r(h)}" stroke="#E7EBEE" stroke-width="1"/>`
    );
  for (const h of o.windTicks)
    u.push(
      `<line x1="0" x2="${a}" y1="${c(h)}" y2="${c(h)}" stroke="#DCE3E8" stroke-width="1"/>`
    );
  for (const h of o.precipTicks) {
    const d = o.precipBase - m(h);
    u.push(
      `<line x1="0" x2="${a}" y1="${d}" y2="${d}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  const p = [0];
  for (let h = 1; h < s; h++)
    e[h].local.getUTCHours() === 0 && p.push(h);
  for (let h = 0; h < p.length; h++) {
    const d = p[h], g = l(d);
    d > 0 && u.push(
      `<line x1="${g}" x2="${g}" y1="${o.dayLabelY - 8}" y2="${o.plotBottom}" stroke="#C2CBD2" stroke-width="1"/>`
    );
    const F = ii(e[d], t), A = h + 1 < p.length ? p[h + 1] : s, I = (A - d) * o.colW - 10, D = F.length * o.dayLabelSize * 0.6, G = (d > 0 ? g : 0) + E2, N = A < s ? l(A) : s * o.colW;
    D <= I && u.push(
      X(
        G,
        o.dayLabelY,
        F,
        "#14202B",
        o.dayLabelSize,
        900,
        "start"
      ).replace(
        "<text ",
        `<text class="day-label" data-x0="${G}" data-x1="${N - E2 - D}" `
      )
    );
  }
  for (const h of [o.plotTop, o.tempBase, o.windTop, o.plotBottom])
    u.push(`<line x1="0" x2="${a}" y1="${h}" y2="${h}" stroke="#C2CBD2" stroke-width="1"/>`);
  for (let h = 0; h < s; h++) {
    const d = e[h].precipMaxMm;
    if (d > 0) {
      const g = m(d);
      u.push(
        `<rect x="${l(h) - o.precipMaxW / 2}" y="${o.precipBase - g}" width="${o.precipMaxW}" height="${g}" rx="1.5" fill="${w.precipMax}"/>`
      );
    }
  }
  for (let h = 0; h < s; h++) {
    const d = e[h].precipMm;
    if (d > 0) {
      const g = m(d);
      u.push(
        `<rect x="${l(h) - o.precipW / 2}" y="${o.precipBase - g}" width="${o.precipW}" height="${g}" rx="1.5" fill="${w.precip}"/>`
      );
    }
  }
  const x = Jt(o, o.symbolSize);
  for (let h = 0; h < s; h += o.symbolEvery) {
    const d = t2(e[h].symbol);
    if (d) {
      const g = o.symbolSize;
      u.push(
        `<image x="${l(h) - g / 2}" y="${x}" width="${g}" height="${g}" href="${f(d)}"/>`
      );
    }
  }
  u.push(
    `<path d="${B2(e, (h) => h.tempC, l, r)}" fill="none" stroke="${w.temp}" stroke-width="${o.tempStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  ), v2(e) && u.push(
    `<path d="${B2(e, (h) => h.gustMs, l, c)}" fill="none" stroke="${w.gust}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), u.push(
    `<path d="${B2(e, (h) => h.windMs, l, c)}" fill="none" stroke="${w.wind}" stroke-width="${o.windStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  const v = o.colW >= 40 ? 7 : 6, z = o.colW >= 40 ? "M-4 2 L0 7.5 L4 2" : "M-3.5 1.8 L0 6.5 L3.5 1.8", B = ni(o);
  for (let h = 0; h < s; h += o.arrowEvery) {
    const d = e[h].dirDeg;
    d !== null && u.push(
      `<g transform="translate(${l(h)} ${B}) rotate(${(d % 360 + 360) % 360})"><line x1="0" y1="-${v}" x2="0" y2="${v}" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${z}" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  if (o.tempLabelEvery > 0) {
    const h = o.tempLabelFont * v0, d = Math.round(o.tempLabelFont * 0.8);
    for (let g = 0; g < s; g += o.tempLabelEvery) {
      const F = e[g].tempC;
      if (F === null) continue;
      const A = r(F) - d, I = A - h < o.tempTop ? r(F) + d + h : A;
      u.push(
        X(
          l(g),
          I,
          `${Math.round(F)}°`,
          H2(Math.round(F)),
          o.tempLabelFont,
          800,
          "middle",
          !0
        )
      );
    }
  }
  if (o.windLabelEvery > 0)
    for (let h = 1; h < s; h += o.windLabelEvery) {
      const d = e[h].windMs;
      d !== null && u.push(X(l(h), c(d) - 9, `${Math.round(d)}`, w.windText, 10.5, 800, "middle"));
    }
  const b = o.gridEvery === 1 ? 1 : 2;
  for (let h = 0; h < s; h += b) {
    const d = String(e[h].local.getUTCHours()).padStart(2, "0");
    u.push(X(l(h), o.hourLabelY, d, w.neutral, o.hourLabelSize, 700, "middle"));
  }
  if (n >= 0 && n < s) {
    const h = l(n), d = e[n].tempC;
    u.push(
      `<line class="chart-now" x1="${h}" x2="${h}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="${w.now}" stroke-width="2"/>`
    ), d !== null && u.push(
      `<circle class="chart-now-dot" cx="${h}" cy="${r(d)}" r="4.5" fill="${w.temp}" stroke="#fff" stroke-width="1.5"/>`
    );
  }
  const M = Math.max(0, Math.min(s - 1, i)), k = l(M), $ = e[M]?.tempC ?? null, C = e[M]?.windMs ?? null;
  return u.push(
    `<line class="scrub-cursor" x1="${k}" x2="${k}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${k}" cy="${$ === null ? 0 : r($)}" r="4" fill="${w.temp}" stroke="#fff" stroke-width="1.5"${$ === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${k}" cy="${C === null ? 0 : c(C)}" r="4" fill="${w.wind}" stroke="#fff" stroke-width="1.5"${C === null ? ' visibility="hidden"' : ""}/>`
  ), { svg: `<svg class="chart-plot" width="${a}" height="${o.height}" viewBox="0 0 ${a} ${o.height}" style="display:block;touch-action:none;cursor:crosshair" aria-hidden="true">${u.join("")}</svg>`, geo: {
    width: a,
    count: s,
    cx: l,
    tempY: r,
    windY: c,
    indexAt: (h) => Math.max(0, Math.min(s - 1, Math.round((h - o.colW / 2) / o.colW)))
  } };
}
function S2(e, t, i) {
  return `<div class="lane-chip-wrap chart-lane" style="transform:translateY(${e}px)"><div class="lane-chip chart-chip"><span class="chip-swatch-${t} chart-swatch-${t}"></span>${f(i)}</div></div>`;
}
const ri = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 2H2v4M10 2h4v4M2 10v4h4M14 10v4h-4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', R0 = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 6h4V2M14 6h-4V2M6 14v-4H2M10 14v-4h4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function e0(e, t, i, n, o, s, a = () => 1, l = () => {
}) {
  const r = (u) => {
    const p = e.getBoundingClientRect(), x = a() || 1, v = t.indexAt((u.clientX - p.left) / x);
    v !== i() && (n(v), s(), o(v, !1));
  };
  let c = !1;
  e.addEventListener("pointerdown", (u) => {
    try {
      e.setPointerCapture(u.pointerId);
    } catch {
    }
    c = !0, r(u);
  }), e.addEventListener("pointermove", (u) => {
    const p = u;
    (p.pointerType === "mouse" || p.buttons > 0) && r(p);
  });
  const m = () => {
    c && (c = !1, l());
  };
  e.addEventListener("pointerup", m), e.addEventListener("pointercancel", m);
}
function h2(e, t, i, n, o = () => 1) {
  const s = o() || 1, a = (i * n + n / 2) * s;
  e.scrollLeft = Math.max(0, a - e.clientWidth / 2);
}
function ci(e, t, i) {
  const n = G0(t, i);
  if (!n || !e.querySelector(".chart-plot"))
    return W0(e)();
  e.dataset.chartScale = String(n.scale);
  for (const o of Wt) {
    const s = e.querySelector(o);
    if (!s) continue;
    const a = parseFloat(s.getAttribute("width") || "0");
    s.style.height = `${n.heightPx}px`, s.style.width = `${Nt(a, n).toFixed(2)}px`;
  }
  return e.querySelectorAll(".chart-lane").forEach((o) => {
    const s = /translateY\(([\d.]+)px\)/.exec(o.style.transform);
    s && !o.dataset.laneY && (o.dataset.laneY = s[1]);
    const a = Number(o.dataset.laneY ?? s?.[1] ?? 0);
    o.style.transform = `translateY(${jt(a, n).toFixed(2)}px)`;
  }), n.scale;
}
function W0(e) {
  return () => {
    const t = e.dataset.chartScale, i = t ? parseFloat(t) : 1;
    return Number.isFinite(i) && i > 0 ? i : 1;
  };
}
function di(e, t, i, n, o, s, a = !1) {
  const l = ai(o), r = li(o, t), { svg: c, geo: m } = I0(e, t, i, n, o), u = S2(o.laneChipY[0], "temp", t.laneTemp) + S2(o.laneChipY[1], "precip", t.lanePrecip) + S2(o.laneChipY[2], "wind", t.laneWind), p = Math.max(0, Math.min(e.length - 1, i)), x = a ? `<div class="scrub-rail" role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}"
         aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}"
         aria-valuenow="${p}" style="width:${m.width}px">
         <div class="scrub-grab" style="left:${(m.cx(p) / m.width * 100).toFixed(2)}%"></div>
       </div>
       <div class="scrub-cursor"></div>` : "";
  return `
    <div class="chart${s ? " chart-fs" : ""}">
      ${l}
      <div class="chart-scroll"${a ? "" : ` role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}" aria-valuenow="${p}"`}>
        ${x}
        ${u}
        ${c}
      </div>
      ${r}
    </div>`;
}
function pi(e, t, i = !0) {
  const n = t ? `<span class="legend-meta">${f(t)}</span>` : "", o = i ? `<span><span class="swatch-gust"></span>${f(e.legGust)}</span>` : "";
  return `
    <div class="legend chart-legend">
      <span><span class="swatch-temp chart-swatch-temp"></span>${f(e.legTemp)}</span>
      <span><span class="swatch-precip"></span>${f(e.legPrecip)}</span>
      <span><span class="swatch-pmax chart-swatch-pmax"></span>${f(e.legPmax)}</span>
      <span><span class="swatch-wind"></span>${f(e.legWind)}</span>
      ${o}
      ${n}
    </div>`;
}
function hi(e, t, i, n, o = !1, s = !1) {
  const a = e[t], l = a.tempC === null ? "–" : `${Math.round(a.tempC)}°`, r = a.tempC === null ? w.neutral : H2(Math.round(a.tempC)), c = t2(a.symbol), m = c ? `<img src="${f(c)}" width="34" height="34" alt="">` : "", u = f(o ? i.exitFullscreen : i.fullscreen), p = `<button class="chart-fs-btn" type="button" aria-label="${u}" title="${u}">${o ? R0 : ri}</button>`, x = s ? `<button class="ro-min" type="button" aria-label="${f(i.minimize)}"></button>
       <button class="ro-close" type="button" aria-label="${f(i.close)}"></button>` : "";
  return `
    <div class="readout readout-2a${s ? " readout-pop" : ""}">
      <div class="readout-main">
        <span class="ro-icon">${m}</span>
        <div class="readout-text">
          <div class="ro-time">${f(_2(a, i))}</div>
          <div class="ro-vals">
            <span class="ro-temp" style="color:${r}">${l}</span>
            <span class="ro-precip">${W(a.precipMm, 1, i)} mm</span>
            <span class="ro-wind">
              <span class="ro-wind-text">${f(i2(a))}</span>
              <span class="ro-arrow">${n2(a.dirDeg, 13, "#14202B")}</span>
              <span class="ro-compass">${f(b2(a.dirDeg, i))}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="readout-side">
        ${p}
        ${x}
      </div>
    </div>`;
}
function ui(e, t, i) {
  const n = i.expanded ?? !1, o = n ? ti : ei, s = (_, S = o) => {
    const L = Q2(S, t, _);
    return e.innerHTML = `
    <div class="graph-bare graph-panel">
      ${hi(t, Math.max(0, Math.min(t.length - 1, i.scrubIdx)), i.t, !0, n, i.fit ?? !1)}
      <div class="chart-fit">
        ${di(t, i.t, i.scrubIdx, i.nowIdx, L, n, i.fit ?? !1)}
      </div>
      ${pi(i.t, i.metaLine, v2(t))}
    </div>`, L;
  };
  let a = s(1);
  if (i.fit) {
    const _ = e.querySelector(".chart-fit"), S = _ ? G0(a.height, _.clientHeight) : null;
    if (S) {
      const L = Q2(o, t, S.scale);
      si(L, a) || (a = s(S.scale));
    }
  } else if (n) {
    const _ = e.querySelector(".chart-fit"), S = e.querySelector(".chart-scroll");
    _ && Z2(_.clientHeight, S, a.height) && (a = s(1, Zt(o, D0(_.clientHeight, S))));
  }
  let l = i.scrubIdx < 0 ? -1 : Math.min(t.length - 1, i.scrubIdx), r = l;
  const c = e.querySelector(".chart-plot"), m = e.querySelector(".chart-scroll"), u = e.querySelector(".chart-fit"), p = i.fit ? W0(e) : () => 1, x = e.querySelector(".scrub-rail"), v = x ?? m, z = e.querySelector(".scrub-grab"), B = e.querySelector(".chart-scroll > .scrub-cursor"), b = e.querySelector(".readout-pop"), M = () => {
    if (!(!i.fit || !u) && (ci(e, a.height, u.clientHeight), x && c.style.width)) {
      const _ = p();
      x.style.width = c.style.width, x.style.height = `${Math.round(a.plotTop * _)}px`, z && (z.style.top = `${Math.round(a.plotTop * _ - 5.5)}px`), B && l >= 0 && (B.style.left = `${k.cx(l) * _}px`);
    }
  }, { geo: k } = I0(
    t,
    i.t,
    l,
    i.nowIdx,
    a
  ), $ = (_) => e.querySelector(_), C = $(".chart-plot .scrub-cursor"), T = $(".scrub-dot-temp"), E = $(".scrub-dot-wind"), h = $(".ro-time"), d = $(".ro-temp"), g = $(".ro-precip"), F = $(".ro-wind-text"), A = $(".ro-arrow"), I = $(".ro-compass"), D = $(".ro-icon"), G = $(".readout"), N = e.querySelector(".chart-plot .chart-now-dot");
  let j, H;
  const q = () => {
    const _ = t[l], S = !_;
    G.classList.toggle("is-outside", S);
    for (const P of [C, T, E])
      S ? P.setAttribute("visibility", "hidden") : P.removeAttribute("visibility");
    S ? N?.setAttribute("visibility", "hidden") : N?.removeAttribute("visibility");
    for (const P of [z, B])
      P && (P.style.visibility = S ? "hidden" : "");
    if (S) {
      h.textContent = i.t.noForecastForTime, v.removeAttribute("aria-valuenow"), v.setAttribute("aria-valuetext", i.t.noForecastForTime);
      return;
    }
    const L = k.cx(l);
    if (C.setAttribute("x1", `${L}`), C.setAttribute("x2", `${L}`), T.setAttribute("cx", `${L}`), T.setAttribute("visibility", _.tempC === null ? "hidden" : "visible"), _.tempC !== null && T.setAttribute("cy", `${k.tempY(_.tempC)}`), E.setAttribute("cx", `${L}`), E.setAttribute("visibility", _.windMs === null ? "hidden" : "visible"), _.windMs !== null && E.setAttribute("cy", `${k.windY(_.windMs)}`), h.textContent = _2(_, i.t), d.textContent = _.tempC === null ? "–" : `${Math.round(_.tempC)}°`, d.style.color = _.tempC === null ? w.neutral : H2(Math.round(_.tempC)), g.textContent = `${W(_.precipMm, 1, i.t)} mm`, F.textContent = i2(_), _.dirDeg !== j && (A.innerHTML = n2(_.dirDeg, 13, "#14202B"), j = _.dirDeg), I.textContent = b2(_.dirDeg, i.t), _.symbol !== H) {
      const P = t2(_.symbol);
      D.innerHTML = P ? `<img src="${f(P)}" width="34" height="34" alt="">` : "", H = _.symbol;
    }
    z && (z.style.left = `${(L / k.width * 100).toFixed(2)}%`), B && (B.style.left = `${L * p()}px`), v.setAttribute("aria-valuenow", String(l)), v.setAttribute("aria-valuetext", S0(_, i.t)), b?.classList.remove("is-closed");
  };
  if (b) {
    const _ = e.querySelector(".ro-min");
    _?.addEventListener("click", () => {
      const P = b.classList.toggle("is-min");
      _.setAttribute("aria-label", P ? i.t.expand : i.t.minimize);
    }), e.querySelector(".ro-close")?.addEventListener("click", () => b.classList.add("is-closed"));
    let S = null;
    b.addEventListener("pointerdown", (P) => {
      const O = P;
      if (!O.target.closest(".ro-min, .ro-close")) {
        S = {
          sx: O.clientX,
          sy: O.clientY,
          ox: b.offsetLeft,
          oy: b.offsetTop
        }, b.style.left = `${b.offsetLeft}px`, b.style.top = `${b.offsetTop}px`, b.style.right = "auto", b.classList.add("is-dragging");
        try {
          b.setPointerCapture(O.pointerId);
        } catch {
        }
        O.preventDefault();
      }
    }), b.addEventListener("pointermove", (P) => {
      if (!S) return;
      const O = P, Z = b.offsetParent, a2 = (Z?.clientWidth ?? 0) - b.offsetWidth, K = (Z?.clientHeight ?? 0) - b.offsetHeight, o2 = Math.max(0, Math.min(a2, S.ox + (O.clientX - S.sx))), l2 = Math.max(0, Math.min(K, S.oy + (O.clientY - S.sy)));
      b.style.left = `${o2}px`, b.style.top = `${l2}px`;
    });
    const L = () => {
      S = null, b.classList.remove("is-dragging");
    };
    b.addEventListener("pointerup", L), b.addEventListener("pointercancel", L);
  }
  const J = () => {
    r = l, i.onScrub(l, !0);
  };
  if (i.previewHover) {
    const _ = i.previewHover;
    c.addEventListener("pointerleave", (S) => {
      !_() || S.pointerType !== "mouse" || S.buttons || l !== r && (l = r, q(), i.onScrub(l, !1));
    });
  }
  if (i.fit ? (c.style.touchAction = "pan-x", $0(c, (_) => {
    const S = c.getBoundingClientRect(), L = p() || 1, P = k.indexAt((_.clientX - S.left) / L);
    P !== l && (l = P, q(), i.onScrub(P, !1)), J();
  })) : e0(
    c,
    k,
    () => l,
    (_) => {
      l = _;
    },
    i.onScrub,
    q,
    p,
    J
  ), x && e0(
    x,
    k,
    () => l,
    (_) => {
      l = _;
    },
    i.onScrub,
    q,
    p,
    J
  ), v.addEventListener("keydown", (_) => {
    const S = z0(_.key, l, t.length);
    S !== null && (_.preventDefault(), _.stopPropagation(), S !== l && (l = S, q(), h2(m, k, l, a.colW, p), i.onScrub(l, !1), J()));
  }), M(), M0(m, p), h2(m, k, l, a.colW, p), q(), e.querySelector(".chart-fs-btn")?.addEventListener("click", () => i.onFullscreen?.()), i.fit && u && typeof ResizeObserver < "u") {
    const _ = new ResizeObserver(() => {
      if (!u.isConnected) {
        _.disconnect();
        return;
      }
      M(), h2(m, k, l, a.colW, p);
    });
    _.observe(u);
  }
  if (n && !i.fit && u && i.onRedraw && typeof ResizeObserver < "u") {
    const _ = i.onRedraw, S = new ResizeObserver(() => {
      if (!u.isConnected) {
        S.disconnect();
        return;
      }
      Z2(u.clientHeight, m, a.height) && (S.disconnect(), _());
    });
    S.observe(u);
  }
  return {
    // Moves the cursor without reporting back (-1 = outside the forecast).
    setScrubIdx: (_) => {
      l = _ < 0 ? -1 : Math.min(t.length - 1, _), r = l, q(), l >= 0 && h2(m, k, l, a.colW, p);
    }
  };
}
const fi = `
:host {
  --ink: #14202B;
  --haze: #4F5C66;
  --haze-2: #5E6B76;
  --frost: #E9EEF1;
  --paper: #FCFDFE;
  --tint: #EDF1F4;
  --line: #DCE3E8;
  --line-soft: #EAEEF1;
  --aurora: #1E8E6B;
  /* --aurora as TEXT: the accent itself is 4.1:1 on white (3.6:1 on its own
     haze), so labels drawn in it use this darker step. */
  --aurora-ink: #177457;
  --aurora-haze: rgba(30, 142, 107, 0.10);

  display: block;
  font-family: 'Nunito', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--ink);
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* Host fills the map overlay but must not eat clicks — only .page.wide does. */
  pointer-events: none;
}
.bel-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
* { box-sizing: border-box; }

/* Visible keyboard focus (quality floor) */
button:focus-visible,
input:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--aurora);
  outline-offset: 2px;
}

/* The host is pointer-events: none (see :host), and in graph mode the card is
   all there is — no .page to turn clicks back on — so without this the chart
   ignored hover, taps and the wheel, and the error card's Retry was dead. */
.card {
  background: var(--paper);
  border-radius: 20px;
  padding: 16px 0 6px;
  box-shadow: 0 1px 2px rgba(20, 32, 43, 0.06);
  pointer-events: auto;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 16px 8px;
}
.title { font-size: 15px; font-weight: 900; color: var(--ink); }
.hint { font-size: 11px; font-weight: 700; color: var(--haze-2); }

/* Chart row: pinned left axis · scrolling plot · pinned right axis. Only the
   middle column scrolls, so both value scales stay put at every scroll offset
   (same structure as the desktop .chart). */
.mg-chart {
  display: flex;
  align-items: flex-start;
}
/* Reserved columns, never squeezed by the plot. Inert on purpose: a press or
   hover that lands on a tick label must fall through to the card, not read as a
   scrub or block the sheet drag. */
.mg-axis,
.mg-axis-right {
  flex: none;
  pointer-events: none;
}
.scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  /* min-width:0 lets the plot column actually shrink inside the flex row
     instead of forcing .mg-chart wider than the card at 320px. */
  flex: 1;
  min-width: 0;
}
/* Labels must never steal pointer events from the scrub strip */
.scroll svg text { pointer-events: none; }

/* Scrub readout — pinned above the chart, always visible (v3) */
.readout {
  margin: 0 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--tint);
  border-radius: 14px;
  padding: 9px 14px;
}
.ro-time { font-size: 11px; font-weight: 800; color: var(--haze); }
/* A host-chosen time the forecast does not cover: the readout drops its values
   and says so in one quiet line, and the cursor is hidden (see columnAtTime). */
.readout.is-outside .ro-vals, .readout.is-outside .ro-icon { display: none; }
.readout.is-outside .ro-time { font-size: 13px; line-height: 22px; }
.ro-vals {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 2px;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}
.ro-temp { font-size: 19px; font-weight: 900; }
.ro-precip { font-size: 13px; font-weight: 800; color: ${w.precipText}; }
.ro-wind {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 800;
  color: var(--ink);
}
.ro-icon { flex: none; display: flex; }

/* Pinned lane chips: zero-height sticky wrappers before the SVG keep lane
   identity visible while scrolling. The left axis is now a reserved column
   outside this scroller, so the chips no longer need to clear a gutter. */
.lane-chip-wrap {
  position: sticky;
  left: 4px;
  width: max-content;
  height: 0;
  z-index: 2;
}
.lane-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(252, 253, 254, 0.92);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 800;
  color: var(--haze);
}
.chip-swatch-temp { width: 10px; height: 2.5px; background: ${w.temp}; border-radius: 2px; }
.chip-swatch-precip { width: 7px; height: 9px; background: ${w.precip}; border-radius: 2px; }
.chip-swatch-wind { width: 10px; height: 2.5px; background: ${w.wind}; border-radius: 2px; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px 16px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--haze);
}
.legend span { display: flex; align-items: center; gap: 5px; }
.swatch-temp { width: 14px; height: 2.5px; background: ${w.temp}; border-radius: 2px; }
.swatch-precip { width: 8px; height: 10px; background: ${w.precip}; border-radius: 2px; }
.swatch-pmax { width: 8px; height: 10px; background: ${w.precipMax}; border-radius: 2px; }
.swatch-wind { width: 14px; height: 2.5px; background: ${w.wind}; border-radius: 2px; }
.swatch-gust { width: 14px; height: 0; border-top: 2.5px dashed ${w.gust}; }

/* Loading skeleton (graph-only mode) */
.skeleton {
  height: 358px;
  margin: 0 16px;
  border-radius: 14px;
  background: linear-gradient(90deg, #E4EAEE 25%, #EFF2F5 50%, #E4EAEE 75%);
  background-size: 200% 100%;
  animation: bel-shimmer 1.4s infinite;
}
.loading-label {
  padding: 10px 16px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--haze);
}
@keyframes bel-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton, .sk { animation: none; }
  .page-close, .tab { transition: none; }
}

/* Error + retry */
.error {
  padding: 28px 16px 22px;
  text-align: center;
}
.error-msg { font-size: 14px; font-weight: 700; color: var(--haze); margin-bottom: 12px; }
.retry {
  border: none;
  border-radius: 13px;
  padding: 12px 22px;
  min-height: 44px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
  background: var(--ink);
  cursor: pointer;
}

/* ===================================================================== */
/* Full landing mode (mode="full")                                        */
/*                                                                        */
/* The layout is switched in JS at a 900px viewport breakpoint: the       */
/* component adds .wide or .narrow to .page.                              */
/*   .narrow — the mobile sheet.                    */
/*   .wide   — map panel: draggable panel over the map                 */
/* ===================================================================== */
.page {
  position: relative;
  margin: 0 auto;
  background: var(--bel-meteogram-bg, var(--frost));
  border-radius: var(--bel-meteogram-radius, 0);
  -webkit-backdrop-filter: var(--bel-meteogram-backdrop, none);
  backdrop-filter: var(--bel-meteogram-backdrop, none);
  display: flex;
  flex-direction: column;
  color: var(--ink);
}
.page.narrow {
  max-width: var(--bel-meteogram-max-width, 430px);
  pointer-events: auto;
}
/* Map panel: draggable floating panel (440 px) over the map host. */
.page.wide {
  position: absolute;
  /* width/height are set inline by panelStyleAttr() (resize grip). These are
     fallbacks only; no max-* caps, or they would clamp the inline size. */
  width: var(--bel-meteogram-panel-width, 440px);
  height: min(840px, calc(100% - 36px));
  overflow: hidden;
  pointer-events: auto;
  background: var(--bel-meteogram-bg, rgba(252, 253, 254, 0.95));
  border-radius: var(--bel-meteogram-radius, 22px);
  -webkit-backdrop-filter: var(--bel-meteogram-backdrop, blur(10px));
  backdrop-filter: var(--bel-meteogram-backdrop, blur(10px));
  box-shadow: 0 14px 44px rgba(13, 30, 45, 0.30);
}
.page.wide-2a .panel-drag {
  cursor: grab;
  touch-action: none;
  user-select: none;
  gap: 8px;
  padding: 12px 14px 8px;
  justify-content: flex-start;
}
.page.wide-2a .panel-pill {
  flex: 1;
  min-width: 0;
  max-width: none;
}

/* ── Full-screen landscape (phone/tablet held horizontally) ──────────────────
   A short landscape phone can't fit two columns, so the widget fills the modal
   edge-to-edge and shows ONE view at a time with a Table/Graph toggle:
     · Graph → the meteogram fills the whole sheet (full width, fit-scaled height).
     · Table → weather-now card + day chips + hourly table in one scroll column.
   Pinned, not draggable (drag grip inert, resize grip removed). No font-size
   changes — only layout, padding and what chrome is shown. */
.page.wide.is-fullscreen {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  max-width: none;
  border-radius: 0;
  box-shadow: none;
  background: var(--bel-meteogram-bg, var(--frost));
}
.is-fullscreen .panel-drag { cursor: default; }
.is-fullscreen .panel-resize { display: none; }
.is-fullscreen .chart-fs-btn { display: none; }
/* The legend + meta footer would each eat a row of the short viewport; the
   in-chart lane chips (Hiti/Úrkoma/Vindur) and scrub readout already cover them. */
/* Landscape shows a slim single-row key below the graph (temp / precip / wind /
   gust — the dashed gust line has no in-chart chip otherwise), with the
   analysis + last-update line folded in on the right (.legend-meta). The
   standalone meta footer stays hidden — this row carries it. */
.is-fullscreen .chart-legend {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 12px;
  padding: 3px 12px;
  font-size: 10px;
}
/* The analysis + last-update line is folded into the legend row (right-aligned)
   on BOTH desktop and landscape, replacing the standalone meta footer in graph
   view (hidden below). On the narrow desktop panel it simply wraps to its own
   line at the bottom of the legend. */
.chart-legend .legend-meta {
  margin-left: auto;
  color: var(--haze-2);
  font-weight: 700;
  white-space: nowrap;
}
.is-fullscreen .meta-footer { display: none; }
/* Graph view carries the meta in its legend, so drop the duplicate footer.
   Table view keeps the footer (it has no graph legend). */
.page.view-graph .meta-footer { display: none; }
/* Slim the chrome so the selected view gets the height. On a short landscape
   viewport every row above the graph steals legibility, so reclaim aggressively:
   the location block is redundant here (the header pill already carries
   model · place · lang). NOTE: the landscape page is BOTH .wide and
   .is-fullscreen, and the ".wide .tab" / ".pill" rules appear LATER in this
   file — so these overrides must out-specify them (a ".page.is-fullscreen" /
   ".is-fullscreen.view-graph" compound prefix), not just rely on source order. */
.is-fullscreen .panel-loc { display: none; }
/* Table/Graph toggle — slimmer in both landscape views. */
.page.is-fullscreen .tabs { margin: 3px 14px; padding: 2px; flex: none; }
.page.is-fullscreen .tab { padding: 3px 0; font-size: 12px; border-radius: 9px; }
/* Compress the header + station-select pill in BOTH landscape views so the
   chrome band above the content is as slim as possible. The .page.is-fullscreen
   prefix out-specifies the later .pill rules; source order alone loses. */
/* space-between overrides the .page.wide-2a .panel-drag flex-start so the
   (now content-sized) pill sits CENTRED — drag grip far left, ✕ far right,
   pill in the middle, clear of the side notch. */
.page.is-fullscreen .panel-header { padding: 3px 12px 0; justify-content: space-between; }
.page.is-fullscreen .panel-pill {
  min-height: 28px;
  padding: 4px 12px;
  font-size: 12px;
  /* Override .page.wide-2a .panel-pill (flex:1 / max-width:none): in landscape
     the pill must NOT stretch across the row, or it runs under the side notch.
     Content-sized + capped + centred by the header's space-between keeps it
     comfortably clear of the safe-area edges. */
  flex: 0 1 auto;
  max-width: min(320px, 60vw);
}
.page.is-fullscreen .header-close { width: 30px; height: 30px; }
/* Graph view fills the sheet; the chart is fit-scaled in JS so it must not add
   its own vertical scrollbar. */
.is-fullscreen .graph-view-2a { flex: 1; min-height: 0; }
.is-fullscreen .chart-fit { overflow: hidden; }
/* Landscape: the scrub readout is a floating popup over the chart (top-right),
   NOT a chrome band — so the graph fills the whole height and the values are
   still one scrub away. It can be minimized (time + temp only) or closed
   (moving the scrubber reopens it). */
.is-fullscreen .graph-panel { position: relative; }
.is-fullscreen .readout-pop {
  position: absolute;
  top: 6px;
  right: 10px;
  z-index: 6;
  margin: 0;
  width: auto;
  max-width: 66%;
  padding: 5px 8px 6px 12px;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(252, 253, 254, 0.94);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px rgba(13, 30, 45, 0.16);
  /* Draggable: grab anywhere but the buttons; touch-action:none so a touch drag
     moves the popup instead of panning the chart underneath. */
  cursor: grab;
  touch-action: none;
}
.is-fullscreen .readout-pop.is-dragging { cursor: grabbing; box-shadow: 0 10px 26px rgba(13, 30, 45, 0.24); }
.is-fullscreen .readout-pop .ro-min,
.is-fullscreen .readout-pop .ro-close { cursor: pointer; }
.is-fullscreen .readout-pop .ro-icon img { width: 24px; height: 24px; }
/* Minimized — keep just the time + temperature. */
.is-fullscreen .readout-pop.is-min .ro-precip,
.is-fullscreen .readout-pop.is-min .ro-wind,
.is-fullscreen .readout-pop.is-min .ro-icon { display: none; }
.is-fullscreen .readout-pop.is-closed { display: none; }
/* Popup controls — hidden outside the landscape popup. */
.ro-min, .ro-close { display: none; }
.is-fullscreen .readout-pop .ro-min,
.is-fullscreen .readout-pop .ro-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: var(--tint);
  color: var(--haze);
  font: 800 15px/1 inherit;
  cursor: pointer;
}
.is-fullscreen .readout-pop .ro-min::before { content: "–"; }
.is-fullscreen .readout-pop.is-min .ro-min::before { content: "+"; }
.is-fullscreen .readout-pop .ro-close::before { content: "×"; font-size: 17px; }
/* Very short landscape (Safari with its toolbar showing leaves ~260–320px) —
   the graph is the priority, so slim the remaining bands (tabs + legend). */
@media (orientation: landscape) and (max-height: 380px) {
  .is-fullscreen .chart-legend { padding: 1px 12px; }
  .page.is-fullscreen .tab { padding: 2px 0; }
}
/* Table view: one scrolling column (no nested scroll on the table itself). */
.is-fullscreen .ls-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.is-fullscreen .ls-scroll .panel-table {
  flex: none;
  min-height: 0;
  overflow: visible;
}
.is-fullscreen .ls-scroll .now-stats { grid-template-columns: 1fr 1fr 1fr; }
.is-fullscreen .ls-scroll .stat--wind-card { grid-column: auto; }

/* Built-in close affordance (the "closable" attribute). On mobile it floats
   over the location block; on desktop it sits inline in the header. */
.page-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  border: none;
  background: rgba(252, 253, 254, 0.7);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
  transition: background 0.15s;
}
.page-close:hover { background: rgba(252, 253, 254, 0.95); }

/* Desktop panel header (1b): selector chip (left) + close ✕ (right) */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 8px;
  flex: none;
}
.panel-pill {
  width: auto;
  max-width: 300px;
  gap: 7px;
  background: var(--tint);
  border-radius: 12px;
  padding: 8px 12px;
  min-height: 38px;
  font-size: 12px;
}
.panel-pill span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header-close {
  width: 38px;
  height: 38px;
  flex: none;
  border: none;
  background: var(--tint);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Mobile centered location block */
.loc { text-align: center; padding: 12px 20px 2px; }
.loc-name {
  margin: 0;
  font-size: 29px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.3px;
}
.loc-sub { font-size: 13px; font-weight: 700; color: var(--haze); margin-top: 2px; }
.narrow.page--closable .loc { padding: 12px 60px 2px; }

/* Desktop panel location block (left-aligned) */
.panel-loc { padding: 0 18px 4px; flex: none; }
.panel-loc-name { font-size: 24px; font-weight: 900; color: var(--ink); letter-spacing: -0.3px; }
.panel-loc-sub { font-size: 12px; font-weight: 700; color: var(--haze); }
/* Host note under the coordinates: the forecast is for a nearby station */
.loc-note { font-size: 12px; font-weight: 600; color: var(--haze-2); margin-top: 2px; }
/* Corrected-forecast badge, after the coordinates on the location line */
.corrected {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 6px;
  border-radius: 999px;
  background: var(--aurora-haze);
  color: var(--aurora-ink);
  vertical-align: -5px;
  cursor: help;
}

.pill-wrap { padding: 10px 16px 0; }
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: rgba(252, 253, 254, 0.7);
  border-radius: 14px;
  padding: 9px 14px;
  min-height: 40px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--haze);
  cursor: pointer;
}

/* "Weather now" card — quiet masthead block over the frost surface (no card) */
.now-wrap { padding: 12px 16px 2px; }
.now { background: transparent; border-radius: 0; padding: 6px 6px 4px; }
.now-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--haze);
}
.now-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 10px;
}
.now-temp { line-height: 1.1; font-weight: 900; }
.now-icon { display: flex; align-items: center; }
.now-stats { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; }
.stat { background: var(--paper); border-radius: 14px; padding: 9px 11px; box-shadow: 0 1px 2px rgba(20, 32, 43, 0.05); }
.stat-label { font-size: 11px; font-weight: 700; color: var(--haze); }
.stat-value { font-size: 17px; font-weight: 900; color: var(--ink); }
/* Wind is Iceland's signature variable — mark its card with the aurora edge. */
.stat--wind-card { box-shadow: inset 2px 0 0 var(--aurora), 0 1px 2px rgba(20, 32, 43, 0.05); }
.stat-wind { display: flex; align-items: center; gap: 5px; }

/* Mobile Table/Graph segmented control */
.tabs {
  margin: 12px 16px;
  display: flex;
  background: var(--line);
  border-radius: 17px;
  padding: 4px;
}
.tab {
  flex: 1;
  border: none;
  border-radius: 13px;
  padding: 12px 0;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: var(--haze);
}
.tab.on {
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 1px 3px rgba(20, 32, 43, 0.12);
}

.temp-sep { color: var(--haze-2); font-weight: 700; }

/* ===================================================================== */
/* Desktop docked panel (map-panel 1b) — overrides scoped to .wide        */
/* ===================================================================== */

/* Fixed sections don't shrink; the table/graph region takes the rest. */
.wide .now,
.wide .day-chips,
.wide .tabs { flex: none; }

/* Compact weather-now card */
.wide .now { margin: 4px 14px 0; border-radius: 0; padding: 4px 4px 8px; }
.wide .now-eyebrow { font-size: 10px; letter-spacing: 1.2px; }
.wide .now-main { margin: 0 0 8px; }
.wide .now-stats { gap: 6px; }
.wide .stat { border-radius: 12px; padding: 7px 9px; }
.wide .stat-label { font-size: 10px; }
.wide .stat-value { font-size: 15px; }

/* Compact day chips — 76 px is the FLOOR, not the width. The docked panel omits
   the date line and every chip lands on 76; landscape keeps the date line, and a
   chip that cannot grow clips its own text out past both rounded edges (any
   locale whose date is wider than the box: "12 September", "12 września"). */
.wide .day-chips { --dc-pad: 14px; --dc-gap: 6px; padding: 10px 0 4px; }
.wide .day-chip {
  background: var(--paper);
  border-radius: 14px;
  padding: 7px 10px 6px;
  width: auto;
  min-width: 76px;
  box-sizing: border-box;
  box-shadow: none;
}
.wide .day-chip.sel { border-color: var(--aurora); background: var(--aurora-haze); }
.wide .dc-name { font-size: 12.5px; }
.wide .dc-icon { margin: 2px 0 1px; }
.wide .dc-temps { font-size: 12.5px; }

/* Table/Graph switch */
.wide .tabs { margin: 8px 14px 6px; background: var(--line); border-radius: 13px; padding: 3px; }
.wide .tab { border-radius: 10px; padding: 9px 0; font-size: 13.5px; }
.wide .tab.on { box-shadow: 0 1px 3px rgba(20, 32, 43, 0.14); }

/* ── Resizable panel (map panel) ────────────────────────────────────────────
   The panel's width/height are set inline by panelStyleAttr(); the bottom-left
   grip drives resize. Past the width breakpoint the body switches to the two
   columns below (weather-now + table left, graph right); the meta footer sits
   under both. */
.panel-resize {
  position: absolute;
  bottom: 0;
  width: 24px;
  height: 24px;
  z-index: 4;
  touch-action: none;
}
.panel-resize-bl { left: 0; cursor: nesw-resize; }
.panel-resize-br { right: 0; cursor: nwse-resize; }
/* Visible corner-bracket affordance so users see the panel is
   resizable; brightens to the aurora accent on hover. */
.panel-resize::before {
  content: "";
  position: absolute;
  bottom: 6px;
  width: 10px;
  height: 10px;
  border-bottom: 2px solid var(--haze-2);
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
  opacity: 0.85;
}
.panel-resize-bl::before {
  left: 6px;
  border-left: 2px solid var(--haze-2);
  border-bottom-right-radius: 0;
}
.panel-resize-br::before {
  right: 6px;
  border-right: 2px solid var(--haze-2);
  border-bottom-left-radius: 0;
}
.panel-resize:hover::before { opacity: 1; border-color: var(--aurora); }
/* One-time first-open pulse to hint the resize affordance. */
@keyframes bel-resize-hint {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.4); opacity: 1; }
}
.panel-resize.hint::before {
  border-color: var(--aurora);
  transform-origin: bottom center;
  animation: bel-resize-hint 1s ease-in-out 2;
}

/* Table / Graph / Both: the docked panel's segmented control, at the width of
   the left column so it doesn't stretch across a wide panel. */
.exp-bar { flex: none; display: flex; align-items: center; justify-content: space-between; padding-right: 14px; }
.wide .exp-tabs { flex: none; width: 272px; margin: 4px 14px 6px; }
.wide .exp-tabs .tab { padding: 6px 0; font-size: 12.5px; }
.exp-body { flex: 1; min-height: 0; display: flex; }
/* One view on its own takes the whole width. */
.exp-table .exp-left { flex: 1; width: auto; }
.exp-table .exp-left .now-stats { grid-template-columns: 1fr 1fr 1.3fr; }
.exp-table .exp-left .stat--wind-card { grid-column: auto; }
.exp-graph .exp-right { margin-left: 0; border-radius: 14px 14px 0 0; box-shadow: none; }
.exp-left {
  flex: none;
  width: 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 6px;
}
.exp-left .now-wrap { padding: 2px 14px 2px; }
.exp-left .now { padding: 0; }
.exp-left .now-main { margin: 2px 0 10px; gap: 10px; }
.exp-left .now-stats { grid-template-columns: 1fr 1fr; }
.exp-left .stat--wind-card { grid-column: 1 / -1; }
.exp-left .day-chips { --dc-pad: 14px; padding: 6px 0 8px; }
.exp-left .panel-table { flex: 1; min-height: 0; overflow-y: auto; }
.exp-right {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border-radius: 14px 0 0 0;
  margin-left: 8px;
  box-shadow: -1px 0 0 var(--line);
  overflow: hidden;
}
.exp-right .graph-view-2a,
.exp-right .graph-host,
.exp-right .graph-panel { flex: 1; min-height: 0; }
/* The expanded chart is drawn at the column's height less its own horizontal
   scrollbar (expandedChartHeight), so the column never scrolls vertically: a
   vertical scroll here is what pushed that scrollbar below the visible bottom. */
.exp-right .chart-fit { overflow-y: hidden; }

/* Table view — scrolling 24 h table with sticky header */
.panel-table { flex: 1; min-height: 70px; overflow-y: auto; padding: 0 16px 12px; }
.hrow-p {
  display: grid;
  grid-template-columns: 38px 28px 1fr 0.9fr 1.3fr;
  align-items: center;
  padding: 5px 8px;
  border-top: 1px solid var(--line-soft);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
.panel-table .hrow-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(252, 253, 254, 0.96);
  border-top: none;
  padding: 4px 8px 5px;
  font-size: 10px;
  letter-spacing: 0.4px;
}

/* Meta footer (analysis · last update) */
.meta-footer {
  flex: none;
  border-top: 1px solid var(--line);
  padding: 8px 16px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--haze-2);
  line-height: 1.5;
}

/* Graph view — map-panel meteogram */
.graph-view-2a {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: flex-start;
}
.graph-view.graph-view-2a {
  justify-content: flex-start;
  overflow: hidden;
}
.graph-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.graph-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: flex-start;
}
/* The chart fills the available height; it should not introduce its own
   vertical scrollbar — the SVG is sized to fit the lane region. */
.chart-fit {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* B1: in the docked 1-column panel, keep the compact chart at its natural
   height and let the whole graph block (readout + chart + legend) scroll if the
   panel is too short — so the wind lane, legend and folded-in meta line are
   never clipped-and-unreachable. A scrollbar only appears when it actually
   overflows; at a comfortable size the full meteogram fits with no scroll.
   The landscape (is-fullscreen) view fit-scales and the expanded (is-expanded)
   two-column view scrolls its own .exp-right column — both excluded here. */
.page.wide:not(.is-fullscreen):not(.is-expanded) .graph-panel { overflow-y: auto; }
.page.wide:not(.is-fullscreen):not(.is-expanded) .chart-fit {
  flex: none;
  overflow: visible;
}
.readout-2a {
  margin: 0 14px 6px;
  padding: 8px 12px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--tint);
  flex: none;
}
/* Icon sits beside the values on the left (C3); text block can shrink/wrap. */
.readout-main { min-width: 0; display: flex; align-items: center; gap: 10px; }
.readout-text { min-width: 0; }
.readout-2a .ro-icon { flex: none; }
.readout-2a .ro-time { white-space: nowrap; }
.readout-2a .ro-temp { font-size: 17px; }
.readout-2a .ro-precip, .readout-2a .ro-wind { font-size: 12px; }
.readout-side { display: flex; align-items: center; gap: 8px; flex: none; }
.chart-fs-btn {
  width: 32px;
  height: 32px;
  flex: none;
  border: none;
  background: var(--tint);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.chart {
  display: flex;
  align-items: flex-start;
  flex: none;
  padding-left: 14px;
}
.chart-lane {
  pointer-events: none;
}
/* Pinned right-hand precip (mm) scale — stays put while the plot scrolls. */
.chart-axis-right { flex: none; }
/* The chart is routinely several times wider than the panel — a five-day run at
   42px a column is ~3100px in a ~360px box — so this is the reader's only route
   to most of the forecast, and it has to look like one.

   overflow-y is CLIPPED, not visible: when one axis is a scrolling value, CSS
   promotes "visible" on the other axis to "auto", so this box was quietly
   reserving room for a horizontal scrollbar inside its own height. On a platform
   with scrollbars that take space, those ~15px pushed the content past the graph
   panel and raised a vertical scrollbar nobody needed.

   (No backticks in this file's comments — the whole stylesheet is one template
   literal, and a stray one builds a corrupted bundle without erroring.) */
.chart-scroll {
  overflow-x: auto;
  overflow-y: clip;
  flex: 1;
  min-width: 0;
  position: relative;
  -webkit-overflow-scrolling: touch;
}
/* A standing rail under the plot, on pointer devices only.

   macOS gives WebKit overlay scrollbars that fade within a second of the last
   scroll, so on a desktop there was nothing at all to say that ~89% of the
   forecast lay to the right — it only appeared when the panel was resized.
   Styling the scrollbar opts out of the overlay behaviour. Touch devices keep
   the native overlay: a swipe is its own affordance there, and a permanent
   rail would cost real height on a short phone in landscape.

   12px with a thumb at 4.1 : 1 against the panel, so the bar can be seen and
   grabbed: until the chart has an overview scrubber, it is the only way along
   the chart with a mouse. No scrollbar-width / scrollbar-color here: a browser
   that supports those ignores the ::-webkit-scrollbar sizes, and drew its own
   thin, faint bar instead. */
@media (hover: hover) and (pointer: fine) {
  .chart-scroll::-webkit-scrollbar { height: 12px; }
  .chart-scroll::-webkit-scrollbar-track {
    background: transparent;
    margin: 0 2px;
  }
  .chart-scroll::-webkit-scrollbar-thumb {
    background: #6E7E8A;
    border-radius: 6px;
  }
  .chart-scroll::-webkit-scrollbar-thumb:hover { background: #4F5C66; }
}
.chart-scroll svg text { pointer-events: none; }
.chart-lane .chart-chip { font-size: 10px; padding: 2px 7px; border-radius: 7px; }
/* The .chart-swatch-* overrides that used to re-colour the panel's legend are
   gone: both charts now draw from DATA_COLORS, so there is nothing to override. */
.chart-legend { flex: none; gap: 5px 11px; padding: 6px 16px 14px; font-size: 10px; }

/* ── Time scrubber — subtle dot on the chart's top edge ──────────────────
   An invisible 24px drag strip overlaid on the top of the plot, carrying a
   small aurora dot on the cursor line that drops into the lanes. Zero chrome,
   zero height cost. Drag the strip or the plot itself; ←/→ = 1 h,
   PgUp/PgDn = 24 h (role="slider"). Rendered only in fullscreen landscape. */
.scrub-rail {
  position: absolute;
  top: 0;
  left: 0;
  height: 24px;
  z-index: 3;
  touch-action: none;
  cursor: ew-resize;
}
.scrub-grab {
  position: absolute;
  top: 15px; /* centered on the plot-area top edge; kept in sync with the fit-scale by JS */
  transform: translateX(-50%);
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--aurora);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(13, 30, 45, 0.3);
  pointer-events: none;
}
/* Chart cursor driven by the scrubber (inside .chart-scroll, over the plot).
   The child combinator keeps this off the SVG <line class="scrub-cursor">. */
.chart-scroll > .scrub-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px solid rgba(20, 32, 43, 0.35);
  pointer-events: none;
  z-index: 2;
}
/* The HTML cursor + top-edge dot replace the in-SVG dashed cursor and lane
   dots in fullscreen landscape (the design wants a single minimal line). */
.is-fullscreen .chart-plot .scrub-cursor,
.is-fullscreen .chart-plot .scrub-dot-temp,
.is-fullscreen .chart-plot .scrub-dot-wind {
  display: none;
}

/* Expanded overlay — a centred, size-capped panel over the map host (NOT a
   full-bleed inset, which is oversized on large monitors). The split variant is
   two columns: left = weather-now + hourly table, right = the large graph. */

/* Legacy graph view (mobile) — vertically-centered compact meteogram */
.graph-view { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; justify-content: center; }
.graph-compact .readout { margin: 0 14px 8px; padding: 9px 13px; }
.graph-compact .ro-time { font-size: 10.5px; }
.graph-compact .ro-temp { font-size: 18px; }
.graph-compact .ro-precip, .graph-compact .ro-wind { font-size: 12.5px; }
.graph-compact .legend { gap: 6px 12px; padding: 6px 16px 12px; font-size: 10px; }

/* ---- Mobile day-chip row + selected-day card ---- */
/* Every chip is as wide as the widest one: a content-sized chip made "Á morgun"
   wider than "Fim" beside it, and the row read as ragged. The track is a grid of
   1fr columns sized at max-content, which the grid algorithm resolves to the
   widest chip's width for every column. The side gutter lives on the track, not
   the scroller, so it survives at the scrolled end in every engine. */
.day-chips {
  --dc-pad: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 2px 0 10px;
  scroll-padding-inline: var(--dc-pad);
  scroll-snap-type: x proximity;
}
.dc-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--dc-gap, 8px);
  width: max-content;
  padding: 0 var(--dc-pad);
}
.day-chip {
  scroll-snap-align: start;
  background: var(--paper);
  border: 2px solid transparent;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(20, 32, 43, 0.06);
  padding: 9px 13px 8px;
  min-width: 86px;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
}
.day-chip.sel { border-color: var(--aurora); background: var(--aurora-haze); }
.dc-name { font-size: 13.5px; font-weight: 800; color: var(--ink); white-space: nowrap; }
.dc-date { font-size: 11px; font-weight: 700; color: var(--haze); white-space: nowrap; }
.dc-icon { display: flex; justify-content: center; margin: 3px 0 2px; }
.dc-temps { font-size: 13.5px; font-weight: 900; white-space: nowrap; font-variant-numeric: tabular-nums; }

.sel-wrap { padding: 0 16px; }
.sel-card {
  background: var(--paper);
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(20, 32, 43, 0.06);
  padding: 12px 16px 14px;
}
.sel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
}
.sel-title { font-size: 15px; font-weight: 900; color: var(--ink); }
.sel-date { font-weight: 700; color: var(--haze); font-size: 12px; }
/* Day summary: one labelled stat per column of the table underneath, laid out on
   the same rhythm so the eye reads each figure as the heading of its column. */
.sel-stats {
  display: flex;
  gap: 18px;
  padding: 2px 0 10px;
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: 4px;
}
.sel-stat { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.sel-stat-label {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--haze);
}
.sel-stat-value {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--ink);
  white-space: nowrap;
}
.sel-stat-precip { color: ${w.precipText}; }
.panel-table .sel-stats { padding: 0 0 9px; }

/* Hourly rows shared by the mobile selected-day card (46/34 grid). The side
   padding clears the "now" rail below — see .hrow-now. */
.hrow {
  display: grid;
  grid-template-columns: 46px 34px 1fr 1fr 1.2fr;
  align-items: center;
  padding: 5px 8px;
  border-top: 1px solid var(--line-soft);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
/* The hour containing "now", in both the mobile card (.hrow) and the desktop
   panel table (.hrow-p). Today's rows start at the forecast's analysis hour
   rather than midnight, so the current hour is never a fixed row — this is the
   anchor that makes its position legible instead of something to hunt for. */
.hrow-now {
  background: var(--aurora-haze);
  box-shadow: inset 2px 0 0 var(--aurora);
}
/* The rail is a marker beside the hour, not a stroke through it: every row —
   marked or not, header included — carries the same 8px gutter, so the rail has
   room to read and no column shifts when the marker moves down the table. */
.hrow-now .h-time { color: var(--aurora-ink); font-weight: 900; }
.hrow-head {
  border-top: none;
  padding: 4px 8px 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--haze);
}
.hrow-head .h-temp, .hrow-head .h-precip { text-align: right; font-weight: 800; color: var(--haze); }
.h-wind-h { text-align: right; }
.h-time { font-weight: 800; color: var(--ink); }
.h-icon { display: flex; }
.h-temp { text-align: right; font-weight: 900; }
.h-precip { text-align: right; font-weight: 700; color: ${w.precipText}; }
.h-wind {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}

/* Mobile graph view wrapper */
.graph-wrap { padding: 0 16px 8px; }
/* Bare graph card (desktop detail panel supplies the surface + header) */
.graph-bare { padding-bottom: 2px; }

/* Loading skeletons (full mode) */
.sk {
  background: linear-gradient(90deg, #E4EAEE 25%, #EFF2F5 50%, #E4EAEE 75%);
  background-size: 200% 100%;
  animation: bel-shimmer 1.4s infinite;
  border-radius: 20px;
}
.sk-now { height: 190px; border-radius: 20px; }
.sk-row { height: 58px; border-radius: 16px; }
.sk-rows { display: flex; flex-direction: column; gap: 10px; }
.narrow .sk-now { margin: 12px 16px 2px; }
.narrow .sk-rows { padding: 12px 16px 16px; }
.wide .sk-now { margin: 8px 14px 0; height: 150px; }
.wide .sk-rows { padding: 12px 14px; }

/* Settings overlay — centred dialog on roomy screens, fullscreen when the
   viewport is narrow OR short. The min-height:480 guard is essential: a phone in
   LANDSCAPE is wide (>560) but short, so the centred dialog (max-height:84vh)
   squeezed the flex station list to zero height and it couldn't scroll. Below
   480px tall it goes fullscreen so the list keeps real, scrollable height. */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  background: rgba(13, 30, 45, 0.45);
}
.overlay {
  background: var(--frost);
  width: 100%;
  height: 100%;
  padding: 18px 16px 10px;
  display: flex;
  flex-direction: column;
}
@media (min-width: 560px) and (min-height: 480px) {
  .backdrop {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .overlay {
    max-width: 420px;
    height: auto;
    max-height: 84vh;
    border-radius: 24px;
    padding: 20px 20px 14px;
    box-shadow: 0 20px 60px rgba(13, 30, 45, 0.35);
  }
  /* Long station lists: show ~8 rows in the dialog, scroll for the rest */
  .station-list { max-height: 384px; }
}
.overlay-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex: none;
}
.overlay-title { font-size: 19px; font-weight: 900; color: var(--ink); }
.overlay-close {
  width: 44px;
  height: 44px;
  flex: none;
  border: none;
  background: var(--tint);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
/* Settings body: single column by default; the short-viewport (landscape)
   media query below switches it to a two-column grid. */
.ov-cols {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.ov-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.ov-col--station { flex: 1; }
.section-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--haze);
  margin-bottom: 7px;
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.chip {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  background: var(--tint);
  color: var(--haze);
}
.chip.on { background: var(--ink); color: #ffffff; }
.station-search {
  width: 100%;
  box-sizing: border-box;
  flex: none;
  padding: 13px 16px;
  border-radius: 14px;
  border: 1.5px solid var(--line);
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  background: var(--paper);
}
.station-search:focus { outline: 2px solid var(--aurora); }
/* The dialog takes focus on open so the next Tab starts inside it; it is a
   container, not a control, so it draws no ring of its own. */
.overlay:focus { outline: none; }
.station-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  /* iOS won't momentum-scroll a flex child whose height is purely implied;
     touch-action:pan-y makes the vertical drag scroll rather than being eaten. */
  touch-action: pan-y;
  flex: 1;
  min-height: 0;
  margin-top: 4px;
}
.station {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none;
  background: none;
  padding: 12px 4px;
  min-height: 48px;
  font-family: inherit;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
  text-align: left;
}
.station-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 800;
  color: var(--ink);
}
.station-sub {
  font-size: 12px;
  font-weight: 700;
  color: var(--haze-2);
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: none;
}
/* The distance is what the list is ordered by, so it leads and carries the
   weight; the coordinate stays as the quiet identifier it always was. */
.station-dist {
  font-weight: 800;
  color: var(--haze);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.station-coord { white-space: nowrap; }
@media (max-width: 430px) {
  /* A phone has no room for both; the distance is the useful half. */
  .station-coord { display: none; }
}
.station.sel .station-name { color: var(--aurora-ink); }

/* Short viewport (a phone in landscape ≈ 320–430px tall): edge-to-edge dialog
   split into two columns so nothing is below the fold — model + language chips
   left, station search + independently-scrolling list right (the base
   .station-list rules provide the scroll). Hairline between the columns. */
@media (max-height: 479px) {
  /* The settings overlay is position:fixed, so it fills the raw viewport and
     escapes the host's safe-area padding — a phone held in landscape puts the
     notch on a side, so inset the overlay by the safe area (falling back to the
     18px design gutter) or the Model/Language column sits under the notch. */
  .overlay {
    padding-top: max(12px, env(safe-area-inset-top));
    padding-right: max(18px, env(safe-area-inset-right));
    padding-bottom: 0;
    padding-left: max(18px, env(safe-area-inset-left));
  }
  .overlay .overlay-head { margin-bottom: 8px; }
  .overlay .overlay-title { font-size: 18px; }
  .overlay .overlay-close { width: 40px; height: 40px; }
  .ov-cols {
    display: grid;
    grid-template-columns: 272px minmax(0, 1fr);
    column-gap: 24px;
  }
  .ov-col--station { border-left: 1px solid var(--line); padding-left: 24px; }
  .ov-cols--single { grid-template-columns: minmax(0, 1fr); }
  .ov-cols--single .ov-col--station { border-left: 0; padding-left: 0; }
  .ov-col--station .station-list { margin-top: 6px; padding-bottom: 10px; }
  .overlay .station-search { padding: 10px 14px; font-size: 15px; }
  .overlay .station { padding: 8px 4px; min-height: 44px; }
  .overlay .station-name { font-size: 15px; }
  .overlay .chips { margin-bottom: 14px; }
}
`, mi = `
:host {
  --ink: #14202B;
  --frost: #E9EEF1;
  --line: #DCE3E8;
  font-family: 'Nunito', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }

.scrim {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(13, 30, 45, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--frost);
  border-radius: 26px 26px 0 0;
  box-shadow: 0 -14px 40px rgba(13, 30, 45, 0.25);
  padding: 8px 16px calc(22px + env(safe-area-inset-bottom, 0px));
  touch-action: none;
  transition: transform 0.2s ease-out;
}
.grabber {
  width: 42px;
  height: 5px;
  border-radius: 3px;
  background: var(--line);
  margin: 4px auto 8px;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 12px;
}
.sheet-title {
  font-size: 20px;
  font-weight: 900;
  color: var(--ink);
  letter-spacing: -0.3px;
}
.close {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 14px;
  background: rgba(252, 253, 254, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: none; }
}
`, gi = {
  clear_no_rain: "01",
  fair_no_rain: "02",
  scattered_no_rain: "03",
  scattered_little_rain: "40",
  scattered_some_rain: "05",
  scattered_much_rain: "41",
  scattered_little_sleet: "42",
  scattered_some_sleet: "07",
  scattered_much_sleet: "43",
  scattered_little_snow: "44",
  scattered_some_snow: "08",
  scattered_much_snow: "45",
  overcast_no_rain: "04",
  overcast_little_rain: "46",
  overcast_some_rain: "09",
  overcast_much_rain: "10",
  overcast_little_sleet: "47",
  overcast_some_sleet: "12",
  overcast_much_sleet: "48",
  overcast_little_snow: "49",
  overcast_some_snow: "13",
  overcast_much_snow: "50"
};
function N0(e, t, i, n, o = 1) {
  if (t === null || n === null || !e && e !== 0)
    return "";
  let s;
  e < 0.1 * o ? s = "no" : e < 0.3 * o ? s = "little" : e < 3 * o ? s = "some" : s = "much";
  let a;
  t < 0.25 ? a = s === "no" ? "clear" : "scattered" : t < 0.5 ? a = s === "no" ? "fair" : "scattered" : t < 0.75 ? a = "scattered" : a = "overcast";
  let l;
  !i && i !== 0 || i < 0.33 || s === "no" ? l = "rain" : i < 0.66 ? l = "sleet" : l = "snow";
  const r = gi[`${a}_${s}_${l}`];
  if (!r) return "";
  let c = "";
  return a !== "overcast" && (c = n < 0.75 ? "n" : "d"), `${r}${c}`;
}
const t0 = [
  { max: 12, min: 8, rain: [12, 19, 0.9], wind: 6, dir: 220, cloud: 0.85 },
  { max: 13, min: 9, rain: null, wind: 4, dir: 180, cloud: 0.4 },
  { max: 11, min: 8, rain: [6, 16, 1.4], wind: 8, dir: 160, cloud: 0.9 },
  { max: 14, min: 9, rain: null, wind: 3, dir: 90, cloud: 0.1 },
  { max: 12, min: 8, rain: [14, 20, 0.4], wind: 5, dir: 200, cloud: 0.5 },
  { max: 10, min: 7, rain: [3, 21, 1.8], wind: 10, dir: 150, cloud: 0.95 },
  { max: 13, min: 8, rain: null, wind: 5, dir: 250, cloud: 0.45 }
], xi = 3;
function vi(e) {
  const t = /* @__PURE__ */ new Date();
  t.setUTCMinutes(0, 0, 0), t.setTime(t.getTime() - xi * 36e5);
  const i = Date.UTC(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate()
  ), n = [];
  for (let o = 0; o < e; o++) {
    const s = t.getTime() + o * 36e5, a = new Date(s), l = a.getUTCHours(), r = Math.round(
      (Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - i) / 864e5
    ), c = t0[r % t0.length], m = Math.round(
      c.min + (c.max - c.min) * (0.5 - 0.5 * Math.cos((l - 4) / 24 * 2 * Math.PI))
    );
    let u = 0;
    c.rain && l >= c.rain[0] && l < c.rain[1] && (u = Math.round(
      c.rain[2] * (0.4 + 0.6 * Math.sin(Math.PI * (l - c.rain[0]) / (c.rain[1] - c.rain[0]))) * 10
    ) / 10);
    const p = Math.max(1, c.wind + Math.round(1.5 * Math.sin((l - 15) / 24 * 2 * Math.PI))), x = l >= 4 && l <= 23 ? 1 : 0;
    n.push({
      local: new Date(s),
      utcMs: s,
      tempC: m,
      precipMm: u,
      precipMaxMm: u > 0 ? Math.round(u * 1.6 * 10) / 10 : 0,
      windMs: p,
      gustMs: Math.round(p * 1.8),
      dirDeg: (c.dir + Math.round(20 * Math.sin(l / 8)) + 360) % 360,
      symbol: N0(u, u > 0 ? 0.9 : c.cloud, 0, x)
    });
  }
  return n;
}
const bi = [
  { name: "Reykjavík", lat: 64.146, lon: -21.942 },
  { name: "Kópavogur", lat: 64.11, lon: -21.91 },
  { name: "Akranes", lat: 64.32, lon: -22.07 },
  { name: "Keflavík", lat: 64, lon: -22.56 },
  { name: "Selfoss", lat: 63.93, lon: -21 },
  { name: "Vík í Mýrdal", lat: 63.42, lon: -19.01 },
  { name: "Ísafjörður", lat: 66.07, lon: -23.13 },
  { name: "Akureyri", lat: 65.68, lon: -18.09 },
  { name: "Egilsstaðir", lat: 65.26, lon: -14.39 },
  { name: "Höfn í Hornafirði", lat: 64.25, lon: -15.21 },
  { name: "Hveravellir", lat: 64.87, lon: -19.56 }
], i0 = [
  { id: "sample/harmonie", name: "HARMONIE 2.5 km" },
  { id: "sample/wrf9", name: "WRF 9 km" },
  { id: "sample/ecmwf", name: "ECMWF 0.1°" }
], _i = 36e5;
function V(e, t, i) {
  let n;
  try {
    n = e.data?.[t];
  } catch {
  }
  const o = Array.isArray(n) ? n : [];
  return Array.from({ length: i }, (s, a) => {
    const l = o[a];
    return typeof l == "number" && Number.isFinite(l) ? l : null;
  });
}
function yi(e) {
  let t = [];
  try {
    t = Object.values(e.data ?? {}).filter((i) => Array.isArray(i) && i.length > 0).map((i) => i.length);
  } catch {
  }
  return t.length ? Math.min(...t) : Number.POSITIVE_INFINITY;
}
function wi(e) {
  return e.some((t) => t !== null);
}
function $i(e, t) {
  const i = e.time;
  if (!i || i.length < 2) return [];
  const n = (new Date(i[1]).getTime() - new Date(i[0]).getTime()) / _i, o = e.meta?.location_timezone_offset ?? 0, s = Math.min(
    i.length,
    yi(e),
    Math.ceil(t / n)
  );
  if (!(s > 0)) return [];
  const a = V(e, "air_temperature_at_2m_agl", s), l = V(e, "lwe_precipitation_rate", s), r = V(e, "lwe_precipitation_rate_max", s), c = V(e, "wind_speed_at_10m_agl", s), m = V(e, "wind_speed_of_gust_at_10m_agl", s), u = V(e, "wind_from_direction_at_10m_agl", s), p = V(e, "cloud_area_fraction", s), x = V(e, "snow_fraction", s), v = V(e, "daylight_fraction", s), z = wi(m), B = [];
  for (let b = 0; b < s; b++) {
    const M = l[b], k = r[b] ?? M, $ = new Date(i[b]).getTime();
    B.push({
      local: new Date($ + o * 6e4),
      utcMs: $,
      tempC: a[b],
      // `== null` deliberately, not `===`: a missing value has to read as "no
      // rain", and `undefined * timestepH` is NaN, which paints nothing at all.
      precipMm: M == null ? 0 : M * n,
      precipMaxMm: k == null ? 0 : k * n,
      windMs: c[b],
      gustMs: z ? m[b] : null,
      dirDeg: u[b],
      symbol: N0(M, p[b], x[b], v[b], n)
    });
  }
  return B;
}
const o0 = /* @__PURE__ */ new Map();
function j0(e) {
  const t = o0.get(e);
  if (t !== void 0) return t;
  let i = null;
  try {
    i = new Intl.DateTimeFormat("en-US", {
      timeZone: e,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric"
    });
  } catch (n) {
    if (!(n instanceof RangeError)) throw n;
    console.warn(
      `bel-meteogram: unknown display-time-zone "${e}"; showing the point's own time`
    );
  }
  return o0.set(e, i), i;
}
function Mi(e) {
  return j0(e) !== null;
}
function q0(e, t) {
  const i = j0(e);
  if (!i) return null;
  const n = {};
  for (const a of i.formatToParts(new Date(t)))
    a.type !== "literal" && (n[a.type] = Number(a.value));
  const o = Date.UTC(n.year, n.month - 1, n.day, n.hour % 24, n.minute), s = Math.floor(t / 6e4) * 6e4;
  return Math.round((o - s) / 6e4);
}
function ki(e, t) {
  return !t || !Mi(t) ? e : e.map((i) => ({
    ...i,
    local: new Date(i.utcMs + (q0(t, i.utcMs) ?? 0) * 6e4)
  }));
}
function Bi(e, t, i) {
  const n = t ? q0(t, i) : null;
  return n === null || n === e ? e : n;
}
const s0 = "bel-meteogram-nunito", Si = 168, zi = 12, Y0 = "mimirMapPanelState", Ci = 440, u2 = 700, f2 = 360, n0 = 620, z2 = 360;
function V0() {
  try {
    const e = localStorage.getItem(Y0);
    if (!e) return {};
    const t = JSON.parse(e);
    return t && typeof t == "object" ? t : {};
  } catch {
    return {};
  }
}
function Ti(e) {
  try {
    const t = V0();
    localStorage.setItem(
      Y0,
      JSON.stringify({ ...t, ...e })
    );
  } catch {
  }
}
function Fi() {
  if (document.getElementById(s0)) return;
  const e = document.createElement("link");
  e.id = s0, e.rel = "stylesheet", e.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap", document.head.appendChild(e);
}
function C2(e, t) {
  return typeof e == "string" ? e : e[t] ?? e.is ?? e.en ?? Object.values(e)[0] ?? "";
}
function T2(e, t) {
  try {
    localStorage.setItem(`bel-meteogram.${e}`, t);
  } catch {
  }
}
function F2(e) {
  try {
    return localStorage.getItem(`bel-meteogram.${e}`);
  } catch {
    return null;
  }
}
function Ei(e) {
  if (!(e instanceof HTMLElement) || !e.classList.length) return null;
  const t = CSS.escape(e.classList[0]);
  for (const i of ["day", "view", "lang", "model"]) {
    const n = e.dataset[i];
    if (n !== void 0) return `.${t}[data-${i}="${CSS.escape(n)}"]`;
  }
  return `.${t}`;
}
const a0 = ".ls-scroll, .panel-table";
function Ai(e) {
  return e instanceof HTMLElement ? e.isContentEditable || e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement ? !0 : e instanceof HTMLInputElement ? !["button", "checkbox", "radio", "reset", "submit"].includes(e.type) : !1 : !1;
}
class I2 extends HTMLElement {
  static observedAttributes = [
    "location-lat",
    "location-lon",
    "hours",
    "language",
    "mode",
    "forecast-label",
    "analysis-time",
    "last-updated",
    "station-place",
    "station-place-km",
    "selected-time",
    "display-time-zone"
  ];
  root;
  body;
  points = [];
  /** The points on the forecast point's own clock, before `display-time-zone`. */
  pointClockPoints = [];
  status = "loading";
  started = !1;
  loadToken = 0;
  /** Cancels the load in flight: a newer load, or the element leaving the page. */
  loadAbort = null;
  /** Guards setAttribute calls that must not retrigger load() */
  suppressAttrCallback = !1;
  // Full-mode state
  rawForecasts = [];
  rawStations = [];
  /** Variables the shown forecast has corrected against station observations */
  corrections = [];
  /** The station they were corrected for */
  correctedStation = null;
  forecastId = "";
  pickedPlaceName = "";
  view = "table";
  /** The expanded panel's view, separate from the docked panel's Table/Graph. */
  expandedView = "both";
  /** Shared by the mobile day chips and the desktop day list (0 = today) */
  selectedDay = 0;
  settingsOpen = !1;
  query = "";
  scrubIdx = -1;
  // -1 → default to the "now" hour
  /**
   * A scrubbed hour carried across page loads, as an instant. Kept separately
   * from `scrubIdx` (which stays an index, because that is what the renderers
   * speak) and resolved against whichever series is about to be drawn — see
   * restoreScrubIndex.
   */
  scrubUtcMs = null;
  /**
   * The instant the host's `selected-time` selects, or null when the host does
   * not drive the time. Kept apart from `scrubUtcMs` so a host-set time is never
   * persisted as the reader's own scrub (a reload would then fight the host). A
   * committed scrub by the reader moves it too, so a repaint keeps their hour
   * until the host answers with a new `selected-time`.
   */
  hostTimeMs = null;
  /** The last `bel-meteogram-time` reported (time|tempC), to skip repeats. */
  lastTimeKey = null;
  /** Desktop (two-column) layout when the viewport is ≥ 900px */
  isWide = !1;
  /** Map panel: draggable position within the host */
  panelPos = { x: -1, y: 18 };
  resizeRaf = 0;
  /** User-set panel size (0 → use the default 440 × host-height). */
  panelSize = { w: 0, h: 0 };
  analysisTime = null;
  /**
   * The forecast point's UTC offset in minutes, as the API reports it
   * (`local = UTC + offset`), or null when unknown — sample mode, a failed load,
   * or a response without the field. Kept raw: the chart already has the offset
   * baked into its local timestamps, this is what LABELS which zone those are.
   */
  tzOffsetMin = null;
  lastModified = null;
  graphScrubSetter = null;
  /** The exact series the mounted chart was drawn from, so that anything acting
   *  on a column index (the ←/→ keys) addresses the columns actually on screen */
  renderedGraphPoints = [];
  /** The cursor column that series was drawn with. Not the same as `scrubIdx`:
   *  a cursor restored from `scrubUtcMs` is on screen while `scrubIdx` is still
   *  -1 ("the user has not scrubbed"), and the keys must start from what is
   *  drawn rather than from the sentinel's fallback. */
  renderedScrubIdx = 0;
  /** Pending {@link scheduleGraphRefit} frame, and the chart height that frame's
   *  predecessor drew at (-1 = no drag in progress). */
  refitRaf = 0;
  refitHeight = -1;
  onKeyDown = (t) => {
    if (!this.isFull || t.defaultPrevented || t.altKey || t.ctrlKey || t.metaKey) return;
    if (t.key === "Escape" && this.settingsOpen && this.closeOverlay) {
      t.preventDefault(), this.closeOverlay();
      return;
    }
    if (!this.usesPanel || Ai(t.composedPath()[0])) return;
    if (t.key === "Escape" && this.isExpanded()) {
      t.preventDefault(), this.collapsePanel();
      return;
    }
    if (this.view !== "graph" || !this.points.length) return;
    const i = this.renderedGraphPoints;
    if (!i.length) return;
    let n = this.scrubIdx >= 0 ? this.scrubIdx : this.renderedScrubIdx;
    if (t.key === "ArrowLeft")
      t.preventDefault(), n = Math.max(0, n - 1);
    else if (t.key === "ArrowRight")
      t.preventDefault(), n = Math.min(i.length - 1, n + 1);
    else
      return;
    this.graphScrubSetter?.(n), this.onUserScrub(i, n, !0);
  };
  mql = matchMedia("(min-width: 900px)");
  onBreakpoint = () => {
    this.isWide !== this.mql.matches && (this.isWide = this.mql.matches, this.isFull && this.paint());
  };
  /** Full-screen edge-to-edge layout on a phone/tablet held in landscape:
   *  the widget fills the whole modal and uses the graph-led two-column body. */
  isLandscape = !1;
  mqlLandscape = matchMedia(
    "(hover: none) and (pointer: coarse) and (orientation: landscape)"
  );
  onLandscape = () => {
    this.isLandscape !== this.mqlLandscape.matches && (this.isLandscape = this.mqlLandscape.matches, this.isFull && this.paint());
  };
  /** True when the panel layout is used (draggable desktop panel OR the
   *  full-screen landscape sheet) rather than the single-column mobile sheet. */
  get usesPanel() {
    return this.isWide || this.isLandscape;
  }
  constructor() {
    super(), this.root = this.attachShadow({ mode: "open" });
    const t = document.createElement("style");
    t.textContent = fi, this.root.appendChild(t), this.body = document.createElement("div"), this.body.className = "bel-root", this.root.appendChild(this.body);
  }
  get isFull() {
    return this.getAttribute("mode") === "full";
  }
  get uiLang() {
    return this.getAttribute("language") ?? (this.isFull ? F2("lang") ?? "is" : "is");
  }
  get t() {
    return p0(this.uiLang);
  }
  get hours() {
    const t = parseInt(this.getAttribute("hours") ?? "", 10);
    return Number.isFinite(t) && t > 0 ? t : 48;
  }
  connectedCallback() {
    Fi(), this.started = !0, this.isWide = this.mql.matches, this.isLandscape = this.mqlLandscape.matches;
    const t = this.isFull ? V0() : {};
    typeof t.selectedDay == "number" && (this.selectedDay = t.selectedDay), typeof t.scrubUtcMs == "number" && (this.scrubUtcMs = t.scrubUtcMs), (t.view === "table" || t.view === "graph") && (this.view = t.view), this.expandedView = X2(t.expandedView), t.panelPos && typeof t.panelPos.x == "number" && typeof t.panelPos.y == "number" && (this.panelPos = { ...t.panelPos }), t.panelSize && typeof t.panelSize.w == "number" && typeof t.panelSize.h == "number" && (this.panelSize = { ...t.panelSize });
    const i = this.getAttribute("view");
    i === "graph" || i === "table" ? this.view = i : t.view || (this.view = this.isWide ? "graph" : "table"), this.mql.addEventListener("change", this.onBreakpoint), this.mqlLandscape.addEventListener("change", this.onLandscape), document.addEventListener("keydown", this.onKeyDown), window.addEventListener("resize", this.onResize), this.hostTimeMs = this.selectedTimeAttr(), this.load(), requestAnimationFrame(() => {
      this.onBreakpoint(), this.onLandscape();
    });
  }
  disconnectedCallback() {
    this.loadAbort?.abort(), this.loadAbort = null, this.mql.removeEventListener("change", this.onBreakpoint), this.mqlLandscape.removeEventListener("change", this.onLandscape), document.removeEventListener("keydown", this.onKeyDown), window.removeEventListener("resize", this.onResize), this.resizeRaf && cancelAnimationFrame(this.resizeRaf), this.cancelGraphRefit(), this.persistTimer && this.persistMapPanel();
  }
  /**
   * Keep the draggable panel inside the host on viewport resize. Without this a
   * panel dragged/sized to the right/bottom is left off-screen when the window
   * (map host) shrinks. panelStyleAttr() re-clamps position and size against the
   * live host on every render, so a repaint is all that is needed here.
   * rAF-coalesced so a drag-resize doesn't thrash paint().
   */
  onResize = () => {
    !this.isFull || !this.usesPanel || (this.resizeRaf && cancelAnimationFrame(this.resizeRaf), this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0, this.paint(), this.persistMapPanel();
    }));
  };
  /** The host's display clock: an IANA zone name, or null for the point's own. */
  get displayTimeZone() {
    return this.getAttribute("display-time-zone")?.trim() || null;
  }
  /** Keep the points as loaded, and show them on the display clock. */
  setPoints(t) {
    this.pointClockPoints = t, this.points = ki(t, this.displayTimeZone);
  }
  attributeChangedCallback(t) {
    if (!(!this.started || this.suppressAttrCallback)) {
      if (t === "selected-time") {
        this.applySelectedTime();
        return;
      }
      if (t === "display-time-zone") {
        this.setPoints(this.pointClockPoints), this.paint();
        return;
      }
      t === "language" || t === "forecast-label" || t === "analysis-time" || t === "last-updated" || t === "station-place" || t === "station-place-km" ? this.paint() : this.load();
    }
  }
  /** Point the widget at a new location (kept from the previous widget's API) */
  loadChartLocation(t, i, n = "") {
    this.pickedPlaceName = n, this.suppressAttrCallback = !0, this.setAttribute("location-lat", String(t)), this.setAttribute("location-lon", String(i)), this.suppressAttrCallback = !1, this.load();
  }
  /**
   * Open the settings dialog at its station search, with the search field
   * focused on a device with a fine pointer (not on a phone, where focusing it
   * would pop the keyboard up). Full mode only: graph mode has no dialog.
   */
  openSearch() {
    this.isFull && (this.settingsOpen = !0, this.focusAfterPaint = Bt(matchMedia("(pointer: fine)").matches), this.paint());
  }
  emitStatus(t) {
    this.dispatchEvent(
      new CustomEvent("bel-meteogram-status", {
        detail: { status: this.status, ...t ? { error: t } : {} }
      })
    );
  }
  /**
   * Announce the currently-selected point so a host page can place/move its
   * map pin. Fired on every successful load — initial, station pick, model
   * change or a programmatic loadChartLocation() — carrying the resolved place
   * name and the "now" temperature so the host can render the pin label
   * ("{place} · {temp}°").
   */
  /** Selector to focus after the next paint, overriding "whatever had focus"
   *  (opening the settings dialog focuses the dialog, closing it the pill). */
  focusAfterPaint = null;
  /** Closes the settings dialog while it is open (set by its wiring). */
  closeOverlay = null;
  /** Pending {@link persistScrubSoon} write */
  persistTimer = 0;
  /**
   * Persist after scrubbing settles. A hover sweep changes column a dozen times
   * a second, and each write is a synchronous localStorage read, parse,
   * stringify and write on the pointer-move path.
   */
  persistScrubSoon() {
    clearTimeout(this.persistTimer), this.persistTimer = window.setTimeout(() => this.persistMapPanel(), 250);
  }
  persistMapPanel() {
    if (clearTimeout(this.persistTimer), this.persistTimer = 0, !this.isFull || !this.usesPanel) return;
    const t = this.hostTimeMs === null ? { selectedDay: this.selectedDay, scrubUtcMs: this.scrubUtcMs ?? void 0 } : {};
    Ti({
      ...t,
      view: this.view,
      expandedView: this.expandedView,
      panelPos: this.panelPos.x >= 0 ? { x: this.panelPos.x, y: this.panelPos.y } : void 0,
      panelSize: this.panelSize.w > 0 ? { w: this.panelSize.w, h: this.panelSize.h } : void 0
    });
  }
  /** Available host width/height (fallbacks keep sample/detached states sane). */
  hostW() {
    return this.clientWidth || 900;
  }
  hostH() {
    return this.clientHeight || 840;
  }
  /** Rendered panel width after resolving defaults + clamping to the host. */
  resolvedPanelW() {
    const t = this.panelSize.w > 0 ? this.panelSize.w : Ci;
    return Math.max(f2, Math.min(this.hostW() - 24, t));
  }
  /** Minimum panel height for the current layout (one-column needs more). */
  minPanelH() {
    const t = this.resolvedPanelW() >= u2 ? z2 : n0;
    return Math.min(t, this.hostH() - 24);
  }
  /** Rendered panel height after resolving defaults + clamping to the host. */
  resolvedPanelH() {
    const t = this.hostH() - 24, i = Math.min(840, t), n = this.panelSize.h > 0 ? this.panelSize.h : i;
    return Math.max(this.minPanelH(), Math.min(t, n));
  }
  /** Two-column layout once the panel is at least EXPAND_THRESHOLD wide. */
  isExpanded() {
    return this.resolvedPanelW() >= u2;
  }
  /** Collapse back to the default single-column card (keeps position). */
  collapsePanel() {
    this.panelSize = { w: 0, h: 0 }, this.persistMapPanel(), this.paint();
  }
  /** Inset kept around a maximised panel so the map still frames it and the
   *  reader can see they are looking at a panel rather than a new page. */
  static MAXIMISE_INSET = 18;
  /**
   * Fill the host, less a thin margin.
   *
   * This used to stop at 920×760 regardless of the window, which on a wide
   * screen left the control labelled "fullscreen" opening something under half
   * the width — and the chart still scrolling at 11% of a five-day run. A
   * maximise that does not maximise is worse than none: the reader concludes
   * that is all the room there is and stops looking for more.
   */
  expandPanel() {
    const t = I2.MAXIMISE_INSET;
    this.panelPos = { x: t, y: t }, this.panelSize = {
      w: Math.max(f2, this.hostW() - t * 2),
      h: Math.max(z2, this.hostH() - t * 2)
    }, this.persistMapPanel(), this.paint();
  }
  metaLine(t) {
    const i = this.getAttribute("analysis-time"), n = i ? new Date(i) : this.analysisTime, o = this.getAttribute("last-updated"), s = o ? new Date(o) : this.lastModified, a = (l) => l && !isNaN(l.getTime()) ? $t(l, t) : "–";
    return t.metaLine(a(n), a(s));
  }
  /**
   * Inline left/top/width/height for the draggable panel. Resolves the user's
   * size (or defaults), clamps both size and position to the live host box —
   * so a stored size/position that is now off-screen (window shrunk or reload
   * at a smaller size) snaps back in — and writes the clamped position back.
   */
  panelStyleAttr() {
    const t = this.hostW(), i = this.hostH(), n = this.resolvedPanelW(), o = this.resolvedPanelH(), s = this.panelPos.x >= 0 ? this.panelPos : { x: t - n - 18, y: Math.min(48, Math.max(18, Math.round(i * 0.02))) }, a = Math.max(0, Math.min(t - n, s.x)), l = Math.max(0, Math.min(i - o, s.y));
    return this.panelPos = { x: a, y: l }, ` style="left:${a}px;top:${l}px;width:${n}px;height:${o}px"`;
  }
  emitLocation() {
    const t = parseFloat(this.getAttribute("location-lat") ?? ""), i = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(t) || isNaN(i)) return;
    const n = this.placeName(this.placeList(t, i), t, i, this.t), o = this.points[m2(this.points)]?.tempC ?? null;
    this.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: {
          lat: t,
          lon: i,
          name: n,
          tempC: o === null ? null : Math.round(o),
          // API variables corrected against station observations ([] = none)
          corrections: this.corrections
        },
        bubbles: !0,
        composed: !0
      })
    );
  }
  async load() {
    const t = ++this.loadToken;
    this.loadAbort?.abort();
    const i = new AbortController();
    this.loadAbort = i;
    const { signal: n } = i;
    if (this.scrubIdx = -1, this.lastTimeKey = null, this.hasAttribute("sample")) {
      this.corrections = [], this.correctedStation = null, this.setPoints(vi(this.isFull ? Si : this.hours)), this.isFull && (this.rawForecasts = i0.map((r) => ({ ...r, url: "" })), this.rawStations = bi.map((r, c) => ({
        id: `sample-${c}`,
        name: r.name,
        lat: r.lat,
        lon: r.lon
      })), this.forecastId || (this.forecastId = i0[0].id));
      const l = /* @__PURE__ */ new Date();
      this.lastModified = l, this.analysisTime = new Date(
        Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())
      ), this.status = "ready", this.followHostTime(), this.paint(), this.emitStatus(), this.emitLocation(), this.emitHostTime();
      return;
    }
    const o = parseFloat(this.getAttribute("location-lat") ?? ""), s = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(o) || isNaN(s)) {
      this.status = "error", this.paint(), this.emitStatus("missing location-lat/location-lon");
      return;
    }
    this.status = "loading", this.paint(), this.emitStatus();
    const a = {
      clientName: this.getAttribute("client-name") ?? "",
      apiUrl: this.getAttribute("api-url") ?? void 0,
      user: this.getAttribute("api-user") ?? void 0,
      password: this.getAttribute("api-password") ?? void 0
    };
    try {
      const l = await Z0(a, n), r = Q0(
        this.getAttribute("forecast-type"),
        this.getAttribute("forecast-name"),
        this.getAttribute("domain")
      ), c = this.forecastId || r || (this.isFull ? F2("model") ?? "" : "");
      let m = ee(l, c);
      if (!m && c !== r && (m = l[0]), !m) throw new Error(`forecast not found: ${c}`);
      this.forecastId = m.id;
      const u = await te(m.url, n), p = this.isFull ? 1 / 0 : this.hours, x = this.isFull ? void 0 : this.hours, v = d0(u) ? oe(u.stations ?? [], o, s) : null, z = v ? await w2(
        y2(u, o, s, x, v.extra?.ref),
        a,
        n
      ).catch((M) => {
        if (n.aborted) throw M;
        return console.warn("bel-meteogram: station data failed, using the point", M), w2(y2(u, o, s, x), a, n);
      }) : await w2(y2(u, o, s, x), a, n);
      if (t !== this.loadToken) return;
      this.rawForecasts = l, this.rawStations = u.stations ?? [], this.corrections = Object.keys(z.data.meta?.corrections ?? {}), this.correctedStation = this.corrections.length ? v : null, this.setPoints($i(z.data, p));
      const B = z.data.meta?.location_timezone_offset;
      this.tzOffsetMin = typeof B == "number" ? B : null;
      const b = se(
        z.data,
        z.lastModified,
        this.points[0]?.utcMs
      );
      this.analysisTime = b.analysisTime, this.lastModified = b.lastModified, this.status = this.points.length ? "ready" : "error", this.status === "ready" && this.followHostTime(), this.paint(), this.emitStatus(this.points.length ? void 0 : "empty forecast"), this.status === "ready" && (this.emitLocation(), this.emitHostTime());
    } catch (l) {
      if (t !== this.loadToken || n.aborted) return;
      console.error("bel-meteogram: failed to load forecast", l), this.status = "error", this.paint(), this.emitStatus(l instanceof Error ? l.message : String(l));
    }
  }
  // ---- Painting ----
  /**
   * Which layout regime the panel is in. One definition, because paintFull and
   * the resize refit have to agree: landscape phones/tablets get the
   * full-screen edge-to-edge sheet, the 900px breakpoint drives the floating
   * desktop panel, and only that panel expands to two columns (a short
   * landscape phone can't fit them).
   */
  layoutFlags() {
    const t = this.isLandscape;
    return {
      landscape: t,
      wide: this.isWide || t,
      expanded: this.status === "ready" && this.isWide && !t && this.isExpanded()
    };
  }
  /**
   * Re-render the graph column mid-drag, so a resize shows the chart you are
   * choosing instead of snapping to it when you let go.
   *
   * Two economies keep the drag smooth: one rebuild per frame at most, and only
   * once the column's height has moved by {@link REFIT_QUANTUM}. A long chart is
   * ~8ms of HTML parse on its own, so rebuilding it every pixel would drop
   * frames — the panel box tracks the pointer continuously, the chart follows in
   * small steps, and the settle paint on release lands on the exact height.
   */
  scheduleGraphRefit() {
    this.refitRaf || (this.refitRaf = requestAnimationFrame(() => {
      this.refitRaf = 0;
      const i = this.body.querySelector(".chart-fit")?.clientHeight ?? 0;
      if (!i || Math.abs(i - this.refitHeight) < zi) return;
      this.refitHeight = i;
      const n = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, { landscape: o, wide: s, expanded: a } = this.layoutFlags();
      if (this.paintGraphHost(o, a, s, this.t), n > 0) {
        const l = this.body.querySelector(".chart-scroll");
        l && (l.scrollLeft = n);
      }
    }));
  }
  /**
   * Draw the expanded graph again for its column's current height, when the
   * chart asks (renderMapPanelGraph's onRedraw): the column changed height
   * with nothing resized, e.g. once the panel's web font has loaded. On the
   * next frame, sharing the refit frame, so a drag's refit and this one don't
   * both run, and holding the horizontal scroll as a refit does.
   */
  redrawGraphForColumn() {
    this.refitRaf || (this.refitRaf = requestAnimationFrame(() => {
      this.refitRaf = 0;
      const t = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, { landscape: i, wide: n, expanded: o } = this.layoutFlags();
      if (this.paintGraphHost(i, o, n, this.t), t > 0) {
        const s = this.body.querySelector(".chart-scroll");
        s && (s.scrollLeft = t);
      }
    }));
  }
  /** Drop any pending refit frame — the caller is about to repaint anyway. */
  cancelGraphRefit() {
    this.refitRaf && cancelAnimationFrame(this.refitRaf), this.refitRaf = 0, this.refitHeight = -1;
  }
  paint() {
    const i = this.body.querySelector(a0)?.scrollTop ?? 0, o = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, s = this.body.querySelector(".day-chips")?.scrollLeft ?? 0, a = this.focusAfterPaint ?? Ei(this.root.activeElement);
    this.focusAfterPaint = null, this.isFull ? this.paintFull() : this.paintGraph();
    const l = this.body.querySelector(".day-chips");
    if (l) {
      l.scrollLeft = s;
      const r = l.querySelector(".day-chip.sel");
      if (r) {
        const c = parseFloat(getComputedStyle(l).scrollPaddingLeft) || 0, m = r.offsetLeft - l.offsetLeft - c, u = r.offsetLeft - l.offsetLeft + r.offsetWidth + c;
        m < l.scrollLeft ? l.scrollLeft = m : u > l.scrollLeft + l.clientWidth && (l.scrollLeft = u - l.clientWidth);
      }
    }
    if (a && this.body.querySelector(a)?.focus({ preventScroll: !0 }), i > 0) {
      const r = this.body.querySelector(a0);
      r && (r.scrollTop = i);
    }
    if (o > 0) {
      const r = this.body.querySelector(".chart-scroll");
      r && (r.scrollLeft = o);
    }
  }
  paintGraph() {
    const t = this.t;
    this.graphScrubSetter = null;
    const i = `
      <div class="head">
        <div class="title">${f(C0(this.points, t) || t.nextHours(this.hours))}</div>
        <div class="hint">${f(t.swipe)}</div>
      </div>`;
    if (this.status === "loading") {
      this.body.innerHTML = `<div class="card">${i}<div class="skeleton"></div><div class="loading-label">${f(t.loading)}</div></div>`;
      return;
    }
    if (this.status === "error") {
      this.body.innerHTML = `<div class="card">${i}<div class="error"><div class="error-msg">${f(t.error)}</div><button class="retry">${f(t.retry)}</button></div></div>`, this.body.querySelector(".retry")?.addEventListener("click", () => this.load());
      return;
    }
    const n = this.points, o = this.selectedColumn(n);
    this.renderedScrubIdx = o;
    const { setScrubIdx: s } = V2(
      this.body,
      n,
      t,
      o,
      (a, l) => this.onUserScrub(n, a, l),
      { previewHover: () => this.hostTimeMs !== null }
    );
    this.graphScrubSetter = s;
  }
  models() {
    const t = this.uiLang, i = this.getAttribute("forecast-label")?.trim();
    return this.rawForecasts.map((n) => ({
      id: n.id,
      name: i && n.id === this.forecastId ? i : C2(n.name, t)
    }));
  }
  /**
   * Stations for the settings overlay, ordered nearest-first to the current
   * point so the selected place and its neighbours top the list.
   *
   * Each place carries the distance it was sorted by, which the list then shows.
   * The order was right before and still looked arbitrary, because nothing on
   * screen said what it was — a reader who cannot see the rule assumes there
   * isn't one.
   */
  placeList(t, i) {
    const n = this.uiLang, o = this.rawStations.map((s) => ({
      name: C2(s.name, n),
      lat: s.lat,
      lon: s.lon
    }));
    if (!isNaN(t) && !isNaN(i)) {
      for (const s of o) s.distanceKm = l0(t, i, s.lat, s.lon);
      o.sort((s, a) => (s.distanceKm ?? 0) - (a.distanceKm ?? 0));
    }
    return o;
  }
  /** The panel's title for the current point, and where it came from (see
   *  {@link placeTitle}). */
  placeTitle(t, i, n, o) {
    return mt({
      locationName: this.getAttribute("location-name"),
      pickedName: this.pickedPlaceName,
      preferCoordinates: this.hasAttribute("prefer-coordinates"),
      places: t,
      lat: i,
      lon: n,
      t: o
    });
  }
  /** Display name for the current point: the panel's title. */
  placeName(t, i, n, o) {
    return this.placeTitle(t, i, n, o).name;
  }
  /**
   * Resolve the carried-over scrub instant to a column of `points`, or -1 for
   * "no opinion — open at now". The rules live in indexAtInstant; declining is
   * the common case and it is the right one, since the alternative is reopening
   * the widget on an hour that has already happened.
   */
  restoreScrubIndex(t) {
    return this.scrubUtcMs === null ? -1 : pt(t, this.scrubUtcMs);
  }
  /** Remember a scrubbed column as the instant it stands for (see scrubUtcMs).
   *  A column with no point behind it is not recorded at all: keeping the index
   *  while dropping the instant would leave the two disagreeing, which is the
   *  state this pairing exists to prevent. */
  noteScrub(t, i) {
    const n = t[i];
    n && (this.scrubIdx = i, this.scrubUtcMs = n.utcMs);
  }
  /** The `selected-time` attribute as epoch ms, or null when absent or not a
   *  date. Read as an absolute instant: an ISO string without an offset would
   *  be local time, which is why hosts pass UTC ("…Z"). */
  selectedTimeAttr() {
    const t = this.getAttribute("selected-time");
    if (!t) return null;
    const i = Date.parse(t);
    return Number.isFinite(i) ? i : null;
  }
  /**
   * The selected column of `points`: the host's hour while it drives the time
   * (-1 when the forecast has no column for it), otherwise the reader's scrub,
   * or "now".
   */
  selectedColumn(t) {
    if (this.hostTimeMs !== null) return ht(t, this.hostTimeMs);
    const i = this.scrubIdx >= 0 ? this.scrubIdx : this.restoreScrubIndex(t);
    return Math.max(
      0,
      Math.min(t.length - 1, i >= 0 ? i : m2(t))
    );
  }
  /**
   * `selected-time` changed: move the selection in place, without a reload. A
   * timeline in playback sets this on every step, so the common case only moves
   * the mounted chart's cursor and readout; the panel is repainted only when
   * the hour crosses into another day and the day chips must follow.
   */
  applySelectedTime() {
    if (this.hostTimeMs = this.selectedTimeAttr(), this.scrubIdx = -1, this.hostTimeMs === null && (this.scrubUtcMs = null), this.status !== "ready" || !this.points.length) return;
    const t = this.graphPoints(), i = this.selectedColumn(t);
    this.followSelectedDay(t, i) && this.body.querySelector(".day-chip") && this.paint(), this.graphScrubSetter?.(i), this.renderedScrubIdx = i, this.emitTime(t, i, "host");
  }
  /** Before a fresh paint: show the day holding the host's hour. */
  followHostTime() {
    if (this.hostTimeMs === null) return;
    const t = this.graphPoints();
    this.followSelectedDay(t, this.selectedColumn(t));
  }
  /** After a load: report the host's hour against the new series. */
  emitHostTime() {
    if (this.hostTimeMs === null) return;
    const t = this.graphPoints();
    this.emitTime(t, this.selectedColumn(t), "host");
  }
  /** Point the day chips / table at the day holding column `col`. True when
   *  the day changed. Hours outside the listed days leave it alone. */
  followSelectedDay(t, i) {
    const n = t[i];
    if (!this.isFull || !n) return !1;
    const s = K2(this.points, this.t, Y2(this.points)).findIndex((a) => a.hours.includes(n));
    return s < 0 || s === this.selectedDay ? !1 : (this.selectedDay = s, !0);
  }
  /**
   * The reader moved the cursor. Without a host driving the time this is the
   * reader's own scrub, remembered and persisted as before. While a host drives
   * it, a hover is only a preview and a committed move becomes the selection.
   * Committed moves are reported either way, so a host can follow the reader.
   */
  onUserScrub(t, i, n) {
    this.renderedScrubIdx = i, this.hostTimeMs === null ? (this.noteScrub(t, i), this.persistScrubSoon()) : n && t[i] && (this.hostTimeMs = t[i].utcMs), n && this.emitTime(t, i, "user");
  }
  /** Fire `bel-meteogram-time` for column `col`, unless it repeats the last. */
  emitTime(t, i, n) {
    const o = ut(t, i, n), s = `${o.time}|${o.tempC}`;
    s !== this.lastTimeKey && (this.lastTimeKey = s, this.dispatchEvent(
      new CustomEvent("bel-meteogram-time", {
        detail: o,
        bubbles: !0,
        composed: !0
      })
    ));
  }
  /**
   * The graph window shown in the full-mode card / panel: the whole run, the
   * hours already elapsed included.
   *
   * It used to start at "now", and that is what put the present hour under the
   * sticky lane chips: with no columns to the left of it, the cursor cannot be
   * centred (or scrolled) away from the chrome pinned to the left edge, because
   * scrollLeft has nowhere to go. Keeping the elapsed hours gives the view
   * something to spend on the left, and matches both the meteogram card and the
   * day table beside it, which have always listed them.
   */
  graphPoints() {
    return this.points;
  }
  closeBtnHtml(t, i) {
    return `
      <button class="${t}" type="button" aria-label="${f(i.close)}">
        <svg width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
      </button>`;
  }
  paintFull() {
    const t = this.t, i = this.uiLang, n = parseFloat(this.getAttribute("location-lat") ?? ""), o = parseFloat(this.getAttribute("location-lon") ?? ""), s = this.models(), a = this.placeList(n, o), l = this.placeTitle(a, n, o, t), r = l.name, c = s.find((g) => g.id === this.forecastId) ?? s[0], m = a.find(
      (g) => Math.abs(g.lat - n) < 1e-4 && Math.abs(g.lon - o) < 1e-4
    ) ?? a.find((g) => g.name === r) ?? null, u = this.hasAttribute("closable"), { landscape: p, wide: x, expanded: v } = this.layoutFlags(), z = zt({
      modelName: c?.name ?? "…",
      // The landscape sheet hides the title block; elsewhere the title names it.
      place: St(l, !p),
      lang: i.toUpperCase(),
      tzOffsetMin: Bi(this.tzOffsetMin, this.displayTimeZone, Date.now())
    }), B = gt(
      n,
      o,
      l.source,
      this.status === "ready" && this.correctedStation ? Et(
        this.corrections,
        C2(this.correctedStation.name, i),
        t
      ) : "",
      t
    ), b = At(
      this.getAttribute("station-place"),
      parseFloat(this.getAttribute("station-place-km") ?? ""),
      t
    );
    let M = "";
    if (this.status === "loading")
      M = '<div class="sk sk-now"></div><div class="sk-rows"><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></div>';
    else if (this.status === "error")
      M = `<div class="graph-wrap" style="padding-top:12px"><div class="card"><div class="error"><div class="error-msg">${f(t.error)}</div><button class="retry">${f(t.retry)}</button></div></div></div>`;
    else {
      const g = m2(this.points), F = K2(this.points, t, Y2(this.points)), A = Math.max(0, Math.min(F.length - 1, this.selectedDay));
      M = p ? this.landscapeBodyHtml(F, A, this.points[g], t) : v ? this.expandedBodyHtml(F, A, this.points[g], t) : x ? this.desktopBodyHtml(F, A, this.points[g], t) : this.mobileBodyHtml(F, A, this.points[g], t);
    }
    const k = this.settingsOpen ? Dt(
      s,
      this.forecastId,
      i,
      a,
      m,
      this.query,
      t,
      !this.hasAttribute("hide-language"),
      !this.hasAttribute("hide-models")
    ) : "", $ = v && this.expandedView !== "both" ? this.expandedView : this.view, C = `page ${x ? "wide wide-2a" : "narrow"}${v ? " is-expanded" : ""}${p ? " is-fullscreen" : ""}${u ? " page--closable" : ""} view-${$}`, T = this.status === "ready" && x ? Pt(this.metaLine(t)) : "", E = p ? "" : this.panelStyleAttr(), h = p ? "" : `<div class="panel-resize panel-resize-bl" data-resize-handle data-corner="bl" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>
         <div class="panel-resize panel-resize-br" data-resize-handle data-corner="br" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>`, d = x ? `<div class="${C}"${E}>
           ${Ct(z, u, t)}
           <section class="panel-loc">
             <div class="panel-loc-name">${f(r)}</div>
             <div class="panel-loc-sub">${B}</div>
             ${b}
           </section>
           ${M}
           ${T}
           ${h}
         </div>` : `<div class="${C}">
           ${u ? this.closeBtnHtml("page-close", t) : ""}
           <section class="loc">
             <h1 class="loc-name">${f(r)}</h1>
             <div class="loc-sub">${B}</div>
             ${b}
           </section>
           <div class="pill-wrap">${bt(z)}</div>
           ${M}
         </div>`;
    this.body.innerHTML = `${d}${k}`, this.wireFull(a, s, m), this.paintGraphHost(p, v, x, t);
  }
  /**
   * Render the graph into `.graph-host` from current state.
   *
   * Split out of {@link paintFull} because a resize drag re-runs THIS and not
   * the whole panel: the chart's geometry is resolved against the height it is
   * given (see renderMapPanelGraph), so it has to be rebuilt when that height
   * changes, and rebuilding the panel around it would throw away the day
   * table's scroll position and the wiring mid-drag.
   */
  paintGraphHost(t, i, n, o) {
    const s = this.body.querySelector(".graph-host");
    if (s && this.status === "ready") {
      const a = this.graphPoints();
      this.renderedGraphPoints = a;
      const l = this.selectedColumn(a);
      this.renderedScrubIdx = l;
      const r = () => this.hostTimeMs !== null;
      if (n) {
        const { setScrubIdx: c } = ui(s, a, {
          scrubIdx: l,
          nowIdx: T0(a),
          onScrub: (m, u) => this.onUserScrub(a, m, u),
          previewHover: r,
          onFullscreen: () => {
            this.isExpanded() ? this.collapsePanel() : this.expandPanel();
          },
          onRedraw: () => this.redrawGraphForColumn(),
          // Landscape uses the two-column body but the COMPACT chart geometry
          // (~262px) as the fit base — its natural height is close to the short
          // landscape column, so scaling to fit stays legible (scaling the tall
          // 560px fullscreen chart into ~200px would shrink the labels too far).
          expanded: t ? !1 : i,
          // Scale that chart to the available height so it fills the screen
          // edge-to-edge instead of clipping/scrolling vertically.
          fit: t,
          // Fold the analysis / last-update line into the graph's legend row
          // (both landscape and desktop). The standalone .meta-footer is then
          // hidden in graph view via CSS so it isn't shown twice.
          metaLine: this.metaLine(o),
          t: o
        });
        this.graphScrubSetter = c;
      } else {
        const { setScrubIdx: c } = V2(
          s,
          a,
          o,
          l,
          (m, u) => this.onUserScrub(a, m, u),
          { previewHover: r }
        );
        this.graphScrubSetter = c;
      }
    } else
      this.renderedGraphPoints = [], this.renderedScrubIdx = 0, this.graphScrubSetter = null;
  }
  /**
   * Expanded ("bigger") panel body: two columns — left = compact now-card,
   * day chips and the hourly table; right = the panel graph (rendered into
   * .graph-host, which brings its own scrub/hover readout). Reuses the docked
   * builders so the existing day-chip wiring drives day switching here too.
   * The meta footer is appended after this by paint(), i.e. below both columns.
   */
  expandedBodyHtml(t, i, n, o) {
    return kt(
      this.expandedView,
      `<div class="now-wrap">${c2(n, o, 44, 50)}</div>
          ${d2(t, i, !1)}
          ${k2(t[i], o)}`,
      '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>',
      `<button class="chart-fs-btn exp-collapse" type="button" aria-label="${f(o.exitFullscreen)}" title="${f(o.exitFullscreen)}">${R0}</button>`,
      o
    );
  }
  /**
   * Desktop draggable panel body: compact now card, equal-width
   * day chips, Table/Graph switch, table or panel meteogram.
   */
  desktopBodyHtml(t, i, n, o) {
    const s = this.view === "table" ? k2(t[i], o) : '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>';
    return `
      ${c2(n, o, 46, 58)}
      ${d2(t, i, !1)}
      <div class="tabs">
        <button class="tab${this.view === "table" ? " on" : ""}" type="button" data-view="table" aria-pressed="${this.view === "table"}">${f(o.table)}</button>
        <button class="tab${this.view === "graph" ? " on" : ""}" type="button" data-view="graph" aria-pressed="${this.view === "graph"}">${f(o.graph)}</button>
      </div>
      ${s}`;
  }
  /** Mobile body: now card + Table/Graph control + chips/card or meteogram */
  mobileBodyHtml(t, i, n, o) {
    const s = this.view === "table" ? `${d2(t, i)}<div class="sel-wrap">${Lt(t[i], o)}</div>` : '<div class="graph-wrap"><div class="graph-host"></div></div>';
    return `
      <div class="now-wrap">${c2(n, o)}</div>
      <div class="tabs">
        <button class="tab${this.view === "table" ? " on" : ""}" type="button" data-view="table" aria-pressed="${this.view === "table"}">${f(o.table)}</button>
        <button class="tab${this.view === "graph" ? " on" : ""}" type="button" data-view="graph" aria-pressed="${this.view === "graph"}">${f(o.graph)}</button>
      </div>
      ${s}`;
  }
  /**
   * Landscape full-screen body: a single view with a Table/Graph toggle (a short
   * phone in landscape can't fit two columns). Graph → the meteogram fills the
   * whole sheet (full width + fit-scaled height). Table → weather-now card, day
   * chips and the hourly table in one scrolling column.
   */
  landscapeBodyHtml(t, i, n, o) {
    const s = this.view === "graph", a = `
      <div class="tabs">
        <button class="tab${s ? "" : " on"}" type="button" data-view="table" aria-pressed="${!s}">${f(o.table)}</button>
        <button class="tab${s ? " on" : ""}" type="button" data-view="graph" aria-pressed="${s}">${f(o.graph)}</button>
      </div>`, l = s ? '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>' : `<div class="ls-scroll">
           <div class="now-wrap">${c2(n, o, 40, 46)}</div>
           ${d2(t, i, !0)}
           ${k2(t[i], o)}
         </div>`;
    return `${a}${l}`;
  }
  wireFull(t, i, n) {
    const o = (p) => this.body.querySelector(p);
    o(".page-close, .header-close")?.addEventListener(
      "click",
      () => {
        this.dispatchEvent(new CustomEvent("bel-meteogram-close"));
      }
    ), o(".pill")?.addEventListener("click", () => {
      this.settingsOpen = !0, this.focusAfterPaint = ".overlay", this.paint();
    }), o(".retry")?.addEventListener("click", () => this.load());
    for (const p of this.body.querySelectorAll(".tab[data-view]"))
      p.addEventListener("click", () => {
        const x = p.dataset.view;
        x !== this.view && (this.view = x, this.persistMapPanel(), this.paint());
      });
    o(".exp-collapse")?.addEventListener("click", () => this.collapsePanel());
    for (const p of this.body.querySelectorAll(".tab[data-exp-view]"))
      p.addEventListener("click", () => {
        const x = X2(p.dataset.expView);
        x !== this.expandedView && (this.expandedView = x, this.persistMapPanel(), this.paint());
      });
    for (const p of this.body.querySelectorAll(".day-chip[data-day]"))
      p.addEventListener("click", () => {
        const x = parseInt(p.dataset.day ?? "", 10);
        x !== this.selectedDay && (this.selectedDay = x, this.persistMapPanel(), this.paint());
      });
    const s = o("[data-drag-handle]"), a = o(".page.wide-2a");
    if (!this.isLandscape && s && a) {
      let p = null;
      const x = (M, k) => {
        const $ = this.clientWidth || a.offsetWidth, C = this.clientHeight || a.offsetHeight, T = a.offsetWidth, E = a.offsetHeight;
        return {
          x: Math.max(0, Math.min($ - T, M)),
          y: Math.max(0, Math.min(C - E, k))
        };
      }, v = (M) => {
        if (!p || M.buttons === 0) return;
        const k = x(
          p.px + M.clientX - p.sx,
          p.py + M.clientY - p.sy
        );
        this.panelPos = k, a.style.left = `${k.x}px`, a.style.top = `${k.y}px`;
      }, z = () => {
        p && (p = null, this.persistMapPanel(), window.removeEventListener("pointermove", v), window.removeEventListener("pointerup", z));
      };
      s.addEventListener("pointerdown", (M) => {
        if (M.target.closest("button")) return;
        const k = a.getBoundingClientRect(), $ = this.getBoundingClientRect();
        try {
          s.setPointerCapture(M.pointerId);
        } catch {
        }
        p = {
          sx: M.clientX,
          sy: M.clientY,
          px: k.left - $.left,
          py: k.top - $.top
        }, this.panelPos = { x: p.px, y: p.py }, window.addEventListener("pointermove", v), window.addEventListener("pointerup", z);
      });
      const B = (M, k) => {
        let $ = null;
        const C = (E) => {
          if (!$ || E.buttons === 0) return;
          const h = this.body.querySelector(".page.wide-2a");
          if (!h) return;
          const d = this.getBoundingClientRect(), g = this.clientWidth || d.width, F = this.clientHeight || d.height, A = E.clientX - d.left, I = E.clientY - d.top;
          let D = $.left, G;
          k === "bl" ? (D = Math.max(0, Math.min($.rightEdge - f2, A)), G = Math.min(g - 8, $.rightEdge - D)) : G = Math.max(f2, Math.min(g - $.left - 8, A - $.left));
          const N = Math.min(
            G >= u2 ? z2 : n0,
            F - $.top - 8
          ), j = Math.max(N, Math.min(F - $.top - 8, I - $.top));
          this.panelPos = { x: D, y: $.top }, this.panelSize = { w: G, h: j };
          const H = G >= u2;
          H !== $.expanded ? ($.expanded = H, this.paint()) : (h.style.left = `${D}px`, h.style.width = `${G}px`, h.style.height = `${j}px`, this.scheduleGraphRefit());
        }, T = () => {
          $ && ($ = null, window.removeEventListener("pointermove", C), window.removeEventListener("pointerup", T), this.persistMapPanel(), this.cancelGraphRefit(), this.paint());
        };
        M.addEventListener("pointerdown", (E) => {
          E.preventDefault(), E.stopPropagation();
          const h = a.getBoundingClientRect(), d = this.getBoundingClientRect();
          try {
            M.setPointerCapture(E.pointerId);
          } catch {
          }
          $ = {
            left: h.left - d.left,
            top: h.top - d.top,
            rightEdge: h.right - d.left,
            expanded: this.isExpanded()
          }, window.addEventListener("pointermove", C), window.addEventListener("pointerup", T);
        });
      }, b = this.body.querySelectorAll("[data-resize-handle]");
      for (const M of b)
        B(M, M.dataset.corner === "br" ? "br" : "bl");
      b.length && !F2("resizeHintSeen") && (b.forEach((M) => M.classList.add("hint")), T2("resizeHintSeen", "1"));
    }
    this.closeOverlay = null;
    const l = o(".backdrop");
    if (!l) return;
    const r = () => {
      this.settingsOpen = !1, this.query = "", this.focusAfterPaint = ".pill", this.paint();
    };
    this.closeOverlay = r;
    const c = o(".overlay");
    c?.addEventListener("keydown", (p) => {
      if (p.key !== "Tab") return;
      const x = [
        ...c.querySelectorAll("button, input, [tabindex='0']")
      ].filter((b) => b.offsetParent !== null);
      if (!x.length) return;
      const v = x[0], z = x[x.length - 1], B = this.root.activeElement;
      p.shiftKey && (B === v || B === c) ? (p.preventDefault(), z.focus()) : !p.shiftKey && B === z && (p.preventDefault(), v.focus());
    }), l.addEventListener("click", (p) => {
      p.target === l && r();
    }), o(".overlay-close")?.addEventListener("click", r);
    for (const p of l.querySelectorAll(".chip[data-model]"))
      p.addEventListener("click", () => {
        const x = i[parseInt(p.dataset.model ?? "", 10)];
        !x || x.id === this.forecastId || (this.forecastId = x.id, T2("model", x.id), this.load());
      });
    for (const p of l.querySelectorAll(".chip[data-lang]"))
      p.addEventListener("click", () => {
        const x = p.dataset.lang ?? "is";
        x !== this.uiLang && (this.suppressAttrCallback = !0, this.setAttribute("language", x), this.suppressAttrCallback = !1, T2("lang", x), this.paint());
      });
    const m = o(".station-search"), u = o(".station-list");
    m?.addEventListener("input", () => {
      this.query = m.value, u && (u.innerHTML = U0(t, n, this.query, this.t));
    }), u?.addEventListener("click", (p) => {
      const x = p.target.closest(".station");
      if (!x) return;
      const v = t[parseInt(x.dataset.station ?? "", 10)];
      v && (this.suppressAttrCallback = !0, this.removeAttribute("location-name"), this.removeAttribute("station-place"), this.removeAttribute("station-place-km"), this.suppressAttrCallback = !1, this.pickedPlaceName = v.name, this.settingsOpen = !1, this.query = "", this.loadChartLocation(v.lat, v.lon, v.name));
    });
  }
  /**
   * Open the meteogram as a bottom sheet for a selected point.
   * The sheet supplies the title (place name) and close affordances
   * (button, scrim tap, drag down); the card internals are identical
   * to the inline widget.
   */
  static openSheet(t) {
    const i = document.createElement("bel-meteogram-sheet");
    return i.configure(t.title, t.attributes), document.body.appendChild(i), i;
  }
}
class Pi extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  /** Where focus was when the sheet opened; it goes back there on close. */
  returnFocus = null;
  onKeyDown = (t) => {
    t.key === "Escape" && !t.defaultPrevented && (t.preventDefault(), this.close());
  };
  configure(t, i) {
    const n = document.createElement("style");
    n.textContent = mi;
    const o = document.createElement("div");
    o.className = "scrim", o.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${f(t)}">
        <div class="grabber"></div>
        <div class="sheet-head">
          <div class="sheet-title"></div>
          <button class="close" type="button" aria-label="${f(p0(i.language ?? "").close)}">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`, o.querySelector(".sheet-title").textContent = t;
    const s = document.createElement("bel-meteogram");
    for (const [l, r] of Object.entries(i))
      s.setAttribute(l, r);
    const a = o.querySelector(".sheet");
    a.appendChild(s), o.addEventListener("click", (l) => {
      l.target === o && this.close();
    }), o.querySelector(".close").addEventListener("click", () => this.close()), this.dragToDismiss(a), this.root.append(n, o);
  }
  connectedCallback() {
    const t = document.activeElement;
    this.returnFocus = t instanceof HTMLElement ? t : null, document.addEventListener("keydown", this.onKeyDown), this.root.querySelector(".close")?.focus({ preventScroll: !0 });
  }
  disconnectedCallback() {
    document.removeEventListener("keydown", this.onKeyDown);
  }
  dragToDismiss(t) {
    let i = 0, n = 0, o = !1;
    t.addEventListener("pointerdown", (a) => {
      a.target.closest(".mg-chart") || (o = !0, i = a.clientY, t.setPointerCapture(a.pointerId), t.style.transition = "none");
    }), t.addEventListener("pointermove", (a) => {
      o && (n = Math.max(0, a.clientY - i), t.style.transform = `translateY(${n}px)`);
    });
    const s = () => {
      o && (o = !1, t.style.transition = "", n > 90 ? this.close() : t.style.transform = "", n = 0);
    };
    t.addEventListener("pointerup", s), t.addEventListener("pointercancel", s);
  }
  close() {
    this.remove(), this.returnFocus?.isConnected && this.returnFocus.focus({ preventScroll: !0 }), this.returnFocus = null;
  }
}
customElements.define("bel-meteogram", I2);
customElements.define("bel-meteogram-sheet", Pi);
export {
  I2 as BelMeteogram
};
