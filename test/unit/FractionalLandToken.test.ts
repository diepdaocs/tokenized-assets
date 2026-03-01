import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES } from "../helpers/constants";

describe("FractionalLandToken", function () {
  async function deployFractionalLandFixture() {
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

    // Deploy FractionalLandToken
    const FractionalLandToken = await ethers.getContractFactory(
      "FractionalLandToken"
    );
    const fractional = await upgrades.deployProxy(FractionalLandToken, [
      "https://metadata.example.com/{id}",
      await registry.getAddress(),
      admin.address,
    ]);
    await fractional.waitForDeployment();

    // Grant REGISTRAR_ROLE to registrar
    const REGISTRAR_ROLE = ROLES.REGISTRAR;
    await fractional
      .connect(admin)
      .grantRole(REGISTRAR_ROLE, registrar.address);

    // A mock land token contract address
    const landTokenContract = ethers.Wallet.createRandom().address;

    return {
      fractional,
      registry,
      admin,
      registrar,
      investor1,
      investor2,
      nonWhitelisted,
      landTokenContract,
      REGISTRAR_ROLE,
    };
  }

  describe("fractionalize", function () {
    it("should create fraction info", async function () {
      const { fractional, registrar, landTokenContract } = await loadFixture(
        deployFractionalLandFixture
      );

      const tx = await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await expect(tx)
        .to.emit(fractional, "Fractionalized")
        .withArgs(1, 1, landTokenContract, 100);

      const info = await fractional.getFractionInfo(1);
      expect(info.landTokenId).to.equal(1n);
      expect(info.landTokenContract).to.equal(landTokenContract);
      expect(info.totalFractions).to.equal(100n);
      expect(info.pricePerFraction).to.equal(ethers.parseEther("100"));
      expect(info.active).to.be.true;
    });

    it("should revert with zero totalFractions", async function () {
      const { fractional, registrar, landTokenContract } = await loadFixture(
        deployFractionalLandFixture
      );

      await expect(
        fractional
          .connect(registrar)
          .fractionalize(1, landTokenContract, 0, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(fractional, "InvalidParameter");
    });

    it("should revert with zero landTokenContract", async function () {
      const { fractional, registrar } = await loadFixture(
        deployFractionalLandFixture
      );

      await expect(
        fractional
          .connect(registrar)
          .fractionalize(1, ethers.ZeroAddress, 100, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(fractional, "InvalidParameter");
    });
  });

  describe("mintFractions", function () {
    it("should mint fractions to whitelisted address", async function () {
      const { fractional, registrar, investor1, landTokenContract } =
        await loadFixture(deployFractionalLandFixture);

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      const tx = await fractional
        .connect(registrar)
        .mintFractions(1, investor1.address, 50);

      await expect(tx)
        .to.emit(fractional, "FractionsMinted")
        .withArgs(1, investor1.address, 50);

      expect(await fractional.balanceOf(investor1.address, 1)).to.equal(50n);
    });

    it("should revert if recipient is not whitelisted", async function () {
      const { fractional, registrar, nonWhitelisted, landTokenContract } =
        await loadFixture(deployFractionalLandFixture);

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await expect(
        fractional
          .connect(registrar)
          .mintFractions(1, nonWhitelisted.address, 50)
      ).to.be.revertedWithCustomError(fractional, "NotWhitelisted");
    });

    it("should revert if fraction is not active", async function () {
      const { fractional, registrar, investor1 } = await loadFixture(
        deployFractionalLandFixture
      );

      // fractionId 99 does not exist, active defaults to false
      await expect(
        fractional.connect(registrar).mintFractions(99, investor1.address, 50)
      ).to.be.revertedWithCustomError(fractional, "AssetNotActive");
    });
  });

  describe("distributeRent", function () {
    it("should distribute rent for a fraction", async function () {
      const { fractional, registrar, landTokenContract } = await loadFixture(
        deployFractionalLandFixture
      );

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      const rentAmount = ethers.parseEther("10");
      const tx = await fractional
        .connect(registrar)
        .distributeRent(1, { value: rentAmount });

      await expect(tx)
        .to.emit(fractional, "RentDistributed")
        .withArgs(1, rentAmount);

      expect(await fractional.totalRentDistributed(1)).to.equal(rentAmount);
    });

    it("should revert with zero amount", async function () {
      const { fractional, registrar, landTokenContract } = await loadFixture(
        deployFractionalLandFixture
      );

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await expect(
        fractional.connect(registrar).distributeRent(1, { value: 0 })
      ).to.be.revertedWithCustomError(fractional, "InvalidParameter");
    });
  });

  describe("claimRent", function () {
    it("should allow holder to claim proportional rent", async function () {
      const { fractional, registrar, investor1, landTokenContract } =
        await loadFixture(deployFractionalLandFixture);

      // Create fractions and mint to investor1
      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await fractional
        .connect(registrar)
        .mintFractions(1, investor1.address, 50);

      // Distribute rent
      const rentAmount = ethers.parseEther("10");
      await fractional
        .connect(registrar)
        .distributeRent(1, { value: rentAmount });

      const balanceBefore = await ethers.provider.getBalance(
        investor1.address
      );

      const tx = await fractional.connect(investor1).claimRent(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx).to.emit(fractional, "RentClaimed");

      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      // 50 out of 100 fractions -> 50% of rent
      const expectedPayout = (rentAmount * 50n) / 100n;
      const balanceChange = balanceAfter - balanceBefore + gasUsed;
      expect(balanceChange).to.equal(expectedPayout);
    });

    it("should revert if holder has no fractions", async function () {
      const { fractional, registrar, investor2, landTokenContract } =
        await loadFixture(deployFractionalLandFixture);

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await fractional
        .connect(registrar)
        .distributeRent(1, { value: ethers.parseEther("10") });

      await expect(
        fractional.connect(investor2).claimRent(1)
      ).to.be.revertedWithCustomError(fractional, "InvalidParameter");
    });
  });

  describe("Transfer", function () {
    it("should allow transfer between whitelisted accounts", async function () {
      const { fractional, registrar, investor1, investor2, landTokenContract } =
        await loadFixture(deployFractionalLandFixture);

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await fractional
        .connect(registrar)
        .mintFractions(1, investor1.address, 50);

      await fractional
        .connect(investor1)
        .safeTransferFrom(investor1.address, investor2.address, 1, 20, "0x");

      expect(await fractional.balanceOf(investor1.address, 1)).to.equal(30n);
      expect(await fractional.balanceOf(investor2.address, 1)).to.equal(20n);
    });

    it("should revert transfer to non-whitelisted account", async function () {
      const {
        fractional,
        registrar,
        investor1,
        nonWhitelisted,
        landTokenContract,
      } = await loadFixture(deployFractionalLandFixture);

      await fractional
        .connect(registrar)
        .fractionalize(1, landTokenContract, 100, ethers.parseEther("100"));

      await fractional
        .connect(registrar)
        .mintFractions(1, investor1.address, 50);

      await expect(
        fractional
          .connect(investor1)
          .safeTransferFrom(
            investor1.address,
            nonWhitelisted.address,
            1,
            20,
            "0x"
          )
      ).to.be.revertedWithCustomError(fractional, "TransferRestricted");
    });
  });
});
