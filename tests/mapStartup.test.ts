import { describe, expect, it, vi } from "vitest";
import { whenStyleLoads } from "../src/lib/mapStartup";

/** A stand-in for MapLibre's event surface: once() and a way to fire. */
function stubMap() {
  const listeners = new Map<string, Array<() => void>>();
  return {
    once: vi.fn((type: string, listener: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
    fire(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("whenStyleLoads", () => {
  it("resolves on style.load, not before and not on load", async () => {
    const map = stubMap();
    const resolved = vi.fn();
    void whenStyleLoads(map as never).then(resolved);

    await settle();
    expect(resolved).not.toHaveBeenCalled();
    map.fire("load");
    await settle();
    expect(resolved).not.toHaveBeenCalled();

    map.fire("style.load");
    await settle();
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it("still answers a caller that asks after the event", async () => {
    const map = stubMap();
    const styleLoaded = whenStyleLoads(map as never);
    map.fire("style.load");
    await settle();

    const late = vi.fn();
    void styleLoaded.then(late);
    await settle();
    expect(late).toHaveBeenCalledTimes(1);
  });
});
