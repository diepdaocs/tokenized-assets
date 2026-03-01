import { ethers, upgrades } from "hardhat";

export async function deployComplianceRegistry() {
  const [admin] = await ethers.getSigners();
  const ComplianceRegistry = await ethers.getContractFactory(
    "ComplianceRegistry"
  );
  const registry = await upgrades.deployProxy(ComplianceRegistry, [
    admin.address,
  ]);
  await registry.waitForDeployment();
  return { registry, admin };
}

export async function deployMockPriceFeed(
  price: bigint = 200000000000n,
  decimals: number = 8
) {
  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  const priceFeed = await MockPriceFeed.deploy(price, decimals);
  await priceFeed.waitForDeployment();
  return priceFeed;
}

export async function deployPriceOracle(stalenessThreshold: number = 3600) {
  const [admin] = await ethers.getSigners();
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await upgrades.deployProxy(PriceOracle, [
    admin.address,
    stalenessThreshold,
  ]);
  await oracle.waitForDeployment();
  return { oracle, admin };
}

export async function deployFullInfrastructure() {
  const [admin, issuer, investor1, investor2, investor3] =
    await ethers.getSigners();

  // Deploy ComplianceRegistry
  const ComplianceRegistry = await ethers.getContractFactory(
    "ComplianceRegistry"
  );
  const registry = await upgrades.deployProxy(ComplianceRegistry, [
    admin.address,
  ]);
  await registry.waitForDeployment();

  // Deploy MockPriceFeed
  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  const priceFeed = await MockPriceFeed.deploy(200000000000n, 8);
  await priceFeed.waitForDeployment();

  // Deploy PriceOracle
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await upgrades.deployProxy(PriceOracle, [
    admin.address,
    3600,
  ]);
  await oracle.waitForDeployment();

  // Set up price feed
  const assetId = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
  await oracle.setPriceFeed(assetId, await priceFeed.getAddress());

  // Whitelist investors
  await registry.whitelistInvestor(issuer.address);
  await registry.whitelistInvestor(investor1.address);
  await registry.whitelistInvestor(investor2.address);

  return {
    registry,
    oracle,
    priceFeed,
    admin,
    issuer,
    investor1,
    investor2,
    investor3,
    assetId,
  };
}
