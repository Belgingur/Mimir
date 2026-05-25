import { describe, it, expect } from "vitest";
import { LRUMap } from "../src/lib/LRUMap";

describe("LRUMap", () => {
  it("throws on maxSize < 1", () => {
    expect(() => new LRUMap(0)).toThrow(RangeError);
    expect(() => new LRUMap(-1)).toThrow(RangeError);
  });

  it("stores and retrieves values", () => {
    const m = new LRUMap<string, number>(5);
    m.set("a", 1);
    m.set("b", 2);
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).toBe(2);
    expect(m.size).toBe(2);
  });

  it("has() returns correct boolean", () => {
    const m = new LRUMap<string, number>(5);
    m.set("x", 10);
    expect(m.has("x")).toBe(true);
    expect(m.has("y")).toBe(false);
  });

  it("evicts oldest entry when exceeding maxSize", () => {
    const m = new LRUMap<string, number>(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    m.set("d", 4);
    expect(m.size).toBe(3);
    expect(m.has("a")).toBe(false);
    expect(m.get("b")).toBe(2);
    expect(m.get("c")).toBe(3);
    expect(m.get("d")).toBe(4);
  });

  it("get() promotes entry to most-recent", () => {
    const m = new LRUMap<string, number>(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    m.get("a");
    m.set("d", 4);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
  });

  it("set() on existing key refreshes position", () => {
    const m = new LRUMap<string, number>(3);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    m.set("a", 100);
    m.set("d", 4);
    expect(m.has("a")).toBe(true);
    expect(m.get("a")).toBe(100);
    expect(m.has("b")).toBe(false);
  });

  it("delete() removes entry", () => {
    const m = new LRUMap<string, number>(5);
    m.set("a", 1);
    expect(m.delete("a")).toBe(true);
    expect(m.has("a")).toBe(false);
    expect(m.size).toBe(0);
    expect(m.delete("nonexistent")).toBe(false);
  });

  it("clear() empties the cache", () => {
    const m = new LRUMap<string, number>(5);
    m.set("a", 1);
    m.set("b", 2);
    m.clear();
    expect(m.size).toBe(0);
    expect(m.has("a")).toBe(false);
  });

  it("maxSize of 1 keeps only last entry", () => {
    const m = new LRUMap<string, number>(1);
    m.set("a", 1);
    m.set("b", 2);
    expect(m.size).toBe(1);
    expect(m.has("a")).toBe(false);
    expect(m.get("b")).toBe(2);
  });

  it("keys(), values(), entries() iterate correctly", () => {
    const m = new LRUMap<string, number>(5);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    expect([...m.keys()]).toEqual(["a", "b", "c"]);
    expect([...m.values()]).toEqual([1, 2, 3]);
    expect([...m.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("forEach iterates all entries", () => {
    const m = new LRUMap<string, number>(5);
    m.set("x", 10);
    m.set("y", 20);
    const result: [string, number][] = [];
    m.forEach((v, k) => result.push([k, v]));
    expect(result).toEqual([
      ["x", 10],
      ["y", 20],
    ]);
  });

  it("evicts multiple entries at once when needed", () => {
    const m = new LRUMap<string, number>(2);
    m.set("a", 1);
    m.set("b", 2);
    m.set("c", 3);
    expect(m.size).toBe(2);
    expect(m.has("a")).toBe(false);
    expect(m.has("b")).toBe(true);
    expect(m.has("c")).toBe(true);
  });

  it("get() on missing key returns undefined without side-effects", () => {
    const m = new LRUMap<string, number>(3);
    m.set("a", 1);
    expect(m.get("missing")).toBeUndefined();
    expect(m.size).toBe(1);
  });

  it("exposes maxSize as readonly", () => {
    const m = new LRUMap<string, number>(42);
    expect(m.maxSize).toBe(42);
  });
});
