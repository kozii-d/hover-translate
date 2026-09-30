const fs = require("node:fs");
const path = require("node:path");

// Usage: node scripts/update-language-names.js
//
// Rewrites `_locales/<locale>/languages.json` — the popup's `languages`
// namespace: every language Google Translate offers, named the way Google
// Translate names it in that locale. The browsers' `Intl.DisplayNames` does not
// know all of them (Chrome ships trimmed ICU data), so these come first.

const ROOT = path.join(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "_locales");
const ENDPOINT = "https://translate.googleapis.com/translate_a/l";
const PAUSE_MS = 1000;
const ATTEMPTS = 3;

/** The `hl` Google Translate's site uses for a locale directory: `pt_BR` → `pt-BR`. */
const toGoogleLocale = (locale) => locale.replace(/_/g, "-");

/**
 * One `{ code: name }` object, sorted by code, from Google's answer `{ sl, tl }`.
 * Target names win: as a source Google calls `zh-CN` just "Chinese", as a
 * target "Chinese (Simplified)", next to `zh-TW`. `auto` ("Detect language")
 * is left out: `settings.json` has it.
 */
function toLanguageNames({ sl, tl }) {
  const names = { ...sl, ...tl };
  delete names.auto;
  return Object.fromEntries(Object.entries(names).sort(([a], [b]) => (a < b ? -1 : 1)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLanguageNames(locale) {
  const url = `${ENDPOINT}?client=gtx&hl=${encodeURIComponent(toGoogleLocale(locale))}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const answer = await response.json();
      // A short or empty answer would silently drop names from the popup.
      if (Object.keys(answer.sl ?? {}).length < 100 || Object.keys(answer.tl ?? {}).length < 100) {
        throw new Error("the answer has too few languages");
      }
      return toLanguageNames(answer);
    } catch (error) {
      if (attempt === ATTEMPTS) throw new Error(`${locale}: ${error.message}`, { cause: error });
      // Google answers bursts with 500.
      await sleep(PAUSE_MS * 2 ** attempt);
    }
  }
}

async function main() {
  const locales = fs.readdirSync(LOCALES_DIR)
    .filter((locale) => fs.existsSync(path.join(LOCALES_DIR, locale, "messages.json")));

  for (const locale of locales) {
    const names = await fetchLanguageNames(locale);
    fs.writeFileSync(path.join(LOCALES_DIR, locale, "languages.json"), `${JSON.stringify(names, null, 2)}\n`);
    console.log(`${locale}: ${Object.keys(names).length} languages`);
    await sleep(PAUSE_MS);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { toGoogleLocale, toLanguageNames };
