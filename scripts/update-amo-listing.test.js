const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { buildPatchBody, LOCALE_MAP, AMO_LOCALES, privacyPolicyMarkdown, buildUploads, replaceScreenshots, retryAfter } = require("./update-amo-listing.js");

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

const LINKS = {
  homepage: "https://hovertranslate.app/",
  support_url: "https://github.com/kozii-d/hover-translate/issues",
  support_email: "hovertranslate@gmail.com",
};

test("the links go to every locale of the name, and to no other", () => {
  const locales = Object.keys(body.name).sort();
  for (const [field, value] of Object.entries(LINKS)) {
    assert.deepEqual(Object.keys(body[field] ?? {}).sort(), locales, field);
    for (const locale of locales) assert.equal(body[field][locale], value, `${field} ${locale}`);
  }
});

// --- The privacy policy, as Markdown from site/privacy/index.html ---

const privacyHtml = fs.readFileSync(path.join(__dirname, "..", "site", "privacy", "index.html"), "utf8");

test("the privacy policy keeps every section heading in bold", () => {
  const markdown = privacyPolicyMarkdown(privacyHtml);
  const headings = [...privacyHtml.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, text]) => text.replace(/\s+/g, " ").trim());
  assert.ok(headings.length > 0);
  for (const heading of headings) assert.ok(markdown.split("\n\n").includes(`**${heading}**`), heading);
});

test("the privacy policy keeps links, list items and code", () => {
  const markdown = privacyPolicyMarkdown(privacyHtml);
  // The closing </a> is broken across lines on the page, with the comma right after it
  assert.ok(markdown.includes("[source code](https://github.com/kozii-d/hover-translate),"));
  assert.ok(markdown.includes("\n- **Google**, the default: `translate.googleapis.com`. [Google Privacy Policy](https://policies.google.com/privacy)."));
  assert.ok(markdown.includes("[hovertranslate@gmail.com](mailto:hovertranslate@gmail.com)"));
  // The items of a list follow each other, one per line
  assert.match(markdown, /\n- \*\*Bing\*\*[^\n]*\n- \*\*DeepL\*\*/);
});

test("the privacy policy has no tags, no title of its own and fits AMO", () => {
  const markdown = privacyPolicyMarkdown(privacyHtml);
  assert.equal(markdown.includes("<"), false);
  const blocks = markdown.split("\n\n");
  assert.notEqual(blocks[0], "Privacy policy");
  assert.match(blocks[0], /^Effective /);
  for (const block of blocks) assert.equal(block, block.replace(/ {2,}/g, " ").trim());
  assert.ok(markdown.length <= 150000);
});

test("a tag the policy cannot turn into Markdown stops it by name", () => {
  const page = (inner) => `<html><body><main><h1>Privacy policy</h1>${inner}</main></body></html>`;
  assert.throws(() => privacyPolicyMarkdown(page("<h3>Cookies</h3><p>None.</p>")), /<h3>/);
  assert.throws(() => privacyPolicyMarkdown(page("<p>A <img src=\"x.png\"> picture</p>")), /<img>/);
  assert.throws(() => privacyPolicyMarkdown(page("<section>Loose text</section>")), /Loose text/);
  assert.throws(() => privacyPolicyMarkdown(page("<ul>Lost text<li>An item</li></ul>")), /Lost text/);
});

// --- Screenshots ---

const { AMO_CAPTIONS } = require("../store-assets/render/strings.js");

const shotFiles = (names) => names.map((name) => ({ name, size: 500000 }));
const allShots = Object.keys(AMO_CAPTIONS).map((shot, index) => `${index + 1}-${shot}.png`);

test("uploads go in the order of the numbers in the file names, captioned by the shot", () => {
  const uploads = buildUploads(shotFiles([...allShots].reverse()));
  assert.deepEqual(uploads.map(({ name }) => name), allShots);
  assert.deepEqual(uploads.map(({ position }) => position), allShots.map((_, index) => index));
  const word = uploads[0];
  assert.equal(word.caption["en-US"], AMO_CAPTIONS.word.en);
  assert.equal(word.caption["en-GB"], AMO_CAPTIONS.word.en);
  assert.equal(word.caption["en-CA"], AMO_CAPTIONS.word.en);
  assert.equal(word.caption["zh-CN"], AMO_CAPTIONS.word.zh_CN);
  assert.equal(word.caption["pt-BR"], AMO_CAPTIONS.word.pt_BR);
  for (const { caption } of uploads) {
    for (const locale of Object.keys(caption)) assert.ok(AMO_LOCALES.has(locale), locale);
  }
});

test("files that are not images are not uploaded", () => {
  const uploads = buildUploads(shotFiles([...allShots, "captions.txt"]));
  assert.equal(uploads.length, allShots.length);
});

test("screenshots that AMO would not take stop before any request", () => {
  assert.throws(() => buildUploads([]), /No screenshots/);
  assert.throws(() => buildUploads(shotFiles([...allShots, "8-unknown.png"])), /8-unknown\.png/);
  assert.throws(() => buildUploads(shotFiles(allShots.slice(1))), /word/);
  assert.throws(() => buildUploads(shotFiles(["word.png", ...allShots])), /word\.png/);
  assert.throws(() => buildUploads(shotFiles(["0-word.png", ...allShots.slice(1)])), /0-word\.png/);
  const tooLarge = shotFiles(allShots);
  tooLarge[2].size = 4 * 1024 * 1024 + 1;
  assert.throws(() => buildUploads(tooLarge), new RegExp(allShots[2]));
});

test("a shot or a number that has two files stops before any request", () => {
  // The generator does not clear the folder, so files of an earlier run stay there
  assert.throws(() => buildUploads(shotFiles([...allShots, "9-word.png"])), /word.*1-word\.png.*9-word\.png/);
  assert.throws(() => buildUploads(shotFiles([...allShots, "1-word.jpg"])), /word.*1-word\.png.*1-word\.jpg/);
  assert.throws(() => buildUploads(shotFiles(allShots.map((name) => name.replace(/^2-/, "1-")))), /number 1.*1-word\.png.*1-phrase\.png/);
});

function recordingOperations({ failOnUpload } = {}) {
  const calls = [];
  let nextId = 1000;
  return {
    calls,
    operations: {
      upload: async (item) => {
        calls.push(["upload", item.name]);
        if (item.name === failOnUpload) throw new Error("upload failed");
        return nextId++;
      },
      setCaption: async (id, caption) => calls.push(["setCaption", id, caption]),
      remove: async (id) => calls.push(["remove", id]),
    },
  };
}

test("old screenshots are removed only after every new one is up with its caption", async () => {
  const uploads = buildUploads(shotFiles(allShots));
  const { calls, operations } = recordingOperations();
  await replaceScreenshots(operations, [323380, 323381], uploads);
  const expected = uploads.flatMap((upload, index) => [["upload", upload.name], ["setCaption", 1000 + index, upload.caption]]);
  assert.deepEqual(calls, [...expected, ["remove", 323380], ["remove", 323381]]);
});

test("a failed upload removes nothing", async () => {
  const uploads = buildUploads(shotFiles(allShots));
  const { calls, operations } = recordingOperations({ failOnUpload: uploads[2].name });
  await assert.rejects(replaceScreenshots(operations, [323380], uploads), /upload failed/);
  assert.equal(calls.some(([operation]) => operation === "remove"), false);
  assert.deepEqual(calls.at(-1), ["upload", uploads[2].name]);
});

// --- AMO's limit on writes ---

test("a wait of up to an hour is waited out", () => {
  const now = new Date(2026, 9, 19, 12, 0);
  assert.deepEqual(retryAfter("20", now), { seconds: 20, message: "AMO limit: waiting 1 min (until 12:00)" });
  assert.deepEqual(retryAfter("3600", now), { seconds: 3600, message: "AMO limit: waiting 60 min (until 13:00)" });
});

test("a longer wait, or none given, stops the run", () => {
  const now = new Date(2026, 9, 19, 12, 0);
  assert.throws(() => retryAfter("3601", now), /not before .*13:00/);
  assert.throws(() => retryAfter(null, now), /AMO limit/);
  assert.throws(() => retryAfter("Wed, 21 Oct 2026 07:28:00 GMT", now), /AMO limit/);
});
