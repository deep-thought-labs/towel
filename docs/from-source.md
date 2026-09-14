# From source

Compile, test, and export artifacts from source.

**Requirements:** [nvm](https://github.com/nvm-sh/nvm), Node.js 22+ (`.nvmrc`), npm. Dev dependencies are pinned in `package.json` and `package-lock.json`; use **`npm ci`** (not `npm install`) so the toolchain and bytecode stay reproducible.

```bash
nvm install && nvm use
npm ci
npm run compile   # compiles contracts/ → artifacts/
npm test
npm run export    # clean + compile + writes dist/ and docs/Towel.abi.json
```

**`npm run export`** writes contract artifacts to `dist/` (not versioned in git), and refreshes [`Towel.abi.json`](Towel.abi.json) for integrators.

---

Towel is verified on the explorer. These are the values that were used:

| Blockscout | Value |
| --- | --- |
| License | MIT |
| Compiler | v0.8.24+commit.e11b9ed9 |
| EVM, optimizer | cancun, 200 runs |
| Method | Solidity (Standard JSON input) |
| File | `dist/Towel.standard-input.json` |
