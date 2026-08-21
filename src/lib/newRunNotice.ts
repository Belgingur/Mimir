/**
 * "A newer forecast run is available" pill.
 *
 * Deliberately a prompt rather than an automatic swap. Accepting it refreshes
 * only the forecast catalog and active layers; the controller keeps the map
 * alive and matches the reader's current absolute time to the nearest step in
 * the new run.
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
