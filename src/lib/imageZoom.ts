/**
 * Pinch-and-pan for a single image, scoped to its own container.
 *
 * The app sets `maximum-scale=1, user-scalable=no` on the viewport so MapLibre
 * owns two-finger gestures on the map. That is the right call for the map and
 * the wrong one for everything else: it also disables zoom inside every modal,
 * which left the spread wavegram — a server-rendered PNG with small axis type —
 * unreadable on a phone with no recourse.
 *
 * Rather than lift the global restriction (which would hand the map's pinch back
 * to the browser), this gives one element its own gesture surface. The container
 * declares `touch-action: none` so it — and only it — receives raw pointer
 * events; the page around it keeps behaving exactly as before.
 *
 * Buttons are wired alongside the gestures because a pinch is not discoverable,
 * and because a mouse has no pinch at all.
 */

/** Zoom bounds. 1 is fit-to-width; 6× is where a 1000px-wide chart's 9px type
 *  becomes comfortably readable on a phone. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
/** Wheel/trackpad sensitivity — a notch is about 10% either way. */
const WHEEL_STEP = 0.0015;
/** What a button press changes the zoom by. */
const BUTTON_STEP = 1.5;

export interface ImageZoomController {
  /** Return to fit-to-width and re-centre. Call when the image changes. */
  reset: () => void;
  /** Remove every listener. */
  destroy: () => void;
}

interface Point {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export function attachImageZoom(
  viewport: HTMLElement,
  image: HTMLImageElement,
  opts: {
    zoomIn?: HTMLElement | null;
    zoomOut?: HTMLElement | null;
    reset?: HTMLElement | null;
    /** Told the current zoom after every change, for a readout. */
    onZoom?: (zoom: number) => void;
  } = {},
): ImageZoomController {
  let zoom = 1;
  let pan: Point = { x: 0, y: 0 };
  const pointers = new Map<number, Point>();
  /** Distance between the two active pointers when the pinch began. */
  let pinchStart: { dist: number; zoom: number; centre: Point } | null = null;
  let panStart: { pointer: Point; pan: Point } | null = null;

  /**
   * Keep the image's edges inside the viewport.
   *
   * At zoom 1 the image exactly fills the width, so there is nothing to pan and
   * the offset is pinned to 0. Beyond that, the pan is bounded by how much of
   * the scaled image overhangs — which is what stops a pinch from flinging the
   * chart off-screen with no way back.
   */
  const clampPan = (next: Point): Point => {
    const rect = viewport.getBoundingClientRect();
    const overhangX = Math.max(0, (rect.width * zoom - rect.width) / 2);
    const overhangY = Math.max(0, (rect.height * zoom - rect.height) / 2);
    return {
      x: clamp(next.x, -overhangX, overhangX),
      y: clamp(next.y, -overhangY, overhangY),
    };
  };

  const apply = (): void => {
    pan = clampPan(pan);
    image.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    viewport.dataset.zoom = zoom.toFixed(2);
    viewport.classList.toggle("is-zoomed", zoom > 1.001);
    opts.onZoom?.(zoom);
  };

  /**
   * Zoom about a fixed point, so the pixel under the fingers (or cursor) stays
   * under them. Zooming about the centre instead makes the thing you were
   * looking at drift away, which is the difference between a usable magnifier
   * and a frustrating one.
   */
  const zoomAbout = (next: number, anchor: Point): void => {
    const rect = viewport.getBoundingClientRect();
    const clamped = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (clamped === zoom) return;
    const cx = anchor.x - rect.left - rect.width / 2;
    const cy = anchor.y - rect.top - rect.height / 2;
    const ratio = clamped / zoom;
    pan = { x: cx - (cx - pan.x) * ratio, y: cy - (cy - pan.y) * ratio };
    zoom = clamped;
    if (zoom <= MIN_ZOOM + 0.001) pan = { x: 0, y: 0 };
    apply();
  };

  const centreOfViewport = (): Point => {
    const rect = viewport.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const distance = (a: Point, b: Point): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const midpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const onPointerDown = (e: PointerEvent): void => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported */
    }
    const pts = [...pointers.values()];
    if (pts.length === 2) {
      panStart = null;
      pinchStart = {
        dist: distance(pts[0], pts[1]),
        zoom,
        centre: midpoint(pts[0], pts[1]),
      };
    } else if (pts.length === 1 && zoom > 1.001) {
      // Only claim the drag once there is something to pan; at fit-to-width a
      // drag should still scroll the modal behind.
      panStart = { pointer: pts[0], pan: { ...pan } };
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];
    if (pts.length >= 2 && pinchStart) {
      const dist = distance(pts[0], pts[1]);
      if (pinchStart.dist > 0) {
        zoomAbout(
          pinchStart.zoom * (dist / pinchStart.dist),
          midpoint(pts[0], pts[1]),
        );
      }
      e.preventDefault();
      return;
    }
    if (pts.length === 1 && panStart) {
      pan = {
        x: panStart.pan.x + (pts[0].x - panStart.pointer.x),
        y: panStart.pan.y + (pts[0].y - panStart.pointer.y),
      };
      apply();
      e.preventDefault();
    }
  };

  const endPointer = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch {
      /* unsupported */
    }
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) panStart = null;
  };

  const onWheel = (e: WheelEvent): void => {
    // Trackpad pinch arrives as ctrl+wheel; a plain wheel should still scroll
    // the modal unless the image is already magnified.
    if (!e.ctrlKey && zoom <= MIN_ZOOM + 0.001) return;
    e.preventDefault();
    zoomAbout(zoom * (1 - e.deltaY * WHEEL_STEP), {
      x: e.clientX,
      y: e.clientY,
    });
  };

  const onDoubleClick = (e: MouseEvent): void => {
    e.preventDefault();
    if (zoom > MIN_ZOOM + 0.001) {
      zoom = MIN_ZOOM;
      pan = { x: 0, y: 0 };
      apply();
    } else {
      zoomAbout(2.5, { x: e.clientX, y: e.clientY });
    }
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("dblclick", onDoubleClick);

  const step = (factor: number) => () =>
    zoomAbout(zoom * factor, centreOfViewport());
  const zoomIn = step(BUTTON_STEP);
  const zoomOut = step(1 / BUTTON_STEP);
  const reset = (): void => {
    zoom = MIN_ZOOM;
    pan = { x: 0, y: 0 };
    apply();
  };

  opts.zoomIn?.addEventListener("click", zoomIn);
  opts.zoomOut?.addEventListener("click", zoomOut);
  opts.reset?.addEventListener("click", reset);

  apply();

  return {
    reset,
    destroy: () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endPointer);
      viewport.removeEventListener("pointercancel", endPointer);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("dblclick", onDoubleClick);
      opts.zoomIn?.removeEventListener("click", zoomIn);
      opts.zoomOut?.removeEventListener("click", zoomOut);
      opts.reset?.removeEventListener("click", reset);
    },
  };
}
