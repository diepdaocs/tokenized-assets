import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ROLES, MOCK_PRICE, MOCK_DECIMALS, STALENESS_THRESHOLD } from "../helpers/constants";

describe("EquityToken", function () {
  async function deployEquityFixture() {
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

    // Deploy EquityToken
    const EquityToken = await ethers.getContractFactory("EquityToken");
    const equity = await upgrades.deployProxy(
      EquityToken,
      [
        "Test Equity",
        "TEQ",
        await registry.getAddress(),
        await oracle.getAddress(),
        issuer.address,
        "CUSIP123",
        1000000n,
      ],
      { unsafeAllow: ["external-library-linking", "constructor"] }
    );
    await equity.waitForDeployment();

    return { equity, registry, oracle, priceFeed, admin, issuer, investor1, investor2, outsider };
  }

  describe("Initialization", function () {
    it("should initialize with the correct name", async function () {
      const { equity } = await loadFixture(deployEquityFixture);
      expect(await equity.name()).to.equal("Test Equity");
    });

    it("should initialize with the correct symbol", async function () {
      const { equity } = await loadFixture(deployEquityFixture);
      expect(await equity.symbol()).to.equal("TEQ");
    });

    it("should initialize with the correct CUSIP", async function () {
      const { equity } = await loadFixture(deployEquityFixture);
      expect(await equity.cusip()).to.equal("CUSIP123");
    });

    it("should initialize with the correct totalShares", async function () {
      const { equity } = await loadFixture(deployEquityFixture);
      expect(await equity.totalShares()).to.equal(1000000n);
    });

    it("should grant ISSUER_ROLE to the issuer", async function () {
      const { equity, issuer } = await loadFixture(deployEquityFixture);
      expect(await equity.hasRole(ROLES.ISSUER, issuer.address)).to.be.true;
    });
  });

  describe("mint", function () {
    it("should mint tokens with ISSUER_ROLE", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      expect(await equity.balanceOf(investor1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should revert when minting without ISSUER_ROLE", async function () {
      const { equity, outsider, investor1 } = await loadFixture(deployEquityFixture);

      await expect(
        equity.connect(outsider).mint(investor1.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });
  });

  describe("Transfer", function () {
    it("should allow transfer between whitelisted addresses", async function () {
      const { equity, issuer, investor1, investor2 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(investor1).transfer(investor2.address, ethers.parseEther("500"));

      expect(await equity.balanceOf(investor1.address)).to.equal(ethers.parseEther("500"));
      expect(await equity.balanceOf(investor2.address)).to.equal(ethers.parseEther("500"));
    });

    it("should revert if sender is not whitelisted", async function () {
      const { equity, issuer, investor1, outsider, registry, admin } =
        await loadFixture(deployEquityFixture);

      // Mint to investor1 (whitelisted)
      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));

      // Whitelist outsider temporarily, transfer to them, then blacklist
      await registry.connect(admin).whitelistInvestor(outsider.address);
      await equity.connect(investor1).transfer(outsider.address, ethers.parseEther("500"));

      // Remove outsider from whitelist via blacklist
      await registry.connect(admin).blacklistInvestor(outsider.address, "testing");

      // Outsider trying to transfer should revert
      await expect(
        equity.connect(outsider).transfer(investor1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(equity, "TransferRestricted");
    });

    it("should revert if receiver is not whitelisted", async function () {
      const { equity, issuer, investor1, outsider } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));

      // Outsider is not whitelisted
      await expect(
        equity.connect(investor1).transfer(outsider.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(equity, "TransferRestricted");
    });
  });

  describe("snapshot", function () {
    it("should create a snapshot and return the snapshot ID", async function () {
      const { equity, issuer } = await loadFixture(deployEquityFixture);

      const tx = await equity.connect(issuer).snapshot();
      const receipt = await tx.wait();
      expect(await equity.currentSnapshotId()).to.equal(1);
    });

    it("should emit SnapshotCreated event", async function () {
      const { equity, issuer } = await loadFixture(deployEquityFixture);

      await expect(equity.connect(issuer).snapshot())
        .to.emit(equity, "SnapshotCreated")
        .withArgs(1);
    });

    it("should record balances at snapshot time", async function () {
      const { equity, issuer, investor1, investor2 } = await loadFixture(deployEquityFixture);

      // Mint tokens
      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));

      // Take snapshot
      await equity.connect(issuer).snapshot();

      // Transfer tokens after snapshot
      await equity.connect(investor1).transfer(investor2.address, ethers.parseEther("500"));

      // Balance at snapshot should reflect pre-transfer state
      expect(await equity.balanceAtSnapshot(investor1.address, 1)).to.equal(
        ethers.parseEther("1000")
      );
      expect(await equity.balanceAtSnapshot(investor2.address, 1)).to.equal(0);
    });
  });

  describe("distributeDividend", function () {
    it("should distribute ETH dividends tied to a snapshot", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      // Mint tokens and create snapshot
      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(issuer).snapshot();

      // Distribute dividend
      const dividendAmount = ethers.parseEther("10");
      await expect(
        equity.connect(issuer).distributeDividend(1, { value: dividendAmount })
      )
        .to.emit(equity, "DividendDistributed")
        .withArgs(0, 1, dividendAmount);

      expect(await equity.dividendCheckpointCount()).to.equal(1);
    });

    it("should revert with zero value", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(issuer).snapshot();

      await expect(
        equity.connect(issuer).distributeDividend(1, { value: 0 })
      ).to.be.revertedWithCustomError(equity, "InvalidParameter");
    });

    it("should revert with invalid snapshot ID", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(issuer).snapshot();

      await expect(
        equity.connect(issuer).distributeDividend(99, { value: ethers.parseEther("10") })
      ).to.be.revertedWithCustomError(equity, "InvalidParameter");
    });
  });

  describe("claimDividend", function () {
    it("should allow holder to claim proportional share of dividend", async function () {
      const { equity, issuer, investor1, investor2 } = await loadFixture(deployEquityFixture);

      // Mint: investor1 gets 750, investor2 gets 250
      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("750"));
      await equity.connect(issuer).mint(investor2.address, ethers.parseEther("250"));

      // Take snapshot
      await equity.connect(issuer).snapshot();

      // Distribute 10 ETH dividend
      const dividendAmount = ethers.parseEther("10");
      await equity.connect(issuer).distributeDividend(1, { value: dividendAmount });

      // investor1 claims: should get 75% of 10 ETH = 7.5 ETH
      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      const tx = await equity.connect(investor1).claimDividend(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(investor1.address);

      const received = balanceAfter - balanceBefore + gasUsed;
      expect(received).to.equal(ethers.parseEther("7.5"));
    });

    it("should emit DividendClaimed event", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(issuer).snapshot();
      await equity.connect(issuer).distributeDividend(1, { value: ethers.parseEther("10") });

      await expect(equity.connect(investor1).claimDividend(0))
        .to.emit(equity, "DividendClaimed")
        .withArgs(0, investor1.address, ethers.parseEther("10"));
    });

    it("should not allow claiming the same dividend twice", async function () {
      const { equity, issuer, investor1 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));
      await equity.connect(issuer).snapshot();
      await equity.connect(issuer).distributeDividend(1, { value: ethers.parseEther("10") });

      await equity.connect(investor1).claimDividend(0);

      await expect(
        equity.connect(investor1).claimDividend(0)
      ).to.be.revertedWithCustomError(equity, "AlreadyClaimed");
    });
  });

  describe("delegateVotes", function () {
    it("should set a delegate for the caller", async function () {
      const { equity, investor1, investor2 } = await loadFixture(deployEquityFixture);

      await equity.connect(investor1).delegateVotes(investor2.address);
      expect(await equity.voteDelegates(investor1.address)).to.equal(investor2.address);
    });

    it("should emit VoteDelegated event", async function () {
      const { equity, investor1, investor2 } = await loadFixture(deployEquityFixture);

      await expect(equity.connect(investor1).delegateVotes(investor2.address))
        .to.emit(equity, "VoteDelegated")
        .withArgs(investor1.address, investor2.address);
    });

    it("should revert when delegating to zero address", async function () {
      const { equity, investor1 } = await loadFixture(deployEquityFixture);

      await expect(
        equity.connect(investor1).delegateVotes(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(equity, "InvalidParameter");
    });
  });

  describe("pause/unpause", function () {
    it("should block transfers when paused", async function () {
      const { equity, issuer, investor1, investor2 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));

      // Pause the contract (issuer has OPERATOR_ROLE)
      await equity.connect(issuer).pause();

      await expect(
        equity.connect(investor1).transfer(investor2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(equity, "EnforcedPause");
    });

    it("should allow transfers after unpause", async function () {
      const { equity, issuer, investor1, investor2 } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).mint(investor1.address, ethers.parseEther("1000"));

      await equity.connect(issuer).pause();
      await equity.connect(issuer).unpause();

      await equity.connect(investor1).transfer(investor2.address, ethers.parseEther("100"));
      expect(await equity.balanceOf(investor2.address)).to.equal(ethers.parseEther("100"));
    });

    it("should revert pause without OPERATOR_ROLE", async function () {
      const { equity, outsider } = await loadFixture(deployEquityFixture);

      await expect(equity.connect(outsider).pause()).to.be.reverted;
    });

    it("should revert unpause without OPERATOR_ROLE", async function () {
      const { equity, issuer, outsider } = await loadFixture(deployEquityFixture);

      await equity.connect(issuer).pause();
      await expect(equity.connect(outsider).unpause()).to.be.reverted;
    });
  });
});
