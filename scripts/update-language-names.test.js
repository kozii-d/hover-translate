const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { toGoogleLocale, toLanguageNames } = require("./update-language-names.js");

const LOCALES_DIR = path.join(__dirname, "..", "_locales");

test("a locale directory becomes the hl Google Translate's site uses", () => {
  assert.equal(toGoogleLocale("ru"), "ru");
  assert.equal(toGoogleLocale("pt_BR"), "pt-BR");
  assert.equal(toGoogleLocale("pt_PT"), "pt-PT");
  assert.equal(toGoogleLocale("zh_TW"), "zh-TW");
});

test("source and target names merge, the target's win, detection is left out, sorted by code", () => {
  const names = toLanguageNames({
    sl: { auto: "Определить язык", ru: "русский", "zh-CN": "китайский", ab: "абхазский" },
    tl: { ru: "русский", "zh-CN": "китайский (упрощенный)", "zh-TW": "китайский (традиционный)", ab: "абхазский" },
  });

  assert.deepEqual(names, {
    ab: "абхазский",
    ru: "русский",
    "zh-CN": "китайский (упрощенный)",
    "zh-TW": "китайский (традиционный)",
  });
  assert.deepEqual(Object.keys(names), ["ab", "ru", "zh-CN", "zh-TW"]);
});

test("every popup locale has its language names, without detection", () => {
  const locales = fs.readdirSync(LOCALES_DIR)
    .filter((locale) => fs.existsSync(path.join(LOCALES_DIR, locale, "messages.json")));
  assert.equal(locales.length, 24);

  for (const locale of locales) {
    const names = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, locale, "languages.json"), "utf8"));
    assert.ok(Object.keys(names).length > 100, locale);
    assert.equal(typeof names.en, "string", locale);
    assert.equal(names.auto, undefined, locale);
  }
});
