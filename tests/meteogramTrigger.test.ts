import { afterEach, describe, expect, it, vi } from "vitest";
import { createMeteogramTrigger } from "../src/features/meteogram/meteogramTrigger";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createMeteogramTrigger", () => {
  it("appends the meteogram button to the mount (zoom-buttons stack)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const trigger = createMeteogramTrigger({
      mount: container,
      isMeteogramTarget: () => true,
      onActivate: () => {},
    });
    expect(container.contains(trigger.el)).toBe(true);
    expect(trigger.el.classList.contains("zoom-buttons__meteogram")).toBe(true);
  });

  it("toggles is-available from isMeteogramTarget on refresh", () => {
    const container = document.createElement("div");
    let target = false;
    const trigger = createMeteogramTrigger({
      mount: container,
      isMeteogramTarget: () => target,
      onActivate: () => {},
    });
    expect(trigger.el.classList.contains("is-available")).toBe(false);
    target = true;
    trigger.refresh();
    expect(trigger.el.classList.contains("is-available")).toBe(true);
    target = false;
    trigger.refresh();
    expect(trigger.el.classList.contains("is-available")).toBe(false);
  });

  it("invokes onActivate when clicked and stops after destroy", () => {
    const container = document.createElement("div");
    const onActivate = vi.fn();
    const trigger = createMeteogramTrigger({
      mount: container,
      isMeteogramTarget: () => true,
      onActivate,
    });
    trigger.el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(1);

    const el = trigger.el;
    trigger.destroy();
    expect(container.contains(el)).toBe(false);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("defaults to the control-stack variant", () => {
    const trigger = createMeteogramTrigger({
      mount: document.createElement("div"),
      isMeteogramTarget: () => true,
      onActivate: () => {},
    });
    expect(trigger.el.classList.contains("zoom-buttons__meteogram")).toBe(true);
    expect(trigger.el.classList.contains("center-readout__meteogram")).toBe(
      false,
    );
  });

  it("styles as a crosshair-attached chip when asked", () => {
    const slot = document.createElement("span");
    const trigger = createMeteogramTrigger({
      mount: slot,
      variant: "crosshair",
      isMeteogramTarget: () => true,
      onActivate: () => {},
    });
    expect(slot.contains(trigger.el)).toBe(true);
    expect(trigger.el.classList.contains("center-readout__meteogram")).toBe(
      true,
    );
    expect(trigger.el.classList.contains("zoom-buttons__meteogram")).toBe(false);
    // Availability gating still applies in the crosshair slot.
    expect(trigger.el.classList.contains("is-available")).toBe(true);
  });

  it("carries an accessible name in both variants", () => {
    for (const variant of ["stack", "crosshair"] as const) {
      const trigger = createMeteogramTrigger({
        mount: document.createElement("div"),
        variant,
        isMeteogramTarget: () => true,
        onActivate: () => {},
      });
      expect(trigger.el.getAttribute("aria-label")).toBeTruthy();
      expect(trigger.el.type).toBe("button");
    }
  });
});
