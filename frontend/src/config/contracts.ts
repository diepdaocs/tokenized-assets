// ============================================================
// Contract ABIs (simplified — key function signatures only)
// ============================================================

export const TokenFactoryABI = [
  'function deployEquity(string calldata name, string calldata symbol, string calldata cusip, uint256 totalShares) external returns (address)',
  'function deployBond(string calldata name, string calldata symbol, tuple(uint256 faceValue, uint256 couponRateBps, uint256 couponInterval, uint256 maturityDate, uint256 issueDate) terms) external returns (address)',
  'function deployLandToken(string calldata name, string calldata symbol) external returns (address)',
  'function getDeployedAssets() external view returns (tuple(address tokenAddress, uint8 category, string name, string symbol, address issuer, uint256 createdAt, bool active)[])',
  'function getAssetsByCategory(uint8 category) external view returns (address[])',
  'function getAssetInfo(address token) external view returns (tuple(address tokenAddress, uint8 category, string name, string symbol, address issuer, uint256 createdAt, bool active))',
  'function isDeployedAsset(address token) external view returns (bool)',
  'function deployedAssetsCount() external view returns (uint256)',
  'function complianceRegistry() external view returns (address)',
  'function priceOracle() external view returns (address)',
  'event AssetDeployed(address indexed tokenAddress, uint8 indexed category, string name, string symbol, address issuer)',
] as const;

export const ComplianceRegistryABI = [
  'function whitelistInvestor(address investor) external',
  'function blacklistInvestor(address investor, string calldata reason) external',
  'function removeFromBlacklist(address investor) external',
  'function setAccreditedStatus(address investor, bool status, uint256 expiryDate) external',
  'function batchWhitelist(address[] calldata investors) external',
  'function isWhitelisted(address investor) external view returns (bool)',
  'function isBlacklisted(address investor) external view returns (bool)',
  'function isAccredited(address investor) external view returns (bool)',
  'function canTransfer(address from, address to, uint256 amount) external view returns (bool)',
  'function getInvestorStatus(address investor) external view returns (uint8)',
  'function getBlacklistReason(address investor) external view returns (string)',
  'function whitelistedCount() external view returns (uint256)',
  'event InvestorWhitelisted(address indexed investor, uint256 timestamp)',
  'event InvestorBlacklisted(address indexed investor, string reason)',
  'event InvestorStatusUpdated(address indexed investor, uint8 status)',
  'event AccreditedStatusChanged(address indexed investor, bool status, uint256 expiryDate)',
] as const;

export const EquityTokenABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function cusip() external view returns (string)',
  'function totalShares() external view returns (uint256)',
  'function issuer() external view returns (address)',
  'function assetCategory() external view returns (uint8)',
  'function createdAt() external view returns (uint256)',
  'function snapshot() external returns (uint256)',
  'function currentSnapshotId() external view returns (uint256)',
  'function distributeDividend(uint256 snapshotId) external payable',
  'function claimDividend(uint256 checkpointIndex) external',
  'function dividendCheckpointCount() external view returns (uint256)',
  'function dividendCheckpoints(uint256 index) external view returns (uint256 snapshotId, uint256 totalAmount, uint256 claimedAmount, uint256 blockTimestamp)',
  'function dividendClaimed(uint256 checkpointIndex, address holder) external view returns (bool)',
  'function balanceAtSnapshot(address account, uint256 snapshotId) external view returns (uint256)',
  'function delegateVotes(address delegatee) external',
  'function getVotingPower(address account, uint256 snapshotId) external view returns (uint256)',
  'function pause() external',
  'function unpause() external',
  'event SnapshotCreated(uint256 indexed snapshotId)',
  'event DividendDistributed(uint256 indexed checkpointIndex, uint256 snapshotId, uint256 amount)',
  'event DividendClaimed(uint256 indexed checkpointIndex, address indexed holder, uint256 amount)',
] as const;

export const BondTokenABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function issuer() external view returns (address)',
  'function assetCategory() external view returns (uint8)',
  'function createdAt() external view returns (uint256)',
  'function bondTerms() external view returns (uint256 faceValue, uint256 couponRateBps, uint256 couponInterval, uint256 maturityDate, uint256 issueDate)',
  'function claimCoupon() external',
  'function redeem() external',
  'function accruedCoupon(address holder) external view returns (uint256)',
  'function timeToMaturity() external view returns (uint256)',
  'function couponPeriodsElapsed() external view returns (uint256)',
  'function isMatured() external view returns (bool)',
  'function matured() external view returns (bool)',
  'function totalCouponsPaid() external view returns (uint256)',
  'function lastCouponClaimed(address holder) external view returns (uint256)',
  'function fundCoupons() external payable',
  'function fundRedemption() external payable',
  'function pause() external',
  'function unpause() external',
  'event CouponClaimed(address indexed holder, uint256 amount)',
  'event BondRedeemed(address indexed holder, uint256 amount)',
  'event BondMatured(uint256 maturityDate)',
] as const;

export const LandTokenABI = [
  'function mintProperty(address to, tuple(string propertyId, string jurisdiction, uint256 areaSqMeters, uint256 valuationUsd, string metadataURI, bool fractionalized) property, string tokenURI_) external returns (uint256)',
  'function getProperty(uint256 tokenId) external view returns (tuple(string propertyId, string jurisdiction, uint256 areaSqMeters, uint256 valuationUsd, string metadataURI, bool fractionalized))',
  'function totalMinted() external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function fractionalize(uint256 tokenId, address fractionalContract) external',
  'function updateValuation(uint256 tokenId, uint256 newValuation) external',
  'function fractionalContracts(uint256 tokenId) external view returns (address)',
  'event LandMinted(uint256 indexed tokenId, address indexed owner, string propertyId)',
  'event LandFractionalized(uint256 indexed tokenId, address indexed fractionalContract)',
  'event ValuationUpdated(uint256 indexed tokenId, uint256 newValuation)',
] as const;

// ============================================================
// Asset category enum (mirrors Solidity AssetTypes.AssetCategory)
// ============================================================

export enum AssetCategory {
  EQUITY = 0,
  BOND = 1,
  DERIVATIVE_FUTURE = 2,
  DERIVATIVE_OPTION = 3,
  LAND = 4,
  FRACTIONAL_LAND = 5,
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  [AssetCategory.EQUITY]: 'Equity',
  [AssetCategory.BOND]: 'Bond',
  [AssetCategory.DERIVATIVE_FUTURE]: 'Futures',
  [AssetCategory.DERIVATIVE_OPTION]: 'Options',
  [AssetCategory.LAND]: 'Land',
  [AssetCategory.FRACTIONAL_LAND]: 'Fractional Land',
};

// ============================================================
// Investor status enum (mirrors Solidity AssetTypes.InvestorStatus)
// ============================================================

export enum InvestorStatus {
  NONE = 0,
  PENDING = 1,
  WHITELISTED = 2,
  BLACKLISTED = 3,
}

export const INVESTOR_STATUS_LABELS: Record<InvestorStatus, string> = {
  [InvestorStatus.NONE]: 'None',
  [InvestorStatus.PENDING]: 'Pending',
  [InvestorStatus.WHITELISTED]: 'Whitelisted',
  [InvestorStatus.BLACKLISTED]: 'Blacklisted',
};

// ============================================================
// Deployed contract addresses per network
// Update these after deployment
// ============================================================

export interface DeployedAddresses {
  tokenFactory: string;
  complianceRegistry: string;
  priceOracle: string;
}

export const DEPLOYED_ADDRESSES: Record<number, DeployedAddresses> = {
  31337: {
    tokenFactory: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    complianceRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    priceOracle: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  },
  11155111: {
    tokenFactory: '0x0000000000000000000000000000000000000000',
    complianceRegistry: '0x0000000000000000000000000000000000000000',
    priceOracle: '0x0000000000000000000000000000000000000000',
  },
};

export function getAddresses(chainId: number): DeployedAddresses | undefined {
  return DEPLOYED_ADDRESSES[chainId];
}

// ============================================================
// Asset info type used in the frontend
// ============================================================

export interface AssetInfo {
  tokenAddress: string;
  category: AssetCategory;
  name: string;
  symbol: string;
  issuer: string;
  createdAt: bigint;
  active: boolean;
}

export interface BondTerms {
  faceValue: bigint;
  couponRateBps: bigint;
  couponInterval: bigint;
  maturityDate: bigint;
  issueDate: bigint;
}

export interface LandProperty {
  propertyId: string;
  jurisdiction: string;
  areaSqMeters: bigint;
  valuationUsd: bigint;
  metadataURI: string;
  fractionalized: boolean;
}
