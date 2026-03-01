import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES, MOCK_PRICE, MOCK_DECIMALS, STALENESS_THRESHOLD, ONE_YEAR, ONE_MONTH } from "../helpers/constants";
import { increaseTime, getBlockTimestamp } from "../helpers/time";

describe("BondToken", function () {
  async function deployBondFixture() {
    const [admin, issuer, investor1, investor2, outsider] = await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const registry = await upgrades.deployProxy(ComplianceRegistry, [admin.address]);
    await registry.waitForDeployment();

    // Deploy MockPriceFeed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(MOCK_PRICE, MOCK_DECIMALS);
    await priceFeed.waitForDeployment();

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracle = await upgrades.deployProxy(PriceOracle, [admin.address, STALENESS_THRESHOLD]);
    await oracle.waitForDeployment();

    // Set up price feed
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
    await oracle.setPriceFeed(assetId, await priceFeed.getAddress());

    // Whitelist accounts
    await registry.whitelistInvestor(issuer.address);
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);

    // Get current timestamp for bond terms
    const timestamp = await getBlockTimestamp();

    const BondTerms = {
      faceValue: ethers.parseEther("1000"),
      couponRateBps: 500n, // 5%
      couponInterval: BigInt(ONE_MONTH), // 30 days
      maturityDate: BigInt(timestamp + ONE_YEAR),
      issueDate: 0n, // auto-set to block.timestamp
    };

    // Deploy BondToken
    const BondToken = await ethers.getContractFactory("BondToken");
    const bond = await upgrades.deployProxy(BondToken, [
      "Test Bond",
      "TBOND",
      await registry.getAddress(),
      await oracle.getAddress(),
      issuer.address,
      BondTerms,
    ]);
    await bond.waitForDeployment();

    return {
      bond,
      registry,
      oracle,
      priceFeed,
      admin,
      issuer,
      investor1,
      investor2,
      outsider,
      BondTerms,
    };
  }

  describe("Initialization", function () {
    it("should initialize with the correct name and symbol", async function () {
      const { bond } = await loadFixture(deployBondFixture);
      expect(await bond.name()).to.equal("Test Bond");
      expect(await bond.symbol()).to.equal("TBOND");
    });

    it("should initialize with the correct face value", async function () {
      const { bond } = await loadFixture(deployBondFixture);
      const terms = await bond.bondTerms();
      expect(terms.faceValue).to.equal(ethers.parseEther("1000"));
    });

    it("should initialize with the correct coupon rate", async function () {
      const { bond } = await loadFixture(deployBondFixture);
      const terms = await bond.bondTerms();
      expect(terms.couponRateBps).to.equal(500n);
    });

    it("should initialize with the correct coupon interval", async function () {
      const { bond } = await loadFixture(deployBondFixture);
      const terms = await bond.bondTerms();
      expect(terms.couponInterval).to.equal(BigInt(ONE_MONTH));
    });

    it("should auto-set issueDate to block.timestamp when provided as 0", async function () {
      const { bond } = await loadFixture(deployBondFixture);
      const terms = await bond.bondTerms();
      expect(terms.issueDate).to.be.gt(0);
    });

    it("should grant ISSUER_ROLE to the issuer", async function () {
      const { bond, issuer } = await loadFixture(deployBondFixture);
      expect(await bond.hasRole(ROLES.ISSUER, issuer.address)).to.be.true;
    });
  });

  describe("mint", function () {
    it("should mint bonds with ISSUER_ROLE", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      expect(await bond.balanceOf(investor1.address)).to.equal(ethers.parseEther("100"));
    });

    it("should revert when minting without ISSUER_ROLE", async function () {
      const { bond, outsider, investor1 } = await loadFixture(deployBondFixture);

      await expect(
        bond.connect(outsider).mint(investor1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("fundCoupons", function () {
    it("should allow issuer to fund the coupon pool", async function () {
      const { bond, issuer } = await loadFixture(deployBondFixture);

      const fundAmount = ethers.parseEther("50");
      await expect(bond.connect(issuer).fundCoupons({ value: fundAmount }))
        .to.emit(bond, "CouponsFunded")
        .withArgs(fundAmount);

      const bondAddress = await bond.getAddress();
      expect(await ethers.provider.getBalance(bondAddress)).to.equal(fundAmount);
    });

    it("should revert with zero value", async function () {
      const { bond, issuer } = await loadFixture(deployBondFixture);

      await expect(
        bond.connect(issuer).fundCoupons({ value: 0 })
      ).to.be.revertedWithCustomError(bond, "InvalidParameter");
    });

    it("should revert without ISSUER_ROLE", async function () {
      const { bond, outsider } = await loadFixture(deployBondFixture);

      await expect(
        bond.connect(outsider).fundCoupons({ value: ethers.parseEther("50") })
      ).to.be.reverted;
    });
  });

  describe("claimCoupon", function () {
    it("should allow holder to claim coupon after coupon interval passes", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      // Mint all bonds to investor1 (total supply = 100)
      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));

      // Fund coupons
      await bond.connect(issuer).fundCoupons({ value: ethers.parseEther("100") });

      // Advance time by one coupon interval (30 days)
      await increaseTime(ONE_MONTH);

      // Claim coupon
      // couponPerPeriod = faceValue * couponRateBps / 10000 = 1000e18 * 500 / 10000 = 50e18
      // holderShare = couponPerPeriod * balance / totalSupply = 50e18 * 100e18 / 100e18 = 50e18
      // periodsOwed = 1
      // total coupon = 50e18
      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await bond.connect(investor1).claimCoupon();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      const received = balanceAfter - balanceBefore + gasUsed;
      expect(received).to.equal(ethers.parseEther("50"));
    });

    it("should emit CouponClaimed event", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      await bond.connect(issuer).fundCoupons({ value: ethers.parseEther("100") });

      await increaseTime(ONE_MONTH);

      await expect(bond.connect(investor1).claimCoupon())
        .to.emit(bond, "CouponClaimed");
    });

    it("should revert if no coupon has accrued (before interval)", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      await bond.connect(issuer).fundCoupons({ value: ethers.parseEther("100") });

      // Do not advance time -- no coupon interval has passed
      await expect(
        bond.connect(investor1).claimCoupon()
      ).to.be.revertedWithCustomError(bond, "InvalidParameter");
    });

    it("should allow claiming proportional coupon when holder owns partial supply", async function () {
      const { bond, issuer, investor1, investor2 } = await loadFixture(deployBondFixture);

      // Mint: investor1 gets 75, investor2 gets 25 (total supply = 100)
      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("75"));
      await bond.connect(issuer).mint(investor2.address, ethers.parseEther("25"));

      await bond.connect(issuer).fundCoupons({ value: ethers.parseEther("100") });

      // Advance 1 coupon interval
      await increaseTime(ONE_MONTH);

      // couponPerPeriod = 50 ETH, investor1 share = 50 * 75/100 = 37.5 ETH
      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await bond.connect(investor1).claimCoupon();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      const received = balanceAfter - balanceBefore + gasUsed;
      expect(received).to.equal(ethers.parseEther("37.5"));
    });
  });

  describe("redeem", function () {
    it("should allow holder to redeem bonds after maturity", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      // Mint all bonds to investor1
      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));

      // Fund for redemption
      await bond.connect(issuer).fundRedemption({ value: ethers.parseEther("1000") });

      // Advance time past maturity (1 year)
      await increaseTime(ONE_YEAR + 1);

      // Redeem
      // redemptionAmount = faceValue * balance / totalSupply = 1000e18 * 100e18 / 100e18 = 1000e18
      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await bond.connect(investor1).redeem();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      const received = balanceAfter - balanceBefore + gasUsed;
      expect(received).to.equal(ethers.parseEther("1000"));

      // Bonds should be burned
      expect(await bond.balanceOf(investor1.address)).to.equal(0);
    });

    it("should emit BondRedeemed and BondMatured events", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      await bond.connect(issuer).fundRedemption({ value: ethers.parseEther("1000") });

      await increaseTime(ONE_YEAR + 1);

      await expect(bond.connect(investor1).redeem())
        .to.emit(bond, "BondRedeemed")
        .and.to.emit(bond, "BondMatured");
    });

    it("should revert if maturity has not been reached", async function () {
      const { bond, issuer, investor1 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      await bond.connect(issuer).fundRedemption({ value: ethers.parseEther("1000") });

      // Do not advance time past maturity
      await expect(
        bond.connect(investor1).redeem()
      ).to.be.revertedWithCustomError(bond, "ContractNotExpired");
    });

    it("should allow proportional redemption for partial holder", async function () {
      const { bond, issuer, investor1, investor2 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("60"));
      await bond.connect(issuer).mint(investor2.address, ethers.parseEther("40"));

      await bond.connect(issuer).fundRedemption({ value: ethers.parseEther("1000") });

      await increaseTime(ONE_YEAR + 1);

      // investor1 redeems: 1000 * 60/100 = 600
      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await bond.connect(investor1).redeem();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      const received = balanceAfter - balanceBefore + gasUsed;
      expect(received).to.equal(ethers.parseEther("600"));
    });
  });

  describe("timeToMaturity", function () {
    it("should return correct remaining time before maturity", async function () {
      const { bond } = await loadFixture(deployBondFixture);

      const ttm = await bond.timeToMaturity();
      // Should be approximately ONE_YEAR (may vary by a few seconds due to block mining)
      expect(ttm).to.be.closeTo(BigInt(ONE_YEAR), 10n);
    });

    it("should return 0 after maturity", async function () {
      const { bond } = await loadFixture(deployBondFixture);

      await increaseTime(ONE_YEAR + 1);

      expect(await bond.timeToMaturity()).to.equal(0);
    });
  });

  describe("Transfer (compliance-gated)", function () {
    it("should allow transfer between whitelisted addresses", async function () {
      const { bond, issuer, investor1, investor2 } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));
      await bond.connect(investor1).transfer(investor2.address, ethers.parseEther("50"));

      expect(await bond.balanceOf(investor1.address)).to.equal(ethers.parseEther("50"));
      expect(await bond.balanceOf(investor2.address)).to.equal(ethers.parseEther("50"));
    });

    it("should revert transfer to non-whitelisted address", async function () {
      const { bond, issuer, investor1, outsider } = await loadFixture(deployBondFixture);

      await bond.connect(issuer).mint(investor1.address, ethers.parseEther("100"));

      await expect(
        bond.connect(investor1).transfer(outsider.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(bond, "TransferRestricted");
    });

    it("should revert transfer from non-whitelisted address", async function () {
      const { bond, issuer, investor1, outsider, registry, admin } =
        await loadFixture(deployBondFixture);

      // Give outsider some tokens via whitelist, then remove
      await registry.connect(admin).whitelistInvestor(outsider.address);
      await bond.connect(issuer).mint(outsider.address, ethers.parseEther("100"));
      await registry.connect(admin).blacklistInvestor(outsider.address, "testing");

      await expect(
        bond.connect(outsider).transfer(investor1.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(bond, "TransferRestricted");
    });
  });
});
