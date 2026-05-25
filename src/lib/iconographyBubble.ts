/**
 * Shared bubble-drawing utility for iconography widget renderers.
 *
 * Replicates the hover-tooltip visual style (.inhouse-tooltip / .weatherlayers-tooltip-control):
 *   background  rgba(255, 255, 255, 0.96)   (--surface-card)
 *   border      1 px solid rgba(0,0,0,0.12) (--border-light)
 *   radius      ~10 px                      (--radius-md, scaled with iconSize)
 *   shadow      drop-shadow (adapted for canvas)
 *
 * The bubble includes a downward-pointing triangular callout at the bottom-centre.
 * The tip of the callout is the anchor point that aligns with the geographic coordinate.
 */

export interface BubbleMetrics {
  /** Horizontal padding inside the bubble (content → edge). */
  hPad: number;
  /** Vertical padding inside the bubble (content → edge). */
  vPad: number;
  /** Corner radius of the rounded rect body. */
  radius: number;
  /** Height of the downward-pointing callout triangle below the bubble body. */
  pointerH: number;
  /** Base width of the callout triangle at the bottom edge of the bubble body. */
  pointerBaseW: number;
  /**
   * Extra canvas pixels below the pointer tip so the drop-shadow is not clipped.
   * The shadow expands slightly beyond the pointer tip.
   */
  shadowRoom: number;
}

/**
 * Returns bubble padding / radius / pointer values scaled to iconSize.
 * All renderer canvas calculations should import this function so both styles
 * produce visually identical bubbles.
 */
export function getBubbleMetrics(iconSize: number): BubbleMetrics {
  return {
    hPad: Math.max(5, Math.round(iconSize * 0.17)),
    vPad: Math.max(4, Math.round(iconSize * 0.12)),
    radius: Math.max(6, Math.round(iconSize * 0.17)),
    pointerH: Math.max(7, Math.round(iconSize * 0.2)),
    pointerBaseW: Math.max(10, Math.round(iconSize * 0.3)),
    shadowRoom: Math.max(5, Math.round(iconSize * 0.12)),
  };
}

/**
 * Build the canvas path for the bubble body + callout pointer as one unified
 * shape.  The body spans (x, y, w, h); the pointer extends downward from the
 * centre of the body's bottom edge by `pointerH` pixels.
 *
 * @param ctx          Canvas 2D context.
 * @param x            Left edge of bubble body.
 * @param y            Top edge of bubble body.
 * @param w            Width of bubble body.
 * @param h            Height of bubble body (does NOT include pointer).
 * @param radius       Corner radius.
 * @param pointerH     Pointer height in pixels.
 * @param pointerBaseW Pointer base width in pixels.
 */
function buildBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  pointerH: number,
  pointerBaseW: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  const midX = x + w / 2;
  const pHalf = pointerBaseW / 2;
  // Control-point pull: 0.55 gives a gentle concave curve at the pointer base
  const cp = pHalf * 0.55;

  ctx.beginPath();
  // Top edge (left → right) with rounded corners
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  // Right edge
  ctx.lineTo(x + w, y + h - r);
  // Bottom-right corner
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  // Bottom edge right portion → pointer base right
  ctx.lineTo(midX + pHalf, y + h);
  // Pointer right side: concave curve into the tip
  ctx.quadraticCurveTo(midX + cp, y + h, midX, y + h + pointerH);
  // Pointer left side: concave curve back up to base
  ctx.quadraticCurveTo(midX - cp, y + h, midX - pHalf, y + h);
  // Bottom edge left portion ← pointer base left
  ctx.lineTo(x + r, y + h);
  // Bottom-left corner
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  // Left edge
  ctx.lineTo(x, y + r);
  // Top-left corner
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw the bubble background + border into `ctx`.
 *
 * The bubble body covers (x, y, w, h).  A downward-pointing callout pointer
 * extends from the bottom-centre to y + h + pointerH.  Call this BEFORE
 * drawing any content so the content sits on top of the bubble.
 *
 * @param ctx          Canvas 2D context of the widget canvas.
 * @param x            Left edge of bubble body (usually 0).
 * @param y            Top edge of bubble body (usually 0).
 * @param w            Bubble body width  (canvas.width).
 * @param h            Bubble body height (canvas.height − shadowRoom − pointerH).
 * @param radius       Corner radius from getBubbleMetrics.
 * @param pointerH     Pointer height from getBubbleMetrics.
 * @param pointerBaseW Pointer base width from getBubbleMetrics.
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  pointerH: number,
  pointerBaseW: number,
): void {
  const shadowBlur = Math.round(Math.min(w, h) * 0.22);
  const shadowOffsetY = Math.round(Math.min(w, h) * 0.05);

  // ── Fill with drop-shadow (one unified shape) ────────────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = shadowOffsetY;
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  buildBubblePath(ctx, x, y, w, h, radius, pointerH, pointerBaseW);
  ctx.fill();
  ctx.restore();

  // ── Border without shadow ────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 1;
  buildBubblePath(ctx, x, y, w, h, radius, pointerH, pointerBaseW);
  ctx.stroke();
  ctx.restore();
}
