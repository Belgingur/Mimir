/**
 * Loading / error overlay shown when switching forecast model or analysis
 * (task B2). Sits over the map at a z-index below the edge controls, so the
 * previous frame is dimmed (not frozen) while the edge controls stay usable.
 * The backdrop lets pointer events through so the user can still pan during a
 * load; only the centred card is interactive (needed for the error "back"
 * action).
 */
export interface DatasetLoadingOverlay {
  /** Show the spinner + label. */
  begin(label: string): void;
  /** Hide the overlay. */
  end(): void;
  /** Replace the spinner with an explicit error and an optional way back. */
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

  return {
    begin(label: string): void {
      root.classList.remove("dataset-loader--error");
      clear();
      const spinner = document.createElement("div");
      spinner.className = "dataset-loader__spinner";
      const text = document.createElement("div");
      text.className = "dataset-loader__text";
      text.textContent = label;
      card.append(spinner, text);
      root.hidden = false;
    },
    end(): void {
      root.hidden = true;
      root.classList.remove("dataset-loader--error");
      clear();
    },
    fail({ message, backLabel, onBack }): void {
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
