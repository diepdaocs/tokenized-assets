import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("Tokenized Assets Framework", function () {
  let TokenFactory, tokenFactory;
  let EquityToken, equityImplementation;
  let BondToken, bondImplementation;
  let DerivativeToken, derivativeImplementation;
  let LandToken, landImplementation;
  let admin, issuer, user;

  beforeEach(async function () {
    [admin, issuer, user] = await ethers.getSigners();

    // Deploy implementations
    EquityToken = await ethers.getContractFactory("EquityToken");
    equityImplementation = await EquityToken.deploy();

    BondToken = await ethers.getContractFactory("BondToken");
    bondImplementation = await BondToken.deploy();

    DerivativeToken = await ethers.getContractFactory("DerivativeToken");
    derivativeImplementation = await DerivativeToken.deploy();

    LandToken = await ethers.getContractFactory("LandToken");
    landImplementation = await LandToken.deploy();

    // Deploy Factory
    TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = await TokenFactory.deploy(
      await equityImplementation.getAddress(),
      await bondImplementation.getAddress(),
      await derivativeImplementation.getAddress(),
      await landImplementation.getAddress()
    );
  });

  describe("Equity Token", function () {
    it("Should deploy and initialize correctly", async function () {
      const tx = await tokenFactory.connect(issuer).deployEquity("Apple Inc", "AAPL", 1000000n);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try { return tokenFactory.interface.parseLog(log).name === "AssetDeployed"; } catch (e) { return false; }
      });
      const assetAddress = tokenFactory.interface.parseLog(event).args.proxy;
      const equityProxy = await ethers.getContractAt("EquityToken", assetAddress);

      expect(await equityProxy.name()).to.equal("Apple Inc");
      expect(await equityProxy.balanceOf(issuer.address)).to.equal(1000000n);
    });

    it("Should respect whitelisting", async function () {
      const tx = await tokenFactory.connect(issuer).deployEquity("Apple Inc", "AAPL", 1000000n);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try { return tokenFactory.interface.parseLog(log).name === "AssetDeployed"; } catch (e) { return false; }
      });
      const assetAddress = tokenFactory.interface.parseLog(event).args.proxy;
      const equityProxy = await ethers.getContractAt("EquityToken", assetAddress);

      await expect(equityProxy.connect(issuer).transfer(user.address, 100n))
        .to.be.revertedWith("EquityToken: sender not whitelisted");

      await equityProxy.connect(issuer).setWhitelisted(issuer.address, true);
      await equityProxy.connect(issuer).setWhitelisted(user.address, true);
      await equityProxy.connect(issuer).transfer(user.address, 100n);
      expect(await equityProxy.balanceOf(user.address)).to.equal(100n);
    });
  });

  describe("Bond Token", function () {
    it("Should deploy and initialize correctly", async function () {
      const maturity = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year
      const tx = await tokenFactory.connect(issuer).deployBond("US Treasury", "UST", 1000n, 500n, maturity, 86400 * 180);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try { return tokenFactory.interface.parseLog(log).name === "AssetDeployed"; } catch (e) { return false; }
      });
      const assetAddress = tokenFactory.interface.parseLog(event).args.proxy;
      const bondProxy = await ethers.getContractAt("BondToken", assetAddress);

      expect(await bondProxy.name()).to.equal("US Treasury");
      expect(await bondProxy.couponRate()).to.equal(500n);
      expect(await bondProxy.balanceOf(issuer.address)).to.equal(1000n);
    });
  });

  describe("Derivative Token", function () {
    it("Should deploy and initialize correctly", async function () {
      const tx = await tokenFactory.connect(issuer).deployDerivative("ipfs://derivative-metadata");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try { return tokenFactory.interface.parseLog(log).name === "AssetDeployed"; } catch (e) { return false; }
      });
      const assetAddress = tokenFactory.interface.parseLog(event).args.proxy;
      const derivativeProxy = await ethers.getContractAt("DerivativeToken", assetAddress);

      expect(await derivativeProxy.uri(0)).to.equal("ipfs://derivative-metadata");
      
      await derivativeProxy.connect(issuer).createDerivative("BTC Future", ethers.ZeroAddress, 50000n, 0n, ethers.ZeroAddress);
      expect(await derivativeProxy.nextId()).to.equal(1n);
    });
  });

  describe("Land Token", function () {
    it("Should deploy and initialize correctly", async function () {
      const tx = await tokenFactory.connect(issuer).deployLand("ipfs://land-metadata");
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try { return tokenFactory.interface.parseLog(log).name === "AssetDeployed"; } catch (e) { return false; }
      });
      const assetAddress = tokenFactory.interface.parseLog(event).args.proxy;
      const landProxy = await ethers.getContractAt("LandToken", assetAddress);

      await landProxy.connect(issuer).registerLand("Paris, France", 100n, 1000000n, 1000n, issuer.address);
      const land = await landProxy.lands(0);
      expect(land.location).to.equal("Paris, France");
      expect(await landProxy.balanceOf(issuer.address, 0n)).to.equal(1000n);
    });
  });
});
