const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const ARCHIVE = path.join("releases", "1.2.0", "hover-translate-source.zip");

// A git hook (pre-push runs `verify`) exports GIT_DIR and the like; they would point git at this repository.
// The ceiling keeps git from finding a repository above the temporary directories.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))),
  GIT_CEILING_DIRECTORIES: fs.realpathSync(os.tmpdir()),
};

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

const sh = (root, command, args) => {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8" });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
};

const write = (root, file, content = `${file}\n`) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
};

// Every file here is tracked (added to the index, nothing committed).
const TRACKED = [
  "package.json",
  ".gitignore",
  "scripts/create-source-archive.js",
  "manifest.firefox.json",
  "extension/src/content.ts",
  "_locales/en/messages.json",
  ".husky/pre-commit",
  "a name with spaces [1] ü.txt",
  "docs/demo.gif",
  "store-assets/descriptions/en.txt",
  ".claude/skills/release/SKILL.md",
  "CLAUDE.md",
];
const LEFT_OUT = ["docs/demo.gif", "store-assets/descriptions/en.txt", ".claude/skills/release/SKILL.md", "CLAUDE.md"];

// A copy of the script in a git repository of its own.
function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-archive-"));
  roots.push(root);
  sh(root, "git", ["init", "--quiet"]);
  write(root, "package.json", `${JSON.stringify({ name: "hover-translate", version: "1.2.0" }, null, 2)}\n`);
  write(root, ".gitignore", ".env\n*.local\nnode_modules/\n");
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "create-source-archive.js"), path.join(root, "scripts", "create-source-archive.js"));
  TRACKED.filter((file) => !fs.existsSync(path.join(root, file))).forEach((file) => write(root, file));
  sh(root, "git", ["add", "--", ...TRACKED]);
  return root;
}

const run = (root) => spawnSync(process.execPath, ["scripts/create-source-archive.js"], { cwd: root, env, encoding: "utf8" });

// Every entry of the archive, directories included (they end in "/").
const entries = (root) => sh(root, "unzip", ["-Z1", ARCHIVE]).split("\n").filter(Boolean).sort();
const content = (root, file) => sh(root, "unzip", ["-p", ARCHIVE, file]);

const expected = TRACKED.filter((file) => !LEFT_OUT.includes(file)).sort();

// The files the warning about untracked files names, one per line under its heading; null without it.
function warned(result) {
  const lines = result.stderr.split("\n");
  const heading = lines.findIndex((line) => line.includes("Not tracked by git"));
  if (heading === -1) return null;
  const listed = [];
  for (const line of lines.slice(heading + 1)) {
    if (!line.startsWith("  ")) break;
    listed.push(line.trim());
  }
  return listed;
}

test("untracked files and directories, the empty one included, stay out", () => {
  const root = repository();
  write(root, "stray.txt");
  write(root, ".codemie/notes.md");
  fs.mkdirSync(path.join(root, ".empty-tool-dir"));
  write(root, "extension/src/scratch.ts");

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(entries(root), expected);
});

test("ignored files stay out", () => {
  const root = repository();
  write(root, ".env", "AMO_API_SECRET=secret\n");
  write(root, "notes.local");
  write(root, "node_modules/x/index.js");
  write(root, "extension/node_modules/y/index.js");

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(entries(root), expected);
  assert.equal(warned(result), null);
});

test("untracked files are named in a warning, and the archive is made all the same", () => {
  const root = repository();
  write(root, "stray.txt");
  write(root, ".codemie/notes.md");
  write(root, "extension/src/scratch.ts");
  write(root, "a new name [2] ü.txt");
  // Not needed for the build, so not worth a warning.
  write(root, "docs/draft.gif");
  write(root, "store-assets/descriptions/fr.txt");
  write(root, ".claude/settings.local.json");

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(warned(result), [".codemie/notes.md", "a new name [2] ü.txt", "extension/src/scratch.ts", "stray.txt"]);
  assert.deepEqual(entries(root), expected);
});

test("every tracked file goes in, except docs/, store-assets/, .claude/ and CLAUDE.md", () => {
  const root = repository();
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(entries(root).filter((entry) => !entry.endsWith("/")), expected);
  assert.equal(warned(result), null);
});

test("a tracked file goes in as it is in the working tree, uncommitted edits included", () => {
  const root = repository();
  write(root, "manifest.firefox.json", `${JSON.stringify({ version: "1.2.1" })}\n`);

  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(content(root, "manifest.firefox.json")).version, "1.2.1");
});

test("a tracked file missing from the working tree fails the script instead of being left out", () => {
  const root = repository();
  fs.rmSync(path.join(root, "extension/src/content.ts"));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Error creating source archive/);
  assert.equal(fs.existsSync(path.join(root, ARCHIVE)), false);
});

test("outside a git repository the script fails", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-archive-"));
  roots.push(root);
  write(root, "package.json", JSON.stringify({ name: "hover-translate", version: "1.2.0" }));
  write(root, "extension/src/content.ts");
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "create-source-archive.js"), path.join(root, "scripts", "create-source-archive.js"));

  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(path.join(root, ARCHIVE)), false);
});
