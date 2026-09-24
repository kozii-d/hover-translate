import { CAPTION_WINDOW, PLAYER_CONTROLS_LAYER, TOOLTIP_WORD_CLASS } from "../consts/consts.ts";

/**
 * Where the pointer is in the captions when something else is on top of them:
 * the caption window under it and, unless it is between words, the word.
 */
export interface CoveredCaption {
  captionWindow: Element;
  word: Element | null;
}

/**
 * Elements whose click is meant for them even when a caption word lies
 * underneath: a player button drawn over the captions keeps working.
 */
const INTERACTIVE_ELEMENTS = [
  "a[href]", "button", "input", "select", "textarea",
  "[role=\"button\"]", "[role=\"link\"]", "[role=\"slider\"]", "[role=\"menuitem\"]", "[role=\"checkbox\"]",
].join(", ");

/** The mouse events a click on a covered word must not deliver to the player. */
const CLICK_EVENTS = ["mousedown", "mouseup", "click"] as const;

const toElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
};

const containsPoint = (element: Element, x: number, y: number): boolean => {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return x >= left && x < right && y >= top && y < bottom;
};

/**
 * The caption under the point `(x, y)` when the event aimed there went to the
 * player's controls layer instead — or null when there is nothing to hand
 * over: the event already goes to the captions, the point is outside them, or
 * the element on top is something else.
 *
 * Only the controls layer counts, because it is the one thing drawn over the
 * captions that the viewer looks through. Everything else on top of them is
 * meant to be on top: a button or the progress bar of that very layer, the
 * player's own chrome (an auto-generated line can pass under the time display
 * on the watch page), a YouTube dialog and its backdrop, a menu of the page's
 * header. Handing the pointer through any of those would translate a word the
 * viewer cannot see and take clicks away from YouTube.
 */
export const findCoveredCaption = (
  target: EventTarget | null,
  x: number,
  y: number,
): CoveredCaption | null => {
  const element = toElement(target);
  if (
    !element ||
    element.closest(`.${CAPTION_WINDOW}`) ||
    !element.closest(`.${PLAYER_CONTROLS_LAYER}`) ||
    element.closest(INTERACTIVE_ELEMENTS)
  ) {
    return null;
  }

  // This runs on every pointer move over the page, so the boxes of the caption
  // windows are checked before asking the browser to hit-test the point.
  const captionWindows = Array.from(document.getElementsByClassName(CAPTION_WINDOW));
  if (!captionWindows.some((captionWindow) => containsPoint(captionWindow, x, y))) return null;

  const elements = document.elementsFromPoint(x, y);
  const captionWindow = elements.find((el) => el.classList.contains(CAPTION_WINDOW));
  if (!captionWindow) return null;

  const word = elements.find(
    (el) => el.classList.contains(TOOLTIP_WORD_CLASS) && captionWindow.contains(el),
  ) ?? null;

  return { captionWindow, word };
};

/**
 * Hands the pointer to caption words that the player's controls layer covers.
 *
 * The embedded player YouTube rolled out in 2026 draws its controls layer
 * (`#player-controls`, full-size and accepting the mouse) above the captions,
 * which live in the stacking context of `#movie_player`, so the words never
 * got a pointer event: no translation, no auto-pause, no click to save. No CSS
 * can lift the captions without burying the player's buttons under the video,
 * so this service listens on the document in the capture phase instead, finds
 * the word under the pointer with `elementsFromPoint`, and sends it — and its
 * caption window — the pointer events the browser would have sent had nothing
 * covered them.
 *
 * It only acts when a word is under the pointer and the event went to that
 * layer (see `findCoveredCaption`) — the question is what covers the word, not
 * which player this is. Wherever the words are on top (the watch page today)
 * the browser's own events reach them and nothing here fires, and should
 * YouTube bring the layer to the watch page, it works there by itself.
 *
 * `pointerenter`/`pointerleave` are kept consistent with the browser's own
 * when the layer comes and goes under a still pointer: a word that becomes
 * uncovered is handed back without a second enter, and one that becomes
 * covered is taken over without a leave.
 */
export class CoveredCaptionPointerService {
  /** The covered word and caption window last sent `pointerenter`, not yet `pointerleave`. */
  private word: Element | null = null;
  private captionWindow: Element | null = null;

  /**
   * Covered elements the pointer is now over natively. The browser is about
   * to send them its own `pointerenter`, which would be their second one.
   */
  private readonly handedBack = new Set<Element>();

  /** A press on a covered word: the rest of that click is the word's too. */
  private pressOnWord = false;

  /** Set while an event of ours is being dispatched, so the listeners below skip it. */
  private forwarding = false;

  constructor() {
    document.addEventListener("pointerover", this.handlePointerOver, true);
    document.addEventListener("pointermove", this.handlePointerMove, true);
    document.addEventListener("pointerdown", this.handlePointerDown, true);
    document.addEventListener("pointerup", this.handlePointerUp, true);
    document.addEventListener("pointercancel", this.handlePointerCancel, true);
    document.addEventListener("pointerout", this.handlePointerOut, true);
    document.addEventListener("pointerenter", this.handleNativeEnter, true);
    document.addEventListener("pointerleave", this.handleNativeLeave, true);
    CLICK_EVENTS.forEach((type) => document.addEventListener(type, this.handleClickEvent, true));
  }

  public destroy(): void {
    document.removeEventListener("pointerover", this.handlePointerOver, true);
    document.removeEventListener("pointermove", this.handlePointerMove, true);
    document.removeEventListener("pointerdown", this.handlePointerDown, true);
    document.removeEventListener("pointerup", this.handlePointerUp, true);
    document.removeEventListener("pointercancel", this.handlePointerCancel, true);
    document.removeEventListener("pointerout", this.handlePointerOut, true);
    document.removeEventListener("pointerenter", this.handleNativeEnter, true);
    document.removeEventListener("pointerleave", this.handleNativeLeave, true);
    CLICK_EVENTS.forEach((type) => document.removeEventListener(type, this.handleClickEvent, true));

    this.word = null;
    this.captionWindow = null;
    this.handedBack.clear();
    this.pressOnWord = false;
  }

  /**
   * `pointerover` comes before the browser's `pointerenter`s, so a covered word
   * the pointer is leaving for an uncovered one gets its `pointerleave` first,
   * in the order the browser itself would have sent them.
   */
  private handlePointerOver = (event: PointerEvent): void => {
    if (this.forwarding) return;
    this.track(event);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.forwarding) return;

    // Every `pointerenter` of the move that brought the pointer here is over.
    this.handedBack.clear();
    this.track(event);

    // The drag guard of the word counts the distance from the press.
    if (this.word) this.forward(this.word, "pointermove", event);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.forwarding) return;

    this.pressOnWord = false;
    this.track(event);
    if (!this.word) return;

    this.pressOnWord = true;
    this.forward(this.word, "pointerdown", event);
    this.keepFromPlayer(event);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.forwarding) return;

    this.track(event);
    // Released away from the word, the word gets nothing — as without the
    // layer — but the player, which never saw the press, gets no release.
    if (this.word) this.forward(this.word, "pointerup", event);
    if (this.word || this.pressOnWord) this.keepFromPlayer(event);
  };

  /**
   * The browser took the press over (touch panning, a drag of its own): no
   * click follows, and the next one — a key pressed on a player button has no
   * pointer events at all — is not the word's.
   */
  private handlePointerCancel = (): void => {
    this.pressOnWord = false;
  };

  private handleClickEvent = (event: MouseEvent): void => {
    if (this.forwarding) return;

    const overWord = findCoveredCaption(event.target, event.clientX, event.clientY)?.word;
    if (overWord || this.pressOnWord) this.keepFromPlayer(event);
    if (event.type === "click") this.pressOnWord = false;
  };

  /**
   * `pointerout` with nowhere to go: the pointer left the document (another
   * frame, the browser window) or was lifted off a touch screen.
   */
  private handlePointerOut = (event: PointerEvent): void => {
    if (this.forwarding || event.relatedTarget) return;

    this.leave(this.word, null, event);
    this.leave(this.captionWindow, null, event);
    this.word = null;
    this.captionWindow = null;
  };

  private handleNativeEnter = (event: PointerEvent): void => {
    if (this.forwarding) return;

    const target = toElement(event.target);
    if (target && this.handedBack.delete(target)) event.stopImmediatePropagation();
  };

  /**
   * The browser's `pointerleave` for a word or caption window that is still
   * under the pointer, only covered now: the pointer has not left it, so the
   * leave is kept from the captions and the element is taken over.
   */
  private handleNativeLeave = (event: PointerEvent): void => {
    if (this.forwarding || !event.relatedTarget) return;

    const target = toElement(event.target);
    if (!target?.classList.contains(TOOLTIP_WORD_CLASS) && !target?.classList.contains(CAPTION_WINDOW)) return;

    const covered = findCoveredCaption(event.relatedTarget, event.clientX, event.clientY);
    if (target === covered?.word) {
      this.word = target;
    } else if (target === covered?.captionWindow) {
      this.captionWindow = target;
    } else {
      return;
    }

    event.stopImmediatePropagation();
  };

  /**
   * Brings the covered word and caption window in line with what is under the
   * pointer now: leaves first, inner to outer, then enters, outer to inner.
   */
  private track(event: PointerEvent): void {
    const covered = findCoveredCaption(event.target, event.clientX, event.clientY);
    const word = covered?.word ?? null;
    const captionWindow = covered?.captionWindow ?? null;

    const target = toElement(event.target);
    const nativeWord = target?.closest(`.${TOOLTIP_WORD_CLASS}`) ?? null;
    const nativeWindow = target?.closest(`.${CAPTION_WINDOW}`) ?? null;

    const wordChanged = word !== this.word;
    const windowChanged = captionWindow !== this.captionWindow;

    if (wordChanged) this.leave(this.word, nativeWord, event);
    if (windowChanged) this.leave(this.captionWindow, nativeWindow, event);

    this.word = word;
    this.captionWindow = captionWindow;

    if (windowChanged && captionWindow) this.forward(captionWindow, "pointerenter", event);
    if (wordChanged && word) this.forward(word, "pointerenter", event);
  }

  /**
   * Ends the pointer's stay on an element we entered. When the pointer is now
   * over that very element natively, it has not left: the browser's upcoming
   * `pointerenter` is the one to drop. A caption YouTube has removed meanwhile
   * gets nothing, as the browser sends nothing to removed nodes.
   */
  private leave(element: Element | null, nowNative: Element | null, event: PointerEvent): void {
    if (!element) return;

    if (element === nowNative) {
      this.handedBack.add(element);
    } else if (element.isConnected) {
      this.forward(element, "pointerleave", event);
    }
  }

  private keepFromPlayer(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private forward(target: Element, type: string, source: PointerEvent): void {
    this.forwarding = true;

    try {
      target.dispatchEvent(new PointerEvent(type, {
        // Only the captions' own listeners are meant to hear it.
        bubbles: false,
        cancelable: type !== "pointerenter" && type !== "pointerleave",
        clientX: source.clientX,
        clientY: source.clientY,
        screenX: source.screenX,
        screenY: source.screenY,
        button: source.button,
        buttons: source.buttons,
        shiftKey: source.shiftKey,
        ctrlKey: source.ctrlKey,
        altKey: source.altKey,
        metaKey: source.metaKey,
        pointerId: source.pointerId,
        pointerType: source.pointerType,
        isPrimary: source.isPrimary,
      }));
    } finally {
      this.forwarding = false;
    }
  }
}
