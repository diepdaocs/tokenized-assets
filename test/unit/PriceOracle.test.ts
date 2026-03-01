import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES, STALENESS_THRESHOLD, MOCK_PRICE, MOCK_DECIMALS } from "../helpers/constants";

describe("PriceOracle", function () {
  async function deployOracleFixture() {
    const [admin, oracleAdmin, outsider] = await ethers.getSigners();

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracle = await upgrades.deployProxy(PriceOracle, [
      admin.address,
      STALENESS_THRESHOLD,
    ]);
    await oracle.waitForDeployment();

    // Grant oracle admin role
    await oracle.grantRole(ROLES.ORACLE_ADMIN, oracleAdmin.address);

    // Deploy MockPriceFeed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(MOCK_PRICE, MOCK_DECIMALS);
    await priceFeed.waitForDeployment();

    const assetId = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));

    return { oracle, priceFeed, admin, oracleAdmin, outsider, assetId };
  }

  describe("Initialization", function () {
    it("should initialize with the admin having DEFAULT_ADMIN_ROLE", async function () {
      const { oracle, admin } = await loadFixture(deployOracleFixture);
      expect(await oracle.hasRole(ROLES.DEFAULT_ADMIN, admin.address)).to.be.true;
    });

    it("should initialize with the admin having ORACLE_ADMIN_ROLE", async function () {
      const { oracle, admin } = await loadFixture(deployOracleFixture);
      expect(await oracle.hasRole(ROLES.ORACLE_ADMIN, admin.address)).to.be.true;
    });

    it("should initialize with the correct staleness threshold", async function () {
      const { oracle } = await loadFixture(deployOracleFixture);
      expect(await oracle.defaultStalenessThreshold()).to.equal(STALENESS_THRESHOLD);
    });
  });

  describe("setPriceFeed", function () {
    it("should set a price feed for an asset", async function () {
      const { oracle, priceFeed, oracleAdmin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(oracleAdmin).setPriceFeed(assetId, await priceFeed.getAddress());

      expect(await oracle.getPriceFeed(assetId)).to.equal(await priceFeed.getAddress());
    });

    it("should emit PriceFeedSet event", async function () {
      const { oracle, priceFeed, oracleAdmin, assetId } = await loadFixture(deployOracleFixture);

      await expect(oracle.connect(oracleAdmin).setPriceFeed(assetId, await priceFeed.getAddress()))
        .to.emit(oracle, "PriceFeedSet")
        .withArgs(assetId, await priceFeed.getAddress());
    });

    it("should revert with zero address", async function () {
      const { oracle, oracleAdmin, assetId } = await loadFixture(deployOracleFixture);

      await expect(
        oracle.connect(oracleAdmin).setPriceFeed(assetId, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(oracle, "InvalidParameter");
    });

    it("should revert without ORACLE_ADMIN_ROLE", async function () {
      const { oracle, priceFeed, outsider, assetId } = await loadFixture(deployOracleFixture);

      await expect(
        oracle.connect(outsider).setPriceFeed(assetId, await priceFeed.getAddress())
      ).to.be.reverted;
    });
  });

  describe("getLatestPrice", function () {
    it("should return the correct price from a Chainlink mock", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      const [price, decimals, updatedAt] = await oracle.getLatestPrice(assetId);
      expect(price).to.equal(MOCK_PRICE);
      expect(decimals).to.equal(MOCK_DECIMALS);
      expect(updatedAt).to.be.gt(0);
    });

    it("should revert if price feed is not configured", async function () {
      const { oracle } = await loadFixture(deployOracleFixture);

      const unknownAssetId = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN/USD"));

      await expect(oracle.getLatestPrice(unknownAssetId))
        .to.be.revertedWithCustomError(oracle, "InvalidParameter");
    });

    it("should revert if price is <= 0", async function () {
      const { oracle, admin, assetId } = await loadFixture(deployOracleFixture);

      // Deploy a mock with zero price
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const zeroPriceFeed = await MockPriceFeed.deploy(0n, 8);
      await zeroPriceFeed.waitForDeployment();

      await oracle.connect(admin).setPriceFeed(assetId, await zeroPriceFeed.getAddress());

      await expect(oracle.getLatestPrice(assetId))
        .to.be.revertedWithCustomError(oracle, "InvalidParameter");
    });

    it("should revert if price is negative", async function () {
      const { oracle, admin, assetId } = await loadFixture(deployOracleFixture);

      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const negPriceFeed = await MockPriceFeed.deploy(-100n, 8);
      await negPriceFeed.waitForDeployment();

      await oracle.connect(admin).setPriceFeed(assetId, await negPriceFeed.getAddress());

      await expect(oracle.getLatestPrice(assetId))
        .to.be.revertedWithCustomError(oracle, "InvalidParameter");
    });

    it("should revert if price is stale", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      // Set updatedAt to a timestamp far in the past to make it stale
      const block = await ethers.provider.getBlock("latest");
      const staleTimestamp = block!.timestamp - STALENESS_THRESHOLD - 100;
      await priceFeed.setUpdatedAt(staleTimestamp);

      await expect(oracle.getLatestPrice(assetId))
        .to.be.revertedWithCustomError(oracle, "InvalidParameter");
    });
  });

  describe("isPriceFeedStale", function () {
    it("should return true if the price feed is stale", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      // Set updatedAt to a stale timestamp
      const block = await ethers.provider.getBlock("latest");
      const staleTimestamp = block!.timestamp - 7200; // 2 hours ago
      await priceFeed.setUpdatedAt(staleTimestamp);

      expect(await oracle.isPriceFeedStale(assetId, 3600)).to.be.true;
    });

    it("should return false if the price feed is fresh", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      // Price feed was just deployed, so updatedAt is current
      expect(await oracle.isPriceFeedStale(assetId, 3600)).to.be.false;
    });

    it("should return true if no price feed is configured for the asset", async function () {
      const { oracle } = await loadFixture(deployOracleFixture);

      const unknownAssetId = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN/USD"));
      expect(await oracle.isPriceFeedStale(unknownAssetId, 3600)).to.be.true;
    });
  });

  describe("removePriceFeed", function () {
    it("should remove the price feed", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());
      expect(await oracle.getPriceFeed(assetId)).to.equal(await priceFeed.getAddress());

      await oracle.connect(admin).removePriceFeed(assetId);
      expect(await oracle.getPriceFeed(assetId)).to.equal(ethers.ZeroAddress);
    });

    it("should emit PriceFeedRemoved event", async function () {
      const { oracle, priceFeed, admin, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      await expect(oracle.connect(admin).removePriceFeed(assetId))
        .to.emit(oracle, "PriceFeedRemoved")
        .withArgs(assetId);
    });

    it("should revert without ORACLE_ADMIN_ROLE", async function () {
      const { oracle, priceFeed, admin, outsider, assetId } = await loadFixture(deployOracleFixture);

      await oracle.connect(admin).setPriceFeed(assetId, await priceFeed.getAddress());

      await expect(
        oracle.connect(outsider).removePriceFeed(assetId)
      ).to.be.reverted;
    });
  });
});
