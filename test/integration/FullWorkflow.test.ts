import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { getBlockTimestamp, increaseTime } from "../helpers/time";

describe("Full Workflow Integration", function () {
  async function deployFullStack() {
    const [admin, issuer, investor1, investor2] = await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry =
      await ethers.getContractFactory("ComplianceRegistry");
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
    const priceId = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
    await oracle.setPriceFeed(priceId, await priceFeed.getAddress());

    // Deploy implementations
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const equityImpl = await EquityToken.deploy();
    const BondToken = await ethers.getContractFactory("BondToken");
    const bondImpl = await BondToken.deploy();
    const LandToken = await ethers.getContractFactory("LandToken");
    const landImpl = await LandToken.deploy();
    const FractionalLandToken = await ethers.getContractFactory(
      "FractionalLandToken"
    );
    const fractionalImpl = await FractionalLandToken.deploy();
    const FuturesContract =
      await ethers.getContractFactory("FuturesContract");
    const futuresImpl = await FuturesContract.deploy();
    const OptionsContract =
      await ethers.getContractFactory("OptionsContract");
    const optionsImpl = await OptionsContract.deploy();

    // Deploy TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    const factory = await upgrades.deployProxy(TokenFactory, [
      admin.address,
      await registry.getAddress(),
      await oracle.getAddress(),
    ]);
    await factory.waitForDeployment();

    // Set implementations
    await factory.setImplementation(0, await equityImpl.getAddress()); // EQUITY
    await factory.setImplementation(1, await bondImpl.getAddress()); // BOND
    await factory.setImplementation(2, await futuresImpl.getAddress()); // DERIVATIVE_FUTURE
    await factory.setImplementation(3, await optionsImpl.getAddress()); // DERIVATIVE_OPTION
    await factory.setImplementation(4, await landImpl.getAddress()); // LAND
    await factory.setImplementation(5, await fractionalImpl.getAddress()); // FRACTIONAL_LAND

    // Whitelist participants
    await registry.whitelistInvestor(admin.address);
    await registry.whitelistInvestor(issuer.address);
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);

    return {
      registry,
      oracle,
      priceFeed,
      factory,
      admin,
      issuer,
      investor1,
      investor2,
      priceId,
    };
  }

  describe("Equity Lifecycle", function () {
    it("Should deploy equity, mint, transfer, distribute dividends, and claim", async function () {
      const { factory, registry, admin, investor1, investor2 } =
        await loadFixture(deployFullStack);

      // Deploy equity via factory
      const tx = await factory.deployEquity(
        "Acme Corp",
        "ACME",
        "CUSIP123",
        1000000n
      );
      const receipt = await tx.wait();

      // Get deployed equity address from events
      const assets = await factory.getDeployedAssets();
      expect(assets.length).to.equal(1);
      const equityAddr = assets[0].tokenAddress;

      // Attach to EquityToken
      const EquityToken = await ethers.getContractFactory("EquityToken");
      const equity = EquityToken.attach(equityAddr) as any;

      // Verify metadata
      expect(await equity.name()).to.equal("Acme Corp");
      expect(await equity.symbol()).to.equal("ACME");

      // Mint tokens to investors
      await equity.mint(investor1.address, ethers.parseEther("600"));
      await equity.mint(investor2.address, ethers.parseEther("400"));

      // Transfer between whitelisted investors
      await equity
        .connect(investor1)
        .transfer(investor2.address, ethers.parseEther("100"));
      expect(await equity.balanceOf(investor1.address)).to.equal(
        ethers.parseEther("500")
      );
      expect(await equity.balanceOf(investor2.address)).to.equal(
        ethers.parseEther("500")
      );

      // Create snapshot and distribute dividends
      const snapTx = await equity.snapshot();
      await snapTx.wait();
      const snapshotId = await equity.currentSnapshotId();

      await equity.distributeDividend(snapshotId, {
        value: ethers.parseEther("10"),
      });

      // Investor1 claims dividend (50% of 10 ETH = 5 ETH)
      const balBefore = await ethers.provider.getBalance(investor1.address);
      await equity.connect(investor1).claimDividend(0);
      const balAfter = await ethers.provider.getBalance(investor1.address);
      // Should have received ~5 ETH (minus gas)
      expect(balAfter - balBefore).to.be.gt(ethers.parseEther("4.9"));
    });
  });

  describe("Bond Lifecycle", function () {
    it("Should deploy bond, mint, claim coupons, and redeem at maturity", async function () {
      const { factory, admin, investor1 } =
        await loadFixture(deployFullStack);

      const now = await getBlockTimestamp();
      const bondTerms = {
        faceValue: ethers.parseEther("100"),
        couponRateBps: 500n, // 5%
        couponInterval: 86400n * 30n, // 30 days
        maturityDate: BigInt(now + 365 * 86400),
        issueDate: 0n,
      };

      await factory.deployBond("US Treasury", "TBOND", bondTerms);
      const assets = await factory.getDeployedAssets();
      const bondAddr = assets[0].tokenAddress;

      const BondToken = await ethers.getContractFactory("BondToken");
      const bond = BondToken.attach(bondAddr) as any;

      // Mint bonds to investor
      await bond.mint(investor1.address, ethers.parseEther("100"));

      // Fund coupons
      await bond.fundCoupons({ value: ethers.parseEther("10") });

      // Advance 30 days
      await increaseTime(86400 * 30);

      // Claim coupon
      const accrued = await bond.accruedCoupon(investor1.address);
      expect(accrued).to.be.gt(0);

      await bond.connect(investor1).claimCoupon();

      // Fund redemption and advance to maturity
      await bond.fundRedemption({ value: ethers.parseEther("100") });
      await increaseTime(365 * 86400);

      // Redeem
      const balBefore = await ethers.provider.getBalance(investor1.address);
      await bond.connect(investor1).redeem();
      const balAfter = await ethers.provider.getBalance(investor1.address);
      // Should receive close to 100 ETH face value
      expect(balAfter - balBefore).to.be.gt(ethers.parseEther("99"));
    });
  });

  describe("Factory Tracking", function () {
    it("Should track multiple deployed assets across categories", async function () {
      const { factory, admin } = await loadFixture(deployFullStack);

      const now = await getBlockTimestamp();

      // Deploy one of each type
      await factory.deployEquity("Equity1", "EQ1", "CUSIP1", 1000n);
      await factory.deployBond("Bond1", "BD1", {
        faceValue: ethers.parseEther("1000"),
        couponRateBps: 500n,
        couponInterval: 86400n * 30n,
        maturityDate: BigInt(now + 365 * 86400),
        issueDate: 0n,
      });
      await factory.deployLandToken("Land1", "LAND1");

      const allAssets = await factory.getDeployedAssets();
      expect(allAssets.length).to.equal(3);

      const equities = await factory.getAssetsByCategory(0); // EQUITY
      expect(equities.length).to.equal(1);

      const bonds = await factory.getAssetsByCategory(1); // BOND
      expect(bonds.length).to.equal(1);

      const lands = await factory.getAssetsByCategory(4); // LAND
      expect(lands.length).to.equal(1);

      // Verify isDeployedAsset
      expect(await factory.isDeployedAsset(equities[0])).to.be.true;
      expect(
        await factory.isDeployedAsset(ethers.ZeroAddress)
      ).to.be.false;
    });
  });

  describe("Compliance Transfer Restrictions", function () {
    it("Should block transfers to non-whitelisted addresses", async function () {
      const { factory, registry, admin, investor1, investor2 } =
        await loadFixture(deployFullStack);

      await factory.deployEquity("TestEQ", "TEQ", "C1", 1000n);
      const assets = await factory.getDeployedAssets();
      const equityAddr = assets[0].tokenAddress;

      const EquityToken = await ethers.getContractFactory("EquityToken");
      const equity = EquityToken.attach(equityAddr) as any;

      await equity.mint(investor1.address, ethers.parseEther("100"));

      // Blacklist investor2
      await registry.blacklistInvestor(investor2.address, "AML concern");

      // Transfer should fail
      await expect(
        equity
          .connect(investor1)
          .transfer(investor2.address, ethers.parseEther("10"))
      ).to.be.reverted;
    });
  });
});
