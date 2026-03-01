import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useTokenFactory } from '../hooks/useTokenFactory';
import {
  TokenFactoryABI,
  EquityTokenABI,
  BondTokenABI,
  LandTokenABI,
  AssetCategory,
  ASSET_CATEGORY_LABELS,
} from '../config/contracts';
import { getAddresses } from '../config/contracts';

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getCategoryColorClass(category: AssetCategory): string {
  switch (category) {
    case AssetCategory.EQUITY:
      return 'badge-equity';
    case AssetCategory.BOND:
      return 'badge-bond';
    case AssetCategory.LAND:
    case AssetCategory.FRACTIONAL_LAND:
      return 'badge-land';
    default:
      return 'badge-default';
  }
}

interface AssetInfoData {
  tokenAddress: string;
  category: AssetCategory;
  name: string;
  symbol: string;
  issuer: string;
  createdAt: bigint;
  active: boolean;
}

interface EquityDetails {
  cusip: string;
  totalSupply: bigint;
  totalShares: bigint;
  currentSnapshotId: bigint;
  dividendCheckpointCount: bigint;
}

interface BondDetails {
  faceValue: bigint;
  couponRateBps: bigint;
  couponInterval: bigint;
  maturityDate: bigint;
  issueDate: bigint;
  isMatured: boolean;
  totalSupply: bigint;
  totalCouponsPaid: bigint;
}

interface LandDetails {
  totalMinted: bigint;
}

export default function AssetDetail() {
  const { address: assetAddress } = useParams<{ address: string }>();
  const { signer, chainId, isConnected } = useWallet();
  const { getAssetAbi } = useTokenFactory(signer, chainId);

  const [assetInfo, setAssetInfo] = useState<AssetInfoData | null>(null);
  const [equityDetails, setEquityDetails] = useState<EquityDetails | null>(null);
  const [bondDetails, setBondDetails] = useState<BondDetails | null>(null);
  const [landDetails, setLandDetails] = useState<LandDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const loadAssetInfo = useCallback(async () => {
    if (!signer || !chainId || !assetAddress) return;

    const addresses = getAddresses(chainId);
    if (!addresses || addresses.tokenFactory === ethers.ZeroAddress) {
      setError('TokenFactory not available on this network.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const factoryContract = new ethers.Contract(
        addresses.tokenFactory,
        TokenFactoryABI,
        signer
      );

      const info = await factoryContract.getAssetInfo(assetAddress);
      const category = Number(info.category) as AssetCategory;

      const assetData: AssetInfoData = {
        tokenAddress: info.tokenAddress,
        category,
        name: info.name,
        symbol: info.symbol,
        issuer: info.issuer,
        createdAt: info.createdAt,
        active: info.active,
      };
      setAssetInfo(assetData);

      // Load category-specific details
      if (category === AssetCategory.EQUITY) {
        const equityContract = new ethers.Contract(assetAddress, EquityTokenABI, signer);
        const [cusip, totalSupply, totalShares, currentSnapshotId, dividendCheckpointCount] =
          await Promise.all([
            equityContract.cusip(),
            equityContract.totalSupply(),
            equityContract.totalShares(),
            equityContract.currentSnapshotId(),
            equityContract.dividendCheckpointCount(),
          ]);
        setEquityDetails({
          cusip,
          totalSupply,
          totalShares,
          currentSnapshotId,
          dividendCheckpointCount,
        });
      } else if (category === AssetCategory.BOND) {
        const bondContract = new ethers.Contract(assetAddress, BondTokenABI, signer);
        const [terms, isMatured, totalSupply, totalCouponsPaid] = await Promise.all([
          bondContract.bondTerms(),
          bondContract.isMatured(),
          bondContract.totalSupply(),
          bondContract.totalCouponsPaid(),
        ]);
        setBondDetails({
          faceValue: terms.faceValue,
          couponRateBps: terms.couponRateBps,
          couponInterval: terms.couponInterval,
          maturityDate: terms.maturityDate,
          issueDate: terms.issueDate,
          isMatured,
          totalSupply,
          totalCouponsPaid,
        });
      } else if (category === AssetCategory.LAND || category === AssetCategory.FRACTIONAL_LAND) {
        const landContract = new ethers.Contract(assetAddress, LandTokenABI, signer);
        const totalMinted = await landContract.totalMinted();
        setLandDetails({ totalMinted });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load asset details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [signer, chainId, assetAddress, getAssetAbi]);

  useEffect(() => {
    if (isConnected && signer) {
      loadAssetInfo();
    }
  }, [isConnected, signer, loadAssetInfo]);

  const handlePause = async () => {
    if (!signer || !assetAddress || !assetInfo) return;
    setTxStatus('Pausing token...');
    try {
      const abi = getAssetAbi(assetInfo.category);
      const contract = new ethers.Contract(assetAddress, abi, signer);
      const tx = await contract.pause();
      await tx.wait();
      setTxStatus('Token paused successfully.');
      loadAssetInfo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause token';
      setTxStatus(null);
      setError(message);
    }
  };

  const handleUnpause = async () => {
    if (!signer || !assetAddress || !assetInfo) return;
    setTxStatus('Unpausing token...');
    try {
      const abi = getAssetAbi(assetInfo.category);
      const contract = new ethers.Contract(assetAddress, abi, signer);
      const tx = await contract.unpause();
      await tx.wait();
      setTxStatus('Token unpaused successfully.');
      loadAssetInfo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpause token';
      setTxStatus(null);
      setError(message);
    }
  };

  const handleClaimCoupon = async () => {
    if (!signer || !assetAddress) return;
    setTxStatus('Claiming coupon...');
    try {
      const contract = new ethers.Contract(assetAddress, BondTokenABI, signer);
      const tx = await contract.claimCoupon();
      await tx.wait();
      setTxStatus('Coupon claimed successfully.');
      loadAssetInfo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim coupon';
      setTxStatus(null);
      setError(message);
    }
  };

  const handleRedeem = async () => {
    if (!signer || !assetAddress) return;
    setTxStatus('Redeeming bond...');
    try {
      const contract = new ethers.Contract(assetAddress, BondTokenABI, signer);
      const tx = await contract.redeem();
      await tx.wait();
      setTxStatus('Bond redeemed successfully.');
      loadAssetInfo();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to redeem bond';
      setTxStatus(null);
      setError(message);
    }
  };

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Asset Detail</h1>
        </div>
        <div className="empty-state">
          <p>Connect your wallet to view asset details.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Asset Detail</h1>
        </div>
        <div className="alert alert-info">Loading asset details...</div>
      </div>
    );
  }

  if (error && !assetInfo) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Asset Detail</h1>
        </div>
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
        <Link to="/" className="btn btn-outline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!assetInfo) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Asset Detail</h1>
        </div>
        <div className="empty-state">
          <p>Asset not found.</p>
          <Link to="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>
          Back to Dashboard
        </Link>
        <h1 className="page-title">{assetInfo.name}</h1>
        <p className="page-subtitle">
          <span className={`badge ${getCategoryColorClass(assetInfo.category)}`}>
            {ASSET_CATEGORY_LABELS[assetInfo.category]}
          </span>
          {assetInfo.active ? (
            <span className="badge badge-active" style={{ marginLeft: 8 }}>Active</span>
          ) : (
            <span className="badge badge-inactive" style={{ marginLeft: 8 }}>Inactive</span>
          )}
        </p>
      </div>

      {/* Status Messages */}
      {txStatus && <div className="alert alert-info">{txStatus}</div>}
      {error && <div className="alert alert-error"><strong>Error:</strong> {error}</div>}

      {/* Basic Info */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Symbol</div>
          <div className="stat-value">{assetInfo.symbol}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Token Address</div>
          <div className="stat-value stat-value-sm">{formatAddress(assetInfo.tokenAddress)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Issuer</div>
          <div className="stat-value stat-value-sm">{formatAddress(assetInfo.issuer)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Created</div>
          <div className="stat-value stat-value-sm">
            {new Date(Number(assetInfo.createdAt) * 1000).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Equity Details */}
      {assetInfo.category === AssetCategory.EQUITY && equityDetails && (
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Equity Details</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">CUSIP</div>
              <div className="stat-value stat-value-sm">{equityDetails.cusip}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Supply</div>
              <div className="stat-value">{equityDetails.totalSupply.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Shares</div>
              <div className="stat-value">{equityDetails.totalShares.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Snapshots</div>
              <div className="stat-value">{equityDetails.currentSnapshotId.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Dividend Checkpoints</div>
              <div className="stat-value">{equityDetails.dividendCheckpointCount.toString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn btn-outline btn-sm" onClick={handlePause}>
              Pause
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleUnpause}>
              Unpause
            </button>
          </div>
        </div>
      )}

      {/* Bond Details */}
      {assetInfo.category === AssetCategory.BOND && bondDetails && (
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Bond Details</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Face Value (wei)</div>
              <div className="stat-value stat-value-sm">{bondDetails.faceValue.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Coupon Rate (bps)</div>
              <div className="stat-value">{bondDetails.couponRateBps.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Coupon Interval</div>
              <div className="stat-value stat-value-sm">
                {(Number(bondDetails.couponInterval) / 86400).toFixed(0)} days
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Maturity Date</div>
              <div className="stat-value stat-value-sm">
                {new Date(Number(bondDetails.maturityDate) * 1000).toLocaleDateString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Issue Date</div>
              <div className="stat-value stat-value-sm">
                {new Date(Number(bondDetails.issueDate) * 1000).toLocaleDateString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Matured</div>
              <div className="stat-value">{bondDetails.isMatured ? 'Yes' : 'No'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Supply</div>
              <div className="stat-value">{bondDetails.totalSupply.toString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Coupons Paid</div>
              <div className="stat-value stat-value-sm">{bondDetails.totalCouponsPaid.toString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={handleClaimCoupon}>
              Claim Coupon
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRedeem}
              disabled={!bondDetails.isMatured}
            >
              Redeem Bond
            </button>
            <button className="btn btn-outline btn-sm" onClick={handlePause}>
              Pause
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleUnpause}>
              Unpause
            </button>
          </div>
        </div>
      )}

      {/* Land Details */}
      {(assetInfo.category === AssetCategory.LAND ||
        assetInfo.category === AssetCategory.FRACTIONAL_LAND) &&
        landDetails && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Land Details</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Minted Properties</div>
                <div className="stat-value">{landDetails.totalMinted.toString()}</div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
