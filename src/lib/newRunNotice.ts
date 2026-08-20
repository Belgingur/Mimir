/**
 * "A newer forecast run is available" pill.
 *
 * Deliberately a prompt rather than a live swap. The timeline's step list comes
 * off the loaded run's manifest, and the persisted scrub position is an ordinal
 * into that list — so exchanging the run underneath a reader would move the hour
 * they are looking at, without them asking. Offering a reload keeps the choice
 * with the reader and costs none of the cache invalidation a live swap needs.
 *
 * Follows the same shape as createDatasetLoadingOverlay: build the DOM once,
 * append to a parent, return a small imperative handle.
 */
export interface NewRunNotice {
  show(): void;
  hide(): void;
  /** True once the reader has dismissed it, so callers can stop asking. */
  isDismissed(): boolean;
}

export function createNewRunNotice(
  parent: HTMLElement,
  opts: {
    /** Resolved on every show() rather than captured once, so a locale switched
     *  after construction still reaches the pill. */
    message: () => string;
    actionLabel: () => string;
    dismissLabel: () => string;
    onAction: () => void;
  },
): NewRunNotice {
  let dismissed = false;

  const root = document.createElement("div");
  root.className = "new-run-notice";
  // polite, not assertive: a new run is worth mentioning, never worth
  // interrupting whatever the reader is doing.
  root.setAttribute("aria-live", "polite");
  root.hidden = true;

  const text = document.createElement("span");
  text.className = "new-run-notice__text";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "new-run-notice__action";
  action.addEventListener("click", opts.onAction);

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "new-run-notice__dismiss";
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", () => {
    // Sticky for the life of the page: a reader who declined once should not be
    // asked again every time they switch back to the tab.
    dismissed = true;
    root.hidden = true;
  });

  root.append(text, action, dismiss);
  parent.appendChild(root);

  return {
    show(): void {
      if (dismissed) return;
      text.textContent = opts.message();
      action.textContent = opts.actionLabel();
      dismiss.setAttribute("aria-label", opts.dismissLabel());
      root.hidden = false;
    },
    hide(): void {
      root.hidden = true;
    },
    isDismissed(): boolean {
      return dismissed;
    },
  };
}
