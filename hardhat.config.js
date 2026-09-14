require("@nomicfoundation/hardhat-toolbox");

const path = require("path");
const fs = require("fs");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, hre, runSuper) => {
  const sources = await runSuper();
  const helpersDir = path.join(hre.config.paths.root, "test/helpers");
  if (!fs.existsSync(helpersDir)) return sources;
  const extra = fs
    .readdirSync(helpersDir)
    .filter((name) => name.endsWith(".sol"))
    .map((name) => path.join(helpersDir, name));
  return [...sources, ...extra.filter((p) => !sources.includes(p))];
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
