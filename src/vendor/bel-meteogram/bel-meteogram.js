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
function s0(e, t, i, n) {
  const o = Math.PI / 180, s = (e + i) / 2 * o, l = (i - e) * o;
  let a = (n - t) * o;
  a > Math.PI && (a -= 2 * Math.PI), a < -Math.PI && (a += 2 * Math.PI);
  const r = a * Math.cos(s);
  return Math.hypot(r, l) * 6371;
}
function W0(e) {
  return e.apiUrl ? e.apiUrl : `${new URL(import.meta.url).origin}/api/v2/widget/meteo/config/${e.clientName}`;
}
const N0 = 3600 * 1e3, O2 = 2e4;
async function n0(e, t, i = {}, n) {
  const o = new AbortController();
  let s = !1;
  const l = setTimeout(() => {
    s = !0, o.abort();
  }, O2), a = () => o.abort(n?.reason);
  n?.aborted ? a() : n?.addEventListener("abort", a, { once: !0 });
  try {
    const r = await fetch(e, { ...i, signal: o.signal });
    if (!r.ok) throw new Error(`${t}: HTTP ${r.status}`);
    return { json: await r.json(), response: r };
  } catch (r) {
    throw s ? new Error(`${t}: timed out after ${O2 / 1e3} s`) : r;
  } finally {
    clearTimeout(l), n?.removeEventListener("abort", a);
  }
}
function R2(e, t) {
  return t ? new Promise((i, n) => {
    const o = () => n(j0(t));
    if (t.aborted) return o();
    t.addEventListener("abort", o, { once: !0 }), e.then(i, n).finally(() => t.removeEventListener("abort", o));
  }) : e;
}
function j0(e) {
  return e.reason ?? new DOMException("The operation was aborted.", "AbortError");
}
const a2 = /* @__PURE__ */ new Map();
function l0(e, t, i) {
  const n = a2.get(e);
  if (n && Date.now() - n.at < N0)
    return R2(n.json, i);
  const o = n0(e, t).then((s) => s.json);
  return a2.set(e, { at: Date.now(), json: o }), o.catch(() => {
    a2.get(e)?.json === o && a2.delete(e);
  }), R2(o, i);
}
async function q0(e, t) {
  return (await l0(W0(e), "config", t)).forecasts;
}
function Y0(e, t, i) {
  return !e || !t ? "" : e === "schedule" ? `${e}/${t}/${i}` : `${e}/${t}`;
}
function K0(e, t) {
  return t ? e.find((i) => i.id === t) : e[0];
}
function V0(e, t) {
  return l0(e, "forecast", t);
}
function _2(e, t, i, n, o) {
  const s = n !== void 0 && Number.isFinite(n) ? `?duration=${n}h` : "", l = o && a0(e) ? `station/${encodeURIComponent(o)}` : `latlon/${t},${i}`;
  return e.station_data_url.replace("[station]", l).replace("meteogram.xml", `meteogram.json${s}`);
}
function a0(e) {
  return !e.forecast_id?.startsWith("upstream/");
}
const X0 = 1;
function J0(e, t, i) {
  let n = null, o = X0;
  for (const s of e) {
    if (!s.extra?.ref) continue;
    const l = s0(t, i, s.lat, s.lon);
    l <= o && (n = s, o = l);
  }
  return n;
}
async function y2(e, t, i) {
  const n = new Headers();
  t.user && t.password && n.set("Authorization", "Basic " + btoa(`${t.user}:${t.password}`));
  const { json: o, response: s } = await n0(
    e,
    "meteogram",
    { headers: n },
    i
  ), l = s.headers.get("Last-Modified");
  return {
    data: o,
    lastModified: l ? new Date(l) : null
  };
}
function Z0(e, t, i, n = /* @__PURE__ */ new Date()) {
  const o = W2(e.meta?.last_modified) ?? t ?? n;
  return { analysisTime: W2(e.meta?.analysis) ?? (i !== void 0 ? new Date(i) : o), lastModified: o };
}
function W2(e) {
  if (!e) return null;
  const t = new Date(e);
  return isNaN(t.getTime()) ? null : t;
}
const M = {
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
}, Q0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2301d__01d__a)'%3e%3cpath%20fill='url(%2301d__01d__b)'%20d='M75.6%2056.9L91%2050l-15.4-6.8%209.8-13.7-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.8-16.7%2016.8%201.7-9.9-13.5z'/%3e%3cpath%20fill='%23FFD348'%20d='M28.284%2062.509c6.901%2011.908%2022.205%2016.01%2034.208%209.206C74.496%2064.91%2078.497%2049.5%2071.695%2037.491c-6.902-11.908-22.206-16.01-34.21-9.206-11.901%206.905-16.002%2022.315-9.2%2034.224z'/%3e%3cpath%20fill='url(%2301d__01d__c)'%20d='M31.8%2060.493c5.798%209.998%2018.695%2013.497%2028.693%207.699%209.998-5.799%2013.497-18.696%207.699-28.694C62.393%2029.5%2049.496%2026%2039.498%2031.799%2029.5%2037.6%2026%2050.496%2031.799%2060.493z'/%3e%3c/g%3e%3cdefs%3e%3cradialGradient%20id='01d__01d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3clinearGradient%20id='01d__01d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3cclipPath%20id='01d__01d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e", ee = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cpath%20fill='url(%2301n__01n__a)'%20d='M51.4%2021c2.4%204.2%203.9%209.1%203.9%2014.3%200%2015.8-12.8%2028.6-28.6%2028.6-1.3%200-2.5-.1-3.7-.3C28%2072.2%2037.2%2078%2047.7%2078c15.8%200%2028.6-12.8%2028.6-28.6%200-14.6-10.8-26.6-24.9-28.4z'/%3e%3cdefs%3e%3clinearGradient%20id='01n__01n__a'%20x1='34.425'%20x2='71.181'%20y1='75.492'%20y2='31.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e", te = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302d__02d__a)'%3e%3cpath%20fill='url(%2302d__02d__b)'%20fill-rule='evenodd'%20d='M79.698%2037.47L85.4%2029.5l-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.35-12.524H53.466c-3.222%200-6.258-1.177-8.55-3.408-2.417-2.292-3.718-5.39-3.78-8.737v-.123c0-3.16%201.24-6.135%203.47-8.365a12.25%2012.25%200%20018.117-3.718c1.673-2.417%204.461-3.842%207.497-3.842h.682C64.248%2039.974%2069.762%2037%2075.649%2037c1.384%200%202.741.163%204.05.47z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M60.178%2072.876c-11.59%205.094-25.43.788-31.894-10.367-6.802-11.909-2.701-27.32%209.202-34.224%2011.991-6.798%2027.276-2.71%2034.188%209.17a18.36%2018.36%200%2000-10.772%207.228h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.765%2011.765%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737%202.292%202.23%205.328%203.408%208.55%203.408h6.712z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__c)'%20fill-rule='evenodd'%20d='M46.356%2070.665C40.454%2069.61%2035.027%2066.058%2031.8%2060.493c-5.798-9.998-2.3-22.895%207.699-28.694%209.774-5.669%2022.32-2.45%2028.294%207.038a18.394%2018.394%200%2000-6.89%205.846h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.766%2011.766%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737.452.44.934.84%201.44%201.197z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__d)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302d__02d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.023-.02.01-.002.017.005.023.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02d__02d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02d__02d__d'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='02d__02d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='02d__02d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02d__02d__e'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1382'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ie = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302n__02n__a)'%3e%3cpath%20fill='url(%2302n__02n__b)'%20fill-rule='evenodd'%20d='M48.3%2032.3c0-5.2-1.5-10.1-3.9-14.3%2011.477%201.465%2020.767%209.688%2023.827%2020.57a18.396%2018.396%200%2000-7.461%206.113h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718A11.765%2011.765%200%200041%2060.608v.123c.062%203.346%201.363%206.445%203.78%208.737%201.917%201.866%204.355%202.995%206.986%203.314A28.525%2028.525%200%200140.7%2075C30.2%2075%2021%2069.2%2016%2060.6c1.2.2%202.4.3%203.7.3%2015.8%200%2028.6-12.8%2028.6-28.6z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302n__02n__c)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302n__02n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.022-.02.008-.002.016.005.022.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02n__02n__b'%20x1='27.425'%20x2='64.181'%20y1='72.492'%20y2='28.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02n__02n__c'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='02n__02n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02n__02n__d'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1384'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", oe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303d__03d__a)'%3e%3cpath%20fill='url(%2303d__03d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303d__03d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03d__03d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03d__03d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='03d__03d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='03d__03d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03d__03d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1385'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", se = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303n__03n__a)'%3e%3cpath%20fill='url(%2303n__03n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303n__03n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303n__03n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03n__03n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03n__03n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='03n__03n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03n__03n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1387'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ne = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2304__04__a)'%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2304__04__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2304__04__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='04__04__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='04__04__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='04__04__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1388'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", le = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305d__05d__a)'%3e%3cpath%20fill='url(%2305d__05d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305d__05d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05d__05d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05d__05d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='05d__05d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='05d__05d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05d__05d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1389'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ae = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305n__05n__a)'%3e%3cpath%20fill='url(%2305n__05n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305n__05n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305n__05n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05n__05n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05n__05n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='05n__05n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05n__05n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1391'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", re = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307d__07d__a)'%3e%3cpath%20fill='url(%2307d__07d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307d__07d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07d__07d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07d__07d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='07d__07d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='07d__07d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07d__07d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1395'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ce = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307n__07n__a)'%3e%3cpath%20fill='url(%2307n__07n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307n__07n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307n__07n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07n__07n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07n__07n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='07n__07n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07n__07n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1397'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", de = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308d__08d__a)'%3e%3cpath%20fill='url(%2308d__08d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308d__08d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08d__08d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08d__08d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='08d__08d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='08d__08d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08d__08d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1398'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", pe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308n__08n__a)'%3e%3cpath%20fill='url(%2308n__08n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308n__08n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308n__08n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08n__08n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08n__08n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='08n__08n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08n__08n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1400'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", he = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2309__09__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2309__09__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2309__09__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='09__09__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='09__09__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='09__09__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1401'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ue = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2310__10__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2310__10__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2310__10__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='10__10__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='10__10__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='10__10__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1402'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", fe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2312__12__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2312__12__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2312__12__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='12__12__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='12__12__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='12__12__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1404'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2313__13__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2313__13__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2313__13__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='13__13__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='13__13__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='13__13__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1405'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ge = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340d__40d__a)'%3e%3cpath%20fill='url(%2340d__40d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340d__40d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40d__40d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40d__40d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='40d__40d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='40d__40d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40d__40d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1439'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", xe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340n__40n__a)'%3e%3cpath%20fill='url(%2340n__40n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340n__40n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340n__40n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40n__40n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40n__40n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='40n__40n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40n__40n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1441'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ve = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341d__41d__a)'%3e%3cpath%20fill='url(%2341d__41d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341d__41d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41d__41d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41d__41d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='41d__41d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='41d__41d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41d__41d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1442'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341n__41n__a)'%3e%3cpath%20fill='url(%2341n__41n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341n__41n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341n__41n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41n__41n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41n__41n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='41n__41n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41n__41n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1444'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", _e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342d__42d__a)'%3e%3cpath%20fill='url(%2342d__42d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342d__42d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42d__42d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42d__42d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='42d__42d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='42d__42d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42d__42d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1445'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ye = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342n__42n__a)'%3e%3cpath%20fill='url(%2342n__42n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342n__42n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342n__42n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42n__42n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42n__42n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='42n__42n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42n__42n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1447'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", we = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343d__43d__a)'%3e%3cpath%20fill='url(%2343d__43d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343d__43d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43d__43d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43d__43d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='43d__43d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='43d__43d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43d__43d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1448'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343n__43n__a)'%3e%3cpath%20fill='url(%2343n__43n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343n__43n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343n__43n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43n__43n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43n__43n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='43n__43n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43n__43n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1450'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", $e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344d__44d__a)'%3e%3cpath%20fill='url(%2344d__44d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344d__44d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44d__44d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44d__44d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='44d__44d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='44d__44d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44d__44d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1451'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344n__44n__a)'%3e%3cpath%20fill='url(%2344n__44n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344n__44n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344n__44n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44n__44n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44n__44n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='44n__44n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44n__44n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1453'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ke = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345d__45d__a)'%3e%3cpath%20fill='url(%2345d__45d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345d__45d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45d__45d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45d__45d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='45d__45d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='45d__45d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45d__45d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1454'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Se = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345n__45n__a)'%3e%3cpath%20fill='url(%2345n__45n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345n__45n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345n__45n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45n__45n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45n__45n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='45n__45n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45n__45n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1456'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ze = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2346__46__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2346__46__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2346__46__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='46__46__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='46__46__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='46__46__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1457'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ce = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2347__47__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2347__47__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2347__47__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='47__47__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='47__47__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='47__47__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1458'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Te = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2348__48__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2348__48__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2348__48__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='48__48__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='48__48__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='48__48__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1459'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Fe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2349__49__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2349__49__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2349__49__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='49__49__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='49__49__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='49__49__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1460'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ee = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2350__50__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2350__50__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2350__50__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='50__50__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='50__50__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='50__50__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1461'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Ae = /* @__PURE__ */ Object.assign({
  "./assets/symbols/01d.svg": Q0,
  "./assets/symbols/01n.svg": ee,
  "./assets/symbols/02d.svg": te,
  "./assets/symbols/02n.svg": ie,
  "./assets/symbols/03d.svg": oe,
  "./assets/symbols/03n.svg": se,
  "./assets/symbols/04.svg": ne,
  "./assets/symbols/05d.svg": le,
  "./assets/symbols/05n.svg": ae,
  "./assets/symbols/07d.svg": re,
  "./assets/symbols/07n.svg": ce,
  "./assets/symbols/08d.svg": de,
  "./assets/symbols/08n.svg": pe,
  "./assets/symbols/09.svg": he,
  "./assets/symbols/10.svg": ue,
  "./assets/symbols/12.svg": fe,
  "./assets/symbols/13.svg": me,
  "./assets/symbols/40d.svg": ge,
  "./assets/symbols/40n.svg": xe,
  "./assets/symbols/41d.svg": ve,
  "./assets/symbols/41n.svg": be,
  "./assets/symbols/42d.svg": _e,
  "./assets/symbols/42n.svg": ye,
  "./assets/symbols/43d.svg": we,
  "./assets/symbols/43n.svg": Me,
  "./assets/symbols/44d.svg": $e,
  "./assets/symbols/44n.svg": Be,
  "./assets/symbols/45d.svg": ke,
  "./assets/symbols/45n.svg": Se,
  "./assets/symbols/46.svg": ze,
  "./assets/symbols/47.svg": Ce,
  "./assets/symbols/48.svg": Te,
  "./assets/symbols/49.svg": Fe,
  "./assets/symbols/50.svg": Ee
});
function e2(e) {
  return e ? Ae[`./assets/symbols/${e}.svg`] ?? "" : "";
}
const E2 = {
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
}, Le = {
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
function x2(e) {
  return e.some((t) => t.gustMs !== null);
}
const r0 = "rgba(90,112,140,0.055)";
function Ue(e) {
  const t = e.local.getUTCHours();
  return t < 5 || t >= 22;
}
function c0(e, t) {
  const i = [];
  let n = null;
  for (let o = 0; o < e.length; o++) {
    const s = Ue(e[o]);
    if (s && n === null && (n = o), (!s || o === e.length - 1) && n !== null) {
      const l = s && o === e.length - 1 ? o + 1 : o;
      i.push({ x: n * t, w: (l - n) * t }), n = null;
    }
  }
  return i;
}
function o2(e) {
  return e > 0 ? M.temp : e < 0 ? M.tempCold : M.neutral;
}
function f(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function Z(e, t, i, n, o, s, l = "start", a = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${o}" font-weight="${s}" text-anchor="${l}" font-family="Nunito, system-ui, sans-serif"${a ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function w2(e, t, i, n) {
  let o = "", s = !1;
  for (let l = 0; l < e.length; l++) {
    const a = t(e[l]);
    if (a === null) {
      s = !1;
      continue;
    }
    o += `${s ? "L" : "M"}${i(l).toFixed(1)} ${n(a).toFixed(1)} `, s = !0;
  }
  return o.trim();
}
const m2 = M.none, d0 = M.precipText, p0 = 22, Pe = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function h0(e, t) {
  let i = 0;
  for (const s of e)
    Number.isFinite(s.precipMm) && (i = Math.max(i, s.precipMm)), Number.isFinite(s.precipMaxMm) && (i = Math.max(i, s.precipMaxMm));
  if (!(i > t)) return t;
  const n = 10 ** Math.floor(Math.log10(i)), o = Pe.find((s) => s * n >= i - 1e-9) ?? 10;
  return Number((o * n).toFixed(6));
}
const Ge = 0.5;
function A2(e, t) {
  if (!(e > 0)) return 0;
  const { baseMm: i, topMm: n } = t, o = Math.max(Ge, Math.min(1, i / n));
  if (e <= i || !(n > i))
    return Math.min(1, e / i * o);
  const s = Math.log(e / i) / Math.log(n / i);
  return Math.min(1, o + (1 - o) * s);
}
const De = [2, 1, 5, 10, 20, 50];
function u0(e, t) {
  if (!(e.topMm > 0) || !(t > 0)) return [];
  const i = Math.min(p0, t / 2) - 1e-9, n = e.topMm > e.baseMm + 1e-9, o = [];
  for (const s of [...n ? [e.topMm] : [], ...De]) {
    if (s > e.topMm + 1e-9) continue;
    const l = A2(s, e) * t;
    o.every((a) => a.mm !== s && Math.abs(a.y - l) >= i) && o.push({ mm: s, y: l });
  }
  return o.map((s) => s.mm).sort((s, l) => s - l);
}
function He(e, t = 8) {
  return Math.max(2, Math.min(t, Math.floor(e / p0)));
}
const Q = 3.5, f0 = 0.705;
function Ie(e, t) {
  const i = t.tempFont * f0, n = Math.max(t.tempTop, t.scrubTop + t.handleR), o = e + t.tempLabelDy;
  return o - i < n ? e - t.tempLabelDy + i : o;
}
const Oe = 20;
function Re(e) {
  return Number.isInteger(e) && (e <= 2 || e % 5 === 0);
}
function m0(e, t) {
  const i = Math.max(2, Math.floor(t / Oe));
  let n = e;
  for (let s = i; s >= 2; s--)
    if (Re(e / s)) {
      n = e / s;
      break;
    }
  const o = Math.round(e / n);
  return Array.from({ length: o }, (s, l) => (l + 1) * n);
}
function g0(e) {
  return `${e}°`;
}
function x0(e) {
  return `${e}`;
}
function v0(e) {
  return `${e}`;
}
const F2 = 8, We = 10, Ne = 500;
function b0(e, t) {
  let i = null;
  e.addEventListener("pointerdown", (n) => {
    const o = n;
    o.pointerType !== "mouse" && (i = { x: o.clientX, y: o.clientY, at: Date.now() });
  }), e.addEventListener("pointercancel", () => {
    i = null;
  }), e.addEventListener("pointerup", (n) => {
    const o = n, s = i;
    i = null, !(!s || o.pointerType === "mouse" || Math.hypot(o.clientX - s.x, o.clientY - s.y) > We || Date.now() - s.at > Ne) && t(o);
  });
}
function _0(e, t = () => 1) {
  const i = Array.from(
    e.querySelectorAll("text.day-label")
  );
  if (!i.length) return;
  const n = () => {
    const o = t() || 1, s = e.scrollLeft / o;
    for (const l of i) {
      const a = Number(l.dataset.x0), r = Number(l.dataset.x1);
      if (!Number.isFinite(a) || !Number.isFinite(r)) continue;
      const d = Math.min(Math.max(a, s + F2), Math.max(a, r));
      l.setAttribute("x", String(d));
    }
  };
  e.addEventListener("scroll", n, { passive: !0 }), n();
}
function y0(e) {
  const t = e.filter((d) => Number.isFinite(d));
  if (!t.length) return [0, 2, 4, 6, 8];
  const i = Math.min(...t), n = Math.max(...t), o = [1, 2, 5, 10, 20, 50], s = o.find((d) => Math.ceil(n / d) * d - Math.floor(i / d) * d <= d * 5) ?? o[o.length - 1], l = Math.floor(i / s) * s;
  let a = Math.ceil(n / s) * s;
  a === l && (a = l + s);
  const r = [];
  for (let d = l; d <= a; d += s) r.push(d);
  return r;
}
function w0(e) {
  const t = Math.max(
    0,
    ...e.map((i) => Math.max(i.windMs ?? 0, i.gustMs ?? 0))
  );
  return Math.max(20, Math.ceil(t / 10) * 10);
}
function je(e, t = E2) {
  return t.padL + e * t.colW + t.padR;
}
function qe(e, t) {
  const i = e.map((d) => d.tempC).filter((d) => Number.isFinite(d)), n = y0(i), [o, s] = [n[0], n[n.length - 1]], l = w0(e), a = t.precipCap / t.precipPerMm, r = { baseMm: a, topMm: h0(e, a) };
  return {
    tempTicks: n,
    windTicks: m0(l, t.windSpan),
    precipTicks: u0(r, t.precipCap),
    ty: (d) => t.tempTop + (s - d) / (s - o) * (t.tempBottom - t.tempTop),
    wy: (d) => t.windBase - Math.min(d, l) / l * t.windSpan,
    ph: (d) => t.precipCap * A2(d, r)
  };
}
function L2(e, t) {
  return e.dividers.map(
    (i) => `<line x1="0" x2="${t}" y1="${i}" y2="${i}" stroke="#EAEEF1" stroke-width="1.5"/>`
  ).join("");
}
function Ye(e, t) {
  const i = e.axisW - e.axisInset, n = [L2(e, e.axisW)];
  for (const o of t.tempTicks)
    n.push(
      Z(i, t.ty(o) + Q, g0(o), m2, e.axisFont, 700, "end")
    );
  for (const o of t.windTicks)
    n.push(
      Z(i, t.wy(o) + Q, x0(o), m2, e.axisFont, 700, "end")
    );
  return `<svg class="mg-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${n.join("")}</svg>`;
}
function Ke(e, t) {
  const i = [L2(e, e.rightAxisW)];
  for (const n of t.precipTicks)
    i.push(
      Z(
        e.axisInset,
        e.precipBase - t.ph(n) + Q,
        v0(n),
        d0,
        e.axisFont,
        700
      )
    );
  return `<svg class="mg-axis-right" width="${e.rightAxisW}" height="${e.height}" viewBox="0 0 ${e.rightAxisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${i.join("")}</svg>`;
}
function Ve(e, t, i, n = E2, o = -1) {
  const s = n, l = e.length, a = je(l, s), r = (c) => s.padL + c * s.colW + s.colW / 2, d = x2(e), m = qe(e, s), { ty: u, wy: p, ph: x } = m, g = [];
  for (const c of c0(e, s.colW))
    g.push(
      `<rect x="${s.padL + c.x}" y="${s.dayTop}" width="${c.w}" height="${s.dayBottom - s.dayTop}" fill="${r0}"/>`
    );
  for (const c of m.tempTicks)
    g.push(
      `<line x1="0" x2="${a}" y1="${u(c)}" y2="${u(c)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const c of m.precipTicks) {
    const b = s.precipBase - x(c);
    g.push(
      `<line x1="0" x2="${a}" y1="${b}" y2="${b}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  for (const c of m.windTicks)
    g.push(
      `<line x1="0" x2="${a}" y1="${p(c)}" y2="${p(c)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  const z = [0];
  for (let c = 1; c < l; c++)
    e[c].local.getUTCHours() === 0 && z.push(c);
  for (let c = 0; c < z.length; c++) {
    const b = z[c];
    if (b > 0) {
      const H = r(b);
      g.push(
        `<line x1="${H}" x2="${H}" y1="${s.dayTop}" y2="${s.dayBottom}" stroke="#DCE3E8" stroke-width="1" stroke-dasharray="3 3"/>`
      );
    }
    const F = e[b].local, P = t.weekdays[F.getUTCDay()], O = P.charAt(0).toUpperCase() + P.slice(1), D = s.dayLabelShort ? `${O} ${F.getUTCDate()}` : t.dayLabel(O, F.getUTCDate(), t.months[F.getUTCMonth()]), G = c + 1 < z.length ? z[c + 1] : l, W = (G - b) * s.colW - 8, N = D.length * s.dayFont * 0.6;
    if (N <= W) {
      const H = (b > 0 ? r(b) : s.padL) + 6;
      g.push(
        Z(H, s.dayLabelY, D, M.neutral, s.dayFont, 800).replace(
          "<text ",
          `<text class="day-label" data-x0="${H}" data-x1="${(G < l ? r(G) : s.padL + l * s.colW) - 6 - N}" `
        )
      );
    }
  }
  g.push(L2(s, a));
  for (let c = 0; c < l; c++) {
    const b = e[c].precipMaxMm;
    if (b > 0) {
      const F = x(b);
      g.push(
        `<rect x="${r(c) - s.precipMaxW / 2}" y="${s.precipBase - F}" width="${s.precipMaxW}" height="${F}" rx="2" fill="${M.precipMax}"/>`
      );
    }
  }
  for (let c = 0; c < l; c++) {
    const b = e[c].precipMm;
    if (b > 0) {
      const F = x(b);
      g.push(
        `<rect x="${r(c) - s.precipW / 2}" y="${s.precipBase - F}" width="${s.precipW}" height="${F}" rx="2" fill="${M.precip}"/>`
      );
    }
  }
  g.push(
    `<path d="${w2(e, (c) => c.tempC, r, u)}" fill="none" stroke="${M.temp}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let c = 0; c < l; c += 1) {
    const b = e2(e[c].symbol);
    b && g.push(
      `<image x="${r(c) - s.symbolSize / 2}" y="${s.symbolY}" width="${s.symbolSize}" height="${s.symbolSize}" href="${f(b)}"/>`
    );
  }
  d && g.push(
    `<path d="${w2(e, (c) => c.gustMs, r, p)}" fill="none" stroke="${M.gust}" stroke-width="1.8" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), g.push(
    `<path d="${w2(e, (c) => c.windMs, r, p)}" fill="none" stroke="${M.wind}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let c = 0; c < l; c += 1) {
    const b = e[c].tempC;
    b !== null && g.push(
      Z(r(c), Ie(u(b), s), `${Math.round(b)}°`, o2(Math.round(b)), s.tempFont, 800, "middle", !0)
    );
  }
  const k = s.arrowHalf, v = k / 7, $ = `M${(-4 * v).toFixed(1)} ${(2 * v).toFixed(1)} L0 ${(7.5 * v).toFixed(1)} L${(4 * v).toFixed(1)} ${(2 * v).toFixed(1)}`;
  for (let c = 0; c < l; c += 1) {
    const b = e[c].dirDeg;
    b !== null && g.push(
      `<g transform="translate(${r(c)} ${s.arrowY}) rotate(${(b % 360 + 360) % 360})"><line x1="0" y1="${-k}" x2="0" y2="${k}" stroke="${M.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${$}" fill="none" stroke="${M.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  for (let c = 0; c < l; c += 3) {
    const b = String(e[c].local.getUTCHours()).padStart(2, "0");
    g.push(Z(r(c), s.hourLabelY, b, M.neutral, s.hourFont, 700, "middle"));
  }
  if (o >= 0 && o < l) {
    const c = r(o), b = e[o].tempC;
    g.push(
      `<line class="chart-now" x1="${c}" x2="${c}" y1="${s.scrubTop}" y2="${s.scrubBottom}" stroke="${M.now}" stroke-width="2"/>`
    ), b !== null && g.push(
      `<circle class="chart-now-dot" cx="${c}" cy="${u(b)}" r="${s.dotTempR}" fill="${M.temp}" stroke="#ffffff" stroke-width="1.5"/>`
    );
  }
  const B = Math.max(0, Math.min(l - 1, i)), w = r(B), T = e[B]?.tempC ?? null, C = e[B]?.windMs ?? null;
  s.hasTrack && g.push(
    `<line class="scrub-track" x1="${r(0)}" x2="${r(l - 1)}" y1="${s.scrubTop}" y2="${s.scrubTop}" stroke="#DCE3E8" stroke-width="4" stroke-linecap="round"/>`
  ), g.push(
    `<line class="scrub-cursor" x1="${w}" x2="${w}" y1="${s.scrubTop}" y2="${s.scrubBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${w}" cy="${T === null ? 0 : u(T)}" r="${s.dotTempR}" fill="${M.temp}" stroke="#ffffff" stroke-width="1.5"${T === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${w}" cy="${C === null ? 0 : p(C)}" r="${s.dotWindR}" fill="${M.wind}" stroke="#ffffff" stroke-width="1.5"${C === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-handle" cx="${w}" cy="${s.scrubTop}" r="${s.handleR}" fill="#14202B" stroke="#ffffff" stroke-width="2"/>`,
    // Invisible touch strip around the track: drags here scrub; touches
    // elsewhere on the chart scroll it horizontally as normal.
    `<rect class="scrub-hit" x="0" y="${s.hitY}" width="${a}" height="${s.hitH}" fill="transparent" style="touch-action:none;cursor:ew-resize"/>`
  );
  const E = `<svg class="mg-plot" width="${a}" height="${s.height}" viewBox="0 0 ${a} ${s.height}" style="display:block" aria-hidden="true">${g.join("")}</svg>`, h = {
    width: a,
    count: l,
    cx: r,
    tempY: u,
    windY: p,
    indexAt: (c) => Math.max(0, Math.min(l - 1, Math.round((c - s.padL - s.colW / 2) / s.colW)))
  };
  return {
    svg: E,
    axisSvg: Ye(s, m),
    rightAxisSvg: Ke(s, m),
    geo: h
  };
}
function s2(e, t, i) {
  return e === null ? "" : `<svg width="${t}" height="${t}" viewBox="0 0 20 20" style="flex:none;transform:rotate(${(e % 360 + 360) % 360}deg)"><g stroke="${i}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="10" y1="3.5" x2="10" y2="15"/><path d="M5.5 11 L10 16 L14.5 11"/></g></svg>`;
}
function v2(e, t) {
  return e === null ? "" : t.compass[Math.round((e % 360 + 360) % 360 / 45) % 8];
}
function t2(e) {
  if (e.windMs === null) return "–";
  const t = Math.round(e.windMs);
  return e.gustMs === null ? `${t}` : `${t} (${Math.round(e.gustMs)})`;
}
function M0(e, t) {
  const i = e.tempC === null ? "–" : `${Math.round(e.tempC)}°`, n = e.windMs === null ? "–" : `${t2(e)} m/s ${v2(e.dirDeg, t)}`.trim();
  return `${b2(e, t)}, ${i}, ${e.precipMm.toFixed(1)} mm, ${n}`;
}
function $0(e, t, i) {
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
function b2(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], o = t.dateLabel(i.getUTCDate(), t.months[i.getUTCMonth()]), s = String(i.getUTCHours()).padStart(2, "0");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${o} · ${s}:00`;
}
function U2(e) {
  return e.length < 2 ? 1 : Math.max(1, Math.round((e[1].utcMs - e[0].utcMs) / 36e5));
}
function B0(e, t) {
  if (e.length < 2) return "";
  const i = e[e.length - 1], n = (i.utcMs - e[0].utcMs) / 36e5, o = Math.max(1, Math.round(n / 24)), s = i.local, l = t.weekdays[s.getUTCDay()], a = l.charAt(0).toUpperCase() + l.slice(1);
  return t.forecastSpan(
    o,
    t.dayLabel(a, s.getUTCDate(), t.months[s.getUTCMonth()])
  );
}
const N2 = 1.5, Xe = 10, Je = 4;
function j2(e, t = Date.now()) {
  let i = 0;
  for (let n = 0; n < e.length && e[n].utcMs <= t; n++) i = n;
  return i;
}
function f2(e, t = Date.now()) {
  let i = 0, n = 1 / 0;
  for (let o = 0; o < e.length; o++) {
    const s = Math.abs(e[o].utcMs - t);
    s < n && (n = s, i = o);
  }
  return i;
}
function k0(e, t = Date.now()) {
  if (!e.length) return -1;
  const i = U2(e) * 36e5, n = e[0].utcMs - i / 2, o = e[e.length - 1].utcMs + i / 2;
  return t < n || t >= o ? -1 : f2(e, t);
}
function Ze(e, t, i = Date.now()) {
  if (!e.length) return -1;
  const n = U2(e) * 36e5;
  if (t + n <= i) return -1;
  let o = -1, s = 1 / 0;
  for (let l = 0; l < e.length; l++) {
    const a = Math.abs(e[l].utcMs - t);
    a < s && (s = a, o = l);
  }
  return s <= n / 2 ? o : -1;
}
function Qe(e, t) {
  if (!e.length || !Number.isFinite(t)) return -1;
  let i = 0, n = 1 / 0;
  for (let r = 0; r < e.length; r++) {
    const d = Math.abs(e[r].utcMs - t);
    d < n && (n = d, i = r);
  }
  const o = e[i].utcMs, l = (t >= o ? e[i + 1] : e[i - 1]) ?? e[i - 1] ?? e[i + 1], a = l ? Math.abs(l.utcMs - o) : 36e5;
  return n <= a / 2 ? i : -1;
}
function et(e, t, i) {
  const n = t >= 0 ? e[t] : void 0;
  if (!n) return { time: null, tempC: null, source: i };
  const o = n.tempC === null ? null : Math.round(n.tempC) + 0;
  return { time: new Date(n.utcMs).toISOString(), tempC: o, source: i };
}
function M2(e, t, i) {
  return `<div class="lane-chip-wrap" style="transform:translateY(${e}px)"><div class="lane-chip"><span class="chip-swatch-${t}"></span>${f(i)}</div></div>`;
}
function q2(e, t, i, n, o, s = {}) {
  let l = n < 0 ? -1 : Math.min(t.length - 1, n), a = l;
  const r = s.compact ? Le : E2, { svg: d, axisSvg: m, rightAxisSvg: u, geo: p } = Ve(
    t,
    i,
    l,
    r,
    k0(t)
  ), x = s.compact ? 34 : 38, g = s.bare || s.compact ? "" : `<div class="head">
        <div class="title">${f(B0(t, i) || i.nextHours(t.length * U2(t)))}</div>
        <div class="hint">${f(i.swipe)}</div>
      </div>`, z = s.compact ? "graph-bare graph-compact" : s.bare ? "graph-bare" : "card", k = s.bare || s.compact ? `<div class="${z}">` : `<div class="card">${g}`, v = s.compact ? "" : `${M2(46, "temp", i.laneTemp)}
        ${M2(158, "precip", i.lanePrecip)}
        ${M2(244, "wind", i.laneWind)}`, $ = s.compact ? "" : `<span><span class="swatch-pmax"></span>${f(i.legPmax)}</span>`, B = x2(t) ? `<span><span class="swatch-gust"></span>${f(i.legGust)}</span>` : "";
  e.innerHTML = `
    ${k}
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
          ${v}
          ${d}
        </div>
        ${u}
      </div>
      <div class="legend">
        <span><span class="swatch-temp"></span>${f(i.legTemp)}</span>
        <span><span class="swatch-precip"></span>${f(i.legPrecip)}</span>
        ${$}
        <span><span class="swatch-wind"></span>${f(i.legWind)}</span>
        ${B}
      </div>
    </div>`;
  const w = e.querySelector(".mg-plot"), T = (y) => e.querySelector(y), C = T(".scroll"), E = T(".scrub-cursor"), h = T(".scrub-handle"), c = T(".scrub-dot-temp"), b = T(".scrub-dot-wind"), F = T(".ro-time"), P = T(".ro-temp"), O = T(".ro-precip"), D = T(".ro-wind-text"), G = T(".ro-arrow"), W = T(".ro-compass"), N = T(".ro-icon");
  let H, j;
  const X = T(".readout"), _ = e.querySelector(".chart-now-dot"), S = () => {
    const y = t[l], U = !y;
    X.classList.toggle("is-outside", U);
    for (const R of [E, h, c, b])
      U ? R.setAttribute("visibility", "hidden") : R.removeAttribute("visibility");
    if (U ? _?.setAttribute("visibility", "hidden") : _?.removeAttribute("visibility"), U) {
      F.textContent = i.noForecastForTime, C.removeAttribute("aria-valuenow"), C.setAttribute("aria-valuetext", i.noForecastForTime);
      return;
    }
    const q = p.cx(l);
    if (E.setAttribute("x1", `${q}`), E.setAttribute("x2", `${q}`), h.setAttribute("cx", `${q}`), c.setAttribute("cx", `${q}`), c.setAttribute("visibility", y.tempC === null ? "hidden" : "visible"), y.tempC !== null && c.setAttribute("cy", `${p.tempY(y.tempC)}`), b.setAttribute("cx", `${q}`), b.setAttribute("visibility", y.windMs === null ? "hidden" : "visible"), y.windMs !== null && b.setAttribute("cy", `${p.windY(y.windMs)}`), C.setAttribute("aria-valuenow", String(l)), C.setAttribute("aria-valuetext", M0(y, i)), F.textContent = b2(y, i), P.textContent = y.tempC === null ? "–" : `${Math.round(y.tempC)}°`, P.style.color = y.tempC === null ? M.neutral : o2(Math.round(y.tempC)), O.textContent = `${y.precipMm.toFixed(1)} mm`, D.textContent = t2(y), y.dirDeg !== H && (G.innerHTML = s2(y.dirDeg, 14, "#14202B"), H = y.dirDeg), W.textContent = v2(y.dirDeg, i), y.symbol !== j) {
      const R = e2(y.symbol);
      N.innerHTML = R ? `<img src="${f(R)}" width="${x}" height="${x}" alt="">` : "", j = y.symbol;
    }
  };
  S(), _0(C);
  let L = !1;
  const A = () => {
    if (L || !C.clientWidth) return;
    let U = 0;
    e.querySelectorAll(".lane-chip").forEach((R) => {
      U = Math.max(U, R.getBoundingClientRect().width);
    });
    const q = Math.max(
      N2 * r.colW,
      U ? Je + U + Xe : 0
    );
    C.scrollLeft = Math.max(0, p.cx(l) - q), L = !0;
  };
  if (A(), !L && typeof requestAnimationFrame == "function" && (requestAnimationFrame(A), typeof ResizeObserver < "u")) {
    const y = new ResizeObserver(() => {
      A(), (L || !C.isConnected) && y.disconnect();
    });
    y.observe(C);
  }
  const I = (y, U = !1) => {
    const q = w.getBoundingClientRect(), R = p.indexAt(y.clientX - q.left);
    R !== l && (l = R, S(), o?.(R, !1)), U && J();
  }, J = () => {
    a = l, o?.(l, !0);
  };
  w.addEventListener("pointermove", (y) => {
    y.pointerType === "mouse" && I(y);
  }), w.addEventListener("pointerdown", (y) => {
    y.pointerType === "mouse" && I(y, !0);
  }), w.addEventListener("pointerleave", (y) => {
    !s.previewHover?.() || y.pointerType !== "mouse" || y.buttons || l !== a && (l = a, S(), o?.(l, !1));
  }), b0(w, (y) => I(y, !0)), C.addEventListener("keydown", (y) => {
    const U = $0(y.key, l, t.length);
    U !== null && (y.preventDefault(), y.stopPropagation(), U !== l && (l = U, S(), o?.(l, !1), J(), n2()));
  });
  const n2 = () => {
    if (l < 0) return;
    const y = p.cx(l), U = N2 * r.colW;
    y < C.scrollLeft + U ? C.scrollLeft = y - U : y > C.scrollLeft + C.clientWidth - U && (C.scrollLeft = y - C.clientWidth + U);
  }, K = e.querySelector(".scrub-hit");
  let i2 = !1;
  K.addEventListener("pointerdown", (y) => {
    try {
      K.setPointerCapture(y.pointerId);
    } catch {
    }
    i2 = !0, I(y);
  }), K.addEventListener("pointermove", (y) => {
    y.buttons > 0 && I(y);
  });
  const l2 = () => {
    i2 && (i2 = !1, J());
  };
  return K.addEventListener("pointerup", l2), K.addEventListener("pointercancel", l2), {
    // Host-driven: moves the cursor without reporting back (-1 = outside).
    setScrubIdx: (y) => {
      l = y < 0 ? -1 : Math.min(t.length - 1, y), a = l, S(), n2();
    }
  };
}
const tt = {
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
  metaLine: (e, t) => `Greiningartími: ${e} · Síðast uppfært: ${t}`
}, it = {
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
  metaLine: (e, t) => `Analysis: ${e} · Last update: ${t}`
}, ot = {
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
  metaLine: (e, t) => `Análisis: ${e} · Última actualización: ${t}`
}, st = {
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
  metaLine: (e, t) => `Análise: ${e} · Última atualização: ${t}`
}, nt = {
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
  metaLine: (e, t) => `Analiza: ${e} · Ostatnia aktualizacja: ${t}`
}, lt = {
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
  metaLine: (e, t) => `Greiningartíð: ${e} · Seinast dagført: ${t}`
}, Y2 = { is: tt, en: it, fo: lt, pl: nt, es: ot, pt: st }, at = [
  { code: "is", name: "Íslenska" },
  { code: "en", name: "English" },
  { code: "fo", name: "Føroyskt" },
  { code: "pl", name: "Polski" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" }
];
function S0(e) {
  return Y2[e] ?? Y2.is;
}
function rt(e) {
  return Number.isFinite(e) ? e < 10 ? `${e.toFixed(1)} km` : `${Math.round(e)} km` : "";
}
function g2(e, t, i) {
  const n = e < 0 ? "S" : "N", o = i.compass[t < 0 ? 6 : 2];
  return `${Math.abs(e).toFixed(2)}°${n} ${Math.abs(t).toFixed(2)}°${o}`;
}
function ct(e) {
  const { places: t, lat: i, lon: n, t: o } = e;
  if (e.locationName) return { name: e.locationName, source: "attribute" };
  if (e.pickedName) return { name: e.pickedName, source: "picked" };
  if (isNaN(i) || isNaN(n)) return { name: t[0]?.name ?? "", source: "station" };
  if (e.preferCoordinates) return { name: g2(i, n, o), source: "coordinates" };
  let s = null, l = 1 / 0;
  for (const a of t) {
    const r = (a.lat - i) ** 2 + (a.lon - n) ** 2 * 0.2;
    r < l && (l = r, s = a);
  }
  return s ? { name: s.name, source: "station" } : { name: g2(i, n, o), source: "coordinates" };
}
function dt(e, t, i, n, o) {
  return (i !== "coordinates" && !isNaN(e) && !isNaN(t) ? f(g2(e, t, o)) : "") + n;
}
function K2(e, t, i, n = 7) {
  if (!e.length) return [];
  const o = (r) => Date.UTC(r.local.getUTCFullYear(), r.local.getUTCMonth(), r.local.getUTCDate()), s = o(e[Math.max(0, Math.min(e.length - 1, i))]), l = /* @__PURE__ */ new Map();
  for (const r of e) {
    const d = o(r);
    if (d < s) continue;
    let m = l.get(d);
    m || l.set(d, m = []), m.push(r);
  }
  const a = [];
  for (const [r, d] of [...l.entries()].sort((m, u) => m[0] - u[0])) {
    if (a.length >= n) break;
    const m = d[0].local, u = Math.round((r - s) / 864e5), p = t.weekdays[m.getUTCDay()], x = u === 0 ? t.today : u === 1 ? t.tomorrow : p.charAt(0).toUpperCase() + p.slice(1), g = d.map((k) => k.tempC).filter((k) => Number.isFinite(k)), z = d.map((k) => k.windMs).filter((k) => Number.isFinite(k));
    a.push({
      name: x,
      date: t.dateLabel(m.getUTCDate(), t.months[m.getUTCMonth()]),
      dateShort: t.dateLabel(m.getUTCDate(), t.monthsShort[m.getUTCMonth()]),
      maxC: g.length ? Math.round(Math.max(...g)) : null,
      minC: g.length ? Math.round(Math.min(...g)) : null,
      windMean: z.length ? Math.round(z.reduce((k, v) => k + v, 0) / z.length) : null,
      precipMm: d.reduce(
        (k, v) => k + (Number.isFinite(v.precipMm) ? v.precipMm : 0),
        0
      ),
      icons: [3, 9, 15, 21].map((k) => d.find((v) => v.local.getUTCHours() === k)?.symbol ?? "").filter(Boolean),
      noonSymbol: pt(d),
      hours: d
    });
  }
  return a;
}
function P2(e, t) {
  const i = e2(e);
  return i ? `<img src="${f(i)}" width="${t}" height="${t}" alt="">` : `<span style="width:${t}px;height:${t}px;display:inline-block"></span>`;
}
function pt(e) {
  let t = "", i = 1 / 0;
  for (const n of e) {
    const o = Math.abs(n.local.getUTCHours() - 15);
    o < i && n.symbol && (i = o, t = n.symbol);
  }
  return t;
}
function r2(e, t, i = 66, n = 76) {
  const o = e.tempC === null ? null : Math.round(e.tempC), s = e.tempC === null || e.windMs === null ? null : Math.round(e.tempC - 0.35 * e.windMs);
  return `
    <div class="now">
      <div class="now-eyebrow">${f(t.now)}</div>
      <div class="now-main">
        <div class="now-temp" style="font-size:${i}px;color:${o === null ? M.none : "#14202B"}">${o === null ? "–" : `${o}°`}</div>
        <div class="now-icon">${P2(e.symbol, n)}</div>
      </div>
      <div class="now-stats">
        <div class="stat">
          <div class="stat-label">${f(t.feels)}</div>
          <div class="stat-value" style="color:${s === null ? M.none : "#14202B"}">${s === null ? "–" : `${s}°`}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${f(t.precip)}</div>
          <div class="stat-value" style="color:${M.precipText}">${e.precipMm.toFixed(1)} mm</div>
        </div>
        <div class="stat stat--wind-card">
          <div class="stat-label">${f(t.wind)}</div>
          <div class="stat-value stat-wind"><span>${f(t2(e))}</span>${s2(e.dirDeg, 17, "#1E8E6B")}</div>
        </div>
      </div>
    </div>`;
}
const ht = (e = "") => `<svg class="${e}" width="14" height="14" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="${M.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function ut(e) {
  return `<button class="pill" type="button"><span>${f(e)}</span>${ht()}</button>`;
}
function z0(e, t, i = " / ") {
  return e === null || t === null ? "–" : `<span style="color:${o2(e)}">${e}°</span><span class="temp-sep">${i}</span><span style="color:${o2(t)}">${t}°</span>`;
}
function C0(e, t) {
  return `<span class="h-time">${String(e.local.getUTCHours()).padStart(2, "0")}</span><span class="h-icon">${P2(e.symbol, t)}</span><span class="h-temp" style="color:${e.tempC === null ? M.none : o2(Math.round(e.tempC))}">${e.tempC === null ? "–" : `${Math.round(e.tempC)}°`}</span><span class="h-precip">${e.precipMm > 0.05 ? e.precipMm.toFixed(1) : "–"}</span><span class="h-wind">${f(t2(e))} ${s2(e.dirDeg, 14, M.neutral)}</span>`;
}
function T0(e) {
  const t = Date.now(), i = e.length > 1 ? e[1].utcMs - e[0].utcMs : 36e5;
  return (n) => t >= n.utcMs && t < n.utcMs + i ? " hrow-now" : "";
}
function F0(e, t) {
  return `<div class="${e} hrow-head"><span>${f(t.timeCol)}</span><span></span><span class="h-temp">${f(t.tempCol)}</span><span class="h-precip">mm</span><span class="h-wind-h">m/s</span></div>`;
}
const ft = '<svg width="11" height="11" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="#8CA3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', mt = '<svg width="15" height="15" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>', gt = '<svg width="9" height="15" viewBox="0 0 9 15" style="flex:none"><g fill="#B4C6D6"><circle cx="2.5" cy="2.5" r="1.4"/><circle cx="6.5" cy="2.5" r="1.4"/><circle cx="2.5" cy="7.5" r="1.4"/><circle cx="6.5" cy="7.5" r="1.4"/><circle cx="2.5" cy="12.5" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/></g></svg>';
function xt(e, t) {
  const i = String(e.getUTCDate()).padStart(2, "0"), n = t.monthsShort[e.getUTCMonth()], o = String(e.getUTCHours()).padStart(2, "0"), s = String(e.getUTCMinutes()).padStart(2, "0");
  return `${i} ${n} ${o}:${s} UTC`;
}
function vt(e) {
  if (e == null || !Number.isFinite(e)) return null;
  if (e === 0) return "UTC";
  const t = e < 0 ? "-" : "+", i = Math.abs(e), n = Math.floor(i / 60), o = i % 60;
  return o === 0 ? `UTC${t}${n}` : `UTC${t}${n}:${String(o).padStart(2, "0")}`;
}
function bt(e) {
  return [
    e.modelName,
    e.place,
    e.lang,
    vt(e.tzOffsetMin)
  ].filter((t) => !!t).join(" · ");
}
function _t(e, t, i) {
  const n = t ? `<button class="header-close" type="button" aria-label="${f(i.close)}">${mt}</button>` : "";
  return `
    <div class="panel-header panel-drag" data-drag-handle>
      ${gt}
      <button class="pill panel-pill" type="button"><span>${f(e)}</span>${ft}</button>
      ${n}
    </div>`;
}
const yt = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>';
function wt(e, t) {
  return e.startsWith("air_temperature") ? t.laneTemp : e.startsWith("wind_") ? t.laneWind : e.startsWith("lwe_precipitation") ? t.lanePrecip : null;
}
function Mt(e, t, i) {
  if (!e.length) return "";
  const n = [
    ...new Set(
      e.map((s) => wt(s, i)).filter((s) => !!s)
    )
  ].join(", "), o = i.correctedDetail(t, n);
  return `<span class="corrected" title="${f(o)}" aria-label="${f(o)}" role="img">${yt}</span>`;
}
function $t(e, t, i) {
  const n = e?.trim();
  return !n || !Number.isFinite(t) || t < 0 ? "" : `<div class="loc-note">${f(i.stationPlace(n, t.toFixed(1)))}</div>`;
}
function Bt(e) {
  return `<div class="meta-footer">${f(e)}</div>`;
}
function c2(e, t, i = !0) {
  return `<div class="day-chips"><div class="dc-track">${e.map((o, s) => {
    const l = s === t, a = i ? `<div class="dc-date">${f(o.dateShort)}</div>` : "";
    return `
      <button class="day-chip${l ? " sel" : ""}" type="button" data-day="${s}" aria-pressed="${l}">
        <div class="dc-name">${f(o.name)}</div>
        ${a}
        <div class="dc-icon">${P2(o.noonSymbol, i ? 30 : 26)}</div>
        <div class="dc-temps">${z0(o.maxC, o.minC, "/")}</div>
      </button>`;
  }).join("")}</div></div>`;
}
function E0(e, t) {
  const i = (l, a) => `<div class="sel-stat"><span class="sel-stat-label">${f(l)}</span><span class="sel-stat-value">${a}</span></div>`, n = z0(e.maxC, e.minC, " / "), o = e.precipMm > 0.05 ? `${e.precipMm.toFixed(1)} mm` : "–", s = e.windMean === null ? "–" : `${e.windMean} m/s`;
  return `
        <div class="sel-stats">
          ${i(t.tempCol, n)}
          ${i(t.precip, `<span class="sel-stat-precip">${o}</span>`)}
          ${i(t.wind, s)}
        </div>`;
}
function kt(e, t) {
  const i = T0(e.hours), n = e.hours.map((o) => `<div class="hrow${i(o)}">${C0(o, 24)}</div>`).join("");
  return `
    <div class="sel-card">
      <div class="sel-head">
        <div class="sel-title">${f(e.name)} <span class="sel-date">${f(e.date)}</span></div>
      </div>${E0(e, t)}
      ${F0("hrow", t)}
      ${n}
    </div>`;
}
function $2(e, t) {
  const i = T0(e.hours), n = e.hours.map((o) => `<div class="hrow-p${i(o)}">${C0(o, 22)}</div>`).join("");
  return `
    <div class="panel-table">
      ${E0(e, t)}
      ${F0("hrow-p hrow-sticky", t)}
      ${n}
    </div>`;
}
const St = 200;
function V2(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ß/g, "ss").trim();
}
function A0(e, t, i, n) {
  const o = '<svg width="14" height="14" viewBox="0 0 16 16" style="flex:none"><path d="M3 8.5l3.5 3.5L13 5" fill="none" stroke="#1E8E6B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', s = V2(i);
  return e.map((l, a) => ({ p: l, i: a })).filter(({ p: l }) => !s || V2(l.name).includes(s)).slice(0, St).map(({ p: l, i: a }) => {
    const r = l === t, d = l.distanceKm === void 0 ? "" : `<span class="station-dist">${f(rt(l.distanceKm))}</span>`;
    return `
      <button class="station${r ? " sel" : ""}" type="button" data-station="${a}">
        <span class="station-name">${f(l.name)}${r ? ` ${o}` : ""}</span>
        <span class="station-sub">${d}<span class="station-coord">${f(g2(l.lat, l.lon, n))}</span></span>
      </button>`;
  }).join("");
}
function zt(e, t) {
  return `
            <div class="section-label">${f(t.language)}</div>
            <div class="chips chips-langs">
              ${at.map(
    (i) => `<button class="chip${e === i.code ? " on" : ""}" type="button" data-lang="${i.code}" aria-pressed="${e === i.code}">${f(i.name)}</button>`
  ).join("")}
            </div>`;
}
function Ct(e, t, i, n, o, s, l, a = !0, r = !0) {
  const d = e.map(
    (x, g) => `<button class="chip${x.id === t ? " on" : ""}" type="button" data-model="${g}" aria-pressed="${x.id === t}">${f(x.name)}</button>`
  ).join(""), m = r ? `
            <div class="section-label">${f(l.forecastModel)}</div>
            <div class="chips chips-models">${d}</div>` : "", u = a ? zt(i, l) : "", p = m || u ? `
          <div class="ov-col">${m}
            ${u}
          </div>` : "";
  return `
    <div class="backdrop">
      <div class="overlay" role="dialog" aria-modal="true" aria-label="${f(l.settings)}" tabindex="-1">
        <div class="overlay-head">
          <div class="overlay-title">${f(l.settings)}</div>
          <button class="overlay-close" type="button" aria-label="${f(l.close)}">
            <svg width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="ov-cols${p ? "" : " ov-cols--single"}">${p}
          <div class="ov-col ov-col--station">
            <div class="section-label">${f(l.location)}</div>
            <input class="station-search" type="text" enterkeyhint="search" value="${f(s)}" placeholder="${f(l.search)}" aria-label="${f(l.search)}" autocomplete="off">
            <div class="station-list">${A0(n, o, s, l)}</div>
          </div>
        </div>
      </div>
    </div>`;
}
const Tt = 22, d2 = 60;
function Ft(e, t) {
  const { temp: i, gap: n, wind: o } = e, s = i + n + o;
  let l = e.headerPx, a = e.symbolsPx, r = e.arrowsPx;
  const d = l + r;
  t - d - a < d2 && (a = Math.max(
    0,
    Math.min(a, t - d - d2)
  ));
  const m = l + a + r;
  if (t - m < d2 && m > 0) {
    const B = Math.max(0, t - d2) / m;
    l = Math.floor(l * B), a = Math.floor(a * B), r = Math.floor(r * B);
  }
  const p = l + a, x = Math.max(0, t - p - r), g = (B) => p + (s > 0 ? Math.round(B / s * x) : 0), z = p, k = g(i), v = g(i + n), $ = g(i + n + o);
  return {
    height: t,
    // The symbol row sits under the header and above the plot; a spec with
    // symbolsPx 0 collapses it to a zero-height band at the plot's ceiling,
    // which is what the pre-band geometry was.
    symbolTop: l,
    symbolsPx: a,
    plotTop: z,
    // The temperature lane starts at the plot's ceiling; the same edge, named
    // twice because the renderer reads it in two different contexts.
    tempTop: z,
    tempBase: k,
    windTop: v,
    windBase: $,
    plotBottom: $
  };
}
function Et(e) {
  return e.height - e.plotBottom >= Tt;
}
const At = 60, Lt = [
  ".chart-axis",
  ".chart-plot",
  ".chart-axis-right"
];
function L0(e, t, i = At) {
  return !(e > 0) || !(t >= i) ? null : { scale: t / e, heightPx: t };
}
function Ut(e, t) {
  return e * t.scale;
}
function Pt(e, t) {
  return e * t.scale;
}
const Gt = 8;
function Dt(e, t) {
  return {
    dayLabelY: Math.round(t * 1.15),
    // The hour row sits above the SYMBOL row, not above the plot: those are the
    // same edge only when there is no symbol row, and anchoring to the plot put
    // the hours on top of the glyphs.
    hourLabelY: Math.max(
      Math.round(t * 1.15) + 2,
      e.symbolTop - Gt
    )
  };
}
function Ht(e, t) {
  return [
    e.plotTop + 8,
    Math.max(e.plotTop + 8, e.tempBase - t - 2),
    e.windTop + 8
  ];
}
const It = {
  headerPx: 44,
  symbolsPx: 26,
  arrowsPx: 26,
  temp: 126,
  gap: 16,
  wind: 68
}, Ot = 6;
function G2(e) {
  return { ...It, symbolsPx: e + Ot };
}
function Rt(e, t) {
  return e.symbolTop + Math.max(0, Math.round((e.symbolsPx - t) / 2));
}
function D2(e) {
  return e > 0 ? M.temp : e < 0 ? M.tempCold : M.neutral;
}
function H2(e, t, i) {
  const n = Ft(e, t);
  return {
    ...n,
    precipBase: n.tempBase,
    ...Dt(n, i.dayLabelSize),
    laneChipY: Ht(n, i.precipCap)
  };
}
function Wt(e, t) {
  return t === e.height ? e : {
    ...e,
    ...H2(G2(e.symbolSize), t, {
      dayLabelSize: e.dayLabelSize,
      precipCap: e.precipCap
    })
  };
}
const Nt = 240;
function U0(e, t) {
  const i = t ? Math.max(0, t.offsetHeight - t.clientHeight) : 0;
  return e - i;
}
function X2(e, t, i) {
  const n = U0(e, t);
  return n < Nt ? !1 : n < i || n - i > 2;
}
const jt = {
  colW: 26,
  axisW: 46,
  rightAxisW: 24,
  axisFont: 9.5,
  ...H2(G2(20), 262, { dayLabelSize: 13, precipCap: 44 }),
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
}, qt = {
  colW: 42,
  axisW: 52,
  rightAxisW: 28,
  axisFont: 11,
  ...H2(G2(26), 560, { dayLabelSize: 16, precipCap: 84 }),
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
function V(e, t, i, n, o, s, l = "start", a = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${o}" font-weight="${s}" text-anchor="${l}" font-family="Nunito, system-ui, sans-serif"${a ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function B2(e, t, i, n) {
  let o = "", s = !1;
  for (let l = 0; l < e.length; l++) {
    const a = t(e[l]);
    if (a === null) {
      s = !1;
      continue;
    }
    o += `${s ? "L" : "M"}${i(l).toFixed(1)} ${n(a).toFixed(1)} `, s = !0;
  }
  return o.trim();
}
function Yt(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], o = n.charAt(0).toUpperCase() + n.slice(1), s = t.monthsShort[i.getUTCMonth()], l = String(i.getUTCDate()).padStart(2, "0");
  return `${o} ${l} ${s}`;
}
function Kt(e, t) {
  const i = e.map((d) => d.tempC).filter((d) => d !== null), n = y0(i), o = n[0], s = n[n.length - 1];
  if (n.length <= t)
    return { lo: o, hi: s, ticks: n };
  const l = Math.ceil((n.length - 1) / (t - 1)), a = /* @__PURE__ */ new Set();
  for (let d = 0; d < n.length; d += l) a.add(n[d]);
  a.add(s), o < 0 && s > 0 && n.includes(0) && a.add(0);
  const r = [...a].sort((d, m) => d - m);
  return { lo: o, hi: s, ticks: r };
}
function J2(e, t, i = 1) {
  const n = i > 0 ? i : 1, o = (e.tempBase - e.tempTop) * n, s = (e.windBase - e.windTop) * n, { lo: l, hi: a, ticks: r } = Kt(t, He(o)), d = Math.max(e.windMax, w0(t)), m = e.precipCap / e.precipPerMm, u = {
    baseMm: m,
    topMm: h0(t, m)
  };
  return {
    ...e,
    tempLo: l,
    tempHi: a,
    tempTicks: r,
    windMax: d,
    // Derived from the shared tick rule rather than hardcoded per layout, so the
    // wind scale reads the same here as on the mobile chart.
    windTicks: m0(d, s),
    precipTopMm: u.topMm,
    precipTicks: u0(u, e.precipCap * n)
  };
}
function Vt(e, t) {
  const i = (n, o) => n.length === o.length && n.every((s, l) => s === o[l]);
  return i(e.tempTicks, t.tempTicks) && i(e.windTicks, t.windTicks) && i(e.precipTicks, t.precipTicks);
}
function P0(e) {
  const t = {
    baseMm: e.precipCap / e.precipPerMm,
    topMm: e.precipTopMm
  };
  return (i) => e.precipCap * A2(i, t);
}
function G0(e) {
  const t = e.tempHi - e.tempLo;
  return t > 0 ? t : 1;
}
function Xt(e) {
  const t = e.height - e.plotBottom;
  return Et(e) ? e.plotBottom + t / 2 : e.windBase - 14;
}
function Jt(e) {
  const t = (s) => e.tempBase - (s - e.tempLo) / G0(e) * (e.tempBase - e.tempTop), i = (s) => e.windBase - Math.min(s, e.windMax) / e.windMax * (e.windBase - e.windTop), n = [
    `<rect x="0" y="0" width="${e.axisW}" height="${e.height}" fill="#fff"/>`
  ], o = e.axisW - 5;
  for (const s of e.tempTicks)
    n.push(
      V(o, t(s) + Q, g0(s), m2, e.axisFont, 700, "end")
    );
  for (const s of e.windTicks)
    n.push(
      V(o, i(s) + Q, x0(s), m2, e.axisFont, 700, "end")
    );
  return `<svg class="chart-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none">${n.join("")}</svg>`;
}
function Zt(e) {
  const t = e.rightAxisW, i = P0(e), n = e.axisFont, o = [
    `<rect x="0" y="0" width="${t}" height="${e.height}" fill="#fff"/>`
  ];
  for (const s of e.precipTicks)
    o.push(
      V(
        5,
        e.precipBase - i(s) + Q,
        v0(s),
        d0,
        n,
        700,
        "start"
      )
    );
  return `<svg class="chart-axis-right" width="${t}" height="${e.height}" viewBox="0 0 ${t} ${e.height}" style="display:block;flex:none">${o.join("")}</svg>`;
}
function D0(e, t, i, n, o) {
  const s = e.length, l = s * o.colW + o.plotPad, a = (h) => h * o.colW + o.colW / 2, r = (h) => o.tempBase - (h - o.tempLo) / G0(o) * (o.tempBase - o.tempTop), d = (h) => o.windBase - Math.min(h, o.windMax) / o.windMax * (o.windBase - o.windTop), m = P0(o), u = [
    `<rect x="0" y="${o.plotTop}" width="${l}" height="${o.plotBottom - o.plotTop}" fill="#FCFDFE"/>`
  ];
  for (const h of c0(e, o.colW))
    u.push(
      `<rect x="${h.x}" y="${o.plotTop}" width="${h.w}" height="${o.plotBottom - o.plotTop}" fill="${r0}"/>`
    );
  for (let h = 0; h < s; h += o.gridEvery)
    u.push(
      `<line x1="${a(h)}" x2="${a(h)}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const h of o.tempTicks)
    u.push(
      `<line x1="0" x2="${l}" y1="${r(h)}" y2="${r(h)}" stroke="#E7EBEE" stroke-width="1"/>`
    );
  for (const h of o.windTicks)
    u.push(
      `<line x1="0" x2="${l}" y1="${d(h)}" y2="${d(h)}" stroke="#DCE3E8" stroke-width="1"/>`
    );
  for (const h of o.precipTicks) {
    const c = o.precipBase - m(h);
    u.push(
      `<line x1="0" x2="${l}" y1="${c}" y2="${c}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  const p = [0];
  for (let h = 1; h < s; h++)
    e[h].local.getUTCHours() === 0 && p.push(h);
  for (let h = 0; h < p.length; h++) {
    const c = p[h], b = a(c);
    c > 0 && u.push(
      `<line x1="${b}" x2="${b}" y1="${o.dayLabelY - 8}" y2="${o.plotBottom}" stroke="#C2CBD2" stroke-width="1"/>`
    );
    const F = Yt(e[c], t), P = h + 1 < p.length ? p[h + 1] : s, O = (P - c) * o.colW - 10, D = F.length * o.dayLabelSize * 0.6, G = (c > 0 ? b : 0) + F2, W = P < s ? a(P) : s * o.colW;
    D <= O && u.push(
      V(
        G,
        o.dayLabelY,
        F,
        "#14202B",
        o.dayLabelSize,
        900,
        "start"
      ).replace(
        "<text ",
        `<text class="day-label" data-x0="${G}" data-x1="${W - F2 - D}" `
      )
    );
  }
  for (const h of [o.plotTop, o.tempBase, o.windTop, o.plotBottom])
    u.push(`<line x1="0" x2="${l}" y1="${h}" y2="${h}" stroke="#C2CBD2" stroke-width="1"/>`);
  for (let h = 0; h < s; h++) {
    const c = e[h].precipMaxMm;
    if (c > 0) {
      const b = m(c);
      u.push(
        `<rect x="${a(h) - o.precipMaxW / 2}" y="${o.precipBase - b}" width="${o.precipMaxW}" height="${b}" rx="1.5" fill="${M.precipMax}"/>`
      );
    }
  }
  for (let h = 0; h < s; h++) {
    const c = e[h].precipMm;
    if (c > 0) {
      const b = m(c);
      u.push(
        `<rect x="${a(h) - o.precipW / 2}" y="${o.precipBase - b}" width="${o.precipW}" height="${b}" rx="1.5" fill="${M.precip}"/>`
      );
    }
  }
  const x = Rt(o, o.symbolSize);
  for (let h = 0; h < s; h += o.symbolEvery) {
    const c = e2(e[h].symbol);
    if (c) {
      const b = o.symbolSize;
      u.push(
        `<image x="${a(h) - b / 2}" y="${x}" width="${b}" height="${b}" href="${f(c)}"/>`
      );
    }
  }
  u.push(
    `<path d="${B2(e, (h) => h.tempC, a, r)}" fill="none" stroke="${M.temp}" stroke-width="${o.tempStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  ), x2(e) && u.push(
    `<path d="${B2(e, (h) => h.gustMs, a, d)}" fill="none" stroke="${M.gust}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), u.push(
    `<path d="${B2(e, (h) => h.windMs, a, d)}" fill="none" stroke="${M.wind}" stroke-width="${o.windStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  const g = o.colW >= 40 ? 7 : 6, z = o.colW >= 40 ? "M-4 2 L0 7.5 L4 2" : "M-3.5 1.8 L0 6.5 L3.5 1.8", k = Xt(o);
  for (let h = 0; h < s; h += o.arrowEvery) {
    const c = e[h].dirDeg;
    c !== null && u.push(
      `<g transform="translate(${a(h)} ${k}) rotate(${(c % 360 + 360) % 360})"><line x1="0" y1="-${g}" x2="0" y2="${g}" stroke="${M.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${z}" fill="none" stroke="${M.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  if (o.tempLabelEvery > 0) {
    const h = o.tempLabelFont * f0, c = Math.round(o.tempLabelFont * 0.8);
    for (let b = 0; b < s; b += o.tempLabelEvery) {
      const F = e[b].tempC;
      if (F === null) continue;
      const P = r(F) - c, O = P - h < o.tempTop ? r(F) + c + h : P;
      u.push(
        V(
          a(b),
          O,
          `${Math.round(F)}°`,
          D2(Math.round(F)),
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
      const c = e[h].windMs;
      c !== null && u.push(V(a(h), d(c) - 9, `${Math.round(c)}`, M.windText, 10.5, 800, "middle"));
    }
  const v = o.gridEvery === 1 ? 1 : 2;
  for (let h = 0; h < s; h += v) {
    const c = String(e[h].local.getUTCHours()).padStart(2, "0");
    u.push(V(a(h), o.hourLabelY, c, M.neutral, o.hourLabelSize, 700, "middle"));
  }
  if (n >= 0 && n < s) {
    const h = a(n), c = e[n].tempC;
    u.push(
      `<line class="chart-now" x1="${h}" x2="${h}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="${M.now}" stroke-width="2"/>`
    ), c !== null && u.push(
      `<circle class="chart-now-dot" cx="${h}" cy="${r(c)}" r="4.5" fill="${M.temp}" stroke="#fff" stroke-width="1.5"/>`
    );
  }
  const $ = Math.max(0, Math.min(s - 1, i)), B = a($), w = e[$]?.tempC ?? null, T = e[$]?.windMs ?? null;
  return u.push(
    `<line class="scrub-cursor" x1="${B}" x2="${B}" y1="${o.plotTop}" y2="${o.plotBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${B}" cy="${w === null ? 0 : r(w)}" r="4" fill="${M.temp}" stroke="#fff" stroke-width="1.5"${w === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${B}" cy="${T === null ? 0 : d(T)}" r="4" fill="${M.wind}" stroke="#fff" stroke-width="1.5"${T === null ? ' visibility="hidden"' : ""}/>`
  ), { svg: `<svg class="chart-plot" width="${l}" height="${o.height}" viewBox="0 0 ${l} ${o.height}" style="display:block;touch-action:none;cursor:crosshair" aria-hidden="true">${u.join("")}</svg>`, geo: {
    width: l,
    count: s,
    cx: a,
    tempY: r,
    windY: d,
    indexAt: (h) => Math.max(0, Math.min(s - 1, Math.round((h - o.colW / 2) / o.colW)))
  } };
}
function k2(e, t, i) {
  return `<div class="lane-chip-wrap chart-lane" style="transform:translateY(${e}px)"><div class="lane-chip chart-chip"><span class="chip-swatch-${t} chart-swatch-${t}"></span>${f(i)}</div></div>`;
}
const Qt = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 2H2v4M10 2h4v4M2 10v4h4M14 10v4h-4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', e1 = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 6h4V2M14 6h-4V2M6 14v-4H2M10 14v-4h4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function Z2(e, t, i, n, o, s, l = () => 1, a = () => {
}) {
  const r = (u) => {
    const p = e.getBoundingClientRect(), x = l() || 1, g = t.indexAt((u.clientX - p.left) / x);
    g !== i() && (n(g), s(), o(g, !1));
  };
  let d = !1;
  e.addEventListener("pointerdown", (u) => {
    try {
      e.setPointerCapture(u.pointerId);
    } catch {
    }
    d = !0, r(u);
  }), e.addEventListener("pointermove", (u) => {
    const p = u;
    (p.pointerType === "mouse" || p.buttons > 0) && r(p);
  });
  const m = () => {
    d && (d = !1, a());
  };
  e.addEventListener("pointerup", m), e.addEventListener("pointercancel", m);
}
function p2(e, t, i, n, o = () => 1) {
  const s = o() || 1, l = (i * n + n / 2) * s;
  e.scrollLeft = Math.max(0, l - e.clientWidth / 2);
}
function t1(e, t, i) {
  const n = L0(t, i);
  if (!n || !e.querySelector(".chart-plot"))
    return H0(e)();
  e.dataset.chartScale = String(n.scale);
  for (const o of Lt) {
    const s = e.querySelector(o);
    if (!s) continue;
    const l = parseFloat(s.getAttribute("width") || "0");
    s.style.height = `${n.heightPx}px`, s.style.width = `${Ut(l, n).toFixed(2)}px`;
  }
  return e.querySelectorAll(".chart-lane").forEach((o) => {
    const s = /translateY\(([\d.]+)px\)/.exec(o.style.transform);
    s && !o.dataset.laneY && (o.dataset.laneY = s[1]);
    const l = Number(o.dataset.laneY ?? s?.[1] ?? 0);
    o.style.transform = `translateY(${Pt(l, n).toFixed(2)}px)`;
  }), n.scale;
}
function H0(e) {
  return () => {
    const t = e.dataset.chartScale, i = t ? parseFloat(t) : 1;
    return Number.isFinite(i) && i > 0 ? i : 1;
  };
}
function i1(e, t, i, n, o, s, l = !1) {
  const a = Jt(o), r = Zt(o), { svg: d, geo: m } = D0(e, t, i, n, o), u = k2(o.laneChipY[0], "temp", t.laneTemp) + k2(o.laneChipY[1], "precip", t.lanePrecip) + k2(o.laneChipY[2], "wind", t.laneWind), p = Math.max(0, Math.min(e.length - 1, i)), x = l ? `<div class="scrub-rail" role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}"
         aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}"
         aria-valuenow="${p}" style="width:${m.width}px">
         <div class="scrub-grab" style="left:${(m.cx(p) / m.width * 100).toFixed(2)}%"></div>
       </div>
       <div class="scrub-cursor"></div>` : "";
  return `
    <div class="chart${s ? " chart-fs" : ""}">
      ${a}
      <div class="chart-scroll"${l ? "" : ` role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}" aria-valuenow="${p}"`}>
        ${x}
        ${u}
        ${d}
      </div>
      ${r}
    </div>`;
}
function o1(e, t, i = !0) {
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
function s1(e, t, i, n, o = !1, s = !1) {
  const l = e[t], a = l.tempC === null ? "–" : `${Math.round(l.tempC)}°`, r = l.tempC === null ? M.neutral : D2(Math.round(l.tempC)), d = e2(l.symbol), m = d ? `<img src="${f(d)}" width="34" height="34" alt="">` : "", u = f(o ? i.exitFullscreen : i.fullscreen), p = `<button class="chart-fs-btn" type="button" aria-label="${u}" title="${u}">${o ? e1 : Qt}</button>`, x = s ? `<button class="ro-min" type="button" aria-label="${f(i.minimize)}"></button>
       <button class="ro-close" type="button" aria-label="${f(i.close)}"></button>` : "";
  return `
    <div class="readout readout-2a${s ? " readout-pop" : ""}">
      <div class="readout-main">
        <span class="ro-icon">${m}</span>
        <div class="readout-text">
          <div class="ro-time">${f(b2(l, i))}</div>
          <div class="ro-vals">
            <span class="ro-temp" style="color:${r}">${a}</span>
            <span class="ro-precip">${l.precipMm.toFixed(1)} mm</span>
            <span class="ro-wind">
              <span class="ro-wind-text">${f(t2(l))}</span>
              <span class="ro-arrow">${s2(l.dirDeg, 13, "#14202B")}</span>
              <span class="ro-compass">${f(v2(l.dirDeg, i))}</span>
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
function n1(e, t, i) {
  const n = i.expanded ?? !1, o = n ? qt : jt, s = (_, S = o) => {
    const L = J2(S, t, _);
    return e.innerHTML = `
    <div class="graph-bare graph-panel">
      ${s1(t, Math.max(0, Math.min(t.length - 1, i.scrubIdx)), i.t, !0, n, i.fit ?? !1)}
      <div class="chart-fit">
        ${i1(t, i.t, i.scrubIdx, i.nowIdx, L, n, i.fit ?? !1)}
      </div>
      ${o1(i.t, i.metaLine, x2(t))}
    </div>`, L;
  };
  let l = s(1);
  if (i.fit) {
    const _ = e.querySelector(".chart-fit"), S = _ ? L0(l.height, _.clientHeight) : null;
    if (S) {
      const L = J2(o, t, S.scale);
      Vt(L, l) || (l = s(S.scale));
    }
  } else if (n) {
    const _ = e.querySelector(".chart-fit"), S = e.querySelector(".chart-scroll");
    _ && X2(_.clientHeight, S, l.height) && (l = s(1, Wt(o, U0(_.clientHeight, S))));
  }
  let a = i.scrubIdx < 0 ? -1 : Math.min(t.length - 1, i.scrubIdx), r = a;
  const d = e.querySelector(".chart-plot"), m = e.querySelector(".chart-scroll"), u = e.querySelector(".chart-fit"), p = i.fit ? H0(e) : () => 1, x = e.querySelector(".scrub-rail"), g = x ?? m, z = e.querySelector(".scrub-grab"), k = e.querySelector(".chart-scroll > .scrub-cursor"), v = e.querySelector(".readout-pop"), $ = () => {
    if (!(!i.fit || !u) && (t1(e, l.height, u.clientHeight), x && d.style.width)) {
      const _ = p();
      x.style.width = d.style.width, x.style.height = `${Math.round(l.plotTop * _)}px`, z && (z.style.top = `${Math.round(l.plotTop * _ - 5.5)}px`), k && a >= 0 && (k.style.left = `${B.cx(a) * _}px`);
    }
  }, { geo: B } = D0(
    t,
    i.t,
    a,
    i.nowIdx,
    l
  ), w = (_) => e.querySelector(_), T = w(".chart-plot .scrub-cursor"), C = w(".scrub-dot-temp"), E = w(".scrub-dot-wind"), h = w(".ro-time"), c = w(".ro-temp"), b = w(".ro-precip"), F = w(".ro-wind-text"), P = w(".ro-arrow"), O = w(".ro-compass"), D = w(".ro-icon"), G = w(".readout"), W = e.querySelector(".chart-plot .chart-now-dot");
  let N, H;
  const j = () => {
    const _ = t[a], S = !_;
    G.classList.toggle("is-outside", S);
    for (const A of [T, C, E])
      S ? A.setAttribute("visibility", "hidden") : A.removeAttribute("visibility");
    S ? W?.setAttribute("visibility", "hidden") : W?.removeAttribute("visibility");
    for (const A of [z, k])
      A && (A.style.visibility = S ? "hidden" : "");
    if (S) {
      h.textContent = i.t.noForecastForTime, g.removeAttribute("aria-valuenow"), g.setAttribute("aria-valuetext", i.t.noForecastForTime);
      return;
    }
    const L = B.cx(a);
    if (T.setAttribute("x1", `${L}`), T.setAttribute("x2", `${L}`), C.setAttribute("cx", `${L}`), C.setAttribute("visibility", _.tempC === null ? "hidden" : "visible"), _.tempC !== null && C.setAttribute("cy", `${B.tempY(_.tempC)}`), E.setAttribute("cx", `${L}`), E.setAttribute("visibility", _.windMs === null ? "hidden" : "visible"), _.windMs !== null && E.setAttribute("cy", `${B.windY(_.windMs)}`), h.textContent = b2(_, i.t), c.textContent = _.tempC === null ? "–" : `${Math.round(_.tempC)}°`, c.style.color = _.tempC === null ? M.neutral : D2(Math.round(_.tempC)), b.textContent = `${_.precipMm.toFixed(1)} mm`, F.textContent = t2(_), _.dirDeg !== N && (P.innerHTML = s2(_.dirDeg, 13, "#14202B"), N = _.dirDeg), O.textContent = v2(_.dirDeg, i.t), _.symbol !== H) {
      const A = e2(_.symbol);
      D.innerHTML = A ? `<img src="${f(A)}" width="34" height="34" alt="">` : "", H = _.symbol;
    }
    z && (z.style.left = `${(L / B.width * 100).toFixed(2)}%`), k && (k.style.left = `${L * p()}px`), g.setAttribute("aria-valuenow", String(a)), g.setAttribute("aria-valuetext", M0(_, i.t)), v?.classList.remove("is-closed");
  };
  if (v) {
    const _ = e.querySelector(".ro-min");
    _?.addEventListener("click", () => {
      const A = v.classList.toggle("is-min");
      _.setAttribute("aria-label", A ? i.t.expand : i.t.minimize);
    }), e.querySelector(".ro-close")?.addEventListener("click", () => v.classList.add("is-closed"));
    let S = null;
    v.addEventListener("pointerdown", (A) => {
      const I = A;
      if (!I.target.closest(".ro-min, .ro-close")) {
        S = {
          sx: I.clientX,
          sy: I.clientY,
          ox: v.offsetLeft,
          oy: v.offsetTop
        }, v.style.left = `${v.offsetLeft}px`, v.style.top = `${v.offsetTop}px`, v.style.right = "auto", v.classList.add("is-dragging");
        try {
          v.setPointerCapture(I.pointerId);
        } catch {
        }
        I.preventDefault();
      }
    }), v.addEventListener("pointermove", (A) => {
      if (!S) return;
      const I = A, J = v.offsetParent, n2 = (J?.clientWidth ?? 0) - v.offsetWidth, K = (J?.clientHeight ?? 0) - v.offsetHeight, i2 = Math.max(0, Math.min(n2, S.ox + (I.clientX - S.sx))), l2 = Math.max(0, Math.min(K, S.oy + (I.clientY - S.sy)));
      v.style.left = `${i2}px`, v.style.top = `${l2}px`;
    });
    const L = () => {
      S = null, v.classList.remove("is-dragging");
    };
    v.addEventListener("pointerup", L), v.addEventListener("pointercancel", L);
  }
  const X = () => {
    r = a, i.onScrub(a, !0);
  };
  if (i.previewHover) {
    const _ = i.previewHover;
    d.addEventListener("pointerleave", (S) => {
      !_() || S.pointerType !== "mouse" || S.buttons || a !== r && (a = r, j(), i.onScrub(a, !1));
    });
  }
  if (i.fit ? (d.style.touchAction = "pan-x", b0(d, (_) => {
    const S = d.getBoundingClientRect(), L = p() || 1, A = B.indexAt((_.clientX - S.left) / L);
    A !== a && (a = A, j(), i.onScrub(A, !1)), X();
  })) : Z2(
    d,
    B,
    () => a,
    (_) => {
      a = _;
    },
    i.onScrub,
    j,
    p,
    X
  ), x && Z2(
    x,
    B,
    () => a,
    (_) => {
      a = _;
    },
    i.onScrub,
    j,
    p,
    X
  ), g.addEventListener("keydown", (_) => {
    const S = $0(_.key, a, t.length);
    S !== null && (_.preventDefault(), _.stopPropagation(), S !== a && (a = S, j(), p2(m, B, a, l.colW, p), i.onScrub(a, !1), X()));
  }), $(), _0(m, p), p2(m, B, a, l.colW, p), j(), e.querySelector(".chart-fs-btn")?.addEventListener("click", () => i.onFullscreen?.()), i.fit && u && typeof ResizeObserver < "u") {
    const _ = new ResizeObserver(() => {
      if (!u.isConnected) {
        _.disconnect();
        return;
      }
      $(), p2(m, B, a, l.colW, p);
    });
    _.observe(u);
  }
  if (n && !i.fit && u && i.onRedraw && typeof ResizeObserver < "u") {
    const _ = i.onRedraw, S = new ResizeObserver(() => {
      if (!u.isConnected) {
        S.disconnect();
        return;
      }
      X2(u.clientHeight, m, l.height) && (S.disconnect(), _());
    });
    S.observe(u);
  }
  return {
    // Moves the cursor without reporting back (-1 = outside the forecast).
    setScrubIdx: (_) => {
      a = _ < 0 ? -1 : Math.min(t.length - 1, _), r = a, j(), a >= 0 && p2(m, B, a, l.colW, p);
    }
  };
}
const l1 = `
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
.ro-precip { font-size: 13px; font-weight: 800; color: ${M.precipText}; }
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
.chip-swatch-temp { width: 10px; height: 2.5px; background: ${M.temp}; border-radius: 2px; }
.chip-swatch-precip { width: 7px; height: 9px; background: ${M.precip}; border-radius: 2px; }
.chip-swatch-wind { width: 10px; height: 2.5px; background: ${M.wind}; border-radius: 2px; }

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
.swatch-temp { width: 14px; height: 2.5px; background: ${M.temp}; border-radius: 2px; }
.swatch-precip { width: 8px; height: 10px; background: ${M.precip}; border-radius: 2px; }
.swatch-pmax { width: 8px; height: 10px; background: ${M.precipMax}; border-radius: 2px; }
.swatch-wind { width: 14px; height: 2.5px; background: ${M.wind}; border-radius: 2px; }
.swatch-gust { width: 14px; height: 0; border-top: 2.5px dashed ${M.gust}; }

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

.exp-body { flex: 1; min-height: 0; display: flex; }
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
   the native overlay: a swipe is its own affordance there, and a permanent 8px
   rail would cost real height on a short phone in landscape. */
@media (hover: hover) and (pointer: fine) {
  .chart-scroll {
    scrollbar-width: thin;
    scrollbar-color: #C6D4E0 transparent;
  }
  .chart-scroll::-webkit-scrollbar { height: 8px; }
  .chart-scroll::-webkit-scrollbar-track {
    background: transparent;
    margin: 0 2px;
  }
  .chart-scroll::-webkit-scrollbar-thumb {
    background: #C6D4E0;
    border-radius: 4px;
  }
  .chart-scroll::-webkit-scrollbar-thumb:hover { background: #A8BCCC; }
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
.sel-stat-precip { color: ${M.precipText}; }
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
.h-precip { text-align: right; font-weight: 700; color: ${M.precipText}; }
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
`, a1 = `
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
`, r1 = {
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
function I0(e, t, i, n, o = 1) {
  if (t === null || n === null || !e && e !== 0)
    return "";
  let s;
  e < 0.1 * o ? s = "no" : e < 0.3 * o ? s = "little" : e < 3 * o ? s = "some" : s = "much";
  let l;
  t < 0.25 ? l = s === "no" ? "clear" : "scattered" : t < 0.5 ? l = s === "no" ? "fair" : "scattered" : t < 0.75 ? l = "scattered" : l = "overcast";
  let a;
  !i && i !== 0 || i < 0.33 || s === "no" ? a = "rain" : i < 0.66 ? a = "sleet" : a = "snow";
  const r = r1[`${l}_${s}_${a}`];
  if (!r) return "";
  let d = "";
  return l !== "overcast" && (d = n < 0.75 ? "n" : "d"), `${r}${d}`;
}
const Q2 = [
  { max: 12, min: 8, rain: [12, 19, 0.9], wind: 6, dir: 220, cloud: 0.85 },
  { max: 13, min: 9, rain: null, wind: 4, dir: 180, cloud: 0.4 },
  { max: 11, min: 8, rain: [6, 16, 1.4], wind: 8, dir: 160, cloud: 0.9 },
  { max: 14, min: 9, rain: null, wind: 3, dir: 90, cloud: 0.1 },
  { max: 12, min: 8, rain: [14, 20, 0.4], wind: 5, dir: 200, cloud: 0.5 },
  { max: 10, min: 7, rain: [3, 21, 1.8], wind: 10, dir: 150, cloud: 0.95 },
  { max: 13, min: 8, rain: null, wind: 5, dir: 250, cloud: 0.45 }
], c1 = 3;
function d1(e) {
  const t = /* @__PURE__ */ new Date();
  t.setUTCMinutes(0, 0, 0), t.setTime(t.getTime() - c1 * 36e5);
  const i = Date.UTC(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate()
  ), n = [];
  for (let o = 0; o < e; o++) {
    const s = t.getTime() + o * 36e5, l = new Date(s), a = l.getUTCHours(), r = Math.round(
      (Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - i) / 864e5
    ), d = Q2[r % Q2.length], m = Math.round(
      d.min + (d.max - d.min) * (0.5 - 0.5 * Math.cos((a - 4) / 24 * 2 * Math.PI))
    );
    let u = 0;
    d.rain && a >= d.rain[0] && a < d.rain[1] && (u = Math.round(
      d.rain[2] * (0.4 + 0.6 * Math.sin(Math.PI * (a - d.rain[0]) / (d.rain[1] - d.rain[0]))) * 10
    ) / 10);
    const p = Math.max(1, d.wind + Math.round(1.5 * Math.sin((a - 15) / 24 * 2 * Math.PI))), x = a >= 4 && a <= 23 ? 1 : 0;
    n.push({
      local: new Date(s),
      utcMs: s,
      tempC: m,
      precipMm: u,
      precipMaxMm: u > 0 ? Math.round(u * 1.6 * 10) / 10 : 0,
      windMs: p,
      gustMs: Math.round(p * 1.8),
      dirDeg: (d.dir + Math.round(20 * Math.sin(a / 8)) + 360) % 360,
      symbol: I0(u, u > 0 ? 0.9 : d.cloud, 0, x)
    });
  }
  return n;
}
const p1 = [
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
], e0 = [
  { id: "sample/harmonie", name: "HARMONIE 2.5 km" },
  { id: "sample/wrf9", name: "WRF 9 km" },
  { id: "sample/ecmwf", name: "ECMWF 0.1°" }
], h1 = 36e5;
function Y(e, t, i) {
  let n;
  try {
    n = e.data?.[t];
  } catch {
  }
  const o = Array.isArray(n) ? n : [];
  return Array.from({ length: i }, (s, l) => {
    const a = o[l];
    return typeof a == "number" && Number.isFinite(a) ? a : null;
  });
}
function u1(e) {
  let t = [];
  try {
    t = Object.values(e.data ?? {}).filter((i) => Array.isArray(i) && i.length > 0).map((i) => i.length);
  } catch {
  }
  return t.length ? Math.min(...t) : Number.POSITIVE_INFINITY;
}
function f1(e) {
  return e.some((t) => t !== null);
}
function m1(e, t) {
  const i = e.time;
  if (!i || i.length < 2) return [];
  const n = (new Date(i[1]).getTime() - new Date(i[0]).getTime()) / h1, o = e.meta?.location_timezone_offset ?? 0, s = Math.min(
    i.length,
    u1(e),
    Math.ceil(t / n)
  );
  if (!(s > 0)) return [];
  const l = Y(e, "air_temperature_at_2m_agl", s), a = Y(e, "lwe_precipitation_rate", s), r = Y(e, "lwe_precipitation_rate_max", s), d = Y(e, "wind_speed_at_10m_agl", s), m = Y(e, "wind_speed_of_gust_at_10m_agl", s), u = Y(e, "wind_from_direction_at_10m_agl", s), p = Y(e, "cloud_area_fraction", s), x = Y(e, "snow_fraction", s), g = Y(e, "daylight_fraction", s), z = f1(m), k = [];
  for (let v = 0; v < s; v++) {
    const $ = a[v], B = r[v] ?? $, w = new Date(i[v]).getTime();
    k.push({
      local: new Date(w + o * 6e4),
      utcMs: w,
      tempC: l[v],
      // `== null` deliberately, not `===`: a missing value has to read as "no
      // rain", and `undefined * timestepH` is NaN, which paints nothing at all.
      precipMm: $ == null ? 0 : $ * n,
      precipMaxMm: B == null ? 0 : B * n,
      windMs: d[v],
      gustMs: z ? m[v] : null,
      dirDeg: u[v],
      symbol: I0($, p[v], x[v], g[v], n)
    });
  }
  return k;
}
const t0 = "bel-meteogram-nunito", g1 = 168, x1 = 12, O0 = "mimirMapPanelState", v1 = 440, h2 = 700, u2 = 360, i0 = 620, S2 = 360;
function R0() {
  try {
    const e = localStorage.getItem(O0);
    if (!e) return {};
    const t = JSON.parse(e);
    return t && typeof t == "object" ? t : {};
  } catch {
    return {};
  }
}
function b1(e) {
  try {
    const t = R0();
    localStorage.setItem(
      O0,
      JSON.stringify({ ...t, ...e })
    );
  } catch {
  }
}
function _1() {
  if (document.getElementById(t0)) return;
  const e = document.createElement("link");
  e.id = t0, e.rel = "stylesheet", e.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap", document.head.appendChild(e);
}
function z2(e, t) {
  return typeof e == "string" ? e : e[t] ?? e.is ?? e.en ?? Object.values(e)[0] ?? "";
}
function C2(e, t) {
  try {
    localStorage.setItem(`bel-meteogram.${e}`, t);
  } catch {
  }
}
function T2(e) {
  try {
    return localStorage.getItem(`bel-meteogram.${e}`);
  } catch {
    return null;
  }
}
function y1(e) {
  if (!(e instanceof HTMLElement) || !e.classList.length) return null;
  const t = CSS.escape(e.classList[0]);
  for (const i of ["day", "view", "lang", "model"]) {
    const n = e.dataset[i];
    if (n !== void 0) return `.${t}[data-${i}="${CSS.escape(n)}"]`;
  }
  return `.${t}`;
}
const o0 = ".ls-scroll, .panel-table";
function w1(e) {
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
    "selected-time"
  ];
  root;
  body;
  points = [];
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
    if (!this.usesPanel || w1(t.composedPath()[0])) return;
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
    t.textContent = l1, this.root.appendChild(t), this.body = document.createElement("div"), this.body.className = "bel-root", this.root.appendChild(this.body);
  }
  get isFull() {
    return this.getAttribute("mode") === "full";
  }
  get uiLang() {
    return this.getAttribute("language") ?? (this.isFull ? T2("lang") ?? "is" : "is");
  }
  get t() {
    return S0(this.uiLang);
  }
  get hours() {
    const t = parseInt(this.getAttribute("hours") ?? "", 10);
    return Number.isFinite(t) && t > 0 ? t : 48;
  }
  connectedCallback() {
    _1(), this.started = !0, this.isWide = this.mql.matches, this.isLandscape = this.mqlLandscape.matches;
    const t = this.isFull ? R0() : {};
    typeof t.selectedDay == "number" && (this.selectedDay = t.selectedDay), typeof t.scrubUtcMs == "number" && (this.scrubUtcMs = t.scrubUtcMs), (t.view === "table" || t.view === "graph") && (this.view = t.view), t.panelPos && typeof t.panelPos.x == "number" && typeof t.panelPos.y == "number" && (this.panelPos = { ...t.panelPos }), t.panelSize && typeof t.panelSize.w == "number" && typeof t.panelSize.h == "number" && (this.panelSize = { ...t.panelSize });
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
  attributeChangedCallback(t) {
    if (!(!this.started || this.suppressAttrCallback)) {
      if (t === "selected-time") {
        this.applySelectedTime();
        return;
      }
      t === "language" || t === "forecast-label" || t === "analysis-time" || t === "last-updated" || t === "station-place" || t === "station-place-km" ? this.paint() : this.load();
    }
  }
  /** Point the widget at a new location (kept from the previous widget's API) */
  loadChartLocation(t, i, n = "") {
    this.pickedPlaceName = n, this.suppressAttrCallback = !0, this.setAttribute("location-lat", String(t)), this.setAttribute("location-lon", String(i)), this.suppressAttrCallback = !1, this.load();
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
    b1({
      ...t,
      view: this.view,
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
    const t = this.panelSize.w > 0 ? this.panelSize.w : v1;
    return Math.max(u2, Math.min(this.hostW() - 24, t));
  }
  /** Minimum panel height for the current layout (one-column needs more). */
  minPanelH() {
    const t = this.resolvedPanelW() >= h2 ? S2 : i0;
    return Math.min(t, this.hostH() - 24);
  }
  /** Rendered panel height after resolving defaults + clamping to the host. */
  resolvedPanelH() {
    const t = this.hostH() - 24, i = Math.min(840, t), n = this.panelSize.h > 0 ? this.panelSize.h : i;
    return Math.max(this.minPanelH(), Math.min(t, n));
  }
  /** Two-column layout once the panel is at least EXPAND_THRESHOLD wide. */
  isExpanded() {
    return this.resolvedPanelW() >= h2;
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
      w: Math.max(u2, this.hostW() - t * 2),
      h: Math.max(S2, this.hostH() - t * 2)
    }, this.persistMapPanel(), this.paint();
  }
  metaLine(t) {
    const i = this.getAttribute("analysis-time"), n = i ? new Date(i) : this.analysisTime, o = this.getAttribute("last-updated"), s = o ? new Date(o) : this.lastModified, l = (a) => a && !isNaN(a.getTime()) ? xt(a, t) : "–";
    return t.metaLine(l(n), l(s));
  }
  /**
   * Inline left/top/width/height for the draggable panel. Resolves the user's
   * size (or defaults), clamps both size and position to the live host box —
   * so a stored size/position that is now off-screen (window shrunk or reload
   * at a smaller size) snaps back in — and writes the clamped position back.
   */
  panelStyleAttr() {
    const t = this.hostW(), i = this.hostH(), n = this.resolvedPanelW(), o = this.resolvedPanelH(), s = this.panelPos.x >= 0 ? this.panelPos : { x: t - n - 18, y: Math.min(48, Math.max(18, Math.round(i * 0.02))) }, l = Math.max(0, Math.min(t - n, s.x)), a = Math.max(0, Math.min(i - o, s.y));
    return this.panelPos = { x: l, y: a }, ` style="left:${l}px;top:${a}px;width:${n}px;height:${o}px"`;
  }
  emitLocation() {
    const t = parseFloat(this.getAttribute("location-lat") ?? ""), i = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(t) || isNaN(i)) return;
    const n = this.placeName(this.placeList(t, i), t, i, this.t), o = this.points[f2(this.points)]?.tempC ?? null;
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
      this.corrections = [], this.correctedStation = null, this.points = d1(
        this.isFull ? g1 : this.hours
      ), this.isFull && (this.rawForecasts = e0.map((r) => ({ ...r, url: "" })), this.rawStations = p1.map((r, d) => ({
        id: `sample-${d}`,
        name: r.name,
        lat: r.lat,
        lon: r.lon
      })), this.forecastId || (this.forecastId = e0[0].id));
      const a = /* @__PURE__ */ new Date();
      this.lastModified = a, this.analysisTime = new Date(
        Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
      ), this.status = "ready", this.followHostTime(), this.paint(), this.emitStatus(), this.emitLocation(), this.emitHostTime();
      return;
    }
    const o = parseFloat(this.getAttribute("location-lat") ?? ""), s = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(o) || isNaN(s)) {
      this.status = "error", this.paint(), this.emitStatus("missing location-lat/location-lon");
      return;
    }
    this.status = "loading", this.paint(), this.emitStatus();
    const l = {
      clientName: this.getAttribute("client-name") ?? "",
      apiUrl: this.getAttribute("api-url") ?? void 0,
      user: this.getAttribute("api-user") ?? void 0,
      password: this.getAttribute("api-password") ?? void 0
    };
    try {
      const a = await q0(l, n), r = Y0(
        this.getAttribute("forecast-type"),
        this.getAttribute("forecast-name"),
        this.getAttribute("domain")
      ), d = this.forecastId || r || (this.isFull ? T2("model") ?? "" : "");
      let m = K0(a, d);
      if (!m && d !== r && (m = a[0]), !m) throw new Error(`forecast not found: ${d}`);
      this.forecastId = m.id;
      const u = await V0(m.url, n), p = this.isFull ? 1 / 0 : this.hours, x = this.isFull ? void 0 : this.hours, g = a0(u) ? J0(u.stations ?? [], o, s) : null, z = g ? await y2(
        _2(u, o, s, x, g.extra?.ref),
        l,
        n
      ).catch(($) => {
        if (n.aborted) throw $;
        return console.warn("bel-meteogram: station data failed, using the point", $), y2(_2(u, o, s, x), l, n);
      }) : await y2(_2(u, o, s, x), l, n);
      if (t !== this.loadToken) return;
      this.rawForecasts = a, this.rawStations = u.stations ?? [], this.corrections = Object.keys(z.data.meta?.corrections ?? {}), this.correctedStation = this.corrections.length ? g : null, this.points = m1(z.data, p);
      const k = z.data.meta?.location_timezone_offset;
      this.tzOffsetMin = typeof k == "number" ? k : null;
      const v = Z0(
        z.data,
        z.lastModified,
        this.points[0]?.utcMs
      );
      this.analysisTime = v.analysisTime, this.lastModified = v.lastModified, this.status = this.points.length ? "ready" : "error", this.status === "ready" && this.followHostTime(), this.paint(), this.emitStatus(this.points.length ? void 0 : "empty forecast"), this.status === "ready" && (this.emitLocation(), this.emitHostTime());
    } catch (a) {
      if (t !== this.loadToken || n.aborted) return;
      console.error("bel-meteogram: failed to load forecast", a), this.status = "error", this.paint(), this.emitStatus(a instanceof Error ? a.message : String(a));
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
      if (!i || Math.abs(i - this.refitHeight) < x1) return;
      this.refitHeight = i;
      const n = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, { landscape: o, wide: s, expanded: l } = this.layoutFlags();
      if (this.paintGraphHost(o, l, s, this.t), n > 0) {
        const a = this.body.querySelector(".chart-scroll");
        a && (a.scrollLeft = n);
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
    const i = this.body.querySelector(o0)?.scrollTop ?? 0, o = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, s = this.body.querySelector(".day-chips")?.scrollLeft ?? 0, l = this.focusAfterPaint ?? y1(this.root.activeElement);
    this.focusAfterPaint = null, this.isFull ? this.paintFull() : this.paintGraph();
    const a = this.body.querySelector(".day-chips");
    if (a) {
      a.scrollLeft = s;
      const r = a.querySelector(".day-chip.sel");
      if (r) {
        const d = parseFloat(getComputedStyle(a).scrollPaddingLeft) || 0, m = r.offsetLeft - a.offsetLeft - d, u = r.offsetLeft - a.offsetLeft + r.offsetWidth + d;
        m < a.scrollLeft ? a.scrollLeft = m : u > a.scrollLeft + a.clientWidth && (a.scrollLeft = u - a.clientWidth);
      }
    }
    if (l && this.body.querySelector(l)?.focus({ preventScroll: !0 }), i > 0) {
      const r = this.body.querySelector(o0);
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
        <div class="title">${f(B0(this.points, t) || t.nextHours(this.hours))}</div>
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
    const { setScrubIdx: s } = q2(
      this.body,
      n,
      t,
      o,
      (l, a) => this.onUserScrub(n, l, a),
      { previewHover: () => this.hostTimeMs !== null }
    );
    this.graphScrubSetter = s;
  }
  models() {
    const t = this.uiLang, i = this.getAttribute("forecast-label")?.trim();
    return this.rawForecasts.map((n) => ({
      id: n.id,
      name: i && n.id === this.forecastId ? i : z2(n.name, t)
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
      name: z2(s.name, n),
      lat: s.lat,
      lon: s.lon
    }));
    if (!isNaN(t) && !isNaN(i)) {
      for (const s of o) s.distanceKm = s0(t, i, s.lat, s.lon);
      o.sort((s, l) => (s.distanceKm ?? 0) - (l.distanceKm ?? 0));
    }
    return o;
  }
  /** The panel's title for the current point, and where it came from (see
   *  {@link placeTitle}). */
  placeTitle(t, i, n, o) {
    return ct({
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
    return this.scrubUtcMs === null ? -1 : Ze(t, this.scrubUtcMs);
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
    if (this.hostTimeMs !== null) return Qe(t, this.hostTimeMs);
    const i = this.scrubIdx >= 0 ? this.scrubIdx : this.restoreScrubIndex(t);
    return Math.max(
      0,
      Math.min(t.length - 1, i >= 0 ? i : f2(t))
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
    const s = K2(this.points, this.t, j2(this.points)).findIndex((l) => l.hours.includes(n));
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
    const o = et(t, i, n), s = `${o.time}|${o.tempC}`;
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
    const t = this.t, i = this.uiLang, n = parseFloat(this.getAttribute("location-lat") ?? ""), o = parseFloat(this.getAttribute("location-lon") ?? ""), s = this.models(), l = this.placeList(n, o), a = this.placeTitle(l, n, o, t), r = a.name, d = s.find((c) => c.id === this.forecastId) ?? s[0], m = l.find(
      (c) => Math.abs(c.lat - n) < 1e-4 && Math.abs(c.lon - o) < 1e-4
    ) ?? l.find((c) => c.name === r) ?? null, u = this.hasAttribute("closable"), { landscape: p, wide: x, expanded: g } = this.layoutFlags(), z = bt({
      modelName: d?.name ?? "…",
      place: r,
      lang: i.toUpperCase(),
      tzOffsetMin: this.tzOffsetMin
    }), k = dt(
      n,
      o,
      a.source,
      this.status === "ready" && this.correctedStation ? Mt(
        this.corrections,
        z2(this.correctedStation.name, i),
        t
      ) : "",
      t
    ), v = $t(
      this.getAttribute("station-place"),
      parseFloat(this.getAttribute("station-place-km") ?? ""),
      t
    );
    let $ = "";
    if (this.status === "loading")
      $ = '<div class="sk sk-now"></div><div class="sk-rows"><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></div>';
    else if (this.status === "error")
      $ = `<div class="graph-wrap" style="padding-top:12px"><div class="card"><div class="error"><div class="error-msg">${f(t.error)}</div><button class="retry">${f(t.retry)}</button></div></div></div>`;
    else {
      const c = f2(this.points), b = K2(this.points, t, j2(this.points)), F = Math.max(0, Math.min(b.length - 1, this.selectedDay));
      $ = p ? this.landscapeBodyHtml(b, F, this.points[c], t) : g ? this.expandedBodyHtml(b, F, this.points[c], t) : x ? this.desktopBodyHtml(b, F, this.points[c], t) : this.mobileBodyHtml(b, F, this.points[c], t);
    }
    const B = this.settingsOpen ? Ct(
      s,
      this.forecastId,
      i,
      l,
      m,
      this.query,
      t,
      !this.hasAttribute("hide-language"),
      !this.hasAttribute("hide-models")
    ) : "", w = `page ${x ? "wide wide-2a" : "narrow"}${g ? " is-expanded" : ""}${p ? " is-fullscreen" : ""}${u ? " page--closable" : ""} view-${this.view}`, T = this.status === "ready" && x ? Bt(this.metaLine(t)) : "", C = p ? "" : this.panelStyleAttr(), E = p ? "" : `<div class="panel-resize panel-resize-bl" data-resize-handle data-corner="bl" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>
         <div class="panel-resize panel-resize-br" data-resize-handle data-corner="br" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>`, h = x ? `<div class="${w}"${C}>
           ${_t(z, u, t)}
           <section class="panel-loc">
             <div class="panel-loc-name">${f(r)}</div>
             <div class="panel-loc-sub">${k}</div>
             ${v}
           </section>
           ${$}
           ${T}
           ${E}
         </div>` : `<div class="${w}">
           ${u ? this.closeBtnHtml("page-close", t) : ""}
           <section class="loc">
             <h1 class="loc-name">${f(r)}</h1>
             <div class="loc-sub">${k}</div>
             ${v}
           </section>
           <div class="pill-wrap">${ut(z)}</div>
           ${$}
         </div>`;
    this.body.innerHTML = `${h}${B}`, this.wireFull(l, s, m), this.paintGraphHost(p, g, x, t);
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
      const l = this.graphPoints();
      this.renderedGraphPoints = l;
      const a = this.selectedColumn(l);
      this.renderedScrubIdx = a;
      const r = () => this.hostTimeMs !== null;
      if (n) {
        const { setScrubIdx: d } = n1(s, l, {
          scrubIdx: a,
          nowIdx: k0(l),
          onScrub: (m, u) => this.onUserScrub(l, m, u),
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
        this.graphScrubSetter = d;
      } else {
        const { setScrubIdx: d } = q2(
          s,
          l,
          o,
          a,
          (m, u) => this.onUserScrub(l, m, u),
          { previewHover: r }
        );
        this.graphScrubSetter = d;
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
    return `
      <div class="exp-body">
        <div class="exp-left">
          <div class="now-wrap">${r2(n, o, 44, 50)}</div>
          ${c2(t, i, !1)}
          ${$2(t[i], o)}
        </div>
        <div class="exp-right">
          <div class="graph-view graph-view-2a"><div class="graph-host"></div></div>
        </div>
      </div>`;
  }
  /**
   * Desktop draggable panel body: compact now card, equal-width
   * day chips, Table/Graph switch, table or panel meteogram.
   */
  desktopBodyHtml(t, i, n, o) {
    const s = this.view === "table" ? $2(t[i], o) : '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>';
    return `
      ${r2(n, o, 46, 58)}
      ${c2(t, i, !1)}
      <div class="tabs">
        <button class="tab${this.view === "table" ? " on" : ""}" type="button" data-view="table" aria-pressed="${this.view === "table"}">${f(o.table)}</button>
        <button class="tab${this.view === "graph" ? " on" : ""}" type="button" data-view="graph" aria-pressed="${this.view === "graph"}">${f(o.graph)}</button>
      </div>
      ${s}`;
  }
  /** Mobile body: now card + Table/Graph control + chips/card or meteogram */
  mobileBodyHtml(t, i, n, o) {
    const s = this.view === "table" ? `${c2(t, i)}<div class="sel-wrap">${kt(t[i], o)}</div>` : '<div class="graph-wrap"><div class="graph-host"></div></div>';
    return `
      <div class="now-wrap">${r2(n, o)}</div>
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
    const s = this.view === "graph", l = `
      <div class="tabs">
        <button class="tab${s ? "" : " on"}" type="button" data-view="table" aria-pressed="${!s}">${f(o.table)}</button>
        <button class="tab${s ? " on" : ""}" type="button" data-view="graph" aria-pressed="${s}">${f(o.graph)}</button>
      </div>`, a = s ? '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>' : `<div class="ls-scroll">
           <div class="now-wrap">${r2(n, o, 40, 46)}</div>
           ${c2(t, i, !0)}
           ${$2(t[i], o)}
         </div>`;
    return `${l}${a}`;
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
    for (const p of this.body.querySelectorAll(".day-chip[data-day]"))
      p.addEventListener("click", () => {
        const x = parseInt(p.dataset.day ?? "", 10);
        x !== this.selectedDay && (this.selectedDay = x, this.persistMapPanel(), this.paint());
      });
    const s = o("[data-drag-handle]"), l = o(".page.wide-2a");
    if (!this.isLandscape && s && l) {
      let p = null;
      const x = ($, B) => {
        const w = this.clientWidth || l.offsetWidth, T = this.clientHeight || l.offsetHeight, C = l.offsetWidth, E = l.offsetHeight;
        return {
          x: Math.max(0, Math.min(w - C, $)),
          y: Math.max(0, Math.min(T - E, B))
        };
      }, g = ($) => {
        if (!p || $.buttons === 0) return;
        const B = x(
          p.px + $.clientX - p.sx,
          p.py + $.clientY - p.sy
        );
        this.panelPos = B, l.style.left = `${B.x}px`, l.style.top = `${B.y}px`;
      }, z = () => {
        p && (p = null, this.persistMapPanel(), window.removeEventListener("pointermove", g), window.removeEventListener("pointerup", z));
      };
      s.addEventListener("pointerdown", ($) => {
        if ($.target.closest("button")) return;
        const B = l.getBoundingClientRect(), w = this.getBoundingClientRect();
        try {
          s.setPointerCapture($.pointerId);
        } catch {
        }
        p = {
          sx: $.clientX,
          sy: $.clientY,
          px: B.left - w.left,
          py: B.top - w.top
        }, this.panelPos = { x: p.px, y: p.py }, window.addEventListener("pointermove", g), window.addEventListener("pointerup", z);
      });
      const k = ($, B) => {
        let w = null;
        const T = (E) => {
          if (!w || E.buttons === 0) return;
          const h = this.body.querySelector(".page.wide-2a");
          if (!h) return;
          const c = this.getBoundingClientRect(), b = this.clientWidth || c.width, F = this.clientHeight || c.height, P = E.clientX - c.left, O = E.clientY - c.top;
          let D = w.left, G;
          B === "bl" ? (D = Math.max(0, Math.min(w.rightEdge - u2, P)), G = Math.min(b - 8, w.rightEdge - D)) : G = Math.max(u2, Math.min(b - w.left - 8, P - w.left));
          const W = Math.min(
            G >= h2 ? S2 : i0,
            F - w.top - 8
          ), N = Math.max(W, Math.min(F - w.top - 8, O - w.top));
          this.panelPos = { x: D, y: w.top }, this.panelSize = { w: G, h: N };
          const H = G >= h2;
          H !== w.expanded ? (w.expanded = H, this.paint()) : (h.style.left = `${D}px`, h.style.width = `${G}px`, h.style.height = `${N}px`, this.scheduleGraphRefit());
        }, C = () => {
          w && (w = null, window.removeEventListener("pointermove", T), window.removeEventListener("pointerup", C), this.persistMapPanel(), this.cancelGraphRefit(), this.paint());
        };
        $.addEventListener("pointerdown", (E) => {
          E.preventDefault(), E.stopPropagation();
          const h = l.getBoundingClientRect(), c = this.getBoundingClientRect();
          try {
            $.setPointerCapture(E.pointerId);
          } catch {
          }
          w = {
            left: h.left - c.left,
            top: h.top - c.top,
            rightEdge: h.right - c.left,
            expanded: this.isExpanded()
          }, window.addEventListener("pointermove", T), window.addEventListener("pointerup", C);
        });
      }, v = this.body.querySelectorAll("[data-resize-handle]");
      for (const $ of v)
        k($, $.dataset.corner === "br" ? "br" : "bl");
      v.length && !T2("resizeHintSeen") && (v.forEach(($) => $.classList.add("hint")), C2("resizeHintSeen", "1"));
    }
    this.closeOverlay = null;
    const a = o(".backdrop");
    if (!a) return;
    const r = () => {
      this.settingsOpen = !1, this.query = "", this.focusAfterPaint = ".pill", this.paint();
    };
    this.closeOverlay = r;
    const d = o(".overlay");
    d?.addEventListener("keydown", (p) => {
      if (p.key !== "Tab") return;
      const x = [
        ...d.querySelectorAll("button, input, [tabindex='0']")
      ].filter((v) => v.offsetParent !== null);
      if (!x.length) return;
      const g = x[0], z = x[x.length - 1], k = this.root.activeElement;
      p.shiftKey && (k === g || k === d) ? (p.preventDefault(), z.focus()) : !p.shiftKey && k === z && (p.preventDefault(), g.focus());
    }), a.addEventListener("click", (p) => {
      p.target === a && r();
    }), o(".overlay-close")?.addEventListener("click", r);
    for (const p of a.querySelectorAll(".chip[data-model]"))
      p.addEventListener("click", () => {
        const x = i[parseInt(p.dataset.model ?? "", 10)];
        !x || x.id === this.forecastId || (this.forecastId = x.id, C2("model", x.id), this.load());
      });
    for (const p of a.querySelectorAll(".chip[data-lang]"))
      p.addEventListener("click", () => {
        const x = p.dataset.lang ?? "is";
        x !== this.uiLang && (this.suppressAttrCallback = !0, this.setAttribute("language", x), this.suppressAttrCallback = !1, C2("lang", x), this.paint());
      });
    const m = o(".station-search"), u = o(".station-list");
    m?.addEventListener("input", () => {
      this.query = m.value, u && (u.innerHTML = A0(t, n, this.query, this.t));
    }), u?.addEventListener("click", (p) => {
      const x = p.target.closest(".station");
      if (!x) return;
      const g = t[parseInt(x.dataset.station ?? "", 10)];
      g && (this.suppressAttrCallback = !0, this.removeAttribute("location-name"), this.removeAttribute("station-place"), this.removeAttribute("station-place-km"), this.suppressAttrCallback = !1, this.pickedPlaceName = g.name, this.settingsOpen = !1, this.query = "", this.loadChartLocation(g.lat, g.lon, g.name));
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
class M1 extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  /** Where focus was when the sheet opened; it goes back there on close. */
  returnFocus = null;
  onKeyDown = (t) => {
    t.key === "Escape" && !t.defaultPrevented && (t.preventDefault(), this.close());
  };
  configure(t, i) {
    const n = document.createElement("style");
    n.textContent = a1;
    const o = document.createElement("div");
    o.className = "scrim", o.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${f(t)}">
        <div class="grabber"></div>
        <div class="sheet-head">
          <div class="sheet-title"></div>
          <button class="close" type="button" aria-label="${f(S0(i.language ?? "").close)}">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`, o.querySelector(".sheet-title").textContent = t;
    const s = document.createElement("bel-meteogram");
    for (const [a, r] of Object.entries(i))
      s.setAttribute(a, r);
    const l = o.querySelector(".sheet");
    l.appendChild(s), o.addEventListener("click", (a) => {
      a.target === o && this.close();
    }), o.querySelector(".close").addEventListener("click", () => this.close()), this.dragToDismiss(l), this.root.append(n, o);
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
    t.addEventListener("pointerdown", (l) => {
      l.target.closest(".mg-chart") || (o = !0, i = l.clientY, t.setPointerCapture(l.pointerId), t.style.transition = "none");
    }), t.addEventListener("pointermove", (l) => {
      o && (n = Math.max(0, l.clientY - i), t.style.transform = `translateY(${n}px)`);
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
customElements.define("bel-meteogram-sheet", M1);
export {
  I2 as BelMeteogram
};
