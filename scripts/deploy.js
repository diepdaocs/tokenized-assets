import pkg from "hardhat";
import fs from "fs";
import path from "path";
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
  const factoryAddr = await tokenFactory.getAddress();
  console.log("TokenFactory deployed to:", factoryAddr);

  // Save the address to the frontend
  const addressesPath = path.join("frontend", "src", "contracts", "addresses.json");
  const addresses = {
    TokenFactory: factoryAddr,
  };
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`TokenFactory address saved to ${addressesPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
