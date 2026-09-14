#!/usr/bin/env node
const MIN_MAJOR = 22;
const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (Number.isNaN(major) || major < MIN_MAJOR) {
  console.error(
    [
      "",
      "Incorrect Node.js version for this project.",
      `  Required : >= ${MIN_MAJOR} (see .nvmrc and package.json → engines)`,
      `  Detected : v${process.versions.node}`,
      "",
      "With nvm (recommended, from the repo root):",
      "  nvm install",
      "  nvm use",
      "  node -v",
      "  npm install",
      "",
      "Without nvm: install Node.js 22 LTS from https://nodejs.org/ and run npm install again.",
      "",
    ].join("\n")
  );
  process.exit(1);
}
