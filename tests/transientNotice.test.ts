import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTransientNotice } from "../src/lib/transientNotice";

const build = (durationMs?: number) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const notice = createTransientNotice(parent, { durationMs });
  const root = parent.querySelector(".transient-notice") as HTMLElement;
  return { notice, root, text: root.querySelector(".new-run-notice__text") as HTMLElement };
};

beforeEach(() => {
  document.body.replaceChildren();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTransientNotice", () => {
  it("shows one sentence and takes itself away after its duration", () => {
    const { notice, root, text } = build(1000);
    expect(root.hidden).toBe(true);
    notice.show("No forecast here.");
    expect(root.hidden).toBe(false);
    expect(text.textContent).toBe("No forecast here.");
    vi.advanceTimersByTime(999);
    expect(root.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root.hidden).toBe(true);
  });

  it("lets one message stay up longer than the default", () => {
    const { notice, root } = build(1000);
    notice.show("Location is blocked for this site.", 3000);
    vi.advanceTimersByTime(2999);
    expect(root.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(root.hidden).toBe(true);
    // The next message is back on the default clock.
    notice.show("No forecast here.");
    vi.advanceTimersByTime(1000);
    expect(root.hidden).toBe(true);
  });
});
