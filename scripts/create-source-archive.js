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

    // Only what git tracks, so nothing untracked or ignored reaches the reviewers. The files are
    // taken from the working tree, not HEAD: a release builds before it is committed, and the
    // archive has to match that build (the new version is not committed yet). Left out as not
    // needed for the build: the README's GIFs, the store listing material and the agents' files.
    const gitFiles = (options) =>
      execSync(
        `git ls-files -z ${options} -- ':(exclude)docs' ':(exclude)store-assets' ':(exclude).claude' ':(exclude)CLAUDE.md'`,
        { encoding: "utf8" },
      )
        .split("\0")
        .filter(Boolean);
    const files = gitFiles("");
    // A new file the build needs but not yet added to git would be in the .xpi and not here.
    const untracked = gitFiles("--others --exclude-standard");

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log(`📦 Creating source archive: ${outputName} (${files.length} files tracked by git)`);

    // -MM: a tracked file missing from the working tree is an error, not silently skipped.
    execSync(`zip -MM ${outputPath} -@`, {
      input: files.map((file) => `${file}\n`).join(""),
      stdio: ["pipe", "inherit", "inherit"],
    });

    console.log(`✅ Source archive created: ${path.relative(".", outputPath)}`);

    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Archive size: ${fileSizeInMB} MB`);

    console.log(
      `\n📋 Upload this file to Firefox Add-ons as source code: ${path.relative(".", outputPath)}`,
    );

    // Last, so it is not lost among zip's lines. A warning only: a stray note should not stop a release.
    if (untracked.length > 0) {
      console.warn(
        `\n⚠️  Not tracked by git, so not in the source archive (git add what the build needs, then run it again):\n${untracked.map((file) => `  ${file}`).join("\n")}`,
      );
    }
  } catch (error) {
    console.error("❌ Error creating source archive:", error.message);
    process.exit(1);
  }
}

createSourceArchive();
