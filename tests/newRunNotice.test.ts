import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNewRunNotice } from "../src/lib/newRunNotice";

const build = (onAction = vi.fn(), strings = { locale: "en" }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const notice = createNewRunNotice(parent, {
    message: () => `newer run (${strings.locale})`,
    actionLabel: () => `update forecast (${strings.locale})`,
    dismissLabel: () => `dismiss (${strings.locale})`,
    onAction,
  });
  const root = parent.querySelector(".new-run-notice") as HTMLElement;
  return {
    notice,
    root,
    onAction,
    strings,
    action: root.querySelector(".new-run-notice__action") as HTMLButtonElement,
    dismiss: root.querySelector(".new-run-notice__dismiss") as HTMLButtonElement,
    text: root.querySelector(".new-run-notice__text") as HTMLElement,
  };
};

beforeEach(() => {
  document.body.replaceChildren();
});

describe("createNewRunNotice", () => {
  it("starts hidden — it must not appear before there is news", () => {
    const { root } = build();
    expect(root.hidden).toBe(true);
  });

  it("announces politely rather than interrupting", () => {
    const { root } = build();
    expect(root.getAttribute("aria-live")).toBe("polite");
  });

  it("shows and hides", () => {
    const { notice, root } = build();
    notice.show();
    expect(root.hidden).toBe(false);
    notice.hide();
    expect(root.hidden).toBe(true);
  });

  it("runs the action when the reader accepts", () => {
    const { notice, action, onAction } = build();
    notice.show();
    action.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("stays dismissed once declined, so it cannot nag on every refocus", () => {
    const { notice, root, dismiss } = build();
    notice.show();
    dismiss.click();
    expect(root.hidden).toBe(true);
    expect(notice.isDismissed()).toBe(true);
    // The whole point: a later show() is a no-op.
    notice.show();
    expect(root.hidden).toBe(true);
  });

  it("is not dismissed before the reader declines", () => {
    const { notice } = build();
    expect(notice.isDismissed()).toBe(false);
  });

  it("resolves its strings on show, so a locale switch still reaches it", () => {
    const { notice, text, action, dismiss, strings } = build();
    notice.show();
    expect(text.textContent).toBe("newer run (en)");
    // Locale changes after construction; the pill must not be holding the old
    // strings captured at build time.
    strings.locale = "is";
    notice.hide();
    notice.show();
    expect(text.textContent).toBe("newer run (is)");
    expect(action.textContent).toBe("update forecast (is)");
    expect(dismiss.getAttribute("aria-label")).toBe("dismiss (is)");
  });
});
