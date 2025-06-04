const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

function createSourceArchive() {
  try {
    const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const version = pkg.version;
    const outputName = `${pkg.name}-source-${version}.zip`;
    const outputPath = path.join("./releases", outputName);

    if (!fs.existsSync("./releases")) {
      fs.mkdirSync("./releases", { recursive: true });
      console.log(`📁 Created ./releases directory`);
    }

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

    const command = `zip -r ${outputPath} . -x ${excludePatterns}`;

    console.log(`📦 Creating source archive: ${outputName}`);
    console.log(`Running: ${command}`);
    
    execSync(command, { stdio: "inherit" });

    console.log(`✅ Source archive created: ${outputName}`);
    
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Archive size: ${fileSizeInMB} MB`);

    console.log(`\n📋 Upload this file to Firefox Add-ons as source code: releases/${outputName}`);
    
  } catch (error) {
    console.error("❌ Error creating source archive:", error.message);
    process.exit(1);
  }
}

createSourceArchive();