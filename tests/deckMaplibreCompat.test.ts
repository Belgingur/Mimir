import { describe, expect, it } from "vitest";
import { restoreMapTransformForDeck } from "../src/lib/deckMaplibreCompat";

describe("restoreMapTransformForDeck", () => {
  it("exposes the maplibre-gl 6 camera transform as map.transform", () => {
    const transform = { height: 800 };
    const map = { _camera: { transform } };
    restoreMapTransformForDeck(map as never);
    expect((map as { transform?: unknown }).transform).toBe(transform);
  });

  it("follows the camera when maplibre swaps its transform", () => {
    const camera = { transform: { height: 800 } };
    const map = { _camera: camera };
    restoreMapTransformForDeck(map as never);

    const next = { height: 600 };
    camera.transform = next;
    expect((map as { transform?: unknown }).transform).toBe(next);
  });

  it("leaves a map that already has a transform untouched", () => {
    const own = { height: 800 };
    const map = { transform: own, _camera: { transform: { height: 1 } } };
    restoreMapTransformForDeck(map as never);
    expect(map.transform).toBe(own);
  });

  it("does nothing when there is no camera to read from", () => {
    const map = {};
    restoreMapTransformForDeck(map as never);
    expect("transform" in map).toBe(false);
  });
});
