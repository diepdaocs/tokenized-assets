import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useComplianceRegistry } from '../hooks/useComplianceRegistry';
import type { InvestorStatus } from '../config/contracts';

export default function AdminPanel() {
  const { isConnected, signer, chainId } = useWallet();
  const {
    loading,
    error,
    whitelistInvestor,
    blacklistInvestor,
    batchWhitelist,
    getInvestorStatus,
    canTransfer,
  } = useComplianceRegistry(signer, chainId);

  // Whitelist form
  const [whitelistAddress, setWhitelistAddress] = useState('');
  const [whitelistResult, setWhitelistResult] = useState<string | null>(null);

  // Blacklist form
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistResult, setBlacklistResult] = useState<string | null>(null);

  // Batch whitelist form
  const [batchAddresses, setBatchAddresses] = useState('');
  const [batchResult, setBatchResult] = useState<string | null>(null);

  // Check investor status form
  const [checkAddress, setCheckAddress] = useState('');
  const [statusResult, setStatusResult] = useState<{ status: InvestorStatus; label: string } | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  // Transfer check form
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferResult, setTransferResult] = useState<string | null>(null);

  const handleWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhitelistResult(null);

    if (!whitelistAddress) {
      setWhitelistResult('Please enter an address.');
      return;
    }

    const success = await whitelistInvestor(whitelistAddress);
    if (success) {
      setWhitelistResult('Investor whitelisted successfully.');
      setWhitelistAddress('');
    } else {
      setWhitelistResult('Failed to whitelist investor.');
    }
  };

  const handleBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlacklistResult(null);

    if (!blacklistAddress || !blacklistReason) {
      setBlacklistResult('Please fill in all fields.');
      return;
    }

    const success = await blacklistInvestor(blacklistAddress, blacklistReason);
    if (success) {
      setBlacklistResult('Investor blacklisted successfully.');
      setBlacklistAddress('');
      setBlacklistReason('');
    } else {
      setBlacklistResult('Failed to blacklist investor.');
    }
  };

  const handleBatchWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchResult(null);

    const addresses = batchAddresses
      .split('\n')
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (addresses.length === 0) {
      setBatchResult('Please enter at least one address.');
      return;
    }

    const success = await batchWhitelist(addresses);
    if (success) {
      setBatchResult(`Successfully whitelisted ${addresses.length} investor(s).`);
      setBatchAddresses('');
    } else {
      setBatchResult('Failed to batch whitelist investors.');
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusResult(null);
    setCheckResult(null);

    if (!checkAddress) {
      setCheckResult('Please enter an address.');
      return;
    }

    const result = await getInvestorStatus(checkAddress);
    if (result) {
      setStatusResult(result);
    } else {
      setCheckResult('Failed to retrieve investor status.');
    }
  };

  const handleTransferCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferResult(null);

    if (!transferFrom || !transferTo) {
      setTransferResult('Please fill in both addresses.');
      return;
    }

    const allowed = await canTransfer(transferFrom, transferTo, 0n);
    if (allowed === null) {
      setTransferResult('Failed to check transfer eligibility.');
    } else if (allowed) {
      setTransferResult('Transfer is ALLOWED between these addresses.');
    } else {
      setTransferResult('Transfer is NOT ALLOWED between these addresses.');
    }
  };

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Admin Panel</h1>
        </div>
        <div className="empty-state">
          <p>Connect your wallet to access compliance management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">Manage investor compliance through the ComplianceRegistry</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Whitelist Investor */}
      <div className="section">
        <form className="form-card" onSubmit={handleWhitelist}>
          <h2 className="form-title">Whitelist Investor</h2>
          <p className="form-description">
            Add an investor address to the whitelist, allowing them to hold and transfer tokens.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="wl-address">Investor Address</label>
            <input
              id="wl-address"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={whitelistAddress}
              onChange={(e) => setWhitelistAddress(e.target.value)}
              required
            />
          </div>

          {whitelistResult && (
            <div className={`alert ${whitelistResult.includes('success') ? 'alert-success' : 'alert-error'}`}>
              {whitelistResult}
            </div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Whitelist Investor'}
          </button>
        </form>
      </div>

      {/* Blacklist Investor */}
      <div className="section">
        <form className="form-card" onSubmit={handleBlacklist}>
          <h2 className="form-title">Blacklist Investor</h2>
          <p className="form-description">
            Blacklist an investor address, preventing them from participating in token transfers.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="bl-address">Investor Address</label>
            <input
              id="bl-address"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={blacklistAddress}
              onChange={(e) => setBlacklistAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bl-reason">Reason</label>
            <input
              id="bl-reason"
              className="form-input"
              type="text"
              placeholder="e.g. Regulatory non-compliance"
              value={blacklistReason}
              onChange={(e) => setBlacklistReason(e.target.value)}
              required
            />
            <span className="form-hint">Provide a reason for blacklisting the investor</span>
          </div>

          {blacklistResult && (
            <div className={`alert ${blacklistResult.includes('success') ? 'alert-success' : 'alert-error'}`}>
              {blacklistResult}
            </div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Blacklist Investor'}
          </button>
        </form>
      </div>

      {/* Batch Whitelist */}
      <div className="section">
        <form className="form-card" onSubmit={handleBatchWhitelist}>
          <h2 className="form-title">Batch Whitelist</h2>
          <p className="form-description">
            Whitelist multiple investor addresses at once. Enter one address per line.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="batch-addresses">Addresses (one per line)</label>
            <textarea
              id="batch-addresses"
              className="form-input form-textarea"
              placeholder={"0x1234...\n0x5678...\n0xabcd..."}
              value={batchAddresses}
              onChange={(e) => setBatchAddresses(e.target.value)}
              required
            />
            <span className="form-hint">Enter one Ethereum address per line</span>
          </div>

          {batchResult && (
            <div className={`alert ${batchResult.includes('success') ? 'alert-success' : 'alert-error'}`}>
              {batchResult}
            </div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Batch Whitelist'}
          </button>
        </form>
      </div>

      {/* Check Investor Status */}
      <div className="section">
        <form className="form-card" onSubmit={handleCheckStatus}>
          <h2 className="form-title">Check Investor Status</h2>
          <p className="form-description">
            Look up the current compliance status of an investor address.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="check-address">Investor Address</label>
            <input
              id="check-address"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={checkAddress}
              onChange={(e) => setCheckAddress(e.target.value)}
              required
            />
          </div>

          {statusResult && (
            <div className="alert alert-info">
              <strong>Status:</strong> {statusResult.label} (code: {statusResult.status})
            </div>
          )}

          {checkResult && (
            <div className="alert alert-error">{checkResult}</div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>
      </div>

      {/* Transfer Check */}
      <div className="section">
        <form className="form-card" onSubmit={handleTransferCheck}>
          <h2 className="form-title">Transfer Check</h2>
          <p className="form-description">
            Verify whether a transfer between two addresses would be allowed by the compliance rules.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="tf-from">From Address</label>
            <input
              id="tf-from"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={transferFrom}
              onChange={(e) => setTransferFrom(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tf-to">To Address</label>
            <input
              id="tf-to"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              required
            />
          </div>

          {transferResult && (
            <div className={`alert ${transferResult.includes('ALLOWED') && !transferResult.includes('NOT') ? 'alert-success' : 'alert-error'}`}>
              {transferResult}
            </div>
          )}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Check Transfer'}
          </button>
        </form>
      </div>
    </div>
  );
}
