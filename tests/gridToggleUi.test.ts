/// <reference types="@testing-library/jest-dom" />
import { getByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { syncGridToggleButtonState } from "../src/lib/gridToggleUi";

describe("syncGridToggleButtonState", () => {
  it("updates the floating grid button active state and accessibility labels", () => {
    document.body.innerHTML = `
      <button type="button" aria-label="Grid" class="utility-icon-button"></button>
    `;
    const button = getByRole(document.body, "button", {
      name: "Grid",
    }) as HTMLButtonElement;

    syncGridToggleButtonState(button, true);
    expect(button).toHaveClass("is-active");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.title).toBe("Grid: On");

    syncGridToggleButtonState(button, false);
    expect(button).not.toHaveClass("is-active");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.title).toBe("Grid: Off");
  });
});
