const fs = require("node:fs");
const path = require("node:path");

// The tests load the built extension (see `copyExtension` in extension.js).
module.exports = () => {
  const root = path.resolve(__dirname, "..");
  const missing = ["extension/dist/content.bundle.js", "extension/dist/background.bundle.js", "popup/dist/index.html"]
    .filter((file) => !fs.existsSync(path.join(root, file)));

  if (missing.length) {
    throw new Error(`Not built: ${missing.join(", ")}. Run \`npm run build\` first.`);
  }
};
