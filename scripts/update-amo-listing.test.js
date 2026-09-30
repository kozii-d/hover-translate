const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { buildPatchBody, LOCALE_MAP } = require("./update-amo-listing.js");

// The body is built from the real listing files, exactly as the script sends it
const { body, skipped } = buildPatchBody();

function localeName(locale) {
  const messages = path.join(__dirname, "..", "_locales", locale, "messages.json");
  return JSON.parse(fs.readFileSync(messages, "utf8")).name.message;
}

// AMO locale -> the project locale its texts come from
const sourceLocale = {};
for (const [locale, amoLocales] of Object.entries(LOCALE_MAP)) {
  for (const amoLocale of [amoLocales].flat()) sourceLocale[amoLocale] = locale;
}

test("name, summary and description cover the same locales", () => {
  const locales = Object.keys(body.summary).sort();
  assert.ok(locales.length > 0);
  assert.deepEqual(Object.keys(body.name ?? {}).sort(), locales);
  assert.deepEqual(Object.keys(body.description).sort(), locales);
});

test("every AMO locale gets the name from its own messages.json", () => {
  for (const amoLocale of Object.keys(body.summary)) {
    assert.equal(body.name?.[amoLocale], localeName(sourceLocale[amoLocale]), amoLocale);
  }
});

test("locales that share a source file get its name", () => {
  assert.equal(body.name?.["es-AR"], localeName("es"));
  assert.equal(body.name?.["sv-SE"], localeName("sv"));
  assert.equal(body.name?.["en-GB"], localeName("en"));
  assert.notEqual(localeName("es"), localeName("en"));
});

test("a locale AMO does not accept is left out of every field", () => {
  assert.ok(skipped.has("hi"));
  for (const field of ["name", "summary", "description"]) {
    assert.ok(body[field], field);
    assert.equal(Object.hasOwn(body[field], "hi"), false, field);
  }
});
