import { describe, expect, it } from "vitest";
import { resolveBuildCommit, versionJson } from "../src/lib/buildInfo";

describe("resolveBuildCommit", () => {
  it("uses git's short SHA for a clean checkout", () => {
    expect(resolveBuildCommit({ shortSha: "1a2b3c4", dirty: false }, undefined)).toBe("1a2b3c4");
  });

  it("marks a checkout with local changes as dirty", () => {
    expect(resolveBuildCommit({ shortSha: "1a2b3c4\n", dirty: true }, undefined)).toBe("1a2b3c4-dirty");
  });

  it("prefers git over the environment variable", () => {
    expect(resolveBuildCommit({ shortSha: "1a2b3c4", dirty: false }, "abc1234")).toBe("1a2b3c4");
  });

  it("falls back to the environment variable without git", () => {
    expect(resolveBuildCommit(null, " abc1234 ")).toBe("abc1234");
  });

  it("falls back to unknown when neither is there", () => {
    expect(resolveBuildCommit(null, undefined)).toBe("unknown");
    expect(resolveBuildCommit(null, "")).toBe("unknown");
  });

  it("rejects values that don't look like a commit", () => {
    expect(resolveBuildCommit({ shortSha: "", dirty: true }, "abc1234")).toBe("abc1234");
    expect(resolveBuildCommit(null, '"><script>')).toBe("unknown");
    expect(resolveBuildCommit(null, "a b")).toBe("unknown");
    expect(resolveBuildCommit(null, "x".repeat(65))).toBe("unknown");
  });
});

describe("versionJson", () => {
  it("writes the commit and the build time as ISO", () => {
    const text = versionJson("1a2b3c4", new Date(Date.UTC(2026, 10, 10, 12, 0, 0)));
    expect(JSON.parse(text)).toEqual({ commit: "1a2b3c4", builtAt: "2026-11-10T12:00:00.000Z" });
    expect(text.endsWith("\n")).toBe(true);
  });
});
