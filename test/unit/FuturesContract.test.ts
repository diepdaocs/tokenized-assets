import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { increaseTime, getBlockTimestamp } from "../helpers/time";
import { ONE_MONTH, MOCK_PRICE, MOCK_DECIMALS } from "../helpers/constants";

describe("FuturesContract", function () {
  async function deployFuturesFixture() {
    const [admin, issuer, investor1, investor2, investor3, liquidator] =
      await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry = await ethers.getContractFactory(
      "ComplianceRegistry"
    );
    const registry = await upgrades.deployProxy(ComplianceRegistry, [
      admin.address,
    ]);
    await registry.waitForDeployment();

    // Deploy MockPriceFeed ($2000 with 8 decimals)
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

    // Whitelist investors
    await registry.whitelistInvestor(issuer.address);
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);
    await registry.whitelistInvestor(liquidator.address);

    // Deploy FuturesContract
    const timestamp = await getBlockTimestamp();
    const futuresTerms = {
      underlyingAsset: ethers.ZeroAddress,
      contractSize: 1n,
      settlementDate: BigInt(timestamp + 86400 * 30),
      maintenanceMarginBps: 500n, // 5%
      initialMarginBps: 1000n, // 10%
      priceId: priceId,
    };

    const FuturesContract = await ethers.getContractFactory("FuturesContract");
    const futures = await upgrades.deployProxy(FuturesContract, [
      "ETH Futures",
      "ETHF",
      await registry.getAddress(),
      await oracle.getAddress(),
      issuer.address,
      futuresTerms,
    ]);
    await futures.waitForDeployment();

    return {
      futures,
      registry,
      oracle,
      priceFeed,
      admin,
      issuer,
      investor1,
      investor2,
      investor3,
      liquidator,
      priceId,
      futuresTerms,
    };
  }

  describe("openPosition", function () {
    it("should open a long position with sufficient margin", async function () {
      const { futures, investor1, priceId } = await loadFixture(
        deployFuturesFixture
      );

      // Price = $2000 (200000000000 with 8 decimals)
      // 1 contract, contractSize=1, notional = 200000000000 * 1 * 1 = 200000000000
      // Initial margin = 10% = 20000000000
      const margin = 20000000000n;

      const tx = await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      await expect(tx).to.emit(futures, "PositionOpened");

      const position = await futures.positions(1);
      expect(position.holder).to.equal(investor1.address);
      expect(position.isLong).to.be.true;
      expect(position.size).to.equal(1n);
      expect(position.margin).to.equal(margin);
      expect(position.active).to.be.true;
    });

    it("should open a short position with sufficient margin", async function () {
      const { futures, investor1 } = await loadFixture(deployFuturesFixture);

      const margin = 20000000000n;

      const tx = await futures
        .connect(investor1)
        .openPosition(false, 1, { value: margin });

      await expect(tx).to.emit(futures, "PositionOpened");

      const position = await futures.positions(1);
      expect(position.holder).to.equal(investor1.address);
      expect(position.isLong).to.be.false;
      expect(position.size).to.equal(1n);
      expect(position.active).to.be.true;
    });

    it("should revert with insufficient margin", async function () {
      const { futures, investor1 } = await loadFixture(deployFuturesFixture);

      // Send less than required margin
      const insufficientMargin = 10000000000n;

      await expect(
        futures
          .connect(investor1)
          .openPosition(true, 1, { value: insufficientMargin })
      ).to.be.revertedWithCustomError(futures, "InsufficientMargin");
    });

    it("should revert if caller is not whitelisted", async function () {
      const { futures, investor3 } = await loadFixture(deployFuturesFixture);

      const margin = 20000000000n;

      await expect(
        futures
          .connect(investor3)
          .openPosition(true, 1, { value: margin })
      ).to.be.revertedWithCustomError(futures, "NotWhitelisted");
    });
  });

  describe("settle", function () {
    it("should settle after expiration with oracle price", async function () {
      const { futures, issuer, investor1, priceFeed } = await loadFixture(
        deployFuturesFixture
      );

      // Open a position first
      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      // Advance time past settlement date
      await increaseTime(86400 * 31);

      // Update price feed timestamp so it is not stale
      await priceFeed.setPrice(MOCK_PRICE);

      const tx = await futures.connect(issuer).settle();
      await expect(tx).to.emit(futures, "ContractSettled");

      expect(await futures.settlementPrice()).to.equal(MOCK_PRICE);
    });

    it("should revert before expiration", async function () {
      const { futures, issuer } = await loadFixture(deployFuturesFixture);

      await expect(
        futures.connect(issuer).settle()
      ).to.be.revertedWithCustomError(futures, "ContractNotExpired");
    });
  });

  describe("closePosition", function () {
    it("should close position and receive payout", async function () {
      const { futures, investor1 } = await loadFixture(deployFuturesFixture);

      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      const tx = await futures.connect(investor1).closePosition(1);
      await expect(tx).to.emit(futures, "PositionClosed");

      const position = await futures.positions(1);
      expect(position.active).to.be.false;
    });

    it("should have positive PnL for long when price increases", async function () {
      const { futures, investor1, investor2, priceFeed } = await loadFixture(
        deployFuturesFixture
      );

      // Open long at $2000
      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      // Open an offsetting short so the contract has enough ETH for payouts
      // Deposit enough to cover the expected PnL
      await futures
        .connect(investor2)
        .openPosition(false, 1, { value: 50000000000n });

      // Price goes to $2500 (250000000000 with 8 decimals)
      await priceFeed.setPrice(250000000000n);

      const balanceBefore = await ethers.provider.getBalance(
        investor1.address
      );

      const tx = await futures.connect(investor1).closePosition(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      // PnL = (2500 - 2000) * 1 * 1 = 50000000000 (in 8 decimal units)
      // Payout = margin + pnl = 20000000000 + 50000000000 = 70000000000
      // Balance change = payout - gas
      const balanceChange = balanceAfter - balanceBefore + gasUsed;
      expect(balanceChange).to.equal(margin + 50000000000n);
    });

    it("should have positive PnL for short when price drops", async function () {
      const { futures, investor1, investor2, priceFeed } = await loadFixture(
        deployFuturesFixture
      );

      // Open short at $2000
      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(false, 1, { value: margin });

      // Open an offsetting long so the contract has enough ETH for payouts
      // Deposit enough to cover the expected PnL
      await futures
        .connect(investor2)
        .openPosition(true, 1, { value: 50000000000n });

      // Price drops to $1500 (150000000000 with 8 decimals)
      await priceFeed.setPrice(150000000000n);

      const balanceBefore = await ethers.provider.getBalance(
        investor1.address
      );

      const tx = await futures.connect(investor1).closePosition(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      // PnL for short = -(currentPrice - entryPrice) * size * contractSize
      // = -(1500 - 2000) * 1 * 1 = 50000000000
      // Payout = margin + pnl = 20000000000 + 50000000000 = 70000000000
      const balanceChange = balanceAfter - balanceBefore + gasUsed;
      expect(balanceChange).to.equal(margin + 50000000000n);
    });
  });

  describe("liquidatePosition", function () {
    it("should liquidate when below maintenance margin", async function () {
      const { futures, investor1, liquidator, priceFeed } = await loadFixture(
        deployFuturesFixture
      );

      // Open long at $2000 with minimum margin (10%)
      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      // Drop price significantly so effective margin falls below maintenance margin (5%)
      // Entry = 200000000000, need loss > margin - maintenance
      // At new price P: effectiveMargin = margin + (P - entry)*1*1
      // maintenanceMargin = P * 1 * 1 * 500 / 10000 = P * 0.05
      // Need: margin + (P - entry) < P * 0.05
      // 20000000000 + P - 200000000000 < P * 0.05
      // 20000000000 - 200000000000 < P * 0.05 - P
      // -180000000000 < -0.95 * P
      // P < 180000000000 / 0.95 = ~189473684210
      // Use price = $1800 = 180000000000
      await priceFeed.setPrice(180000000000n);

      const tx = await futures.connect(liquidator).liquidatePosition(1);
      await expect(tx).to.emit(futures, "PositionLiquidated");
      await expect(tx).to.emit(futures, "PositionClosed");

      const position = await futures.positions(1);
      expect(position.active).to.be.false;
    });
  });

  describe("addMargin", function () {
    it("should add margin to existing position", async function () {
      const { futures, investor1 } = await loadFixture(deployFuturesFixture);

      const margin = 20000000000n;
      await futures
        .connect(investor1)
        .openPosition(true, 1, { value: margin });

      const additionalMargin = 10000000000n;
      const tx = await futures
        .connect(investor1)
        .addMargin(1, { value: additionalMargin });

      await expect(tx).to.emit(futures, "MarginAdded").withArgs(1, additionalMargin);

      const position = await futures.positions(1);
      expect(position.margin).to.equal(margin + additionalMargin);
    });
  });
});
