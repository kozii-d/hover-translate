const fs = require("node:fs");
const path = require("node:path");

// Usage: node check-deps.js
// The git hooks and `npm run verify` run tools from all three packages. A
// package without node_modules would fail deep inside one of them with a stack
// trace; this names the package and the command instead.

const ROOT = path.join(__dirname, "..");

const missing = [".", "extension", "popup"].filter((dir) => !fs.existsSync(path.join(ROOT, dir, "node_modules")));

for (const dir of missing) {
  const where = dir === "." ? "the repository root" : `${dir}/`;
  console.error(`No node_modules in ${where}: run \`npm ci\` in ${where} first.`);
}

if (missing.length) process.exit(1);
