import { describe, it, expect } from "vitest";
import {
  formatTimelineDayLabel,
  formatTimelineBubbleLabel,
  formatTimelineBubbleLabelWithZone,
  formatTimelineZoneLabel,
  buildTimelineDayBlocks,
  matchNearestTimeIndex,
  nowRailRatio,
  filterTimesByRange,
} from "../src/lib/timelineHelpers";

// The label helpers render in whatever zone the runtime is in, so expectations
// are derived the same way rather than hard-coded to UTC — the suite then holds
// on a developer machine in Reykjavík and one in São Paulo alike. vitest.config
// pins TZ to a non-UTC zone so the conversion is genuinely exercised.
const localParts = (iso: string) => {
  const date = new Date(iso);
  return {
    day: date.getDate(),
    hh: String(date.getHours()).padStart(2, "0"),
    mm: String(date.getMinutes()).padStart(2, "0"),
  };
};

describe("formatTimelineDayLabel", () => {
  it("formats a datetime into short weekday + day of the month", () => {
    const label = formatTimelineDayLabel("2026-03-19T12:00:00Z");
    expect(label).toMatch(
      new RegExp(`^\\w{3} ${localParts("2026-03-19T12:00:00Z").day}$`),
    );
  });

  it("reads the instant on the viewer's own clock, not in UTC", () => {
    // Rendered in UTC+2 this is the 20th; in UTC-3 it is still the 19th. Either
    // way it must agree with the local getters rather than with getUTCDate().
    const iso = "2026-03-20T00:00:00Z";
    expect(formatTimelineDayLabel(iso)).toContain(String(localParts(iso).day));
  });
});

describe("formatTimelineBubbleLabel", () => {
  it("includes weekday, day, and HH:MM on the local clock", () => {
    const iso = "2026-03-19T14:30:00Z";
    const { day, hh, mm } = localParts(iso);
    expect(formatTimelineBubbleLabel(iso)).toMatch(
      new RegExp(`^\\w{3} ${day} - ${hh}:${mm}$`),
    );
  });

  it("pads single-digit hours and minutes to two places", () => {
    const label = formatTimelineBubbleLabel("2026-03-19T03:05:00Z");
    expect(label).toMatch(/\d{2}:\d{2}$/);
  });
});

describe("formatTimelineZoneLabel", () => {
  it("names the zone the labels are drawn in", () => {
    const label = formatTimelineZoneLabel("2026-03-19T14:30:00Z");
    expect(label).toMatch(/^UTC(?:[+-]\d{1,2}(?::\d{2})?)?$/);
  });

  it("agrees with the runtime's own offset for that instant", () => {
    const iso = "2026-03-19T14:30:00Z";
    const offsetMinutes = -new Date(iso).getTimezoneOffset();
    if (offsetMinutes === 0) {
      expect(formatTimelineZoneLabel(iso)).toBe("UTC");
    } else {
      const sign = offsetMinutes < 0 ? "-" : "+";
      expect(formatTimelineZoneLabel(iso)).toContain(sign);
      expect(formatTimelineZoneLabel(iso)).toContain(
        String(Math.floor(Math.abs(offsetMinutes) / 60)),
      );
    }
  });
});

describe("formatTimelineBubbleLabelWithZone", () => {
  it("appends the zone marker to the plain reading", () => {
    const iso = "2026-03-19T14:30:00Z";
    expect(formatTimelineBubbleLabelWithZone(iso)).toBe(
      `${formatTimelineBubbleLabel(iso)} ${formatTimelineZoneLabel(iso)}`,
    );
  });
});

describe("buildTimelineDayBlocks", () => {
  it("returns empty array for empty input", () => {
    expect(buildTimelineDayBlocks([])).toEqual([]);
  });

  it("groups consecutive datetimes that share a local day", () => {
    // Six-hourly steps spanning two UTC days. Whatever the runtime zone, every
    // entry carries one of at most three local-day labels and the blocks must
    // stay contiguous and cover the whole series.
    const datetimes = [
      "2026-03-19T00:00:00Z",
      "2026-03-19T06:00:00Z",
      "2026-03-19T12:00:00Z",
      "2026-03-20T00:00:00Z",
      "2026-03-20T06:00:00Z",
    ];
    const blocks = buildTimelineDayBlocks(datetimes);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0].start).toBe(0);
    expect(blocks[blocks.length - 1].end).toBe(datetimes.length - 1);
    blocks.forEach((block, i) => {
      if (i > 0) expect(block.start).toBe(blocks[i - 1].end + 1);
      for (let idx = block.start; idx <= block.end; idx += 1) {
        expect(formatTimelineDayLabel(datetimes[idx])).toBe(block.label);
      }
    });
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

describe("nowRailRatio", () => {
  const ms = (iso: string) => Date.parse(iso);

  it("places now at the fraction of the run it has reached", () => {
    const times = [
      "2026-03-19T00:00:00Z",
      "2026-03-19T06:00:00Z",
      "2026-03-19T12:00:00Z",
      "2026-03-19T18:00:00Z",
      "2026-03-20T00:00:00Z",
    ];
    // Exactly on the middle step: index 2 of 4 spans.
    expect(nowRailRatio(times, ms("2026-03-19T12:00:00Z"))).toBeCloseTo(0.5, 10);
    expect(nowRailRatio(times, ms("2026-03-19T00:00:00Z"))).toBeCloseTo(0, 10);
    expect(nowRailRatio(times, ms("2026-03-20T00:00:00Z"))).toBeCloseTo(1, 10);
  });

  it("interpolates between two steps", () => {
    const times = [
      "2026-03-19T00:00:00Z",
      "2026-03-19T06:00:00Z",
      "2026-03-19T12:00:00Z",
    ];
    // Three hours into the first six-hour step = half of index 0→1, and the
    // rail spans two steps, so 0.5 / 2.
    expect(nowRailRatio(times, ms("2026-03-19T03:00:00Z"))).toBeCloseTo(
      0.25,
      10,
    );
  });

  it("measures position in index space, not clock space", () => {
    // Uneven spacing: an hourly head followed by a six-hourly tail. Each step
    // still occupies the same rail width, so a moment one hour in sits at the
    // first of three spans — 1/3 — not at the 1/13th of elapsed time.
    const times = [
      "2026-03-19T00:00:00Z",
      "2026-03-19T01:00:00Z",
      "2026-03-19T07:00:00Z",
      "2026-03-19T13:00:00Z",
    ];
    expect(nowRailRatio(times, ms("2026-03-19T01:00:00Z"))).toBeCloseTo(
      1 / 3,
      10,
    );
  });

  it("draws no tick when now is outside the run", () => {
    const times = ["2026-03-19T00:00:00Z", "2026-03-19T12:00:00Z"];
    // Before the run and after it: clamping to an edge would claim the forecast
    // covers this moment.
    expect(nowRailRatio(times, ms("2026-03-18T23:00:00Z"))).toBeNull();
    expect(nowRailRatio(times, ms("2026-03-19T13:00:00Z"))).toBeNull();
  });

  it("draws no tick without a span to place it on", () => {
    expect(nowRailRatio([], ms("2026-03-19T00:00:00Z"))).toBeNull();
    expect(
      nowRailRatio(["2026-03-19T00:00:00Z"], ms("2026-03-19T00:00:00Z")),
    ).toBeNull();
  });

  it("draws no tick for unusable input", () => {
    const times = ["2026-03-19T00:00:00Z", "GARBAGE"];
    expect(nowRailRatio(times, ms("2026-03-19T00:00:00Z"))).toBeNull();
    expect(
      nowRailRatio(["2026-03-19T00:00:00Z", "2026-03-19T12:00:00Z"], NaN),
    ).toBeNull();
  });
});
