import { describe, it, expect } from "vitest";
import {
  formatTimelineDayLabel,
  formatTimelineBubbleLabel,
  buildTimelineDayBlocks,
  matchNearestTimeIndex,
  filterTimesByRange,
} from "../src/lib/timelineHelpers";

describe("formatTimelineDayLabel", () => {
  it("formats a UTC datetime into short weekday + day", () => {
    const label = formatTimelineDayLabel("2026-03-19T12:00:00Z");
    expect(label).toMatch(/Thu 19/);
  });

  it("handles midnight correctly", () => {
    const label = formatTimelineDayLabel("2026-03-20T00:00:00Z");
    expect(label).toMatch(/Fri 20/);
  });
});

describe("formatTimelineBubbleLabel", () => {
  it("includes weekday, day, and HH:MM", () => {
    const label = formatTimelineBubbleLabel("2026-03-19T14:30:00Z");
    expect(label).toMatch(/Thu 19 - 14:30/);
  });

  it("pads single-digit hours and minutes", () => {
    const label = formatTimelineBubbleLabel("2026-03-19T03:05:00Z");
    expect(label).toMatch(/03:05/);
  });
});

describe("buildTimelineDayBlocks", () => {
  it("returns empty array for empty input", () => {
    expect(buildTimelineDayBlocks([])).toEqual([]);
  });

  it("groups consecutive datetimes on the same day", () => {
    const datetimes = [
      "2026-03-19T00:00:00Z",
      "2026-03-19T06:00:00Z",
      "2026-03-19T12:00:00Z",
      "2026-03-20T00:00:00Z",
      "2026-03-20T06:00:00Z",
    ];
    const blocks = buildTimelineDayBlocks(datetimes);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].end).toBe(2);
    expect(blocks[1].start).toBe(3);
    expect(blocks[1].end).toBe(4);
  });

  it("creates one block per day for single-entry days", () => {
    const datetimes = [
      "2026-03-19T12:00:00Z",
      "2026-03-20T12:00:00Z",
      "2026-03-21T12:00:00Z",
    ];
    const blocks = buildTimelineDayBlocks(datetimes);
    expect(blocks).toHaveLength(3);
    blocks.forEach((b, i) => {
      expect(b.start).toBe(i);
      expect(b.end).toBe(i);
    });
  });
});

describe("matchNearestTimeIndex", () => {
  const times = [
    "2026-03-19T00:00:00Z",
    "2026-03-19T06:00:00Z",
    "2026-03-19T12:00:00Z",
    "2026-03-19T18:00:00Z",
  ];

  it("returns exact match index", () => {
    expect(matchNearestTimeIndex(times, "2026-03-19T12:00:00Z")).toBe(2);
  });

  it("returns nearest index for in-between time", () => {
    expect(matchNearestTimeIndex(times, "2026-03-19T07:00:00Z")).toBe(1);
  });

  it("returns 0 for unparseable target", () => {
    expect(matchNearestTimeIndex(times, "GARBAGE")).toBe(0);
  });

  it("returns 0 for empty times", () => {
    expect(matchNearestTimeIndex([], "2026-03-19T12:00:00Z")).toBe(0);
  });
});

describe("filterTimesByRange", () => {
  const times = [
    "2026-03-19T00:00:00Z",
    "2026-03-19T06:00:00Z",
    "2026-03-19T12:00:00Z",
    "2026-03-19T18:00:00Z",
    "2026-03-20T00:00:00Z",
  ];

  it("returns all times when range is null", () => {
    expect(filterTimesByRange(times, null)).toEqual(times);
  });

  it("filters by start/end", () => {
    const range = {
      start: "2026-03-19T06:00:00Z",
      end: "2026-03-19T18:00:00Z",
    };
    const result = filterTimesByRange(times, range);
    expect(result).toEqual([
      "2026-03-19T06:00:00Z",
      "2026-03-19T12:00:00Z",
      "2026-03-19T18:00:00Z",
    ]);
  });

  it("filters by from/to", () => {
    const range = { from: "2026-03-19T06:00:00Z", to: "2026-03-19T12:00:00Z" };
    const result = filterTimesByRange(times, range);
    expect(result).toEqual(["2026-03-19T06:00:00Z", "2026-03-19T12:00:00Z"]);
  });

  it("returns all when start/end missing", () => {
    const range = { foo: "bar" } as unknown as { start?: string };
    expect(filterTimesByRange(times, range)).toEqual(times);
  });

  it("returns all for unparseable range dates", () => {
    const range = { start: "GARBAGE", end: "GARBAGE" };
    expect(filterTimesByRange(times, range)).toEqual(times);
  });
});
