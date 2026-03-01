import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES } from "../helpers/constants";

describe("LandToken", function () {
  async function deployLandTokenFixture() {
    const [admin, registrar, investor1, investor2, nonWhitelisted] =
      await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry = await ethers.getContractFactory(
      "ComplianceRegistry"
    );
    const registry = await upgrades.deployProxy(ComplianceRegistry, [
      admin.address,
    ]);
    await registry.waitForDeployment();

    // Whitelist accounts
    await registry.whitelistInvestor(investor1.address);
    await registry.whitelistInvestor(investor2.address);

    // Deploy LandToken
    const LandToken = await ethers.getContractFactory("LandToken");
    const land = await upgrades.deployProxy(LandToken, [
      "Land Registry",
      "LAND",
      await registry.getAddress(),
      admin.address,
    ]);
    await land.waitForDeployment();

    // Grant REGISTRAR_ROLE to registrar
    const REGISTRAR_ROLE = ROLES.REGISTRAR;
    await land.connect(admin).grantRole(REGISTRAR_ROLE, registrar.address);

    const sampleProperty = {
      propertyId: "PROP-001",
      jurisdiction: "US-CA",
      areaSqMeters: 5000n,
      valuationUsd: ethers.parseEther("1000000"),
      metadataURI: "ipfs://QmProperty001",
      fractionalized: false,
    };

    return {
      land,
      registry,
      admin,
      registrar,
      investor1,
      investor2,
      nonWhitelisted,
      sampleProperty,
      REGISTRAR_ROLE,
    };
  }

  describe("mintProperty", function () {
    it("should mint with LandProperty struct", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      const tx = await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      await expect(tx)
        .to.emit(land, "LandMinted")
        .withArgs(1, investor1.address, sampleProperty.propertyId);

      expect(await land.ownerOf(1)).to.equal(investor1.address);
      expect(await land.tokenURI(1)).to.equal("ipfs://token1");
    });

    it("should revert if recipient is not whitelisted", async function () {
      const { land, registrar, nonWhitelisted, sampleProperty } =
        await loadFixture(deployLandTokenFixture);

      await expect(
        land
          .connect(registrar)
          .mintProperty(nonWhitelisted.address, sampleProperty, "ipfs://token1")
      ).to.be.revertedWithCustomError(land, "NotWhitelisted");
    });

    it("should revert if propertyId is empty", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      const badProperty = { ...sampleProperty, propertyId: "" };

      await expect(
        land
          .connect(registrar)
          .mintProperty(investor1.address, badProperty, "ipfs://token1")
      ).to.be.revertedWithCustomError(land, "InvalidParameter");
    });
  });

  describe("getProperty", function () {
    it("should return correct property data", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      const property = await land.getProperty(1);
      expect(property.propertyId).to.equal(sampleProperty.propertyId);
      expect(property.jurisdiction).to.equal(sampleProperty.jurisdiction);
      expect(property.areaSqMeters).to.equal(sampleProperty.areaSqMeters);
      expect(property.valuationUsd).to.equal(sampleProperty.valuationUsd);
      expect(property.metadataURI).to.equal(sampleProperty.metadataURI);
      expect(property.fractionalized).to.be.false;
    });
  });

  describe("fractionalize", function () {
    it("should link to fractional contract and set fractionalized flag", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      // Use a mock address as fractional contract
      const fractionalAddr = ethers.Wallet.createRandom().address;

      const tx = await land
        .connect(registrar)
        .fractionalize(1, fractionalAddr);

      await expect(tx)
        .to.emit(land, "LandFractionalized")
        .withArgs(1, fractionalAddr);

      const property = await land.getProperty(1);
      expect(property.fractionalized).to.be.true;
      expect(await land.fractionalContracts(1)).to.equal(fractionalAddr);
    });

    it("should revert if already fractionalized", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      const fractionalAddr = ethers.Wallet.createRandom().address;
      await land.connect(registrar).fractionalize(1, fractionalAddr);

      const anotherAddr = ethers.Wallet.createRandom().address;
      await expect(
        land.connect(registrar).fractionalize(1, anotherAddr)
      ).to.be.revertedWithCustomError(land, "InvalidParameter");
    });
  });

  describe("updateValuation", function () {
    it("should update valuation", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      const newValuation = ethers.parseEther("1500000");
      const tx = await land
        .connect(registrar)
        .updateValuation(1, newValuation);

      await expect(tx)
        .to.emit(land, "ValuationUpdated")
        .withArgs(1, newValuation);

      const property = await land.getProperty(1);
      expect(property.valuationUsd).to.equal(newValuation);
    });
  });

  describe("Transfer", function () {
    it("should allow transfer between whitelisted accounts", async function () {
      const { land, registrar, investor1, investor2, sampleProperty } =
        await loadFixture(deployLandTokenFixture);

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      await land
        .connect(investor1)
        .transferFrom(investor1.address, investor2.address, 1);

      expect(await land.ownerOf(1)).to.equal(investor2.address);
    });

    it("should revert transfer to non-whitelisted account", async function () {
      const { land, registrar, investor1, nonWhitelisted, sampleProperty } =
        await loadFixture(deployLandTokenFixture);

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      await expect(
        land
          .connect(investor1)
          .transferFrom(investor1.address, nonWhitelisted.address, 1)
      ).to.be.revertedWithCustomError(land, "TransferRestricted");
    });
  });

  describe("REGISTRAR_ROLE", function () {
    it("should revert mintProperty if caller lacks REGISTRAR_ROLE", async function () {
      const { land, investor1, sampleProperty, REGISTRAR_ROLE } =
        await loadFixture(deployLandTokenFixture);

      await expect(
        land
          .connect(investor1)
          .mintProperty(investor1.address, sampleProperty, "ipfs://token1")
      ).to.be.revertedWithCustomError(land, "AccessControlUnauthorizedAccount");
    });

    it("should revert fractionalize if caller lacks REGISTRAR_ROLE", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      const fractionalAddr = ethers.Wallet.createRandom().address;

      await expect(
        land.connect(investor1).fractionalize(1, fractionalAddr)
      ).to.be.revertedWithCustomError(land, "AccessControlUnauthorizedAccount");
    });

    it("should revert updateValuation if caller lacks REGISTRAR_ROLE", async function () {
      const { land, registrar, investor1, sampleProperty } = await loadFixture(
        deployLandTokenFixture
      );

      await land
        .connect(registrar)
        .mintProperty(investor1.address, sampleProperty, "ipfs://token1");

      await expect(
        land
          .connect(investor1)
          .updateValuation(1, ethers.parseEther("2000000"))
      ).to.be.revertedWithCustomError(land, "AccessControlUnauthorizedAccount");
    });
  });
});
