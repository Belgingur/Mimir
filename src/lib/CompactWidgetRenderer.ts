/**
 * CompactWidgetRenderer
 *
 * Alternative iconography renderer (style = 'compact').  Displays a two-line
 * text panel to the LEFT of the yr.no weather icon:
 *
 *   ┌──────────────┬────────────────┐
 *   │  -3°C        │                │
 *   │  ↙ 12        │  [Yr.no icon]  │
 *   └──────────────┴────────────────┘
 *
 * Line 1 — temperature as a rounded integer followed by "°C".
 *           Coloured blue for sub-zero values, red for zero and above.
 * Line 2 — Unicode directional arrow (wind-to direction, 8-point mapped from
 *           the 16-bin FROM-compass) followed by a space and the rounded
 *           wind speed in m/s.
 *
 * The same sprite-sheet / atlas packing strategy as WeatherWidgetRenderer is
 * used so the deck.gl IconLayer receives one synchronous canvas upload with no
 * per-icon async-load gap.
 */

import type { IconPoint } from "../controllers/IconographyController";
import type { IconMappingEntry } from "./WeatherWidgetRenderer";
import type { AtlasResult, IconographyRenderer } from "./iconographyTypes";
import { getBubbleMetrics, drawBubble } from "./iconographyBubble";

// ── Paths served from /public ────────────────────────────────────────────────
const ICON_BASE = "/weather-icons";

// Identical list to WeatherWidgetRenderer — pre-loaded so every PNG is in
// cache before the timeline slider advances to a new frame.
const YR_ICON_CODES = [
  "01d",
  "01m",
  "01n",
  "02d",
  "02m",
  "02n",
  "03d",
  "03m",
  "03n",
  "04",
  "05d",
  "05m",
  "05n",
  "06d",
  "06m",
  "06n",
  "07d",
  "07m",
  "07n",
  "08d",
  "08m",
  "08n",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "20d",
  "20m",
  "20n",
  "21d",
  "21m",
  "21n",
  "22",
  "23",
  "24d",
  "24m",
  "24n",
  "25d",
  "25m",
  "25n",
  "26d",
  "26m",
  "26n",
  "27d",
  "27m",
  "27n",
  "28d",
  "28m",
  "28n",
  "29d",
  "29m",
  "29n",
  "30",
  "31",
  "32",
  "33",
  "34",
  "40d",
  "40m",
  "40n",
  "41d",
  "41m",
  "41n",
  "42d",
  "42m",
  "42n",
  "43d",
  "43m",
  "43n",
  "44d",
  "44m",
  "44n",
  "45d",
  "45m",
  "45n",
  "46",
  "47",
  "48",
  "49",
  "50",
];

// ── Colours ──────────────────────────────────────────────────────────────────
const TEMP_POS_COLOUR = "#b83200"; // matches WeatherWidgetRenderer
const TEMP_NEG_COLOUR = "#0050a0";
const WIND_COLOUR = "#1a3a6e";

// ── Wind direction: FROM-degrees → Unicode TO-arrow ──────────────────────────
// 16-bin compass (22.5° each).  Pairs of adjacent bins share one of the 8
// diagonal/cardinal Unicode arrows because adjacent half-winds differ by only
// 22.5° — less than the 45° spacing between arrow glyphs.
//
// Index mapping:  bin = Math.round(fromDeg / 22.5) % 16
//   0  N    → ↓   8  S    → ↑
//   1  NNE  → ↙   9  SSW  → ↗
//   2  NE   → ↙  10  SW   → ↗
//   3  ENE  → ←  11  WSW  → →
//   4  E    → ←  12  W    → →
//   5  ESE  → ↖  13  WNW  → ↘
//   6  SE   → ↖  14  NW   → ↘
//   7  SSE  → ↑  15  NNW  → ↓
const WIND_TO_ARROWS = [
  "↓",
  "↙",
  "↙",
  "←",
  "←",
  "↖",
  "↖",
  "↑",
  "↑",
  "↗",
  "↗",
  "→",
  "→",
  "↘",
  "↘",
  "↓",
] as const;

// ─────────────────────────────────────────────────────────────────────────────

interface WidgetCanvas {
  canvas: HTMLCanvasElement;
  anchorX: number; // pixel within canvas that maps to the geo-coordinate x
}

// ─────────────────────────────────────────────────────────────────────────────

export class CompactWidgetRenderer implements IconographyRenderer {
  private _imgs = new Map<string, HTMLImageElement | null>();
  /**
   * Per-widget canvas cache keyed by content.
   * Only widgets rendered with all images present are stored here; widgets
   * missing their Yr.no PNG are never cached so they are re-drawn on the next
   * buildAtlas call after the image arrives.
   */
  private _widgetCache = new Map<string, WidgetCanvas>();
  private _onImageReady: () => void;

  constructor(onImageReady: () => void) {
    this._onImageReady = onImageReady;
    for (const code of YR_ICON_CODES) {
      void this._loadImage(`${ICON_BASE}/${code}.png`);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  buildAtlas(points: IconPoint[], iconSize: number): AtlasResult {
    const { vPad: bVPad, pointerH, shadowRoom } = getBubbleMetrics(iconSize);
    const h = iconSize + 2 * bVPad + pointerH + shadowRoom;

    // 1. Collect unique widgets.
    const orderedKeys: string[] = [];
    const keyToWidget = new Map<string, WidgetCanvas>();

    for (const point of points) {
      const key = this._key(point, iconSize);
      if (!keyToWidget.has(key)) {
        orderedKeys.push(key);
        keyToWidget.set(key, this._getOrRender(point, iconSize));
      }
    }

    // 2. Pack widgets into rows capped at MAX_ATLAS_WIDTH to stay within
    //    WebGL MAX_TEXTURE_SIZE (commonly 4096 px on mobile GPUs).
    //    Exceeding this limit causes a silent GPU upload failure that blanks
    //    every icon — the primary cause of "frequently missing" icons.
    const MAX_ATLAS_WIDTH = 4096;
    const positions = new Map<string, { x: number; y: number }>();
    let rowX = 0,
      rowY = 0,
      maxRowW = 0;
    for (const key of orderedKeys) {
      const w = keyToWidget.get(key)!.canvas.width;
      if (rowX > 0 && rowX + w > MAX_ATLAS_WIDTH) {
        maxRowW = Math.max(maxRowW, rowX);
        rowX = 0;
        rowY += h;
      }
      positions.set(key, { x: rowX, y: rowY });
      rowX += w;
    }
    maxRowW = Math.max(maxRowW, rowX);

    const atlas = document.createElement("canvas");
    atlas.width = Math.max(maxRowW, 1);
    atlas.height = rowY + h;
    const atlasCtx = atlas.getContext("2d")!;
    for (const key of orderedKeys) {
      const pos = positions.get(key)!;
      atlasCtx.drawImage(keyToWidget.get(key)!.canvas, pos.x, pos.y);
    }

    // 3. Build iconMapping.
    const mapping: Record<string, IconMappingEntry> = {};
    for (const key of orderedKeys) {
      const widget = keyToWidget.get(key)!;
      const pos = positions.get(key)!;
      mapping[key] = {
        x: pos.x,
        y: pos.y,
        width: widget.canvas.width,
        height: h,
        anchorX: widget.anchorX,
        anchorY: h - shadowRoom, // pointer tip = geographic coordinate
      };
    }

    return {
      atlas,
      mapping,
      getKey: (point: IconPoint) => this._key(point, iconSize),
    };
  }

  /** Discard all cached widgets (call on model change). */
  invalidate(): void {
    this._widgetCache.clear();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _windArrow(fromDeg: number): string {
    const bin = Math.round((((fromDeg % 360) + 360) % 360) / 22.5) % 16;
    return WIND_TO_ARROWS[bin];
  }

  private _key(point: IconPoint, iconSize: number): string {
    const arrow =
      point.windDirection !== null ? this._windArrow(point.windDirection) : "-";
    const ws =
      point.windSpeed !== null ? String(Math.round(point.windSpeed)) : "-";
    const tp =
      point.temperature !== null ? String(Math.round(point.temperature)) : "-";
    return `${iconSize}|${point.icon}|${arrow}|${ws}|${tp}`;
  }

  // ── Image loading (mirrors WeatherWidgetRenderer) ─────────────────────────

  private _getOrLoad(url: string): HTMLImageElement | null {
    if (this._imgs.has(url)) return this._imgs.get(url) ?? null;
    void this._loadImage(url);
    return null;
  }

  private _loadImage(url: string): Promise<HTMLImageElement | null> {
    if (this._imgs.has(url))
      return Promise.resolve(this._imgs.get(url) ?? null);
    // Set a null sentinel BEFORE starting the fetch so that any concurrent
    // call to _loadImage or _getOrLoad sees _imgs.has(url) === true and skips
    // creating a duplicate Image() object.  Without this, the constructor
    // pre-loads and _getOrLoad both start a fetch; the duplicate's onerror can
    // then overwrite the successful result with null, permanently hiding the icon.
    this._imgs.set(url, null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._imgs.set(url, img);
        // Widgets missing this image were not cached, so no explicit eviction
        // is needed — the next buildAtlas call will render them fresh.
        this._onImageReady();
        resolve(img);
      };
      img.onerror = () => {
        // Leave the null sentinel in place (= permanently failed).
        // _onImageReady is intentionally not called here: the widget already
        // shows without the icon and nothing would change on a rebuild.
        resolve(null);
      };
      img.src = url;
    });
  }

  // ── Widget rendering ───────────────────────────────────────────────────────

  private _getOrRender(point: IconPoint, iconSize: number): WidgetCanvas {
    const key = this._key(point, iconSize);
    const cached = this._widgetCache.get(key);
    if (cached) return cached;

    const yrUrl = `${ICON_BASE}/${point.icon}.png`;
    const yrImg = this._getOrLoad(yrUrl);
    const widget = this._renderWidget(point, iconSize, yrImg);
    // Only cache when the Yr.no image is present.  If it is still loading,
    // omit the entry so the next buildAtlas call re-renders with the real image
    // rather than serving a stale blank-icon canvas from cache.
    if (yrImg !== null) this._widgetCache.set(key, widget);
    return widget;
  }

  private _renderWidget(
    point: IconPoint,
    iconSize: number,
    yrImg: HTMLImageElement | null,
  ): WidgetCanvas {
    const h = iconSize;
    const fontSize = Math.max(9, Math.round(iconSize * 0.27));
    const hPad = Math.max(3, Math.round(iconSize * 0.1)); // horizontal padding inside left panel
    const gap = Math.max(1, Math.round(iconSize * 0.04)); // gap between left panel and icon

    // ── Build display strings ─────────────────────────────────────────────────
    const tempVal =
      point.temperature !== null ? Math.round(point.temperature) : null;
    const tempStr = tempVal !== null ? `${tempVal}°C` : null;

    const arrow =
      point.windDirection !== null
        ? this._windArrow(point.windDirection)
        : null;
    const spdStr =
      point.windSpeed !== null ? String(Math.round(point.windSpeed)) : null;
    const windStr =
      arrow !== null && spdStr !== null
        ? `${arrow} ${spdStr}`
        : arrow !== null
          ? arrow
          : spdStr;

    // ── Measure text to size the left panel ──────────────────────────────────
    const mc = document.createElement("canvas");
    const mctx = mc.getContext("2d")!;
    mctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    const tempW = tempStr ? mctx.measureText(tempStr).width : 0;
    const windW = windStr ? mctx.measureText(windStr).width : 0;
    const textW = Math.ceil(Math.max(tempW, windW));

    const leftW = textW > 0 ? textW + hPad * 2 : 0;
    const totalW = leftW + (leftW > 0 ? gap : 0) + iconSize;

    // ── Bubble metrics ────────────────────────────────────────────────────────
    const {
      hPad: bHPad,
      vPad: bVPad,
      radius,
      pointerH,
      pointerBaseW,
      shadowRoom,
    } = getBubbleMetrics(iconSize);
    const canvasW = totalW + 2 * bHPad;
    const bodyH = h + 2 * bVPad; // bubble rect height (excl. pointer + shadow)
    const canvasH = bodyH + pointerH + shadowRoom;

    // ── Draw ──────────────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d")!;

    // Bubble body + downward pointer, drawn as one unified shape
    drawBubble(ctx, 0, 0, canvasW, bodyH, radius, pointerH, pointerBaseW);

    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;

    const yrX = bHPad + leftW + (leftW > 0 ? gap : 0);
    if (yrImg) ctx.drawImage(yrImg, yrX, bVPad, iconSize, iconSize);

    if (leftW > 0) {
      const textX = bHPad + leftW - hPad; // right edge of text (right-aligned)
      const row1CY = bVPad + Math.round(h * 0.3);
      const row2CY = bVPad + Math.round(h * 0.72);

      ctx.textAlign = "right";

      if (tempStr !== null && tempVal !== null) {
        ctx.fillStyle = tempVal < 0 ? TEMP_NEG_COLOUR : TEMP_POS_COLOUR;
        ctx.fillText(tempStr, textX, row1CY);
      }

      if (windStr) {
        ctx.fillStyle = WIND_COLOUR;
        ctx.fillText(windStr, textX, row2CY);
      }
    }

    // anchorX = horizontal centre of the whole canvas so the widget centres
    //           over the geographic coordinate.
    // anchorY = bodyH + pointerH = pointer tip, set in buildAtlas as h - shadowRoom.
    return { canvas, anchorX: Math.round(canvasW / 2) };
  }
}
