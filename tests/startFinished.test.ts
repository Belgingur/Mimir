import { describe, expect, it, vi } from "vitest";
import { createStartFinished } from "../src/lib/startFinished";

// The saved forecast point is restored through this (#66). The map's `load`
// plays no part, so a basemap request that never answers can't hold it back.
describe("createStartFinished", () => {
  it("restores once after the start has ended", () => {
    const started = createStartFinished();
    const restore = vi.fn();
    started.then(restore);
    expect(restore).not.toHaveBeenCalled();
    started.finish();
    started.finish();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("restores at once when the panel's code arrives after the start", () => {
    const started = createStartFinished();
    started.finish();
    const restore = vi.fn();
    started.then(restore);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
