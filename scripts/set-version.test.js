const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const MANIFESTS = ["manifest.chrome.json", "manifest.edge.json", "manifest.firefox.json"];

const roots = [];
after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));

// A copy of the script in a repository of its own, every file on `version`.
function repository(version = "1.2.0") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "set-version-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "set-version.js"), path.join(root, "scripts", "set-version.js"));
  const write = (file, data) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
  write("package.json", { name: "hover-translate", version, engines: { node: ">=24" } });
  write("package-lock.json", { name: "hover-translate", version, packages: { "": { version }, "node_modules/x": { version: "9.9.9" } } });
  MANIFESTS.forEach((file) => write(file, { manifest_version: 3, version }));
  return root;
}

const run = (root, ...args) => spawnSync(process.execPath, ["scripts/set-version.js", ...args], { cwd: root, encoding: "utf8" });
const versions = (root) => ["package.json", ...MANIFESTS].map((file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8")).version);
const lock = (root) => JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));

test("a higher version is written everywhere, and nothing else", () => {
  const root = repository();
  assert.equal(run(root, "1.2.1").status, 0);
  assert.deepEqual(versions(root), ["1.2.1", "1.2.1", "1.2.1", "1.2.1"]);
  assert.equal(lock(root).version, "1.2.1");
  assert.equal(lock(root).packages[""].version, "1.2.1");
  assert.equal(lock(root).packages["node_modules/x"].version, "9.9.9");
});

test("versions compare as numbers: 1.10.0 is higher than 1.9.0", () => {
  const root = repository("1.9.0");
  assert.equal(run(root, "1.10.0").status, 0);
});

test("the same or a lower version is refused, and nothing changes", () => {
  const root = repository();
  for (const version of ["1.2.0", "1.1.99", "0.9.0"]) {
    const result = run(root, version);
    assert.equal(result.status, 1, version);
    assert.match(result.stderr, /is not greater than the current version 1\.2\.0/);
  }
  assert.deepEqual(versions(root), ["1.2.0", "1.2.0", "1.2.0", "1.2.0"]);
});

test("not X.Y.Z: refused", () => {
  assert.equal(run(repository(), "1.3").status, 1);
  assert.equal(run(repository()).status, 1);
});

test("--check: every file on package.json's version", () => {
  const result = run(repository(), "--check");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Version 1\.2\.0 in every file/);
});

test("--check: a manifest or the lock file on another version fails, and names it", () => {
  const root = repository();
  const edge = path.join(root, "manifest.edge.json");
  fs.writeFileSync(edge, fs.readFileSync(edge, "utf8").replace("1.2.0", "1.2.1"));
  const result = run(root, "--check");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifest\.edge\.json: 1\.2\.1/);

  const lockRoot = repository();
  const lockFile = path.join(lockRoot, "package-lock.json");
  const data = lock(lockRoot);
  data.packages[""].version = "1.1.0";
  fs.writeFileSync(lockFile, JSON.stringify(data));
  assert.equal(run(lockRoot, "--check").status, 1);
});

test("--check: the generated manifest.json is not checked", () => {
  const root = repository();
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ version: "1.0.0" }));
  assert.equal(run(root, "--check").status, 0);
});

test("--check: the repository itself", () => {
  assert.equal(spawnSync(process.execPath, [path.join(__dirname, "set-version.js"), "--check"]).status, 0);
});
