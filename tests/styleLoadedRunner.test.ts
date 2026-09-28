import { describe, expect, it, vi } from "vitest";
import { createStyleLoadedRunner } from "../src/lib/styleLoadedRunner";

function fakeMap(loaded: boolean) {
  const idle: Array<() => void> = [];
  return {
    loaded,
    isStyleLoaded() {
      return this.loaded;
    },
    once: vi.fn((type: string, fn: () => void) => {
      if (type === "idle") idle.push(fn);
    }),
    fireIdle() {
      idle.splice(0).forEach((fn) => fn());
    },
  };
}

describe("createStyleLoadedRunner", () => {
  it("applies immediately when the style is loaded", () => {
    const map = fakeMap(true);
    const apply = vi.fn();
    createStyleLoadedRunner(map as never, apply)();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(map.once).not.toHaveBeenCalled();
  });

  it("retries on idle when called while tiles are still loading", () => {
    const map = fakeMap(false);
    const apply = vi.fn();
    createStyleLoadedRunner(map as never, apply)();
    expect(apply).not.toHaveBeenCalled();

    map.loaded = true;
    map.fireIdle();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("shares one pending retry across repeated early calls", () => {
    const map = fakeMap(false);
    const apply = vi.fn();
    const run = createStyleLoadedRunner(map as never, apply);
    run();
    run();
    run();
    expect(map.once).toHaveBeenCalledTimes(1);

    map.loaded = true;
    map.fireIdle();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting if the style is still not loaded at idle", () => {
    const map = fakeMap(false);
    const apply = vi.fn();
    createStyleLoadedRunner(map as never, apply)();

    map.fireIdle();
    expect(apply).not.toHaveBeenCalled();
    expect(map.once).toHaveBeenCalledTimes(2);

    map.loaded = true;
    map.fireIdle();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
