import pkg from "hardhat";
const { ethers, upgrades } = pkg;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy implementations
  console.log("Deploying EquityToken implementation...");
  const EquityToken = await ethers.getContractFactory("EquityToken");
  const equityImpl = await EquityToken.deploy();
  await equityImpl.waitForDeployment();
  const equityImplAddr = await equityImpl.getAddress();
  console.log("EquityToken implementation deployed to:", equityImplAddr);

  console.log("Deploying BondToken implementation...");
  const BondToken = await ethers.getContractFactory("BondToken");
  const bondImpl = await BondToken.deploy();
  await bondImpl.waitForDeployment();
  const bondImplAddr = await bondImpl.getAddress();
  console.log("BondToken implementation deployed to:", bondImplAddr);

  console.log("Deploying DerivativeToken implementation...");
  const DerivativeToken = await ethers.getContractFactory("DerivativeToken");
  const derivativeImpl = await DerivativeToken.deploy();
  await derivativeImpl.waitForDeployment();
  const derivativeImplAddr = await derivativeImpl.getAddress();
  console.log("DerivativeToken implementation deployed to:", derivativeImplAddr);

  console.log("Deploying LandToken implementation...");
  const LandToken = await ethers.getContractFactory("LandToken");
  const landImpl = await LandToken.deploy();
  await landImpl.waitForDeployment();
  const landImplAddr = await landImpl.getAddress();
  console.log("LandToken implementation deployed to:", landImplAddr);

  // Deploy Factory
  console.log("Deploying TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await TokenFactory.deploy(
    equityImplAddr,
    bondImplAddr,
    derivativeImplAddr,
    landImplAddr
  );
  await tokenFactory.waitForDeployment();
  console.log("TokenFactory deployed to:", await tokenFactory.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
