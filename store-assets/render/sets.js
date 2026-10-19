const path = require("node:path");

// What each listing language shows. A set's captions are in the language its
// viewers learn: English for everyone but the English listing, which shows
// Spanish; the shot of words in a script without spaces shows Japanese, and
// Chinese to the Japanese. `youtube` is YouTube's `hl`, `ui` Chrome's
// `--lang`, `target` the language of the tooltip as DeepL spells it: every
// shot is translated by DeepL (the user's choice, 17.10.2026).
const SETS = {
  en: { ui: "en-US", youtube: "en", captions: "es", target: "en-US" },
  ru: { ui: "ru", youtube: "ru", captions: "en", target: "ru" },
  uk: { ui: "uk", youtube: "uk", captions: "en", target: "uk" },
  ko: { ui: "ko", youtube: "ko", captions: "en", target: "ko" },
  ja: { ui: "ja", youtube: "ja", captions: "en", unspaced: "zh-Hans", target: "ja" },
  zh_CN: { ui: "zh-CN", youtube: "zh-CN", captions: "en", target: "zh-Hans" },
  zh_TW: { ui: "zh-TW", youtube: "zh-TW", captions: "en", target: "zh-Hant" },
  pt_BR: { ui: "pt-BR", youtube: "pt-BR", captions: "en", target: "pt-BR" },
};

const SPRITE_FRIGHT = "_cMxraX_5RE";
const SINTEL = "eRsGyueVLvQ";

// Each shot by the language of the captions. `word` is hovered alone; `from`
// to `to` is selected with Shift, word by word. Words are matched without the
// punctuation around them, as the extension splits the line (by spaces).
const SHOTS = {
  word: {
    // Not the line before, "Hello, Mr.Snail!": a name needs no translation.
    es: { video: SPRITE_FRIGHT, time: 20.4, word: "lindo" },
    en: { video: SPRITE_FRIGHT, time: 20.4, word: "cute" },
  },
  phrase: {
    // A set phrase on a line of its own, which word by word makes no sense.
    // Not "as long as I can remember" in Spanish: it runs over two lines, and
    // the selection jumped. Not "kindred spirit" in English: DeepL gives
    // "душа-побратим" in Ukrainian (18.10.2026).
    es: { video: SINTEL, time: 139.2, from: "alma", to: "gemela" },
    en: { video: SINTEL, time: 154.0, from: "as", to: "remember" },
  },
  // A word DeepL gets wrong alone and right with the line around it:
  // "arma" alone is "weapon", "shed" alone is "сарай" (17.10.2026).
  context: {
    es: { video: SPRITE_FRIGHT, time: 101.2, word: "arma" },
    en: { video: SINTEL, time: 112.3, word: "shed" },
  },
  // Hovered while the video plays, and the extension pauses it: the player's
  // controls stay in view to show the pause.
  autopause: {
    es: { video: SPRITE_FRIGHT, time: 215.2, word: "animales", playing: true },
    en: { video: SPRITE_FRIGHT, time: 215.2, word: "animals", playing: true },
  },
  // Saved by a click, as a viewer saves them, then the popup's dictionary.
  // In the order of saving: the list shows the last first.
  // `daysAgo` moves the saving back, as if the list had been kept for days.
  dictionary: {
    es: [
      { video: SINTEL, time: 107.5, word: "pasado", daysAgo: 9 },
      { video: SINTEL, time: 112.3, word: "sangre", daysAgo: 9 },
      { video: SINTEL, time: 135.6, word: "buscando", daysAgo: 4 },
      // Saved live in the video: from 157.4 the shot before the line is cut away.
      { video: SPRITE_FRIGHT, time: 157.4, word: "nueva", daysAgo: 4 },
      { video: SINTEL, time: 149.3, word: "peligrosa", daysAgo: 1 },
      { video: SPRITE_FRIGHT, time: 101.2, word: "útil", daysAgo: 0 },
      { video: SPRITE_FRIGHT, time: 110.4, from: "ni", to: "minutos", daysAgo: 0 },
    ],
    en: [
      { video: SINTEL, time: 118.6, word: "traveling", daysAgo: 9 },
      { video: SINTEL, time: 149.3, word: "quest", daysAgo: 9 },
      { video: SINTEL, time: 122.3, word: "lucky", daysAgo: 4 },
      // Not "new": DeepL left it in English in Japanese (18.10.2026).
      { video: SPRITE_FRIGHT, time: 156.8, word: "incredible", daysAgo: 4 },
      { video: SPRITE_FRIGHT, time: 110.4, word: "survive", daysAgo: 1 },
      { video: SPRITE_FRIGHT, time: 214.8, from: "take", to: "of", daysAgo: 0 },
      { video: SPRITE_FRIGHT, time: 206.6, word: "peppermint", daysAgo: 0 },
    ],
  },
  // What the popup opens over: the teenagers meeting the sprites, a frame
  // without captions (the user's choice, 18.10.2026). The video is opened on
  // the line before it, as `openVideo` waits for one, then moved to `frame`.
  dictionaryBackground: { video: SPRITE_FRIGHT, time: 200.5, frame: 203 },
  // Intl.Segmenter's words, as the extension splits a line without spaces.
  unspaced: {
    ja: { video: SINTEL, time: 118.6, word: "旅" },
    "zh-Hans": { video: SINTEL, time: 118.6, word: "孤身" },
  },
};

// Every screenshot made; AMO takes them all, in this order.
const SHOT_ORDER = ["word", "phrase", "context", "dictionary", "unspaced", "autopause", "settings"];

// Chrome takes five screenshots, Edge six (the user's layout, 18.10.2026): the
// four every set shows, then Japanese words where viewers may well learn
// Japanese or Chinese, auto-pause where they mostly learn English; Edge gets
// the other one too. The settings are shown on AMO only.
const SHOWN_EVERYWHERE = ["word", "phrase", "context", "dictionary"];
const UNSPACED_FIRST = ["en", "ko", "zh_CN", "zh_TW"];

// Where the site's media go: site/ is what GitHub Pages publishes (in git).
const SITE_MEDIA = path.resolve(__dirname, "../../site/media");

// The site's videos, site/media/<name>.mp4, .webm and .webp (the site links
// them by these names), made of the scenes of the en set's promo video; the
// popup's part opens over the dictionary scene, as in docs/dictionary.gif.
const SITE_VIDEOS = {
  phrase: ["phrase"],
  save: ["dictionary", "popup"],
  context: ["context"],
  unspaced: ["unspaced"],
};

/** The shots of the set `setName` for Chrome and for Edge, in the order of upload. */
function storeShots(setName) {
  const [fifth, sixth] = UNSPACED_FIRST.includes(setName) ? ["unspaced", "autopause"] : ["autopause", "unspaced"];
  const chrome = [...SHOWN_EVERYWHERE, fifth];
  return { chrome, edge: [...chrome, sixth] };
}

/** The shot `shotName` of the set `setName`, with the language of its captions. */
function scene(setName, shotName) {
  const set = SETS[setName];
  const captions = shotName === "unspaced" ? set.unspaced ?? "ja" : set.captions;
  const shot = SHOTS[shotName][captions] ?? SHOTS[shotName];
  return Array.isArray(shot) ? { scenes: shot, captions } : { ...shot, captions };
}

module.exports = { SETS, SHOTS, SHOT_ORDER, SITE_VIDEOS, SITE_MEDIA, scene, storeShots };
