const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Usage: node archive.js [browser] [mode]
const browser = process.argv[2];
const mode = process.argv[3] || "production";

const browsers = {
  chrome: {
    manifest: "manifest.chrome.json",
    format: "zip",
    outputDir: "./releases"
  },
  edge: {
    manifest: "manifest.edge.json",
    format: "zip",
    outputDir: "./releases"
  },
  firefox: {
    manifest: "manifest.firefox.json",
    format: "xpi",
    outputDir: "./releases"
  }
};

function createArchive(browserName) {
  let originalManifestBackup = null;

  try {
    const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
    const browserConfig = browsers[browserName];

    if (!browserConfig) {
      throw new Error(`Unknown browser: ${browserName}. Use: chrome, edge, or firefox`);
    }

    const manifestFile = browserConfig.manifest;
    if (!fs.existsSync(manifestFile)) {
      throw new Error(`Manifest file not found: ${manifestFile}`);
    }

    // Сохраняем оригинальный manifest.json если он существует
    if (fs.existsSync("manifest.json")) {
      originalManifestBackup = fs.readFileSync("manifest.json", "utf8");
      console.log(`💾 Backed up existing manifest.json`);
    }

    // Copy the browser-specific manifest to manifest.json
    fs.copyFileSync(manifestFile, "manifest.json");
    console.log(`📋 Using ${manifestFile} as manifest.json`);

    const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
    const name = pkg.name;
    const version = manifest.version;
    const extension = browserConfig.format;
    const outputName = `${name}-${browserName}-${version}-${mode}.${extension}`;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(browserConfig.outputDir)) {
      fs.mkdirSync(browserConfig.outputDir, { recursive: true });
      console.log(`📁 Created ${browserConfig.outputDir} directory`);
    }

    const outputPath = path.join(browserConfig.outputDir, outputName);

    const exclude = "*.DS_Store";
    const filesToInclude = "manifest.json _locales assets/icons extension/dist popup/dist";

    const command = `zip -vr ${outputPath} ${filesToInclude} -x "${exclude}"`;
    console.log(`📦 Creating ${browserName} package${browserName === 'firefox' ? ' (XPI format)' : ''}...`);

    console.log(`Running: ${command}`);
    execSync(command, { stdio: "inherit" });

    console.log(`✅ Successfully packaged as ${outputName}`);

    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Package size: ${fileSizeInMB} MB`);

    // Restore original manifest.json and clean up temporary manifest.json
    if (originalManifestBackup) {
      fs.writeFileSync("manifest.json", originalManifestBackup);
      console.log(`🔄 Restored original manifest.json`);
    } else {
      fs.unlinkSync("manifest.json");
      console.log(`🧹 Cleaned up temporary manifest.json`);
    }

  } catch (error) {
    console.error("❌ Error creating archive:", error.message);

    // Restore original manifest.json even if an error occurs
    if (originalManifestBackup) {
      try {
        fs.writeFileSync("manifest.json", originalManifestBackup);
        console.log(`🔄 Restored original manifest.json after error`);
      } catch (restoreError) {
        console.warn(`⚠️ Could not restore original manifest.json: ${restoreError.message}`);
      }
    } else if (fs.existsSync("manifest.json")) {
      try {
        fs.unlinkSync("manifest.json");
        console.log(`🧹 Cleaned up temporary manifest.json after error`);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not clean up manifest.json: ${cleanupError.message}`);
      }
    }

    process.exit(1);
  }
}

if (!browser) {
  console.log("🚀 Creating packages for all browsers...");
  Object.keys(browsers).forEach(browserName => {
    console.log(`\n📦 Creating ${browserName} package...`);
    createArchive(browserName);
  });
  console.log(`\n🎉 All packages created successfully!`);
} else {
  console.log(`📦 Creating ${browser} package...`);
  createArchive(browser);
}