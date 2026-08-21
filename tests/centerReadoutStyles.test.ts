import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * jsdom has no layout engine, so the geometric acceptance criteria (reserved
 * slot width, 44pt hit target, no clipping at 320pt) cannot be *measured* in a
 * unit test — those are verified on the manual device matrix.
 *
 * What is worth locking down here is that the declarations those criteria depend
 * on still exist: this file is the guard against someone quietly deleting the
 * width reservation or the overflow clamp and only finding out on a phone.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/styles/components/center-readout.css"),
  "utf8",
);

/** The declaration block for a selector, as written. */
function ruleFor(selector: string): string {
  const index = css.indexOf(`${selector} {`);
  expect(index, `missing rule for "${selector}"`).toBeGreaterThan(-1);
  const open = css.indexOf("{", index);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("center-readout.css — reserved action slot", () => {
  it("gives the slot a fixed, non-shrinking width", () => {
    const rule = ruleFor(".center-readout__action");
    // flex-basis fixed and both grow/shrink zero: the slot occupies its width
    // whether or not the button is visible, so the pill never moves sideways.
    expect(rule).toMatch(/flex:\s*0\s+0\s+var\(--crosshair-hit\)/);
    expect(rule).toMatch(/width:\s*var\(--crosshair-hit\)/);
  });

  it("fades the slot's contents rather than removing the slot", () => {
    expect(ruleFor(".center-readout__action")).toMatch(/opacity:\s*0/);
    expect(ruleFor(".center-readout__action")).not.toMatch(/display:\s*none/);
  });

  it("shows the chip for as long as the crosshair is visible, mid-pan included", () => {
    expect(
      ruleFor(".center-readout--transient.is-visible .center-readout__action"),
    ).toMatch(/opacity:\s*1/);
  });

  it("keeps the chip non-interactive until the map settles", () => {
    // Visible early but not hittable: grabbing a still-coasting map must not be
    // swallowed by the chip. So the visible rule must NOT grant pointer events.
    expect(
      ruleFor(".center-readout--transient.is-visible .center-readout__action"),
    ).not.toMatch(/pointer-events/);
  });

  it("sizes the hit target at 44px", () => {
    expect(ruleFor(".center-readout--transient")).toMatch(
      /--crosshair-hit:\s*44px/,
    );
    const button = ruleFor(".center-readout__action > button");
    expect(button).toMatch(/min-width:\s*var\(--crosshair-hit\)/);
    expect(button).toMatch(/min-height:\s*var\(--crosshair-hit\)/);
  });

  it("only accepts pointer events while the action is offered", () => {
    expect(ruleFor(".center-readout__action")).toMatch(
      /pointer-events:\s*none/,
    );
    expect(
      ruleFor(".center-readout--transient.is-actionable .center-readout__action"),
    ).toMatch(/pointer-events:\s*auto/);
  });

  it("leaves the reticle non-interactive so a pinch on it reaches the map", () => {
    expect(ruleFor(".center-readout__reticle")).toMatch(
      /pointer-events:\s*none/,
    );
  });
});

describe("center-readout.css — overflow at narrow viewports", () => {
  it("clamps the group to the viewport, minus the safe-area insets", () => {
    const rule = ruleFor(".center-readout__group");
    expect(rule).toMatch(/max-width:/);
    expect(rule).toMatch(/--safe-area-left/);
    expect(rule).toMatch(/--safe-area-right/);
  });

  it("lets the pill truncate rather than push the group off screen", () => {
    const rule = ruleFor(".center-readout--transient .center-readout__value");
    expect(rule).toMatch(/min-width:\s*0/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/overflow:\s*hidden/);
  });
});

describe("center-readout.css — layering and motion", () => {
  it("sits on the shared z-index scale, below the legend and timeline", () => {
    expect(ruleFor(".center-readout")).toMatch(/z-index:\s*var\(--z-crosshair\)/);
  });

  it("blocks text selection on the overlay", () => {
    const rule = ruleFor(".center-readout");
    expect(rule).toMatch(/user-select:\s*none/);
    expect(rule).toMatch(/-webkit-user-select:\s*none/);
  });

  it("scales the reticle on enter via an animation, so exit is a pure fade", () => {
    expect(css).toMatch(/@keyframes center-readout-pop/);
    expect(
      ruleFor(".center-readout--transient.is-visible .center-readout__reticle"),
    ).toMatch(/animation:\s*center-readout-pop/);
    // The resting rule must not carry a scale, or leaving would animate it back.
    expect(ruleFor(".center-readout__reticle")).not.toMatch(/scale\(/);
  });

  it("drops the animation under prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion"));
    expect(block).toMatch(/transition:\s*none/);
    expect(block).toMatch(/animation:\s*none/);
  });
});

describe("center-readout.css — legacy variant is untouched", () => {
  it("keeps the previous absolute pill positioning scoped away from the group", () => {
    const rule = ruleFor(
      ".center-readout:not(.center-readout--transient) .center-readout__value",
    );
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*-26px/);
    expect(rule).toMatch(/max-width:\s*min\(280px, calc\(100vw - 32px\)\)/);
  });
});
