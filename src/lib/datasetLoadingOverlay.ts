/**
 * Loading / error overlay shown when switching forecast model, analysis or
 * layer (task B2). Sits over the map at a z-index below the edge controls, so
 * the previous frame is dimmed (not frozen) while the edge controls stay usable.
 * The backdrop lets pointer events through so the user can still pan during a
 * load; only the centred card is interactive (needed for the error "back"
 * action).
 */
import { createWeatherLoopIcon } from "./weatherLoopIcon";

export interface DatasetLoadingOverlay {
  /**
   * Show the animated weather icon + label, and return a ticket for `end`.
   *
   * `delayMs` holds the overlay back while it is hidden, so a load that is
   * over at once (a layer whose frame is cached) never flashes it. An overlay
   * already on screen just takes the new label.
   */
  begin(label: string, opts?: { delayMs?: number }): number;
  /**
   * Hide the overlay. With a ticket, only when that load is still the latest:
   * a slow load that finishes after the reader has moved on must not hide the
   * loader of the one they moved on to.
   */
  end(ticket?: number): void;
  /** Replace the icon with an explicit error and an optional way back. */
  fail(opts: { message: string; backLabel?: string; onBack?: () => void }): void;
}

export function createDatasetLoadingOverlay(
  parent: HTMLElement,
): DatasetLoadingOverlay {
  const root = document.createElement("div");
  root.className = "dataset-loader";
  root.setAttribute("aria-live", "polite");
  root.hidden = true;

  const card = document.createElement("div");
  card.className = "dataset-loader__card";
  root.appendChild(card);
  parent.appendChild(root);

  const clear = () => {
    card.replaceChildren();
  };

  let latest = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const cancelPending = () => {
    clearTimeout(pending);
    pending = undefined;
  };

  const show = (label: string) => {
    root.classList.remove("dataset-loader--error");
    clear();
    const icon = createWeatherLoopIcon();
    icon.classList.add("dataset-loader__icon");
    const text = document.createElement("div");
    text.className = "dataset-loader__text";
    text.textContent = label;
    card.append(icon, text);
    root.hidden = false;
  };

  return {
    begin(label: string, opts?: { delayMs?: number }): number {
      const ticket = ++latest;
      cancelPending();
      const delayMs = opts?.delayMs ?? 0;
      if (delayMs > 0 && root.hidden) {
        pending = setTimeout(() => {
          pending = undefined;
          show(label);
        }, delayMs);
      } else {
        show(label);
      }
      return ticket;
    },
    end(ticket?: number): void {
      if (ticket !== undefined && ticket !== latest) return;
      cancelPending();
      root.hidden = true;
      root.classList.remove("dataset-loader--error");
      clear();
    },
    fail({ message, backLabel, onBack }): void {
      // An error outranks any load still in flight: its end() must not clear it.
      latest++;
      cancelPending();
      root.classList.add("dataset-loader--error");
      clear();
      const text = document.createElement("div");
      text.className = "dataset-loader__text";
      text.textContent = message;
      card.appendChild(text);
      if (backLabel && onBack) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dataset-loader__back";
        btn.textContent = backLabel;
        btn.addEventListener("click", onBack);
        card.appendChild(btn);
      }
      root.hidden = false;
    },
  };
}
