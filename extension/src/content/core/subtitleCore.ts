import { TOOLTIP_WORD_CLASS, CAPTION_SEGMENT, CAPTION_WINDOW, DATA_ATTRIBUTES } from "../consts/consts.ts";
import { TooltipService } from "../services/tooltipService.ts";
import { state } from "../state/stateManager.ts";
import { CaptionWord, renderWord, splitIntoWords } from "../utils/wordSegmenter.ts";
import { isShiftHeld } from "../utils/shiftKey.ts";

export class SubtitleCore {
  /**
   * Words this instance last split each caption line into. It is what makes an
   * unchanged (or merely extended) line recognisable, and it is per instance on
   * purpose: after the pipeline is rebuilt the spans still on screen carry
   * handlers of the previous instance, so the new one has to re-split them.
   *
   * It also recognises a line YouTube removed and drew again as a new node,
   * which it does to every line that stays when auto-generated captions roll
   * up: its spans move to the new line, so a selection on it and a
   * translation still loading for it survive.
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
   * split it into last time; when it changed, the spans `countKeptWords` allows
   * stay and only the rest of the line is built again. Rebuilding the line
   * unconditionally is what broke selections: auto-generated captions are
   * re-rendered on every appended word, and each rebuild detached the very
   * nodes the current selection was anchored to.
   *
   * `removedLines`: caption lines that left the page in the same change, whose
   * spans this line may take over (see `parsedSegments`).
   */
  public splitCaptionIntoSpans(captionSegment: HTMLElement, removedLines: HTMLElement[] = []): boolean {
    const text = captionSegment.textContent?.trim() ?? "";
    const words = splitIntoWords(text);
    const ownWords = this.getParsedWords(captionSegment);

    if (ownWords && this.isSameWords(ownWords, words)) return false;

    const parsedWords = ownWords ?? this.takeOverRemovedLine(captionSegment, removedLines, words);

    const keptCount = parsedWords ? this.countKeptWords(parsedWords, words) : 0;

    if (keptCount > 0) {
      // Drop YouTube's raw text and the spans past the kept ones.
      this.removeNonWordNodes(captionSegment);
      captionSegment.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`).forEach((wordNode, index) => {
        if (index >= keptCount) wordNode.remove();
      });
      this.renderKeptWords(captionSegment, words.slice(0, keptCount));
      captionSegment.appendChild(this.buildWordSpans(words.slice(keptCount)));
      this.parsedSegments.set(captionSegment, words);
      return true;
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

  /**
   * Moves the spans of the removed line that keeps the most of them in these
   * words (`countKeptWords`) to the end of `captionSegment`, and returns its
   * words; null when none keeps any. Its spans gone, the removed line can't be
   * taken twice.
   *
   * The most, not the first: the line that went may be the start of the one
   * that stays ("you know" above "you know what I mean"). Of two that keep as
   * many, the one that loses fewer: the line that went may also start like the
   * one that stays, and only grown ("in my hometown because…" above
   * "in my hometown.").
   */
  private takeOverRemovedLine(captionSegment: HTMLElement, removedLines: HTMLElement[], words: CaptionWord[]): CaptionWord[] | null {
    let takenLine: HTMLElement | null = null;
    let takenWords: CaptionWord[] = [];
    let takenCount = 0;

    for (const removedLine of removedLines) {
      const removedWords = this.getParsedWords(removedLine);
      const keptCount = removedWords ? this.countKeptWords(removedWords, words) : 0;
      if (removedWords && (keptCount > takenCount || (keptCount === takenCount && removedWords.length < takenWords.length))) {
        takenLine = removedLine;
        takenWords = removedWords;
        takenCount = keptCount;
      }
    }

    if (!takenLine) return null;

    captionSegment.append(...Array.from(takenLine.querySelectorAll(`.${TOOLTIP_WORD_CLASS}`)));
    this.parsedSegments.set(captionSegment, takenWords);
    return takenWords;
  }

  private isSameWords(words: CaptionWord[], otherWords: CaptionWord[]): boolean {
    return words.length === otherWords.length &&
      words.every((word, index) => renderWord(word) === renderWord(otherWords[index]));
  }

  /**
   * How many spans of the parsed words the line now holding `words` keeps: the
   * words it still starts with, and the next one too when it has only grown
   * (`っ` → `って`, `hometown` → `hometown.`). YouTube grows a line by pieces,
   * not always whole words, and `Intl.Segmenter` decides the end of a line
   * without spaces anew each time; a selection on the word that grew stays,
   * and one reaching past it is dropped (`TooltipService.refreshSelectedWords`).
   *
   * Only the words themselves are compared, not what is rendered after them: in
   * a script without spaces the last word of a line loses its trailing space as
   * soon as the next word arrives (`我喜欢` → `我喜欢看`). Treating that as a
   * different line would rebuild the whole caption on every appended word, and a
   * rebuild detaches the very nodes a live selection is anchored to.
   */
  private countKeptWords(parsedWords: CaptionWord[], words: CaptionWord[]): number {
    let count = 0;
    while (count < parsedWords.length && count < words.length && parsedWords[count].text === words[count].text) count++;

    const grown = count < parsedWords.length && count < words.length && words[count].text.startsWith(parsedWords[count].text);
    return grown ? count + 1 : count;
  }

  /**
   * Brings the spans that stay in line with their words and what now follows
   * them — see `countKeptWords`. The nodes are kept, so the selection survives.
   */
  private renderKeptWords(captionSegment: HTMLElement, words: CaptionWord[]): void {
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

    // Only the main button acts on the word: a right click opens the context
    // menu, and a middle click is not a click on the word either.
    wordSpan.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Save the initial coordinates and reset the "drag" flag
      isDrag = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    const isFarFromPress = (e: PointerEvent) =>
      Math.abs(e.clientX - startX) > DRAG_THRESHOLD || Math.abs(e.clientY - startY) > DRAG_THRESHOLD;

    wordSpan.addEventListener("pointermove", (e: PointerEvent) => {
      // If the cursor has moved further than the threshold, set the "drag" flag
      if (isFarFromPress(e)) {
        isDrag = true;
      }
    });

    wordSpan.addEventListener("pointerup", (e: PointerEvent) => {
      // If the user is dragging the subtitles, don't save the translation or copy the text.
      // The release is measured too: YouTube moves the caption window after
      // the pointer, so each move of a drag lands beside the word, the word
      // gets no `pointermove` at all, and the release is on it again.
      // Nor when Ctrl is held at the release: on a Mac, Ctrl+click is the right
      // click, yet it comes as the main button; elsewhere Ctrl on a word meant
      // nothing, so one rule for all.
      if (e.button === 0 && !e.ctrlKey && !isDrag && !isFarFromPress(e)) {
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

  /**
   * For auto-generated captions YouTube makes the window wider than its text,
   * and auto-pause goes by the pointer entering the window, so the video
   * stopped over the empty part. Each window is narrowed to its own longest
   * line: a page can have several (two speakers, the miniplayer and a
   * thumbnail preview). A window whose lines measure 0 (none, or hidden) is
   * left as YouTube made it.
   */
  public updateCaptionWindowSize(): void {
    document.querySelectorAll(`.${CAPTION_WINDOW}`).forEach((captionWindow) => {
      const width = Math.max(0, ...Array.from(captionWindow.querySelectorAll(`.${CAPTION_SEGMENT}`))
        .map((segment) => segment.getBoundingClientRect().width));
      if (captionWindow instanceof HTMLElement && width > 0) {
        captionWindow.style.width = `${width}px`;
      }
    });
  }

  public handlePointerLeaveOnCaptionWindow = ((event: Event) => {
    // Not the event's own Shift: Chrome outside macOS sends some boundary
    // events without it (see shiftKey.ts).
    if (state.settings.alwaysMultipleSelection && !isShiftHeld(event as PointerEvent)) {
      this.tooltipService.clearSelectedWords();
    }
  }) as EventListener;
}
