import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useTokenFactory } from '../hooks/useTokenFactory';
import { AssetCategory } from '../config/contracts';
import { getChainConfig, getExplorerUrl } from '../config/chains';

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

export default function Dashboard() {
  const { address, chainId, isConnected, signer } = useWallet();
  const { assets, loading, error, loadAssets } = useTokenFactory(signer, chainId);

  const chainConfig = chainId ? getChainConfig(chainId) : null;

  useEffect(() => {
    if (isConnected && signer) {
      loadAssets();
    }
  }, [isConnected, signer, loadAssets]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of tokenized assets on the platform</p>
      </div>

      {/* Wallet Info Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Wallet Status</div>
          <div className="stat-value">{isConnected ? 'Connected' : 'Disconnected'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Address</div>
          <div className="stat-value stat-value-sm">
            {address ? formatAddress(address) : '--'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Network</div>
          <div className="stat-value stat-value-sm">
            {chainConfig ? chainConfig.name : '--'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deployed Assets</div>
          <div className="stat-value">{assets.length}</div>
        </div>
      </div>

      {/* Asset List */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Deployed Assets</h2>
          <button className="btn btn-outline btn-sm" onClick={loadAssets} disabled={loading || !isConnected}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {!isConnected && (
          <div className="empty-state">
            <p>Connect your wallet to view deployed assets.</p>
          </div>
        )}

        {isConnected && error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isConnected && !loading && !error && assets.length === 0 && (
          <div className="empty-state">
            <p>No assets have been deployed yet.</p>
            <Link to="/deploy" className="btn btn-primary">
              Deploy Your First Asset
            </Link>
          </div>
        )}

        {assets.length > 0 && (
          <div className="asset-grid">
            {assets.map((asset) => (
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
                    <span className="detail-label">Address</span>
                    <span className="detail-value" title={asset.tokenAddress}>
                      {chainConfig?.blockExplorer ? (
                        <a
                          href={getExplorerUrl(chainId!, asset.tokenAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatAddress(asset.tokenAddress)}
                        </a>
                      ) : (
                        formatAddress(asset.tokenAddress)
                      )}
                    </span>
                  </div>
                  <div className="asset-card-detail">
                    <span className="detail-label">Issuer</span>
                    <span className="detail-value" title={asset.issuer}>
                      {formatAddress(asset.issuer)}
                    </span>
                  </div>
                  <div className="asset-card-detail">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">
                      {asset.createdAt.toLocaleDateString()}
                    </span>
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
