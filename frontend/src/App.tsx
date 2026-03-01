import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import addresses from './contracts/addresses.json';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// These would normally be imported from your compiled contract artifacts
const FACTORY_ABI = [
  "function deployEquity(string name, string symbol, uint256 initialSupply) external returns (address)",
  "function getAllAssets() external view returns (address[] memory)",
  "event AssetDeployed(address indexed proxy, string assetType)"
];

const EQUITY_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const FACTORY_ADDRESS = addresses.TokenFactory;

function App() {
  const [account, setAccount] = useState<string>("");
  const [provider, setProvider] = useState<any>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        const tempProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(tempProvider);
      } catch (err) {
        console.error("Wallet connection failed", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const fetchAssets = async () => {
    if (!provider) return;
    try {
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const allAssets = await factory.getAllAssets();
      setAssets(allAssets);
    } catch (err) {
      console.error("Failed to fetch assets", err);
    }
  };

  const deployAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !account) return;
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const tx = await factory.deployEquity(name, symbol, ethers.parseUnits(supply, 18));
      await tx.wait();
      alert("Asset Deployed Successfully!");
      fetchAssets();
    } catch (err) {
      console.error("Deployment failed", err);
      alert("Deployment failed!");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (provider) {
      fetchAssets();
    }
  }, [provider]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '20px' }}>
        <h1>Asset Tokenizer</h1>
        {!account ? (
          <button onClick={connectWallet} style={{ padding: '10px 20px', cursor: 'pointer' }}>Connect Wallet</button>
        ) : (
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
        )}
      </header>

      <main style={{ marginTop: '40px' }}>
        <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff' }}>
          <h2>Deploy New Equity</h2>
          <form onSubmit={deployAsset} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input placeholder="Asset Name (e.g. Apple Inc)" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: '10px' }} />
            <input placeholder="Symbol (e.g. AAPL)" value={symbol} onChange={(e) => setSymbol(e.target.value)} required style={{ padding: '10px' }} />
            <input placeholder="Initial Supply" type="number" value={supply} onChange={(e) => setSupply(e.target.value)} required style={{ padding: '10px' }} />
            <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
              {loading ? "Deploying..." : "Deploy Asset"}
            </button>
          </form>
        </section>

        <section>
          <h2>Deployed Assets</h2>
          {assets.length === 0 ? (
            <p>No assets deployed yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {assets.map((addr, idx) => (
                <li key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  <strong>Asset Address:</strong> {addr}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
