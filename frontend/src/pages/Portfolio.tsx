import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useTokenFactory } from '../hooks/useTokenFactory';
import { AssetCategory } from '../config/contracts';

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

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface PortfolioAsset {
  tokenAddress: string;
  category: AssetCategory;
  categoryLabel: string;
  name: string;
  symbol: string;
  balance: bigint;
  active: boolean;
}

export default function Portfolio() {
  const { address, isConnected, signer, chainId } = useWallet();
  const { assets, loading: assetsLoading, error: assetsError, loadAssets, getAssetAbi } =
    useTokenFactory(signer, chainId);

  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    if (!signer || !address || assets.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const holdings: PortfolioAsset[] = [];

      for (const asset of assets) {
        try {
          const abi = getAssetAbi(asset.category);
          const contract = new ethers.Contract(asset.tokenAddress, abi, signer);
          const balance: bigint = await contract.balanceOf(address);

          if (balance > 0n) {
            holdings.push({
              tokenAddress: asset.tokenAddress,
              category: asset.category,
              categoryLabel: asset.categoryLabel,
              name: asset.name,
              symbol: asset.symbol,
              balance,
              active: asset.active,
            });
          }
        } catch {
          // Skip assets where balanceOf fails (e.g., incompatible contract)
        }
      }

      setPortfolioAssets(holdings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load portfolio';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [signer, address, assets, getAssetAbi]);

  useEffect(() => {
    if (isConnected && signer) {
      loadAssets();
    }
  }, [isConnected, signer, loadAssets]);

  useEffect(() => {
    if (assets.length > 0 && isConnected && signer) {
      loadPortfolio();
    }
  }, [assets, isConnected, signer, loadPortfolio]);

  const isLoading = assetsLoading || loading;

  // Count holdings by category
  const equityCount = portfolioAssets.filter((a) => a.category === AssetCategory.EQUITY).length;
  const bondCount = portfolioAssets.filter((a) => a.category === AssetCategory.BOND).length;
  const landCount = portfolioAssets.filter(
    (a) => a.category === AssetCategory.LAND || a.category === AssetCategory.FRACTIONAL_LAND
  ).length;

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Portfolio</h1>
        </div>
        <div className="empty-state">
          <p>Connect your wallet to view your portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Portfolio</h1>
        <p className="page-subtitle">Your tokenized asset holdings</p>
      </div>

      {/* Portfolio Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Holdings</div>
          <div className="stat-value">{portfolioAssets.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Equity Tokens</div>
          <div className="stat-value">{equityCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bond Tokens</div>
          <div className="stat-value">{bondCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Land Tokens</div>
          <div className="stat-value">{landCount}</div>
        </div>
      </div>

      {/* Asset Holdings */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Holdings</h2>
          <button
            className="btn btn-outline btn-sm"
            onClick={loadPortfolio}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {(assetsError || error) && (
          <div className="alert alert-error">
            <strong>Error:</strong> {assetsError || error}
          </div>
        )}

        {isLoading && (
          <div className="alert alert-info">Loading your portfolio...</div>
        )}

        {!isLoading && !error && portfolioAssets.length === 0 && (
          <div className="empty-state">
            <p>You do not hold any tokenized assets yet.</p>
            <Link to="/deploy" className="btn btn-primary">
              Deploy Your First Asset
            </Link>
          </div>
        )}

        {portfolioAssets.length > 0 && (
          <div className="asset-grid">
            {portfolioAssets.map((asset) => (
              <Link
                key={asset.tokenAddress}
                to={`/asset/${asset.tokenAddress}`}
                className="asset-card"
              >
                <div className="asset-card-header">
                  <span className={`badge ${getCategoryColorClass(asset.category)}`}>
                    {asset.categoryLabel}
                  </span>
                  {asset.active ? (
                    <span className="badge badge-active">Active</span>
                  ) : (
                    <span className="badge badge-inactive">Inactive</span>
                  )}
                </div>
                <h3 className="asset-card-name">{asset.name}</h3>
                <p className="asset-card-symbol">{asset.symbol}</p>
                <div className="asset-card-details">
                  <div className="asset-card-detail">
                    <span className="detail-label">Balance</span>
                    <span className="detail-value">{asset.balance.toString()}</span>
                  </div>
                  <div className="asset-card-detail">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{formatAddress(asset.tokenAddress)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
