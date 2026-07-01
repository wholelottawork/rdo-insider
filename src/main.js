// ═══════════════════════════════════════════
// RDO ONE Insider — Main Entry Point
// ═══════════════════════════════════════════

import './style.css';

// Modules
import { initClock } from './clock.js';
import { openModal, closeModal, initModals } from './modals.js';
import { selNet } from './network.js';
import { selPair, pasteCA, initCASearch, loadTrendingPairs } from './pairs.js';
import { toggleChart } from './chart.js';
import { setQtSide, setQtAmt, executeQuickTrade } from './trade.js';
import { setTwTab, initTweets } from './tweets.js';
import { switchWallet, addWallet, addDwPrompt, selWalletChain, initWallets } from './wallets.js';
import { stopOrdersFeed } from './orders.js';

// ── Center column tab switcher ──
function setCenterTab(tab) {
  const pairs  = document.getElementById('pcolsWrap');
  const plist  = document.getElementById('plistWrap');
  const lo     = document.getElementById('loWrap');
  const tPairs = document.getElementById('tabPairs');
  const tTrades= document.getElementById('tabTrades');

  if (tab === 'trades') {
    if (pairs)  pairs.style.display  = 'none';
    if (plist)  plist.style.display  = 'none';
    if (lo)     lo.classList.add('open');
    tPairs?.classList.remove('active');
    tTrades?.classList.add('active');
  } else {
    if (pairs)  pairs.style.display  = '';
    if (plist)  plist.style.display  = '';
    if (lo)     lo.classList.remove('open');
    tPairs?.classList.add('active');
    tTrades?.classList.remove('active');
  }
}
import { openSniperPg, closeSniperPg, selFee, updateCnt, toggleSniper, addSnipe } from './sniper.js';
import { initResizers } from './resizers.js';

// ── Expose to window for inline onclick handlers ──
Object.assign(window, {
  // Modals
  openModal,
  closeModal,
  // Network
  selNet,
  // Pairs + chart
  selPair,
  pasteCA,
  toggleChart,
  // Trade
  setQtSide,
  setQtAmt,
  executeQuickTrade,
  // Tweets
  setTwTab,
  // Center tabs
  setCenterTab,
  // Wallets
  switchWallet,
  addWallet,
  addDwPrompt,
  selWalletChain,
  // Sniper
  openSniperPg,
  closeSniperPg,
  selFee,
  updateCnt,
  toggleSniper,
  addSnipe,
});

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initModals();
  initCASearch();
  initResizers();
  initTweets();
  initWallets();
  loadTrendingPairs('sol');   // load live SOL trending on startup
});
