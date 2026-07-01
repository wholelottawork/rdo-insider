// ═══════════════════════════════════════════
// Shared application state
// ═══════════════════════════════════════════

export const state = {
  activeCA: '',
  activeChain: 'sol',
  activeSymbol: 'BONK',
  qtSide: 'buy',
  qtRouteId: null,
  qtState: 'idle',    // idle | quoting | quoted | executing | polling
  twFilter: 'ALL',
  sniperLive: false,
};

export const API_BASE = '/api';

export const CHAIN_CFG = {
  sol:  { native: 'SOL', decimals: 9,  gmgnChain: 'sol',  apiPath: 'sol' },
  base: { native: 'ETH', decimals: 18, gmgnChain: 'base', apiPath: 'evm' },
  bsc:  { native: 'BNB', decimals: 18, gmgnChain: 'bsc',  apiPath: 'evm' },
  eth:  { native: 'ETH', decimals: 18, gmgnChain: 'eth',  apiPath: 'evm' },
};
