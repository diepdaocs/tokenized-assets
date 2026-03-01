import { ethers, upgrades } from "hardhat";

// Configuration: set these values before running the script,
// or pass them via environment variables.
//
// Usage:
//   PROXY_ADDRESS=0x... CONTRACT_NAME=ComplianceRegistry \
//     npx hardhat run scripts/upgrade/upgrade-contract.ts --network sepolia

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const contractName = process.env.CONTRACT_NAME;

  if (!proxyAddress || !contractName) {
    console.error("Usage:");
    console.error(
      "  PROXY_ADDRESS=0x... CONTRACT_NAME=<ContractName> npx hardhat run scripts/upgrade/upgrade-contract.ts --network <network>"
    );
    console.error("");
    console.error("Supported contract names:");
    console.error("  - ComplianceRegistry");
    console.error("  - PriceOracle");
    console.error("  - TokenFactory");
    console.error("  - EquityToken");
    console.error("  - BondToken");
    console.error("  - FuturesContract");
    console.error("  - OptionsContract");
    console.error("  - LandToken");
    console.error("  - FractionalLandToken");
    process.exit(1);
  }

  console.log("=== Upgrading Contract ===\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network:       ", network.name);
  console.log("Chain ID:      ", network.chainId.toString());
  console.log("Deployer:      ", deployer.address);
  console.log("Contract:      ", contractName);
  console.log("Proxy address: ", proxyAddress);

  // Verify the proxy has code deployed
  const existingCode = await ethers.provider.getCode(proxyAddress);
  if (existingCode === "0x") {
    console.error(
      "\nError: No contract found at the provided proxy address."
    );
    process.exit(1);
  }

  // Get current implementation address before upgrade
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log("\nCurrent implementation:", currentImpl);

  // Deploy new implementation and upgrade the proxy
  console.log(`\nDeploying new ${contractName} implementation...`);
  const NewImplementation = await ethers.getContractFactory(contractName);

  const upgraded = await upgrades.upgradeProxy(proxyAddress, NewImplementation, {
    kind: "uups",
  });
  await upgraded.waitForDeployment();

  // Get new implementation address after upgrade
  const newImpl = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );

  console.log("New implementation:    ", newImpl);

  if (currentImpl === newImpl) {
    console.log(
      "\nWarning: Implementation address did not change. The contract may already be up to date."
    );
  } else {
    console.log("\nUpgrade successful!");
  }

  console.log("\n=== Upgrade Complete ===");
  console.log("Proxy address:            ", proxyAddress);
  console.log("Previous implementation:  ", currentImpl);
  console.log("New implementation:       ", newImpl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nUpgrade failed:", error);
    process.exit(1);
  });
