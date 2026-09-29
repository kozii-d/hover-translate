const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");
const { checkListing, LIMITS } = require("./check-listing.js");

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// A listing with one locale, every text exactly at its limit, and one change
// applied on top.
function listing(change = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-listing-"));
  roots.push(root);
  const files = {
    "_locales/en/messages.json": JSON.stringify({
      name: { message: "N".repeat(LIMITS.name) },
      description: { message: "D".repeat(LIMITS.description) },
    }),
    "store-assets/descriptions/en.txt": "S".repeat(LIMITS.storeDescriptionMin),
    // 7 terms, 21 words, the longest 30 characters.
    "store-assets/search-terms/en.txt": [
      "a".repeat(LIMITS.searchTermLength), "b c d", "e f g", "h i j", "k l m", "n o p", "q r s",
    ].join("\n"),
    ...change,
  };
  for (const [file, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

const rules = (root) => checkListing(root).map((error) => error.rule);
const messages = (fields) => JSON.stringify({ name: { message: "Name" }, description: { message: "Description" }, ...fields });

test("every limit reached, none passed: no errors", () => {
  assert.deepEqual(rules(listing()), []);
});

test("name: 50 passes, 51 fails", () => {
  assert.deepEqual(rules(listing({ "_locales/en/messages.json": messages({ name: { message: "N".repeat(51) } }) })), ["name-length"]);
});

test("description: 132 passes, 133 fails", () => {
  assert.deepEqual(rules(listing({ "_locales/en/messages.json": messages({ description: { message: "D".repeat(133) } }) })), ["description-length"]);
});

test("search terms: 8 lines fail", () => {
  const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].join("\n");
  assert.deepEqual(rules(listing({ "store-assets/search-terms/en.txt": eight })), ["search-terms-count"]);
});

test("search terms: a term of 31 characters fails", () => {
  assert.deepEqual(rules(listing({ "store-assets/search-terms/en.txt": "a".repeat(31) })), ["search-terms-length"]);
});

test("search terms: 22 words fail", () => {
  const words = ["a b c d", "e f g", "h i j", "k l m", "n o p", "q r s", "t u v"].join("\n");
  assert.deepEqual(rules(listing({ "store-assets/search-terms/en.txt": words })), ["search-terms-words"]);
});

test("store description: 249 and 10,001 characters fail, 10,000 passes", () => {
  assert.deepEqual(rules(listing({ "store-assets/descriptions/en.txt": "S".repeat(249) })), ["store-description-length"]);
  assert.deepEqual(rules(listing({ "store-assets/descriptions/en.txt": "S".repeat(10000) })), []);
  assert.deepEqual(rules(listing({ "store-assets/descriptions/en.txt": "S".repeat(10001) })), ["store-description-length"]);
});

test("a locale missing from one of the three places", () => {
  const root = listing({ "store-assets/search-terms/en.txt": null });
  assert.deepEqual(checkListing(root).map(({ rule, file }) => [rule, file]), [["locale-set", path.join("store-assets", "search-terms", "en.txt")]]);
});

test("messages.json that is not JSON, or has no name", () => {
  assert.deepEqual(rules(listing({ "_locales/en/messages.json": "{" })), ["json"]);
  assert.deepEqual(rules(listing({ "_locales/en/messages.json": JSON.stringify({ description: { message: "D" } }) })), ["missing"]);
});

test("the repository's own listing passes", () => {
  assert.deepEqual(checkListing(), []);
});
