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
function e0(e, t, i, n) {
  const s = Math.PI / 180, o = (e + i) / 2 * s, l = (i - e) * s;
  let a = (n - t) * s;
  a > Math.PI && (a -= 2 * Math.PI), a < -Math.PI && (a += 2 * Math.PI);
  const c = a * Math.cos(o);
  return Math.hypot(c, l) * 6371;
}
function G0(e) {
  return e.apiUrl ? e.apiUrl : `${new URL(import.meta.url).origin}/api/v2/widget/meteo/config/${e.clientName}`;
}
const D0 = 3600 * 1e3, a2 = /* @__PURE__ */ new Map();
function t0(e, t) {
  const i = a2.get(e);
  if (i && Date.now() - i.at < D0) return i.json;
  const n = fetch(e).then(async (s) => {
    if (!s.ok) throw new Error(`${t}: HTTP ${s.status}`);
    return await s.json();
  });
  return a2.set(e, { at: Date.now(), json: n }), n.catch(() => {
    a2.get(e)?.json === n && a2.delete(e);
  }), n;
}
async function H0(e) {
  return (await t0(G0(e), "config")).forecasts;
}
function I0(e, t, i) {
  return !e || !t ? "" : e === "schedule" ? `${e}/${t}/${i}` : `${e}/${t}`;
}
function O0(e, t) {
  return t ? e.find((i) => i.id === t) : e[0];
}
function W0(e) {
  return t0(e, "forecast");
}
function b2(e, t, i, n, s) {
  const o = n !== void 0 && Number.isFinite(n) ? `?duration=${n}h` : "", l = s && i0(e) ? `station/${encodeURIComponent(s)}` : `latlon/${t},${i}`;
  return e.station_data_url.replace("[station]", l).replace("meteogram.xml", `meteogram.json${o}`);
}
function i0(e) {
  return !e.forecast_id?.startsWith("upstream/");
}
const N0 = 1;
function R0(e, t, i) {
  let n = null, s = N0;
  for (const o of e) {
    if (!o.extra?.ref) continue;
    const l = e0(t, i, o.lat, o.lon);
    l <= s && (n = o, s = l);
  }
  return n;
}
async function y2(e, t) {
  const i = new Headers();
  t.user && t.password && i.set("Authorization", "Basic " + btoa(`${t.user}:${t.password}`));
  const n = await fetch(e, { headers: i });
  if (!n.ok) throw new Error(`meteogram: HTTP ${n.status}`);
  const s = n.headers.get("Last-Modified");
  return {
    data: await n.json(),
    lastModified: s ? new Date(s) : null
  };
}
function j0(e, t, i, n = /* @__PURE__ */ new Date()) {
  const s = O2(e.meta?.last_modified) ?? t ?? n;
  return { analysisTime: O2(e.meta?.analysis) ?? (i !== void 0 ? new Date(i) : s), lastModified: s };
}
function O2(e) {
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
}, q0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2301d__01d__a)'%3e%3cpath%20fill='url(%2301d__01d__b)'%20d='M75.6%2056.9L91%2050l-15.4-6.8%209.8-13.7-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.8-16.7%2016.8%201.7-9.9-13.5z'/%3e%3cpath%20fill='%23FFD348'%20d='M28.284%2062.509c6.901%2011.908%2022.205%2016.01%2034.208%209.206C74.496%2064.91%2078.497%2049.5%2071.695%2037.491c-6.902-11.908-22.206-16.01-34.21-9.206-11.901%206.905-16.002%2022.315-9.2%2034.224z'/%3e%3cpath%20fill='url(%2301d__01d__c)'%20d='M31.8%2060.493c5.798%209.998%2018.695%2013.497%2028.693%207.699%209.998-5.799%2013.497-18.696%207.699-28.694C62.393%2029.5%2049.496%2026%2039.498%2031.799%2029.5%2037.6%2026%2050.496%2031.799%2060.493z'/%3e%3c/g%3e%3cdefs%3e%3cradialGradient%20id='01d__01d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3clinearGradient%20id='01d__01d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3cclipPath%20id='01d__01d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e", Y0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cpath%20fill='url(%2301n__01n__a)'%20d='M51.4%2021c2.4%204.2%203.9%209.1%203.9%2014.3%200%2015.8-12.8%2028.6-28.6%2028.6-1.3%200-2.5-.1-3.7-.3C28%2072.2%2037.2%2078%2047.7%2078c15.8%200%2028.6-12.8%2028.6-28.6%200-14.6-10.8-26.6-24.9-28.4z'/%3e%3cdefs%3e%3clinearGradient%20id='01n__01n__a'%20x1='34.425'%20x2='71.181'%20y1='75.492'%20y2='31.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e", K0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302d__02d__a)'%3e%3cpath%20fill='url(%2302d__02d__b)'%20fill-rule='evenodd'%20d='M79.698%2037.47L85.4%2029.5l-16.7%201.8%201.7-16.8-13.6%209.9L50%209l-6.8%2015.4-13.7-9.9%201.8%2016.7-16.8-1.7%209.9%2013.6L9%2050l15.4%206.8-9.9%2013.7%2016.7-1.8-1.7%2016.8%2013.6-9.9L50%2091l6.8-15.4%2013.7%209.8-1.35-12.524H53.466c-3.222%200-6.258-1.177-8.55-3.408-2.417-2.292-3.718-5.39-3.78-8.737v-.123c0-3.16%201.24-6.135%203.47-8.365a12.25%2012.25%200%20018.117-3.718c1.673-2.417%204.461-3.842%207.497-3.842h.682C64.248%2039.974%2069.762%2037%2075.649%2037c1.384%200%202.741.163%204.05.47z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M60.178%2072.876c-11.59%205.094-25.43.788-31.894-10.367-6.802-11.909-2.701-27.32%209.202-34.224%2011.991-6.798%2027.276-2.71%2034.188%209.17a18.36%2018.36%200%2000-10.772%207.228h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.765%2011.765%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737%202.292%202.23%205.328%203.408%208.55%203.408h6.712z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__c)'%20fill-rule='evenodd'%20d='M46.356%2070.665C40.454%2069.61%2035.027%2066.058%2031.8%2060.493c-5.798-9.998-2.3-22.895%207.699-28.694%209.774-5.669%2022.32-2.45%2028.294%207.038a18.394%2018.394%200%2000-6.89%205.846h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718%2011.766%2011.766%200%2000-3.47%208.365v.123c.062%203.346%201.363%206.445%203.78%208.737.452.44.934.84%201.44%201.197z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302d__02d__d)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.054-.062-2.54%200-4.895.992-6.63%202.788-1.672%201.735-2.602%203.966-2.602%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.382%202.603H87.98c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302d__02d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.023-.02.01-.002.017.005.023.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02d__02d__c'%20x1='36.496'%20x2='63.495'%20y1='33.908'%20y2='66.084'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02d__02d__d'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='02d__02d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='matrix(41%200%200%2041%2050%2050)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='02d__02d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02d__02d__e'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1382'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", V0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2302n__02n__a)'%3e%3cpath%20fill='url(%2302n__02n__b)'%20fill-rule='evenodd'%20d='M48.3%2032.3c0-5.2-1.5-10.1-3.9-14.3%2011.477%201.465%2020.767%209.688%2023.827%2020.57a18.396%2018.396%200%2000-7.461%206.113h-.682c-3.036%200-5.824%201.425-7.497%203.842a12.25%2012.25%200%2000-8.117%203.718A11.765%2011.765%200%200041%2060.608v.123c.062%203.346%201.363%206.445%203.78%208.737%201.917%201.866%204.355%202.995%206.986%203.314A28.525%2028.525%200%200140.7%2075C30.2%2075%2021%2069.2%2016%2060.6c1.2.2%202.4.3%203.7.3%2015.8%200%2028.6-12.8%2028.6-28.6z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2302n__02n__c)'%20fill-rule='evenodd'%20d='M90.272%2052.428c-1.177-7.001-7.374-12.33-14.623-12.33-5.639%200-10.72%203.16-13.198%208.117a5.715%205.715%200%2000-2.23-.434c-2.603%200-4.834%201.55-5.701%203.842-.372-.062-.682-.062-1.053-.062-2.541%200-4.896.992-6.63%202.788-1.674%201.735-2.603%203.966-2.603%206.32v.124c.062%202.54%201.053%204.833%202.85%206.506%201.673%201.673%203.966%202.603%206.383%202.603h34.512c4.895%200%208.923-3.966%208.923-8.86%200-4.09-2.788-7.622-6.63-8.614z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2302n__02n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M58.176%2065.503c1.107%200%2015.396-.789%2016.407-1.24%201.382-.616-1.481-4.32%200-4.628.669-.139%201.652-.575%201.652-.575s2.698-.992%203.163-.992c.465%200%20.232-1.837.086-2.98l-.086-.819c0-.539-1.606-1.657-1.86-3.017-.175-.947.263-2.221.172-2.459%200%200-.032-.017-.022-.02.008-.002.016.005.022.02.07.033.571.203.571.203%201.207.409%203.116%201.078%204.834%202.256%201.028.704%202.442%202.053%202.442%202.053s1.02.788%201.276%201.045c.62.62%202.478%202.478%203.718%202.478h3.098l1.394.985.31%201.99c0%204.895-4.028%208.86-8.923%208.86H51.36s2.788-3.16%206.816-3.16z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='02n__02n__b'%20x1='27.425'%20x2='64.181'%20y1='72.492'%20y2='28.689'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='02n__02n__c'%20x1='69.329'%20x2='70.568'%20y1='49.702'%20y2='69.902'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='02n__02n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='02n__02n__d'%20width='52.668'%20height='28.565'%20x='47.022'%20y='44.435'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1384'%20stdDeviation='2.169'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", X0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303d__03d__a)'%3e%3cpath%20fill='url(%2303d__03d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303d__03d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303d__03d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03d__03d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03d__03d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='03d__03d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='03d__03d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03d__03d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1385'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", J0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2303n__03n__a)'%3e%3cpath%20fill='url(%2303n__03n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2303n__03n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2303n__03n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='03n__03n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='03n__03n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='03n__03n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='03n__03n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1387'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Z0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2304__04__a)'%3e%3cpath%20fill='%23DDD'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2304__04__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2304__04__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='04__04__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='04__04__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='04__04__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1388'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Q0 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305d__05d__a)'%3e%3cpath%20fill='url(%2305d__05d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305d__05d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305d__05d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05d__05d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05d__05d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='05d__05d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='05d__05d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05d__05d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1389'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ee = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2305n__05n__a)'%3e%3cpath%20fill='url(%2305n__05n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2305n__05n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2305n__05n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='05n__05n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='05n__05n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='05n__05n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='05n__05n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1391'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", te = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307d__07d__a)'%3e%3cpath%20fill='url(%2307d__07d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307d__07d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307d__07d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07d__07d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07d__07d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='07d__07d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='07d__07d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07d__07d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1395'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ie = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2307n__07n__a)'%3e%3cpath%20fill='url(%2307n__07n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2307n__07n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2307n__07n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='07n__07n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='07n__07n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='07n__07n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='07n__07n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1397'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", se = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308d__08d__a)'%3e%3cpath%20fill='url(%2308d__08d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061c.369-.441.759-.868%201.17-1.279%203.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034c1.022-.224%202.07-.37%203.135-.434%202.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.635%2029.635%200%20018.287-7.849c-4.026-6.562-12.633-8.81-19.328-4.927-6.765%203.923-9.155%2012.626-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308d__08d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308d__08d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08d__08d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08d__08d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='08d__08d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='08d__08d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08d__08d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1398'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", oe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2308n__08n__a)'%3e%3cpath%20fill='url(%2308n__08n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.244-7.853%201.673-11.01%204.128a21.852%2021.852%200%2001-5.275-6.11c.892.148%201.785.222%202.752.222%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2308n__08n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2308n__08n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='08n__08n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='08n__08n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='08n__08n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='08n__08n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1400'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ne = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2309__09__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2309__09__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2309__09__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm13%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='09__09__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='09__09__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='09__09__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1401'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", le = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2310__10__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2310__10__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2310__10__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='10__10__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='10__10__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='10__10__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1402'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ae = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2312__12__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2312__12__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2312__12__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M49.5%20100c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='12__12__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='12__12__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='12__12__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1404'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", re = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2313__13__a)'%3e%3cpath%20fill='%23B2B2B2'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2313__13__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2313__13__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M41.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='13__13__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='13__13__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='13__13__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1405'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ce = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340d__40d__a)'%3e%3cpath%20fill='url(%2340d__40d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340d__40d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340d__40d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40d__40d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40d__40d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='40d__40d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='40d__40d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40d__40d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1439'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", de = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2340n__40n__a)'%3e%3cpath%20fill='url(%2340n__40n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2340n__40n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2340n__40n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='40n__40n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='40n__40n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='40n__40n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='40n__40n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1441'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", pe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341d__41d__a)'%3e%3cpath%20fill='url(%2341d__41d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341d__41d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341d__41d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41d__41d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41d__41d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='41d__41d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='41d__41d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41d__41d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1442'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", he = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2341n__41n__a)'%3e%3cpath%20fill='url(%2341n__41n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2341n__41n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2341n__41n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M21.5%2090c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm14%209c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm42%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-14-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm-13%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='41n__41n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='41n__41n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='41n__41n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='41n__41n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1444'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ue = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342d__42d__a)'%3e%3cpath%20fill='url(%2342d__42d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342d__42d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342d__42d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42d__42d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42d__42d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='42d__42d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='42d__42d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42d__42d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1445'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", fe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2342n__42n__a)'%3e%3cpath%20fill='url(%2342n__42n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2342n__42n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2342n__42n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='42n__42n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='42n__42n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='42n__42n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='42n__42n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1447'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343d__43d__a)'%3e%3cpath%20fill='url(%2343d__43d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343d__43d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343d__43d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43d__43d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43d__43d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='43d__43d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='43d__43d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43d__43d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1448'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ge = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2343n__43n__a)'%3e%3cpath%20fill='url(%2343n__43n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2343n__43n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2343n__43n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='43n__43n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='43n__43n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='43n__43n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='43n__43n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1450'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", xe = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344d__44d__a)'%3e%3cpath%20fill='url(%2344d__44d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344d__44d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344d__44d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44d__44d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44d__44d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='44d__44d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='44d__44d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44d__44d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1451'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ve = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2344n__44n__a)'%3e%3cpath%20fill='url(%2344n__44n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2344n__44n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2344n__44n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='44n__44n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='44n__44n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='44n__44n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='44n__44n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1453'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", _e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345d__45d__a)'%3e%3cpath%20fill='url(%2345d__45d__b)'%20fill-rule='evenodd'%20d='M52.315%2018.517l1.757-2.457-11.356%201.224L43.872%205.86l-9.248%206.732L30%202.12l-4.624%2010.472L16.06%205.86l1.224%2011.356L5.86%2016.06l6.732%209.248L2.12%2030l10.472%204.624L5.86%2043.94l.57-.061A19.46%2019.46%200%20017.6%2042.6c3.5-3.6%208.1-5.7%2013.1-6%202.7-3.9%207.2-6.2%2012.1-6.2h1.1c4.363-6.14%2011.011-10.453%2018.415-11.883z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23FFD348'%20fill-rule='evenodd'%20d='M14.867%2037.83A20.01%2020.01%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.679%2029.679%200%200110.672-9.21c-4.775-7.863-15.023-10.525-23.082-5.956-7.87%204.565-10.725%2014.6-6.623%2022.597z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__c)'%20fill-rule='evenodd'%20d='M17.565%2037.034A20.22%2020.22%200%200120.7%2036.6c2.7-3.9%207.2-6.2%2012.1-6.2h1.1a29.632%2029.632%200%20018.287-7.85c-4.026-6.561-12.633-8.81-19.328-4.927-6.765%203.924-9.155%2012.627-5.294%2019.41z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345d__45d__d)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345d__45d__e)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45d__45d__c'%20x1='20.817'%20x2='39.177'%20y1='19.057'%20y2='40.937'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23FFAF22'/%3e%3cstop%20offset='.99'%20stop-color='%23F09900'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45d__45d__d'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cradialGradient%20id='45d__45d__b'%20cx='0'%20cy='0'%20r='1'%20gradientTransform='translate(30%2030)%20scale(27.88)'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.514'%20stop-color='%23D6B849'/%3e%3cstop%20offset='.652'%20stop-color='%23FFCE47'/%3e%3cstop%20offset='1'%20stop-color='%23FFDB73'/%3e%3c/radialGradient%3e%3cclipPath%20id='45d__45d__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45d__45d__e'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1454'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2345n__45n__a)'%3e%3cpath%20fill='url(%2345n__45n__b)'%20fill-rule='evenodd'%20d='M28.443%2013.565c0-3.869-1.116-7.514-2.902-10.638%209.666%201.234%2017.247%208.91%2018.378%2018.607A29.67%2029.67%200%200033.9%2030.4h-1.1c-4.9%200-9.4%202.3-12.1%206.2-4.058.243-7.853%201.673-11.01%204.128a21.853%2021.853%200%2001-5.275-6.111c.892.149%201.785.223%202.752.223%2011.754%200%2021.276-9.522%2021.276-21.275z'%20clip-rule='evenodd'/%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2345n__45n__c)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2345n__45n__d)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='45n__45n__b'%20x1='12.914'%20x2='40.256'%20y1='43.464'%20y2='10.878'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20stop-color='%23686E73'/%3e%3cstop%20offset='.989'%20stop-color='%236A7075'/%3e%3c/linearGradient%3e%3clinearGradient%20id='45n__45n__c'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='45n__45n__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='45n__45n__d'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1456'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ye = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2346__46__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2346__46__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2346__46__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm24-9c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='46__46__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='46__46__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='46__46__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1457'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", we = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2347__47__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2347__47__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2347__47__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2090.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M63.5%2091c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='47__47__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='47__47__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='47__47__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1458'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Me = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2348__48__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2348__48__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2348__48__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M26.7%2081.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm43%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3cpath%20fill='%23006EDB'%20d='M35.5%2099c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm15-8c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5zm28%200c-.3%200-.7-.1-1-.2-1.3-.6-1.8-2-1.3-3.3l3.5-8c.6-1.3%202-1.8%203.3-1.3%201.3.6%201.8%202%201.3%203.3l-3.5%208c-.4%201-1.3%201.5-2.3%201.5z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='48__48__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='48__48__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='48__48__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1459'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", $e = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2349__49__a)'%3e%3cpath%20fill='%23CCC'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2349__49__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2349__49__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M40.7%2092.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm29-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='49__49__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='49__49__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='49__49__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1460'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", Be = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%20fill='none'%20viewBox='0%200%20100%20100'%3e%3cg%20clip-path='url(%2350__50__a)'%3e%3cpath%20fill='%23999'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'/%3e%3cpath%20fill='url(%2350__50__b)'%20fill-rule='evenodd'%20d='M81.3%2042.9C79.4%2031.6%2069.4%2023%2057.7%2023c-9.1%200-17.3%205.1-21.3%2013.1-1.2-.5-2.4-.7-3.6-.7-4.2%200-7.8%202.5-9.2%206.2-.6-.1-1.1-.1-1.7-.1-4.1%200-7.9%201.6-10.7%204.5C8.5%2048.8%207%2052.4%207%2056.2v.2c.1%204.1%201.7%207.8%204.6%2010.5%202.7%202.7%206.4%204.2%2010.3%204.2h55.7c7.9%200%2014.4-6.4%2014.4-14.3%200-6.6-4.5-12.3-10.7-13.9z'%20clip-rule='evenodd'%20opacity='.6'%20style='mix-blend-mode:multiply'/%3e%3cg%20filter='url(%2350__50__c)'%20opacity='.3'%20style='mix-blend-mode:multiply'%3e%3cpath%20fill='%23B6B6B6'%20d='M29.5%2064c1.787%200%2024.848-1.272%2026.48-2%202.23-.994-2.39-6.972%200-7.47%201.08-.224%202.667-.927%202.667-.927s4.352-1.602%205.103-1.602c.75%200%20.374-2.964.14-4.81l-.14-1.32c0-.87-2.592-2.674-3-4.87-.284-1.527.424-3.585.276-3.968%200%200-.05-.029-.036-.032.014-.004.026.007.036.032.112.053.922.327.922.327%201.948.66%205.03%201.74%207.802%203.64%201.658%201.138%203.941%203.314%203.941%203.314s1.645%201.272%202.059%201.687c1%201%204%204%206%204h5L89%2051.59l.5%203.21c0%207.9-6.5%2014.3-14.4%2014.3H18.5S23%2064%2029.5%2064z'/%3e%3c/g%3e%3cpath%20fill='%2300B8F1'%20d='M54.7%2083.5h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14%209h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-28%200h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3zm-14-9h-2.8l1.4-2.5c.4-.6.2-1.5-.5-1.8-.7-.4-1.5-.2-1.9.5l-1.4%202.4-1.4-2.4c-.4-.7-1.2-.9-1.8-.5-.4.2-.6.5-.7.8-.1.3%200%20.7.1%201l1.4%202.4h-2.7c-.8.1-1.4.7-1.4%201.4s.6%201.4%201.4%201.4h2.8l-1.4%202.4c-.2.3-.2.7-.1%201%20.1.3.3.6.6.8.6.4%201.5.1%201.8-.5l1.4-2.4%201.4%202.5c.2.4.7.7%201.2.7.2%200%20.5-.1.7-.2.6-.4.9-1.2.5-1.8l-1.4-2.5h2.8c.7%200%201.4-.6%201.4-1.4%200-.8-.7-1.3-1.4-1.3z'/%3e%3c/g%3e%3cdefs%3e%3clinearGradient%20id='50__50__b'%20x1='47.5'%20x2='49.5'%20y1='38.5'%20y2='71.1'%20gradientUnits='userSpaceOnUse'%3e%3cstop%20offset='.484'%20stop-color='%23fff'%20stop-opacity='0'/%3e%3cstop%20offset='1'%20stop-color='%23B3B2B2'/%3e%3c/linearGradient%3e%3cclipPath%20id='50__50__a'%3e%3cpath%20fill='%23fff'%20d='M0%200h100v100H0z'/%3e%3c/clipPath%3e%3cfilter%20id='50__50__c'%20width='85'%20height='46.101'%20x='11.5'%20y='30'%20color-interpolation-filters='sRGB'%20filterUnits='userSpaceOnUse'%3e%3cfeFlood%20flood-opacity='0'%20result='BackgroundImageFix'/%3e%3cfeBlend%20in='SourceGraphic'%20in2='BackgroundImageFix'%20result='shape'/%3e%3cfeGaussianBlur%20result='effect1_foregroundBlur_149_1461'%20stdDeviation='3.5'/%3e%3c/filter%3e%3c/defs%3e%3c/svg%3e", ke = /* @__PURE__ */ Object.assign({
  "./assets/symbols/01d.svg": q0,
  "./assets/symbols/01n.svg": Y0,
  "./assets/symbols/02d.svg": K0,
  "./assets/symbols/02n.svg": V0,
  "./assets/symbols/03d.svg": X0,
  "./assets/symbols/03n.svg": J0,
  "./assets/symbols/04.svg": Z0,
  "./assets/symbols/05d.svg": Q0,
  "./assets/symbols/05n.svg": ee,
  "./assets/symbols/07d.svg": te,
  "./assets/symbols/07n.svg": ie,
  "./assets/symbols/08d.svg": se,
  "./assets/symbols/08n.svg": oe,
  "./assets/symbols/09.svg": ne,
  "./assets/symbols/10.svg": le,
  "./assets/symbols/12.svg": ae,
  "./assets/symbols/13.svg": re,
  "./assets/symbols/40d.svg": ce,
  "./assets/symbols/40n.svg": de,
  "./assets/symbols/41d.svg": pe,
  "./assets/symbols/41n.svg": he,
  "./assets/symbols/42d.svg": ue,
  "./assets/symbols/42n.svg": fe,
  "./assets/symbols/43d.svg": me,
  "./assets/symbols/43n.svg": ge,
  "./assets/symbols/44d.svg": xe,
  "./assets/symbols/44n.svg": ve,
  "./assets/symbols/45d.svg": _e,
  "./assets/symbols/45n.svg": be,
  "./assets/symbols/46.svg": ye,
  "./assets/symbols/47.svg": we,
  "./assets/symbols/48.svg": Me,
  "./assets/symbols/49.svg": $e,
  "./assets/symbols/50.svg": Be
});
function e2(e) {
  return e ? ke[`./assets/symbols/${e}.svg`] ?? "" : "";
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
}, Se = {
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
const s0 = "rgba(90,112,140,0.055)";
function ze(e) {
  const t = e.local.getUTCHours();
  return t < 5 || t >= 22;
}
function o0(e, t) {
  const i = [];
  let n = null;
  for (let s = 0; s < e.length; s++) {
    const o = ze(e[s]);
    if (o && n === null && (n = s), (!o || s === e.length - 1) && n !== null) {
      const l = o && s === e.length - 1 ? s + 1 : s;
      i.push({ x: n * t, w: (l - n) * t }), n = null;
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
function Z(e, t, i, n, s, o, l = "start", a = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${s}" font-weight="${o}" text-anchor="${l}" font-family="Nunito, system-ui, sans-serif"${a ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function w2(e, t, i, n) {
  let s = "", o = !1;
  for (let l = 0; l < e.length; l++) {
    const a = t(e[l]);
    if (a === null) {
      o = !1;
      continue;
    }
    s += `${o ? "L" : "M"}${i(l).toFixed(1)} ${n(a).toFixed(1)} `, o = !0;
  }
  return s.trim();
}
const g2 = w.none, n0 = w.precipText, l0 = 22, Ce = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function a0(e, t) {
  let i = 0;
  for (const o of e)
    Number.isFinite(o.precipMm) && (i = Math.max(i, o.precipMm)), Number.isFinite(o.precipMaxMm) && (i = Math.max(i, o.precipMaxMm));
  if (!(i > t)) return t;
  const n = 10 ** Math.floor(Math.log10(i)), s = Ce.find((o) => o * n >= i - 1e-9) ?? 10;
  return Number((s * n).toFixed(6));
}
const Fe = 0.5;
function A2(e, t) {
  if (!(e > 0)) return 0;
  const { baseMm: i, topMm: n } = t, s = Math.max(Fe, Math.min(1, i / n));
  if (e <= i || !(n > i))
    return Math.min(1, e / i * s);
  const o = Math.log(e / i) / Math.log(n / i);
  return Math.min(1, s + (1 - s) * o);
}
const Te = [2, 1, 5, 10, 20, 50];
function r0(e, t) {
  if (!(e.topMm > 0) || !(t > 0)) return [];
  const i = Math.min(l0, t / 2) - 1e-9, n = e.topMm > e.baseMm + 1e-9, s = [];
  for (const o of [...n ? [e.topMm] : [], ...Te]) {
    if (o > e.topMm + 1e-9) continue;
    const l = A2(o, e) * t;
    s.every((a) => a.mm !== o && Math.abs(a.y - l) >= i) && s.push({ mm: o, y: l });
  }
  return s.map((o) => o.mm).sort((o, l) => o - l);
}
function Ee(e, t = 8) {
  return Math.max(2, Math.min(t, Math.floor(e / l0)));
}
const Q = 3.5, c0 = 0.705;
function Ae(e, t) {
  const i = t.tempFont * c0, n = Math.max(t.tempTop, t.scrubTop + t.handleR), s = e + t.tempLabelDy;
  return s - i < n ? e - t.tempLabelDy + i : s;
}
const Pe = 20;
function Ue(e) {
  return Number.isInteger(e) && (e <= 2 || e % 5 === 0);
}
function d0(e, t) {
  const i = Math.max(2, Math.floor(t / Pe));
  let n = e;
  for (let o = i; o >= 2; o--)
    if (Ue(e / o)) {
      n = e / o;
      break;
    }
  const s = Math.round(e / n);
  return Array.from({ length: s }, (o, l) => (l + 1) * n);
}
function p0(e) {
  return `${e}°`;
}
function h0(e) {
  return `${e}`;
}
function u0(e) {
  return `${e}`;
}
const T2 = 8, Le = 10, Ge = 500;
function f0(e, t) {
  let i = null;
  e.addEventListener("pointerdown", (n) => {
    const s = n;
    s.pointerType !== "mouse" && (i = { x: s.clientX, y: s.clientY, at: Date.now() });
  }), e.addEventListener("pointercancel", () => {
    i = null;
  }), e.addEventListener("pointerup", (n) => {
    const s = n, o = i;
    i = null, !(!o || s.pointerType === "mouse" || Math.hypot(s.clientX - o.x, s.clientY - o.y) > Le || Date.now() - o.at > Ge) && t(s);
  });
}
function m0(e, t = () => 1) {
  const i = Array.from(
    e.querySelectorAll("text.day-label")
  );
  if (!i.length) return;
  const n = () => {
    const s = t() || 1, o = e.scrollLeft / s;
    for (const l of i) {
      const a = Number(l.dataset.x0), c = Number(l.dataset.x1);
      if (!Number.isFinite(a) || !Number.isFinite(c)) continue;
      const r = Math.min(Math.max(a, o + T2), Math.max(a, c));
      l.setAttribute("x", String(r));
    }
  };
  e.addEventListener("scroll", n, { passive: !0 }), n();
}
function g0(e) {
  const t = e.filter((r) => Number.isFinite(r));
  if (!t.length) return [0, 2, 4, 6, 8];
  const i = Math.min(...t), n = Math.max(...t), s = [1, 2, 5, 10, 20, 50], o = s.find((r) => Math.ceil(n / r) * r - Math.floor(i / r) * r <= r * 5) ?? s[s.length - 1], l = Math.floor(i / o) * o;
  let a = Math.ceil(n / o) * o;
  a === l && (a = l + o);
  const c = [];
  for (let r = l; r <= a; r += o) c.push(r);
  return c;
}
function x0(e) {
  const t = Math.max(
    0,
    ...e.map((i) => Math.max(i.windMs ?? 0, i.gustMs ?? 0))
  );
  return Math.max(20, Math.ceil(t / 10) * 10);
}
function De(e, t = E2) {
  return t.padL + e * t.colW + t.padR;
}
function He(e, t) {
  const i = e.map((r) => r.tempC).filter((r) => Number.isFinite(r)), n = g0(i), [s, o] = [n[0], n[n.length - 1]], l = x0(e), a = t.precipCap / t.precipPerMm, c = { baseMm: a, topMm: a0(e, a) };
  return {
    tempTicks: n,
    windTicks: d0(l, t.windSpan),
    precipTicks: r0(c, t.precipCap),
    ty: (r) => t.tempTop + (o - r) / (o - s) * (t.tempBottom - t.tempTop),
    wy: (r) => t.windBase - Math.min(r, l) / l * t.windSpan,
    ph: (r) => t.precipCap * A2(r, c)
  };
}
function P2(e, t) {
  return e.dividers.map(
    (i) => `<line x1="0" x2="${t}" y1="${i}" y2="${i}" stroke="#EAEEF1" stroke-width="1.5"/>`
  ).join("");
}
function Ie(e, t) {
  const i = e.axisW - e.axisInset, n = [P2(e, e.axisW)];
  for (const s of t.tempTicks)
    n.push(
      Z(i, t.ty(s) + Q, p0(s), g2, e.axisFont, 700, "end")
    );
  for (const s of t.windTicks)
    n.push(
      Z(i, t.wy(s) + Q, h0(s), g2, e.axisFont, 700, "end")
    );
  return `<svg class="mg-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${n.join("")}</svg>`;
}
function Oe(e, t) {
  const i = [P2(e, e.rightAxisW)];
  for (const n of t.precipTicks)
    i.push(
      Z(
        e.axisInset,
        e.precipBase - t.ph(n) + Q,
        u0(n),
        n0,
        e.axisFont,
        700
      )
    );
  return `<svg class="mg-axis-right" width="${e.rightAxisW}" height="${e.height}" viewBox="0 0 ${e.rightAxisW} ${e.height}" style="display:block;flex:none" aria-hidden="true">${i.join("")}</svg>`;
}
function We(e, t, i, n = E2, s = -1) {
  const o = n, l = e.length, a = De(l, o), c = (d) => o.padL + d * o.colW + o.colW / 2, r = x2(e), m = He(e, o), { ty: u, wy: h, ph: g } = m, x = [];
  for (const d of o0(e, o.colW))
    x.push(
      `<rect x="${o.padL + d.x}" y="${o.dayTop}" width="${d.w}" height="${o.dayBottom - o.dayTop}" fill="${s0}"/>`
    );
  for (const d of m.tempTicks)
    x.push(
      `<line x1="0" x2="${a}" y1="${u(d)}" y2="${u(d)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const d of m.precipTicks) {
    const _ = o.precipBase - g(d);
    x.push(
      `<line x1="0" x2="${a}" y1="${_}" y2="${_}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  for (const d of m.windTicks)
    x.push(
      `<line x1="0" x2="${a}" y1="${h(d)}" y2="${h(d)}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  const z = [0];
  for (let d = 1; d < l; d++)
    e[d].local.getUTCHours() === 0 && z.push(d);
  for (let d = 0; d < z.length; d++) {
    const _ = z[d];
    if (_ > 0) {
      const H = c(_);
      x.push(
        `<line x1="${H}" x2="${H}" y1="${o.dayTop}" y2="${o.dayBottom}" stroke="#DCE3E8" stroke-width="1" stroke-dasharray="3 3"/>`
      );
    }
    const T = e[_].local, L = t.weekdays[T.getUTCDay()], O = L.charAt(0).toUpperCase() + L.slice(1), D = o.dayLabelShort ? `${O} ${T.getUTCDate()}` : t.dayLabel(O, T.getUTCDate(), t.months[T.getUTCMonth()]), G = d + 1 < z.length ? z[d + 1] : l, N = (G - _) * o.colW - 8, R = D.length * o.dayFont * 0.6;
    if (R <= N) {
      const H = (_ > 0 ? c(_) : o.padL) + 6;
      x.push(
        Z(H, o.dayLabelY, D, w.neutral, o.dayFont, 800).replace(
          "<text ",
          `<text class="day-label" data-x0="${H}" data-x1="${(G < l ? c(G) : o.padL + l * o.colW) - 6 - R}" `
        )
      );
    }
  }
  x.push(P2(o, a));
  for (let d = 0; d < l; d++) {
    const _ = e[d].precipMaxMm;
    if (_ > 0) {
      const T = g(_);
      x.push(
        `<rect x="${c(d) - o.precipMaxW / 2}" y="${o.precipBase - T}" width="${o.precipMaxW}" height="${T}" rx="2" fill="${w.precipMax}"/>`
      );
    }
  }
  for (let d = 0; d < l; d++) {
    const _ = e[d].precipMm;
    if (_ > 0) {
      const T = g(_);
      x.push(
        `<rect x="${c(d) - o.precipW / 2}" y="${o.precipBase - T}" width="${o.precipW}" height="${T}" rx="2" fill="${w.precip}"/>`
      );
    }
  }
  x.push(
    `<path d="${w2(e, (d) => d.tempC, c, u)}" fill="none" stroke="${w.temp}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let d = 0; d < l; d += 1) {
    const _ = e2(e[d].symbol);
    _ && x.push(
      `<image x="${c(d) - o.symbolSize / 2}" y="${o.symbolY}" width="${o.symbolSize}" height="${o.symbolSize}" href="${f(_)}"/>`
    );
  }
  r && x.push(
    `<path d="${w2(e, (d) => d.gustMs, c, h)}" fill="none" stroke="${w.gust}" stroke-width="1.8" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), x.push(
    `<path d="${w2(e, (d) => d.windMs, c, h)}" fill="none" stroke="${w.wind}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  for (let d = 0; d < l; d += 1) {
    const _ = e[d].tempC;
    _ !== null && x.push(
      Z(c(d), Ae(u(_), o), `${Math.round(_)}°`, s2(Math.round(_)), o.tempFont, 800, "middle", !0)
    );
  }
  const B = o.arrowHalf, v = B / 7, k = `M${(-4 * v).toFixed(1)} ${(2 * v).toFixed(1)} L0 ${(7.5 * v).toFixed(1)} L${(4 * v).toFixed(1)} ${(2 * v).toFixed(1)}`;
  for (let d = 0; d < l; d += 1) {
    const _ = e[d].dirDeg;
    _ !== null && x.push(
      `<g transform="translate(${c(d)} ${o.arrowY}) rotate(${(_ % 360 + 360) % 360})"><line x1="0" y1="${-B}" x2="0" y2="${B}" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${k}" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  for (let d = 0; d < l; d += 3) {
    const _ = String(e[d].local.getUTCHours()).padStart(2, "0");
    x.push(Z(c(d), o.hourLabelY, _, w.neutral, o.hourFont, 700, "middle"));
  }
  if (s >= 0 && s < l) {
    const d = c(s), _ = e[s].tempC;
    x.push(
      `<line class="chart-now" x1="${d}" x2="${d}" y1="${o.scrubTop}" y2="${o.scrubBottom}" stroke="${w.now}" stroke-width="2"/>`
    ), _ !== null && x.push(
      `<circle class="chart-now-dot" cx="${d}" cy="${u(_)}" r="${o.dotTempR}" fill="${w.temp}" stroke="#ffffff" stroke-width="1.5"/>`
    );
  }
  const $ = Math.max(0, Math.min(l - 1, i)), M = c($), F = e[$]?.tempC ?? null, C = e[$]?.windMs ?? null;
  o.hasTrack && x.push(
    `<line class="scrub-track" x1="${c(0)}" x2="${c(l - 1)}" y1="${o.scrubTop}" y2="${o.scrubTop}" stroke="#DCE3E8" stroke-width="4" stroke-linecap="round"/>`
  ), x.push(
    `<line class="scrub-cursor" x1="${M}" x2="${M}" y1="${o.scrubTop}" y2="${o.scrubBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${M}" cy="${F === null ? 0 : u(F)}" r="${o.dotTempR}" fill="${w.temp}" stroke="#ffffff" stroke-width="1.5"${F === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${M}" cy="${C === null ? 0 : h(C)}" r="${o.dotWindR}" fill="${w.wind}" stroke="#ffffff" stroke-width="1.5"${C === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-handle" cx="${M}" cy="${o.scrubTop}" r="${o.handleR}" fill="#14202B" stroke="#ffffff" stroke-width="2"/>`,
    // Invisible touch strip around the track: drags here scrub; touches
    // elsewhere on the chart scroll it horizontally as normal.
    `<rect class="scrub-hit" x="0" y="${o.hitY}" width="${a}" height="${o.hitH}" fill="transparent" style="touch-action:none;cursor:ew-resize"/>`
  );
  const E = `<svg class="mg-plot" width="${a}" height="${o.height}" viewBox="0 0 ${a} ${o.height}" style="display:block" aria-hidden="true">${x.join("")}</svg>`, p = {
    width: a,
    count: l,
    cx: c,
    tempY: u,
    windY: h,
    indexAt: (d) => Math.max(0, Math.min(l - 1, Math.round((d - o.padL - o.colW / 2) / o.colW)))
  };
  return {
    svg: E,
    axisSvg: Ie(o, m),
    rightAxisSvg: Oe(o, m),
    geo: p
  };
}
function o2(e, t, i) {
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
function v0(e, t) {
  const i = e.tempC === null ? "–" : `${Math.round(e.tempC)}°`, n = e.windMs === null ? "–" : `${t2(e)} m/s ${v2(e.dirDeg, t)}`.trim();
  return `${_2(e, t)}, ${i}, ${e.precipMm.toFixed(1)} mm, ${n}`;
}
function _0(e, t, i) {
  const n = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageDown: -24,
    PageUp: 24
  }, s = e === "Home" ? 0 : e === "End" ? i - 1 : e in n ? t + n[e] : null;
  return s === null ? null : Math.max(0, Math.min(i - 1, s));
}
function _2(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], s = t.dateLabel(i.getUTCDate(), t.months[i.getUTCMonth()]), o = String(i.getUTCHours()).padStart(2, "0");
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${s} · ${o}:00`;
}
function U2(e) {
  return e.length < 2 ? 1 : Math.max(1, Math.round((e[1].utcMs - e[0].utcMs) / 36e5));
}
function b0(e, t) {
  if (e.length < 2) return "";
  const i = e[e.length - 1], n = (i.utcMs - e[0].utcMs) / 36e5, s = Math.max(1, Math.round(n / 24)), o = i.local, l = t.weekdays[o.getUTCDay()], a = l.charAt(0).toUpperCase() + l.slice(1);
  return t.forecastSpan(
    s,
    t.dayLabel(a, o.getUTCDate(), t.months[o.getUTCMonth()])
  );
}
const W2 = 1.5, Ne = 10, Re = 4;
function N2(e, t = Date.now()) {
  let i = 0;
  for (let n = 0; n < e.length && e[n].utcMs <= t; n++) i = n;
  return i;
}
function f2(e, t = Date.now()) {
  let i = 0, n = 1 / 0;
  for (let s = 0; s < e.length; s++) {
    const o = Math.abs(e[s].utcMs - t);
    o < n && (n = o, i = s);
  }
  return i;
}
function y0(e, t = Date.now()) {
  if (!e.length) return -1;
  const i = U2(e) * 36e5, n = e[0].utcMs - i / 2, s = e[e.length - 1].utcMs + i / 2;
  return t < n || t >= s ? -1 : f2(e, t);
}
function je(e, t, i = Date.now()) {
  if (!e.length) return -1;
  const n = U2(e) * 36e5;
  if (t + n <= i) return -1;
  let s = -1, o = 1 / 0;
  for (let l = 0; l < e.length; l++) {
    const a = Math.abs(e[l].utcMs - t);
    a < o && (o = a, s = l);
  }
  return o <= n / 2 ? s : -1;
}
function qe(e, t) {
  if (!e.length || !Number.isFinite(t)) return -1;
  let i = 0, n = 1 / 0;
  for (let c = 0; c < e.length; c++) {
    const r = Math.abs(e[c].utcMs - t);
    r < n && (n = r, i = c);
  }
  const s = e[i].utcMs, l = (t >= s ? e[i + 1] : e[i - 1]) ?? e[i - 1] ?? e[i + 1], a = l ? Math.abs(l.utcMs - s) : 36e5;
  return n <= a / 2 ? i : -1;
}
function Ye(e, t, i) {
  const n = t >= 0 ? e[t] : void 0;
  if (!n) return { time: null, tempC: null, source: i };
  const s = n.tempC === null ? null : Math.round(n.tempC) + 0;
  return { time: new Date(n.utcMs).toISOString(), tempC: s, source: i };
}
function M2(e, t, i) {
  return `<div class="lane-chip-wrap" style="transform:translateY(${e}px)"><div class="lane-chip"><span class="chip-swatch-${t}"></span>${f(i)}</div></div>`;
}
function R2(e, t, i, n, s, o = {}) {
  let l = n < 0 ? -1 : Math.min(t.length - 1, n), a = l;
  const c = o.compact ? Se : E2, { svg: r, axisSvg: m, rightAxisSvg: u, geo: h } = We(
    t,
    i,
    l,
    c,
    y0(t)
  ), g = o.compact ? 34 : 38, x = o.bare || o.compact ? "" : `<div class="head">
        <div class="title">${f(b0(t, i) || i.nextHours(t.length * U2(t)))}</div>
        <div class="hint">${f(i.swipe)}</div>
      </div>`, z = o.compact ? "graph-bare graph-compact" : o.bare ? "graph-bare" : "card", B = o.bare || o.compact ? `<div class="${z}">` : `<div class="card">${x}`, v = o.compact ? "" : `${M2(46, "temp", i.laneTemp)}
        ${M2(158, "precip", i.lanePrecip)}
        ${M2(244, "wind", i.laneWind)}`, k = o.compact ? "" : `<span><span class="swatch-pmax"></span>${f(i.legPmax)}</span>`, $ = x2(t) ? `<span><span class="swatch-gust"></span>${f(i.legGust)}</span>` : "";
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
          ${v}
          ${r}
        </div>
        ${u}
      </div>
      <div class="legend">
        <span><span class="swatch-temp"></span>${f(i.legTemp)}</span>
        <span><span class="swatch-precip"></span>${f(i.legPrecip)}</span>
        ${k}
        <span><span class="swatch-wind"></span>${f(i.legWind)}</span>
        ${$}
      </div>
    </div>`;
  const M = e.querySelector(".mg-plot"), F = (b) => e.querySelector(b), C = F(".scroll"), E = F(".scrub-cursor"), p = F(".scrub-handle"), d = F(".scrub-dot-temp"), _ = F(".scrub-dot-wind"), T = F(".ro-time"), L = F(".ro-temp"), O = F(".ro-precip"), D = F(".ro-wind-text"), G = F(".ro-arrow"), N = F(".ro-compass"), R = F(".ro-icon");
  let H, j;
  const X = F(".readout"), y = e.querySelector(".chart-now-dot"), S = () => {
    const b = t[l], U = !b;
    X.classList.toggle("is-outside", U);
    for (const W of [E, p, d, _])
      U ? W.setAttribute("visibility", "hidden") : W.removeAttribute("visibility");
    if (U ? y?.setAttribute("visibility", "hidden") : y?.removeAttribute("visibility"), U) {
      T.textContent = i.noForecastForTime, C.removeAttribute("aria-valuenow"), C.setAttribute("aria-valuetext", i.noForecastForTime);
      return;
    }
    const q = h.cx(l);
    if (E.setAttribute("x1", `${q}`), E.setAttribute("x2", `${q}`), p.setAttribute("cx", `${q}`), d.setAttribute("cx", `${q}`), d.setAttribute("visibility", b.tempC === null ? "hidden" : "visible"), b.tempC !== null && d.setAttribute("cy", `${h.tempY(b.tempC)}`), _.setAttribute("cx", `${q}`), _.setAttribute("visibility", b.windMs === null ? "hidden" : "visible"), b.windMs !== null && _.setAttribute("cy", `${h.windY(b.windMs)}`), C.setAttribute("aria-valuenow", String(l)), C.setAttribute("aria-valuetext", v0(b, i)), T.textContent = _2(b, i), L.textContent = b.tempC === null ? "–" : `${Math.round(b.tempC)}°`, L.style.color = b.tempC === null ? w.neutral : s2(Math.round(b.tempC)), O.textContent = `${b.precipMm.toFixed(1)} mm`, D.textContent = t2(b), b.dirDeg !== H && (G.innerHTML = o2(b.dirDeg, 14, "#14202B"), H = b.dirDeg), N.textContent = v2(b.dirDeg, i), b.symbol !== j) {
      const W = e2(b.symbol);
      R.innerHTML = W ? `<img src="${f(W)}" width="${g}" height="${g}" alt="">` : "", j = b.symbol;
    }
  };
  S(), m0(C);
  let P = !1;
  const A = () => {
    if (P || !C.clientWidth) return;
    let U = 0;
    e.querySelectorAll(".lane-chip").forEach((W) => {
      U = Math.max(U, W.getBoundingClientRect().width);
    });
    const q = Math.max(
      W2 * c.colW,
      U ? Re + U + Ne : 0
    );
    C.scrollLeft = Math.max(0, h.cx(l) - q), P = !0;
  };
  if (A(), !P && typeof requestAnimationFrame == "function" && (requestAnimationFrame(A), typeof ResizeObserver < "u")) {
    const b = new ResizeObserver(() => {
      A(), (P || !C.isConnected) && b.disconnect();
    });
    b.observe(C);
  }
  const I = (b, U = !1) => {
    const q = M.getBoundingClientRect(), W = h.indexAt(b.clientX - q.left);
    W !== l && (l = W, S(), s?.(W, !1)), U && J();
  }, J = () => {
    a = l, s?.(l, !0);
  };
  M.addEventListener("pointermove", (b) => {
    b.pointerType === "mouse" && I(b);
  }), M.addEventListener("pointerdown", (b) => {
    b.pointerType === "mouse" && I(b, !0);
  }), M.addEventListener("pointerleave", (b) => {
    !o.previewHover?.() || b.pointerType !== "mouse" || b.buttons || l !== a && (l = a, S(), s?.(l, !1));
  }), f0(M, (b) => I(b, !0)), C.addEventListener("keydown", (b) => {
    const U = _0(b.key, l, t.length);
    U !== null && (b.preventDefault(), b.stopPropagation(), U !== l && (l = U, S(), s?.(l, !1), J(), n2()));
  });
  const n2 = () => {
    if (l < 0) return;
    const b = h.cx(l), U = W2 * c.colW;
    b < C.scrollLeft + U ? C.scrollLeft = b - U : b > C.scrollLeft + C.clientWidth - U && (C.scrollLeft = b - C.clientWidth + U);
  }, K = e.querySelector(".scrub-hit");
  let i2 = !1;
  K.addEventListener("pointerdown", (b) => {
    try {
      K.setPointerCapture(b.pointerId);
    } catch {
    }
    i2 = !0, I(b);
  }), K.addEventListener("pointermove", (b) => {
    b.buttons > 0 && I(b);
  });
  const l2 = () => {
    i2 && (i2 = !1, J());
  };
  return K.addEventListener("pointerup", l2), K.addEventListener("pointercancel", l2), {
    // Host-driven: moves the cursor without reporting back (-1 = outside).
    setScrubIdx: (b) => {
      l = b < 0 ? -1 : Math.min(t.length - 1, b), a = l, S(), n2();
    }
  };
}
const Ke = {
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
}, Ve = {
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
}, Xe = {
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
}, Je = {
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
}, Ze = {
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
}, Qe = {
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
}, j2 = { is: Ke, en: Ve, fo: Qe, pl: Ze, es: Xe, pt: Je }, et = [
  { code: "is", name: "Íslenska" },
  { code: "en", name: "English" },
  { code: "fo", name: "Føroyskt" },
  { code: "pl", name: "Polski" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" }
];
function w0(e) {
  return j2[e] ?? j2.is;
}
function tt(e) {
  return Number.isFinite(e) ? e < 10 ? `${e.toFixed(1)} km` : `${Math.round(e)} km` : "";
}
function m2(e, t, i) {
  const n = e < 0 ? "S" : "N", s = i.compass[t < 0 ? 6 : 2];
  return `${Math.abs(e).toFixed(2)}°${n} ${Math.abs(t).toFixed(2)}°${s}`;
}
function q2(e, t, i, n = 7) {
  if (!e.length) return [];
  const s = (c) => Date.UTC(c.local.getUTCFullYear(), c.local.getUTCMonth(), c.local.getUTCDate()), o = s(e[Math.max(0, Math.min(e.length - 1, i))]), l = /* @__PURE__ */ new Map();
  for (const c of e) {
    const r = s(c);
    if (r < o) continue;
    let m = l.get(r);
    m || l.set(r, m = []), m.push(c);
  }
  const a = [];
  for (const [c, r] of [...l.entries()].sort((m, u) => m[0] - u[0])) {
    if (a.length >= n) break;
    const m = r[0].local, u = Math.round((c - o) / 864e5), h = t.weekdays[m.getUTCDay()], g = u === 0 ? t.today : u === 1 ? t.tomorrow : h.charAt(0).toUpperCase() + h.slice(1), x = r.map((B) => B.tempC).filter((B) => Number.isFinite(B)), z = r.map((B) => B.windMs).filter((B) => Number.isFinite(B));
    a.push({
      name: g,
      date: t.dateLabel(m.getUTCDate(), t.months[m.getUTCMonth()]),
      dateShort: t.dateLabel(m.getUTCDate(), t.monthsShort[m.getUTCMonth()]),
      maxC: x.length ? Math.round(Math.max(...x)) : null,
      minC: x.length ? Math.round(Math.min(...x)) : null,
      windMean: z.length ? Math.round(z.reduce((B, v) => B + v, 0) / z.length) : null,
      precipMm: r.reduce(
        (B, v) => B + (Number.isFinite(v.precipMm) ? v.precipMm : 0),
        0
      ),
      icons: [3, 9, 15, 21].map((B) => r.find((v) => v.local.getUTCHours() === B)?.symbol ?? "").filter(Boolean),
      noonSymbol: it(r),
      hours: r
    });
  }
  return a;
}
function L2(e, t) {
  const i = e2(e);
  return i ? `<img src="${f(i)}" width="${t}" height="${t}" alt="">` : `<span style="width:${t}px;height:${t}px;display:inline-block"></span>`;
}
function it(e) {
  let t = "", i = 1 / 0;
  for (const n of e) {
    const s = Math.abs(n.local.getUTCHours() - 15);
    s < i && n.symbol && (i = s, t = n.symbol);
  }
  return t;
}
function r2(e, t, i = 66, n = 76) {
  const s = e.tempC === null ? null : Math.round(e.tempC), o = e.tempC === null || e.windMs === null ? null : Math.round(e.tempC - 0.35 * e.windMs);
  return `
    <div class="now">
      <div class="now-eyebrow">${f(t.now)}</div>
      <div class="now-main">
        <div class="now-temp" style="font-size:${i}px;color:${s === null ? w.none : "#14202B"}">${s === null ? "–" : `${s}°`}</div>
        <div class="now-icon">${L2(e.symbol, n)}</div>
      </div>
      <div class="now-stats">
        <div class="stat">
          <div class="stat-label">${f(t.feels)}</div>
          <div class="stat-value" style="color:${o === null ? w.none : "#14202B"}">${o === null ? "–" : `${o}°`}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${f(t.precip)}</div>
          <div class="stat-value" style="color:${w.precipText}">${e.precipMm.toFixed(1)} mm</div>
        </div>
        <div class="stat stat--wind-card">
          <div class="stat-label">${f(t.wind)}</div>
          <div class="stat-value stat-wind"><span>${f(t2(e))}</span>${o2(e.dirDeg, 17, "#1E8E6B")}</div>
        </div>
      </div>
    </div>`;
}
const st = (e = "") => `<svg class="${e}" width="14" height="14" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function ot(e) {
  return `<button class="pill" type="button"><span>${f(e)}</span>${st()}</button>`;
}
function M0(e, t, i = " / ") {
  return e === null || t === null ? "–" : `<span style="color:${s2(e)}">${e}°</span><span class="temp-sep">${i}</span><span style="color:${s2(t)}">${t}°</span>`;
}
function $0(e, t) {
  return `<span class="h-time">${String(e.local.getUTCHours()).padStart(2, "0")}</span><span class="h-icon">${L2(e.symbol, t)}</span><span class="h-temp" style="color:${e.tempC === null ? w.none : s2(Math.round(e.tempC))}">${e.tempC === null ? "–" : `${Math.round(e.tempC)}°`}</span><span class="h-precip">${e.precipMm > 0.05 ? e.precipMm.toFixed(1) : "–"}</span><span class="h-wind">${f(t2(e))} ${o2(e.dirDeg, 14, w.neutral)}</span>`;
}
function B0(e) {
  const t = Date.now(), i = e.length > 1 ? e[1].utcMs - e[0].utcMs : 36e5;
  return (n) => t >= n.utcMs && t < n.utcMs + i ? " hrow-now" : "";
}
function k0(e, t) {
  return `<div class="${e} hrow-head"><span>${f(t.timeCol)}</span><span></span><span class="h-temp">${f(t.tempCol)}</span><span class="h-precip">mm</span><span class="h-wind-h">m/s</span></div>`;
}
const nt = '<svg width="11" height="11" viewBox="0 0 14 14" style="flex:none"><path d="M3 5l4 4 4-4" fill="none" stroke="#8CA3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', lt = '<svg width="15" height="15" viewBox="0 0 16 16"><line x1="3" y1="3" x2="13" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>', at = '<svg width="9" height="15" viewBox="0 0 9 15" style="flex:none"><g fill="#B4C6D6"><circle cx="2.5" cy="2.5" r="1.4"/><circle cx="6.5" cy="2.5" r="1.4"/><circle cx="2.5" cy="7.5" r="1.4"/><circle cx="6.5" cy="7.5" r="1.4"/><circle cx="2.5" cy="12.5" r="1.4"/><circle cx="6.5" cy="12.5" r="1.4"/></g></svg>';
function rt(e, t) {
  const i = String(e.getUTCDate()).padStart(2, "0"), n = t.monthsShort[e.getUTCMonth()], s = String(e.getUTCHours()).padStart(2, "0"), o = String(e.getUTCMinutes()).padStart(2, "0");
  return `${i} ${n} ${s}:${o} UTC`;
}
function ct(e) {
  if (e == null || !Number.isFinite(e)) return null;
  if (e === 0) return "UTC";
  const t = e < 0 ? "-" : "+", i = Math.abs(e), n = Math.floor(i / 60), s = i % 60;
  return s === 0 ? `UTC${t}${n}` : `UTC${t}${n}:${String(s).padStart(2, "0")}`;
}
function dt(e) {
  return [
    e.modelName,
    e.place,
    e.lang,
    ct(e.tzOffsetMin)
  ].filter((t) => !!t).join(" · ");
}
function pt(e, t, i) {
  const n = t ? `<button class="header-close" type="button" aria-label="${f(i.close)}">${lt}</button>` : "";
  return `
    <div class="panel-header panel-drag" data-drag-handle>
      ${at}
      <button class="pill panel-pill" type="button"><span>${f(e)}</span>${nt}</button>
      ${n}
    </div>`;
}
const ht = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>';
function ut(e, t) {
  return e.startsWith("air_temperature") ? t.laneTemp : e.startsWith("wind_") ? t.laneWind : e.startsWith("lwe_precipitation") ? t.lanePrecip : null;
}
function ft(e, t, i) {
  if (!e.length) return "";
  const n = [
    ...new Set(
      e.map((o) => ut(o, i)).filter((o) => !!o)
    )
  ].join(", "), s = i.correctedDetail(t, n);
  return `<span class="corrected" title="${f(s)}" aria-label="${f(s)}" role="img">${ht}</span>`;
}
function mt(e, t, i) {
  const n = e?.trim();
  return !n || !Number.isFinite(t) || t < 0 ? "" : `<div class="loc-note">${f(i.stationPlace(n, t.toFixed(1)))}</div>`;
}
function gt(e) {
  return `<div class="meta-footer">${f(e)}</div>`;
}
function c2(e, t, i = !0) {
  return `<div class="day-chips"><div class="dc-track">${e.map((s, o) => {
    const l = o === t, a = i ? `<div class="dc-date">${f(s.dateShort)}</div>` : "";
    return `
      <button class="day-chip${l ? " sel" : ""}" type="button" data-day="${o}" aria-pressed="${l}">
        <div class="dc-name">${f(s.name)}</div>
        ${a}
        <div class="dc-icon">${L2(s.noonSymbol, i ? 30 : 26)}</div>
        <div class="dc-temps">${M0(s.maxC, s.minC, "/")}</div>
      </button>`;
  }).join("")}</div></div>`;
}
function S0(e, t) {
  const i = (l, a) => `<div class="sel-stat"><span class="sel-stat-label">${f(l)}</span><span class="sel-stat-value">${a}</span></div>`, n = M0(e.maxC, e.minC, " / "), s = e.precipMm > 0.05 ? `${e.precipMm.toFixed(1)} mm` : "–", o = e.windMean === null ? "–" : `${e.windMean} m/s`;
  return `
        <div class="sel-stats">
          ${i(t.tempCol, n)}
          ${i(t.precip, `<span class="sel-stat-precip">${s}</span>`)}
          ${i(t.wind, o)}
        </div>`;
}
function xt(e, t) {
  const i = B0(e.hours), n = e.hours.map((s) => `<div class="hrow${i(s)}">${$0(s, 24)}</div>`).join("");
  return `
    <div class="sel-card">
      <div class="sel-head">
        <div class="sel-title">${f(e.name)} <span class="sel-date">${f(e.date)}</span></div>
      </div>${S0(e, t)}
      ${k0("hrow", t)}
      ${n}
    </div>`;
}
function $2(e, t) {
  const i = B0(e.hours), n = e.hours.map((s) => `<div class="hrow-p${i(s)}">${$0(s, 22)}</div>`).join("");
  return `
    <div class="panel-table">
      ${S0(e, t)}
      ${k0("hrow-p hrow-sticky", t)}
      ${n}
    </div>`;
}
const vt = 200;
function Y2(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ß/g, "ss").trim();
}
function z0(e, t, i, n) {
  const s = '<svg width="14" height="14" viewBox="0 0 16 16" style="flex:none"><path d="M3 8.5l3.5 3.5L13 5" fill="none" stroke="#1E8E6B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', o = Y2(i);
  return e.map((l, a) => ({ p: l, i: a })).filter(({ p: l }) => !o || Y2(l.name).includes(o)).slice(0, vt).map(({ p: l, i: a }) => {
    const c = l === t, r = l.distanceKm === void 0 ? "" : `<span class="station-dist">${f(tt(l.distanceKm))}</span>`;
    return `
      <button class="station${c ? " sel" : ""}" type="button" data-station="${a}">
        <span class="station-name">${f(l.name)}${c ? ` ${s}` : ""}</span>
        <span class="station-sub">${r}<span class="station-coord">${f(m2(l.lat, l.lon, n))}</span></span>
      </button>`;
  }).join("");
}
function _t(e, t) {
  return `
            <div class="section-label">${f(t.language)}</div>
            <div class="chips chips-langs">
              ${et.map(
    (i) => `<button class="chip${e === i.code ? " on" : ""}" type="button" data-lang="${i.code}" aria-pressed="${e === i.code}">${f(i.name)}</button>`
  ).join("")}
            </div>`;
}
function bt(e, t, i, n, s, o, l, a = !0, c = !0) {
  const r = e.map(
    (g, x) => `<button class="chip${g.id === t ? " on" : ""}" type="button" data-model="${x}" aria-pressed="${g.id === t}">${f(g.name)}</button>`
  ).join(""), m = c ? `
            <div class="section-label">${f(l.forecastModel)}</div>
            <div class="chips chips-models">${r}</div>` : "", u = a ? _t(i, l) : "", h = m || u ? `
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
        <div class="ov-cols${h ? "" : " ov-cols--single"}">${h}
          <div class="ov-col ov-col--station">
            <div class="section-label">${f(l.location)}</div>
            <input class="station-search" type="text" enterkeyhint="search" value="${f(o)}" placeholder="${f(l.search)}" aria-label="${f(l.search)}" autocomplete="off">
            <div class="station-list">${z0(n, s, o, l)}</div>
          </div>
        </div>
      </div>
    </div>`;
}
const yt = 22, d2 = 60;
function wt(e, t) {
  const { temp: i, gap: n, wind: s } = e, o = i + n + s;
  let l = e.headerPx, a = e.symbolsPx, c = e.arrowsPx;
  const r = l + c;
  t - r - a < d2 && (a = Math.max(
    0,
    Math.min(a, t - r - d2)
  ));
  const m = l + a + c;
  if (t - m < d2 && m > 0) {
    const $ = Math.max(0, t - d2) / m;
    l = Math.floor(l * $), a = Math.floor(a * $), c = Math.floor(c * $);
  }
  const h = l + a, g = Math.max(0, t - h - c), x = ($) => h + (o > 0 ? Math.round($ / o * g) : 0), z = h, B = x(i), v = x(i + n), k = x(i + n + s);
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
    tempBase: B,
    windTop: v,
    windBase: k,
    plotBottom: k
  };
}
function Mt(e) {
  return e.height - e.plotBottom >= yt;
}
const $t = 60, Bt = [
  ".chart-axis",
  ".chart-plot",
  ".chart-axis-right"
];
function C0(e, t, i = $t) {
  return !(e > 0) || !(t >= i) ? null : { scale: t / e, heightPx: t };
}
function kt(e, t) {
  return e * t.scale;
}
function St(e, t) {
  return e * t.scale;
}
const zt = 8;
function Ct(e, t) {
  return {
    dayLabelY: Math.round(t * 1.15),
    // The hour row sits above the SYMBOL row, not above the plot: those are the
    // same edge only when there is no symbol row, and anchoring to the plot put
    // the hours on top of the glyphs.
    hourLabelY: Math.max(
      Math.round(t * 1.15) + 2,
      e.symbolTop - zt
    )
  };
}
function Ft(e, t) {
  return [
    e.plotTop + 8,
    Math.max(e.plotTop + 8, e.tempBase - t - 2),
    e.windTop + 8
  ];
}
const Tt = {
  headerPx: 44,
  symbolsPx: 26,
  arrowsPx: 26,
  temp: 126,
  gap: 16,
  wind: 68
}, Et = 6;
function G2(e) {
  return { ...Tt, symbolsPx: e + Et };
}
function At(e, t) {
  return e.symbolTop + Math.max(0, Math.round((e.symbolsPx - t) / 2));
}
function D2(e) {
  return e > 0 ? w.temp : e < 0 ? w.tempCold : w.neutral;
}
function H2(e, t, i) {
  const n = wt(e, t);
  return {
    ...n,
    precipBase: n.tempBase,
    ...Ct(n, i.dayLabelSize),
    laneChipY: Ft(n, i.precipCap)
  };
}
function Pt(e, t) {
  return t === e.height ? e : {
    ...e,
    ...H2(G2(e.symbolSize), t, {
      dayLabelSize: e.dayLabelSize,
      precipCap: e.precipCap
    })
  };
}
const Ut = 240, Lt = {
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
}, Gt = {
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
function V(e, t, i, n, s, o, l = "start", a = !1) {
  return `<text x="${e}" y="${t}" fill="${n}" font-size="${s}" font-weight="${o}" text-anchor="${l}" font-family="Nunito, system-ui, sans-serif"${a ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : ""}>${f(i)}</text>`;
}
function B2(e, t, i, n) {
  let s = "", o = !1;
  for (let l = 0; l < e.length; l++) {
    const a = t(e[l]);
    if (a === null) {
      o = !1;
      continue;
    }
    s += `${o ? "L" : "M"}${i(l).toFixed(1)} ${n(a).toFixed(1)} `, o = !0;
  }
  return s.trim();
}
function Dt(e, t) {
  const i = e.local, n = t.weekdays[i.getUTCDay()], s = n.charAt(0).toUpperCase() + n.slice(1), o = t.monthsShort[i.getUTCMonth()], l = String(i.getUTCDate()).padStart(2, "0");
  return `${s} ${l} ${o}`;
}
function Ht(e, t) {
  const i = e.map((r) => r.tempC).filter((r) => r !== null), n = g0(i), s = n[0], o = n[n.length - 1];
  if (n.length <= t)
    return { lo: s, hi: o, ticks: n };
  const l = Math.ceil((n.length - 1) / (t - 1)), a = /* @__PURE__ */ new Set();
  for (let r = 0; r < n.length; r += l) a.add(n[r]);
  a.add(o), s < 0 && o > 0 && n.includes(0) && a.add(0);
  const c = [...a].sort((r, m) => r - m);
  return { lo: s, hi: o, ticks: c };
}
function K2(e, t, i = 1) {
  const n = i > 0 ? i : 1, s = (e.tempBase - e.tempTop) * n, o = (e.windBase - e.windTop) * n, { lo: l, hi: a, ticks: c } = Ht(t, Ee(s)), r = Math.max(e.windMax, x0(t)), m = e.precipCap / e.precipPerMm, u = {
    baseMm: m,
    topMm: a0(t, m)
  };
  return {
    ...e,
    tempLo: l,
    tempHi: a,
    tempTicks: c,
    windMax: r,
    // Derived from the shared tick rule rather than hardcoded per layout, so the
    // wind scale reads the same here as on the mobile chart.
    windTicks: d0(r, o),
    precipTopMm: u.topMm,
    precipTicks: r0(u, e.precipCap * n)
  };
}
function It(e, t) {
  const i = (n, s) => n.length === s.length && n.every((o, l) => o === s[l]);
  return i(e.tempTicks, t.tempTicks) && i(e.windTicks, t.windTicks) && i(e.precipTicks, t.precipTicks);
}
function F0(e) {
  const t = {
    baseMm: e.precipCap / e.precipPerMm,
    topMm: e.precipTopMm
  };
  return (i) => e.precipCap * A2(i, t);
}
function T0(e) {
  const t = e.tempHi - e.tempLo;
  return t > 0 ? t : 1;
}
function Ot(e) {
  const t = e.height - e.plotBottom;
  return Mt(e) ? e.plotBottom + t / 2 : e.windBase - 14;
}
function Wt(e) {
  const t = (o) => e.tempBase - (o - e.tempLo) / T0(e) * (e.tempBase - e.tempTop), i = (o) => e.windBase - Math.min(o, e.windMax) / e.windMax * (e.windBase - e.windTop), n = [
    `<rect x="0" y="0" width="${e.axisW}" height="${e.height}" fill="#fff"/>`
  ], s = e.axisW - 5;
  for (const o of e.tempTicks)
    n.push(
      V(s, t(o) + Q, p0(o), g2, e.axisFont, 700, "end")
    );
  for (const o of e.windTicks)
    n.push(
      V(s, i(o) + Q, h0(o), g2, e.axisFont, 700, "end")
    );
  return `<svg class="chart-axis" width="${e.axisW}" height="${e.height}" viewBox="0 0 ${e.axisW} ${e.height}" style="display:block;flex:none">${n.join("")}</svg>`;
}
function Nt(e) {
  const t = e.rightAxisW, i = F0(e), n = e.axisFont, s = [
    `<rect x="0" y="0" width="${t}" height="${e.height}" fill="#fff"/>`
  ];
  for (const o of e.precipTicks)
    s.push(
      V(
        5,
        e.precipBase - i(o) + Q,
        u0(o),
        n0,
        n,
        700,
        "start"
      )
    );
  return `<svg class="chart-axis-right" width="${t}" height="${e.height}" viewBox="0 0 ${t} ${e.height}" style="display:block;flex:none">${s.join("")}</svg>`;
}
function E0(e, t, i, n, s) {
  const o = e.length, l = o * s.colW + s.plotPad, a = (p) => p * s.colW + s.colW / 2, c = (p) => s.tempBase - (p - s.tempLo) / T0(s) * (s.tempBase - s.tempTop), r = (p) => s.windBase - Math.min(p, s.windMax) / s.windMax * (s.windBase - s.windTop), m = F0(s), u = [
    `<rect x="0" y="${s.plotTop}" width="${l}" height="${s.plotBottom - s.plotTop}" fill="#FCFDFE"/>`
  ];
  for (const p of o0(e, s.colW))
    u.push(
      `<rect x="${p.x}" y="${s.plotTop}" width="${p.w}" height="${s.plotBottom - s.plotTop}" fill="${s0}"/>`
    );
  for (let p = 0; p < o; p += s.gridEvery)
    u.push(
      `<line x1="${a(p)}" x2="${a(p)}" y1="${s.plotTop}" y2="${s.plotBottom}" stroke="#EEF1F4" stroke-width="1"/>`
    );
  for (const p of s.tempTicks)
    u.push(
      `<line x1="0" x2="${l}" y1="${c(p)}" y2="${c(p)}" stroke="#E7EBEE" stroke-width="1"/>`
    );
  for (const p of s.windTicks)
    u.push(
      `<line x1="0" x2="${l}" y1="${r(p)}" y2="${r(p)}" stroke="#DCE3E8" stroke-width="1"/>`
    );
  for (const p of s.precipTicks) {
    const d = s.precipBase - m(p);
    u.push(
      `<line x1="0" x2="${l}" y1="${d}" y2="${d}" stroke="#CFE0F1" stroke-width="1" stroke-dasharray="2 3"/>`
    );
  }
  const h = [0];
  for (let p = 1; p < o; p++)
    e[p].local.getUTCHours() === 0 && h.push(p);
  for (let p = 0; p < h.length; p++) {
    const d = h[p], _ = a(d);
    d > 0 && u.push(
      `<line x1="${_}" x2="${_}" y1="${s.dayLabelY - 8}" y2="${s.plotBottom}" stroke="#C2CBD2" stroke-width="1"/>`
    );
    const T = Dt(e[d], t), L = p + 1 < h.length ? h[p + 1] : o, O = (L - d) * s.colW - 10, D = T.length * s.dayLabelSize * 0.6, G = (d > 0 ? _ : 0) + T2, N = L < o ? a(L) : o * s.colW;
    D <= O && u.push(
      V(
        G,
        s.dayLabelY,
        T,
        "#14202B",
        s.dayLabelSize,
        900,
        "start"
      ).replace(
        "<text ",
        `<text class="day-label" data-x0="${G}" data-x1="${N - T2 - D}" `
      )
    );
  }
  for (const p of [s.plotTop, s.tempBase, s.windTop, s.plotBottom])
    u.push(`<line x1="0" x2="${l}" y1="${p}" y2="${p}" stroke="#C2CBD2" stroke-width="1"/>`);
  for (let p = 0; p < o; p++) {
    const d = e[p].precipMaxMm;
    if (d > 0) {
      const _ = m(d);
      u.push(
        `<rect x="${a(p) - s.precipMaxW / 2}" y="${s.precipBase - _}" width="${s.precipMaxW}" height="${_}" rx="1.5" fill="${w.precipMax}"/>`
      );
    }
  }
  for (let p = 0; p < o; p++) {
    const d = e[p].precipMm;
    if (d > 0) {
      const _ = m(d);
      u.push(
        `<rect x="${a(p) - s.precipW / 2}" y="${s.precipBase - _}" width="${s.precipW}" height="${_}" rx="1.5" fill="${w.precip}"/>`
      );
    }
  }
  const g = At(s, s.symbolSize);
  for (let p = 0; p < o; p += s.symbolEvery) {
    const d = e2(e[p].symbol);
    if (d) {
      const _ = s.symbolSize;
      u.push(
        `<image x="${a(p) - _ / 2}" y="${g}" width="${_}" height="${_}" href="${f(d)}"/>`
      );
    }
  }
  u.push(
    `<path d="${B2(e, (p) => p.tempC, a, c)}" fill="none" stroke="${w.temp}" stroke-width="${s.tempStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  ), x2(e) && u.push(
    `<path d="${B2(e, (p) => p.gustMs, a, r)}" fill="none" stroke="${w.gust}" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round"/>`
  ), u.push(
    `<path d="${B2(e, (p) => p.windMs, a, r)}" fill="none" stroke="${w.wind}" stroke-width="${s.windStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  const x = s.colW >= 40 ? 7 : 6, z = s.colW >= 40 ? "M-4 2 L0 7.5 L4 2" : "M-3.5 1.8 L0 6.5 L3.5 1.8", B = Ot(s);
  for (let p = 0; p < o; p += s.arrowEvery) {
    const d = e[p].dirDeg;
    d !== null && u.push(
      `<g transform="translate(${a(p)} ${B}) rotate(${(d % 360 + 360) % 360})"><line x1="0" y1="-${x}" x2="0" y2="${x}" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round"/><path d="${z}" fill="none" stroke="${w.neutral}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`
    );
  }
  if (s.tempLabelEvery > 0) {
    const p = s.tempLabelFont * c0, d = Math.round(s.tempLabelFont * 0.8);
    for (let _ = 0; _ < o; _ += s.tempLabelEvery) {
      const T = e[_].tempC;
      if (T === null) continue;
      const L = c(T) - d, O = L - p < s.tempTop ? c(T) + d + p : L;
      u.push(
        V(
          a(_),
          O,
          `${Math.round(T)}°`,
          D2(Math.round(T)),
          s.tempLabelFont,
          800,
          "middle",
          !0
        )
      );
    }
  }
  if (s.windLabelEvery > 0)
    for (let p = 1; p < o; p += s.windLabelEvery) {
      const d = e[p].windMs;
      d !== null && u.push(V(a(p), r(d) - 9, `${Math.round(d)}`, w.windText, 10.5, 800, "middle"));
    }
  const v = s.gridEvery === 1 ? 1 : 2;
  for (let p = 0; p < o; p += v) {
    const d = String(e[p].local.getUTCHours()).padStart(2, "0");
    u.push(V(a(p), s.hourLabelY, d, w.neutral, s.hourLabelSize, 700, "middle"));
  }
  if (n >= 0 && n < o) {
    const p = a(n), d = e[n].tempC;
    u.push(
      `<line class="chart-now" x1="${p}" x2="${p}" y1="${s.plotTop}" y2="${s.plotBottom}" stroke="${w.now}" stroke-width="2"/>`
    ), d !== null && u.push(
      `<circle class="chart-now-dot" cx="${p}" cy="${c(d)}" r="4.5" fill="${w.temp}" stroke="#fff" stroke-width="1.5"/>`
    );
  }
  const k = Math.max(0, Math.min(o - 1, i)), $ = a(k), M = e[k]?.tempC ?? null, F = e[k]?.windMs ?? null;
  return u.push(
    `<line class="scrub-cursor" x1="${$}" x2="${$}" y1="${s.plotTop}" y2="${s.plotBottom}" stroke="#14202B" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.55"/>`,
    `<circle class="scrub-dot-temp" cx="${$}" cy="${M === null ? 0 : c(M)}" r="4" fill="${w.temp}" stroke="#fff" stroke-width="1.5"${M === null ? ' visibility="hidden"' : ""}/>`,
    `<circle class="scrub-dot-wind" cx="${$}" cy="${F === null ? 0 : r(F)}" r="4" fill="${w.wind}" stroke="#fff" stroke-width="1.5"${F === null ? ' visibility="hidden"' : ""}/>`
  ), { svg: `<svg class="chart-plot" width="${l}" height="${s.height}" viewBox="0 0 ${l} ${s.height}" style="display:block;touch-action:none;cursor:crosshair" aria-hidden="true">${u.join("")}</svg>`, geo: {
    width: l,
    count: o,
    cx: a,
    tempY: c,
    windY: r,
    indexAt: (p) => Math.max(0, Math.min(o - 1, Math.round((p - s.colW / 2) / s.colW)))
  } };
}
function k2(e, t, i) {
  return `<div class="lane-chip-wrap chart-lane" style="transform:translateY(${e}px)"><div class="lane-chip chart-chip"><span class="chip-swatch-${t} chart-swatch-${t}"></span>${f(i)}</div></div>`;
}
const Rt = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 2H2v4M10 2h4v4M2 10v4h4M14 10v4h-4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', jt = '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 6h4V2M14 6h-4V2M6 14v-4H2M10 14v-4h4" fill="none" stroke="#14202B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function V2(e, t, i, n, s, o, l = () => 1, a = () => {
}) {
  const c = (u) => {
    const h = e.getBoundingClientRect(), g = l() || 1, x = t.indexAt((u.clientX - h.left) / g);
    x !== i() && (n(x), o(), s(x, !1));
  };
  let r = !1;
  e.addEventListener("pointerdown", (u) => {
    try {
      e.setPointerCapture(u.pointerId);
    } catch {
    }
    r = !0, c(u);
  }), e.addEventListener("pointermove", (u) => {
    const h = u;
    (h.pointerType === "mouse" || h.buttons > 0) && c(h);
  });
  const m = () => {
    r && (r = !1, a());
  };
  e.addEventListener("pointerup", m), e.addEventListener("pointercancel", m);
}
function p2(e, t, i, n, s = () => 1) {
  const o = s() || 1, l = (i * n + n / 2) * o;
  e.scrollLeft = Math.max(0, l - e.clientWidth / 2);
}
function qt(e, t, i) {
  const n = C0(t, i);
  if (!n || !e.querySelector(".chart-plot"))
    return A0(e)();
  e.dataset.chartScale = String(n.scale);
  for (const s of Bt) {
    const o = e.querySelector(s);
    if (!o) continue;
    const l = parseFloat(o.getAttribute("width") || "0");
    o.style.height = `${n.heightPx}px`, o.style.width = `${kt(l, n).toFixed(2)}px`;
  }
  return e.querySelectorAll(".chart-lane").forEach((s) => {
    const o = /translateY\(([\d.]+)px\)/.exec(s.style.transform);
    o && !s.dataset.laneY && (s.dataset.laneY = o[1]);
    const l = Number(s.dataset.laneY ?? o?.[1] ?? 0);
    s.style.transform = `translateY(${St(l, n).toFixed(2)}px)`;
  }), n.scale;
}
function A0(e) {
  return () => {
    const t = e.dataset.chartScale, i = t ? parseFloat(t) : 1;
    return Number.isFinite(i) && i > 0 ? i : 1;
  };
}
function Yt(e, t, i, n, s, o, l = !1) {
  const a = Wt(s), c = Nt(s), { svg: r, geo: m } = E0(e, t, i, n, s), u = k2(s.laneChipY[0], "temp", t.laneTemp) + k2(s.laneChipY[1], "precip", t.lanePrecip) + k2(s.laneChipY[2], "wind", t.laneWind), h = Math.max(0, Math.min(e.length - 1, i)), g = l ? `<div class="scrub-rail" role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}"
         aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}"
         aria-valuenow="${h}" style="width:${m.width}px">
         <div class="scrub-grab" style="left:${(m.cx(h) / m.width * 100).toFixed(2)}%"></div>
       </div>
       <div class="scrub-cursor"></div>` : "";
  return `
    <div class="chart${o ? " chart-fs" : ""}">
      ${a}
      <div class="chart-scroll"${l ? "" : ` role="slider" tabindex="0" aria-label="${f(t.scrubSlider)}" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${e.length - 1}" aria-valuenow="${h}"`}>
        ${g}
        ${u}
        ${r}
      </div>
      ${c}
    </div>`;
}
function Kt(e, t, i = !0) {
  const n = t ? `<span class="legend-meta">${f(t)}</span>` : "", s = i ? `<span><span class="swatch-gust"></span>${f(e.legGust)}</span>` : "";
  return `
    <div class="legend chart-legend">
      <span><span class="swatch-temp chart-swatch-temp"></span>${f(e.legTemp)}</span>
      <span><span class="swatch-precip"></span>${f(e.legPrecip)}</span>
      <span><span class="swatch-pmax chart-swatch-pmax"></span>${f(e.legPmax)}</span>
      <span><span class="swatch-wind"></span>${f(e.legWind)}</span>
      ${s}
      ${n}
    </div>`;
}
function Vt(e, t, i, n, s = !1, o = !1) {
  const l = e[t], a = l.tempC === null ? "–" : `${Math.round(l.tempC)}°`, c = l.tempC === null ? w.neutral : D2(Math.round(l.tempC)), r = e2(l.symbol), m = r ? `<img src="${f(r)}" width="34" height="34" alt="">` : "", u = f(s ? i.exitFullscreen : i.fullscreen), h = `<button class="chart-fs-btn" type="button" aria-label="${u}" title="${u}">${s ? jt : Rt}</button>`, g = o ? `<button class="ro-min" type="button" aria-label="${f(i.minimize)}"></button>
       <button class="ro-close" type="button" aria-label="${f(i.close)}"></button>` : "";
  return `
    <div class="readout readout-2a${o ? " readout-pop" : ""}">
      <div class="readout-main">
        <span class="ro-icon">${m}</span>
        <div class="readout-text">
          <div class="ro-time">${f(_2(l, i))}</div>
          <div class="ro-vals">
            <span class="ro-temp" style="color:${c}">${a}</span>
            <span class="ro-precip">${l.precipMm.toFixed(1)} mm</span>
            <span class="ro-wind">
              <span class="ro-wind-text">${f(t2(l))}</span>
              <span class="ro-arrow">${o2(l.dirDeg, 13, "#14202B")}</span>
              <span class="ro-compass">${f(v2(l.dirDeg, i))}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="readout-side">
        ${h}
        ${g}
      </div>
    </div>`;
}
function Xt(e, t, i) {
  const n = i.expanded ?? !1, s = n ? Gt : Lt, o = (y, S = s) => {
    const P = K2(S, t, y);
    return e.innerHTML = `
    <div class="graph-bare graph-panel">
      ${Vt(t, Math.max(0, Math.min(t.length - 1, i.scrubIdx)), i.t, !0, n, i.fit ?? !1)}
      <div class="chart-fit">
        ${Yt(t, i.t, i.scrubIdx, i.nowIdx, P, n, i.fit ?? !1)}
      </div>
      ${Kt(i.t, i.metaLine, x2(t))}
    </div>`, P;
  };
  let l = o(1);
  if (i.fit) {
    const y = e.querySelector(".chart-fit"), S = y ? C0(l.height, y.clientHeight) : null;
    if (S) {
      const P = K2(s, t, S.scale);
      It(P, l) || (l = o(S.scale));
    }
  } else if (n) {
    const S = e.querySelector(".chart-fit")?.clientHeight ?? 0;
    S >= Ut && Math.abs(S - l.height) > 2 && (l = o(1, Pt(s, S)));
  }
  let a = i.scrubIdx < 0 ? -1 : Math.min(t.length - 1, i.scrubIdx), c = a;
  const r = e.querySelector(".chart-plot"), m = e.querySelector(".chart-scroll"), u = e.querySelector(".chart-fit"), h = i.fit ? A0(e) : () => 1, g = e.querySelector(".scrub-rail"), x = g ?? m, z = e.querySelector(".scrub-grab"), B = e.querySelector(".chart-scroll > .scrub-cursor"), v = e.querySelector(".readout-pop"), k = () => {
    if (!(!i.fit || !u) && (qt(e, l.height, u.clientHeight), g && r.style.width)) {
      const y = h();
      g.style.width = r.style.width, g.style.height = `${Math.round(l.plotTop * y)}px`, z && (z.style.top = `${Math.round(l.plotTop * y - 5.5)}px`), B && a >= 0 && (B.style.left = `${$.cx(a) * y}px`);
    }
  }, { geo: $ } = E0(
    t,
    i.t,
    a,
    i.nowIdx,
    l
  ), M = (y) => e.querySelector(y), F = M(".chart-plot .scrub-cursor"), C = M(".scrub-dot-temp"), E = M(".scrub-dot-wind"), p = M(".ro-time"), d = M(".ro-temp"), _ = M(".ro-precip"), T = M(".ro-wind-text"), L = M(".ro-arrow"), O = M(".ro-compass"), D = M(".ro-icon"), G = M(".readout"), N = e.querySelector(".chart-plot .chart-now-dot");
  let R, H;
  const j = () => {
    const y = t[a], S = !y;
    G.classList.toggle("is-outside", S);
    for (const A of [F, C, E])
      S ? A.setAttribute("visibility", "hidden") : A.removeAttribute("visibility");
    S ? N?.setAttribute("visibility", "hidden") : N?.removeAttribute("visibility");
    for (const A of [z, B])
      A && (A.style.visibility = S ? "hidden" : "");
    if (S) {
      p.textContent = i.t.noForecastForTime, x.removeAttribute("aria-valuenow"), x.setAttribute("aria-valuetext", i.t.noForecastForTime);
      return;
    }
    const P = $.cx(a);
    if (F.setAttribute("x1", `${P}`), F.setAttribute("x2", `${P}`), C.setAttribute("cx", `${P}`), C.setAttribute("visibility", y.tempC === null ? "hidden" : "visible"), y.tempC !== null && C.setAttribute("cy", `${$.tempY(y.tempC)}`), E.setAttribute("cx", `${P}`), E.setAttribute("visibility", y.windMs === null ? "hidden" : "visible"), y.windMs !== null && E.setAttribute("cy", `${$.windY(y.windMs)}`), p.textContent = _2(y, i.t), d.textContent = y.tempC === null ? "–" : `${Math.round(y.tempC)}°`, d.style.color = y.tempC === null ? w.neutral : D2(Math.round(y.tempC)), _.textContent = `${y.precipMm.toFixed(1)} mm`, T.textContent = t2(y), y.dirDeg !== R && (L.innerHTML = o2(y.dirDeg, 13, "#14202B"), R = y.dirDeg), O.textContent = v2(y.dirDeg, i.t), y.symbol !== H) {
      const A = e2(y.symbol);
      D.innerHTML = A ? `<img src="${f(A)}" width="34" height="34" alt="">` : "", H = y.symbol;
    }
    z && (z.style.left = `${(P / $.width * 100).toFixed(2)}%`), B && (B.style.left = `${P * h()}px`), x.setAttribute("aria-valuenow", String(a)), x.setAttribute("aria-valuetext", v0(y, i.t)), v?.classList.remove("is-closed");
  };
  if (v) {
    const y = e.querySelector(".ro-min");
    y?.addEventListener("click", () => {
      const A = v.classList.toggle("is-min");
      y.setAttribute("aria-label", A ? i.t.expand : i.t.minimize);
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
    const P = () => {
      S = null, v.classList.remove("is-dragging");
    };
    v.addEventListener("pointerup", P), v.addEventListener("pointercancel", P);
  }
  const X = () => {
    c = a, i.onScrub(a, !0);
  };
  if (i.previewHover) {
    const y = i.previewHover;
    r.addEventListener("pointerleave", (S) => {
      !y() || S.pointerType !== "mouse" || S.buttons || a !== c && (a = c, j(), i.onScrub(a, !1));
    });
  }
  if (i.fit ? (r.style.touchAction = "pan-x", f0(r, (y) => {
    const S = r.getBoundingClientRect(), P = h() || 1, A = $.indexAt((y.clientX - S.left) / P);
    A !== a && (a = A, j(), i.onScrub(A, !1)), X();
  })) : V2(
    r,
    $,
    () => a,
    (y) => {
      a = y;
    },
    i.onScrub,
    j,
    h,
    X
  ), g && V2(
    g,
    $,
    () => a,
    (y) => {
      a = y;
    },
    i.onScrub,
    j,
    h,
    X
  ), x.addEventListener("keydown", (y) => {
    const S = _0(y.key, a, t.length);
    S !== null && (y.preventDefault(), y.stopPropagation(), S !== a && (a = S, j(), p2(m, $, a, l.colW, h), i.onScrub(a, !1), X()));
  }), k(), m0(m, h), p2(m, $, a, l.colW, h), j(), e.querySelector(".chart-fs-btn")?.addEventListener("click", () => i.onFullscreen?.()), i.fit && u && typeof ResizeObserver < "u") {
    const y = new ResizeObserver(() => {
      if (!u.isConnected) {
        y.disconnect();
        return;
      }
      k(), p2(m, $, a, l.colW, h);
    });
    y.observe(u);
  }
  return {
    // Moves the cursor without reporting back (-1 = outside the forecast).
    setScrubIdx: (y) => {
      a = y < 0 ? -1 : Math.min(t.length - 1, y), c = a, j(), a >= 0 && p2(m, $, a, l.colW, h);
    }
  };
}
const Jt = `
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
/* The taller (fullscreen) chart fills the expanded column; scroll if the panel
   is shorter than the chart rather than clipping it. */
.exp-right .chart-fit { overflow-y: auto; }

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
`, Zt = `
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
`, Qt = {
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
function P0(e, t, i, n, s = 1) {
  if (t === null || n === null || !e && e !== 0)
    return "";
  let o;
  e < 0.1 * s ? o = "no" : e < 0.3 * s ? o = "little" : e < 3 * s ? o = "some" : o = "much";
  let l;
  t < 0.25 ? l = o === "no" ? "clear" : "scattered" : t < 0.5 ? l = o === "no" ? "fair" : "scattered" : t < 0.75 ? l = "scattered" : l = "overcast";
  let a;
  !i && i !== 0 || i < 0.33 || o === "no" ? a = "rain" : i < 0.66 ? a = "sleet" : a = "snow";
  const c = Qt[`${l}_${o}_${a}`];
  if (!c) return "";
  let r = "";
  return l !== "overcast" && (r = n < 0.75 ? "n" : "d"), `${c}${r}`;
}
const X2 = [
  { max: 12, min: 8, rain: [12, 19, 0.9], wind: 6, dir: 220, cloud: 0.85 },
  { max: 13, min: 9, rain: null, wind: 4, dir: 180, cloud: 0.4 },
  { max: 11, min: 8, rain: [6, 16, 1.4], wind: 8, dir: 160, cloud: 0.9 },
  { max: 14, min: 9, rain: null, wind: 3, dir: 90, cloud: 0.1 },
  { max: 12, min: 8, rain: [14, 20, 0.4], wind: 5, dir: 200, cloud: 0.5 },
  { max: 10, min: 7, rain: [3, 21, 1.8], wind: 10, dir: 150, cloud: 0.95 },
  { max: 13, min: 8, rain: null, wind: 5, dir: 250, cloud: 0.45 }
], e1 = 3;
function t1(e) {
  const t = /* @__PURE__ */ new Date();
  t.setUTCMinutes(0, 0, 0), t.setTime(t.getTime() - e1 * 36e5);
  const i = Date.UTC(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate()
  ), n = [];
  for (let s = 0; s < e; s++) {
    const o = t.getTime() + s * 36e5, l = new Date(o), a = l.getUTCHours(), c = Math.round(
      (Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - i) / 864e5
    ), r = X2[c % X2.length], m = Math.round(
      r.min + (r.max - r.min) * (0.5 - 0.5 * Math.cos((a - 4) / 24 * 2 * Math.PI))
    );
    let u = 0;
    r.rain && a >= r.rain[0] && a < r.rain[1] && (u = Math.round(
      r.rain[2] * (0.4 + 0.6 * Math.sin(Math.PI * (a - r.rain[0]) / (r.rain[1] - r.rain[0]))) * 10
    ) / 10);
    const h = Math.max(1, r.wind + Math.round(1.5 * Math.sin((a - 15) / 24 * 2 * Math.PI))), g = a >= 4 && a <= 23 ? 1 : 0;
    n.push({
      local: new Date(o),
      utcMs: o,
      tempC: m,
      precipMm: u,
      precipMaxMm: u > 0 ? Math.round(u * 1.6 * 10) / 10 : 0,
      windMs: h,
      gustMs: Math.round(h * 1.8),
      dirDeg: (r.dir + Math.round(20 * Math.sin(a / 8)) + 360) % 360,
      symbol: P0(u, u > 0 ? 0.9 : r.cloud, 0, g)
    });
  }
  return n;
}
const i1 = [
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
], J2 = [
  { id: "sample/harmonie", name: "HARMONIE 2.5 km" },
  { id: "sample/wrf9", name: "WRF 9 km" },
  { id: "sample/ecmwf", name: "ECMWF 0.1°" }
], s1 = 36e5;
function Y(e, t, i) {
  let n;
  try {
    n = e.data?.[t];
  } catch {
  }
  const s = Array.isArray(n) ? n : [];
  return Array.from({ length: i }, (o, l) => {
    const a = s[l];
    return typeof a == "number" && Number.isFinite(a) ? a : null;
  });
}
function o1(e) {
  let t = [];
  try {
    t = Object.values(e.data ?? {}).filter((i) => Array.isArray(i) && i.length > 0).map((i) => i.length);
  } catch {
  }
  return t.length ? Math.min(...t) : Number.POSITIVE_INFINITY;
}
function n1(e) {
  return e.some((t) => t !== null);
}
function l1(e, t) {
  const i = e.time;
  if (!i || i.length < 2) return [];
  const n = (new Date(i[1]).getTime() - new Date(i[0]).getTime()) / s1, s = e.meta?.location_timezone_offset ?? 0, o = Math.min(
    i.length,
    o1(e),
    Math.ceil(t / n)
  );
  if (!(o > 0)) return [];
  const l = Y(e, "air_temperature_at_2m_agl", o), a = Y(e, "lwe_precipitation_rate", o), c = Y(e, "lwe_precipitation_rate_max", o), r = Y(e, "wind_speed_at_10m_agl", o), m = Y(e, "wind_speed_of_gust_at_10m_agl", o), u = Y(e, "wind_from_direction_at_10m_agl", o), h = Y(e, "cloud_area_fraction", o), g = Y(e, "snow_fraction", o), x = Y(e, "daylight_fraction", o), z = n1(m), B = [];
  for (let v = 0; v < o; v++) {
    const k = a[v], $ = c[v] ?? k, M = new Date(i[v]).getTime();
    B.push({
      local: new Date(M + s * 6e4),
      utcMs: M,
      tempC: l[v],
      // `== null` deliberately, not `===`: a missing value has to read as "no
      // rain", and `undefined * timestepH` is NaN, which paints nothing at all.
      precipMm: k == null ? 0 : k * n,
      precipMaxMm: $ == null ? 0 : $ * n,
      windMs: r[v],
      gustMs: z ? m[v] : null,
      dirDeg: u[v],
      symbol: P0(k, h[v], g[v], x[v], n)
    });
  }
  return B;
}
const Z2 = "bel-meteogram-nunito", a1 = 168, r1 = 12, U0 = "mimirMapPanelState", c1 = 440, h2 = 700, u2 = 360, Q2 = 620, S2 = 360;
function L0() {
  try {
    const e = localStorage.getItem(U0);
    if (!e) return {};
    const t = JSON.parse(e);
    return t && typeof t == "object" ? t : {};
  } catch {
    return {};
  }
}
function d1(e) {
  try {
    const t = L0();
    localStorage.setItem(
      U0,
      JSON.stringify({ ...t, ...e })
    );
  } catch {
  }
}
function p1() {
  if (document.getElementById(Z2)) return;
  const e = document.createElement("link");
  e.id = Z2, e.rel = "stylesheet", e.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap", document.head.appendChild(e);
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
function F2(e) {
  try {
    return localStorage.getItem(`bel-meteogram.${e}`);
  } catch {
    return null;
  }
}
function h1(e) {
  if (!(e instanceof HTMLElement) || !e.classList.length) return null;
  const t = CSS.escape(e.classList[0]);
  for (const i of ["day", "view", "lang", "model"]) {
    const n = e.dataset[i];
    if (n !== void 0) return `.${t}[data-${i}="${CSS.escape(n)}"]`;
  }
  return `.${t}`;
}
function u1(e) {
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
    if (!this.usesPanel || u1(t.composedPath()[0])) return;
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
    t.textContent = Jt, this.root.appendChild(t), this.body = document.createElement("div"), this.body.className = "bel-root", this.root.appendChild(this.body);
  }
  get isFull() {
    return this.getAttribute("mode") === "full";
  }
  get uiLang() {
    return this.getAttribute("language") ?? (this.isFull ? F2("lang") ?? "is" : "is");
  }
  get t() {
    return w0(this.uiLang);
  }
  get hours() {
    const t = parseInt(this.getAttribute("hours") ?? "", 10);
    return Number.isFinite(t) && t > 0 ? t : 48;
  }
  connectedCallback() {
    p1(), this.started = !0, this.isWide = this.mql.matches, this.isLandscape = this.mqlLandscape.matches;
    const t = this.isFull ? L0() : {};
    typeof t.selectedDay == "number" && (this.selectedDay = t.selectedDay), typeof t.scrubUtcMs == "number" && (this.scrubUtcMs = t.scrubUtcMs), (t.view === "table" || t.view === "graph") && (this.view = t.view), t.panelPos && typeof t.panelPos.x == "number" && typeof t.panelPos.y == "number" && (this.panelPos = { ...t.panelPos }), t.panelSize && typeof t.panelSize.w == "number" && typeof t.panelSize.h == "number" && (this.panelSize = { ...t.panelSize });
    const i = this.getAttribute("view");
    i === "graph" || i === "table" ? this.view = i : t.view || (this.view = this.isWide ? "graph" : "table"), this.mql.addEventListener("change", this.onBreakpoint), this.mqlLandscape.addEventListener("change", this.onLandscape), document.addEventListener("keydown", this.onKeyDown), window.addEventListener("resize", this.onResize), this.hostTimeMs = this.selectedTimeAttr(), this.load(), requestAnimationFrame(() => {
      this.onBreakpoint(), this.onLandscape();
    });
  }
  disconnectedCallback() {
    this.mql.removeEventListener("change", this.onBreakpoint), this.mqlLandscape.removeEventListener("change", this.onLandscape), document.removeEventListener("keydown", this.onKeyDown), window.removeEventListener("resize", this.onResize), this.resizeRaf && cancelAnimationFrame(this.resizeRaf), this.cancelGraphRefit(), this.persistTimer && this.persistMapPanel();
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
    d1({
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
    const t = this.panelSize.w > 0 ? this.panelSize.w : c1;
    return Math.max(u2, Math.min(this.hostW() - 24, t));
  }
  /** Minimum panel height for the current layout (one-column needs more). */
  minPanelH() {
    const t = this.resolvedPanelW() >= h2 ? S2 : Q2;
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
    const i = this.getAttribute("analysis-time"), n = i ? new Date(i) : this.analysisTime, s = this.getAttribute("last-updated"), o = s ? new Date(s) : this.lastModified, l = (a) => a && !isNaN(a.getTime()) ? rt(a, t) : "–";
    return t.metaLine(l(n), l(o));
  }
  /**
   * Inline left/top/width/height for the draggable panel. Resolves the user's
   * size (or defaults), clamps both size and position to the live host box —
   * so a stored size/position that is now off-screen (window shrunk or reload
   * at a smaller size) snaps back in — and writes the clamped position back.
   */
  panelStyleAttr() {
    const t = this.hostW(), i = this.hostH(), n = this.resolvedPanelW(), s = this.resolvedPanelH(), o = this.panelPos.x >= 0 ? this.panelPos : { x: t - n - 18, y: Math.min(48, Math.max(18, Math.round(i * 0.02))) }, l = Math.max(0, Math.min(t - n, o.x)), a = Math.max(0, Math.min(i - s, o.y));
    return this.panelPos = { x: l, y: a }, ` style="left:${l}px;top:${a}px;width:${n}px;height:${s}px"`;
  }
  emitLocation() {
    const t = parseFloat(this.getAttribute("location-lat") ?? ""), i = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(t) || isNaN(i)) return;
    const n = this.placeName(this.placeList(t, i), t, i, this.t), s = this.points[f2(this.points)]?.tempC ?? null;
    this.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: {
          lat: t,
          lon: i,
          name: n,
          tempC: s === null ? null : Math.round(s),
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
    if (this.scrubIdx = -1, this.lastTimeKey = null, this.hasAttribute("sample")) {
      this.corrections = [], this.correctedStation = null, this.points = t1(
        this.isFull ? a1 : this.hours
      ), this.isFull && (this.rawForecasts = J2.map((l) => ({ ...l, url: "" })), this.rawStations = i1.map((l, a) => ({
        id: `sample-${a}`,
        name: l.name,
        lat: l.lat,
        lon: l.lon
      })), this.forecastId || (this.forecastId = J2[0].id));
      const o = /* @__PURE__ */ new Date();
      this.lastModified = o, this.analysisTime = new Date(
        Date.UTC(o.getUTCFullYear(), o.getUTCMonth(), o.getUTCDate())
      ), this.status = "ready", this.followHostTime(), this.paint(), this.emitStatus(), this.emitLocation(), this.emitHostTime();
      return;
    }
    const i = parseFloat(this.getAttribute("location-lat") ?? ""), n = parseFloat(this.getAttribute("location-lon") ?? "");
    if (isNaN(i) || isNaN(n)) {
      this.status = "error", this.paint(), this.emitStatus("missing location-lat/location-lon");
      return;
    }
    this.status = "loading", this.paint(), this.emitStatus();
    const s = {
      clientName: this.getAttribute("client-name") ?? "",
      apiUrl: this.getAttribute("api-url") ?? void 0,
      user: this.getAttribute("api-user") ?? void 0,
      password: this.getAttribute("api-password") ?? void 0
    };
    try {
      const o = await H0(s), l = I0(
        this.getAttribute("forecast-type"),
        this.getAttribute("forecast-name"),
        this.getAttribute("domain")
      ), a = this.forecastId || l || (this.isFull ? F2("model") ?? "" : "");
      let c = O0(o, a);
      if (!c && a !== l && (c = o[0]), !c) throw new Error(`forecast not found: ${a}`);
      this.forecastId = c.id;
      const r = await W0(c.url), m = this.isFull ? 1 / 0 : this.hours, u = this.isFull ? void 0 : this.hours, h = i0(r) ? R0(r.stations ?? [], i, n) : null, g = h ? await y2(
        b2(r, i, n, u, h.extra?.ref),
        s
      ).catch((B) => (console.warn("bel-meteogram: station data failed, using the point", B), y2(b2(r, i, n, u), s))) : await y2(b2(r, i, n, u), s);
      if (t !== this.loadToken) return;
      this.rawForecasts = o, this.rawStations = r.stations ?? [], this.corrections = Object.keys(g.data.meta?.corrections ?? {}), this.correctedStation = this.corrections.length ? h : null, this.points = l1(g.data, m);
      const x = g.data.meta?.location_timezone_offset;
      this.tzOffsetMin = typeof x == "number" ? x : null;
      const z = j0(
        g.data,
        g.lastModified,
        this.points[0]?.utcMs
      );
      this.analysisTime = z.analysisTime, this.lastModified = z.lastModified, this.status = this.points.length ? "ready" : "error", this.status === "ready" && this.followHostTime(), this.paint(), this.emitStatus(this.points.length ? void 0 : "empty forecast"), this.status === "ready" && (this.emitLocation(), this.emitHostTime());
    } catch (o) {
      if (t !== this.loadToken) return;
      console.error("bel-meteogram: failed to load forecast", o), this.status = "error", this.paint(), this.emitStatus(o instanceof Error ? o.message : String(o));
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
      if (!i || Math.abs(i - this.refitHeight) < r1) return;
      this.refitHeight = i;
      const n = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, { landscape: s, wide: o, expanded: l } = this.layoutFlags();
      if (this.paintGraphHost(s, l, o, this.t), n > 0) {
        const a = this.body.querySelector(".chart-scroll");
        a && (a.scrollLeft = n);
      }
    }));
  }
  /** Drop any pending refit frame — the caller is about to repaint anyway. */
  cancelGraphRefit() {
    this.refitRaf && cancelAnimationFrame(this.refitRaf), this.refitRaf = 0, this.refitHeight = -1;
  }
  paint() {
    const i = this.body.querySelector(
      ".ls-scroll, .exp-left"
    )?.scrollTop ?? 0, s = this.body.querySelector(".chart-scroll")?.scrollLeft ?? 0, o = this.body.querySelector(".day-chips")?.scrollLeft ?? 0, l = this.focusAfterPaint ?? h1(this.root.activeElement);
    this.focusAfterPaint = null, this.isFull ? this.paintFull() : this.paintGraph();
    const a = this.body.querySelector(".day-chips");
    if (a) {
      a.scrollLeft = o;
      const c = a.querySelector(".day-chip.sel");
      if (c) {
        const r = parseFloat(getComputedStyle(a).scrollPaddingLeft) || 0, m = c.offsetLeft - a.offsetLeft - r, u = c.offsetLeft - a.offsetLeft + c.offsetWidth + r;
        m < a.scrollLeft ? a.scrollLeft = m : u > a.scrollLeft + a.clientWidth && (a.scrollLeft = u - a.clientWidth);
      }
    }
    if (l && this.body.querySelector(l)?.focus({ preventScroll: !0 }), i > 0) {
      const c = this.body.querySelector(
        ".ls-scroll, .exp-left"
      );
      c && (c.scrollTop = i);
    }
    if (s > 0) {
      const c = this.body.querySelector(".chart-scroll");
      c && (c.scrollLeft = s);
    }
  }
  paintGraph() {
    const t = this.t;
    this.graphScrubSetter = null;
    const i = `
      <div class="head">
        <div class="title">${f(b0(this.points, t) || t.nextHours(this.hours))}</div>
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
    const n = this.points, s = this.selectedColumn(n);
    this.renderedScrubIdx = s;
    const { setScrubIdx: o } = R2(
      this.body,
      n,
      t,
      s,
      (l, a) => this.onUserScrub(n, l, a),
      { previewHover: () => this.hostTimeMs !== null }
    );
    this.graphScrubSetter = o;
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
    const n = this.uiLang, s = this.rawStations.map((o) => ({
      name: z2(o.name, n),
      lat: o.lat,
      lon: o.lon
    }));
    if (!isNaN(t) && !isNaN(i)) {
      for (const o of s) o.distanceKm = e0(t, i, o.lat, o.lon);
      s.sort((o, l) => (o.distanceKm ?? 0) - (l.distanceKm ?? 0));
    }
    return s;
  }
  /** Display name for the current point: attribute → picked → coordinate (when
   *  `prefer-coordinates` is set) → nearest station. Hosts that pin an exact
   *  map click (e.g. Mimir) set `prefer-coordinates` so the clicked lat/lon is
   *  shown verbatim and never snapped to the nearest station. */
  placeName(t, i, n, s) {
    const o = this.getAttribute("location-name");
    if (o) return o;
    if (this.pickedPlaceName) return this.pickedPlaceName;
    if (isNaN(i) || isNaN(n)) return t[0]?.name ?? "";
    if (this.hasAttribute("prefer-coordinates")) return m2(i, n, s);
    let l = null, a = 1 / 0;
    for (const c of t) {
      const r = (c.lat - i) ** 2 + (c.lon - n) ** 2 * 0.2;
      r < a && (a = r, l = c);
    }
    return l?.name ?? m2(i, n, s);
  }
  /**
   * Resolve the carried-over scrub instant to a column of `points`, or -1 for
   * "no opinion — open at now". The rules live in indexAtInstant; declining is
   * the common case and it is the right one, since the alternative is reopening
   * the widget on an hour that has already happened.
   */
  restoreScrubIndex(t) {
    return this.scrubUtcMs === null ? -1 : je(t, this.scrubUtcMs);
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
    if (this.hostTimeMs !== null) return qe(t, this.hostTimeMs);
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
    const o = q2(this.points, this.t, N2(this.points)).findIndex((l) => l.hours.includes(n));
    return o < 0 || o === this.selectedDay ? !1 : (this.selectedDay = o, !0);
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
    const s = Ye(t, i, n), o = `${s.time}|${s.tempC}`;
    o !== this.lastTimeKey && (this.lastTimeKey = o, this.dispatchEvent(
      new CustomEvent("bel-meteogram-time", {
        detail: s,
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
    const t = this.t, i = this.uiLang, n = parseFloat(this.getAttribute("location-lat") ?? ""), s = parseFloat(this.getAttribute("location-lon") ?? ""), o = this.models(), l = this.placeList(n, s), a = this.placeName(l, n, s, t), c = o.find((p) => p.id === this.forecastId) ?? o[0], r = l.find(
      (p) => Math.abs(p.lat - n) < 1e-4 && Math.abs(p.lon - s) < 1e-4
    ) ?? l.find((p) => p.name === a) ?? null, m = this.hasAttribute("closable"), { landscape: u, wide: h, expanded: g } = this.layoutFlags(), x = dt({
      modelName: c?.name ?? "…",
      place: a,
      lang: i.toUpperCase(),
      tzOffsetMin: this.tzOffsetMin
    }), z = (isNaN(n) || isNaN(s) ? "" : f(m2(n, s, t))) + (this.status === "ready" && this.correctedStation ? ft(
      this.corrections,
      z2(this.correctedStation.name, i),
      t
    ) : ""), B = mt(
      this.getAttribute("station-place"),
      parseFloat(this.getAttribute("station-place-km") ?? ""),
      t
    );
    let v = "";
    if (this.status === "loading")
      v = '<div class="sk sk-now"></div><div class="sk-rows"><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></div>';
    else if (this.status === "error")
      v = `<div class="graph-wrap" style="padding-top:12px"><div class="card"><div class="error"><div class="error-msg">${f(t.error)}</div><button class="retry">${f(t.retry)}</button></div></div></div>`;
    else {
      const p = f2(this.points), d = q2(this.points, t, N2(this.points)), _ = Math.max(0, Math.min(d.length - 1, this.selectedDay));
      v = u ? this.landscapeBodyHtml(d, _, this.points[p], t) : g ? this.expandedBodyHtml(d, _, this.points[p], t) : h ? this.desktopBodyHtml(d, _, this.points[p], t) : this.mobileBodyHtml(d, _, this.points[p], t);
    }
    const k = this.settingsOpen ? bt(
      o,
      this.forecastId,
      i,
      l,
      r,
      this.query,
      t,
      !this.hasAttribute("hide-language"),
      !this.hasAttribute("hide-models")
    ) : "", $ = `page ${h ? "wide wide-2a" : "narrow"}${g ? " is-expanded" : ""}${u ? " is-fullscreen" : ""}${m ? " page--closable" : ""} view-${this.view}`, M = this.status === "ready" && h ? gt(this.metaLine(t)) : "", F = u ? "" : this.panelStyleAttr(), C = u ? "" : `<div class="panel-resize panel-resize-bl" data-resize-handle data-corner="bl" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>
         <div class="panel-resize panel-resize-br" data-resize-handle data-corner="br" role="separator" aria-label="Resize" title="${f(t.resize)}"></div>`, E = h ? `<div class="${$}"${F}>
           ${pt(x, m, t)}
           <section class="panel-loc">
             <div class="panel-loc-name">${f(a)}</div>
             <div class="panel-loc-sub">${z}</div>
             ${B}
           </section>
           ${v}
           ${M}
           ${C}
         </div>` : `<div class="${$}">
           ${m ? this.closeBtnHtml("page-close", t) : ""}
           <section class="loc">
             <h1 class="loc-name">${f(a)}</h1>
             <div class="loc-sub">${z}</div>
             ${B}
           </section>
           <div class="pill-wrap">${ot(x)}</div>
           ${v}
         </div>`;
    this.body.innerHTML = `${E}${k}`, this.wireFull(l, o, r), this.paintGraphHost(u, g, h, t);
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
  paintGraphHost(t, i, n, s) {
    const o = this.body.querySelector(".graph-host");
    if (o && this.status === "ready") {
      const l = this.graphPoints();
      this.renderedGraphPoints = l;
      const a = this.selectedColumn(l);
      this.renderedScrubIdx = a;
      const c = () => this.hostTimeMs !== null;
      if (n) {
        const { setScrubIdx: r } = Xt(o, l, {
          scrubIdx: a,
          nowIdx: y0(l),
          onScrub: (m, u) => this.onUserScrub(l, m, u),
          previewHover: c,
          onFullscreen: () => {
            this.isExpanded() ? this.collapsePanel() : this.expandPanel();
          },
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
          metaLine: this.metaLine(s),
          t: s
        });
        this.graphScrubSetter = r;
      } else {
        const { setScrubIdx: r } = R2(
          o,
          l,
          s,
          a,
          (m, u) => this.onUserScrub(l, m, u),
          { previewHover: c }
        );
        this.graphScrubSetter = r;
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
  expandedBodyHtml(t, i, n, s) {
    return `
      <div class="exp-body">
        <div class="exp-left">
          <div class="now-wrap">${r2(n, s, 44, 50)}</div>
          ${c2(t, i, !1)}
          ${$2(t[i], s)}
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
  desktopBodyHtml(t, i, n, s) {
    const o = this.view === "table" ? $2(t[i], s) : '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>';
    return `
      ${r2(n, s, 46, 58)}
      ${c2(t, i, !1)}
      <div class="tabs">
        <button class="tab${this.view === "table" ? " on" : ""}" type="button" data-view="table" aria-pressed="${this.view === "table"}">${f(s.table)}</button>
        <button class="tab${this.view === "graph" ? " on" : ""}" type="button" data-view="graph" aria-pressed="${this.view === "graph"}">${f(s.graph)}</button>
      </div>
      ${o}`;
  }
  /** Mobile body: now card + Table/Graph control + chips/card or meteogram */
  mobileBodyHtml(t, i, n, s) {
    const o = this.view === "table" ? `${c2(t, i)}<div class="sel-wrap">${xt(t[i], s)}</div>` : '<div class="graph-wrap"><div class="graph-host"></div></div>';
    return `
      <div class="now-wrap">${r2(n, s)}</div>
      <div class="tabs">
        <button class="tab${this.view === "table" ? " on" : ""}" type="button" data-view="table" aria-pressed="${this.view === "table"}">${f(s.table)}</button>
        <button class="tab${this.view === "graph" ? " on" : ""}" type="button" data-view="graph" aria-pressed="${this.view === "graph"}">${f(s.graph)}</button>
      </div>
      ${o}`;
  }
  /**
   * Landscape full-screen body: a single view with a Table/Graph toggle (a short
   * phone in landscape can't fit two columns). Graph → the meteogram fills the
   * whole sheet (full width + fit-scaled height). Table → weather-now card, day
   * chips and the hourly table in one scrolling column.
   */
  landscapeBodyHtml(t, i, n, s) {
    const o = this.view === "graph", l = `
      <div class="tabs">
        <button class="tab${o ? "" : " on"}" type="button" data-view="table" aria-pressed="${!o}">${f(s.table)}</button>
        <button class="tab${o ? " on" : ""}" type="button" data-view="graph" aria-pressed="${o}">${f(s.graph)}</button>
      </div>`, a = o ? '<div class="graph-view graph-view-2a"><div class="graph-host"></div></div>' : `<div class="ls-scroll">
           <div class="now-wrap">${r2(n, s, 40, 46)}</div>
           ${c2(t, i, !0)}
           ${$2(t[i], s)}
         </div>`;
    return `${l}${a}`;
  }
  wireFull(t, i, n) {
    const s = (h) => this.body.querySelector(h);
    s(".page-close, .header-close")?.addEventListener(
      "click",
      () => {
        this.dispatchEvent(new CustomEvent("bel-meteogram-close"));
      }
    ), s(".pill")?.addEventListener("click", () => {
      this.settingsOpen = !0, this.focusAfterPaint = ".overlay", this.paint();
    }), s(".retry")?.addEventListener("click", () => this.load());
    for (const h of this.body.querySelectorAll(".tab[data-view]"))
      h.addEventListener("click", () => {
        const g = h.dataset.view;
        g !== this.view && (this.view = g, this.persistMapPanel(), this.paint());
      });
    for (const h of this.body.querySelectorAll(".day-chip[data-day]"))
      h.addEventListener("click", () => {
        const g = parseInt(h.dataset.day ?? "", 10);
        g !== this.selectedDay && (this.selectedDay = g, this.persistMapPanel(), this.paint());
      });
    const o = s("[data-drag-handle]"), l = s(".page.wide-2a");
    if (!this.isLandscape && o && l) {
      let h = null;
      const g = (k, $) => {
        const M = this.clientWidth || l.offsetWidth, F = this.clientHeight || l.offsetHeight, C = l.offsetWidth, E = l.offsetHeight;
        return {
          x: Math.max(0, Math.min(M - C, k)),
          y: Math.max(0, Math.min(F - E, $))
        };
      }, x = (k) => {
        if (!h || k.buttons === 0) return;
        const $ = g(
          h.px + k.clientX - h.sx,
          h.py + k.clientY - h.sy
        );
        this.panelPos = $, l.style.left = `${$.x}px`, l.style.top = `${$.y}px`;
      }, z = () => {
        h && (h = null, this.persistMapPanel(), window.removeEventListener("pointermove", x), window.removeEventListener("pointerup", z));
      };
      o.addEventListener("pointerdown", (k) => {
        if (k.target.closest("button")) return;
        const $ = l.getBoundingClientRect(), M = this.getBoundingClientRect();
        try {
          o.setPointerCapture(k.pointerId);
        } catch {
        }
        h = {
          sx: k.clientX,
          sy: k.clientY,
          px: $.left - M.left,
          py: $.top - M.top
        }, this.panelPos = { x: h.px, y: h.py }, window.addEventListener("pointermove", x), window.addEventListener("pointerup", z);
      });
      const B = (k, $) => {
        let M = null;
        const F = (E) => {
          if (!M || E.buttons === 0) return;
          const p = this.body.querySelector(".page.wide-2a");
          if (!p) return;
          const d = this.getBoundingClientRect(), _ = this.clientWidth || d.width, T = this.clientHeight || d.height, L = E.clientX - d.left, O = E.clientY - d.top;
          let D = M.left, G;
          $ === "bl" ? (D = Math.max(0, Math.min(M.rightEdge - u2, L)), G = Math.min(_ - 8, M.rightEdge - D)) : G = Math.max(u2, Math.min(_ - M.left - 8, L - M.left));
          const N = Math.min(
            G >= h2 ? S2 : Q2,
            T - M.top - 8
          ), R = Math.max(N, Math.min(T - M.top - 8, O - M.top));
          this.panelPos = { x: D, y: M.top }, this.panelSize = { w: G, h: R };
          const H = G >= h2;
          H !== M.expanded ? (M.expanded = H, this.paint()) : (p.style.left = `${D}px`, p.style.width = `${G}px`, p.style.height = `${R}px`, this.scheduleGraphRefit());
        }, C = () => {
          M && (M = null, window.removeEventListener("pointermove", F), window.removeEventListener("pointerup", C), this.persistMapPanel(), this.cancelGraphRefit(), this.paint());
        };
        k.addEventListener("pointerdown", (E) => {
          E.preventDefault(), E.stopPropagation();
          const p = l.getBoundingClientRect(), d = this.getBoundingClientRect();
          try {
            k.setPointerCapture(E.pointerId);
          } catch {
          }
          M = {
            left: p.left - d.left,
            top: p.top - d.top,
            rightEdge: p.right - d.left,
            expanded: this.isExpanded()
          }, window.addEventListener("pointermove", F), window.addEventListener("pointerup", C);
        });
      }, v = this.body.querySelectorAll("[data-resize-handle]");
      for (const k of v)
        B(k, k.dataset.corner === "br" ? "br" : "bl");
      v.length && !F2("resizeHintSeen") && (v.forEach((k) => k.classList.add("hint")), C2("resizeHintSeen", "1"));
    }
    this.closeOverlay = null;
    const a = s(".backdrop");
    if (!a) return;
    const c = () => {
      this.settingsOpen = !1, this.query = "", this.focusAfterPaint = ".pill", this.paint();
    };
    this.closeOverlay = c;
    const r = s(".overlay");
    r?.addEventListener("keydown", (h) => {
      if (h.key !== "Tab") return;
      const g = [
        ...r.querySelectorAll("button, input, [tabindex='0']")
      ].filter((v) => v.offsetParent !== null);
      if (!g.length) return;
      const x = g[0], z = g[g.length - 1], B = this.root.activeElement;
      h.shiftKey && (B === x || B === r) ? (h.preventDefault(), z.focus()) : !h.shiftKey && B === z && (h.preventDefault(), x.focus());
    }), a.addEventListener("click", (h) => {
      h.target === a && c();
    }), s(".overlay-close")?.addEventListener("click", c);
    for (const h of a.querySelectorAll(".chip[data-model]"))
      h.addEventListener("click", () => {
        const g = i[parseInt(h.dataset.model ?? "", 10)];
        !g || g.id === this.forecastId || (this.forecastId = g.id, C2("model", g.id), this.load());
      });
    for (const h of a.querySelectorAll(".chip[data-lang]"))
      h.addEventListener("click", () => {
        const g = h.dataset.lang ?? "is";
        g !== this.uiLang && (this.suppressAttrCallback = !0, this.setAttribute("language", g), this.suppressAttrCallback = !1, C2("lang", g), this.paint());
      });
    const m = s(".station-search"), u = s(".station-list");
    m?.addEventListener("input", () => {
      this.query = m.value, u && (u.innerHTML = z0(t, n, this.query, this.t));
    }), u?.addEventListener("click", (h) => {
      const g = h.target.closest(".station");
      if (!g) return;
      const x = t[parseInt(g.dataset.station ?? "", 10)];
      x && (this.suppressAttrCallback = !0, this.removeAttribute("location-name"), this.removeAttribute("station-place"), this.removeAttribute("station-place-km"), this.suppressAttrCallback = !1, this.pickedPlaceName = x.name, this.settingsOpen = !1, this.query = "", this.loadChartLocation(x.lat, x.lon, x.name));
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
class f1 extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  /** Where focus was when the sheet opened; it goes back there on close. */
  returnFocus = null;
  onKeyDown = (t) => {
    t.key === "Escape" && !t.defaultPrevented && (t.preventDefault(), this.close());
  };
  configure(t, i) {
    const n = document.createElement("style");
    n.textContent = Zt;
    const s = document.createElement("div");
    s.className = "scrim", s.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${f(t)}">
        <div class="grabber"></div>
        <div class="sheet-head">
          <div class="sheet-title"></div>
          <button class="close" type="button" aria-label="${f(w0(i.language ?? "").close)}">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="#16324A" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`, s.querySelector(".sheet-title").textContent = t;
    const o = document.createElement("bel-meteogram");
    for (const [a, c] of Object.entries(i))
      o.setAttribute(a, c);
    const l = s.querySelector(".sheet");
    l.appendChild(o), s.addEventListener("click", (a) => {
      a.target === s && this.close();
    }), s.querySelector(".close").addEventListener("click", () => this.close()), this.dragToDismiss(l), this.root.append(n, s);
  }
  connectedCallback() {
    const t = document.activeElement;
    this.returnFocus = t instanceof HTMLElement ? t : null, document.addEventListener("keydown", this.onKeyDown), this.root.querySelector(".close")?.focus({ preventScroll: !0 });
  }
  disconnectedCallback() {
    document.removeEventListener("keydown", this.onKeyDown);
  }
  dragToDismiss(t) {
    let i = 0, n = 0, s = !1;
    t.addEventListener("pointerdown", (l) => {
      l.target.closest(".mg-chart") || (s = !0, i = l.clientY, t.setPointerCapture(l.pointerId), t.style.transition = "none");
    }), t.addEventListener("pointermove", (l) => {
      s && (n = Math.max(0, l.clientY - i), t.style.transform = `translateY(${n}px)`);
    });
    const o = () => {
      s && (s = !1, t.style.transition = "", n > 90 ? this.close() : t.style.transform = "", n = 0);
    };
    t.addEventListener("pointerup", o), t.addEventListener("pointercancel", o);
  }
  close() {
    this.remove(), this.returnFocus?.isConnected && this.returnFocus.focus({ preventScroll: !0 }), this.returnFocus = null;
  }
}
customElements.define("bel-meteogram", I2);
customElements.define("bel-meteogram-sheet", f1);
export {
  I2 as BelMeteogram
};
