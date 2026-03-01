import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { getBlockTimestamp, increaseTime } from "../helpers/time";

describe("Bond Lifecycle Integration", function () {
  async function deployBondInfrastructure() {
    const [admin, investor1, investor2] = await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry =
      await ethers.getContractFactory("ComplianceRegistry");
    const registry = await upgrades.deployProxy(ComplianceRegistry, [
      admin.address,
    ]);
    await registry.waitForDeployment();

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracle = await upgrades.deployProxy(PriceOracle, [
      admin.address,
      3600,
    ]);
    await oracle.waitForDeployment();

    // Whitelist
    await registry.whitelistInvestor(admin.address);
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);

    const now = await getBlockTimestamp();
    const bondTerms = {
      faceValue: ethers.parseEther("1000"),
      couponRateBps: 500n, // 5%
      couponInterval: 86400n * 30n, // 30 days
      maturityDate: BigInt(now + 365 * 86400),
      issueDate: 0n,
    };

    // Deploy BondToken
    const BondToken = await ethers.getContractFactory("BondToken");
    const bond = await upgrades.deployProxy(BondToken, [
      "Corp Bond 2026",
      "CBOND",
      await registry.getAddress(),
      await oracle.getAddress(),
      admin.address,
      bondTerms,
    ]);
    await bond.waitForDeployment();

    return { registry, bond, admin, investor1, investor2 };
  }

  it("Should complete full bond lifecycle: issue → coupon → maturity → redeem", async function () {
    const { bond, admin, investor1, investor2 } = await loadFixture(
      deployBondInfrastructure
    );

    // Issue bonds
    await bond.mint(investor1.address, ethers.parseEther("600"));
    await bond.mint(investor2.address, ethers.parseEther("400"));
    expect(await bond.totalSupply()).to.equal(ethers.parseEther("1000"));

    // Fund coupons generously
    await bond.fundCoupons({ value: ethers.parseEther("100") });

    // Advance one coupon period (30 days)
    await increaseTime(86400 * 30);

    // Check accrued coupon for investor1 (600/1000 of 5% of 1000 = 30 ETH per year, ~2.5 ETH per month)
    const accrued1 = await bond.accruedCoupon(investor1.address);
    expect(accrued1).to.be.gt(0);

    // Claim coupon
    const bal1Before = await ethers.provider.getBalance(investor1.address);
    await bond.connect(investor1).claimCoupon();
    const bal1After = await ethers.provider.getBalance(investor1.address);
    expect(bal1After).to.be.gt(bal1Before);

    // Advance to second coupon period
    await increaseTime(86400 * 30);
    const accrued1Again = await bond.accruedCoupon(investor1.address);
    expect(accrued1Again).to.be.gt(0);
    await bond.connect(investor1).claimCoupon();

    // Advance to maturity
    await increaseTime(365 * 86400);

    // Fund redemption
    await bond.fundRedemption({ value: ethers.parseEther("1000") });

    // Investor1 redeems (600/1000 of face value)
    const redBal1Before = await ethers.provider.getBalance(
      investor1.address
    );
    await bond.connect(investor1).redeem();
    const redBal1After = await ethers.provider.getBalance(
      investor1.address
    );
    // Should receive ~600 ETH
    expect(redBal1After - redBal1Before).to.be.gt(ethers.parseEther("599"));

    // Investor2 redeems (400/1000 of face value)
    const redBal2Before = await ethers.provider.getBalance(
      investor2.address
    );
    await bond.connect(investor2).redeem();
    const redBal2After = await ethers.provider.getBalance(
      investor2.address
    );
    // Should receive ~400 ETH
    expect(redBal2After - redBal2Before).to.be.gt(ethers.parseEther("399"));

    // All bonds burned
    expect(await bond.totalSupply()).to.equal(0);
  });

  it("Should not allow redemption before maturity", async function () {
    const { bond, investor1 } = await loadFixture(
      deployBondInfrastructure
    );

    await bond.mint(investor1.address, ethers.parseEther("100"));

    await expect(bond.connect(investor1).redeem()).to.be.reverted;
  });

  it("Should track multiple coupon periods correctly", async function () {
    const { bond, investor1 } = await loadFixture(
      deployBondInfrastructure
    );

    await bond.mint(investor1.address, ethers.parseEther("1000"));
    await bond.fundCoupons({ value: ethers.parseEther("100") });

    // After 0 days: no coupon
    const accrued0 = await bond.accruedCoupon(investor1.address);
    expect(accrued0).to.equal(0);

    // After 30 days: 1 period
    await increaseTime(86400 * 30);
    const accrued1 = await bond.accruedCoupon(investor1.address);
    expect(accrued1).to.be.gt(0);

    // After 60 days: 2 periods (should be ~2x the 1-period amount)
    await increaseTime(86400 * 30);
    const accrued2 = await bond.accruedCoupon(investor1.address);
    expect(accrued2).to.be.gt(accrued1);
  });
});
