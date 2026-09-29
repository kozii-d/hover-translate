const fs = require("node:fs");

// Usage: node check-json.js <file>...
// Fails on the files that are not valid JSON, naming each: a broken locale
// file only shows up as missing strings in the popup.

const broken = process.argv.slice(2).filter((file) => {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
    return false;
  } catch (error) {
    console.error(`${file} is not valid JSON: ${error.message}`);
    return true;
  }
});

if (broken.length) process.exit(1);
