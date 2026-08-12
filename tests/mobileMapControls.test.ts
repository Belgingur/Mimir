import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOBILE_MAP_CONTROLS_MEDIA,
  isMobileControlsViewport,
} from "../src/lib/mobileControlsViewport";
import { shouldForceMobileMapControls } from "../src/lib/mobileMapControls";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stub matchMedia with a real-ish evaluation of the two features we gate on. */
function stubViewport(opts: { widthPx: number; coarsePointer: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const widthOk = /max-width:\s*640px/.test(query)
      ? opts.widthPx <= 640
      : true;
    const pointerOk = /pointer:\s*coarse/.test(query)
      ? opts.coarsePointer
      : true;
    return {
      matches: widthOk && pointerOk,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

describe("isMobileControlsViewport", () => {
  it("queries capability AND viewport, with no user-agent sniffing", () => {
    expect(MOBILE_MAP_CONTROLS_MEDIA).toBe(
      "(max-width: 640px) and (pointer: coarse)",
    );
  });

  it("matches a phone", () => {
    stubViewport({ widthPx: 390, coarsePointer: true });
    expect(isMobileControlsViewport()).toBe(true);
  });

  it("does not match a narrow desktop window, which has no pinch to fall back on", () => {
    stubViewport({ widthPx: 390, coarsePointer: false });
    expect(isMobileControlsViewport()).toBe(false);
  });

  it("does not match a large touch device, which has room for the controls", () => {
    stubViewport({ widthPx: 1024, coarsePointer: true });
    expect(isMobileControlsViewport()).toBe(false);
  });

  it("does not match a regular desktop", () => {
    stubViewport({ widthPx: 1440, coarsePointer: false });
    expect(isMobileControlsViewport()).toBe(false);
  });

  it("keeps the controls when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isMobileControlsViewport()).toBe(false);
  });
});

describe("shouldForceMobileMapControls", () => {
  // Self-contained storage: the matchMedia suite above calls
  // vi.unstubAllGlobals(), which also drops the localStorage stub that
  // tests/setup.ts installs once at module load.
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    });
  });

  it("is off by default", () => {
    expect(shouldForceMobileMapControls()).toBe(false);
  });

  it("accepts the documented truthy spellings", () => {
    for (const value of ["1", "true", "on", "yes", "TRUE", " 1 "]) {
      store["mimir-show-map-controls"] = value;
      expect(shouldForceMobileMapControls(), value).toBe(true);
    }
  });

  it("ignores other values", () => {
    for (const value of ["0", "false", "off", "", "maybe"]) {
      store["mimir-show-map-controls"] = value;
      expect(shouldForceMobileMapControls(), value).toBe(false);
    }
  });

  it("falls back to off when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("SecurityError");
      },
    });
    expect(shouldForceMobileMapControls()).toBe(false);
  });
});
