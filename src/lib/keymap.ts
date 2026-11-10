/**
 * Mímir's own keyboard shortcuts: a table from keys to actions, and one
 * listener that runs them.
 *
 * The listener is on `window` in the capture phase, so it sees a key before
 * anything on the page does, MapLibre's keyboard handler included (that one
 * listens on the map's container and would otherwise pan the map on the same
 * arrow press). A key Mímir acts on stops there.
 *
 * A key typed into a field is left alone, and so is one aimed at a control
 * that uses the arrows itself (a slider, say), wherever it is: the origin is
 * read from `composedPath()[0]`, which sees through shadow roots such as the
 * meteogram widget's, where `event.target` only names the widget's host.
 */

export type KeyAction = "timeline.stepBack" | "timeline.stepForward";

/** Key (`KeyboardEvent.key`) to action. Only ← and → so far. */
export const KEYMAP: Readonly<Record<string, KeyAction>> = {
  ArrowLeft: "timeline.stepBack",
  ArrowRight: "timeline.stepForward",
};

// Inputs whose arrow keys do nothing for the field itself.
const BUTTON_LIKE_INPUTS = new Set(["button", "checkbox", "reset", "submit", "image", "hidden"]);

// ARIA widgets that move their own selection or value with the arrow keys.
const ARROW_KEY_ROLES = [
  "slider",
  "spinbutton",
  "listbox",
  "combobox",
  "menu",
  "menubar",
  "radiogroup",
  "tablist",
  "tree",
  "treegrid",
  "grid",
];
const ARROW_KEY_SELECTOR = [
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  "textarea",
  "select",
  ...ARROW_KEY_ROLES.map((role) => `[role="${role}"]`),
].join(", ");

/** True when `target` (or an ancestor in its own tree) uses arrow keys itself:
 *  a text field, a select, an editable region or an arrow-driven ARIA widget. */
export function handlesOwnArrowKeys(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  const input = target.closest("input");
  if (input) return !BUTTON_LIKE_INPUTS.has((input.type || "text").toLowerCase());
  return target.closest(ARROW_KEY_SELECTOR) !== null;
}

/** The element a key event really came from, inside any shadow root. */
export function keyOrigin(event: Event): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}

/** The action for this key press, or null when Mímir should leave it alone. */
export function keyAction(
  event: KeyboardEvent,
  keymap: Readonly<Record<string, KeyAction>> = KEYMAP,
): KeyAction | null {
  if (event.defaultPrevented) return null;
  // Ctrl, Alt and Cmd with an arrow are the browser's (history, word jumps).
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const action = Object.hasOwn(keymap, event.key) ? keymap[event.key] : null;
  if (!action) return null;
  return handlesOwnArrowKeys(keyOrigin(event)) ? null : action;
}

/**
 * Listen for the keymap's keys on `win`, in the capture phase. `run` performs
 * an action and returns true when it did; the key is then consumed (default
 * prevented, propagation stopped), so nothing else acts on it. When `run`
 * returns false the key goes on as if Mímir weren't listening.
 */
export function listenForKeyActions(
  win: Window,
  run: (action: KeyAction) => boolean,
  keymap: Readonly<Record<string, KeyAction>> = KEYMAP,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const action = keyAction(event, keymap);
    if (!action || !run(action)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  win.addEventListener("keydown", onKeyDown, { capture: true });
  return () => win.removeEventListener("keydown", onKeyDown, { capture: true });
}
