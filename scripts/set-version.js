const fs = require("node:fs");
const path = require("node:path");

// Usage: npm run version:set -- 1.2.0
// Writes the version into every file that carries it, so they can't drift:
// package.json, package-lock.json, the three browser manifests, and the
// generated manifest.json when it exists. Refuses a version that is not
// X.Y.Z or not greater than the current one: the stores only accept a higher
// version than the one they already serve.
//
// Semver for the extension, read off the CHANGELOG section of the release:
// only "Fixed" → patch; anything "Added" or a noticeable change → minor;
// something the user loses or has to redo themselves → major.

const ROOT = path.join(__dirname, "..");

// File, and how many leading "version" fields in it belong to the extension
// (package-lock.json repeats it under packages[""])
const FILES = [
  { file: "package.json", count: 1 },
  { file: "package-lock.json", count: 2 },
  { file: "manifest.chrome.json", count: 1 },
  { file: "manifest.edge.json", count: 1 },
  { file: "manifest.firefox.json", count: 1 },
  { file: "manifest.json", count: 1, optional: true },
];

const VERSION_FIELD = /("version":\s*")([^"]*)(")/g;

const parse = (version) => version.split(".").map(Number);

const isGreater = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
};

const next = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(next ?? "")) {
  console.error("Usage: npm run version:set -- X.Y.Z");
  process.exit(1);
}

const current = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

if (!isGreater(next, current)) {
  console.error(`${next} is not greater than the current version ${current}`);
  process.exit(1);
}

// Every file is checked before any is written, so a failure changes nothing
const updates = [];

for (const { file, count, optional } of FILES) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    if (optional) continue;
    console.error(`${file} not found`);
    process.exit(1);
  }

  let replaced = 0;
  const text = fs.readFileSync(filePath, "utf8").replace(VERSION_FIELD, (match, start, _old, end) =>
    replaced++ < count ? `${start}${next}${end}` : match,
  );
  if (replaced < count) {
    console.error(`${file}: expected ${count} "version" field(s), found ${replaced}`);
    process.exit(1);
  }

  updates.push({ file, filePath, text });
}

for (const { file, filePath, text } of updates) {
  fs.writeFileSync(filePath, text);
  console.log(`${file}: ${next}`);
}

console.log(`\nVersion ${current} → ${next}. Check the CHANGELOG section is [${next}].`);
