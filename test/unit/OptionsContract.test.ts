import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { increaseTime, getBlockTimestamp } from "../helpers/time";
import { MOCK_PRICE, MOCK_DECIMALS } from "../helpers/constants";

describe("OptionsContract", function () {
  async function deployOptionsFixture() {
    const [admin, issuer, writer, buyer, other] = await ethers.getSigners();

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

    // Whitelist accounts
    await registry.whitelistInvestor(issuer.address);
    await registry.whitelistInvestor(writer.address);
    await registry.whitelistInvestor(buyer.address);

    // Deploy OptionsContract
    const timestamp = await getBlockTimestamp();
    const optionsTerms = {
      underlyingAsset: ethers.ZeroAddress,
      strikePrice: 200000000000n, // $2000 with 8 decimals
      expirationDate: BigInt(timestamp + 86400 * 30),
      contractSize: 1n,
      optionType: 0, // CALL
      premiumPerContract: ethers.parseEther("0.1"),
      priceId: priceId,
    };

    const OptionsContract = await ethers.getContractFactory("OptionsContract");
    const options = await upgrades.deployProxy(OptionsContract, [
      "ETH Call",
      "ETHC",
      await registry.getAddress(),
      await oracle.getAddress(),
      issuer.address,
      optionsTerms,
    ]);
    await options.waitForDeployment();

    return {
      options,
      registry,
      oracle,
      priceFeed,
      admin,
      issuer,
      writer,
      buyer,
      other,
      priceId,
      optionsTerms,
    };
  }

  describe("writeOption", function () {
    it("should allow writer to deposit collateral", async function () {
      const { options, writer, optionsTerms } = await loadFixture(
        deployOptionsFixture
      );

      // Required collateral = strikePrice * contractSize * numContracts
      // = 200000000000 * 1 * 1 = 200000000000
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;

      const tx = await options
        .connect(writer)
        .writeOption(1, { value: collateral });

      await expect(tx)
        .to.emit(options, "OptionWritten")
        .withArgs(writer.address, 1, collateral);

      expect(await options.writerCollateral(writer.address)).to.equal(
        collateral
      );
      expect(await options.totalCollateral()).to.equal(collateral);
    });

    it("should revert with insufficient collateral", async function () {
      const { options, writer } = await loadFixture(deployOptionsFixture);

      await expect(
        options.connect(writer).writeOption(1, { value: 1000n })
      ).to.be.revertedWithCustomError(options, "InsufficientMargin");
    });
  });

  describe("buyOption", function () {
    it("should allow buyer to pay premium and open position", async function () {
      const { options, writer, buyer, optionsTerms } = await loadFixture(
        deployOptionsFixture
      );

      // Writer deposits collateral first
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      // Buyer pays premium
      const premium = optionsTerms.premiumPerContract * 1n;
      const tx = await options
        .connect(buyer)
        .buyOption(1, { value: premium });

      await expect(tx).to.emit(options, "OptionBought");

      const position = await options.positions(1);
      expect(position.holder).to.equal(buyer.address);
      expect(position.isLong).to.be.true;
      expect(position.size).to.equal(1n);
      expect(position.active).to.be.true;

      expect(await options.totalOptionsBought()).to.equal(1n);
    });

    it("should revert with insufficient premium", async function () {
      const { options, buyer } = await loadFixture(deployOptionsFixture);

      await expect(
        options.connect(buyer).buyOption(1, { value: 1n })
      ).to.be.revertedWithCustomError(options, "InvalidParameter");
    });
  });

  describe("exercise", function () {
    it("should exercise in-the-money call (price > strike)", async function () {
      const { options, writer, buyer, priceFeed, optionsTerms } =
        await loadFixture(deployOptionsFixture);

      // Writer deposits collateral
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      // Buyer buys option
      const premium = optionsTerms.premiumPerContract * 1n;
      await options.connect(buyer).buyOption(1, { value: premium });

      // Price goes to $2500 (250000000000 with 8 decimals) -> ITM
      await priceFeed.setPrice(250000000000n);

      const balanceBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await options.connect(buyer).exercise(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx).to.emit(options, "OptionExercised");

      const balanceAfter = await ethers.provider.getBalance(buyer.address);

      // Intrinsic value = (2500 - 2000) * contractSize = 50000000000 * 1 = 50000000000
      // Payout = intrinsicValue * numContracts * contractSize = 50000000000 * 1 * 1
      const expectedPayout = 50000000000n;
      const balanceChange = balanceAfter - balanceBefore + gasUsed;
      expect(balanceChange).to.equal(expectedPayout);

      const position = await options.positions(1);
      expect(position.active).to.be.false;
    });

    it("should revert if out of the money", async function () {
      const { options, writer, buyer, priceFeed, optionsTerms } =
        await loadFixture(deployOptionsFixture);

      // Writer deposits collateral
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      // Buyer buys option
      const premium = optionsTerms.premiumPerContract * 1n;
      await options.connect(buyer).buyOption(1, { value: premium });

      // Price stays below strike ($1500 < $2000)
      await priceFeed.setPrice(150000000000n);

      await expect(
        options.connect(buyer).exercise(1)
      ).to.be.revertedWithCustomError(options, "InvalidParameter");
    });

    it("should revert after expiration", async function () {
      const { options, writer, buyer, priceFeed, optionsTerms } =
        await loadFixture(deployOptionsFixture);

      // Writer deposits collateral
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      // Buyer buys option
      const premium = optionsTerms.premiumPerContract * 1n;
      await options.connect(buyer).buyOption(1, { value: premium });

      // Move price ITM
      await priceFeed.setPrice(250000000000n);

      // Advance past expiration
      await increaseTime(86400 * 31);

      await expect(
        options.connect(buyer).exercise(1)
      ).to.be.revertedWithCustomError(options, "ContractExpired");
    });
  });

  describe("expireWorthless", function () {
    it("should expire after expiration date", async function () {
      const { options, issuer, priceFeed } = await loadFixture(
        deployOptionsFixture
      );

      // Advance past expiration
      await increaseTime(86400 * 31);

      // Update price feed to avoid staleness
      await priceFeed.setPrice(MOCK_PRICE);

      const tx = await options.connect(issuer).expireWorthless();
      await expect(tx).to.emit(options, "OptionsExpired");
    });

    it("should revert before expiration", async function () {
      const { options, issuer } = await loadFixture(deployOptionsFixture);

      await expect(
        options.connect(issuer).expireWorthless()
      ).to.be.revertedWithCustomError(options, "ContractNotExpired");
    });
  });

  describe("withdrawCollateral", function () {
    it("should allow writer to withdraw after expiration", async function () {
      const { options, issuer, writer, priceFeed, optionsTerms } =
        await loadFixture(deployOptionsFixture);

      // Writer deposits collateral
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      // Advance past expiration
      await increaseTime(86400 * 31);
      await priceFeed.setPrice(MOCK_PRICE);

      // Expire the options
      await options.connect(issuer).expireWorthless();

      const balanceBefore = await ethers.provider.getBalance(writer.address);

      const tx = await options.connect(writer).withdrawCollateral();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(writer.address);

      const balanceChange = balanceAfter - balanceBefore + gasUsed;
      expect(balanceChange).to.equal(collateral);

      expect(await options.writerCollateral(writer.address)).to.equal(0n);
    });

    it("should revert if not expired", async function () {
      const { options, writer, optionsTerms } = await loadFixture(
        deployOptionsFixture
      );

      // Writer deposits collateral
      const collateral =
        optionsTerms.strikePrice * optionsTerms.contractSize * 1n;
      await options.connect(writer).writeOption(1, { value: collateral });

      await expect(
        options.connect(writer).withdrawCollateral()
      ).to.be.revertedWithCustomError(options, "AssetNotActive");
    });
  });

  describe("isInTheMoney", function () {
    it("should return true when call is ITM (price > strike)", async function () {
      const { options, priceFeed } = await loadFixture(deployOptionsFixture);

      // Price above strike
      await priceFeed.setPrice(250000000000n);
      expect(await options.isInTheMoney()).to.be.true;
    });

    it("should return false when call is OTM (price < strike)", async function () {
      const { options, priceFeed } = await loadFixture(deployOptionsFixture);

      // Price below strike
      await priceFeed.setPrice(150000000000n);
      expect(await options.isInTheMoney()).to.be.false;
    });
  });

  describe("intrinsicValue", function () {
    it("should return correct value for ITM call", async function () {
      const { options, priceFeed } = await loadFixture(deployOptionsFixture);

      // Price = $2500, Strike = $2000
      await priceFeed.setPrice(250000000000n);

      // IV = (2500 - 2000) * contractSize = 50000000000 * 1
      const iv = await options.intrinsicValue();
      expect(iv).to.equal(50000000000n);
    });

    it("should return 0 for OTM call", async function () {
      const { options, priceFeed } = await loadFixture(deployOptionsFixture);

      // Price = $1500, Strike = $2000 -> OTM
      await priceFeed.setPrice(150000000000n);

      const iv = await options.intrinsicValue();
      expect(iv).to.equal(0n);
    });
  });
});
