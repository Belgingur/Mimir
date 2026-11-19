/**
 * Folding the legend away. A click or tap on the legend folds it into a small
 * button showing the current layer's icon; the button brings it back. The
 * legend itself looks exactly as before: no extra control on it.
 *
 * The legend card can also be dragged with a mouse (legendDrag), and the
 * browser fires a click at the end of a drag, so a press that moved more than
 * a few pixels is a drag, not a click.
 *
 * On touch screens the open legend lets every touch through to the map (so a
 * pan can start on it), so a tap on it arrives as a map click instead; the
 * map's click handler hands it here first (foldIfOver).
 *
 * Folded is the default: a first visit sees the button, and opening the legend
 * is remembered per browser.
 *
 * Folding puts the card back in its corner: the open legend can be dragged
 * around, but folding (and opening again) always starts from the default spot.
 *
 * Keyboard: the open card is focusable, and Enter or Space folds it; focus
 * then moves to the tab, and from the tab back to the card when it opens.
 */
import { DRAG_SLOP_PX } from "./legendDrag";

const STORAGE_KEY = "mimir-legend-collapsed";

function readCollapsed(): boolean {
  try {
    // "0" only once the reader has opened it; folded otherwise.
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the toggle still works for this visit.
  }
}

export interface LegendCollapse {
  /** Fold the open legend if this screen point is on it. True if it was. */
  foldIfOver(clientX: number, clientY: number): boolean;
}

export function setupLegendCollapse(card: HTMLElement): LegendCollapse | null {
  const expand = card.querySelector<HTMLButtonElement>(".legend-expand");
  if (!expand) return null;

  const apply = (collapsed: boolean) => {
    card.classList.toggle("is-collapsed", collapsed);
    // Folded, the card is only the tab: the tab is what takes focus.
    card.tabIndex = collapsed ? -1 : 0;
  };

  const set = (collapsed: boolean) => {
    // Back to the CSS-defined corner (legendDrag writes inline left/top).
    card.style.left = "";
    card.style.top = "";
    card.style.right = "";
    card.style.bottom = "";
    card.style.transform = "";
    apply(collapsed);
    writeCollapsed(collapsed);
  };

  apply(readCollapsed());

  let downX = 0;
  let downY = 0;
  card.addEventListener("pointerdown", (event) => {
    downX = event.clientX;
    downY = event.clientY;
  });

  card.addEventListener("click", (event) => {
    // Enter or Space on the tab clicks it with no pointer behind it
    // (detail 0, and a position of 0,0): never the end of a drag.
    const fromPointer = event.detail !== 0;
    if (
      fromPointer &&
      (Math.abs(event.clientX - downX) > DRAG_SLOP_PX ||
        Math.abs(event.clientY - downY) > DRAG_SLOP_PX)
    ) {
      return; // the end of a drag
    }
    if (card.classList.contains("is-collapsed")) {
      // Only the tab opens it; the folded card is nothing but the tab.
      if ((event.target as Element | null)?.closest(".legend-expand")) {
        set(false);
        // Enter or Space on the tab (a click with no pointer behind it):
        // keep the focus on the legend rather than losing it with the tab.
        if (event.detail === 0) card.focus({ preventScroll: true });
      }
      return;
    }
    set(true);
  });

  card.addEventListener("keydown", (event) => {
    if (event.target !== card || card.classList.contains("is-collapsed")) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    set(true);
    expand.focus({ preventScroll: true });
  });

  return {
    foldIfOver(clientX, clientY) {
      if (card.classList.contains("is-collapsed")) return false;
      // Hidden (iconography view, or no legend yet): nothing to tap.
      if (!card.offsetParent) return false;
      const r = card.getBoundingClientRect();
      if (
        clientX < r.left ||
        clientX > r.right ||
        clientY < r.top ||
        clientY > r.bottom
      ) {
        return false;
      }
      set(true);
      return true;
    },
  };
}
