# Tokenized Assets

A comprehensive Ethereum smart contract framework for tokenizing financial assets — equities, bonds, derivatives (futures & options), and real estate (land NFTs with fractionalization). Built with Hardhat, OpenZeppelin upgradeable contracts (UUPS), and a React frontend.

## Architecture

```
contracts/
├── core/
│   ├── BaseAssetToken.sol       # Abstract ERC-20 base for all tokens (compliance + oracle)
│   ├── ComplianceRegistry.sol   # Investor whitelisting, blacklisting, accreditation (UUPS)
│   ├── PriceOracle.sol          # Chainlink price feed aggregator (UUPS)
│   └── TokenFactory.sol         # Factory deploying ERC-1967 proxies for all asset types (UUPS)
├── tokens/
│   ├── EquityToken.sol          # ERC-20 equity with snapshots, dividends, voting delegation
│   ├── BondToken.sol            # ERC-20 bond with coupon payments and redemption at maturity
│   ├── LandToken.sol            # ERC-721 land NFT with property metadata
│   └── FractionalLandToken.sol  # ERC-1155 fractional land ownership with rent distribution
├── derivatives/
│   ├── DerivativeBase.sol       # Abstract base for derivatives (positions, margin, settlement)
│   ├── FuturesContract.sol      # Margin-based futures with liquidation
│   └── OptionsContract.sol      # Call/put options with collateral and exercise
├── interfaces/                  # Solidity interfaces for all core contracts
├── libraries/
│   └── AssetTypes.sol           # Shared enums, structs, and custom errors
└── mocks/
    └── MockPriceFeed.sol        # Mock Chainlink AggregatorV3Interface for testing
```

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **MetaMask** browser extension (for frontend interaction)

## Quick Start

### 1. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Compile contracts

```bash
npx hardhat compile
```

### 3. Run tests

```bash
npx hardhat test
```

All 174 tests should pass (9 unit test suites + 4 integration test suites).

### 4. Start local blockchain & deploy

In **terminal 1** — start a local Hardhat node:

```bash
npx hardhat node
```

In **terminal 2** — deploy all contracts:

```bash
npx hardhat run scripts/deploy/full-deploy.ts --network localhost
```

This deploys in order:
1. ComplianceRegistry (UUPS proxy)
2. PriceOracle (UUPS proxy)
3. Implementation contracts (EquityToken, BondToken, FuturesContract, OptionsContract, LandToken, FractionalLandToken)
4. TokenFactory (UUPS proxy) — registers all implementations

Deployment addresses are saved to `deployments/localhost.json`.

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 and connect MetaMask to `localhost:8545` (chain ID 31337).

## Testing

### Unit Tests

Each contract has a dedicated unit test file in `test/unit/`:

| Test File | Coverage |
|-----------|----------|
| `ComplianceRegistry.test.ts` | Whitelisting, blacklisting, accreditation, batch ops, transfer checks |
| `EquityToken.test.ts` | Snapshots, dividends, voting delegation, compliance-gated transfers |
| `BondToken.test.ts` | Coupon accrual/claiming, redemption at maturity, proportional payouts |
| `FuturesContract.test.ts` | Open/close positions, PnL, liquidation, settlement |
| `OptionsContract.test.ts` | Write/buy/exercise options, expiration, collateral withdrawal |
| `LandToken.test.ts` | Mint properties, fractionalization, valuation updates |
| `FractionalLandToken.test.ts` | Fractionalize, mint fractions, rent distribution/claiming |
| `PriceOracle.test.ts` | Price feeds, staleness checks, feed management |
| `TokenFactory.test.ts` | Deploy all asset types, asset registry, role-based access |

### Integration Tests

End-to-end workflows in `test/integration/`:

| Test File | Scenario |
|-----------|----------|
| `FullWorkflow.test.ts` | Multi-asset platform: equity lifecycle, bond lifecycle, factory tracking, compliance |
| `BondLifecycle.test.ts` | Issue bonds → claim coupons → advance to maturity → redeem |
| `ComplianceTransfers.test.ts` | Whitelisted transfers succeed, non-whitelisted revert, blacklist enforcement |
| `LandFractionalization.test.ts` | Mint land NFT → fractionalize → distribute rent → claim rent |

### Run specific tests

```bash
npx hardhat test test/unit/EquityToken.test.ts
npx hardhat test test/integration/FullWorkflow.test.ts
```

### Test Helpers

- `test/helpers/setup.ts` — Infrastructure deployment helpers
- `test/helpers/constants.ts` — Test constants (roles, time units, prices)
- `test/helpers/time.ts` — EVM time manipulation (increaseTime, mineBlocks)

## Deployment Scripts

### Individual scripts

```bash
npx hardhat run scripts/deploy/01-deploy-compliance-registry.ts --network localhost
npx hardhat run scripts/deploy/02-deploy-price-oracle.ts --network localhost
npx hardhat run scripts/deploy/03-deploy-implementations.ts --network localhost
npx hardhat run scripts/deploy/04-deploy-token-factory.ts --network localhost  # requires params from 01-03
```

### Full orchestrated deployment

```bash
npx hardhat run scripts/deploy/full-deploy.ts --network localhost
```

### Upgrade a contract

```bash
PROXY_ADDRESS=0x... CONTRACT_NAME=ComplianceRegistry \
  npx hardhat run scripts/upgrade/upgrade-contract.ts --network localhost
```

Supported contract names: `ComplianceRegistry`, `PriceOracle`, `TokenFactory`, `EquityToken`, `BondToken`, `FuturesContract`, `OptionsContract`, `LandToken`, `FractionalLandToken`.

### Deploy to Sepolia

1. Copy `.env.example` to `.env` and fill in:
   ```
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   PRIVATE_KEY=your_deployer_private_key
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

2. Deploy:
   ```bash
   npx hardhat run scripts/deploy/full-deploy.ts --network sepolia
   ```

## Frontend

Built with React 18, Vite, TypeScript, ethers.js v6, react-router-dom, and Tailwind CSS.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview of all deployed assets, wallet status, network info |
| Deploy Asset | `/deploy` | Forms to deploy Equity, Bond, or Land tokens via TokenFactory |
| Asset Detail | `/asset/:address` | Dynamic detail view per asset type (equity/bond/land) |
| Portfolio | `/portfolio` | Connected wallet's token holdings and balances |
| Admin Panel | `/admin` | Compliance management: whitelist, blacklist, batch ops, status checks |

### Frontend development

```bash
cd frontend
npm run dev      # Start dev server on port 3000
npm run build    # Production build to frontend/dist/
npm run preview  # Preview production build
```

### Connecting MetaMask

1. Open MetaMask → Add network manually:
   - Network name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`

2. Import a Hardhat test account using the private key from `npx hardhat node` output.

## Key Design Decisions

- **UUPS Proxy Pattern**: All core contracts use UUPS (Universal Upgradeable Proxy Standard) for upgradeability
- **ReentrancyGuardTransient**: Uses EIP-1153 transient storage (Cancun EVM) instead of storage-based reentrancy guard — more gas efficient and upgrade-safe (no constructor)
- **Compliance-Gated Transfers**: All token transfers are checked against ComplianceRegistry. Only whitelisted-to-whitelisted transfers are allowed
- **Chainlink Oracle Integration**: PriceOracle wraps Chainlink AggregatorV3Interface with staleness checking
- **Factory Pattern**: TokenFactory deploys ERC-1967 proxies for all asset types and maintains an on-chain registry

## Project Structure

```
tokenized-assets/
├── contracts/           # Solidity smart contracts
├── test/                # Hardhat tests (unit + integration)
│   ├── unit/
│   ├── integration/
│   └── helpers/
├── scripts/             # Deployment and upgrade scripts
│   ├── deploy/
│   └── upgrade/
├── deployments/         # Deployment address records per network
├── frontend/            # React + Vite frontend
│   ├── src/
│   │   ├── pages/       # Dashboard, DeployAsset, AssetDetail, Portfolio, AdminPanel
│   │   ├── components/  # Layout, Header, ConnectWallet
│   │   ├── hooks/       # useWallet, useTokenFactory, useComplianceRegistry
│   │   ├── config/      # Contract ABIs, addresses, chain configs
│   │   └── styles/      # Global CSS with Tailwind
│   └── ...
├── hardhat.config.ts    # Hardhat configuration (Solidity 0.8.26, Cancun EVM)
├── .env.example         # Environment variable template
└── package.json
```

## License

MIT
