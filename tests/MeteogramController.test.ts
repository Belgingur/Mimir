import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MeteogramController,
  type MeteogramControllerDeps,
  type MeteogramDomRefs,
  type MeteogramWidget,
} from "../src/features/meteogram/MeteogramController";
import { readMapPanelPoint } from "../src/features/meteogram/mapPanelState";

/** A real DOM element carrying the widget's public surface, so it can actually
 *  be appended to the host, receive attributes and dispatch status events like
 *  the real <bel-meteogram> would. */
function makeFakeWidget(): MeteogramWidget & {
  calls: [number, number, string?][];
} {
  const el = document.createElement("div") as unknown as MeteogramWidget & {
    calls: [number, number, string?][];
  };
  el.calls = [];
  (el as unknown as { loadChartLocation: MeteogramWidget["loadChartLocation"] }).loadChartLocation =
    (lat, lon, name) => {
      el.calls.push([lat, lon, name]);
    };
  return el;
}

function buildDom(): MeteogramDomRefs {
  const modal = document.createElement("div");
  const close = document.createElement("button");
  const location = document.createElement("div");
  const status = document.createElement("div");
  const widgetHost = document.createElement("div");
  modal.appendChild(close);
  document.body.appendChild(modal);
  return {
    modal: modal as HTMLDivElement,
    close,
    location: location as HTMLDivElement,
    status: status as HTMLDivElement,
    widgetHost,
  };
}

function buildController(overrides: Partial<MeteogramControllerDeps> = {}): {
  controller: MeteogramController;
  dom: MeteogramDomRefs;
  widget: ReturnType<typeof makeFakeWidget>;
  createWidget: ReturnType<typeof vi.fn>;
} {
  const dom = overrides.dom ?? buildDom();
  const widget = makeFakeWidget();
  const createWidget = vi.fn(() => makeFakeWidget());
  createWidget.mockReturnValueOnce(widget);
  const controller = new MeteogramController({
    dom,
    createWidget,
    getSelectedModel: () => "GFS",
    resolveClientName: (id) => id.toUpperCase(),
    getLocale: () => "en",
    getLayerMode: () => "temperature",
    isDev: false,
    ...overrides,
  });
  return { controller, dom, widget, createWidget };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("MeteogramController", () => {
  it("opens the modal and mounts a configured widget with the location preset", async () => {
    const { controller, dom, widget } = buildController();
    await controller.openAt(-20, 64); // lng, lat

    expect(dom.modal.classList.contains("is-open")).toBe(true);
    expect(dom.modal.getAttribute("aria-hidden")).toBe("false");
    expect(dom.location.textContent).toBe("64.000, -20.000");
    expect(controller.getWidget()).toBe(widget);
    expect(dom.widgetHost.contains(widget)).toBe(true);
    // Location + language are set as attributes before insertion so the
    // widget loads exactly once, already pointed at the right place.
    expect(widget.getAttribute("location-lat")).toBe("64");
    expect(widget.getAttribute("location-lon")).toBe("-20");
    expect(widget.getAttribute("language")).toBe("en");
    // The widget shows Mímir's model name via forecast-label.
    expect(widget.getAttribute("forecast-label")).toBe("GFS");
    expect(widget.calls).toEqual([]);
    expect(dom.status.textContent).toBe("");
  });

  it("reuses the widget for the same client and repoints it via loadChartLocation", async () => {
    const { controller, widget, createWidget } = buildController();
    await controller.openAt(-20, 64);
    await controller.openAt(-21, 65);

    expect(createWidget).toHaveBeenCalledTimes(1);
    expect(widget.calls).toEqual([[65, -21, "65.000, -21.000"]]);
  });

  it("replaces the widget when the resolved client changes", async () => {
    let model = "GFS";
    const { controller, dom, widget, createWidget } = buildController({
      getSelectedModel: () => model,
    });
    await controller.openAt(-20, 64);
    model = "ISLAND-9";
    await controller.openAt(-20, 64);

    expect(createWidget).toHaveBeenCalledTimes(2);
    expect(createWidget).toHaveBeenLastCalledWith("ISLAND-9");
    expect(dom.widgetHost.contains(widget)).toBe(false);
    expect(controller.getWidget()).not.toBe(widget);
    expect(controller.getWidget()?.getAttribute("forecast-label")).toBe(
      "ISLAND-9",
    );
  });

  it("mirrors widget status events into the modal status line", async () => {
    const { controller, dom, widget } = buildController();
    await controller.openAt(-20, 64);

    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-status", {
        detail: { status: "error", error: "config: HTTP 404" },
      }),
    );
    expect(dom.status.textContent).toContain("config: HTTP 404");

    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-status", { detail: { status: "ready" } }),
    );
    expect(dom.status.textContent).toBe("");
  });

  it("moves the pin and subtitle when the widget announces its resolved point", async () => {
    const showPin = vi.fn();
    const { controller, dom, widget } = buildController({ showPin });
    await controller.openAt(-20, 64);

    // Opening drops a pin at the raw click point immediately.
    expect(showPin).toHaveBeenLastCalledWith(-20, 64, "64.000, -20.000");

    // The widget resolves the nearest station and fires its location event
    // (also fires when a different station is picked in the overlay).
    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 7 },
      }),
    );

    expect(dom.location.textContent).toBe("Reykjavík · 7°");
    expect(showPin).toHaveBeenLastCalledWith(-21.9, 64.13, "Reykjavík · 7°");
  });

  it("falls back to coordinates in the pin label when no place name is resolved", async () => {
    const showPin = vi.fn();
    const { controller, widget } = buildController({ showPin });
    await controller.openAt(-20, 64);

    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { lat: 63.5, lon: -19.25, name: "", tempC: null },
      }),
    );

    expect(showPin).toHaveBeenLastCalledWith(-19.25, 63.5, "63.500, -19.250");
  });

  it("applyLocale updates the widget's language attribute in place", async () => {
    let locale = "en";
    const { controller, widget } = buildController({
      getLocale: () => locale,
    });
    await controller.openAt(-20, 64);
    expect(widget.getAttribute("language")).toBe("en");

    locale = "is";
    controller.applyLocale();
    expect(widget.getAttribute("language")).toBe("is");

    // Locales the widget ships strings for pass straight through.
    locale = "fo";
    controller.applyLocale();
    expect(widget.getAttribute("language")).toBe("fo");

    // A locale the widget has no strings for falls back to English.
    locale = "de";
    controller.applyLocale();
    expect(widget.getAttribute("language")).toBe("en");
  });

  it("closes when the widget's built-in ✕ emits bel-meteogram-close", async () => {
    const { controller, widget } = buildController();
    await controller.openAt(-20, 64);
    expect(controller.isOpen).toBe(true);

    widget.dispatchEvent(new CustomEvent("bel-meteogram-close"));
    expect(controller.isOpen).toBe(false);
  });

  it("closes on the close button and on Escape (mobile)", async () => {
    const { controller, dom } = buildController();
    await controller.openAt(-20, 64);

    dom.close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(controller.isOpen).toBe(false);

    await controller.openAt(-20, 64);
    expect(controller.isOpen).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(controller.isOpen).toBe(false);
  });

  it("removes the pin and clears the saved point when the panel closes", async () => {
    const removePin = vi.fn();
    const { controller, widget } = buildController({ removePin });
    await controller.openAt(-20, 64);
    expect(readMapPanelPoint()).toEqual({ lat: 64, lon: -20 });
    widget.dispatchEvent(new CustomEvent("bel-meteogram-close"));
    expect(controller.isOpen).toBe(false);
    expect(removePin).toHaveBeenCalledOnce();
    expect(readMapPanelPoint()).toBeNull();
  });

  it("restorePersistedPoint opens the last saved map click", async () => {
    localStorage.setItem(
      "mimirMapPanelState",
      JSON.stringify({ point: { lat: 65.1, lon: -23.4 } }),
    );
    const { controller, dom } = buildController();
    await controller.restorePersistedPoint();
    expect(dom.modal.classList.contains("is-open")).toBe(true);
    expect(dom.location.textContent).toBe("65.100, -23.400");
    localStorage.removeItem("mimirMapPanelState");
  });

  it("closes when the backdrop (modal itself) is clicked", async () => {
    const { controller, dom } = buildController();
    await controller.openAt(-20, 64);
    dom.modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(controller.isOpen).toBe(false);
  });

  it("debounces map clicks and cancelPendingClick suppresses the open", () => {
    vi.useFakeTimers();
    const { controller, dom } = buildController();
    controller.handleMapClick({ lng: -20, lat: 64 });
    controller.cancelPendingClick();
    vi.advanceTimersByTime(500);
    expect(dom.modal.classList.contains("is-open")).toBe(false);
  });

  it("does nothing on a waves-mode click", () => {
    vi.useFakeTimers();
    const { controller, dom } = buildController({ getLayerMode: () => "waves" });
    controller.handleMapClick({ lng: -20, lat: 64 });
    vi.advanceTimersByTime(500);
    expect(dom.modal.classList.contains("is-open")).toBe(false);
  });

  describe("out-of-domain hint", () => {
    // Iceland-ish box: lng [-30, -10], lat [60, 66].
    const bounds = (): [number, number, number, number] => [-30, 60, -10, 66];

    it("warns eagerly when the point is outside the model bounds", async () => {
      const { controller, dom } = buildController({ getModelBounds: bounds });
      await controller.openAt(0, 64); // lng 0 is east of the domain
      expect(dom.status.textContent).toContain("GFS");
    });

    it("stays silent when the point is inside the model bounds", async () => {
      const { controller, dom } = buildController({ getModelBounds: bounds });
      await controller.openAt(-20, 64);
      expect(dom.status.textContent).toBe("");
    });

    it("stays silent when the model bounds are unknown", async () => {
      const { controller, dom } = buildController(); // no getModelBounds
      await controller.openAt(0, 64);
      expect(dom.status.textContent).toBe("");
    });

    it("keeps the hint through loading and clears it on a successful load", async () => {
      const { controller, dom, widget } = buildController({
        getModelBounds: bounds,
      });
      await controller.openAt(0, 64);
      expect(dom.status.textContent).toContain("GFS");

      // The widget's loading phase must not wipe the early hint.
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", {
          detail: { status: "loading" },
        }),
      );
      expect(dom.status.textContent).toContain("GFS");

      // A successful load refutes the guess and clears the line.
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", { detail: { status: "ready" } }),
      );
      expect(dom.status.textContent).toBe("");
    });

    it("shows the load-failure message (not the hint) when the fetch errors", async () => {
      const { controller, dom, widget } = buildController({
        getModelBounds: bounds,
      });
      await controller.openAt(0, 64);
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", {
          detail: { status: "error", error: "meteogram: HTTP 404" },
        }),
      );
      expect(dom.status.textContent).toContain("meteogram: HTTP 404");
    });
  });

  describe("syncOpenState", () => {
    it("closes the open panel when the selection no longer targets a meteogram", async () => {
      let isTarget = true;
      const removePin = vi.fn();
      const { controller } = buildController({
        isMeteogramTarget: () => isTarget,
        removePin,
      });
      await controller.openAt(-20, 64);
      expect(controller.isOpen).toBe(true);

      // e.g. switching to the icons view / waves layer / GWES model.
      isTarget = false;
      controller.syncOpenState();
      expect(controller.isOpen).toBe(false);
      expect(removePin).toHaveBeenCalledOnce();
    });

    it("reloads the chart at the same point when the model's client changes", async () => {
      let model = "GFS";
      const { controller, createWidget } = buildController({
        isMeteogramTarget: () => true,
        getSelectedModel: () => model,
      });
      await controller.openAt(-20, 64);
      expect(createWidget).toHaveBeenCalledTimes(1);

      // The bottom model selector picks another model — reload in place.
      model = "ISLAND-9";
      controller.syncOpenState();
      expect(createWidget).toHaveBeenCalledTimes(2);
      expect(createWidget).toHaveBeenLastCalledWith("ISLAND-9");
      expect(controller.isOpen).toBe(true);
    });

    it("does not reload for the same model even when out of bounds", async () => {
      const { controller, createWidget } = buildController({
        isMeteogramTarget: () => true,
        getModelBounds: () => [-30, 60, -10, 66],
      });
      await controller.openAt(0, 64); // lng 0 is east of the domain
      controller.syncOpenState();
      expect(createWidget).toHaveBeenCalledTimes(1);
    });

    it("is a no-op while open with the same model, and while closed", async () => {
      const { controller, createWidget } = buildController({
        isMeteogramTarget: () => true,
      });
      // Closed: nothing happens.
      controller.syncOpenState();
      expect(createWidget).not.toHaveBeenCalled();

      await controller.openAt(-20, 64);
      expect(createWidget).toHaveBeenCalledTimes(1);
      // Open, unchanged model (a map pan/zoom): must not reload.
      controller.syncOpenState();
      expect(createWidget).toHaveBeenCalledTimes(1);
    });
  });
});
