export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const CHAINS: Record<number, ChainConfig> = {
  31337: {
    chainId: 31337,
    name: 'Hardhat Local',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: '',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SEP',
      decimals: 18,
    },
  },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

export const DEFAULT_CHAIN_ID = 31337;

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAINS[chainId];
}

export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function getExplorerUrl(chainId: number, address: string): string {
  const chain = CHAINS[chainId];
  if (!chain || !chain.blockExplorer) return '';
  return `${chain.blockExplorer}/address/${address}`;
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = CHAINS[chainId];
  if (!chain || !chain.blockExplorer) return '';
  return `${chain.blockExplorer}/tx/${txHash}`;
}
