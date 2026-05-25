import { describe, expect, it } from "vitest";
import {
  clampSelectedIndex,
  rebuildTimelineState,
  resolveDatasetDatetime,
} from "../src/lib/timelineState";

describe("rebuildTimelineState", () => {
  it("rebuilds the timeline from the new model timestamps only", () => {
    const result = rebuildTimelineState({
      datetimes: ["2026-03-19T00:00:00Z", "2026-03-19T03:00:00Z"],
      requestedDatetime: "2026-03-18T18:00:00Z",
      previousTimeline: [
        "2026-03-18T00:00:00Z",
        "2026-03-18T06:00:00Z",
        "2026-03-18T12:00:00Z",
        "2026-03-18T18:00:00Z",
      ],
    });

    expect(result.datetimes).toEqual([
      "2026-03-19T00:00:00Z",
      "2026-03-19T03:00:00Z",
    ]);
    expect(result.selectedDatetime).toBe("2026-03-19T03:00:00Z");
  });

  it("keeps selectedIndex within the valid range for the active model", () => {
    const result = rebuildTimelineState({
      datetimes: ["2026-03-19T00:00:00Z", "2026-03-19T03:00:00Z"],
      selectedIndex: 9,
    });

    expect(result.selectedIndex).toBe(1);
    expect(result.selectedDatetime).toBe("2026-03-19T03:00:00Z");
  });

  it("returns empty state when datetimes is empty", () => {
    const result = rebuildTimelineState({ datetimes: [] });
    expect(result.datetimes).toEqual([]);
    expect(result.selectedDatetime).toBe("");
    expect(result.selectedIndex).toBe(-1);
  });

  it("defaults to first datetime when no requestedDatetime or selectedIndex", () => {
    const result = rebuildTimelineState({
      datetimes: ["2026-03-19T00:00:00Z", "2026-03-19T03:00:00Z"],
    });
    expect(result.selectedDatetime).toBe("2026-03-19T00:00:00Z");
    expect(result.selectedIndex).toBe(0);
  });

  it("uses selectedIndex when requestedDatetime is null", () => {
    const result = rebuildTimelineState({
      datetimes: ["2026-03-19T00:00:00Z", "2026-03-19T03:00:00Z", "2026-03-19T06:00:00Z"],
      requestedDatetime: null,
      selectedIndex: 2,
    });
    expect(result.selectedIndex).toBe(2);
    expect(result.selectedDatetime).toBe("2026-03-19T06:00:00Z");
  });

  it("uses previousTimeline as base when provided with requestedDatetime", () => {
    const result = rebuildTimelineState({
      datetimes: ["2026-03-19T00:00:00Z", "2026-03-19T06:00:00Z", "2026-03-19T12:00:00Z"],
      requestedDatetime: "2026-03-18T06:00:00Z",
      previousTimeline: ["2026-03-18T00:00:00Z", "2026-03-18T06:00:00Z", "2026-03-18T12:00:00Z"],
    });
    expect(result.selectedIndex).toBe(1);
    expect(result.selectedDatetime).toBe("2026-03-19T06:00:00Z");
  });
});

describe("clampSelectedIndex", () => {
  it("returns -1 for empty datetimes", () => {
    expect(clampSelectedIndex(0, [])).toBe(-1);
  });

  it("returns 0 for non-finite selectedIndex", () => {
    expect(clampSelectedIndex(Infinity, ["a", "b"])).toBe(0);
    expect(clampSelectedIndex(NaN, ["a", "b"])).toBe(0);
  });

  it("clamps index to last valid position", () => {
    expect(clampSelectedIndex(10, ["a", "b", "c"])).toBe(2);
  });

  it("clamps negative index to 0", () => {
    expect(clampSelectedIndex(-5, ["a", "b"])).toBe(0);
  });

  it("returns exact index when within bounds", () => {
    expect(clampSelectedIndex(1, ["a", "b", "c"])).toBe(1);
  });

  it("truncates fractional index", () => {
    expect(clampSelectedIndex(1.9, ["a", "b", "c"])).toBe(1);
  });
});

describe("resolveDatasetDatetime", () => {
  it("returns requested when datasetDatetimes is empty", () => {
    expect(resolveDatasetDatetime("2026-01-01T00:00:00Z", [], [])).toBe("2026-01-01T00:00:00Z");
  });

  it("returns requested when it is directly in datasetDatetimes", () => {
    const dts = ["2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"];
    expect(resolveDatasetDatetime("2026-01-01T06:00:00Z", dts, [])).toBe("2026-01-01T06:00:00Z");
  });

  it("returns first dataset datetime when baseTimeline is empty", () => {
    const dts = ["2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"];
    expect(resolveDatasetDatetime("2026-01-02T00:00:00Z", dts, [])).toBe("2026-01-01T00:00:00Z");
  });

  it("returns first dataset datetime when requested is not in baseTimeline", () => {
    const dts = ["2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"];
    const base = ["2026-01-02T00:00:00Z", "2026-01-02T06:00:00Z"];
    expect(resolveDatasetDatetime("2026-01-03T00:00:00Z", dts, base)).toBe("2026-01-01T00:00:00Z");
  });

  it("maps position proportionally from baseTimeline to datasetDatetimes", () => {
    const base = ["T0", "T1", "T2", "T3"];
    const dts = ["D0", "D1"];
    // requested is at index 3 (last), maps to last of dts
    expect(resolveDatasetDatetime("T3", dts, base)).toBe("D1");
    // requested is at index 0, maps to first of dts
    expect(resolveDatasetDatetime("T0", dts, base)).toBe("D0");
  });
});
