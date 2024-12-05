export class KeyboardManager {
  constructor(state) {
    this.state = state;
  }

  initializeKeyboardListeners() {
    document.addEventListener("keydown", (event) => {
      if (event.altKey) {
        this.state.isSelecting = true;
      }
    });

    document.addEventListener("keyup", (event) => {
      if (!event.altKey) {
        this.state.isSelecting = false;
      }
    });
  }
}