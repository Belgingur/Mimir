import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupLegendCollapse } from "../src/lib/legendCollapse";

beforeAll(() => {
  // jsdom has no PointerEvent (same stand-in as legendDrag.test.ts).
  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit & MouseEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    } as unknown as typeof PointerEvent;
  }
});

const KEY = "mimir-legend-collapsed";

function makeCard() {
  const card = document.createElement("div");
  card.className = "legend-stack-card";
  card.innerHTML = `
    <button type="button" class="legend-expand"><span class="legend-expand__icon"></span></button>
    <div class="legend-host"><div class="precip-legend">°C</div></div>`;
  document.body.appendChild(card);
  // jsdom has no layout: give the card a box and a parent to be shown in.
  Object.defineProperty(card, "offsetParent", {
    configurable: true,
    get: () => document.body,
  });
  card.getBoundingClientRect = () =>
    ({ left: 12, top: 400, right: 72, bottom: 820 }) as DOMRect;
  const expand = card.querySelector<HTMLButtonElement>(".legend-expand")!;
  const scale = card.querySelector<HTMLElement>(".precip-legend")!;
  return { card, expand, scale };
}

/** A press and release at one point, then the click the browser sends. */
function clickAt(target: HTMLElement, x: number, y: number, upX = x, upY = y) {
  target.dispatchEvent(
    new PointerEvent("pointerdown", { clientX: x, clientY: y, bubbles: true }),
  );
  target.dispatchEvent(
    new MouseEvent("click", {
      clientX: upX,
      clientY: upY,
      bubbles: true,
      detail: 1,
    }),
  );
}

const folded = (card: HTMLElement) => card.classList.contains("is-collapsed");

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("the legend's starting state", () => {
  it("starts folded on a first visit", () => {
    const { card } = makeCard();
    setupLegendCollapse(card);
    expect(folded(card)).toBe(true);
  });

  it("starts open once the reader has opened it", () => {
    localStorage.setItem(KEY, "0");
    const { card } = makeCard();
    setupLegendCollapse(card);
    expect(folded(card)).toBe(false);
  });

  it("starts folded when storage can't be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { card } = makeCard();
    setupLegendCollapse(card);
    expect(folded(card)).toBe(true);
  });

  it("does nothing without its tab", () => {
    const card = document.createElement("div");
    expect(setupLegendCollapse(card)).toBeNull();
  });
});

describe("folding and opening with a click", () => {
  it("opens from the tab and remembers it", () => {
    const { card, expand } = makeCard();
    setupLegendCollapse(card);
    clickAt(expand, 30, 800);
    expect(folded(card)).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("0");
  });

  it("folds on a click on the open legend and remembers it", () => {
    localStorage.setItem(KEY, "0");
    const { card, scale } = makeCard();
    setupLegendCollapse(card);
    clickAt(scale, 40, 600);
    expect(folded(card)).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("1");
  });

  it("doesn't fold at the end of a drag", () => {
    localStorage.setItem(KEY, "0");
    const { card, scale } = makeCard();
    setupLegendCollapse(card);
    clickAt(scale, 40, 600, 140, 520);
    expect(folded(card)).toBe(false);
  });

  it("still folds when the press wobbled by a few pixels", () => {
    localStorage.setItem(KEY, "0");
    const { card, scale } = makeCard();
    setupLegendCollapse(card);
    clickAt(scale, 40, 600, 43, 598);
    expect(folded(card)).toBe(true);
  });

  it("puts a dragged legend back in its corner when it folds", () => {
    localStorage.setItem(KEY, "0");
    const { card, scale } = makeCard();
    setupLegendCollapse(card);
    Object.assign(card.style, {
      left: "412px",
      top: "264px",
      right: "auto",
      bottom: "auto",
      transform: "none",
    });
    clickAt(scale, 440, 400);
    expect(card.style.left).toBe("");
    expect(card.style.top).toBe("");
    expect(card.style.right).toBe("");
    expect(card.style.bottom).toBe("");
    expect(card.style.transform).toBe("");
  });

  it("keeps working when storage can't be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { card, expand } = makeCard();
    setupLegendCollapse(card);
    clickAt(expand, 30, 800);
    expect(folded(card)).toBe(false);
  });
});

describe("the keyboard", () => {
  it("makes only the open legend focusable", () => {
    const { card, expand } = makeCard();
    setupLegendCollapse(card);
    expect(card.tabIndex).toBe(-1);
    clickAt(expand, 30, 800);
    expect(card.tabIndex).toBe(0);
  });

  it("folds the focused legend on Enter or Space and focuses the tab", () => {
    for (const key of ["Enter", " "]) {
      localStorage.setItem(KEY, "0");
      const { card, expand } = makeCard();
      setupLegendCollapse(card);
      card.focus();
      card.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      expect(folded(card)).toBe(true);
      expect(document.activeElement).toBe(expand);
      document.body.innerHTML = "";
    }
  });

  it("moves the focus to the legend when the tab is opened from the keyboard", () => {
    const { card, expand } = makeCard();
    setupLegendCollapse(card);
    // A mouse press somewhere on the card earlier: a keyboard click (at 0,0)
    // must not be taken for the end of a drag from there.
    card.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 40, clientY: 600, bubbles: true }),
    );
    expand.focus();
    // Enter or Space on a button: a click with no pointer behind it.
    expand.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(folded(card)).toBe(false);
    expect(document.activeElement).toBe(card);
  });
});

describe("a tap that reaches the map (touch screens)", () => {
  it("folds the open legend when it lands on it", () => {
    localStorage.setItem(KEY, "0");
    const { card } = makeCard();
    const legend = setupLegendCollapse(card)!;
    expect(legend.foldIfOver(40, 600)).toBe(true);
    expect(folded(card)).toBe(true);
  });

  it("leaves taps beside the legend to the map", () => {
    localStorage.setItem(KEY, "0");
    const { card } = makeCard();
    const legend = setupLegendCollapse(card)!;
    expect(legend.foldIfOver(200, 600)).toBe(false);
    expect(legend.foldIfOver(40, 300)).toBe(false);
    expect(folded(card)).toBe(false);
  });

  it("leaves every tap to the map while the legend is folded", () => {
    const { card } = makeCard();
    const legend = setupLegendCollapse(card)!;
    expect(legend.foldIfOver(40, 600)).toBe(false);
  });

  it("leaves every tap to the map while the legend is hidden", () => {
    localStorage.setItem(KEY, "0");
    const { card } = makeCard();
    Object.defineProperty(card, "offsetParent", { get: () => null });
    const legend = setupLegendCollapse(card)!;
    expect(legend.foldIfOver(40, 600)).toBe(false);
  });
});
