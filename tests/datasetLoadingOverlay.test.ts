import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatasetLoadingOverlay } from "../src/lib/datasetLoadingOverlay";

describe("dataset loading overlay", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  const root = () => host.querySelector<HTMLElement>(".dataset-loader")!;

  it("starts hidden", () => {
    createDatasetLoadingOverlay(host);
    expect(root().hidden).toBe(true);
  });

  it("shows the weather loop icon and the label while loading", () => {
    const overlay = createDatasetLoadingOverlay(host);
    overlay.begin("Loading BEL-IS…");
    expect(root().hidden).toBe(false);
    expect(root().querySelector("svg.weather-loop.dataset-loader__icon")).not.toBeNull();
    expect(root().querySelector(".dataset-loader__text")?.textContent).toBe(
      "Loading BEL-IS…",
    );
  });

  it("does not stack icons when begin is called again", () => {
    const overlay = createDatasetLoadingOverlay(host);
    overlay.begin("One");
    overlay.begin("Two");
    expect(root().querySelectorAll("svg.weather-loop")).toHaveLength(1);
  });

  it("swaps the icon for the message and a way back on failure", () => {
    const overlay = createDatasetLoadingOverlay(host);
    const onBack = vi.fn();
    overlay.begin("Loading");
    overlay.fail({ message: "No data", backLabel: "Back", onBack });
    expect(root().classList.contains("dataset-loader--error")).toBe(true);
    expect(root().querySelector("svg.weather-loop")).toBeNull();
    root().querySelector<HTMLButtonElement>(".dataset-loader__back")!.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("hides and clears on end", () => {
    const overlay = createDatasetLoadingOverlay(host);
    overlay.begin("Loading");
    overlay.end();
    expect(root().hidden).toBe(true);
    expect(root().querySelector(".dataset-loader__card")?.children).toHaveLength(0);
  });

  describe("with a delay", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("never shows a load that is over before the delay", () => {
      const overlay = createDatasetLoadingOverlay(host);
      const ticket = overlay.begin("Loading Wind…", { delayMs: 200 });
      vi.advanceTimersByTime(150);
      overlay.end(ticket);
      vi.advanceTimersByTime(500);
      expect(root().hidden).toBe(true);
    });

    it("shows a slower load once the delay has passed", () => {
      const overlay = createDatasetLoadingOverlay(host);
      overlay.begin("Loading Wind…", { delayMs: 200 });
      expect(root().hidden).toBe(true);
      vi.advanceTimersByTime(200);
      expect(root().hidden).toBe(false);
      expect(root().querySelector(".dataset-loader__text")?.textContent).toBe(
        "Loading Wind…",
      );
    });

    it("takes the new label at once when it is already showing", () => {
      const overlay = createDatasetLoadingOverlay(host);
      overlay.begin("Loading BEL-IS…");
      overlay.begin("Loading Wind…", { delayMs: 200 });
      expect(root().hidden).toBe(false);
      expect(root().querySelector(".dataset-loader__text")?.textContent).toBe(
        "Loading Wind…",
      );
    });
  });

  it("lets only the latest load hide it", () => {
    const overlay = createDatasetLoadingOverlay(host);
    const first = overlay.begin("Loading Wind…");
    const second = overlay.begin("Loading Precipitation…");
    overlay.end(first);
    expect(root().hidden).toBe(false);
    overlay.end(second);
    expect(root().hidden).toBe(true);
  });

  it("keeps an error up when a load still in flight finishes", () => {
    const overlay = createDatasetLoadingOverlay(host);
    const ticket = overlay.begin("Loading Wind…");
    overlay.fail({ message: "No data" });
    overlay.end(ticket);
    expect(root().hidden).toBe(false);
    expect(root().classList.contains("dataset-loader--error")).toBe(true);
  });
});
