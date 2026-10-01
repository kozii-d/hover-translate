/**
 * Whether Shift is held, as the last keyboard event in this frame told.
 *
 * Chrome outside macOS sends some boundary events with no modifiers at all, so
 * their `shiftKey` is false while Shift is down: those of a pointer that did
 * not move, when the words of an auto-generated caption shift under it as the
 * line grows (crbug.com/538289), and right after a real move, a second set
 * without them (Chromium 153). Firefox and Chrome on macOS fill it in.
 */
let shiftHeld = false;

const remember = (event: KeyboardEvent) => {
  shiftHeld = event.shiftKey;
};

/**
 * Starts following the keyboard; once per frame. Capture on `window` hears a
 * key before the player does, and nothing is stopped or prevented.
 */
export const trackShiftKey = (): void => {
  window.addEventListener("keydown", remember, true);
  window.addEventListener("keyup", remember, true);
  // A Shift released in another window (Alt+Tab) sends no keyup here.
  window.addEventListener("blur", () => {
    shiftHeld = false;
  });
};

/** Whether Shift is down during `event`, even when the event does not say so. */
export const isShiftHeld = (event: MouseEvent): boolean => event.shiftKey || shiftHeld;
