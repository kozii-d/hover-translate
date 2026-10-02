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
 * planes), kana, Thai, Lao, Myanmar and Khmer. `Script_Extensions`, so that their
 * punctuation (`。`, `、`, `「」`, `ー`), of the Common script, counts as theirs —
 * except what Latin shares with them (`ʼ`, `·`, combining accents).
 */
const SPACELESS_SCRIPTS =
  /(?!\p{Script_Extensions=Latin})[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Thai}\p{Script_Extensions=Lao}\p{Script_Extensions=Myanmar}\p{Script_Extensions=Khmer}]/u;

/**
 * Korean is written with spaces, so it is served by the whitespace split like
 * any European language: segmenting it would only chop words into morphemes.
 * Checked on its own, since `。` and the CJK brackets are listed for Hangul too
 * (`《기생충》은` is one word).
 */
const HANGUL = /\p{Script=Hangul}/u;

/** Opening brackets and quotation marks: `「『（《【“‘`… */
const OPENING_MARK = /^[\p{Ps}\p{Pi}]/u;

/** `null` once the browser has been found not to have `Intl.Segmenter`. */
let cachedSegmenter: Intl.Segmenter | null | undefined;

/**
 * `Intl.Segmenter` reached Chrome in 87 and Firefox only in 125, while the
 * add-on still supports Firefox 115–124 (`strict_min_version` is 115; the 115
 * ESR line is ~1.5% of the Firefox users and cannot upgrade — it is the last
 * line for Windows 7/8). Those keep each whitespace-delimited chunk whole instead
 * of a broken caption.
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
 * screen, and the space between them has to come from somewhere. A chunk in a
 * script without spaces ends with one only between chunks, never at the end of
 * the line: YouTube appends the next piece of such a line without a space, and
 * ours would be read back as part of the line — freezing a word boundary in the
 * wrong place (`我喜` + `欢看视频` instead of `我` `喜欢` `看视频`) and putting a
 * space in the middle of a Chinese subtitle.
 */
const splitChunk = (chunk: string, isLast: boolean): CaptionWord[] => {
  if (!SPACELESS_SCRIPTS.test(chunk) || HANGUL.test(chunk)) return [{ text: chunk, separator: " " }];

  const lineEnd = isLast ? "" : " ";
  const wholeChunk = [{ text: chunk, separator: lineEnd }];

  const segmenter = getSegmenter();
  if (!segmenter) return wholeChunk;

  const words: CaptionWord[] = [];
  // Punctuation and other non-words are never a word of their own: they join the
  // word they belong to, as typesetting has it — an opening mark (`「`, `《`, `“`)
  // and what follows it lead the next word, any other mark ends the word before
  // it (`こんにちは。` `ゆ`, not `。ゆ`). Marks with no word before them lead the
  // first one.
  let pending = "";

  for (const { segment, isWordLike } of segmenter.segment(chunk)) {
    if (isWordLike) {
      words.push({ text: pending + segment, separator: "" });
      pending = "";
    } else if (words.length === 0 || pending || OPENING_MARK.test(segment)) {
      pending += segment;
    } else {
      words[words.length - 1].separator += segment;
    }
  }

  // Nothing word-like in there at all — a run of punctuation or symbols.
  if (words.length === 0) return wholeChunk;

  // Marks after the last word — an opening one too, with no word left to lead —
  // and, unless the line ends here, the space the whitespace split ate.
  words[words.length - 1].separator += pending + lineEnd;

  return words;
};
