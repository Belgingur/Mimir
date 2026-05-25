import { describe, expect, it, vi } from "vitest";
import {
  TimelineControlAdapter,
  type PlaybackHooks,
} from "../src/controllers/TimelineControlAdapter";

function makeInner(overrides: Record<string, unknown> = {}) {
  return {
    getConfig: vi.fn().mockReturnValue({ datetimes: ["t1"], datetime: "t1" }),
    setConfig: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

function makeHooks(): { hooks: PlaybackHooks; spies: PlaybackHooks } {
  const hooks: PlaybackHooks = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
  };
  return { hooks, spies: hooks };
}

describe("TimelineControlAdapter", () => {
  it("raw returns the original inner control", () => {
    const inner = makeInner();
    const { hooks } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    expect(adapter.raw).toBe(inner);
  });

  it("start() calls inner.start then hooks.onStart", async () => {
    const inner = makeInner();
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    await adapter.start();
    expect(inner.start).toHaveBeenCalledOnce();
    expect(spies.onStart).toHaveBeenCalledOnce();
  });

  it("pause() calls hooks.onPause then inner.pause", () => {
    const inner = makeInner();
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    adapter.pause();
    expect(spies.onPause).toHaveBeenCalledOnce();
    expect(inner.pause).toHaveBeenCalledOnce();
  });

  it("stop() calls hooks.onStop then inner.stop", () => {
    const inner = makeInner();
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    adapter.stop();
    expect(spies.onStop).toHaveBeenCalledOnce();
    expect(inner.stop).toHaveBeenCalledOnce();
  });

  it("getConfig() delegates to inner.getConfig", () => {
    const inner = makeInner();
    const { hooks } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    const config = adapter.getConfig();
    expect(inner.getConfig).toHaveBeenCalledOnce();
    expect(config).toEqual({ datetimes: ["t1"], datetime: "t1" });
  });

  it("setConfig() delegates to inner.setConfig", () => {
    const inner = makeInner();
    const { hooks } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    const cfg = { datetimes: ["t2"], datetime: "t2" };
    adapter.setConfig(cfg);
    expect(inner.setConfig).toHaveBeenCalledWith(cfg);
  });

  it("start() still calls hooks.onStart when inner lacks start method", async () => {
    const inner = makeInner({ start: undefined });
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    await adapter.start();
    expect(spies.onStart).toHaveBeenCalledOnce();
  });

  it("pause() still calls hooks.onPause when inner lacks pause method", () => {
    const inner = makeInner({ pause: undefined });
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    adapter.pause();
    expect(spies.onPause).toHaveBeenCalledOnce();
  });

  it("stop() still calls hooks.onStop when inner lacks stop method", () => {
    const inner = makeInner({ stop: undefined });
    const { hooks, spies } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    adapter.stop();
    expect(spies.onStop).toHaveBeenCalledOnce();
  });

  it("getConfig() returns undefined when inner lacks getConfig", () => {
    const inner = makeInner({ getConfig: undefined });
    const { hooks } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    expect(adapter.getConfig()).toBeUndefined();
  });

  it("setConfig() is a no-op when inner lacks setConfig", () => {
    const inner = makeInner({ setConfig: undefined });
    const { hooks } = makeHooks();
    const adapter = new TimelineControlAdapter(inner as any, hooks);
    expect(() => adapter.setConfig({ datetime: "t1" })).not.toThrow();
  });
});
