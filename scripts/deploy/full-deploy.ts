import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// AssetCategory enum values matching the Solidity enum order
const AssetCategory = {
  EQUITY: 0,
  BOND: 1,
  DERIVATIVE_FUTURE: 2,
  DERIVATIVE_OPTION: 3,
  LAND: 4,
  FRACTIONAL_LAND: 5,
} as const;

const STALENESS_THRESHOLD = 3600; // 1 hour in seconds

interface DeploymentAddresses {
  network: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
  contracts: {
    complianceRegistry: string;
    priceOracle: string;
    tokenFactory: string;
    implementations: {
      equityToken: string;
      bondToken: string;
      futuresContract: string;
      optionsContract: string;
      landToken: string;
      fractionalLandToken: string;
    };
  };
}

function getDeploymentsDir(): string {
  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  return deploymentsDir;
}

function loadExistingDeployment(network: string): DeploymentAddresses | null {
  const filePath = path.join(getDeploymentsDir(), `${network}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as DeploymentAddresses;
    } catch (error) {
      console.log(
        "Warning: Could not parse existing deployment file, deploying fresh."
      );
      return null;
    }
  }
  return null;
}

function saveDeployment(
  network: string,
  deployment: DeploymentAddresses
): void {
  const filePath = path.join(getDeploymentsDir(), `${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment addresses saved to: ${filePath}`);
}

async function isContractDeployed(address: string): Promise<boolean> {
  if (!address || address === ethers.ZeroAddress) return false;
  try {
    const code = await ethers.provider.getCode(address);
    return code !== "0x";
  } catch {
    return false;
  }
}

async function main() {
  console.log("==========================================================");
  console.log("       Tokenized Assets - Full Deployment Pipeline        ");
  console.log("==========================================================\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName =
    network.chainId === 31337n ? "localhost" : network.name;

  console.log("Network:         ", networkName);
  console.log("Chain ID:        ", network.chainId.toString());
  console.log("Deployer:        ", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // Check for existing deployment
  const existing = loadExistingDeployment(networkName);
  if (existing) {
    console.log("Found existing deployment file for", networkName);
    console.log("Will reuse any already-deployed contracts.\n");
  }

  // ---------------------------------------------------------------
  // Step 1: Deploy ComplianceRegistry
  // ---------------------------------------------------------------
  let complianceRegistryAddress: string;

  if (
    existing?.contracts.complianceRegistry &&
    (await isContractDeployed(existing.contracts.complianceRegistry))
  ) {
    complianceRegistryAddress = existing.contracts.complianceRegistry;
    console.log(
      "[Step 1/4] ComplianceRegistry already deployed at:",
      complianceRegistryAddress
    );
  } else {
    console.log("[Step 1/4] Deploying ComplianceRegistry (UUPS Proxy)...");
    const ComplianceRegistry = await ethers.getContractFactory(
      "ComplianceRegistry"
    );

    const complianceRegistry = await upgrades.deployProxy(
      ComplianceRegistry,
      [deployer.address],
      { initializer: "initialize", kind: "uups" }
    );
    await complianceRegistry.waitForDeployment();
    complianceRegistryAddress = await complianceRegistry.getAddress();

    const implAddr = await upgrades.erc1967.getImplementationAddress(
      complianceRegistryAddress
    );
    console.log("  Proxy:         ", complianceRegistryAddress);
    console.log("  Implementation:", implAddr);
  }
  console.log("");

  // ---------------------------------------------------------------
  // Step 2: Deploy PriceOracle
  // ---------------------------------------------------------------
  let priceOracleAddress: string;

  if (
    existing?.contracts.priceOracle &&
    (await isContractDeployed(existing.contracts.priceOracle))
  ) {
    priceOracleAddress = existing.contracts.priceOracle;
    console.log(
      "[Step 2/4] PriceOracle already deployed at:",
      priceOracleAddress
    );
  } else {
    console.log("[Step 2/4] Deploying PriceOracle (UUPS Proxy)...");
    console.log("  Staleness threshold:", STALENESS_THRESHOLD, "seconds");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");

    const priceOracle = await upgrades.deployProxy(
      PriceOracle,
      [deployer.address, STALENESS_THRESHOLD],
      { initializer: "initialize", kind: "uups" }
    );
    await priceOracle.waitForDeployment();
    priceOracleAddress = await priceOracle.getAddress();

    const implAddr = await upgrades.erc1967.getImplementationAddress(
      priceOracleAddress
    );
    console.log("  Proxy:         ", priceOracleAddress);
    console.log("  Implementation:", implAddr);
  }
  console.log("");

  // ---------------------------------------------------------------
  // Step 3: Deploy Implementation Contracts
  // ---------------------------------------------------------------
  console.log("[Step 3/4] Deploying Implementation Contracts...");

  const implContracts = [
    { name: "EquityToken", key: "equityToken" },
    { name: "BondToken", key: "bondToken" },
    { name: "FuturesContract", key: "futuresContract" },
    { name: "OptionsContract", key: "optionsContract" },
    { name: "LandToken", key: "landToken" },
    { name: "FractionalLandToken", key: "fractionalLandToken" },
  ] as const;

  const implementations: Record<string, string> = {};

  for (const impl of implContracts) {
    const existingAddr =
      existing?.contracts.implementations[
        impl.key as keyof typeof existing.contracts.implementations
      ];

    if (existingAddr && (await isContractDeployed(existingAddr))) {
      implementations[impl.key] = existingAddr;
      console.log(`  ${impl.name} already deployed at: ${existingAddr}`);
    } else {
      console.log(`  Deploying ${impl.name}...`);
      const Factory = await ethers.getContractFactory(impl.name);
      const contract = await Factory.deploy();
      await contract.waitForDeployment();
      implementations[impl.key] = await contract.getAddress();
      console.log(`    Deployed to: ${implementations[impl.key]}`);
    }
  }
  console.log("");

  // ---------------------------------------------------------------
  // Step 4: Deploy TokenFactory
  // ---------------------------------------------------------------
  let tokenFactoryAddress: string;

  if (
    existing?.contracts.tokenFactory &&
    (await isContractDeployed(existing.contracts.tokenFactory))
  ) {
    tokenFactoryAddress = existing.contracts.tokenFactory;
    console.log(
      "[Step 4/4] TokenFactory already deployed at:",
      tokenFactoryAddress
    );
  } else {
    console.log("[Step 4/4] Deploying TokenFactory (UUPS Proxy)...");
    const TokenFactory = await ethers.getContractFactory("TokenFactory");

    const tokenFactory = await upgrades.deployProxy(
      TokenFactory,
      [deployer.address, complianceRegistryAddress, priceOracleAddress],
      { initializer: "initialize", kind: "uups" }
    );
    await tokenFactory.waitForDeployment();
    tokenFactoryAddress = await tokenFactory.getAddress();

    const implAddr = await upgrades.erc1967.getImplementationAddress(
      tokenFactoryAddress
    );
    console.log("  Proxy:         ", tokenFactoryAddress);
    console.log("  Implementation:", implAddr);

    // Set implementation addresses for each asset category
    console.log("\n  Setting implementation addresses on TokenFactory...");

    const categoryMapping: Array<{
      category: number;
      name: string;
      key: string;
    }> = [
      { category: AssetCategory.EQUITY, name: "EQUITY", key: "equityToken" },
      { category: AssetCategory.BOND, name: "BOND", key: "bondToken" },
      {
        category: AssetCategory.DERIVATIVE_FUTURE,
        name: "DERIVATIVE_FUTURE",
        key: "futuresContract",
      },
      {
        category: AssetCategory.DERIVATIVE_OPTION,
        name: "DERIVATIVE_OPTION",
        key: "optionsContract",
      },
      { category: AssetCategory.LAND, name: "LAND", key: "landToken" },
      {
        category: AssetCategory.FRACTIONAL_LAND,
        name: "FRACTIONAL_LAND",
        key: "fractionalLandToken",
      },
    ];

    for (const mapping of categoryMapping) {
      const implAddress = implementations[mapping.key];
      console.log(
        `    ${mapping.name} (${mapping.category}) => ${implAddress}`
      );
      const tx = await tokenFactory.setImplementation(
        mapping.category,
        implAddress
      );
      await tx.wait();
    }
    console.log("  All implementations set.");
  }
  console.log("");

  // ---------------------------------------------------------------
  // Build and save deployment summary
  // ---------------------------------------------------------------
  const deployment: DeploymentAddresses = {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      complianceRegistry: complianceRegistryAddress,
      priceOracle: priceOracleAddress,
      tokenFactory: tokenFactoryAddress,
      implementations: {
        equityToken: implementations.equityToken,
        bondToken: implementations.bondToken,
        futuresContract: implementations.futuresContract,
        optionsContract: implementations.optionsContract,
        landToken: implementations.landToken,
        fractionalLandToken: implementations.fractionalLandToken,
      },
    },
  };

  saveDeployment(networkName, deployment);

  // Print final summary
  console.log("\n==========================================================");
  console.log("                  Deployment Summary                       ");
  console.log("==========================================================");
  console.log(JSON.stringify(deployment, null, 2));
  console.log("==========================================================");
  console.log("              Deployment Complete                          ");
  console.log("==========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment pipeline failed:", error);
    process.exit(1);
  });
