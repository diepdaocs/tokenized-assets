import { useWallet } from '../../hooks/useWallet';
import { getChainConfig } from '../../config/chains';

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectWallet() {
  const { address, chainId, isConnected, isConnecting, error, connect, disconnect, hasMetaMask } =
    useWallet();

  const chainConfig = chainId ? getChainConfig(chainId) : null;

  if (!hasMetaMask) {
    return (
      <div className="connect-wallet">
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Install MetaMask
        </a>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="connect-wallet connected">
        {chainConfig && (
          <span className="network-badge">
            <span className="network-dot" />
            {chainConfig.name}
          </span>
        )}
        <span className="wallet-address" title={address}>
          {formatAddress(address)}
        </span>
        <button className="btn btn-outline btn-sm" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="connect-wallet">
      <button className="btn btn-primary" onClick={connect} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && <span className="wallet-error">{error}</span>}
    </div>
  );
}
