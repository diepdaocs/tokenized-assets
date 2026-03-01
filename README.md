# Tokenized Assets Framework

A comprehensive smart contract framework and decentralized application (dApp) designed to tokenize traditional financial instruments—such as equities, bonds, futures, and options—along with real-world assets like land, on the Ethereum blockchain.

## Overview

This project provides a robust, compliant, and upgradeable infrastructure for asset tokenization. It leverages the **UUPS (Universal Upgradeable Proxy Standard)** pattern to allow for future logic updates while maintaining a consistent contract address.

### Key Asset Classes
- **Equities (ERC-20)**: Represent corporate shares with built-in dividend distribution logic.
- **Bonds (ERC-20)**: Represent debt instruments with automated coupon payments and maturity redemption.
- **Derivatives (ERC-1155)**: Handle semi-fungible contracts for futures and options, integrating with **Chainlink oracles** for settlement.
- **Land (ERC-1155)**: Enable fractional ownership of real estate properties.

## Architecture & Features

- **TokenFactory**: A central registry and deployment hub for all asset tokens.
- **Compliance Layer**: Integrated whitelisting and access control (Role-Based Access Control) to meet regulatory requirements.
- **Upgradeability**: All asset tokens are deployed as proxies, allowing for bug fixes and feature enhancements without losing state.
- **Security**: Implements OpenZeppelin's industry-standard libraries for secure token logic and proxy management.

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin (Upgradeable/UUPS), Chainlink.
- **Frontend**: React, Vite, TypeScript, Ethers.js (v6).
- **Network**: Ethereum Sepolia (testnet) and local Hardhat network.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MetaMask](https://metamask.io/) browser extension
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/diepdaocs/tokenized-assets.git
   cd tokenized-assets
   ```

2. **Install root dependencies (Hardhat):**
   ```bash
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Environment Setup:**
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   SEPOLIA_RPC_URL=your_rpc_url
   PRIVATE_KEY=your_private_key
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

---

## Development Workflow

### Smart Contracts

- **Compile Contracts:**
  ```bash
  npx hardhat compile
  ```

- **Run Tests:**
  ```bash
  npx hardhat test
  ```

- **Local Deployment:**
  1. Start a local Hardhat node:
     ```bash
     npx hardhat node
     ```
  2. Deploy to the local network:
     ```bash
     npx hardhat run scripts/deploy.js --network localhost
     ```

- **Sepolia Deployment:**
  ```bash
  npx hardhat run scripts/deploy.js --network sepolia
  ```

### Frontend

1. **Configure Factory Address:**
   After deploying, copy the `TokenFactory` address and update the `FACTORY_ADDRESS` constant in `frontend/src/App.tsx`.

2. **Start Development Server:**
   ```bash
   cd frontend
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## Project Structure

```text
├── contracts/           # Solidity smart contracts
│   ├── AssetBase.sol    # Base compliance & upgradeable logic
│   ├── EquityToken.sol  # ERC-20 Equity implementation
│   ├── BondToken.sol    # ERC-20 Bond implementation
│   ├── ...              # Other asset types
│   └── TokenFactory.sol # Factory for deploying proxies
├── scripts/             # Deployment and interaction scripts
├── test/                # Comprehensive unit tests
├── frontend/            # React + Vite application
│   ├── src/             # Application source code
│   └── ...
└── hardhat.config.js    # Hardhat configuration
```

## Security Considerations

- **Whitelisting**: Transfers are restricted to whitelisted addresses by default.
- **Access Control**: Critical functions (minting, pausing, upgrading) are protected by roles (`DEFAULT_ADMIN_ROLE`, `ISSUER_ROLE`).
- **Oracles**: Derivatives rely on Chainlink for decentralized price feeds to prevent manipulation.

## License

Distributed under the MIT License. See `LICENSE` for more information.
