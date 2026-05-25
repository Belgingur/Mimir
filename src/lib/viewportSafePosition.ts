export interface ViewportRectLike {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface ViewportShift {
  readonly x: number;
  readonly y: number;
}

const ZERO_SHIFT: ViewportShift = { x: 0, y: 0 };

export function normalizeViewportPadding(
  padding: number | Partial<ViewportPadding> = 8,
): ViewportPadding {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  };
}

export function computeViewportSafeShift(
  rect: ViewportRectLike,
  bounds: ViewportRectLike,
  padding: number | Partial<ViewportPadding> = 8,
): ViewportShift {
  if (rect.width <= 0 || rect.height <= 0) return ZERO_SHIFT;

  const inset = normalizeViewportPadding(padding);
  const minLeft = bounds.left + inset.left;
  const maxRight = bounds.right - inset.right;
  const minTop = bounds.top + inset.top;
  const maxBottom = bounds.bottom - inset.bottom;
  const availableWidth = Math.max(0, maxRight - minLeft);
  const availableHeight = Math.max(0, maxBottom - minTop);

  let x = 0;
  if (rect.width > availableWidth) {
    x = minLeft - rect.left;
  } else if (rect.left < minLeft) {
    x = minLeft - rect.left;
  } else if (rect.right > maxRight) {
    x = maxRight - rect.right;
  }

  let y = 0;
  if (rect.height > availableHeight) {
    y = minTop - rect.top;
  } else if (rect.top < minTop) {
    y = minTop - rect.top;
  } else if (rect.bottom > maxBottom) {
    y = maxBottom - rect.bottom;
  }

  return { x, y };
}
