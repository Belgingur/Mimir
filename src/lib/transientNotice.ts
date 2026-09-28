/**
 * A brief, self-clearing message for an action that was declined.
 *
 * Refusing a click is only an improvement over letting it fail if the refusal
 * is visible: a tap that opens nothing and says nothing reads as a broken map,
 * which is worse than the error it replaced. This is the smallest thing that
 * closes that loop — it appears where the "new run" pill appears, says one
 * sentence, and takes itself away.
 *
 * Deliberately not dismissible and not interactive. It reports something the
 * reader already caused and can already undo by clicking somewhere else, so a
 * close button would be one more thing to aim at for no benefit.
 */
export interface TransientNotice {
  show(message: string): void;
  hide(): void;
  destroy(): void;
}

/** Long enough to read one sentence, short enough not to linger over the map. */
const DEFAULT_DURATION_MS = 2600;

export function createTransientNotice(
  parent: HTMLElement,
  opts: { durationMs?: number } = {},
): TransientNotice {
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;

  const root = document.createElement("div");
  root.className = "new-run-notice transient-notice";
  // polite: it follows an action the reader just took, so it should join the
  // queue rather than interrupt whatever a screen reader is saying.
  root.setAttribute("aria-live", "polite");
  root.hidden = true;

  const text = document.createElement("span");
  text.className = "new-run-notice__text";
  root.appendChild(text);
  parent.appendChild(root);

  let timer: number | null = null;
  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const hide = (): void => {
    clearTimer();
    root.hidden = true;
  };

  return {
    show(message: string): void {
      if (!message) return hide();
      // Re-showing restarts the clock rather than stacking pills: repeated
      // clicks on the same dead water should read as one answer, not a queue.
      clearTimer();
      text.textContent = message;
      root.hidden = false;
      timer = window.setTimeout(hide, duration);
    },
    hide,
    destroy(): void {
      clearTimer();
      root.remove();
    },
  };
}
