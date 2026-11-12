import { afterEach, describe, expect, it, vi } from "vitest";
import { createForecastStart } from "../src/lib/forecastStart";

function setup(outcomes: Array<"ok" | "fail">) {
  const initWeather = vi.fn(async () => {
    if (outcomes.shift() === "fail") throw new Error("no layers");
  });
  const reloadCatalog = vi.fn(async () => {});
  let retry: (() => void) | null = null;
  const showError = vi.fn((action: () => void) => {
    retry = action;
  });
  const showRetrying = vi.fn();
  const clear = vi.fn();
  const forecastStart = createForecastStart({
    initWeather,
    reloadCatalog,
    showError,
    showRetrying,
    clear,
  });
  return {
    forecastStart,
    initWeather,
    reloadCatalog,
    showError,
    showRetrying,
    clear,
    pressRetry: () => retry?.(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createForecastStart", () => {
  it("shows nothing when the start succeeds", async () => {
    const { forecastStart, initWeather, showError, reloadCatalog } = setup(["ok"]);
    await expect(forecastStart.start()).resolves.toBe(true);
    expect(initWeather).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
    expect(reloadCatalog).not.toHaveBeenCalled();
  });

  it("ends a failed start with the error and a Retry, not a rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { forecastStart, showError } = setup(["fail"]);
    await expect(forecastStart.start()).resolves.toBe(false);
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it("on Retry loads the catalog again, starts again, and clears the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = setup(["fail", "ok"]);
    await s.forecastStart.start();

    s.pressRetry();
    await vi.waitFor(() => expect(s.clear).toHaveBeenCalledTimes(1));
    expect(s.showRetrying).toHaveBeenCalledTimes(1);
    expect(s.reloadCatalog).toHaveBeenCalledTimes(1);
    expect(s.initWeather).toHaveBeenCalledTimes(2);
    // The catalog is loaded again before the start runs again.
    expect(s.reloadCatalog.mock.invocationCallOrder[0]).toBeLessThan(
      s.initWeather.mock.invocationCallOrder[1],
    );
    expect(s.showError).toHaveBeenCalledTimes(1);
  });

  it("shows the error again when the retry fails too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = setup(["fail", "fail"]);
    await s.forecastStart.start();
    s.pressRetry();
    await vi.waitFor(() => expect(s.showError).toHaveBeenCalledTimes(2));
    expect(s.clear).not.toHaveBeenCalled();
  });

  it("runs one retry for two quick presses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = setup(["fail", "ok"]);
    await s.forecastStart.start();
    s.pressRetry();
    s.pressRetry();
    await vi.waitFor(() => expect(s.clear).toHaveBeenCalledTimes(1));
    expect(s.reloadCatalog).toHaveBeenCalledTimes(1);
    expect(s.initWeather).toHaveBeenCalledTimes(2);
  });
});
