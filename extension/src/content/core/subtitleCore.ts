import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW, DATA_ATTRIBUTES } from "../consts/consts.ts";
import { TooltipService } from "../services/tooltipService.ts";
import { state } from "../state/stateManager.ts";
import { CaptionWord, renderWord, splitIntoWords } from "../utils/wordSegmenter.ts";

export class SubtitleCore {
  /**
   * Words this instance last split each caption line into. It is what makes an
   * unchanged (or merely extended) line recognisable, and it is per instance on
   * purpose: after the pipeline is rebuilt the spans still on screen carry
   * handlers of the previous instance, so the new one has to re-split them.
   */
  private readonly parsedSegments = new WeakMap<HTMLElement, CaptionWord[]>();

  constructor(
    private readonly tooltipService: TooltipService
  ) {}
  
  public setWordsIndexes = () => {
    const allWords = document.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);
    allWords.forEach((word, index) => {
      if (word instanceof HTMLElement) {
        word.setAttribute(DATA_ATTRIBUTES.INDEX, String(index));
      }
    });
  };

  /**
   * Turns a caption line into one span per word, and reports whether the DOM was
   * actually touched.
   *
   * The line is left completely alone when it still holds exactly the words we
   * split it into last time, and only the missing words are appended when it has
   * merely grown. Rebuilding the line unconditionally is what broke selections
   * spanning two caption lines: auto-generated captions are re-rendered on every
   * appended word, and each rebuild detached the very nodes the current
   * selection was anchored to.
   */
  public splitCaptionIntoSpans(captionSegment: HTMLElement): boolean {
    const text = captionSegment.textContent?.trim() ?? "";
    const words = splitIntoWords(text);
    const parsedWords = this.getParsedWords(captionSegment);

    if (parsedWords) {
      if (this.isSameWords(parsedWords, words)) return false;

      if (this.isAppendOnly(parsedWords, words)) {
        // Drop the raw text YouTube appended, keeping the existing spans in place.
        this.removeNonWordNodes(captionSegment);
        this.syncSeparators(captionSegment, words.slice(0, parsedWords.length));
        captionSegment.appendChild(this.buildWordSpans(words.slice(parsedWords.length)));
        this.parsedSegments.set(captionSegment, words);
        return true;
      }
    }

    const fragment = this.buildWordSpans(words);

    captionSegment.textContent = "";
    captionSegment.appendChild(fragment);
    this.parsedSegments.set(captionSegment, words);

    return true;
  }

  /**
   * The words we split this line into, or null when the line was never split by
   * this instance or its spans have since been replaced by YouTube.
   */
  private getParsedWords(captionSegment: HTMLElement): CaptionWord[] | null {
    const parsedWords = this.parsedSegments.get(captionSegment);
    if (!parsedWords) return null;

    const wordNodes = captionSegment.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);
    if (wordNodes.length !== parsedWords.length) return null;

    const isIntact = parsedWords.every(
      (word, index) => wordNodes[index].textContent?.trim() === renderWord(word).trim()
    );

    return isIntact ? parsedWords : null;
  }

  private isSameWords(words: CaptionWord[], otherWords: CaptionWord[]): boolean {
    return words.length === otherWords.length &&
      words.every((word, index) => renderWord(word) === renderWord(otherWords[index]));
  }

  /**
   * Whether the line only grew at the end.
   *
   * Only the words themselves are compared, not what is rendered after them: in
   * a script without spaces the last word of a line loses its trailing space as
   * soon as the next word arrives (`我喜欢` → `我喜欢看`). Treating that as a
   * different line would rebuild the whole caption on every appended word, and a
   * rebuild detaches the very nodes a live selection is anchored to.
   */
  private isAppendOnly(parsedWords: CaptionWord[], words: CaptionWord[]): boolean {
    return words.length > parsedWords.length &&
      parsedWords.every((word, index) => word.text === words[index].text);
  }

  /**
   * Brings the spans that stay in place in line with what now follows them —
   * see `isAppendOnly`. The nodes are kept, so the selection survives.
   */
  private syncSeparators(captionSegment: HTMLElement, words: CaptionWord[]): void {
    const wordNodes = captionSegment.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`);

    words.forEach((word, index) => {
      const wordNode = wordNodes[index];
      const rendered = renderWord(word);

      if (wordNode && wordNode.textContent !== rendered) {
        wordNode.textContent = rendered;
      }
    });
  }

  private removeNonWordNodes(captionSegment: HTMLElement): void {
    Array.from(captionSegment.childNodes).forEach((child) => {
      if (child instanceof HTMLElement && child.classList.contains(TOOLTIP_WORD_CLASS)) return;
      child.remove();
    });
  }

  private buildWordSpans(words: CaptionWord[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    words.forEach((word) => fragment.appendChild(this.createWordSpan(word)));

    return fragment;
  }

  private createWordSpan(word: CaptionWord): HTMLSpanElement {
    const wordSpan = document.createElement("span");
    wordSpan.classList.add(TOOLTIP_WORD_CLASS);
    wordSpan.textContent = renderWord(word);
    wordSpan.addEventListener("pointerenter", this.tooltipService.handleWordMouseEnter);
    wordSpan.addEventListener("pointerleave", this.tooltipService.handleWordMouseLeave);
    let isDrag = false;
    let startX = 0;
    let startY = 0;
    const DRAG_THRESHOLD = 5;

    wordSpan.addEventListener("pointerdown", (e: PointerEvent) => {
      // Save the initial coordinates and reset the "drag" flag
      isDrag = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    wordSpan.addEventListener("pointermove", (e: PointerEvent) => {
      // If the cursor has moved further than the threshold, set the "drag" flag
      const diffX = Math.abs(e.clientX - startX);
      const diffY = Math.abs(e.clientY - startY);

      if (diffX > DRAG_THRESHOLD || diffY > DRAG_THRESHOLD) {
        isDrag = true;
      }
    });

    wordSpan.addEventListener("pointerup", () => {
      // If the user is dragging the subtitles, don't save the translation or copy the text
      if (!isDrag) {
        switch (state.settings.leftClickAction) {
        case "save-to-dictionary":
          this.tooltipService.saveTranslationToDictionary(wordSpan);
          break;
        case "copy-original":
          this.tooltipService.saveOriginalTextToClipboard(wordSpan);
          break;
        case "copy-translation":
          this.tooltipService.saveTranslationToClipboard(wordSpan);
          break;
        case "nothing":
          break;
        default:
          break;
        }
      }
    });

    return wordSpan;
  }

  public updateCaptionWindowSize(): void {
    const segments = document.querySelectorAll(`.${CAPTION_SEGMENT}`);
    let maxWidth = 0;

    segments.forEach((segment) => {
      if (segment instanceof HTMLElement) {
        const rect = segment.getBoundingClientRect();
        maxWidth = Math.max(maxWidth, rect.width);
      }
    });

    const captionWindow = document.querySelector(`.${CAPTION_WINDOW}`);
    if (captionWindow instanceof HTMLElement) {
      captionWindow.style.width = `${maxWidth}px`;
    }
  }

  public handlePointerLeaveOnCaptionWindow = ((event: Event) => {
    const pointerEvent = event as PointerEvent;
    if (state.settings.alwaysMultipleSelection && !pointerEvent.shiftKey) {
      this.tooltipService.clearSelectedWords();
    }
  }) as EventListener;
}
