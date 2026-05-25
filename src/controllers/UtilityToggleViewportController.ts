import {
  getFixedRightInset,
  getVisibleViewportRect,
} from "../lib/visibleViewport";

export interface UtilityToggleViewportControllerDeps {
  readonly element: HTMLElement | null;
  readonly mapWrap: HTMLElement;
  readonly safeMargin: number;
}

export class UtilityToggleViewportController {
  private cleanups: Array<() => void> = [];
  private landscapeMq = window.matchMedia(
    "(max-height: 500px) and (orientation: landscape)",
  );

  constructor(private readonly deps: UtilityToggleViewportControllerDeps) {}

  init(): void {
    const { element } = this.deps;
    if (!element) return;

    const sync = () => this.sync();
    sync();

    window.addEventListener("resize", sync);
    this.cleanups.push(() => window.removeEventListener("resize", sync));

    // orientationchange fires before the resize event on some devices, ensuring
    // the toggle repositions correctly even if resize fires before layout settles.
    window.addEventListener("orientationchange", sync);
    this.cleanups.push(() =>
      window.removeEventListener("orientationchange", sync),
    );

    this.landscapeMq.addEventListener("change", sync);
    this.cleanups.push(() =>
      this.landscapeMq.removeEventListener("change", sync),
    );

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", sync);
      visualViewport.addEventListener("scroll", sync);
      this.cleanups.push(() => {
        visualViewport.removeEventListener("resize", sync);
        visualViewport.removeEventListener("scroll", sync);
      });
    }
  }

  destroy(): void {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
  }

  sync(): void {
    const { element, mapWrap, safeMargin } = this.deps;
    if (!element) return;

    if (this.landscapeMq.matches) {
      element.style.right = "";
      return;
    }

    // Clear inline right before reading computed style so we get the CSS value, not a stale override
    element.style.right = "";
    const visibleViewport = getVisibleViewportRect(mapWrap);
    const computedRight = Number.parseFloat(
      window.getComputedStyle(element).right,
    );
    const baseRightInset = Number.isFinite(computedRight)
      ? computedRight
      : safeMargin;
    const inset = Math.round(
      getFixedRightInset(visibleViewport.right, baseRightInset),
    );
    element.style.right = `${inset}px`;
    element.dataset.viewportRightInset = String(inset);
    element.dataset.viewportBaseRightInset = String(baseRightInset);
    element.dataset.visibleViewportRight = visibleViewport.right.toFixed(2);
    element.dataset.visualViewportWidth = String(
      window.visualViewport?.width ?? "",
    );
    element.dataset.visualViewportOffsetLeft = String(
      window.visualViewport?.offsetLeft ?? "",
    );
  }
}
