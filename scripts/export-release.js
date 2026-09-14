#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { prepareStandardInput } = require("./lib/build-info");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DOCS = path.join(ROOT, "docs");
const ARTIFACT_NAME = "Towel";
const SOURCE_NAME = "contracts/Towel.sol";
const CONTRACT_NAME = "Towel";

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function main() {
  run("npx hardhat clean");
  run("npx hardhat compile");

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
  const prepared = prepareStandardInput(ROOT, {
    artifactName: ARTIFACT_NAME,
    sourceName: SOURCE_NAME,
    contractName: CONTRACT_NAME,
  });

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  fs.writeFileSync(path.join(DIST, `${ARTIFACT_NAME}.json`), JSON.stringify(prepared.artifact, null, 2));
  fs.writeFileSync(
    path.join(DIST, `${ARTIFACT_NAME}.standard-input.json`),
    JSON.stringify(prepared.filteredInput, null, 2)
  );
  fs.writeFileSync(
    path.join(DIST, "meta.json"),
    JSON.stringify(
      {
        name: ARTIFACT_NAME,
        version: pkg.version,
        sourceName: SOURCE_NAME,
        contractName: CONTRACT_NAME,
        sourceCount: prepared.sourceCount,
        buildInfo: path.basename(prepared.buildInfoPath),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  fs.mkdirSync(DOCS, { recursive: true });
  const abiPath = path.join(DOCS, `${ARTIFACT_NAME}.abi.json`);
  fs.writeFileSync(abiPath, JSON.stringify(prepared.artifact.abi, null, 2));

  console.log(
    `Export ok: dist/ (${prepared.sourceCount} sources in standard-input), docs/${ARTIFACT_NAME}.abi.json`
  );
}

main();
