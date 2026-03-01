import { ethers } from "hardhat";

interface ImplementationAddresses {
  equityToken: string;
  bondToken: string;
  futuresContract: string;
  optionsContract: string;
  landToken: string;
  fractionalLandToken: string;
}

async function main(): Promise<ImplementationAddresses> {
  console.log("=== Deploying Implementation Contracts (Non-Proxied) ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // Deploy EquityToken implementation
  console.log("Deploying EquityToken implementation...");
  const EquityToken = await ethers.getContractFactory("EquityToken");
  const equityToken = await EquityToken.deploy();
  await equityToken.waitForDeployment();
  const equityTokenAddress = await equityToken.getAddress();
  console.log("  EquityToken implementation deployed to:", equityTokenAddress);

  // Deploy BondToken implementation
  console.log("Deploying BondToken implementation...");
  const BondToken = await ethers.getContractFactory("BondToken");
  const bondToken = await BondToken.deploy();
  await bondToken.waitForDeployment();
  const bondTokenAddress = await bondToken.getAddress();
  console.log("  BondToken implementation deployed to:", bondTokenAddress);

  // Deploy FuturesContract implementation
  console.log("Deploying FuturesContract implementation...");
  const FuturesContract = await ethers.getContractFactory("FuturesContract");
  const futuresContract = await FuturesContract.deploy();
  await futuresContract.waitForDeployment();
  const futuresContractAddress = await futuresContract.getAddress();
  console.log(
    "  FuturesContract implementation deployed to:",
    futuresContractAddress
  );

  // Deploy OptionsContract implementation
  console.log("Deploying OptionsContract implementation...");
  const OptionsContract = await ethers.getContractFactory("OptionsContract");
  const optionsContract = await OptionsContract.deploy();
  await optionsContract.waitForDeployment();
  const optionsContractAddress = await optionsContract.getAddress();
  console.log(
    "  OptionsContract implementation deployed to:",
    optionsContractAddress
  );

  // Deploy LandToken implementation
  console.log("Deploying LandToken implementation...");
  const LandToken = await ethers.getContractFactory("LandToken");
  const landToken = await LandToken.deploy();
  await landToken.waitForDeployment();
  const landTokenAddress = await landToken.getAddress();
  console.log("  LandToken implementation deployed to:", landTokenAddress);

  // Deploy FractionalLandToken implementation
  console.log("Deploying FractionalLandToken implementation...");
  const FractionalLandToken =
    await ethers.getContractFactory("FractionalLandToken");
  const fractionalLandToken = await FractionalLandToken.deploy();
  await fractionalLandToken.waitForDeployment();
  const fractionalLandTokenAddress = await fractionalLandToken.getAddress();
  console.log(
    "  FractionalLandToken implementation deployed to:",
    fractionalLandTokenAddress
  );

  const addresses: ImplementationAddresses = {
    equityToken: equityTokenAddress,
    bondToken: bondTokenAddress,
    futuresContract: futuresContractAddress,
    optionsContract: optionsContractAddress,
    landToken: landTokenAddress,
    fractionalLandToken: fractionalLandTokenAddress,
  };

  console.log("\n=== Implementation Deployments Complete ===");
  console.log("\nSummary:");
  console.log("  EquityToken:        ", addresses.equityToken);
  console.log("  BondToken:          ", addresses.bondToken);
  console.log("  FuturesContract:    ", addresses.futuresContract);
  console.log("  OptionsContract:    ", addresses.optionsContract);
  console.log("  LandToken:          ", addresses.landToken);
  console.log("  FractionalLandToken:", addresses.fractionalLandToken);

  return addresses;
}

main()
  .then((addresses) => {
    console.log("\nAll implementations deployed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

export default main;
