import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { getBlockTimestamp } from "../helpers/time";
import { ROLES, ONE_MONTH, MOCK_PRICE, MOCK_DECIMALS } from "../helpers/constants";

describe("TokenFactory", function () {
  async function deployTokenFactoryFixture() {
    const [admin, deployer, other] = await ethers.getSigners();

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
    const priceFeed = await MockPriceFeed.deploy(MOCK_PRICE, MOCK_DECIMALS);
    await priceFeed.waitForDeployment();

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracle = await upgrades.deployProxy(PriceOracle, [
      admin.address,
      3600,
    ]);
    await oracle.waitForDeployment();

    // Set up price feed
    const priceId = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
    await oracle.setPriceFeed(priceId, await priceFeed.getAddress());

    // Whitelist deployer
    await registry.whitelistInvestor(deployer.address);

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    const factory = await upgrades.deployProxy(TokenFactory, [
      admin.address,
      await registry.getAddress(),
      await oracle.getAddress(),
    ]);
    await factory.waitForDeployment();

    // Grant DEPLOYER_ROLE to deployer
    const DEPLOYER_ROLE = ROLES.DEPLOYER;
    await factory.connect(admin).grantRole(DEPLOYER_ROLE, deployer.address);

    // Deploy implementations (not proxied)
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const equityImpl = await EquityToken.deploy();
    await equityImpl.waitForDeployment();

    const BondToken = await ethers.getContractFactory("BondToken");
    const bondImpl = await BondToken.deploy();
    await bondImpl.waitForDeployment();

    const FuturesContract = await ethers.getContractFactory("FuturesContract");
    const futuresImpl = await FuturesContract.deploy();
    await futuresImpl.waitForDeployment();

    const OptionsContract = await ethers.getContractFactory("OptionsContract");
    const optionsImpl = await OptionsContract.deploy();
    await optionsImpl.waitForDeployment();

    const LandToken = await ethers.getContractFactory("LandToken");
    const landImpl = await LandToken.deploy();
    await landImpl.waitForDeployment();

    const FractionalLandToken = await ethers.getContractFactory(
      "FractionalLandToken"
    );
    const fractionalImpl = await FractionalLandToken.deploy();
    await fractionalImpl.waitForDeployment();

    // Set implementations: 0=EQUITY, 1=BOND, 2=DERIVATIVE_FUTURE, 3=DERIVATIVE_OPTION, 4=LAND, 5=FRACTIONAL_LAND
    await factory
      .connect(admin)
      .setImplementation(0, await equityImpl.getAddress());
    await factory
      .connect(admin)
      .setImplementation(1, await bondImpl.getAddress());
    await factory
      .connect(admin)
      .setImplementation(2, await futuresImpl.getAddress());
    await factory
      .connect(admin)
      .setImplementation(3, await optionsImpl.getAddress());
    await factory
      .connect(admin)
      .setImplementation(4, await landImpl.getAddress());
    await factory
      .connect(admin)
      .setImplementation(5, await fractionalImpl.getAddress());

    return {
      factory,
      registry,
      oracle,
      priceFeed,
      admin,
      deployer,
      other,
      priceId,
      DEPLOYER_ROLE,
    };
  }

  describe("deployEquity", function () {
    it("should deploy equity proxy, register asset, and emit event", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      const tx = await factory
        .connect(deployer)
        .deployEquity("Test Equity", "TEQT", "US1234567890", 1000000n);

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("Test Equity");
      expect(assets[0].symbol).to.equal("TEQT");
      expect(assets[0].category).to.equal(0n); // EQUITY
      expect(assets[0].issuer).to.equal(deployer.address);
      expect(assets[0].active).to.be.true;
    });
  });

  describe("deployBond", function () {
    it("should deploy bond proxy", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      const timestamp = await getBlockTimestamp();
      const bondTerms = {
        faceValue: ethers.parseEther("1000"),
        couponRateBps: 500n,
        couponInterval: BigInt(ONE_MONTH),
        maturityDate: BigInt(timestamp + ONE_MONTH * 12),
        issueDate: 0n,
      };

      const tx = await factory
        .connect(deployer)
        .deployBond("Test Bond", "TBND", bondTerms);

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("Test Bond");
      expect(assets[0].category).to.equal(1n); // BOND
    });
  });

  describe("deployFutures", function () {
    it("should deploy futures proxy", async function () {
      const { factory, deployer, priceId } = await loadFixture(
        deployTokenFactoryFixture
      );

      const timestamp = await getBlockTimestamp();
      const futuresTerms = {
        underlyingAsset: ethers.ZeroAddress,
        contractSize: 1n,
        settlementDate: BigInt(timestamp + ONE_MONTH),
        maintenanceMarginBps: 500n,
        initialMarginBps: 1000n,
        priceId: priceId,
      };

      const tx = await factory
        .connect(deployer)
        .deployFutures("ETH Futures", "ETHF", futuresTerms);

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("ETH Futures");
      expect(assets[0].category).to.equal(2n); // DERIVATIVE_FUTURE
    });
  });

  describe("deployOptions", function () {
    it("should deploy options proxy", async function () {
      const { factory, deployer, priceId } = await loadFixture(
        deployTokenFactoryFixture
      );

      const timestamp = await getBlockTimestamp();
      const optionsTerms = {
        underlyingAsset: ethers.ZeroAddress,
        strikePrice: 200000000000n,
        expirationDate: BigInt(timestamp + ONE_MONTH),
        contractSize: 1n,
        optionType: 0,
        premiumPerContract: ethers.parseEther("0.1"),
        priceId: priceId,
      };

      const tx = await factory
        .connect(deployer)
        .deployOptions("ETH Call", "ETHC", optionsTerms);

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("ETH Call");
      expect(assets[0].category).to.equal(3n); // DERIVATIVE_OPTION
    });
  });

  describe("deployLandToken", function () {
    it("should deploy land proxy", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      const tx = await factory
        .connect(deployer)
        .deployLandToken("Land Registry", "LAND");

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("Land Registry");
      expect(assets[0].category).to.equal(4n); // LAND
    });
  });

  describe("deployFractionalLand", function () {
    it("should deploy fractional land proxy", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      const tx = await factory
        .connect(deployer)
        .deployFractionalLand("https://metadata.example.com/{id}");

      await expect(tx).to.emit(factory, "AssetDeployed");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      expect(assets[0].name).to.equal("FractionalLand");
      expect(assets[0].symbol).to.equal("FLAND");
      expect(assets[0].category).to.equal(5n); // FRACTIONAL_LAND
    });
  });

  describe("getDeployedAssets", function () {
    it("should return all deployed assets", async function () {
      const { factory, deployer, priceId } = await loadFixture(
        deployTokenFactoryFixture
      );

      // Deploy multiple assets
      await factory
        .connect(deployer)
        .deployEquity("Equity 1", "EQ1", "CUSIP1", 1000n);
      await factory
        .connect(deployer)
        .deployLandToken("Land 1", "LAND1");

      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(2);
      expect(assets[0].name).to.equal("Equity 1");
      expect(assets[1].name).to.equal("Land 1");
    });
  });

  describe("getAssetsByCategory", function () {
    it("should return assets filtered by category", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      // Deploy two equities and one land
      await factory
        .connect(deployer)
        .deployEquity("Equity 1", "EQ1", "CUSIP1", 1000n);
      await factory
        .connect(deployer)
        .deployEquity("Equity 2", "EQ2", "CUSIP2", 2000n);
      await factory
        .connect(deployer)
        .deployLandToken("Land 1", "LAND1");

      const equities = await factory.getAssetsByCategory(0); // EQUITY
      expect(equities.length).to.equal(2);

      const lands = await factory.getAssetsByCategory(4); // LAND
      expect(lands.length).to.equal(1);

      const bonds = await factory.getAssetsByCategory(1); // BOND
      expect(bonds.length).to.equal(0);
    });
  });

  describe("isDeployedAsset", function () {
    it("should return true for deployed asset", async function () {
      const { factory, deployer } = await loadFixture(
        deployTokenFactoryFixture
      );

      await factory
        .connect(deployer)
        .deployEquity("Test Equity", "TEQT", "CUSIP1", 1000n);

      const assets = await factory.getDeployedAssets();
      const tokenAddress = assets[0].tokenAddress;

      expect(await factory.isDeployedAsset(tokenAddress)).to.be.true;
    });

    it("should return false for random address", async function () {
      const { factory } = await loadFixture(deployTokenFactoryFixture);

      const randomAddress = ethers.Wallet.createRandom().address;
      expect(await factory.isDeployedAsset(randomAddress)).to.be.false;
    });
  });

  describe("DEPLOYER_ROLE", function () {
    it("should revert if caller lacks DEPLOYER_ROLE", async function () {
      const { factory, other } = await loadFixture(deployTokenFactoryFixture);

      await expect(
        factory
          .connect(other)
          .deployEquity("Test", "TST", "CUSIP1", 1000n)
      ).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
    });

    it("should revert deployBond if caller lacks DEPLOYER_ROLE", async function () {
      const { factory, other } = await loadFixture(deployTokenFactoryFixture);

      const timestamp = await getBlockTimestamp();
      const bondTerms = {
        faceValue: ethers.parseEther("1000"),
        couponRateBps: 500n,
        couponInterval: BigInt(ONE_MONTH),
        maturityDate: BigInt(timestamp + ONE_MONTH * 12),
        issueDate: 0n,
      };

      await expect(
        factory.connect(other).deployBond("Test Bond", "TBND", bondTerms)
      ).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
    });

    it("should revert deployLandToken if caller lacks DEPLOYER_ROLE", async function () {
      const { factory, other } = await loadFixture(deployTokenFactoryFixture);

      await expect(
        factory.connect(other).deployLandToken("Land", "LAND")
      ).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
    });
  });
});
