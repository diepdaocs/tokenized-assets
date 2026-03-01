import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAINS, isSupportedChain } from '../config/chains';

interface WalletState {
  address: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    provider: null,
    signer: null,
    isConnecting: false,
    isConnected: false,
    error: null,
  });

  const hasMetaMask = (): boolean => {
    return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;
  };

  const getProviderAndSigner = useCallback(async () => {
    if (!window.ethereum) return { provider: null, signer: null };
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return { provider, signer };
  }, []);

  const connect = useCallback(async () => {
    if (!hasMetaMask()) {
      setState((prev) => ({
        ...prev,
        error: 'MetaMask is not installed. Please install MetaMask to continue.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = (await window.ethereum!.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const chainIdHex = (await window.ethereum!.request({
        method: 'eth_chainId',
      })) as string;
      const chainId = parseInt(chainIdHex, 16);

      const { provider, signer } = await getProviderAndSigner();

      setState({
        address: accounts[0],
        chainId,
        provider,
        signer,
        isConnecting: false,
        isConnected: true,
        error: !isSupportedChain(chainId) ? 'Unsupported network. Please switch to Hardhat or Sepolia.' : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, [getProviderAndSigner]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      provider: null,
      signer: null,
      isConnecting: false,
      isConnected: false,
      error: null,
    });
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return;

    const chain = CHAINS[targetChainId];
    if (!chain) return;

    const hexChainId = '0x' + targetChainId.toString(16);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError) {
      const err = switchError as { code: number };
      // Chain not added to MetaMask — try adding it
      if (err.code === 4902) {
        try {
          await window.ethereum!.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: chain.name,
                rpcUrls: [chain.rpcUrl],
                nativeCurrency: chain.nativeCurrency,
                blockExplorerUrls: chain.blockExplorer ? [chain.blockExplorer] : [],
              },
            ],
          });
        } catch (addError) {
          const message = addError instanceof Error ? addError.message : 'Failed to add network';
          setState((prev) => ({ ...prev, error: message }));
        }
      } else {
        const message = switchError instanceof Error ? switchError.message : 'Failed to switch network';
        setState((prev) => ({ ...prev, error: message }));
      }
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        const { provider, signer } = await getProviderAndSigner();
        setState((prev) => ({
          ...prev,
          address: accounts[0],
          provider,
          signer,
        }));
      }
    };

    const handleChainChanged = async (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const chainId = parseInt(chainIdHex, 16);
      const { provider, signer } = await getProviderAndSigner();
      setState((prev) => ({
        ...prev,
        chainId,
        provider,
        signer,
        error: !isSupportedChain(chainId) ? 'Unsupported network. Please switch to Hardhat or Sepolia.' : null,
      }));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, getProviderAndSigner]);

  // Auto-reconnect if already authorized
  useEffect(() => {
    if (!hasMetaMask()) return;

    (async () => {
      try {
        const accounts = (await window.ethereum!.request({
          method: 'eth_accounts',
        })) as string[];

        if (accounts.length > 0) {
          const chainIdHex = (await window.ethereum!.request({
            method: 'eth_chainId',
          })) as string;
          const chainId = parseInt(chainIdHex, 16);
          const { provider, signer } = await getProviderAndSigner();

          setState({
            address: accounts[0],
            chainId,
            provider,
            signer,
            isConnecting: false,
            isConnected: true,
            error: !isSupportedChain(chainId) ? 'Unsupported network. Please switch to Hardhat or Sepolia.' : null,
          });
        }
      } catch {
        // Silently fail auto-reconnect
      }
    })();
  }, [getProviderAndSigner]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    hasMetaMask: hasMetaMask(),
  };
}
