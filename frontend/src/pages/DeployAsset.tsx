import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useTokenFactory } from '../hooks/useTokenFactory';
import type { BondTerms } from '../config/contracts';

type AssetType = 'equity' | 'bond' | 'land';

export default function DeployAsset() {
  const navigate = useNavigate();
  const { isConnected, signer, chainId } = useWallet();
  const { deployEquity, deployBond, deployLand, loading, error } = useTokenFactory(signer, chainId);

  const [assetType, setAssetType] = useState<AssetType>('equity');
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Equity form state
  const [equityName, setEquityName] = useState('');
  const [equitySymbol, setEquitySymbol] = useState('');
  const [equityCusip, setEquityCusip] = useState('');
  const [equityTotalShares, setEquityTotalShares] = useState('');

  // Bond form state
  const [bondName, setBondName] = useState('');
  const [bondSymbol, setBondSymbol] = useState('');
  const [bondFaceValue, setBondFaceValue] = useState('');
  const [bondCouponRate, setBondCouponRate] = useState('');
  const [bondCouponInterval, setBondCouponInterval] = useState('2592000'); // 30 days in seconds
  const [bondMaturityDate, setBondMaturityDate] = useState('');

  // Land form state
  const [landName, setLandName] = useState('');
  const [landSymbol, setLandSymbol] = useState('');

  const handleDeployEquity = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxStatus(null);

    if (!equityName || !equitySymbol || !equityCusip || !equityTotalShares) {
      setTxStatus('Please fill in all fields.');
      return;
    }

    setTxStatus('Deploying equity token...');
    const address = await deployEquity(
      equityName,
      equitySymbol,
      equityCusip,
      BigInt(equityTotalShares)
    );

    if (address) {
      setTxStatus(`Equity token deployed at ${address}`);
      setTimeout(() => navigate(`/asset/${address}`), 2000);
    }
  };

  const handleDeployBond = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxStatus(null);

    if (!bondName || !bondSymbol || !bondFaceValue || !bondCouponRate || !bondMaturityDate) {
      setTxStatus('Please fill in all fields.');
      return;
    }

    const maturityTimestamp = Math.floor(new Date(bondMaturityDate).getTime() / 1000);
    const terms: BondTerms = {
      faceValue: BigInt(bondFaceValue),
      couponRateBps: BigInt(bondCouponRate),
      couponInterval: BigInt(bondCouponInterval),
      maturityDate: BigInt(maturityTimestamp),
      issueDate: 0n, // contract sets to block.timestamp if zero
    };

    setTxStatus('Deploying bond token...');
    const address = await deployBond(bondName, bondSymbol, terms);

    if (address) {
      setTxStatus(`Bond token deployed at ${address}`);
      setTimeout(() => navigate(`/asset/${address}`), 2000);
    }
  };

  const handleDeployLand = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxStatus(null);

    if (!landName || !landSymbol) {
      setTxStatus('Please fill in all fields.');
      return;
    }

    setTxStatus('Deploying land token...');
    const address = await deployLand(landName, landSymbol);

    if (address) {
      setTxStatus(`Land token deployed at ${address}`);
      setTimeout(() => navigate(`/asset/${address}`), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Deploy Asset</h1>
        </div>
        <div className="empty-state">
          <p>Connect your wallet to deploy new tokenized assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Deploy Asset</h1>
        <p className="page-subtitle">Create new tokenized assets through the TokenFactory</p>
      </div>

      {/* Asset Type Selector */}
      <div className="tab-group">
        <button
          className={`tab ${assetType === 'equity' ? 'tab-active' : ''}`}
          onClick={() => setAssetType('equity')}
        >
          Equity Token
        </button>
        <button
          className={`tab ${assetType === 'bond' ? 'tab-active' : ''}`}
          onClick={() => setAssetType('bond')}
        >
          Bond Token
        </button>
        <button
          className={`tab ${assetType === 'land' ? 'tab-active' : ''}`}
          onClick={() => setAssetType('land')}
        >
          Land Token
        </button>
      </div>

      {/* Status Messages */}
      {(txStatus || error) && (
        <div className={`alert ${error ? 'alert-error' : 'alert-info'}`}>
          {error || txStatus}
        </div>
      )}

      {/* Equity Form */}
      {assetType === 'equity' && (
        <form className="form-card" onSubmit={handleDeployEquity}>
          <h2 className="form-title">Deploy Equity Token</h2>
          <p className="form-description">
            Create a new ERC-20 equity token with snapshot and dividend capabilities.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="eq-name">Token Name</label>
            <input
              id="eq-name"
              className="form-input"
              type="text"
              placeholder="e.g. Acme Corporation Equity"
              value={equityName}
              onChange={(e) => setEquityName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="eq-symbol">Symbol</label>
            <input
              id="eq-symbol"
              className="form-input"
              type="text"
              placeholder="e.g. ACME"
              value={equitySymbol}
              onChange={(e) => setEquitySymbol(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="eq-cusip">CUSIP</label>
            <input
              id="eq-cusip"
              className="form-input"
              type="text"
              placeholder="e.g. 123456789"
              value={equityCusip}
              onChange={(e) => setEquityCusip(e.target.value)}
              required
            />
            <span className="form-hint">
              Committee on Uniform Securities Identification Procedures number
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="eq-shares">Total Shares</label>
            <input
              id="eq-shares"
              className="form-input"
              type="number"
              placeholder="e.g. 1000000"
              value={equityTotalShares}
              onChange={(e) => setEquityTotalShares(e.target.value)}
              min="1"
              required
            />
          </div>

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Deploying...' : 'Deploy Equity Token'}
          </button>
        </form>
      )}

      {/* Bond Form */}
      {assetType === 'bond' && (
        <form className="form-card" onSubmit={handleDeployBond}>
          <h2 className="form-title">Deploy Bond Token</h2>
          <p className="form-description">
            Create a new ERC-20 bond token with coupon payments and redemption at maturity.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-name">Token Name</label>
            <input
              id="bond-name"
              className="form-input"
              type="text"
              placeholder="e.g. Acme 5% 2026 Bond"
              value={bondName}
              onChange={(e) => setBondName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-symbol">Symbol</label>
            <input
              id="bond-symbol"
              className="form-input"
              type="text"
              placeholder="e.g. ACME26"
              value={bondSymbol}
              onChange={(e) => setBondSymbol(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-face">Face Value (wei)</label>
            <input
              id="bond-face"
              className="form-input"
              type="number"
              placeholder="e.g. 1000000000000000000 (1 ETH)"
              value={bondFaceValue}
              onChange={(e) => setBondFaceValue(e.target.value)}
              min="1"
              required
            />
            <span className="form-hint">Total face value of the bond in wei</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-rate">Coupon Rate (basis points)</label>
            <input
              id="bond-rate"
              className="form-input"
              type="number"
              placeholder="e.g. 500 (= 5%)"
              value={bondCouponRate}
              onChange={(e) => setBondCouponRate(e.target.value)}
              min="1"
              max="10000"
              required
            />
            <span className="form-hint">Annual coupon rate. 100 bps = 1%</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-interval">Coupon Interval (seconds)</label>
            <input
              id="bond-interval"
              className="form-input"
              type="number"
              placeholder="e.g. 2592000 (30 days)"
              value={bondCouponInterval}
              onChange={(e) => setBondCouponInterval(e.target.value)}
              min="1"
              required
            />
            <span className="form-hint">
              Time between coupon payments. 2592000 = 30 days, 31536000 = 1 year
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bond-maturity">Maturity Date</label>
            <input
              id="bond-maturity"
              className="form-input"
              type="date"
              value={bondMaturityDate}
              onChange={(e) => setBondMaturityDate(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Deploying...' : 'Deploy Bond Token'}
          </button>
        </form>
      )}

      {/* Land Form */}
      {assetType === 'land' && (
        <form className="form-card" onSubmit={handleDeployLand}>
          <h2 className="form-title">Deploy Land Token</h2>
          <p className="form-description">
            Create a new ERC-721 land token registry for tokenizing real estate properties.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="land-name">Token Name</label>
            <input
              id="land-name"
              className="form-input"
              type="text"
              placeholder="e.g. Manhattan Real Estate"
              value={landName}
              onChange={(e) => setLandName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="land-symbol">Symbol</label>
            <input
              id="land-symbol"
              className="form-input"
              type="text"
              placeholder="e.g. MNHTN"
              value={landSymbol}
              onChange={(e) => setLandSymbol(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Deploying...' : 'Deploy Land Token'}
          </button>
        </form>
      )}
    </div>
  );
}
