/**
 * Turning a caption line into the words the tooltip works with.
 *
 * Splitting on whitespace is right for most languages and useless for Chinese,
 * Japanese and Thai: they are written without spaces, so the whole line came out
 * as a single "word" and hovering it translated the entire subtitle. Those runs
 * are handed to `Intl.Segmenter`, which knows where the words are.
 *
 * Whitespace stays the primary split: a language that does use spaces must keep
 * behaving exactly as before, down to punctuation riding along with its word
 * (`well-known,` is one word today and stays one word).
 */
export interface CaptionWord {
  /** What is hovered, selected and sent to the translator. */
  text: string;
  /**
   * What is rendered after it inside the same span. A space for a word that came
   * from whitespace splitting, nothing between two Chinese words, whatever
   * punctuation followed them.
   */
  separator: string;
}

/**
 * Scripts written without spaces between words: Han (including the rare-ideograph
 * planes), kana, Thai, Lao, Myanmar and Khmer.
 *
 * Hangul is deliberately absent — Korean is written with spaces, so it is served
 * by the whitespace split like any European language, and segmenting it would
 * only chop words into morphemes.
 */
const SPACELESS_SCRIPTS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Khmer}]/u;

/** `null` once the browser has been found not to have `Intl.Segmenter`. */
let cachedSegmenter: Intl.Segmenter | null | undefined;

/**
 * `Intl.Segmenter` reached Chrome in 87 and Firefox only in 125, while the
 * add-on still supports Firefox 109 (the 115 ESR line is ~1.5% of the Firefox
 * users and cannot upgrade — it is the last line for Windows 7/8). Those get the
 * old whole-line behaviour instead of a broken caption.
 */
const getSegmenter = (): Intl.Segmenter | null => {
  if (cachedSegmenter !== undefined) return cachedSegmenter;

  cachedSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

  return cachedSegmenter;
};

export const splitIntoWords = (text: string): CaptionWord[] => {
  const chunks = text ? text.split(/\s+/) : [];

  return chunks.flatMap((chunk, index) => splitChunk(chunk, index === chunks.length - 1));
};

/**
 * The rendered content of a word's span — the word plus whatever follows it.
 */
export const renderWord = (word: CaptionWord): string => word.text + word.separator;

/**
 * One whitespace-delimited chunk, split further only when it is written in a
 * script that has no spaces of its own.
 *
 * `isLast` decides the one thing a word cannot work out on its own: whether to
 * end with a space. A whitespace-split word always does, because YouTube grows
 * an auto-generated line by appending the next word to what is already on
 * screen, and the space between them has to come from somewhere. A word in a
 * script without spaces must not, or that space would be read back as part of
 * the line the next time it grows — freezing a word boundary in the wrong place
 * (`我喜` + `欢看视频` instead of `我` `喜欢` `看视频`) and putting a space in
 * the middle of a Chinese subtitle. Between two chunks the space is real: it was
 * in the subtitle and the whitespace split ate it.
 */
const splitChunk = (chunk: string, isLast: boolean): CaptionWord[] => {
  const wholeChunk = [{ text: chunk, separator: " " }];

  if (!SPACELESS_SCRIPTS.test(chunk)) return wholeChunk;

  const segmenter = getSegmenter();
  if (!segmenter) return wholeChunk;

  const words: CaptionWord[] = [];
  // Punctuation and other non-words are never a word of their own: they join the
  // word they belong to, exactly as a whitespace split leaves them attached.
  let pending = "";

  for (const { segment, isWordLike } of segmenter.segment(chunk)) {
    if (isWordLike) {
      words.push({ text: pending + segment, separator: "" });
      pending = "";
      continue;
    }

    pending += segment;
  }

  // Nothing word-like in there at all — a run of punctuation or symbols.
  if (words.length === 0) return wholeChunk;

  // The chunk ended with punctuation, and — unless the line ends here — the
  // space the whitespace split ate.
  words[words.length - 1].separator = pending + (isLast ? "" : " ");

  return words;
};
