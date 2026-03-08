# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Smart Contracts (root)
```bash
npx hardhat compile          # Compile Solidity contracts
npx hardhat test             # Run all tests
npx hardhat test --grep "EquityToken"  # Run a single test suite by name
npx hardhat node             # Start local Hardhat network
npx hardhat run scripts/deploy.js --network localhost  # Deploy locally
npx hardhat run scripts/deploy.js --network sepolia   # Deploy to Sepolia testnet
```

### Frontend (`frontend/`)
```bash
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
```

## Architecture

This is an upgradeable tokenized asset framework using a **factory + UUPS proxy pattern**.

### Contract Hierarchy

```
TokenFactory
  └── Deploys ERC1967Proxy instances for each asset type
        ├── EquityToken (ERC-20) — corporate shares with dividends
        ├── BondToken   (ERC-20) — debt with coupon rate/maturity
        ├── DerivativeToken (ERC-1155) — futures/options with Chainlink oracles
        └── LandToken   (ERC-1155) — fractional real estate

All asset contracts extend AssetBase (abstract):
  ├── RBAC: DEFAULT_ADMIN_ROLE, ISSUER_ROLE, TRADER_ROLE
  ├── Whitelisting (on by default)
  ├── Pausability
  └── UUPS upgradeability
```

### Key Files
- `contracts/TokenFactory.sol` — central deployment hub; tracks all assets in `allAssets[]`
- `contracts/AssetBase.sol` — abstract base with compliance/upgrade logic
- `contracts/EquityToken.sol`, `BondToken.sol`, `DerivativeToken.sol`, `LandToken.sol` — asset implementations
- `scripts/deploy.js` — deploys all implementations + factory, writes factory address to `frontend/src/contracts/addresses.json`
- `test/TokenizedAssets.test.js` — Hardhat + Chai tests covering all asset types

### Frontend
React 19 + Vite + TypeScript + Ethers.js v6 + TailwindCSS 4. Located in `frontend/`. Currently exposes equity token deployment only; other asset types exist in contracts but not yet in the UI.

The deploy script auto-populates `frontend/src/contracts/addresses.json` with the factory address so the frontend knows where to connect.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `SEPOLIA_RPC_URL` — RPC endpoint for Sepolia testnet
- `PRIVATE_KEY` — deployer wallet private key
- `ETHERSCAN_API_KEY` — for contract verification

Hardhat config: Solidity 0.8.24, EVM version `cancun`, optimizer enabled (200 runs).
