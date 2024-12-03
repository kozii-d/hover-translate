import { state } from "./variables.js";

export function initializeKeyboardListeners() {
  document.addEventListener("keydown", (event) => {
    if (event.altKey) {
      state.isSelecting = true;
    }
  });

  document.addEventListener("keyup", (event) => {
    if (!event.altKey) {
      state.isSelecting = false;
    }
  });
}