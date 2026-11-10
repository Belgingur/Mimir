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
    resolveTarget: (id) => ({ client: id.toUpperCase() }),
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
    // A bare point has no text until the widget names it.
    expect(dom.location.textContent).toBe("");
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
    // A bare point gets no name, so the widget names it in its own format.
    expect(widget.calls).toEqual([[65, -21, undefined]]);
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
    expect(createWidget).toHaveBeenLastCalledWith({ client: "ISLAND-9" });
    expect(dom.widgetHost.contains(widget)).toBe(false);
    expect(controller.getWidget()).not.toBe(widget);
    expect(controller.getWidget()?.getAttribute("forecast-label")).toBe(
      "ISLAND-9",
    );
  });

  it("replaces the widget for another forecast of the same config, keeps it for the same one", async () => {
    const forecasts: Record<string, string> = {
      GFS: "upstream/gfs",
      "GFS-COPY": "upstream/gfs",
      RAP: "upstream/rap",
    };
    let model = "GFS";
    const { controller, createWidget } = buildController({
      getSelectedModel: () => model,
      resolveTarget: (id) => ({ client: "site", forecast: forecasts[id] }),
    });
    await controller.openAt(-20, 64);
    model = "GFS-COPY";
    await controller.openAt(-20, 64);
    expect(createWidget).toHaveBeenCalledTimes(1);

    model = "RAP";
    await controller.openAt(-20, 64);
    expect(createWidget).toHaveBeenCalledTimes(2);
    expect(createWidget).toHaveBeenLastCalledWith({
      client: "site",
      forecast: "upstream/rap",
    });
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

    // Opening drops a pin at the raw click point immediately, without text
    // until the widget names the point. It names no place, so it stands in
    // for no map label.
    expect(showPin).toHaveBeenLastCalledWith(-20, 64, "", undefined);

    // The widget resolves the nearest station and fires its location event
    // (also fires when a different station is picked in the overlay).
    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 7 },
      }),
    );

    expect(dom.location.textContent).toBe("Reykjavík · 7°");
    // The widget moved the point and named it, so the pin names Reykjavík.
    expect(showPin).toHaveBeenLastCalledWith(
      -21.9,
      64.13,
      "Reykjavík · 7°",
      "Reykjavík",
    );
  });

  it("ignores a location event that lands after the panel was closed", async () => {
    // The widget resolves its point asynchronously. Closing quickly used to
    // leave the late event re-dropping the pin, stranding a "place · temp"
    // label on the map with nothing open.
    const showPin = vi.fn();
    const removePin = vi.fn();
    const { controller, widget } = buildController({ showPin, removePin });
    await controller.openAt(-20, 64);
    showPin.mockClear();

    controller.close();
    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 7 },
      }),
    );

    expect(showPin).not.toHaveBeenCalled();
    expect(removePin).toHaveBeenCalled();
  });

  it("still follows location events while the panel is open", async () => {
    const showPin = vi.fn();
    const { controller, widget } = buildController({ showPin });
    await controller.openAt(-20, 64);
    controller.close();
    await controller.openAt(-20, 64);
    showPin.mockClear();

    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 7 },
      }),
    );

    expect(showPin).toHaveBeenCalledWith(
      -21.9,
      64.13,
      "Reykjavík · 7°",
      "Reykjavík",
    );
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

    expect(showPin).toHaveBeenLastCalledWith(
      -19.25,
      63.5,
      "63.500, -19.250",
      undefined,
    );
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

  it("releases focus and makes the hidden modal inert", async () => {
    const { controller, dom } = buildController();
    await controller.openAt(-20, 64);
    expect(dom.modal.hasAttribute("inert")).toBe(false);
    dom.close.focus();
    expect(document.activeElement).toBe(dom.close);

    controller.close();

    expect(document.activeElement).not.toBe(dom.close);
    expect(dom.modal.hasAttribute("inert")).toBe(true);
    expect(dom.modal.getAttribute("aria-hidden")).toBe("true");
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
    expect(controller.getWidget()?.getAttribute("location-lat")).toBe("65.1");
    expect(controller.getWidget()?.getAttribute("location-lon")).toBe("-23.4");
    localStorage.removeItem("mimirMapPanelState");
  });

  describe("resolved place name", () => {
    it("labels the panel, pin and widget with the resolved city name", async () => {
      const showPin = vi.fn();
      const { controller, dom, widget } = buildController({
        showPin,
        getPlaceLabel: () => "Reykjavík",
      });
      await controller.openAt(-21.937, 64.143);

      expect(dom.location.textContent).toBe("Reykjavík");
      expect(showPin).toHaveBeenLastCalledWith(
        -21.937,
        64.143,
        "Reykjavík",
        "Reykjavík",
      );
      // location-name outranks the widget's own resolution, so its header
      // agrees with the panel instead of showing the raw coordinate.
      expect(widget.getAttribute("location-name")).toBe("Reykjavík");
      // The point itself is still exactly the clicked point.
      expect(widget.getAttribute("location-lat")).toBe("64.143");
      expect(widget.getAttribute("location-lon")).toBe("-21.937");
    });

    it("receives the point as (lng, lat)", async () => {
      const getPlaceLabel = vi.fn(() => "Akureyri");
      const { controller } = buildController({ getPlaceLabel });
      await controller.openAt(-18.1, 65.667);
      expect(getPlaceLabel).toHaveBeenCalledWith(-18.1, 65.667);
    });

    it("leaves a point without a place for the widget to name", async () => {
      const { controller, dom, widget } = buildController({
        getPlaceLabel: () => undefined,
      });
      await controller.openAt(-20, 64);
      expect(dom.location.textContent).toBe("");
      // Left unset so the widget's own prefer-coordinates behaviour stands.
      expect(widget.hasAttribute("location-name")).toBe(false);
    });

    it("ignores a blank resolved name", async () => {
      const { controller, dom, widget } = buildController({
        getPlaceLabel: () => "   ",
      });
      await controller.openAt(-20, 64);
      expect(dom.location.textContent).toBe("");
      expect(widget.hasAttribute("location-name")).toBe(false);
    });

    it("does not leak a stale name onto a later unnamed point", async () => {
      let label: string | undefined = "Reykjavík";
      const { controller, widget } = buildController({
        getPlaceLabel: () => label,
      });
      await controller.openAt(-21.937, 64.143);
      expect(widget.getAttribute("location-name")).toBe("Reykjavík");

      // Same client, so the existing widget is reused rather than recreated.
      label = undefined;
      await controller.openAt(-30, 62);
      expect(widget.hasAttribute("location-name")).toBe(false);
      expect(widget.calls[widget.calls.length - 1]).toEqual([
        62,
        -30,
        undefined,
      ]);
    });

    it("lets the widget name every bare point, the first and the ones after it", async () => {
      const showPin = vi.fn();
      const { controller, widget, createWidget } = buildController({
        showPin,
        getPlaceLabel: () => undefined,
      });
      await controller.openAt(-21.8, 64.2);
      // The first widget is created without a name: it labels the point itself.
      expect(widget.hasAttribute("location-name")).toBe(false);
      controller.close();

      await controller.openAt(-21.85, 64.18);
      expect(createWidget).toHaveBeenCalledTimes(1);
      expect(widget.calls).toEqual([[64.18, -21.85, undefined]]);

      // The pin follows the name the widget gives the point.
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64.18, lon: -21.85, name: "64.18°N 21.85°W", tempC: 4 },
        }),
      );
      const [, , pinLabel, placeName] = showPin.mock.calls[showPin.mock.calls.length - 1];
      expect(pinLabel).toContain("64.18°N 21.85°W");
      expect(placeName).toBeUndefined();
    });

    it("shows a bare point's pin without text until the widget names it", async () => {
      const showPin = vi.fn();
      const { controller, dom, widget } = buildController({
        showPin,
        getPlaceLabel: () => undefined,
      });
      await controller.openAt(-21.85, 64.18);
      expect(showPin).toHaveBeenLastCalledWith(-21.85, 64.18, "", undefined);
      expect(dom.location.textContent).toBe("");

      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64.18, lon: -21.85, name: "64.18°N 21.85°W", tempC: 4 },
        }),
      );
      expect(showPin.mock.calls[showPin.mock.calls.length - 1][2]).toContain(
        "64.18°N 21.85°W",
      );
    });

    it("gives a bare point Mímir's coordinates when its load fails first", async () => {
      const showPin = vi.fn();
      const { controller, dom, widget } = buildController({
        showPin,
        getPlaceLabel: () => undefined,
      });
      await controller.openAt(-21.94, 64.15);
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", {
          detail: { status: "error", error: "meteogram: timed out after 20 s" },
        }),
      );
      expect(showPin).toHaveBeenLastCalledWith(-21.94, 64.15, "64.150, -21.940", undefined);
      expect(dom.location.textContent).toBe("64.150, -21.940");

      // Retry succeeds: the widget's name replaces Mímir's text.
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64.15, lon: -21.94, name: "64.15°N 21.94°W", tempC: 4 },
        }),
      );
      expect(showPin.mock.calls[showPin.mock.calls.length - 1][2]).toContain(
        "64.15°N 21.94°W",
      );
    });

    it("gives a bare point Mímir's coordinates when the widget can't be set up", async () => {
      const showPin = vi.fn();
      const { controller, dom } = buildController({
        showPin,
        getPlaceLabel: () => undefined,
        createWidget: vi.fn(() => {
          throw new Error("no widget");
        }),
      });
      await controller.openAt(-21.94, 64.15);
      expect(dom.status.textContent).toContain("no widget");
      expect(showPin).toHaveBeenLastCalledWith(-21.94, 64.15, "64.150, -21.940", undefined);
    });

    it("keeps the widget's name, or a place's, when a later load fails", async () => {
      const showPin = vi.fn();
      const names: Array<string | undefined> = [undefined, "Akureyri"];
      const { controller, widget } = buildController({
        showPin,
        getPlaceLabel: () => names[0],
      });
      await controller.openAt(-21.85, 64.18);
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64.18, lon: -21.85, name: "64.18°N 21.85°W", tempC: 4 },
        }),
      );
      showPin.mockClear();
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", {
          detail: { status: "error", error: "meteogram: HTTP 503" },
        }),
      );
      expect(showPin).not.toHaveBeenCalled();

      names.shift();
      await controller.openAt(-18.1, 65.667);
      showPin.mockClear();
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-status", {
          detail: { status: "error", error: "meteogram: HTTP 503" },
        }),
      );
      expect(showPin).not.toHaveBeenCalled();
    });

    it("still passes a resolved name to a reused widget", async () => {
      const names: Array<string | undefined> = [undefined, "Akureyri"];
      const { controller, widget } = buildController({ getPlaceLabel: () => names[0] });
      await controller.openAt(-20, 64);
      names.shift();
      await controller.openAt(-18.1, 65.667);
      expect(widget.calls).toEqual([[65.667, -18.1, "Akureyri"]]);
    });

    it("keeps the resolved name when the widget announces the same point", async () => {
      const showPin = vi.fn();
      const { controller, dom, widget } = buildController({
        showPin,
        getPlaceLabel: () => "Reykjavík",
      });
      await controller.openAt(-21.937, 64.143);

      // The widget echoes location-name back in its location event, so the
      // subtitle keeps the city name and gains the "now" temperature.
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64.143, lon: -21.937, name: "Reykjavík", tempC: 7 },
        }),
      );
      expect(dom.location.textContent).toBe("Reykjavík · 7°");
      expect(showPin).toHaveBeenLastCalledWith(
        -21.937,
        64.143,
        "Reykjavík · 7°",
        "Reykjavík",
      );
    });

    it("names no place for a bare point, though the widget labels it", async () => {
      // With prefer-coordinates the widget names a bare point by its
      // coordinates; that is not a place, so no map label is hidden for it.
      const showPin = vi.fn();
      const { controller, widget } = buildController({
        showPin,
        getPlaceLabel: () => undefined,
      });
      await controller.openAt(-20, 64);
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 64, lon: -20, name: "64.00°N 20.00°W", tempC: 3 },
        }),
      );
      expect(showPin).toHaveBeenLastCalledWith(
        -20,
        64,
        "64.00°N 20.00°W · 3°",
        undefined,
      );
    });

    it("names the station picked in the widget's list", async () => {
      const showPin = vi.fn();
      const { controller, widget } = buildController({
        showPin,
        getPlaceLabel: () => "Reykjavík",
      });
      await controller.openAt(-21.937, 64.143);
      widget.dispatchEvent(
        new CustomEvent("bel-meteogram-location", {
          detail: { lat: 65.683, lon: -18.091, name: "Akureyri", tempC: 4 },
        }),
      );
      expect(showPin).toHaveBeenLastCalledWith(
        -18.091,
        65.683,
        "Akureyri · 4°",
        "Akureyri",
      );
    });
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
      expect(createWidget).toHaveBeenLastCalledWith({ client: "ISLAND-9" });
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

  describe("station-place note", () => {
    /** Reykjavík's label at its centre; the point opened is its station. */
    const reykjavik = { name: "Reykjavík", lng: -21.937, lat: 64.143 };

    it("tells the widget the place and how far its station is", async () => {
      const { controller, widget } = buildController({
        getSnappedFrom: () => reykjavik,
      });
      await controller.openAt(-21.9079, 64.1288);
      expect(widget.getAttribute("station-place")).toBe("Reykjavík");
      // 2.1 km; the widget rounds it for display.
      expect(Number(widget.getAttribute("station-place-km"))).toBeCloseTo(2.12, 1);
    });

    it("says nothing under half a kilometre", async () => {
      // Selfoss's station is 0.15 km from its label.
      const { controller, widget } = buildController({
        getSnappedFrom: () => ({ name: "Selfoss", lng: -20.997, lat: 63.933 }),
      });
      await controller.openAt(-21.0, 63.9327);
      expect(widget.hasAttribute("station-place")).toBe(false);
      expect(widget.hasAttribute("station-place-km")).toBe(false);
    });

    it("drops the note when the widget is pointed somewhere unsnapped", async () => {
      let snapped: typeof reykjavik | undefined = reykjavik;
      const { controller, widget } = buildController({
        getSnappedFrom: () => snapped,
      });
      await controller.openAt(-21.9079, 64.1288);
      expect(widget.hasAttribute("station-place")).toBe(true);
      snapped = undefined;
      await controller.openAt(-20, 64);
      expect(widget.hasAttribute("station-place")).toBe(false);
      expect(widget.hasAttribute("station-place-km")).toBe(false);
    });
  });
});

describe("MeteogramController — the timeline's hour (widget 0.8.0)", () => {
  /** Make the registered <bel-meteogram> look like 0.8.0 (or, with no
   *  attribute list, like 0.7.0) for the support check. */
  function stubWidgetVersion(supportsSelectedTime: boolean): void {
    vi.spyOn(customElements, "get").mockImplementation((name: string) =>
      name === "bel-meteogram"
        ? ({
            observedAttributes: supportsSelectedTime
              ? ["language", "selected-time"]
              : ["language"],
          } as unknown as CustomElementConstructor)
        : undefined,
    );
  }

  function emitLocation(
    widget: HTMLElement,
    detail: { lat: number; lon: number; name: string; tempC: number | null },
  ): void {
    widget.dispatchEvent(
      new CustomEvent("bel-meteogram-location", {
        detail: { corrections: [], ...detail },
      }),
    );
  }

  function emitTime(
    widget: HTMLElement,
    detail: {
      time: string | null;
      tempC: number | null;
      source: "host" | "user";
    },
  ): void {
    widget.dispatchEvent(new CustomEvent("bel-meteogram-time", { detail }));
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives a new widget the timeline's hour, as UTC, before it connects", async () => {
    stubWidgetVersion(true);
    let attrAtConnect: string | null = "unset";
    const { controller, widget, dom } = buildController({
      getSelectedTime: () => "2026-11-09T14:00:00Z",
    });
    const append = dom.widgetHost.appendChild.bind(dom.widgetHost);
    vi.spyOn(dom.widgetHost, "appendChild").mockImplementation((node) => {
      attrAtConnect = (node as HTMLElement).getAttribute("selected-time");
      return append(node);
    });
    await controller.openAt(-20, 64);
    expect(controller.getWidget()).toBe(widget);
    expect(attrAtConnect).toBe("2026-11-09T14:00:00.000Z");
  });

  it("moves the open widget's hour on every timeline step, setting only the attribute", async () => {
    stubWidgetVersion(true);
    const { controller, widget } = buildController({
      getSelectedTime: () => "2026-11-09T12:00:00Z",
    });
    await controller.openAt(-20, 64);
    const setAttribute = vi.spyOn(widget, "setAttribute");
    controller.setSelectedTime("2026-11-09T15:00:00Z");
    expect(widget.getAttribute("selected-time")).toBe(
      "2026-11-09T15:00:00.000Z",
    );
    // Same hour again: nothing is sent.
    controller.setSelectedTime("2026-11-09T15:00:00.000Z");
    expect(setAttribute.mock.calls).toEqual([
      ["selected-time", "2026-11-09T15:00:00.000Z"],
    ]);
    // No reload: the widget is never repointed by a time change.
    expect(widget.calls).toEqual([]);
    // No hour: the widget goes back to "now".
    controller.setSelectedTime(null);
    expect(widget.hasAttribute("selected-time")).toBe(false);
  });

  it("lets a closed panel's widget catch up when it opens again", async () => {
    stubWidgetVersion(true);
    let now = "2026-11-09T12:00:00Z";
    const { controller, widget } = buildController({
      getSelectedTime: () => now,
    });
    await controller.openAt(-20, 64);
    controller.close();
    now = "2026-11-09T18:00:00Z";
    controller.setSelectedTime(now);
    expect(widget.getAttribute("selected-time")).toBe(
      "2026-11-09T12:00:00.000Z",
    );
    await controller.openAt(-21, 64);
    expect(widget.getAttribute("selected-time")).toBe(
      "2026-11-09T18:00:00.000Z",
    );
  });

  it("labels the pin with the panel's value at the timeline's hour, changing only its text", async () => {
    stubWidgetVersion(true);
    const showPin = vi.fn();
    const updatePinLabel = vi.fn();
    const { controller, widget, dom } = buildController({
      getPlaceLabel: () => "Reykjavík",
      getSelectedTime: () => "2026-11-09T14:00:00Z",
      showPin,
      updatePinLabel,
    });
    await controller.openAt(-21.9, 64.13);
    // The location event names the point alone, never the "now" value.
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    expect(showPin).toHaveBeenLastCalledWith(
      -21.9,
      64.13,
      "Reykjavík",
      "Reykjavík",
    );
    const showPinCalls = showPin.mock.calls.length;
    emitTime(widget, {
      time: "2026-11-09T14:00:00.000Z",
      tempC: -2,
      source: "host",
    });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík · -2°");
    expect(dom.location.textContent).toBe("Reykjavík · -2°");
    // A new value only rewrites the label: the pin (and the map's label
    // filters behind showPin) are left alone.
    emitTime(widget, {
      time: "2026-11-09T15:00:00.000Z",
      tempC: 0,
      source: "host",
    });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík · 0°");
    expect(showPin.mock.calls.length).toBe(showPinCalls);
  });

  it("names the point alone when the hour is outside the meteogram or has no value", async () => {
    stubWidgetVersion(true);
    const updatePinLabel = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: () => "Keflavík",
      showPin: vi.fn(),
      updatePinLabel,
    });
    await controller.openAt(-22.6, 63.98);
    emitLocation(widget, { lat: 63.98, lon: -22.6, name: "Keflavík", tempC: 5 });
    emitTime(widget, { time: "2026-11-09T14:00:00.000Z", tempC: 3, source: "host" });
    emitTime(widget, { time: null, tempC: null, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Keflavík");
    emitTime(widget, { time: "2026-11-09T15:00:00.000Z", tempC: null, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Keflavík");
  });

  it("keeps a previous point's value off a new point until its load reports", async () => {
    stubWidgetVersion(true);
    const updatePinLabel = vi.fn();
    const showPin = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: (lng) => (lng < -22 ? "Keflavík" : "Reykjavík"),
      showPin,
      updatePinLabel,
    });
    await controller.openAt(-21.9, 64.13);
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    emitTime(widget, { time: "2026-11-09T14:00:00.000Z", tempC: 2, source: "host" });
    await controller.openAt(-22.6, 63.98);
    expect(showPin).toHaveBeenLastCalledWith(-22.6, 63.98, "Keflavík", "Keflavík");
    updatePinLabel.mockClear();
    // A time event before the new load's location (old data) is not shown.
    emitTime(widget, { time: "2026-11-09T15:00:00.000Z", tempC: 9, source: "host" });
    expect(updatePinLabel).not.toHaveBeenCalled();
    emitLocation(widget, { lat: 63.98, lon: -22.6, name: "Keflavík", tempC: 5 });
    emitTime(widget, { time: "2026-11-09T15:00:00.000Z", tempC: 1, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Keflavík · 1°");
  });

  it("falls back to the pin through showPin without updatePinLabel", async () => {
    stubWidgetVersion(true);
    const showPin = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: () => "Reykjavík",
      showPin,
    });
    await controller.openAt(-21.9, 64.13);
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    emitTime(widget, { time: "2026-11-09T14:00:00.000Z", tempC: 2, source: "host" });
    expect(showPin).toHaveBeenLastCalledWith(
      -21.9,
      64.13,
      "Reykjavík · 2°",
      "Reykjavík",
    );
  });

  it("keeps today's pin with the vendored 0.7.0 (no selected-time)", async () => {
    stubWidgetVersion(false);
    const showPin = vi.fn();
    const updatePinLabel = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: () => "Reykjavík",
      getSelectedTime: () => "2026-11-09T14:00:00Z",
      showPin,
      updatePinLabel,
    });
    await controller.openAt(-21.9, 64.13);
    expect(widget.hasAttribute("selected-time")).toBe(false);
    controller.setSelectedTime("2026-11-09T15:00:00Z");
    expect(widget.hasAttribute("selected-time")).toBe(false);
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    expect(showPin).toHaveBeenLastCalledWith(
      -21.9,
      64.13,
      "Reykjavík · 4°",
      "Reykjavík",
    );
    expect(updatePinLabel).not.toHaveBeenCalled();
  });

  it("moves the map's timeline when the reader picks an hour in the panel", async () => {
    stubWidgetVersion(true);
    const onUserSelectTime = vi.fn((time: string) => time);
    const updatePinLabel = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: () => "Reykjavík",
      getSelectedTime: () => "2026-11-09T12:00:00Z",
      onUserSelectTime,
      showPin: vi.fn(),
      updatePinLabel,
    });
    await controller.openAt(-21.9, 64.13);
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    emitTime(widget, { time: "2026-11-09T15:00:00.000Z", tempC: 6, source: "user" });
    expect(onUserSelectTime).toHaveBeenCalledWith("2026-11-09T15:00:00.000Z");
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík · 6°");
    // Host events never move the timeline.
    emitTime(widget, { time: "2026-11-09T18:00:00.000Z", tempC: 7, source: "host" });
    expect(onUserSelectTime).toHaveBeenCalledTimes(1);
  });

  it("never moves the timeline on its own: a playback step or a removed hour only updates the pin", async () => {
    stubWidgetVersion(true);
    const onUserSelectTime = vi.fn((time: string) => time);
    const updatePinLabel = vi.fn();
    const { controller, widget } = buildController({
      getPlaceLabel: () => "Reykjavík",
      getSelectedTime: () => "2026-11-09T12:00:00Z",
      onUserSelectTime,
      showPin: vi.fn(),
      updatePinLabel,
    });
    await controller.openAt(-21.9, 64.13);
    emitLocation(widget, { lat: 64.13, lon: -21.9, name: "Reykjavík", tempC: 4 });
    // A playback step: the attribute moves, the widget reports the hour.
    controller.setSelectedTime("2026-11-09T13:00:00Z");
    emitTime(widget, { time: "2026-11-09T13:00:00.000Z", tempC: 3, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík · 3°");
    // The attribute removed: the widget goes back to "now" and says so.
    controller.setSelectedTime(null);
    expect(widget.hasAttribute("selected-time")).toBe(false);
    emitTime(widget, { time: "2026-11-06T15:00:00.000Z", tempC: 8, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík · 8°");
    // A load completing while the hour is set, and one out of range.
    emitTime(widget, { time: null, tempC: null, source: "host" });
    expect(updatePinLabel).toHaveBeenLastCalledWith("Reykjavík");
    expect(onUserSelectTime).not.toHaveBeenCalled();
    // Only a move the reader commits in the panel moves the timeline.
    emitTime(widget, { time: "2026-11-09T18:00:00.000Z", tempC: 5, source: "user" });
    expect(onUserSelectTime).toHaveBeenCalledTimes(1);
    expect(onUserSelectTime).toHaveBeenCalledWith("2026-11-09T18:00:00.000Z");
  });

  it("puts the panel on whatever hour the timeline lands on, even another one", async () => {
    stubWidgetVersion(true);
    const { controller, widget } = buildController({
      getSelectedTime: () => "2026-11-09T12:00:00Z",
      // The map's frames end on the 10th: an hour the reader picks on the
      // 12th is clamped to the last frame, which the panel then shows.
      onUserSelectTime: () => "2026-11-10T18:00:00Z",
    });
    await controller.openAt(-21.9, 64.13);
    emitTime(widget, { time: "2026-11-12T09:00:00.000Z", tempC: 1, source: "user" });
    expect(widget.getAttribute("selected-time")).toBe(
      "2026-11-10T18:00:00.000Z",
    );
  });

  it("doesn't bounce the hour between the panel and the timeline", async () => {
    stubWidgetVersion(true);
    const { controller, widget } = buildController({
      getSelectedTime: () => "2026-11-09T12:00:00Z",
      // The timeline lands on the hour picked, then reports it back.
      onUserSelectTime: (time) => {
        controller.setSelectedTime(time);
        return time;
      },
    });
    await controller.openAt(-21.9, 64.13);
    const setAttribute = vi.spyOn(widget, "setAttribute");
    emitTime(widget, { time: "2026-11-09T15:00:00.000Z", tempC: 6, source: "user" });
    // The attribute catches up once with the reader's hour; the timeline's
    // echo of the same hour sends nothing more.
    expect(setAttribute.mock.calls).toEqual([
      ["selected-time", "2026-11-09T15:00:00.000Z"],
    ]);
    controller.setSelectedTime("2026-11-09T15:00:00Z");
    expect(setAttribute).toHaveBeenCalledTimes(1);
  });

  it("puts the panel on the timeline's frame when the reader's hour isn't one", async () => {
    stubWidgetVersion(true);
    const { controller, widget } = buildController({
      getSelectedTime: () => "2026-11-09T12:00:00Z",
      // 3-hourly frames: 13:00 is nearest the current 12:00 frame, so the
      // timeline doesn't move and won't report anything.
      onUserSelectTime: () => "2026-11-09T12:00:00Z",
    });
    await controller.openAt(-21.9, 64.13);
    const setAttribute = vi.spyOn(widget, "setAttribute");
    emitTime(widget, { time: "2026-11-09T13:00:00.000Z", tempC: 6, source: "user" });
    // Re-sent so the widget leaves 13:00 for the map's 12:00.
    expect(setAttribute.mock.calls).toEqual([
      ["selected-time", "2026-11-09T12:00:00.000Z"],
    ]);
  });
});
