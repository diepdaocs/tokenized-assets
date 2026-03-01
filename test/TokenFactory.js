import { expect } from "chai";
import hre from "hardhat";

describe("TokenFactory and Asset Tokens", function () {
  let TokenFactory, tokenFactory;
  let EquityToken, equityImpl;
  let BondToken, bondImpl;
  let DerivativeToken, derivativeImpl;
  let RealEstateToken, realEstateImpl;
  let owner, addr1, addr2;

  before(async function () {
    [owner, addr1, addr2] = await hre.ethers.getSigners();

    EquityToken = await hre.ethers.getContractFactory("EquityToken");
    equityImpl = await EquityToken.deploy();

    BondToken = await hre.ethers.getContractFactory("BondToken");
    bondImpl = await BondToken.deploy();

    DerivativeToken = await hre.ethers.getContractFactory("DerivativeToken");
    derivativeImpl = await DerivativeToken.deploy();

    RealEstateToken = await hre.ethers.getContractFactory("RealEstateToken");
    realEstateImpl = await RealEstateToken.deploy();

    TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
    tokenFactory = await hre.upgrades.deployProxy(TokenFactory, [
      await equityImpl.getAddress(),
      await bondImpl.getAddress(),
      await derivativeImpl.getAddress(),
      await realEstateImpl.getAddress(),
      owner.address
    ], { kind: 'uups' });
  });

  describe("EquityToken via Factory", function () {
    let equityProxyAddress;
    let equityContract;

    it("should create an Equity Token", async function () {
      const tx = await tokenFactory.createEquity("Apple Inc", "AAPL", 1000000);
      const receipt = await tx.wait();

      const filter = tokenFactory.filters.TokenCreated;
      const events = await tokenFactory.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      equityProxyAddress = events[0].args[0];

      equityContract = await hre.ethers.getContractAt("EquityToken", equityProxyAddress);

      expect(await equityContract.name()).to.equal("Apple Inc");
      expect(await equityContract.symbol()).to.equal("AAPL");
      expect(await equityContract.totalShares()).to.equal(1000000);
      expect(await equityContract.owner()).to.equal(owner.address);

      const decimals = await equityContract.decimals();
      const expectedSupply = BigInt(1000000) * (BigInt(10) ** BigInt(decimals));
      expect(await equityContract.totalSupply()).to.equal(expectedSupply);
      expect(await equityContract.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("BondToken via Factory", function () {
    let bondProxyAddress;
    let bondContract;

    it("should create a Bond Token", async function () {
      const tx = await tokenFactory.createBond("US Treasury", "USTB", 1000, 500, Math.floor(Date.now() / 1000) + 31536000, 15768000);
      const receipt = await tx.wait();

      const filter = tokenFactory.filters.TokenCreated;
      const events = await tokenFactory.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      bondProxyAddress = events[0].args[0];

      bondContract = await hre.ethers.getContractAt("BondToken", bondProxyAddress);

      expect(await bondContract.name()).to.equal("US Treasury");
      expect(await bondContract.symbol()).to.equal("USTB");
      expect(await bondContract.faceValue()).to.equal(1000);
      expect(await bondContract.couponRate()).to.equal(500);
      expect(await bondContract.owner()).to.equal(owner.address);
    });
  });

  describe("RealEstateToken via Factory", function () {
    let realEstateProxyAddress;
    let realEstateContract;

    it("should create a Real Estate Token", async function () {
      const tx = await tokenFactory.createRealEstate("Central Park", "CPARK");
      const receipt = await tx.wait();

      const filter = tokenFactory.filters.RealEstateCreated;
      const events = await tokenFactory.queryFilter(filter, receipt.blockNumber, receipt.blockNumber);
      realEstateProxyAddress = events[0].args[0];

      realEstateContract = await hre.ethers.getContractAt("RealEstateToken", realEstateProxyAddress);

      expect(await realEstateContract.name()).to.equal("Central Park");
      expect(await realEstateContract.symbol()).to.equal("CPARK");
      expect(await realEstateContract.owner()).to.equal(owner.address);
    });

    it("should allow owner to mint Real Estate NFTs", async function () {
      await realEstateContract.safeMint(addr1.address, "ipfs://test");
      expect(await realEstateContract.ownerOf(0)).to.equal(addr1.address);
      expect(await realEstateContract.tokenURI(0)).to.equal("ipfs://test");
    });
  });
});
