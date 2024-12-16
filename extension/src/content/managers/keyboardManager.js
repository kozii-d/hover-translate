export class KeyboardManager {
  constructor(state) {
    this.state = state;
    this.initializeKeyboardListeners();
  }

  initializeKeyboardListeners() {
    document.addEventListener("keydown", (event) => {
      if (event.shiftKey) {
        this.state.isSelecting = true;
      }
    });

    document.addEventListener("keyup", (event) => {
      if (!event.shiftKey) {
        this.state.isSelecting = false;
      }
    });
  }
}