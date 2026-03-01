import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  ComplianceRegistryABI,
  getAddresses,
  InvestorStatus,
  INVESTOR_STATUS_LABELS,
} from '../config/contracts';

interface UseComplianceRegistryReturn {
  loading: boolean;
  error: string | null;
  whitelistInvestor: (address: string) => Promise<boolean>;
  blacklistInvestor: (address: string, reason: string) => Promise<boolean>;
  removeFromBlacklist: (address: string) => Promise<boolean>;
  batchWhitelist: (addresses: string[]) => Promise<boolean>;
  checkWhitelisted: (address: string) => Promise<boolean | null>;
  checkBlacklisted: (address: string) => Promise<boolean | null>;
  getInvestorStatus: (address: string) => Promise<{ status: InvestorStatus; label: string } | null>;
  getWhitelistedCount: () => Promise<number>;
  canTransfer: (from: string, to: string, amount: bigint) => Promise<boolean | null>;
}

export function useComplianceRegistry(
  signer: ethers.JsonRpcSigner | null,
  chainId: number | null
): UseComplianceRegistryReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback((): ethers.Contract | null => {
    if (!signer || !chainId) return null;
    const addresses = getAddresses(chainId);
    if (!addresses || addresses.complianceRegistry === ethers.ZeroAddress) return null;
    return new ethers.Contract(addresses.complianceRegistry, ComplianceRegistryABI, signer);
  }, [signer, chainId]);

  const whitelistInvestor = useCallback(
    async (address: string): Promise<boolean> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.whitelistInvestor(address);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to whitelist investor';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const blacklistInvestor = useCallback(
    async (address: string, reason: string): Promise<boolean> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.blacklistInvestor(address, reason);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to blacklist investor';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const removeFromBlacklist = useCallback(
    async (address: string): Promise<boolean> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.removeFromBlacklist(address);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove from blacklist';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const batchWhitelist = useCallback(
    async (addresses: string[]): Promise<boolean> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.batchWhitelist(addresses);
        await tx.wait();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to batch whitelist';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const checkWhitelisted = useCallback(
    async (address: string): Promise<boolean | null> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return null;
      }

      try {
        return await contract.isWhitelisted(address);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check whitelist status';
        setError(message);
        return null;
      }
    },
    [getContract]
  );

  const checkBlacklisted = useCallback(
    async (address: string): Promise<boolean | null> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return null;
      }

      try {
        return await contract.isBlacklisted(address);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check blacklist status';
        setError(message);
        return null;
      }
    },
    [getContract]
  );

  const getInvestorStatus = useCallback(
    async (address: string): Promise<{ status: InvestorStatus; label: string } | null> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return null;
      }

      try {
        const statusValue = await contract.getInvestorStatus(address);
        const status = Number(statusValue) as InvestorStatus;
        return {
          status,
          label: INVESTOR_STATUS_LABELS[status] || 'Unknown',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get investor status';
        setError(message);
        return null;
      }
    },
    [getContract]
  );

  const getWhitelistedCount = useCallback(async (): Promise<number> => {
    const contract = getContract();
    if (!contract) return 0;

    try {
      const count = await contract.whitelistedCount();
      return Number(count);
    } catch {
      return 0;
    }
  }, [getContract]);

  const canTransfer = useCallback(
    async (from: string, to: string, amount: bigint): Promise<boolean | null> => {
      const contract = getContract();
      if (!contract) {
        setError('ComplianceRegistry not available');
        return null;
      }

      try {
        return await contract.canTransfer(from, to, amount);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check transfer eligibility';
        setError(message);
        return null;
      }
    },
    [getContract]
  );

  return {
    loading,
    error,
    whitelistInvestor,
    blacklistInvestor,
    removeFromBlacklist,
    batchWhitelist,
    checkWhitelisted,
    checkBlacklisted,
    getInvestorStatus,
    getWhitelistedCount,
    canTransfer,
  };
}
