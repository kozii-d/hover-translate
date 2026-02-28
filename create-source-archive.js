const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

function createSourceArchive() {
  try {
    const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const version = pkg.version;

    // Create structure: releases/version/
    const versionDir = path.join("./releases", version);
    const outputName = `${pkg.name}-source.zip`;
    const outputPath = path.join(versionDir, outputName);

    // Create a version directory if it doesn't exist
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
      console.log(`📁 Created version directory: ${versionDir}`);
    }

    // Files and directories to EXCLUDE
    const excludePatterns = [
      "node_modules/*",
      "*/node_modules/*",
      "dist/*",
      "*/dist/*",
      "releases/*",
      ".git/*",
      ".idea/*",
      ".vscode/*",
      "*.DS_Store",
      "*/.DS_Store",
      ".claude",
      ".claude/*",
      "CLAUDE.md",
      ".env",
      "*.log",
      "*.tsbuildinfo",
      "coverage/*",
      ".nyc_output/*",
      "manifest.json",
      "*~",
      "*.swp",
      "*.swo"
    ].map(pattern => `"${pattern}"`).join(" ");

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    const command = `zip -r ${outputPath} . -x ${excludePatterns}`;

    console.log(`📦 Creating source archive: ${outputName}`);
    console.log(`Running: ${command}`);

    execSync(command, { stdio: "inherit" });

    console.log(`✅ Source archive created: ${path.relative('.', outputPath)}`);

    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Archive size: ${fileSizeInMB} MB`);

    console.log(`\n📋 Upload this file to Firefox Add-ons as source code: ${path.relative('.', outputPath)}`);

  } catch (error) {
    console.error("❌ Error creating source archive:", error.message);
    process.exit(1);
  }
}

createSourceArchive();