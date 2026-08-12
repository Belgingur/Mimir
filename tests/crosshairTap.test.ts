import { describe, expect, it } from "vitest";
import {
  classifyTouch,
  isTap,
  isWithinReticleHit,
} from "../src/lib/crosshairTap";
import {
  RETICLE_HIT_PX,
  TAP_MAX_DURATION_MS,
  TAP_MOVE_TOLERANCE_PX,
} from "../src/lib/crosshairTimings";

describe("classifyTouch — movement tolerance", () => {
  it("treats a motionless, brief touch as a tap", () => {
    expect(classifyTouch({ maxMovePx: 0, durationMs: 0 })).toBe("tap");
  });

  it("treats movement below the tolerance as a tap", () => {
    expect(
      classifyTouch({
        maxMovePx: TAP_MOVE_TOLERANCE_PX - 0.01,
        durationMs: 100,
      }),
    ).toBe("tap");
  });

  it("treats movement exactly at the tolerance as a tap", () => {
    expect(
      classifyTouch({ maxMovePx: TAP_MOVE_TOLERANCE_PX, durationMs: 100 }),
    ).toBe("tap");
  });

  it("treats movement just past the tolerance as a pan", () => {
    expect(
      classifyTouch({
        maxMovePx: TAP_MOVE_TOLERANCE_PX + 0.01,
        durationMs: 100,
      }),
    ).toBe("pan");
  });

  it("treats a long drag as a pan however brief", () => {
    expect(classifyTouch({ maxMovePx: 400, durationMs: 20 })).toBe("pan");
  });
});

describe("classifyTouch — duration limit", () => {
  it("treats a touch exactly at the duration limit as a tap", () => {
    expect(
      classifyTouch({ maxMovePx: 0, durationMs: TAP_MAX_DURATION_MS }),
    ).toBe("tap");
  });

  it("treats a touch just past the duration limit as a pan", () => {
    expect(
      classifyTouch({ maxMovePx: 0, durationMs: TAP_MAX_DURATION_MS + 1 }),
    ).toBe("pan");
  });

  it("treats a motionless long press as a pan, not a tap", () => {
    expect(classifyTouch({ maxMovePx: 2, durationMs: 1500 })).toBe("pan");
  });
});

describe("classifyTouch — thresholds are independent", () => {
  it("fails on movement even when the duration is fine", () => {
    expect(
      classifyTouch({
        maxMovePx: TAP_MOVE_TOLERANCE_PX + 5,
        durationMs: TAP_MAX_DURATION_MS - 50,
      }),
    ).toBe("pan");
  });

  it("fails on duration even when the movement is fine", () => {
    expect(
      classifyTouch({
        maxMovePx: TAP_MOVE_TOLERANCE_PX - 5,
        durationMs: TAP_MAX_DURATION_MS + 50,
      }),
    ).toBe("pan");
  });
});

describe("classifyTouch — custom thresholds", () => {
  it("honours injected tolerances", () => {
    const timings = { TAP_MOVE_TOLERANCE_PX: 2, TAP_MAX_DURATION_MS: 50 };
    expect(classifyTouch({ maxMovePx: 3, durationMs: 10 }, timings)).toBe("pan");
    expect(classifyTouch({ maxMovePx: 1, durationMs: 60 }, timings)).toBe("pan");
    expect(classifyTouch({ maxMovePx: 1, durationMs: 10 }, timings)).toBe("tap");
  });
});

describe("classifyTouch — degenerate input", () => {
  it("refuses to call NaN or negative measurements a tap", () => {
    expect(classifyTouch({ maxMovePx: Number.NaN, durationMs: 10 })).toBe("pan");
    expect(classifyTouch({ maxMovePx: 1, durationMs: Number.NaN })).toBe("pan");
    expect(classifyTouch({ maxMovePx: -1, durationMs: 10 })).toBe("pan");
    // A clock that ran backwards must not be read as an instant tap.
    expect(classifyTouch({ maxMovePx: 1, durationMs: -5 })).toBe("pan");
    expect(
      classifyTouch({ maxMovePx: Number.POSITIVE_INFINITY, durationMs: 10 }),
    ).toBe("pan");
  });
});

describe("isTap", () => {
  it("agrees with classifyTouch", () => {
    expect(isTap({ maxMovePx: 1, durationMs: 100 })).toBe(true);
    expect(isTap({ maxMovePx: 50, durationMs: 100 })).toBe(false);
  });
});

describe("isWithinReticleHit", () => {
  // A 360×640 phone viewport: the reticle sits at (180, 320).
  const rect = { left: 0, top: 0, width: 360, height: 640 };

  it("accepts a touch dead on the map centre", () => {
    expect(isWithinReticleHit({ clientX: 180, clientY: 320 }, rect)).toBe(true);
  });

  it("accepts a touch at the very corner of the hit box", () => {
    const half = RETICLE_HIT_PX / 2;
    expect(
      isWithinReticleHit(
        { clientX: 180 + half, clientY: 320 + half },
        rect,
      ),
    ).toBe(true);
  });

  it("rejects a touch just outside the hit box", () => {
    const half = RETICLE_HIT_PX / 2;
    expect(
      isWithinReticleHit({ clientX: 180 + half + 1, clientY: 320 }, rect),
    ).toBe(false);
    expect(
      isWithinReticleHit({ clientX: 180, clientY: 320 + half + 1 }, rect),
    ).toBe(false);
  });

  it("rejects a touch elsewhere on the map", () => {
    expect(isWithinReticleHit({ clientX: 20, clientY: 60 }, rect)).toBe(false);
  });

  it("accounts for a container that is offset in the viewport", () => {
    // Map inset below a header: centre is at (100 + 180, 80 + 320).
    const offset = { left: 100, top: 80, width: 360, height: 640 };
    expect(isWithinReticleHit({ clientX: 280, clientY: 400 }, offset)).toBe(
      true,
    );
    expect(isWithinReticleHit({ clientX: 180, clientY: 320 }, offset)).toBe(
      false,
    );
  });

  it("honours a custom hit size", () => {
    // 25px from centre: outside a 44px box (half = 22), inside a 60px one.
    expect(isWithinReticleHit({ clientX: 205, clientY: 320 }, rect, 44)).toBe(
      false,
    );
    expect(isWithinReticleHit({ clientX: 205, clientY: 320 }, rect, 60)).toBe(
      true,
    );
  });
});
