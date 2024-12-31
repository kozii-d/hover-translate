import { state } from "../state/stateManager.ts";

export class KeyboardService {
  constructor() {
    this.initKeyboardListeners();
  }

  private initKeyboardListeners() {
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.shiftKey) {
      state.isSelecting = true;
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!event.shiftKey) {
      state.isSelecting = false;
    }
  };
}