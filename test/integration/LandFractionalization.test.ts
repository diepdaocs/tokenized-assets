import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Land Fractionalization Integration", function () {
  async function deployLandInfrastructure() {
    const [admin, registrar, investor1, investor2] =
      await ethers.getSigners();

    // Deploy ComplianceRegistry
    const ComplianceRegistry =
      await ethers.getContractFactory("ComplianceRegistry");
    const registry = await upgrades.deployProxy(ComplianceRegistry, [
      admin.address,
    ]);
    await registry.waitForDeployment();

    // Whitelist participants
    await registry.whitelistInvestor(admin.address);
    await registry.whitelistInvestor(registrar.address);
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

    return { registry, land, fractional, admin, registrar, investor1, investor2 };
  }

  it("Should mint land NFT, fractionalize, mint fractions, distribute and claim rent", async function () {
    const { land, fractional, admin, investor1, investor2 } =
      await loadFixture(deployLandInfrastructure);

    // 1. Mint a land parcel
    const property = {
      propertyId: "LOT-001",
      jurisdiction: "Singapore",
      areaSqMeters: 500n,
      valuationUsd: ethers.parseEther("1000000"),
      metadataURI: "ipfs://Qm...",
      fractionalized: false,
    };

    await land.mintProperty(
      admin.address,
      property,
      "ipfs://land-metadata/1"
    );

    const tokenId = 1n;
    expect(await land.ownerOf(tokenId)).to.equal(admin.address);

    const storedProperty = await land.getProperty(tokenId);
    expect(storedProperty.propertyId).to.equal("LOT-001");
    expect(storedProperty.areaSqMeters).to.equal(500n);

    // 2. Fractionalize the land
    const fractionalAddr = await fractional.getAddress();
    await land.fractionalize(tokenId, fractionalAddr);

    const updatedProperty = await land.getProperty(tokenId);
    expect(updatedProperty.fractionalized).to.be.true;

    // 3. Create fractions in FractionalLandToken
    const totalFractions = 1000n;
    const pricePerFraction = ethers.parseEther("1000"); // $1000 per fraction

    const fractionId = 1n;
    await fractional.fractionalize(
      tokenId,
      await land.getAddress(),
      totalFractions,
      pricePerFraction
    );

    // 4. Mint fractions to investors
    await fractional.mintFractions(fractionId, investor1.address, 600n);
    await fractional.mintFractions(fractionId, investor2.address, 400n);

    expect(await fractional.balanceOf(investor1.address, fractionId)).to.equal(600n);
    expect(await fractional.balanceOf(investor2.address, fractionId)).to.equal(400n);

    // 5. Distribute rent
    await fractional.distributeRent(fractionId, {
      value: ethers.parseEther("10"),
    });

    // 6. Investor1 claims rent (60% of 10 ETH = 6 ETH)
    const balBefore1 = await ethers.provider.getBalance(investor1.address);
    await fractional.connect(investor1).claimRent(fractionId);
    const balAfter1 = await ethers.provider.getBalance(investor1.address);
    expect(balAfter1 - balBefore1).to.be.gt(ethers.parseEther("5.9"));

    // 7. Investor2 claims rent (40% of 10 ETH = 4 ETH)
    const balBefore2 = await ethers.provider.getBalance(investor2.address);
    await fractional.connect(investor2).claimRent(fractionId);
    const balAfter2 = await ethers.provider.getBalance(investor2.address);
    expect(balAfter2 - balBefore2).to.be.gt(ethers.parseEther("3.9"));
  });

  it("Should enforce compliance on fraction transfers", async function () {
    const { registry, land, fractional, admin, investor1, investor2 } =
      await loadFixture(deployLandInfrastructure);

    // Mint and fractionalize
    const property = {
      propertyId: "LOT-002",
      jurisdiction: "US",
      areaSqMeters: 1000n,
      valuationUsd: ethers.parseEther("2000000"),
      metadataURI: "ipfs://Qm...",
      fractionalized: false,
    };
    await land.mintProperty(admin.address, property, "ipfs://land/2");

    await fractional.fractionalize(
      1n,
      await land.getAddress(),
      100n,
      ethers.parseEther("20000")
    );
    await fractional.mintFractions(1n, investor1.address, 50n);

    // Transfer fractions between whitelisted investors should work
    await fractional
      .connect(investor1)
      .safeTransferFrom(investor1.address, investor2.address, 1n, 10n, "0x");
    expect(await fractional.balanceOf(investor2.address, 1n)).to.equal(10n);

    // Blacklist investor2
    await registry.blacklistInvestor(investor2.address, "compliance issue");

    // Transfer to blacklisted should fail
    await expect(
      fractional
        .connect(investor1)
        .safeTransferFrom(
          investor1.address,
          investor2.address,
          1n,
          5n,
          "0x"
        )
    ).to.be.reverted;
  });
});
