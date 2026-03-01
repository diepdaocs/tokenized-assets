import { ethers, upgrades } from "hardhat";

// AssetCategory enum values matching the Solidity enum order
const AssetCategory = {
  EQUITY: 0,
  BOND: 1,
  DERIVATIVE_FUTURE: 2,
  DERIVATIVE_OPTION: 3,
  LAND: 4,
  FRACTIONAL_LAND: 5,
} as const;

interface DeployTokenFactoryParams {
  complianceRegistryAddress: string;
  priceOracleAddress: string;
  equityTokenImpl: string;
  bondTokenImpl: string;
  futuresContractImpl: string;
  optionsContractImpl: string;
  landTokenImpl: string;
  fractionalLandTokenImpl: string;
}

async function main(params?: DeployTokenFactoryParams): Promise<string> {
  console.log("=== Deploying TokenFactory (UUPS Proxy) ===\n");

  if (!params) {
    console.error(
      "Error: This script requires addresses from previous deployments."
    );
    console.error("Please use full-deploy.ts to orchestrate all deployments,");
    console.error(
      "or provide the required addresses via the params argument."
    );
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  console.log("Using dependency addresses:");
  console.log("  ComplianceRegistry:", params.complianceRegistryAddress);
  console.log("  PriceOracle:       ", params.priceOracleAddress);

  // Deploy TokenFactory as UUPS proxy
  console.log("\nDeploying TokenFactory proxy...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");

  const tokenFactory = await upgrades.deployProxy(
    TokenFactory,
    [deployer.address, params.complianceRegistryAddress, params.priceOracleAddress],
    { initializer: "initialize", kind: "uups" }
  );

  await tokenFactory.waitForDeployment();

  const proxyAddress = await tokenFactory.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );

  console.log("TokenFactory proxy deployed to:", proxyAddress);
  console.log("TokenFactory implementation at:", implAddress);

  // Set implementation addresses for each asset category
  console.log("\nSetting implementation addresses...");

  const implementations: Array<{
    category: number;
    name: string;
    address: string;
  }> = [
    {
      category: AssetCategory.EQUITY,
      name: "EQUITY",
      address: params.equityTokenImpl,
    },
    {
      category: AssetCategory.BOND,
      name: "BOND",
      address: params.bondTokenImpl,
    },
    {
      category: AssetCategory.DERIVATIVE_FUTURE,
      name: "DERIVATIVE_FUTURE",
      address: params.futuresContractImpl,
    },
    {
      category: AssetCategory.DERIVATIVE_OPTION,
      name: "DERIVATIVE_OPTION",
      address: params.optionsContractImpl,
    },
    {
      category: AssetCategory.LAND,
      name: "LAND",
      address: params.landTokenImpl,
    },
    {
      category: AssetCategory.FRACTIONAL_LAND,
      name: "FRACTIONAL_LAND",
      address: params.fractionalLandTokenImpl,
    },
  ];

  for (const impl of implementations) {
    console.log(
      `  Setting ${impl.name} (category ${impl.category}) => ${impl.address}`
    );
    const tx = await tokenFactory.setImplementation(
      impl.category,
      impl.address
    );
    await tx.wait();
    console.log(`    Transaction confirmed.`);
  }

  console.log("\n=== TokenFactory Deployment Complete ===");
  console.log("TokenFactory proxy:", proxyAddress);

  return proxyAddress;
}

// When run directly, exit after completion
if (require.main === module) {
  main()
    .then((address) => {
      console.log("\nDeployed TokenFactory at:", address);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

export default main;
