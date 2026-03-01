import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  TokenFactoryABI,
  EquityTokenABI,
  BondTokenABI,
  LandTokenABI,
  getAddresses,
  AssetCategory,
  ASSET_CATEGORY_LABELS,
} from '../config/contracts';
import type { AssetInfo, BondTerms } from '../config/contracts';

interface DeployedAssetDisplay {
  tokenAddress: string;
  category: AssetCategory;
  categoryLabel: string;
  name: string;
  symbol: string;
  issuer: string;
  createdAt: Date;
  active: boolean;
}

interface UseTokenFactoryReturn {
  assets: DeployedAssetDisplay[];
  loading: boolean;
  error: string | null;
  loadAssets: () => Promise<void>;
  deployEquity: (name: string, symbol: string, cusip: string, totalShares: bigint) => Promise<string | null>;
  deployBond: (name: string, symbol: string, terms: BondTerms) => Promise<string | null>;
  deployLand: (name: string, symbol: string) => Promise<string | null>;
  getAssetCount: () => Promise<number>;
  getAssetAbi: (category: AssetCategory) => readonly string[];
}

export function useTokenFactory(
  signer: ethers.JsonRpcSigner | null,
  chainId: number | null
): UseTokenFactoryReturn {
  const [assets, setAssets] = useState<DeployedAssetDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback((): ethers.Contract | null => {
    if (!signer || !chainId) return null;
    const addresses = getAddresses(chainId);
    if (!addresses || addresses.tokenFactory === ethers.ZeroAddress) return null;
    return new ethers.Contract(addresses.tokenFactory, TokenFactoryABI, signer);
  }, [signer, chainId]);

  const loadAssets = useCallback(async () => {
    const contract = getContract();
    if (!contract) {
      setError('TokenFactory not available. Check wallet connection and contract address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rawAssets: AssetInfo[] = await contract.getDeployedAssets();
      const displayAssets: DeployedAssetDisplay[] = rawAssets.map((asset) => ({
        tokenAddress: asset.tokenAddress,
        category: Number(asset.category) as AssetCategory,
        categoryLabel: ASSET_CATEGORY_LABELS[Number(asset.category) as AssetCategory] || 'Unknown',
        name: asset.name,
        symbol: asset.symbol,
        issuer: asset.issuer,
        createdAt: new Date(Number(asset.createdAt) * 1000),
        active: asset.active,
      }));
      setAssets(displayAssets);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const deployEquity = useCallback(
    async (name: string, symbol: string, cusip: string, totalShares: bigint): Promise<string | null> => {
      const contract = getContract();
      if (!contract) {
        setError('TokenFactory not available');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.deployEquity(name, symbol, cusip, totalShares);
        const receipt = await tx.wait();

        // Parse the AssetDeployed event to get the new token address
        const event = receipt.logs.find((log: ethers.Log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            return parsed?.name === 'AssetDeployed';
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = contract.interface.parseLog({
            topics: [...event.topics],
            data: event.data,
          });
          return parsed?.args[0] as string;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deploy equity token';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const deployBond = useCallback(
    async (name: string, symbol: string, terms: BondTerms): Promise<string | null> => {
      const contract = getContract();
      if (!contract) {
        setError('TokenFactory not available');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.deployBond(name, symbol, [
          terms.faceValue,
          terms.couponRateBps,
          terms.couponInterval,
          terms.maturityDate,
          terms.issueDate,
        ]);
        const receipt = await tx.wait();

        const event = receipt.logs.find((log: ethers.Log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            return parsed?.name === 'AssetDeployed';
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = contract.interface.parseLog({
            topics: [...event.topics],
            data: event.data,
          });
          return parsed?.args[0] as string;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deploy bond token';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const deployLand = useCallback(
    async (name: string, symbol: string): Promise<string | null> => {
      const contract = getContract();
      if (!contract) {
        setError('TokenFactory not available');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await contract.deployLandToken(name, symbol);
        const receipt = await tx.wait();

        const event = receipt.logs.find((log: ethers.Log) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            return parsed?.name === 'AssetDeployed';
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = contract.interface.parseLog({
            topics: [...event.topics],
            data: event.data,
          });
          return parsed?.args[0] as string;
        }

        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deploy land token';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getContract]
  );

  const getAssetCount = useCallback(async (): Promise<number> => {
    const contract = getContract();
    if (!contract) return 0;
    try {
      const count = await contract.deployedAssetsCount();
      return Number(count);
    } catch {
      return 0;
    }
  }, [getContract]);

  const getAssetAbi = useCallback((category: AssetCategory): readonly string[] => {
    switch (category) {
      case AssetCategory.EQUITY:
        return EquityTokenABI;
      case AssetCategory.BOND:
        return BondTokenABI;
      case AssetCategory.LAND:
      case AssetCategory.FRACTIONAL_LAND:
        return LandTokenABI;
      default:
        return EquityTokenABI;
    }
  }, []);

  return {
    assets,
    loading,
    error,
    loadAssets,
    deployEquity,
    deployBond,
    deployLand,
    getAssetCount,
    getAssetAbi,
  };
}
