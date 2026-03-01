import { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import TokenFactoryArtifact from './artifacts/contracts/TokenFactory.sol/TokenFactory.json';
import './App.css';

// You will need to replace this with your deployed contract address
const FACTORY_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS_HERE";

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [factoryContract, setFactoryContract] = useState<Contract | null>(null);
  const [deployedAssets, setDeployedAssets] = useState<{ address: string, type: string, symbol: string }[]>([]);

  const [assetName, setAssetName] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [totalShares, setTotalShares] = useState('');

  useEffect(() => {
    if (window.ethereum) {
      const initProvider = new BrowserProvider(window.ethereum);
      setProvider(initProvider);
    }
  }, []);

  const connectWallet = async () => {
    if (provider) {
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      const signer = await provider.getSigner();
      const contract = new Contract(FACTORY_ADDRESS, TokenFactoryArtifact.abi, signer);
      setFactoryContract(contract);
    } else {
      alert('Please install MetaMask!');
    }
  };

  const createEquity = async () => {
    if (factoryContract) {
      try {
        const tx = await factoryContract.createEquity(assetName, assetSymbol, parseInt(totalShares));
        await tx.wait();
        alert('Equity Created successfully!');
        // Note: In a real app, you would listen to events to update the deployedAssets state automatically
        setDeployedAssets([...deployedAssets, { address: "Pending...", type: "Equity", symbol: assetSymbol }]);
      } catch (error) {
        console.error("Error creating equity:", error);
        alert('Failed to create equity.');
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tokenized Assets Dashboard</h1>
        {account ? (
          <p>Connected: {account}</p>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>

      {account && (
        <main>
          <section className="create-section">
            <h2>Create Equity Token</h2>
            <input type="text" placeholder="Name (e.g., Apple Inc)" value={assetName} onChange={e => setAssetName(e.target.value)} />
            <input type="text" placeholder="Symbol (e.g., AAPL)" value={assetSymbol} onChange={e => setAssetSymbol(e.target.value)} />
            <input type="number" placeholder="Total Shares" value={totalShares} onChange={e => setTotalShares(e.target.value)} />
            <button onClick={createEquity}>Deploy Equity</button>
          </section>

          <section className="assets-section">
            <h2>Deployed Assets</h2>
            <ul>
              {deployedAssets.map((asset, index) => (
                <li key={index}>
                  <strong>{asset.type}</strong> ({asset.symbol}): {asset.address}
                </li>
              ))}
            </ul>
            {deployedAssets.length === 0 && <p>No assets deployed yet.</p>}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
