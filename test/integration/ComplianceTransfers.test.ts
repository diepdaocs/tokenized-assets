import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Compliance Transfer Integration", function () {
  async function deployEquityWithCompliance() {
    const [admin, investor1, investor2, investor3, nonWhitelisted] =
      await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry =
      await ethers.getContractFactory("ComplianceRegistry");
    const registry = await upgrades.deployProxy(ComplianceRegistry, [
      admin.address,
    ]);
    await registry.waitForDeployment();

    // Deploy mock oracle
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy(200000000000n, 8);
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracle = await upgrades.deployProxy(PriceOracle, [
      admin.address,
      3600,
    ]);
    await oracle.waitForDeployment();

    // Deploy equity
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const equity = await upgrades.deployProxy(EquityToken, [
      "Compliance Test",
      "COMP",
      await registry.getAddress(),
      await oracle.getAddress(),
      admin.address,
      "CUSIP999",
      1000000n,
    ]);
    await equity.waitForDeployment();

    // Whitelist admin and investors 1-2
    await registry.whitelistInvestor(admin.address);
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);

    // Mint tokens to investor1
    await equity.mint(investor1.address, ethers.parseEther("1000"));

    return {
      registry,
      equity,
      admin,
      investor1,
      investor2,
      investor3,
      nonWhitelisted,
    };
  }

  it("Should allow transfers between whitelisted addresses", async function () {
    const { equity, investor1, investor2 } = await loadFixture(
      deployEquityWithCompliance
    );
    await equity
      .connect(investor1)
      .transfer(investor2.address, ethers.parseEther("100"));
    expect(await equity.balanceOf(investor2.address)).to.equal(
      ethers.parseEther("100")
    );
  });

  it("Should block transfers TO non-whitelisted addresses", async function () {
    const { equity, investor1, nonWhitelisted } = await loadFixture(
      deployEquityWithCompliance
    );
    await expect(
      equity
        .connect(investor1)
        .transfer(nonWhitelisted.address, ethers.parseEther("100"))
    ).to.be.reverted;
  });

  it("Should block transfers FROM blacklisted addresses", async function () {
    const { equity, registry, investor1, investor2 } = await loadFixture(
      deployEquityWithCompliance
    );
    // Blacklist investor1
    await registry.blacklistInvestor(investor1.address, "AML flagged");
    await expect(
      equity
        .connect(investor1)
        .transfer(investor2.address, ethers.parseEther("100"))
    ).to.be.reverted;
  });

  it("Should allow minting to any address (from=0 bypass)", async function () {
    const { equity, investor3 } = await loadFixture(
      deployEquityWithCompliance
    );
    // investor3 is not whitelisted, but minting bypasses compliance
    await equity.mint(investor3.address, ethers.parseEther("100"));
    expect(await equity.balanceOf(investor3.address)).to.equal(
      ethers.parseEther("100")
    );
  });

  it("Should restore transfer ability after removing from blacklist and whitelisting", async function () {
    const { equity, registry, investor1, investor2 } = await loadFixture(
      deployEquityWithCompliance
    );

    // Blacklist investor1
    await registry.blacklistInvestor(investor1.address, "temporary");

    // Verify blocked
    await expect(
      equity
        .connect(investor1)
        .transfer(investor2.address, ethers.parseEther("10"))
    ).to.be.reverted;

    // Remove from blacklist and re-whitelist
    await registry.removeFromBlacklist(investor1.address);
    await registry.whitelistInvestor(investor1.address);

    // Transfer should work now
    await equity
      .connect(investor1)
      .transfer(investor2.address, ethers.parseEther("10"));
    expect(await equity.balanceOf(investor2.address)).to.equal(
      ethers.parseEther("10")
    );
  });

  it("Should handle batch whitelisting", async function () {
    const { registry, equity, investor1, investor3, nonWhitelisted } =
      await loadFixture(deployEquityWithCompliance);

    // Batch whitelist investor3 and nonWhitelisted
    await registry.batchWhitelist([
      investor3.address,
      nonWhitelisted.address,
    ]);

    // Now transfers should work
    await equity
      .connect(investor1)
      .transfer(investor3.address, ethers.parseEther("50"));
    expect(await equity.balanceOf(investor3.address)).to.equal(
      ethers.parseEther("50")
    );

    await equity
      .connect(investor3)
      .transfer(nonWhitelisted.address, ethers.parseEther("25"));
    expect(await equity.balanceOf(nonWhitelisted.address)).to.equal(
      ethers.parseEther("25")
    );
  });
});
