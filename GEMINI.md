# tokenized-assets

A smart contract framework designed to tokenize traditional financial instruments—such as stocks, bonds, futures, and options—on the Ethereum blockchain.

## Project Overview

- **Core Goal**: Bridge the gap between traditional finance and DeFi by representing real-world assets as on-chain tokens with embedded business logic (dividends, coupons, maturity logic).
- **Primary Assets**: Equities, Bonds, and Derivatives (Futures & Options).
- **Target Network**: Ethereum Sepolia (testnet).

## Key Features

- **Asset-Specific Standards**: Custom implementations for different asset classes.
- **Automated Financial Logic**: Built-in handling for dividends, coupon payments, maturity redemption, and settlement.
- **Factory Pattern**: A centralized `TokenFactory` for streamlined deployment of new asset tokens.
- **Compliance & Control**: Transfer whitelisting, fractional ownership, and administrative functions for corporate actions (splits, mergers).
- **Oracle Integration**: Uses **Chainlink** for real-world price feeds, essential for settling derivatives.

## Tech Stack

- **Smart Contracts**: Solidity (0.8.x)
- **Frameworks**: Hardhat (development, testing, debugging), React (frontend)
- **Libraries**: ethers.js (blockchain interaction), Chai and Mocha (testing)
- **Services**: Chainlink (decentralized oracles)

## Architecture & Design

- **Token Standards**:
  - **ERC-20**: Used for **Equities** (fungible shares) and **Bonds** (fungible within an issuance).
  - **ERC-1155**: Used for **Futures & Options** to handle semi-fungible contracts (unique strikes/expiries).
- **Design Patterns**:
  - **Factory Pattern**: `TokenFactory` for creating and tracking asset token instances.
  - **Proxy Patterns**: Used for upgradeability.
- **Security**:
  - **Checks-Effects-Interactions**: To prevent reentrancy.
  - **Access Control**: Role-based permissions (Admin, Issuer, Trader).
  - **Emergency Measures**: Pausability.
  - **Oracle Security**: Time-Weighted Average Prices (TWAP) to prevent price manipulation.

## Development Workflow

### Building & Compiling
- **Environment**: Hardhat-based development environment.
- **Compile**: Use `npx hardhat compile` to compile the Solidity contracts.

### Running & Testing
- **Testing**: Comprehensive unit and integration tests using **Chai** and **Mocha**.
- **Command**: Run tests with `npx hardhat test`.

### Deployment
- **Target**: Configured for **Ethereum Sepolia**.
- **Strategy**: Deployment via Hardhat scripts to ensure consistent and reproducible contract states.

## Coding Conventions
- **Solidity Style**: Follow [OpenZeppelin](https://docs.openzeppelin.com/) patterns and standard Solidity style guidelines.
- **Security First**: Prioritize reentrancy protection and strict access control.
- **Environment Management**: Use `.env` files for private keys and API keys (never commit to version control).
