// ═══════════════════════════════════════════
// Pair selection + CA search bar
// ═══════════════════════════════════════════

import { state, CHAIN_CFG } from './state.js';
import { loadChart } from './chart.js';
import { fetchTokenData, formatUsd } from './api.js';
import { updateTradePanel } from './trade.js';
import { startOrdersFeed } from './orders.js';

const CHAIN_NET_LABEL = {
  sol:  'SOLANA',
  eth:  'ETHEREUM',
  base: 'BASE',
  bsc:  'BSC',
};

const CHAIN_DOT_COLOR = {
  sol:  '#9945FF',
  eth:  '#627EEA',
  base: '#0052FF',
  bsc:  '#F0B90B',
};

// ── Load + render top trending pairs for a chain ──
export async function loadTrendingPairs(chain) {
  const list = document.getElementById('plistWrap');
  if (!list) return;

  // Loading skeletons
  list.innerHTML = Array(8).fill(0).map(() =>
    `<div class="prow-skel"><div class="skel-line" style="width:60%;"></div><div class="skel-line" style="width:35%;margin-top:4px;"></div></div>`
  ).join('');

  try {
    const resp = await fetch(`/api/data/trending/${chain}`);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const { tokens } = await resp.json();

    if (!tokens?.length) {
      list.innerHTML = '<div class="lo-empty">No pairs found for this chain</div>';
      return;
    }

    list.innerHTML = tokens.map((t, i) => buildPairRow(t, chain, i === 0)).join('');

    // Auto-select the first pair
    list.querySelector('.prow')?.click();

  } catch (e) {
    list.innerHTML = `<div class="lo-empty">Could not load pairs — ${e.message}</div>`;
  }
}

function buildPairRow(t, chain, isActive) {
  const cfg    = CHAIN_CFG[chain] || CHAIN_CFG.sol;
  const sym    = (t.symbol || '?').toUpperCase().slice(0, 10);
  const name   = t.name   || sym;
  const price  = t.price  || 0;
  const chg    = t.price_change_24h || 0;
  const dir    = chg >= 0 ? 'pos' : 'neg';
  const dot    = CHAIN_DOT_COLOR[chain] || '#888';
  const label  = CHAIN_NET_LABEL[chain] || chain.toUpperCase();

  // Format price: sensible sig figs
  const priceStr = price === 0 ? '0'
    : price >= 1    ? price.toFixed(4)
    : price >= 0.001 ? price.toFixed(6)
    : price.toPrecision(4);

  const chgStr   = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
  const mcapStr  = formatUsd(t.market_cap);
  const symLabel = `${sym} / ${cfg.native}`;

  // Safety badge based on liquidity depth
  let badge = '';
  if      (t.liquidity >= 500_000)  badge = '<span class="pb pb-s">SAFE</span>';
  else if (t.liquidity >= 50_000)   badge = '<span class="pb pb-w">WATCH</span>';
  else                               badge = '<span class="pb pb-w">DYOR</span>';

  // Inline badges
  const liqBadge = t.liquidity >= 50_000 ? '<span class="pb pb-s">LIQ✓</span>' : '<span class="pb pb-w">LOW LIQ</span>';
  const volBadge = t.volume_24h >= 1_000_000 ? '<span class="pb pb-s">VOL✓</span>' : '';

  // Escape strings for the onclick attribute
  const safeSymLabel = symLabel.replace(/'/g, "\\'");
  const safePrice    = '$' + priceStr;
  const safeMcap     = mcapStr;

  return `<div class="prow${isActive ? ' active' : ''}" onclick="selPair(this,'${safeSymLabel}','${safePrice}','${chgStr}','${safeMcap}','${dir}','${t.address}','${chain}')">
    <div>
      <div class="pr-sym"><div class="pr-dot" style="background:${dot};"></div>${sym}</div>
      <div class="pr-name">${name} · ${label}</div>
      <div class="pr-bgs">${liqBadge}${volBadge}</div>
    </div>
    <div class="pv ${dir}">${priceStr}</div>
    <div class="pv ${dir}">${chgStr}</div>
    <div class="pm">${mcapStr}</div>
    <div>${badge}</div>
  </div>`;
}

export function selPair(el, sym, price, chg, mcap, dir, ca, chain) {
  document.querySelectorAll('.prow').forEach((r) => r.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('cpSym').textContent = sym;

  const cpPrice = document.getElementById('cpPrice');
  cpPrice.textContent = price;
  cpPrice.className = 'cp-price ' + dir;

  const cpChg = document.getElementById('cpChg');
  cpChg.textContent = chg;
  cpChg.className = 'cp-chg ' + dir;

  document.getElementById('cpMcap').textContent = mcap;

  if (ca) state.activeCA = ca;
  if (chain) state.activeChain = chain;
  state.activeSymbol = sym.split(' / ')[0] || sym;

  if (ca) loadChart(ca, chain || state.activeChain);

  updateTradePanel();

  if (ca) fetchTokenData(ca, chain || state.activeChain);
  if (ca) startOrdersFeed(ca, chain || state.activeChain, state.activeSymbol);
}

export async function pasteCA() {
  try {
    const text = await navigator.clipboard.readText();
    const inp = document.getElementById('caIn');
    if (inp) inp.value = text;
    if (text.length > 20) {
      loadTokenByCA(text, state.activeChain);
    }
  } catch {
    document.getElementById('caIn')?.focus();
  }
}

// ── Internal: load a token by CA ──
function loadTokenByCA(ca, chain, sym) {
  state.activeCA = ca;
  state.activeChain = chain || state.activeChain;
  if (sym) state.activeSymbol = sym;

  // Update header immediately with whatever we already know
  const symEl  = document.getElementById('cpSym');
  const netEl  = document.getElementById('cpNet');
  const sbEl   = document.getElementById('sbNet');
  if (symEl) symEl.textContent = sym ? `${sym} / ${state.activeChain.toUpperCase()}` : ca.slice(0, 8) + '…';
  if (netEl) netEl.textContent = CHAIN_NET_LABEL[state.activeChain] || state.activeChain.toUpperCase();
  if (sbEl)  sbEl.textContent  = (CHAIN_NET_LABEL[state.activeChain] || state.activeChain.toUpperCase()) + ' MAINNET';

  loadChart(ca, state.activeChain);
  updateTradePanel();
  fetchTokenData(ca, state.activeChain);
  startOrdersFeed(ca, state.activeChain, sym);
}

// ── Search dropdown ──
let _debounce = null;

export function initCASearch() {
  const caIn = document.getElementById('caIn');
  if (!caIn) return;

  // Create dropdown portal anchored to ca-wrap
  const wrap = caIn.closest('.ca-wrap');
  const dropdown = document.createElement('div');
  dropdown.id = 'caDropdown';
  dropdown.className = 'ca-dropdown';
  wrap.appendChild(dropdown);

  // Input: debounced search OR direct CA load
  caIn.addEventListener('input', () => {
    clearTimeout(_debounce);
    const val = caIn.value.trim();

    if (!val || val.length < 2) {
      closeDropdown();
      return;
    }

    // If it looks like a raw contract address (long hex / base58), skip search
    if (val.length > 30) {
      closeDropdown();
      return;
    }

    _debounce = setTimeout(() => runSearch(val), 320);
  });

  // Enter: direct load if CA, else pick first result
  caIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = caIn.value.trim();
      closeDropdown();
      if (val.length > 20) loadTokenByCA(val, state.activeChain);
    }
    if (e.key === 'Escape') closeDropdown();
    if (e.key === 'ArrowDown') {
      const first = dropdown.querySelector('.ca-dd-item');
      if (first) first.focus();
      e.preventDefault();
    }
  });

  // Arrow key nav inside dropdown
  dropdown.addEventListener('keydown', (e) => {
    const items = [...dropdown.querySelectorAll('.ca-dd-item')];
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && idx < items.length - 1) { items[idx + 1].focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { idx > 0 ? items[idx - 1].focus() : caIn.focus(); e.preventDefault(); }
    if (e.key === 'Escape') { closeDropdown(); caIn.focus(); }
  });

  // Click outside → close
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ca-wrap')) closeDropdown();
  });
}

async function runSearch(query) {
  const dropdown = document.getElementById('caDropdown');
  if (!dropdown) return;

  dropdown.innerHTML = '<div class="ca-dd-loading">Searching…</div>';
  dropdown.classList.add('open');

  try {
    const resp = await fetch(`/api/data/search?q=${encodeURIComponent(query)}&chain=${state.activeChain}`);
    if (!resp.ok) throw new Error('Search error');
    const data = await resp.json();
    renderResults(data, dropdown);
  } catch {
    dropdown.innerHTML = '<div class="ca-dd-empty">Search unavailable — paste contract address directly</div>';
  }
}

function renderResults(data, dropdown) {
  // GMGN returns { tokens: [...] } or { data: { tokens: [...] } } or similar
  const raw = data?.tokens ?? data?.data?.tokens ?? data?.data ?? [];
  const tokens = Array.isArray(raw) ? raw : [];

  if (!tokens.length) {
    dropdown.innerHTML = '<div class="ca-dd-empty">No results — try pasting the contract address</div>';
    return;
  }

  dropdown.innerHTML = '';
  tokens.slice(0, 8).forEach((t) => {
    const ca    = t.address ?? t.contract_address ?? '';
    const chain = t.chain ?? state.activeChain;
    const sym   = t.symbol ?? t.name ?? '?';
    const name  = t.name ?? '';
    const price = t.price ? '$' + Number(t.price).toFixed(6) : '';
    const mcap  = t.market_cap ? formatUsd(t.market_cap) : '';

    const item = document.createElement('div');
    item.className = 'ca-dd-item';
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="ca-dd-sym">${sym}${name && name !== sym ? ` <span style="color:var(--mid);font-weight:400">${name}</span>` : ''}</div>
      <div class="ca-dd-meta">
        <span>${truncAddr(ca)}</span>
        ${price ? `<span>${price}</span>` : ''}
        ${mcap  ? `<span>${mcap}</span>`  : ''}
      </div>`;

    const pick = () => {
      document.getElementById('caIn').value = ca;
      closeDropdown();
      loadTokenByCA(ca, chain, sym);
    };
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
    dropdown.appendChild(item);
  });
}

function closeDropdown() {
  const d = document.getElementById('caDropdown');
  if (d) d.classList.remove('open');
}

function truncAddr(a) {
  return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a;
}
