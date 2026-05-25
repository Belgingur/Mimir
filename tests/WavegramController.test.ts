import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WavegramController,
  WavegramDomRefs,
  WavegramControllerDeps,
} from "../src/controllers/WavegramController";

function makeEl<T extends HTMLElement>(
  tag: string,
  overrides: Record<string, unknown> = {},
): T {
  const el = document.createElement(tag) as T;
  Object.assign(el, overrides);
  return el;
}

function makeDom(): WavegramDomRefs {
  return {
    modal: makeEl<HTMLDivElement>("div"),
    close: makeEl<HTMLButtonElement>("button"),
    subtitle: makeEl<HTMLDivElement>("div"),
    status: makeEl<HTMLDivElement>("div"),
    durationSelect: (() => {
      const sel = makeEl<HTMLSelectElement>("select");
      const opt = document.createElement("option");
      opt.value = "120";
      sel.appendChild(opt);
      sel.value = "120";
      return sel;
    })(),
    techToggle: (() => {
      const inp = makeEl<HTMLInputElement>("input");
      inp.type = "checkbox";
      inp.checked = false;
      return inp;
    })(),
    image: makeEl<HTMLImageElement>("img"),
    download: makeEl<HTMLButtonElement>("button"),
    print: makeEl<HTMLButtonElement>("button"),
  };
}

function makeDeps(
  overrides: Partial<WavegramControllerDeps> = {},
): WavegramControllerDeps {
  return {
    dom: makeDom(),
    getBaseUrl: () => "https://wod.test",
    isDev: false,
    scheduleUpdateLayers: vi.fn(),
    ...overrides,
  };
}

describe("WavegramController", () => {
  let deps: WavegramControllerDeps;
  let controller: WavegramController;

  beforeEach(() => {
    deps = makeDeps();
    controller = new WavegramController(deps);
  });

  it("starts closed with no coordinate", () => {
    expect(controller.isOpen).toBe(false);
    expect(controller.isLoading).toBe(false);
    expect(controller.activeCoord).toBeNull();
  });

  describe("open", () => {
    it("marks the modal as open and sets loading", () => {
      controller.open([10, 65]);
      expect(controller.isOpen).toBe(true);
      expect(controller.isLoading).toBe(true);
      expect(controller.activeCoord).toEqual([10, 65]);
    });

    it("sets subtitle text with coord and duration", () => {
      controller.open([-20.5, 63.123]);
      expect(deps.dom.subtitle.textContent).toContain("63.123");
      expect(deps.dom.subtitle.textContent).toContain("-20.500");
      expect(deps.dom.subtitle.textContent).toContain("120 hours");
    });

    it("sets aria-hidden to false", () => {
      controller.open([10, 65]);
      expect(deps.dom.modal.getAttribute("aria-hidden")).toBe("false");
    });

    it("disables download and print while loading", () => {
      controller.open([10, 65]);
      expect(deps.dom.download.disabled).toBe(true);
      expect(deps.dom.print.disabled).toBe(true);
    });

    it("sets the image src to a wavegram URL", () => {
      controller.open([10, 65]);
      expect(deps.dom.image.src).toContain("spread_wavegram");
      expect(deps.dom.image.src).toContain("65.000");
      expect(deps.dom.image.src).toContain("10.000");
    });

    it("shows an unconfigured message when no base URL is provided", () => {
      const unconfiguredDeps = makeDeps({ getBaseUrl: () => "" });
      const unconfiguredCtrl = new WavegramController(unconfiguredDeps);

      unconfiguredCtrl.open([10, 65]);

      expect(unconfiguredCtrl.isOpen).toBe(true);
      expect(unconfiguredCtrl.isLoading).toBe(false);
      expect(unconfiguredDeps.dom.status.textContent).toContain(
        "Wavegram service is not configured",
      );
      expect(unconfiguredDeps.dom.image.getAttribute("src")).toBe("");
      expect(unconfiguredDeps.dom.download.disabled).toBe(true);
      expect(unconfiguredDeps.dom.print.disabled).toBe(true);

      unconfiguredCtrl.destroy();
    });

    it("calls scheduleUpdateLayers on open", () => {
      controller.open([10, 65]);
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });

    it("logs URL in dev mode", () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const devDeps = makeDeps({ isDev: true });
      const devCtrl = new WavegramController(devDeps);
      devCtrl.open([10, 65]);
      expect(debugSpy).toHaveBeenCalledWith("Opening wavegram for model GWES");
      expect(debugSpy).toHaveBeenCalledWith(
        "wavegram url",
        expect.stringContaining("spread_wavegram"),
      );
      debugSpy.mockRestore();
      devCtrl.destroy();
    });
  });

  describe("image load callbacks", () => {
    it("clears loading on image load", () => {
      controller.open([10, 65]);
      expect(controller.isLoading).toBe(true);
      deps.dom.image.onload?.(new Event("load") as any);
      expect(controller.isLoading).toBe(false);
      expect(deps.dom.download.disabled).toBe(false);
      expect(deps.dom.print.disabled).toBe(false);
    });

    it("sets error on image error", () => {
      controller.open([10, 65]);
      deps.dom.image.onerror?.(new Event("error") as any);
      expect(controller.isLoading).toBe(false);
      expect(deps.dom.status.textContent).toContain("Failed to load wavegram");
    });

    it("ignores stale load callback after re-open", () => {
      controller.open([10, 65]);
      const staleOnload = deps.dom.image.onload as ((ev: Event) => void) | null;
      controller.open([11, 66]);
      staleOnload?.(new Event("load"));
      expect(controller.isLoading).toBe(true);
    });

    it("ignores stale error callback after re-open", () => {
      controller.open([10, 65]);
      const staleOnerror = deps.dom.image.onerror;
      controller.open([11, 66]);
      staleOnerror?.(new Event("error") as any);
      expect(controller.isLoading).toBe(true);
    });
  });

  describe("close", () => {
    it("resets all state on close", () => {
      controller.open([10, 65]);
      controller.close();
      expect(controller.isOpen).toBe(false);
      expect(controller.isLoading).toBe(false);
      expect(controller.activeCoord).toBeNull();
    });

    it("sets aria-hidden to true", () => {
      controller.open([10, 65]);
      controller.close();
      expect(deps.dom.modal.getAttribute("aria-hidden")).toBe("true");
    });

    it("disables download and print", () => {
      controller.open([10, 65]);
      deps.dom.image.onload?.(new Event("load") as any);
      controller.close();
      expect(deps.dom.download.disabled).toBe(true);
      expect(deps.dom.print.disabled).toBe(true);
    });

    it("calls scheduleUpdateLayers on close", () => {
      (deps.scheduleUpdateLayers as ReturnType<typeof vi.fn>).mockClear();
      controller.close();
      expect(deps.scheduleUpdateLayers).toHaveBeenCalled();
    });
  });

  describe("event listeners", () => {
    it("closes on close button click", () => {
      controller.open([10, 65]);
      deps.dom.close.click();
      expect(controller.isOpen).toBe(false);
    });

    it("closes on backdrop click", () => {
      controller.open([10, 65]);
      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: deps.dom.modal });
      deps.dom.modal.dispatchEvent(event);
      expect(controller.isOpen).toBe(false);
    });

    it("does not close on inner content click", () => {
      controller.open([10, 65]);
      const inner = document.createElement("div");
      deps.dom.modal.appendChild(inner);
      const event = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(event, "target", { value: inner });
      deps.dom.modal.dispatchEvent(event);
      expect(controller.isOpen).toBe(true);
    });

    it("closes on Escape key when open", () => {
      controller.open([10, 65]);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(controller.isOpen).toBe(false);
    });

    it("does not close on Escape when already closed", () => {
      const closeSpy = vi.spyOn(controller, "close");
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it("reopens with new duration when duration changes", () => {
      controller.open([10, 65]);
      const opt = document.createElement("option");
      opt.value = "48";
      deps.dom.durationSelect.appendChild(opt);
      deps.dom.durationSelect.value = "48";
      deps.dom.durationSelect.dispatchEvent(new Event("change"));
      expect(deps.dom.image.src).toContain("48");
    });

    it("does nothing on duration change when closed", () => {
      (deps.scheduleUpdateLayers as ReturnType<typeof vi.fn>).mockClear();
      deps.dom.durationSelect.dispatchEvent(new Event("change"));
      expect(deps.scheduleUpdateLayers).not.toHaveBeenCalled();
    });

    it("reopens when tech toggle changes", () => {
      controller.open([10, 65]);
      deps.dom.techToggle.checked = true;
      deps.dom.techToggle.dispatchEvent(new Event("change"));
      expect(deps.dom.image.src).not.toBe("");
    });
  });

  describe("download", () => {
    it("does nothing when no url", async () => {
      await controller.download();
      expect(deps.dom.status.textContent).toBe("");
    });

    it("creates a download link on success", async () => {
      const blobUrl = "blob:http://localhost/fake";
      const mockBlob = new Blob(["png-data"], { type: "image/png" });
      const revokeObjectURL = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        }),
      );
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => blobUrl),
        revokeObjectURL,
      });

      controller.open([10.5, 65.123]);
      const clickSpy = vi.fn();
      const removeSpy = vi.fn();
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") {
          return {
            href: "",
            download: "",
            click: clickSpy,
            remove: removeSpy,
          } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);

      await controller.download();

      expect(clickSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl);

      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("opens fallback tab on download failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }),
      );
      const openSpy = vi.fn(() => null);
      vi.stubGlobal("open", openSpy);

      controller.open([10, 65]);
      await controller.download();

      expect(deps.dom.status.textContent).toContain("Download failed");
      expect(openSpy).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe("print", () => {
    it("does nothing when no url", async () => {
      await controller.print();
      expect(deps.dom.status.textContent).toBe("");
    });

    it("does nothing when window.open returns null", async () => {
      vi.stubGlobal(
        "open",
        vi.fn(() => null),
      );
      controller.open([10, 65]);
      await controller.print();
      vi.unstubAllGlobals();
    });

    it("opens a print window with correct content", async () => {
      const printDoc = document.implementation.createHTMLDocument("");
      const writeSpy = vi.spyOn(printDoc, "write");
      const focusSpy = vi.fn();
      const printSpy = vi.fn();
      const afterPrintListeners: Array<() => void> = [];
      const addWindowEventListener = vi.fn(
        (event: string, handler: () => void) => {
          if (event === "afterprint") afterPrintListeners.push(handler);
        },
      );
      const mockWin = {
        document: printDoc,
        focus: focusSpy,
        print: printSpy,
        addEventListener: addWindowEventListener,
      };
      vi.stubGlobal(
        "open",
        vi.fn(() => mockWin),
      );
      const mockBlob = new Blob(["png-data"], { type: "image/png" });
      const blobUrl = "blob:http://localhost/fake-print";
      const revokeObjectURL = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        }),
      );
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn(() => blobUrl),
        revokeObjectURL,
      });

      controller.open([10.5, 65.123]);
      await controller.print();

      const img = printDoc.body.querySelector("img");
      expect(img).not.toBeNull();
      const printButton = printDoc.body.querySelector("button");
      img?.dispatchEvent(new Event("load"));
      (printButton as HTMLButtonElement | null)?.click();
      afterPrintListeners.forEach((handler) => handler());

      expect(writeSpy).toHaveBeenCalled();
      expect(printDoc.body.textContent).toContain("65.123");
      expect(img?.getAttribute("src")).toBe(blobUrl);
      expect(printButton?.textContent).toContain("Spread wavegram");
      expect(focusSpy).toHaveBeenCalled();
      expect(printSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl);

      vi.unstubAllGlobals();
    });

    it("falls back to direct image URL when print fetch fails", async () => {
      const printDoc = document.implementation.createHTMLDocument("");
      const mockWin = {
        document: printDoc,
        focus: vi.fn(),
        print: vi.fn(),
        addEventListener: vi.fn(),
      };
      vi.stubGlobal(
        "open",
        vi.fn(() => mockWin),
      );
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

      controller.open([10.5, 65.123]);
      await controller.print();

      const img = printDoc.body.querySelector("img");
      expect(img?.getAttribute("src")).toBe(deps.dom.image.src);

      vi.unstubAllGlobals();
    });
  });

  describe("destroy", () => {
    it("removes event listeners", () => {
      controller.destroy();
      controller.open([10, 65]);
      deps.dom.close.click();
      expect(controller.isOpen).toBe(true);
    });
  });
});
