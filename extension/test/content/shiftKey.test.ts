// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isShiftHeld, trackShiftKey } from "../../src/content/utils/shiftKey.ts";

// A boundary event as Chrome sends it outside macOS after the page moved
// under a resting pointer: no modifiers, whatever the keyboard holds.
const withoutModifiers = () => new PointerEvent("pointerleave");

const key = (type: "keydown" | "keyup", init: KeyboardEventInit) => {
  // Sent to an element: the listeners capture on `window`, above the page.
  document.body.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }));
};

describe("isShiftHeld", () => {
  beforeAll(() => {
    // The module keeps one state per frame, as the content script does.
    trackShiftKey();
  });

  beforeEach(() => {
    window.dispatchEvent(new Event("blur"));
  });

  it("goes by the event alone until a key says otherwise", () => {
    expect(isShiftHeld(withoutModifiers())).toBe(false);
    expect(isShiftHeld(new PointerEvent("pointerleave", { shiftKey: true }))).toBe(true);
  });

  it("remembers Shift pressed, for events that come without it", () => {
    key("keydown", { key: "Shift", shiftKey: true });
    expect(isShiftHeld(withoutModifiers())).toBe(true);
  });

  it("forgets it once Shift is released", () => {
    key("keydown", { key: "Shift", shiftKey: true });
    key("keyup", { key: "Shift", shiftKey: false });
    expect(isShiftHeld(withoutModifiers())).toBe(false);
  });

  it("takes the Shift of any key, pressed or released", () => {
    key("keydown", { key: "A", shiftKey: true });
    expect(isShiftHeld(withoutModifiers())).toBe(true);
    key("keyup", { key: "a", shiftKey: false });
    expect(isShiftHeld(withoutModifiers())).toBe(false);
  });

  it("forgets it when the window loses focus: the keyup goes to another window", () => {
    key("keydown", { key: "Shift", shiftKey: true });
    window.dispatchEvent(new Event("blur"));
    expect(isShiftHeld(withoutModifiers())).toBe(false);
  });

  it("an element losing focus inside the page is not the window losing it", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    key("keydown", { key: "Shift", shiftKey: true });
    input.blur();
    expect(isShiftHeld(withoutModifiers())).toBe(true);
    input.remove();
  });

  it("never stops or cancels the key on its way to the page", () => {
    const event = new KeyboardEvent("keydown", { key: "Shift", shiftKey: true, bubbles: true, cancelable: true });
    let reachedPage = false;
    document.body.addEventListener("keydown", () => { reachedPage = true; }, { once: true });
    document.body.dispatchEvent(event);
    expect(reachedPage).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
