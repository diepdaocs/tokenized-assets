import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("=== Deploying ComplianceRegistry (UUPS Proxy) ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  console.log("Deploying ComplianceRegistry...");
  const ComplianceRegistry = await ethers.getContractFactory(
    "ComplianceRegistry"
  );

  const complianceRegistry = await upgrades.deployProxy(
    ComplianceRegistry,
    [deployer.address],
    { initializer: "initialize", kind: "uups" }
  );

  await complianceRegistry.waitForDeployment();

  const proxyAddress = await complianceRegistry.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );

  console.log("ComplianceRegistry proxy deployed to:", proxyAddress);
  console.log("ComplianceRegistry implementation at:", implAddress);
  console.log("\n=== ComplianceRegistry Deployment Complete ===");

  return proxyAddress;
}

main()
  .then((address) => {
    console.log("\nDeployed ComplianceRegistry at:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

export default main;
