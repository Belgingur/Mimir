/**
 * WeatherWidgetRenderer
 *
 * Renders composite weather widgets onto a single sprite-sheet canvas that is
 * passed directly to deck.gl's IconLayer as `iconAtlas`.  Uploading one
 * HTMLCanvasElement to WebGL is synchronous — there is no per-icon async image
 * load — which eliminates the "icons missing for a frame" flicker that occurs
 * when every time step produces hundreds of new data-URI strings.
 *
 * Widget layout (at base iconSize = 48 px):
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │  WNW [↑dir] │                   │  4°             │
 *   │             │  [Yr.no icon 48]  │  [thermometer]  │
 *   │  8 m/s [~]  │                   │                 │
 *   └────────────────────────────────────────────────────┘
 *
 * Public API used by LayerComposer:
 *   buildAtlas(points, iconSize) → { atlas, mapping, getKey }
 *     atlas   – HTMLCanvasElement sprite sheet, pass as iconAtlas
 *     mapping – deck.gl iconMapping object, pass as iconMapping
 *     getKey  – accessor returning the icon name for each data point
 */

import type { IconPoint } from "../controllers/IconographyController";
import type { IconographyRenderer } from "./iconographyTypes";
import { windDirectionBin } from "./windDirection";
import { getBubbleMetrics, drawBubble } from "./iconographyBubble";

// ── Paths served from /public ────────────────────────────────────────────────
const ICON_BASE = "/weather-icons";
const DIRECTION_SVG = "/data/direction.svg";
const WIND_SVG = "/data/wind.svg";
const THERMO_SVG = "/data/thermometer.svg";

// All Yr.no weather-symbol codes (matches public/weather-icons/*.png).
// Pre-loaded eagerly so every PNG is in cache before the time slider advances.
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
const WIND_DIR_COLOUR = "#1a3a6e";
const WIND_SPD_COLOUR = "#1a3a6e";
const TEMP_POS_COLOUR = "#b83200";
const TEMP_NEG_COLOUR = "#0050a0";
const ICON_TINT_WIND = "#1a3a6e";

// ── Atlas entry returned by _renderWidget ────────────────────────────────────
interface WidgetCanvas {
  canvas: HTMLCanvasElement;
  anchorX: number; // pixel within canvas that maps to the geo-coordinate x
  // anchorY is always canvas.height (bottom-centre of the Yr.no slot)
}

// ── deck.gl iconMapping entry ────────────────────────────────────────────────
export interface IconMappingEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface AtlasResult {
  /** Sprite-sheet canvas — pass directly as deck.gl IconLayer `iconAtlas`. */
  atlas: HTMLCanvasElement;
  /** Icon name → sprite coordinates — pass as `iconMapping`. */
  mapping: Record<string, IconMappingEntry>;
  /** Returns the icon name for a given data point — use as `getIcon` accessor. */
  getKey: (point: IconPoint) => string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class WeatherWidgetRenderer implements IconographyRenderer {
  /** Raw HTMLImageElement cache. null = load failed / not yet resolved. */
  private _imgs = new Map<string, HTMLImageElement | null>();
  /**
   * Per-widget canvas cache keyed by content.
   * Only widgets rendered with all images present are stored here; widgets
   * missing their Yr.no PNG are never cached so they are re-drawn on the next
   * buildAtlas call after the image arrives.
   */
  private _widgetCache = new Map<string, WidgetCanvas>();
  /** Called after any image loads so the caller can schedule a layer rebuild. */
  private _onImageReady: () => void;

  constructor(onImageReady: () => void) {
    this._onImageReady = onImageReady;
    // Eagerly load helper SVGs.
    void this._loadImage(DIRECTION_SVG);
    void this._loadImage(WIND_SVG);
    void this._loadImage(THERMO_SVG);
    // Pre-load every Yr.no condition PNG upfront.
    for (const code of YR_ICON_CODES) {
      void this._loadImage(`${ICON_BASE}/${code}.png`);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build a sprite-sheet atlas for all given points.
   * Unique widget canvases are packed into one wide HTMLCanvasElement which is
   * uploaded to WebGL synchronously — no async image-load gap per icon.
   */
  buildAtlas(points: IconPoint[], iconSize: number): AtlasResult {
    const { vPad: bVPad, pointerH, shadowRoom } = getBubbleMetrics(iconSize);
    const h = iconSize + 2 * bVPad + pointerH + shadowRoom;

    // 1. Collect unique widgets (deduplicated by content key).
    const orderedKeys: string[] = [];
    const keyToWidget = new Map<string, WidgetCanvas>();

    for (const point of points) {
      const key = this._key(point, iconSize);
      if (!keyToWidget.has(key)) {
        orderedKeys.push(key);
        keyToWidget.set(key, this._getOrRenderWidget(point, iconSize));
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
        anchorY: h - shadowRoom, // pointer tip = the station's map coordinate
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

  // ── Image loading ──────────────────────────────────────────────────────────

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

  private _getOrRenderWidget(point: IconPoint, iconSize: number): WidgetCanvas {
    const key = this._key(point, iconSize);
    const cached = this._widgetCache.get(key);
    if (cached) return cached;

    const yrUrl = `${ICON_BASE}/${point.icon}.png`;
    const yrImg = this._getOrLoad(yrUrl);
    const widget = this._renderWidget(point, iconSize, yrImg);

    // Only cache when the Yr.no image and all SVG helpers needed by this
    // widget are loaded.  If any required image is still in flight, skip
    // caching so the next buildAtlas call re-renders with the full set.
    const needsDir = point.windDirection !== null;
    const needsWind = point.windSpeed !== null;
    const needsTherm = point.temperature !== null;
    const dirOk = !needsDir || (this._imgs.get(DIRECTION_SVG) ?? null) !== null;
    const windOk = !needsWind || (this._imgs.get(WIND_SVG) ?? null) !== null;
    const thermOk =
      !needsTherm || (this._imgs.get(THERMO_SVG) ?? null) !== null;
    if (yrImg !== null && dirOk && windOk && thermOk) {
      this._widgetCache.set(key, widget);
    }
    return widget;
  }

  private _renderWidget(
    point: IconPoint,
    iconSize: number,
    yrImg: HTMLImageElement | null,
  ): WidgetCanvas {
    const h = iconSize;
    const helper = Math.round(iconSize * 0.4);
    const pad = Math.max(2, Math.round(iconSize * 0.06));
    const colGap = Math.max(1, Math.round(iconSize * 0.03));
    const fontSize = Math.max(9, Math.round(iconSize * 0.26));

    const mc = document.createElement("canvas");
    const mctx = mc.getContext("2d")!;
    const unitStr = "m/s";
    const unitFontSz = Math.max(7, Math.round(fontSize * 0.75));

    const windBin =
      point.windDirection !== null
        ? windDirectionBin(point.windDirection)
        : null;
    const windSpd =
      point.windSpeed !== null ? String(Math.round(point.windSpeed)) : null;
    const tempVal =
      point.temperature !== null ? Math.round(point.temperature) : null;
    const tempStr = tempVal !== null ? `${tempVal}°` : null;

    mctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    const windBinW = windBin ? mctx.measureText(windBin).width : 0;
    const windSpdW = windSpd ? mctx.measureText(windSpd).width : 0;
    const rightTextW = tempStr ? mctx.measureText(tempStr).width : 0;

    mctx.font = `600 ${unitFontSz}px system-ui, sans-serif`;
    const windUnitW = windSpd ? 2 + mctx.measureText(unitStr).width : 0;

    const windSpdRowW = windSpdW + windUnitW;
    const leftTextW = Math.max(windBinW, windSpdRowW);

    const leftW = windBin || windSpd ? Math.round(leftTextW + pad + helper) : 0;
    const rightW = tempStr ? Math.max(Math.ceil(rightTextW), helper) : 0;

    const totalW =
      leftW +
      (leftW > 0 ? colGap : 0) +
      iconSize +
      (rightW > 0 ? colGap : 0) +
      rightW;

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

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d")!;
    ctx.textBaseline = "middle";

    // Bubble body + downward pointer, drawn as one unified shape
    drawBubble(ctx, 0, 0, canvasW, bodyH, radius, pointerH, pointerBaseW);

    const yrX = bHPad + leftW + (leftW > 0 ? colGap : 0);
    if (yrImg) ctx.drawImage(yrImg, yrX, bVPad, iconSize, iconSize);

    // ── Left column ──────────────────────────────────────────────────────────
    if (leftW > 0) {
      const row1CY = bVPad + Math.round(h * 0.28);
      const row2CY = bVPad + Math.round(h * 0.72);

      if (windBin && point.windDirection !== null) {
        ctx.fillStyle = WIND_DIR_COLOUR;
        ctx.textAlign = "right";
        ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
        ctx.fillText(windBin, bHPad + leftTextW, row1CY);

        const dirImg = this._imgs.get(DIRECTION_SVG) ?? null;
        if (dirImg) {
          const bearingDeg = (point.windDirection + 180) % 360;
          this._drawTintedRotated(
            ctx,
            dirImg,
            bHPad + Math.round(leftTextW + pad),
            Math.round(row1CY - helper / 2),
            helper,
            helper,
            ICON_TINT_WIND,
            bearingDeg,
          );
        }
      }

      if (windSpd) {
        ctx.fillStyle = WIND_SPD_COLOUR;
        ctx.font = `600 ${unitFontSz}px system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(unitStr, bHPad + leftTextW, row2CY);

        ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(windSpd, bHPad + leftTextW - windUnitW, row2CY);

        const windImg = this._imgs.get(WIND_SVG) ?? null;
        if (windImg) {
          this._drawTinted(
            ctx,
            windImg,
            bHPad + Math.round(leftTextW + pad),
            Math.round(row2CY - helper / 2),
            helper,
            helper,
            ICON_TINT_WIND,
          );
        }
      }
    }

    // ── Right column ─────────────────────────────────────────────────────────
    if (tempStr !== null && tempVal !== null) {
      const rightX = yrX + iconSize + (rightW > 0 ? colGap : 0);
      const tcolour = tempVal < 0 ? TEMP_NEG_COLOUR : TEMP_POS_COLOUR;
      const smallGap = Math.round(pad * 0.5);
      const stackH = fontSize + smallGap + helper;
      const stackTopY = bVPad + Math.round((h - stackH) / 2);

      ctx.fillStyle = tcolour;
      ctx.textAlign = "center";
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.fillText(
        tempStr,
        rightX + Math.round(rightW / 2),
        stackTopY + Math.round(fontSize / 2),
      );

      const thermoImg = this._imgs.get(THERMO_SVG) ?? null;
      if (thermoImg) {
        this._drawTinted(
          ctx,
          thermoImg,
          rightX + Math.round((rightW - helper) / 2),
          stackTopY + fontSize + smallGap,
          helper,
          helper,
          tcolour,
        );
      }
    }

    // anchorX = horizontal centre of the whole canvas so the widget centres
    //           over the geographic coordinate.
    // anchorY = bodyH + pointerH = pointer tip, set in buildAtlas as h - shadowRoom.
    return { canvas, anchorX: Math.round(canvasW / 2) };
  }

  // ── Compositing helpers ───────────────────────────────────────────────────

  private _drawTinted(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    colour: string,
  ): void {
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = colour;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(img, 0, 0, w, h);
    ctx.drawImage(tmp, x, y);
  }

  private _drawTintedRotated(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    colour: string,
    angleDeg: number,
  ): void {
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    tctx.fillStyle = colour;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(img, 0, 0, w, h);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(tmp, -w / 2, -h / 2);
    ctx.restore();
  }

  // ── Cache key ─────────────────────────────────────────────────────────────

  private _key(point: IconPoint, iconSize: number): string {
    const wd =
      point.windDirection !== null
        ? windDirectionBin(point.windDirection)
        : "-";
    const wa =
      point.windDirection !== null
        ? String(Math.round(point.windDirection / 5) * 5)
        : "-";
    const ws =
      point.windSpeed !== null ? String(Math.round(point.windSpeed)) : "-";
    const tp =
      point.temperature !== null ? String(Math.round(point.temperature)) : "-";
    return `${iconSize}|${point.icon}|${wd}|${wa}|${ws}|${tp}`;
  }
}
