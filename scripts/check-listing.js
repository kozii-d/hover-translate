const fs = require("node:fs");
const path = require("node:path");

// Usage: node check-listing.js
// Checks the store listing texts against the stores' limits, offline. Exits 1
// and prints every error found. Lengths are String.length (UTF-16 code units):
// never less than the number of characters, so a text that passes here fits a
// store that counts characters too.

const LIMITS = {
  // messages.json "name" — AMO allows 50 (Chrome 75)
  name: 50,
  // messages.json "description" (the summary) — Chrome and Edge cut it at 132
  // https://developer.chrome.com/docs/extensions/reference/manifest/description
  description: 132,
  // store-assets/search-terms — Edge: 7 terms, 30 characters each, 21 words in all
  // https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
  searchTerms: 7,
  searchTermLength: 30,
  searchTermWords: 21,
  // store-assets/descriptions — Edge: 250 to 10,000 characters
  storeDescriptionMin: 250,
  storeDescriptionMax: 10000,
};

// Each source of listing texts, and the file it holds for a locale
const SOURCES = [
  { dir: "_locales", file: (locale) => path.join("_locales", locale, "messages.json") },
  { dir: path.join("store-assets", "descriptions"), file: (locale) => path.join("store-assets", "descriptions", `${locale}.txt`) },
  { dir: path.join("store-assets", "search-terms"), file: (locale) => path.join("store-assets", "search-terms", `${locale}.txt`) },
];

function listLocales(root, source) {
  const dir = path.join(root, source.dir);
  if (!fs.existsSync(dir)) return [];
  if (source.dir === "_locales") {
    return fs.readdirSync(dir).filter((locale) => fs.existsSync(path.join(root, source.file(locale))));
  }
  return fs.readdirSync(dir).filter((name) => name.endsWith(".txt")).map((name) => name.slice(0, -4));
}

function checkMessages(root, locale, errors) {
  const file = SOURCES[0].file(locale);
  let messages;
  try {
    messages = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (err) {
    errors.push({ rule: "json", locale, file, message: `${locale}: ${file} is not valid JSON (${err.message})` });
    return;
  }
  for (const field of ["name", "description"]) {
    const text = messages?.[field]?.message;
    if (typeof text !== "string" || !text.trim()) {
      errors.push({ rule: "missing", locale, file, field, message: `${locale}: ${file} has no "${field}.message"` });
      continue;
    }
    const limit = LIMITS[field];
    if (text.length > limit) {
      errors.push({
        rule: `${field}-length`, locale, file, field, length: text.length, limit,
        message: `${locale}: ${file} ${field} is ${text.length} characters, limit ${limit}`,
      });
    }
  }
}

function checkStoreDescription(root, locale, errors) {
  const file = SOURCES[1].file(locale);
  const text = fs.readFileSync(path.join(root, file), "utf8").trim();
  const limit = text.length < LIMITS.storeDescriptionMin ? LIMITS.storeDescriptionMin
    : text.length > LIMITS.storeDescriptionMax ? LIMITS.storeDescriptionMax : null;
  if (limit !== null) {
    errors.push({
      rule: "store-description-length", locale, file, length: text.length, limit,
      message: `${locale}: ${file} is ${text.length} characters, must be ${LIMITS.storeDescriptionMin}–${LIMITS.storeDescriptionMax}`,
    });
  }
}

function checkSearchTerms(root, locale, errors) {
  const file = SOURCES[2].file(locale);
  const terms = fs.readFileSync(path.join(root, file), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (terms.length > LIMITS.searchTerms) {
    errors.push({
      rule: "search-terms-count", locale, file, length: terms.length, limit: LIMITS.searchTerms,
      message: `${locale}: ${file} has ${terms.length} search terms, limit ${LIMITS.searchTerms}`,
    });
  }
  for (const term of terms) {
    if (term.length > LIMITS.searchTermLength) {
      errors.push({
        rule: "search-terms-length", locale, file, term, length: term.length, limit: LIMITS.searchTermLength,
        message: `${locale}: ${file} search term "${term}" is ${term.length} characters, limit ${LIMITS.searchTermLength}`,
      });
    }
  }
  const words = terms.reduce((sum, term) => sum + term.split(/\s+/).length, 0);
  if (words > LIMITS.searchTermWords) {
    errors.push({
      rule: "search-terms-words", locale, file, length: words, limit: LIMITS.searchTermWords,
      message: `${locale}: ${file} has ${words} words in search terms, limit ${LIMITS.searchTermWords}`,
    });
  }
}

// Returns every error as { rule, locale, file, message, ... }, [] when the listing is fine
function checkListing(root = path.join(__dirname, "..")) {
  const errors = [];
  const present = SOURCES.map((source) => new Set(listLocales(root, source)));
  const all = [...new Set(present.flatMap((set) => [...set]))].sort();

  for (const locale of all) {
    SOURCES.forEach((source, i) => {
      if (!present[i].has(locale)) {
        const file = source.file(locale);
        errors.push({ rule: "locale-set", locale, file, message: `${locale}: ${file} is missing` });
      }
    });
  }

  const checks = [checkMessages, checkStoreDescription, checkSearchTerms];
  for (const locale of all) {
    checks.forEach((check, i) => {
      if (present[i].has(locale)) check(root, locale, errors);
    });
  }

  return errors;
}

// Prints the errors and exits 1 if there are any
function assertListing(root) {
  const errors = checkListing(root);
  if (errors.length === 0) return;
  console.error(`Store listing check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  ${error.message}`);
  process.exit(1);
}

if (require.main === module) {
  assertListing();
  console.log("Store listing check passed.");
}

module.exports = { checkListing, assertListing, LIMITS };
