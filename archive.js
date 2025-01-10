const fs = require("fs");
const { execSync } = require("child_process");

try {
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
  const name = pkg.name;
  const version = manifest.version;
  const outputName = `${name}-${version}.zip`;

  const exclude = "*.DS_Store";
  const command = `zip -vr ../${outputName} . -x "${exclude}"`;

  console.log(`Running: ${command}`);
  execSync(command, { stdio: "inherit" });

  console.log(`✅ Successfully archived as ${outputName}`);
} catch (error) {
  console.error("❌ Error creating archive:", error.message);
  process.exit(1);
}