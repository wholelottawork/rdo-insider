// ═══════════════════════════════════════════
// Wallet management — connect by private key, persist to localStorage
// ═══════════════════════════════════════════

import { closeModal } from './modals.js';

const STORAGE_KEY = 'rdo_wallets';

// ── State ──
let _wallets = [];        // { id, name, chain, address, key }
let _selectedChain = 'sol';

// ── Public: initialise on page load ──
export function initWallets() {
  try {
    _wallets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { _wallets = []; }

  if (_wallets.length) {
    // Replace demo wallets with saved ones
    const list = document.getElementById('walletList');
    if (list) {
      list.innerHTML = '';
      _wallets.forEach((w, i) => renderWalletItem(w, i === 0));
    }
  }
}

// ── Public: switch active wallet ──
export function switchWallet(el) {
  document.querySelectorAll('.wi').forEach((w) => {
    w.classList.remove('on');
    w.querySelector('.wi-active')?.remove();
  });
  el.classList.add('on');
  const badge = document.createElement('div');
  badge.className = 'wi-active';
  badge.textContent = 'ACTIVE';
  el.appendChild(badge);
}

// ── Public: chain button in modal ──
export function selWalletChain(btn) {
  document.querySelectorAll('#nwChainSel .cs-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _selectedChain = btn.dataset.chain;

  // Update placeholder text
  const keyInp = document.getElementById('nwKey');
  const addrInp = document.getElementById('nwAddr');
  if (keyInp) keyInp.placeholder = _selectedChain === 'sol'
    ? 'Base58 secret key (64-byte)…'
    : 'Hex private key (0x…)';
  if (addrInp) addrInp.placeholder = _selectedChain === 'sol'
    ? 'Solana base58 public key…'
    : 'EVM address (0x…)';

  // Clear previous derived status
  const status = document.getElementById('nwKeyStatus');
  if (status) { status.textContent = ''; status.className = ''; }
}

// ── Public: add wallet (called by modal button) ──
export async function addWallet() {
  const name    = document.getElementById('nwName')?.value.trim();
  const keyRaw  = document.getElementById('nwKey')?.value.trim();
  const addrRaw = document.getElementById('nwAddr')?.value.trim();
  const btn     = document.getElementById('nwBtn');
  const status  = document.getElementById('nwKeyStatus');

  if (!name) { showStatus(status, 'Enter a wallet name', 'err'); return; }

  let address = addrRaw;

  if (keyRaw) {
    // Derive address from private key via backend
    if (btn) btn.textContent = 'DERIVING…';
    try {
      const resp = await fetch('/api/wallet/derive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: _selectedChain, privateKey: keyRaw }),
      });
      let data;
      try { data = await resp.json(); } catch { data = {}; }
      if (!resp.ok) {
        showStatus(status, data.error || 'Invalid private key', 'err');
        return;
      }
      address = data.address;
      showStatus(status, '✓ ' + address, 'ok');
      const addrInp = document.getElementById('nwAddr');
      if (addrInp) addrInp.value = address;
    } catch (e) {
      // Network-level failure (backend not running)
      showStatus(status, 'Cannot reach backend — is npm run dev running?', 'err');
      return;
    } finally {
      if (btn) btn.textContent = 'ADD WALLET';
    }
  }

  if (!address) { showStatus(status, 'Enter a private key or address', 'err'); return; }

  const wallet = {
    id: Date.now().toString(36),
    name,
    chain: _selectedChain,
    address,
    key: keyRaw || null,
  };

  _wallets.push(wallet);
  saveWallets();

  renderWalletItem(wallet, false);

  // Reset modal fields
  ['nwName', 'nwKey', 'nwAddr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (status) { status.textContent = ''; status.className = ''; }

  closeModal('addWalletModal');
}

// ── Public: dev wallet add prompt ──
export function addDwPrompt() {
  const addr = prompt('Wallet address:');
  if (!addr) return;
  const label = prompt('Label:') || 'Dev Wallet';

  const row = document.createElement('div');
  row.className = 'dw-row';
  row.innerHTML = `
    <div><div class="dw-addr">${addr.slice(0, 6)}...${addr.slice(-4)}</div><div class="dw-net">Solana</div></div>
    <div class="dw-lbl"><div class="dw-sdot" style="background:var(--o);color:var(--o);"></div>${label}</div>
    <div class="dw-dep" style="text-align:right;color:var(--mid);">—</div>
    <div class="dw-bal" style="color:var(--mid);">Syncing...</div>
    <div><span class="dw-badge dw-w">NEW</span></div>`;

  document.getElementById('dwList')?.appendChild(row);
  const wc = document.getElementById('dwCount');
  if (wc) wc.textContent = document.querySelectorAll('.dw-row').length + ' WALLETS';
}

// ── Private helpers ──

function renderWalletItem(w, isActive) {
  const CHAIN_COLORS = {
    sol: 'var(--o)',
    eth: '#627EEA',
    base: '#0052FF',
    bsc: '#F0B90B',
  };
  const dot = CHAIN_COLORS[w.chain] || '#555';

  const item = document.createElement('div');
  item.className = 'wi' + (isActive ? ' on' : '');
  item.onclick = function () { switchWallet(this); };
  item.innerHTML = `
    <div class="wi-dot" style="background:${dot};"></div>
    <div class="wi-info">
      <div class="wi-name">${w.name} <span style="font-family:var(--mono);font-size:7px;color:var(--mid);letter-spacing:1px;">${w.chain.toUpperCase()}</span></div>
      <div class="wi-addr">${w.address.slice(0, 6)}...${w.address.slice(-4)}</div>
    </div>
    <div><div class="wi-bal">— </div><div class="wi-usd">—</div></div>
    ${isActive ? '<div class="wi-active">ACTIVE</div>' : ''}`;

  document.getElementById('walletList')?.appendChild(item);
}

function saveWallets() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_wallets)); } catch {}
}

function showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = type;
}
