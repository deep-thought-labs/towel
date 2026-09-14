const fs = require("fs");
const path = require("path");

const IMPORT_RE =
  /import\s+(?:[\w\s{},*]*\s+from\s+)?["']([^"']+)["']\s*;/g;

function normalizeBytecode(hex) {
  if (!hex || typeof hex !== "string") return "";
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

function buildInfoDir(cwd) {
  return path.join(cwd, "artifacts", "build-info");
}

function readBuildInfoFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return { filePath, raw };
}

function deployedBytecodeFromBuildInfo(buildInfo, sourceName, contractName) {
  const contract = buildInfo.raw.output?.contracts?.[sourceName]?.[contractName];
  if (!contract?.evm?.deployedBytecode?.object) return null;
  return normalizeBytecode(contract.evm.deployedBytecode.object);
}

function findBuildInfoForBytecode(cwd, { sourceName, contractName, deployedBytecode }) {
  const target = normalizeBytecode(deployedBytecode);
  if (!target) {
    throw new Error("deployedBytecode is empty; cannot resolve build-info.");
  }

  const dir = buildInfoDir(cwd);
  if (!fs.existsSync(dir)) {
    throw new Error(`${dir} does not exist. Run npm run compile before export.`);
  }

  const matches = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const filePath = path.join(dir, name);
    let entry;
    try {
      entry = readBuildInfoFile(filePath);
    } catch {
      continue;
    }
    const bytecode = deployedBytecodeFromBuildInfo(entry, sourceName, contractName);
    if (bytecode && bytecode === target) {
      matches.push(entry);
    }
  }

  return matches;
}

function parseImports(content) {
  if (!content || typeof content !== "string") return [];
  const imports = [];
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveImportPath(fromSourceKey, importPath) {
  if (importPath.startsWith("@") || importPath.startsWith("http")) {
    return importPath;
  }
  const normalized = importPath.replace(/\\/g, "/");
  if (normalized.startsWith("./") || normalized.startsWith("../")) {
    const baseDir = fromSourceKey.replace(/\\/g, "/").split("/").slice(0, -1);
    return path.posix.normalize(path.posix.join(...baseDir, normalized));
  }
  return normalized;
}

function collectImportClosure(sources, rootSourceKey) {
  if (!sources[rootSourceKey]) {
    throw new Error(`Standard input does not contain root source: ${rootSourceKey}`);
  }

  const closure = new Set([rootSourceKey]);
  const queue = [rootSourceKey];

  while (queue.length) {
    const current = queue.shift();
    const content = sources[current]?.content;
    for (const imp of parseImports(content)) {
      const resolved = resolveImportPath(current, imp);
      if (sources[resolved] && !closure.has(resolved)) {
        closure.add(resolved);
        queue.push(resolved);
      }
    }
  }

  return closure;
}

function filterStandardInput(input, rootSourceKey) {
  if (!input?.sources) {
    throw new Error("Invalid standard input: missing sources.");
  }
  const closure = collectImportClosure(input.sources, rootSourceKey);
  const filteredSources = {};
  for (const key of closure) {
    filteredSources[key] = input.sources[key];
  }
  return {
    language: input.language,
    sources: filteredSources,
    settings: input.settings,
  };
}

function assertVerificationInputClean(filtered, rootSourceKey) {
  if (!filtered?.sources?.[rootSourceKey]) {
    throw new Error(`Filtered standard input does not include verified source ${rootSourceKey}.`);
  }
  for (const key of Object.keys(filtered.sources)) {
    if (key.includes("test/") || key.includes("test\\")) {
      throw new Error(`Filtered standard input includes test source: ${key}`);
    }
  }
}

function prepareStandardInput(cwd, { artifactName, sourceName, contractName }) {
  const artifactPath = path.join(cwd, "artifacts", "contracts", `${artifactName}.sol`, `${artifactName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run npm run compile.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const deployedBytecode = artifact.deployedBytecode;
  const matches = findBuildInfoForBytecode(cwd, { sourceName, contractName, deployedBytecode });
  if (!matches.length) {
    throw new Error(`No build-info matches bytecode for ${artifactName}.`);
  }

  const buildInfo = matches[0];
  const input = buildInfo.raw.input;
  if (!input || input.language !== "Solidity") {
    throw new Error(`Invalid build-info (missing input.language): ${buildInfo.filePath}`);
  }

  const filtered = filterStandardInput(input, sourceName);
  assertVerificationInputClean(filtered, sourceName);

  return {
    artifact,
    filteredInput: filtered,
    buildInfoPath: buildInfo.filePath,
    sourceCount: Object.keys(filtered.sources).length,
  };
}

module.exports = {
  prepareStandardInput,
  filterStandardInput,
  assertVerificationInputClean,
};
