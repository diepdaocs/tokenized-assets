import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy implementations
  const EquityToken = await hre.ethers.getContractFactory("EquityToken");
  const equityImpl = await EquityToken.deploy();
  await equityImpl.waitForDeployment();
  console.log("EquityToken implementation deployed to:", await equityImpl.getAddress());

  const BondToken = await hre.ethers.getContractFactory("BondToken");
  const bondImpl = await BondToken.deploy();
  await bondImpl.waitForDeployment();
  console.log("BondToken implementation deployed to:", await bondImpl.getAddress());

  const DerivativeToken = await hre.ethers.getContractFactory("DerivativeToken");
  const derivativeImpl = await DerivativeToken.deploy();
  await derivativeImpl.waitForDeployment();
  console.log("DerivativeToken implementation deployed to:", await derivativeImpl.getAddress());

  const RealEstateToken = await hre.ethers.getContractFactory("RealEstateToken");
  const realEstateImpl = await RealEstateToken.deploy();
  await realEstateImpl.waitForDeployment();
  console.log("RealEstateToken implementation deployed to:", await realEstateImpl.getAddress());

  // Deploy TokenFactory as a UUPS proxy
  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const tokenFactory = await hre.upgrades.deployProxy(TokenFactory, [
    await equityImpl.getAddress(),
    await bondImpl.getAddress(),
    await derivativeImpl.getAddress(),
    await realEstateImpl.getAddress(),
    deployer.address
  ], { kind: 'uups' });

  await tokenFactory.waitForDeployment();
  console.log("TokenFactory Proxy deployed to:", await tokenFactory.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
