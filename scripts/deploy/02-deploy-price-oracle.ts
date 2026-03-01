import { ethers, upgrades } from "hardhat";

const STALENESS_THRESHOLD = 3600; // 1 hour in seconds

async function main() {
  console.log("=== Deploying PriceOracle (UUPS Proxy) ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  console.log(
    "Deploying PriceOracle with staleness threshold:",
    STALENESS_THRESHOLD,
    "seconds..."
  );
  const PriceOracle = await ethers.getContractFactory("PriceOracle");

  const priceOracle = await upgrades.deployProxy(
    PriceOracle,
    [deployer.address, STALENESS_THRESHOLD],
    { initializer: "initialize", kind: "uups" }
  );

  await priceOracle.waitForDeployment();

  const proxyAddress = await priceOracle.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );

  console.log("PriceOracle proxy deployed to:", proxyAddress);
  console.log("PriceOracle implementation at:", implAddress);
  console.log("\n=== PriceOracle Deployment Complete ===");

  return proxyAddress;
}

main()
  .then((address) => {
    console.log("\nDeployed PriceOracle at:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

export default main;
