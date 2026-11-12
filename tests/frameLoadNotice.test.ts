import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatasetLoadingOverlay } from "../src/lib/datasetLoadingOverlay";
import { createFrameLoadNotice } from "../src/lib/frameLoadNotice";

describe("frame load notice", () => {
  let host: HTMLDivElement;
  let reloadFrames: ReturnType<typeof vi.fn<() => Promise<void>>>;

  const setup = () => {
    const overlay = createDatasetLoadingOverlay(host);
    const notice = createFrameLoadNotice({
      overlay,
      reloadFrames,
      errorText: () => "Couldn't load the forecast.",
      retryLabel: () => "Try again",
      retryingText: () => "Loading the forecast…",
    });
    return { overlay, notice };
  };

  const root = () => host.querySelector<HTMLElement>(".dataset-loader")!;
  const text = () =>
    root().querySelector(".dataset-loader__text")?.textContent ?? null;
  const button = () =>
    root().querySelector<HTMLButtonElement>(".dataset-loader__back");
  const isError = () =>
    !root().hidden && root().classList.contains("dataset-loader--error");
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    host = document.createElement("div");
    document.body.appendChild(host);
    reloadFrames = vi.fn<() => Promise<void>>(async () => {});
  });

  describe("a load that showed the loader (a model, layer or run switch)", () => {
    it("hides the loader when its frame came", () => {
      const { overlay, notice } = setup();
      const ticket = overlay.begin("Loading BEL-IS…");
      notice.frameLoadEnded(false);
      // The frame's report alone leaves the loader to the load that showed it.
      expect(text()).toBe("Loading BEL-IS…");
      notice.loadEnded(ticket);
      expect(root().hidden).toBe(true);
    });

    it("puts the error and Retry in the loader's place when its frame failed", () => {
      const { overlay, notice } = setup();
      const ticket = overlay.begin("Loading BEL-IS…");
      notice.frameLoadEnded(true);
      expect(isError()).toBe(true);
      expect(text()).toBe("Couldn't load the forecast.");
      expect(button()?.textContent).toBe("Try again");
      // The switch ending afterwards leaves the error where it is…
      notice.loadEnded(ticket);
      expect(isError()).toBe(true);
      // …with or without a ticket.
      notice.loadEnded();
      expect(isError()).toBe(true);
      expect(button()?.textContent).toBe("Try again");
    });

    it("keeps the error when the switch ends while a newer frame load is under way", () => {
      // A switch's frame load is followed by another (the timeline's time
      // sync). That one has started and not ended: it doesn't count yet.
      const { overlay, notice } = setup();
      overlay.begin("Loading the forecast…");
      notice.frameLoadEnded(true);
      expect(notice.framesFailed()).toBe(true);
      notice.loadEnded();
      expect(isError()).toBe(true);
      // The newer load ends with the frame: now the error goes.
      notice.frameLoadEnded(false);
      expect(notice.framesFailed()).toBe(false);
      expect(root().hidden).toBe(true);
    });

    it("leaves a newer load's loader alone when an older load ends", () => {
      const { overlay, notice } = setup();
      const older = overlay.begin("Loading Precipitation…");
      overlay.begin("Loading BEL-IS…");
      notice.loadEnded(older);
      expect(root().hidden).toBe(false);
      expect(text()).toBe("Loading BEL-IS…");
    });
  });

  describe("Retry", () => {
    it("loads the frames again, and hides when they came", async () => {
      const { notice } = setup();
      notice.frameLoadEnded(true);

      let finish!: () => void;
      reloadFrames.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      button()!.click();
      // The loader shows while the frames load again.
      expect(isError()).toBe(false);
      expect(text()).toBe("Loading the forecast…");
      expect(reloadFrames).toHaveBeenCalledTimes(1);

      notice.frameLoadEnded(false);
      finish();
      await settle();
      expect(root().hidden).toBe(true);
    });

    it("shows the error again when the frames failed again", async () => {
      const { notice } = setup();
      notice.frameLoadEnded(true);
      reloadFrames.mockImplementationOnce(async () => {
        notice.frameLoadEnded(true);
      });
      button()!.click();
      await settle();
      expect(isError()).toBe(true);
      expect(button()?.textContent).toBe("Try again");
    });

    it("shows the error again when there was nothing to load", async () => {
      const { notice } = setup();
      notice.frameLoadEnded(true);
      button()!.click();
      await settle();
      expect(reloadFrames).toHaveBeenCalledTimes(1);
      expect(isError()).toBe(true);
    });
  });

  describe("a load with no loader of its own (a step on the timeline)", () => {
    it("shows the error when the step's frame failed", () => {
      const { notice } = setup();
      notice.frameLoadEnded(true);
      expect(isError()).toBe(true);
      expect(button()?.textContent).toBe("Try again");
    });

    it("takes the error away when a later step's frame came", () => {
      const { notice } = setup();
      notice.frameLoadEnded(true);
      notice.frameLoadEnded(false);
      expect(root().hidden).toBe(true);
    });

    it("leaves a loader alone: one shown since the error, or with no error at all", () => {
      const { overlay, notice } = setup();
      overlay.begin("Loading BEL-IS…");
      notice.frameLoadEnded(false);
      expect(text()).toBe("Loading BEL-IS…");

      notice.frameLoadEnded(true);
      overlay.begin("Loading GFS…");
      notice.frameLoadEnded(false);
      expect(root().hidden).toBe(false);
      expect(text()).toBe("Loading GFS…");
    });
  });
});
