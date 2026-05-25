export type VisibleViewportRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

export function getVisibleViewportRect(
  mapWrap?: HTMLElement | null,
): VisibleViewportRect {
  const visualViewport = window.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth =
    visualViewport?.width ?? document.documentElement.clientWidth;
  const viewportHeight =
    visualViewport?.height ?? document.documentElement.clientHeight;
  const rect: VisibleViewportRect = {
    left: viewportLeft,
    top: viewportTop,
    right: viewportLeft + viewportWidth,
    bottom: viewportTop + viewportHeight,
    width: viewportWidth,
    height: viewportHeight,
  };

  if (!mapWrap) return rect;

  const mapRect = mapWrap.getBoundingClientRect();
  const left = Math.max(rect.left, mapRect.left);
  const top = Math.max(rect.top, mapRect.top);
  const right = Math.min(rect.right, mapRect.right);
  const bottom = Math.min(rect.bottom, mapRect.bottom);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function getFixedRightInset(
  visibleRight: number,
  safeMargin: number,
): number {
  return Math.max(safeMargin, window.innerWidth - visibleRight + safeMargin);
}
