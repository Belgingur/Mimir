import { describe, expect, it, vi } from "vitest";
import { createLocateForecast } from "../src/lib/locateForecast";

const HERE = { lat: 64.15, lon: -21.94 };

function setup(opts: { wide: boolean; canOpen?: boolean }) {
  const open = vi.fn();
  const locate = createLocateForecast({
    opensByItself: () => opts.wide,
    canOpen: () => opts.canOpen ?? true,
    open,
  });
  return { locate, open };
}

describe("createLocateForecast (#84)", () => {
  it("opens the forecast once after a fix on a wide fine-pointer screen", () => {
    const { locate, open } = setup({ wide: true });
    locate.located(HERE);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(HERE);
  });

  it("doesn't open it by itself on a touch screen", () => {
    const { locate, open } = setup({ wide: false });
    locate.located(HERE);
    expect(open).not.toHaveBeenCalled();
  });

  it("doesn't open it where a map click wouldn't (icons view, waves)", () => {
    const { locate, open } = setup({ wide: true, canOpen: false });
    locate.located(HERE);
    expect(open).not.toHaveBeenCalled();
  });

  it("opens it from a tap on the dot, without the map seeing the click", () => {
    const { locate, open } = setup({ wide: false });
    const map = document.createElement("div");
    const dot = document.createElement("div");
    map.appendChild(dot);
    const mapClick = vi.fn();
    map.addEventListener("click", mapClick);
    locate.bindDot(dot, () => HERE);

    dot.click();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(HERE);
    expect(mapClick).not.toHaveBeenCalled();
    expect(dot.getAttribute("role")).toBe("button");
  });

  it("opens it from Enter on the focused dot", () => {
    const { locate, open } = setup({ wide: false });
    const dot = document.createElement("div");
    locate.bindDot(dot, () => HERE);
    dot.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("does nothing from the dot once the position is lost", () => {
    const { locate, open } = setup({ wide: false });
    const dot = document.createElement("div");
    locate.bindDot(dot, () => null);
    dot.click();
    expect(open).not.toHaveBeenCalled();
  });
});
