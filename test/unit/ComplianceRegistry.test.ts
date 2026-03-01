import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES } from "../helpers/constants";

describe("ComplianceRegistry", function () {
  async function deployRegistryFixture() {
    const [admin, complianceOfficer, investor1, investor2, investor3, outsider] =
      await ethers.getSigners();

    const ComplianceRegistry = await ethers.getContractFactory("ComplianceRegistry");
    const registry = await upgrades.deployProxy(ComplianceRegistry, [admin.address]);
    await registry.waitForDeployment();

    // Grant compliance officer role
    await registry.grantRole(ROLES.COMPLIANCE_OFFICER, complianceOfficer.address);

    return { registry, admin, complianceOfficer, investor1, investor2, investor3, outsider };
  }

  describe("Initialization", function () {
    it("should initialize with the admin having DEFAULT_ADMIN_ROLE", async function () {
      const { registry, admin } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(ROLES.DEFAULT_ADMIN, admin.address)).to.be.true;
    });

    it("should initialize with the admin having COMPLIANCE_OFFICER_ROLE", async function () {
      const { registry, admin } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(ROLES.COMPLIANCE_OFFICER, admin.address)).to.be.true;
    });

    it("should initialize with the admin having VERIFIER_ROLE", async function () {
      const { registry, admin } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(ROLES.VERIFIER, admin.address)).to.be.true;
    });
  });

  describe("whitelistInvestor", function () {
    it("should whitelist an investor with COMPLIANCE_OFFICER_ROLE", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor1.address);

      expect(await registry.isWhitelisted(investor1.address)).to.be.true;
      expect(await registry.whitelistedCount()).to.equal(1);
    });

    it("should emit InvestorWhitelisted and InvestorStatusUpdated events", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await expect(registry.connect(complianceOfficer).whitelistInvestor(investor1.address))
        .to.emit(registry, "InvestorWhitelisted")
        .and.to.emit(registry, "InvestorStatusUpdated");
    });

    it("should revert when called without COMPLIANCE_OFFICER_ROLE", async function () {
      const { registry, outsider, investor1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(outsider).whitelistInvestor(investor1.address)
      ).to.be.reverted;
    });

    it("should revert when whitelisting the zero address", async function () {
      const { registry, complianceOfficer } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(complianceOfficer).whitelistInvestor(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidParameter");
    });
  });

  describe("blacklistInvestor", function () {
    it("should blacklist an investor and store the reason", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "AML violation");

      expect(await registry.isBlacklisted(investor1.address)).to.be.true;
      expect(await registry.getBlacklistReason(investor1.address)).to.equal("AML violation");
    });

    it("should decrement whitelist count when blacklisting a whitelisted investor", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor1.address);
      expect(await registry.whitelistedCount()).to.equal(1);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud");
      expect(await registry.whitelistedCount()).to.equal(0);
    });

    it("should emit InvestorBlacklisted and InvestorStatusUpdated events", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await expect(registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud"))
        .to.emit(registry, "InvestorBlacklisted")
        .withArgs(investor1.address, "Fraud")
        .and.to.emit(registry, "InvestorStatusUpdated");
    });

    it("should revert when called without COMPLIANCE_OFFICER_ROLE", async function () {
      const { registry, outsider, investor1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(outsider).blacklistInvestor(investor1.address, "reason")
      ).to.be.reverted;
    });
  });

  describe("removeFromBlacklist", function () {
    it("should reset investor status to NONE", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud");
      expect(await registry.isBlacklisted(investor1.address)).to.be.true;

      await registry.connect(complianceOfficer).removeFromBlacklist(investor1.address);
      expect(await registry.isBlacklisted(investor1.address)).to.be.false;
      // Status should be NONE (0)
      expect(await registry.getInvestorStatus(investor1.address)).to.equal(0);
    });

    it("should delete the blacklist reason", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud");
      await registry.connect(complianceOfficer).removeFromBlacklist(investor1.address);

      expect(await registry.getBlacklistReason(investor1.address)).to.equal("");
    });

    it("should emit InvestorStatusUpdated event", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud");

      await expect(registry.connect(complianceOfficer).removeFromBlacklist(investor1.address))
        .to.emit(registry, "InvestorStatusUpdated");
    });
  });

  describe("setAccreditedStatus", function () {
    it("should set accredited status with expiry date", async function () {
      const { registry, admin, investor1 } = await loadFixture(deployRegistryFixture);

      const block = await ethers.provider.getBlock("latest");
      const expiryDate = block!.timestamp + 365 * 86400; // 1 year from now

      await registry.connect(admin).setAccreditedStatus(investor1.address, true, expiryDate);
      expect(await registry.isAccredited(investor1.address)).to.be.true;
    });

    it("should return false for isAccredited after expiry", async function () {
      const { registry, admin, investor1 } = await loadFixture(deployRegistryFixture);

      const block = await ethers.provider.getBlock("latest");
      const expiryDate = block!.timestamp + 100; // 100 seconds from now

      await registry.connect(admin).setAccreditedStatus(investor1.address, true, expiryDate);
      expect(await registry.isAccredited(investor1.address)).to.be.true;

      // Increase time past expiry
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      expect(await registry.isAccredited(investor1.address)).to.be.false;
    });

    it("should emit AccreditedStatusChanged event", async function () {
      const { registry, admin, investor1 } = await loadFixture(deployRegistryFixture);

      const expiryDate = (await ethers.provider.getBlock("latest"))!.timestamp + 365 * 86400;

      await expect(registry.connect(admin).setAccreditedStatus(investor1.address, true, expiryDate))
        .to.emit(registry, "AccreditedStatusChanged")
        .withArgs(investor1.address, true, expiryDate);
    });
  });

  describe("batchWhitelist", function () {
    it("should whitelist multiple addresses at once", async function () {
      const { registry, complianceOfficer, investor1, investor2, investor3 } =
        await loadFixture(deployRegistryFixture);

      await registry
        .connect(complianceOfficer)
        .batchWhitelist([investor1.address, investor2.address, investor3.address]);

      expect(await registry.isWhitelisted(investor1.address)).to.be.true;
      expect(await registry.isWhitelisted(investor2.address)).to.be.true;
      expect(await registry.isWhitelisted(investor3.address)).to.be.true;
      expect(await registry.whitelistedCount()).to.equal(3);
    });

    it("should skip zero addresses in batch", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry
        .connect(complianceOfficer)
        .batchWhitelist([investor1.address, ethers.ZeroAddress]);

      expect(await registry.isWhitelisted(investor1.address)).to.be.true;
      // Only 1 was whitelisted (zero address skipped)
      expect(await registry.whitelistedCount()).to.equal(1);
    });

    it("should revert without COMPLIANCE_OFFICER_ROLE", async function () {
      const { registry, outsider, investor1 } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.connect(outsider).batchWhitelist([investor1.address])
      ).to.be.reverted;
    });
  });

  describe("canTransfer", function () {
    it("should return true for whitelisted sender and receiver", async function () {
      const { registry, complianceOfficer, investor1, investor2 } =
        await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor1.address);
      await registry.connect(complianceOfficer).whitelistInvestor(investor2.address);

      expect(await registry.canTransfer(investor1.address, investor2.address, 100)).to.be.true;
    });

    it("should return false if sender is not whitelisted", async function () {
      const { registry, complianceOfficer, investor1, investor2 } =
        await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor2.address);

      expect(await registry.canTransfer(investor1.address, investor2.address, 100)).to.be.false;
    });

    it("should return false if receiver is not whitelisted", async function () {
      const { registry, complianceOfficer, investor1, investor2 } =
        await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor1.address);

      expect(await registry.canTransfer(investor1.address, investor2.address, 100)).to.be.false;
    });

    it("should return true for mint (from is address(0))", async function () {
      const { registry, investor1 } = await loadFixture(deployRegistryFixture);

      expect(await registry.canTransfer(ethers.ZeroAddress, investor1.address, 100)).to.be.true;
    });

    it("should return true for burn (to is address(0))", async function () {
      const { registry, investor1 } = await loadFixture(deployRegistryFixture);

      expect(await registry.canTransfer(investor1.address, ethers.ZeroAddress, 100)).to.be.true;
    });
  });

  describe("getInvestorStatus", function () {
    it("should return NONE (0) for unknown investor", async function () {
      const { registry, outsider } = await loadFixture(deployRegistryFixture);

      expect(await registry.getInvestorStatus(outsider.address)).to.equal(0);
    });

    it("should return WHITELISTED (2) for whitelisted investor", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).whitelistInvestor(investor1.address);
      expect(await registry.getInvestorStatus(investor1.address)).to.equal(2);
    });

    it("should return BLACKLISTED (3) for blacklisted investor", async function () {
      const { registry, complianceOfficer, investor1 } = await loadFixture(deployRegistryFixture);

      await registry.connect(complianceOfficer).blacklistInvestor(investor1.address, "Fraud");
      expect(await registry.getInvestorStatus(investor1.address)).to.equal(3);
    });
  });
});
