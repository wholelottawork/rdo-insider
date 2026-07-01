// ═══════════════════════════════════════════
// Network switching — SOL / BASE / BNB / ETH
// ═══════════════════════════════════════════

import { state } from './state.js';
import { updateTradePanel } from './trade.js';
import { loadTrendingPairs } from './pairs.js';

const CHAIN_MAP = { SOL: 'sol', BASE: 'base', BNB: 'bsc', ETH: 'eth' };

export function selNet(el, name) {
  document.querySelectorAll('.net-btn').forEach((b) => b.classList.remove('active'));
  el.classList.add('active');

  const cpNet = document.getElementById('cpNet');
  if (cpNet) cpNet.textContent = name + ' MAINNET';

  const sbNet = document.getElementById('sbNet');
  if (sbNet) sbNet.textContent = name + ' MAINNET';

  const sp = document.getElementById('spNet');
  if (sp) sp.textContent = name + ' Network \u00b7 Copy-Trade';

  state.activeChain = CHAIN_MAP[name] || 'sol';
  updateTradePanel();

  // Reload pairs for the new chain
  loadTrendingPairs(state.activeChain);
}
