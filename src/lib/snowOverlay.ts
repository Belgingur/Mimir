/**
 * Snow-fraction overlay — SVG implementation.
 *
 * Symbol design follows public/data/snowflakes.js:
 *
 *   Tier 1 (0.25–0.50): two small white dots  per tile  — pt-snow-1 (r=0.75)
 *   Tier 2 (0.50–0.75): two medium white dots per tile  — pt-snow-2 (r=1 / r=1.25)
 *   Tier 3 (0.75–1.00): two SVG snowflake instances     — pt-snow-3 using #snow-flake
 *                        at scale 0.020 / 0.027 with -15° / +15° rotation
 *
 * Architecture
 * ────────────
 * extractSnowPoints()  scans the raster and returns a flat list of SnowPoint
 *   objects (one per symbol, two per tile block).  This is cached by the caller
 *   on the rasterScalar object so it is recomputed only when a new frame loads.
 *
 * SnowOverlaySVG       owns a <svg> element mounted over the MapLibre canvas.
 *   update() is called from LayerComposer.updateLayers() on every viewport
 *   change; it projects each point's lat/lon to screen coordinates via
 *   MapLibre's map.project() and rebuilds the SVG content.
 */

import type { InhouseLayer } from "./inhouseTypes";
import { getInhouseLayerUnscale } from "./inhouseLayerHelpers";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum snow_fraction to show any symbol (matches fillSnowFrac.domain()[0]). */
export const SNOW_OVERLAY_MIN = 0.25;

/**
 * The zoom level at which the base symbol sizes in SnowPoint look right.
 * Larger zoom → smaller domain → symbols need to be bigger at a given map zoom.
 *
 * Three tiers by domain extent:
 *   Large  (GFS, ECMWF)                  → 3.0
 *   Medium (ICON-EU, UWC-DINI, UWC-IG)   → 4.0
 *   Small  (BEL-IS, BEL-FO, …)           → 5.8
 */
const LARGE_DOMAIN_MODELS = new Set(["GFS", "ECMWF"]);
const MEDIUM_DOMAIN_MODELS = new Set(["ICON-EU", "UWC-DINI", "UWC-IG"]);

export function referenceZoomForModel(model: string): number {
  if (LARGE_DOMAIN_MODELS.has(model)) return 3.0;
  if (MEDIUM_DOMAIN_MODELS.has(model)) return 4.0;
  return 5.8; // default: small domain (BEL-IS, BEL-FO, …)
}

/**
 * Distance between tile block centres in raster pixels.
 * Controls symbol density.  Larger = sparser.
 */
const TILE_STEP = 12;

// ─── Snowflake SVG path ───────────────────────────────────────────────────────
// Copied verbatim from public/data/snowflakes.js (#snow-flake path data).
// The original element carries transform="translate(-202 -202)"; that shift is
// reproduced in the SVG <use> transform so the flake renders centred on (0,0)
// before the positioning translate is applied.
const FLAKE_PATH_D =
  "M183.3125,43.09375L183.3125,83.8125L152.71875,66.125L137.1875,92.9375" +
  "L183.3125,119.65625L183.3125,179.75L131.5,149.8125L131.40625,96.28125" +
  "L100.40625,96.34375L100.46875,131.90625L65.09375,111.46875L49.59375,138.3125" +
  "L84.875,158.6875L54.25,176.3125L69.6875,203.1875L115.90625,176.59375" +
  "L167.90625,206.625L116.09375,236.53125L69.6875,209.84375L54.25,236.71875" +
  "L85.0625,254.46875L49.6875,274.875L65.1875,301.71875L100.46875,281.34375" +
  "L100.40625,316.6875L131.40625,316.75L131.5,263.4375L183.5,233.4375" +
  "L183.5,293.25L137.1875,320.09375L152.71875,346.90625L183.5,329.09375" +
  "L183.5,369.9375L214.5,369.9375L214.5,329.21875L245.09375,346.90625" +
  "L260.625,320.09375L214.5,293.375L214.5,233.28125L266.3125,263.21875" +
  "L266.40625,316.75L297.40625,316.6875L297.34375,281.125L332.71875,301.5625" +
  "L348.21875,274.71875L312.9375,254.34375L343.5625,236.71875L328.125,209.84375" +
  "L281.9375,236.4375L229.90625,206.40625L281.75,176.46875L328.125,203.1875" +
  "L343.5625,176.3125L312.75,158.5625L348.125,138.15625L332.625,111.3125" +
  "L297.34375,131.6875L297.40625,96.34375L266.40625,96.28125L266.3125,149.59375" +
  "L214.3125,179.59375L214.3125,119.78125L260.625,92.9375L245.09375,66.125" +
  "L214.3125,83.9375L214.3125,43.09375L183.3125,43.09375z";

// ─── Data types ───────────────────────────────────────────────────────────────

export interface SnowPoint {
  lng: number;
  lat: number;
  tier: 1 | 2 | 3;
  /** Rotation in degrees (meaningful for tier 3 flakes only). */
  rot: number;
  /**
   * For tiers 1 & 2: circle radius in screen pixels.
   * For tier 3: scale factor applied to the SVG path (matching pt-snow-3:
   * scale(0.02) for the first symbol, scale(0.027) for the second).
   */
  size: number;
}

// ─── Point extraction ─────────────────────────────────────────────────────────

type RasterScalar = {
  data: Uint8Array;
  width: number;
  height: number;
  widthMeta?: number;
};

/**
 * Scan the snow_fraction raster and return one SnowPoint per symbol to render
 * (two staggered symbols per tile block, mirroring the two-element stagger in
 * the reference SVG patterns).
 *
 * Returns null when no block exceeds SNOW_OVERLAY_MIN.
 */
export function extractSnowPoints(layer: InhouseLayer): SnowPoint[] | null {
  const rasterScalar = layer.rasterScalar as RasterScalar | null | undefined;
  if (!rasterScalar) return null;

  const { data, width: paddedWidth, height, widthMeta } = rasterScalar;
  const rasterW = widthMeta ?? paddedWidth;
  const rasterH = height;

  const [unscaleMin, unscaleMax] = getInhouseLayerUnscale(layer);
  const decode = (raw: number) =>
    unscaleMin + (raw / 255) * (unscaleMax - unscaleMin);

  // Geographic extent from manifest bounds [west, south, east, north].
  const [west, south, east, north] = layer.manifest.bounds as [
    number,
    number,
    number,
    number,
  ];

  /** Longitude for raster column rx (row 0 = leftmost / westmost). */
  const lngOf = (rx: number) => west + (rx / (rasterW - 1)) * (east - west);
  /** Latitude  for raster row    ry (row 0 = northernmost after np.flipud). */
  const latOf = (ry: number) => north - (ry / (rasterH - 1)) * (north - south);

  const step = TILE_STEP;
  const points: SnowPoint[] = [];

  for (let gy = 0; gy < rasterH; gy += step) {
    const yEnd = Math.min(gy + step, rasterH);

    for (let gx = 0; gx < rasterW; gx += step) {
      const xEnd = Math.min(gx + step, rasterW);

      // Maximum snow_fraction in this tile block.
      let maxFrac = 0;
      for (let ry = gy; ry < yEnd; ry++) {
        const rowBase = ry * paddedWidth;
        for (let rx = gx; rx < xEnd; rx++) {
          const frac = decode(data[rowBase + rx]);
          if (frac > maxFrac) maxFrac = frac;
        }
      }
      if (maxFrac < SNOW_OVERLAY_MIN) continue;

      // Tier thresholds match fillSnowFrac in snowflakes.js.
      const tier: 1 | 2 | 3 = maxFrac >= 0.75 ? 3 : maxFrac >= 0.5 ? 2 : 1;

      // Two staggered positions within the block — mirrors (5,5) and (15,14)
      // in the reference 20×20 SVG pattern tiles.
      const rx1 = gx + (xEnd - gx) * 0.25;
      const ry1 = gy + (yEnd - gy) * 0.25;
      const rx2 = gx + (xEnd - gx) * 0.75;
      const ry2 = gy + (yEnd - gy) * 0.7;

      // Deterministic per-block rotations for visual variety.
      const rot1 = ((gx * 7 + gy * 13) % 60) - 30; // –30° … +30°
      const rot2 = ((gx * 11 + gy * 7) % 60) - 30;

      if (tier === 3) {
        // Snowflake path — scale factors mirror pt-snow-3: scale(0.02) / scale(0.027).
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: rot1,
          size: 0.02,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: rot2,
          size: 0.027,
        });
      } else if (tier === 2) {
        // Medium dots — matches pt-snow-2: r=1 and r=1.25.
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: 0,
          size: 1.0,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: 0,
          size: 1.25,
        });
      } else {
        // Small dots — matches pt-snow-1: r=0.75.
        points.push({
          lng: lngOf(rx1),
          lat: latOf(ry1),
          tier,
          rot: 0,
          size: 0.75,
        });
        points.push({
          lng: lngOf(rx2),
          lat: latOf(ry2),
          tier,
          rot: 0,
          size: 0.75,
        });
      }
    }
  }

  return points.length > 0 ? points : null;
}

// ─── SVG overlay ─────────────────────────────────────────────────────────────

/**
 * Manages a <svg> element absolutely positioned over the MapLibre canvas.
 *
 * The SVG uses pointer-events:none so all map interactions pass through.
 * On each update() call the group content is rebuilt from the current
 * SnowPoint list projected to screen coordinates.
 */
export class SnowOverlaySVG {
  private readonly svgEl: SVGSVGElement;
  private readonly groupEl: SVGGElement;

  constructor(container: HTMLElement) {
    const NS = "http://www.w3.org/2000/svg";
    this.svgEl = document.createElementNS(NS, "svg") as SVGSVGElement;

    Object.assign(this.svgEl.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2",
      overflow: "visible",
    });

    // Defs: snowflake path + drop-shadow filter for legibility.
    this.svgEl.innerHTML = `
      <defs>
        <path id="sf" d="${FLAKE_PATH_D}"/>
        <filter id="sf-sh" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="1"
                        flood-color="rgba(0,20,80,0.55)" flood-opacity="1"/>
        </filter>
      </defs>
      <g id="sf-g" fill="white" filter="url(#sf-sh)"></g>
    `;

    this.groupEl = this.svgEl.querySelector("#sf-g") as SVGGElement;
    container.appendChild(this.svgEl);
  }

  /**
   * Re-project all points to screen coordinates and rebuild SVG content.
   *
   * @param points      Output of extractSnowPoints(), or null to clear.
   * @param projectMap  map.project() bound to the current MapLibre instance.
   * @param opacity     Layer opacity (0–1).
   * @param zoom        Current MapLibre zoom level — drives symbol size scaling.
   * @param bounds      Current map viewport bounds for culling.
   */
  update(
    points: SnowPoint[] | null,
    projectMap: (coord: [number, number]) => { x: number; y: number },
    opacity: number,
    zoom: number,
    bounds: { west: number; south: number; east: number; north: number },
    model: string = "",
  ): void {
    if (!points || opacity <= 0) {
      this.groupEl.innerHTML = "";
      this.groupEl.style.opacity = "0";
      return;
    }

    // Each MapLibre zoom level doubles the map scale, so symbols should grow
    // by the same factor to maintain a consistent geographic footprint.
    // REFERENCE_ZOOM is the zoom at which the base symbol sizes look right;
    // it depends on domain size (large domains are viewed at lower zoom levels).
    const REFERENCE_ZOOM = referenceZoomForModel(model);
    const zoomScale = 2 ** (zoom - REFERENCE_ZOOM);

    // Geographic padding in degrees: cull points just outside the viewport.
    const PAD = 3;
    const { west, south, east, north } = bounds;

    const parts: string[] = [];

    for (const pt of points) {
      if (pt.lng < west - PAD || pt.lng > east + PAD) continue;
      if (pt.lat < south - PAD || pt.lat > north + PAD) continue;

      const { x, y } = projectMap([pt.lng, pt.lat]);
      const s = pt.size * zoomScale;

      if (pt.tier === 3) {
        // SVG transform (applied right-to-left in SVG):
        //   1. translate(-202,-202) — centre the path near origin
        //   2. scale(s)             — base size × zoom factor
        //   3. rotate(rot)          — add visual variety
        //   4. translate(x,y)       — position on screen
        const xr = x.toFixed(1);
        const yr = y.toFixed(1);
        const sf = s.toFixed(4);
        const r = pt.rot.toFixed(1);
        parts.push(
          `<use href="#sf" transform="translate(${xr},${yr}) rotate(${r}) scale(${sf}) translate(-202,-202)"/>`,
        );
      } else {
        const xr = x.toFixed(1);
        const yr = y.toFixed(1);
        parts.push(`<circle cx="${xr}" cy="${yr}" r="${s.toFixed(2)}"/>`);
      }
    }

    this.groupEl.style.opacity = String(opacity);
    this.groupEl.innerHTML = parts.join("");
  }

  /** Remove the SVG element from the DOM. */
  remove(): void {
    this.svgEl.remove();
  }
}
