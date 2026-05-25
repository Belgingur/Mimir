import { describe, it, expect } from "vitest";
import {
  buildWavePeriodLabelsFromContours,
  buildMslpLabelsFromContours,
} from "../src/lib/contourLabels";

describe("buildWavePeriodLabelsFromContours", () => {
  it("returns empty array for empty paths", () => {
    expect(buildWavePeriodLabelsFromContours([], 5)).toEqual([]);
  });

  it("produces labels for even-valued contours >= 2", () => {
    const paths = [
      {
        path: [
          [0, 0],
          [10, 0],
          [10, 10],
        ] as [number, number][],
        value: 4,
      },
      {
        path: [
          [20, 0],
          [30, 0],
          [30, 10],
        ] as [number, number][],
        value: 6,
      },
    ];
    const labels = buildWavePeriodLabelsFromContours(paths, 1);
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe("4");
    expect(labels[1].text).toBe("6");
  });

  it("skips odd values", () => {
    const paths = [
      {
        path: [
          [0, 0],
          [10, 0],
        ] as [number, number][],
        value: 3,
      },
    ];
    expect(buildWavePeriodLabelsFromContours(paths, 1)).toHaveLength(0);
  });

  it("skips values less than 2", () => {
    const paths = [
      {
        path: [
          [0, 0],
          [10, 0],
        ] as [number, number][],
        value: 0,
      },
      {
        path: [
          [0, 0],
          [10, 0],
        ] as [number, number][],
        value: 1,
      },
    ];
    expect(buildWavePeriodLabelsFromContours(paths, 1)).toHaveLength(0);
  });

  it("skips paths with fewer than 2 points", () => {
    const paths = [{ path: [[5, 5]] as [number, number][], value: 4 }];
    expect(buildWavePeriodLabelsFromContours(paths, 1)).toHaveLength(0);
  });

  it("enforces minimum spacing between labels", () => {
    const paths = [
      {
        path: [
          [0, 0],
          [1, 0],
        ] as [number, number][],
        value: 4,
      },
      {
        path: [
          [0.1, 0],
          [1.1, 0],
        ] as [number, number][],
        value: 6,
      },
    ];
    const labels = buildWavePeriodLabelsFromContours(paths, 100);
    expect(labels).toHaveLength(1);
  });

  it("places label at path midpoint", () => {
    const paths = [
      {
        path: [
          [0, 0],
          [10, 0],
        ] as [number, number][],
        value: 4,
      },
    ];
    const labels = buildWavePeriodLabelsFromContours(paths, 1);
    expect(labels[0].position[0]).toBeCloseTo(5, 1);
    expect(labels[0].position[1]).toBeCloseTo(0, 1);
  });
});

describe("buildMslpLabelsFromContours", () => {
  it("returns empty array for empty contours", () => {
    expect(buildMslpLabelsFromContours([])).toEqual([]);
  });

  it("produces labels for values divisible by step", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
          [15, 15],
        ] as [number, number][],
        value: 1020,
      },
      {
        path: [
          [20, 20],
          [25, 25],
          [30, 30],
          [35, 35],
        ] as [number, number][],
        value: 1010,
      },
    ];
    const labels = buildMslpLabelsFromContours(contours, 10);
    expect(labels).toHaveLength(2);
    expect(labels.map((l) => l.text)).toContain("1020");
    expect(labels.map((l) => l.text)).toContain("1010");
  });

  it("skips values not divisible by step", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
          [15, 15],
        ] as [number, number][],
        value: 1013,
      },
    ];
    expect(buildMslpLabelsFromContours(contours, 10)).toHaveLength(0);
  });

  it("deduplicates same rounded values", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
          [15, 15],
        ] as [number, number][],
        value: 1020,
      },
      {
        path: [
          [20, 20],
          [25, 25],
          [30, 30],
          [35, 35],
        ] as [number, number][],
        value: 1020.3,
      },
    ];
    const labels = buildMslpLabelsFromContours(contours, 10);
    expect(labels).toHaveLength(1);
  });

  it("skips paths with fewer than 4 points", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
        ] as [number, number][],
        value: 1020,
      },
    ];
    expect(buildMslpLabelsFromContours(contours, 10)).toHaveLength(0);
  });

  it("defaults step to 10", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
          [15, 15],
        ] as [number, number][],
        value: 1005,
      },
    ];
    expect(buildMslpLabelsFromContours(contours)).toHaveLength(0);
    const contours2 = [
      {
        path: [
          [0, 0],
          [5, 5],
          [10, 10],
          [15, 15],
        ] as [number, number][],
        value: 1010,
      },
    ];
    expect(buildMslpLabelsFromContours(contours2)).toHaveLength(1);
  });

  it("places label at midpoint of path", () => {
    const contours = [
      {
        path: [
          [0, 0],
          [2, 2],
          [4, 4],
          [6, 6],
          [8, 8],
        ] as [number, number][],
        value: 1020,
      },
    ];
    const labels = buildMslpLabelsFromContours(contours, 10);
    expect(labels[0].position).toEqual([4, 4]);
  });
});
