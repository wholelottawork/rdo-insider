// ═══════════════════════════════════════════
// Live Orders Feed — polls GMGN trades every 3s
// ═══════════════════════════════════════════

let _timer  = null;
let _ca     = '';
let _chain  = '';
let _seen   = new Set();   // dedup by tx hash

export function startOrdersFeed(ca, chain, sym) {
  stopOrdersFeed();
  _ca    = ca;
  _chain = chain;
  _seen.clear();

  const tokenEl = document.getElementById('loToken');
  const statusEl = document.getElementById('loStatus');
  if (tokenEl) tokenEl.textContent = sym || (ca.slice(0, 6) + '…' + ca.slice(-4));
  if (statusEl) statusEl.textContent = 'connecting…';

  const listEl = document.getElementById('loList');
  if (listEl) listEl.innerHTML = '<div class="lo-empty">Fetching trades…</div>';

  fetchTrades();
  _timer = setInterval(fetchTrades, 3000);
}

export function stopOrdersFeed() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

// ── Internal ──

async function fetchTrades() {
  if (!_ca) return;
  const statusEl = document.getElementById('loStatus');
  try {
    const resp = await fetch(`/api/data/trades/${_chain}/${_ca}?limit=40`);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();

    // GMGN wraps in { code:0, data: { swaps:[...] } } or { data:[...] }
    const raw = json?.data?.swaps ?? json?.data ?? json?.swaps ?? json?.trades ?? [];
    const trades = Array.isArray(raw) ? raw : [];

    if (statusEl) {
      statusEl.textContent = 'live · ' + fmtTime(Date.now());
    }
    renderTrades(trades);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'fetch error';
  }
}

function renderTrades(trades) {
  const list = document.getElementById('loList');
  if (!list) return;

  if (!trades.length) {
    list.innerHTML = '<div class="lo-empty">No recent trades</div>';
    return;
  }

  // Find new rows (not seen before)
  const newRows = [];
  trades.forEach(t => {
    const id = t.tx_hash ?? t.hash ?? t.id ?? JSON.stringify(t).slice(0, 40);
    if (_seen.has(id)) return;
    _seen.add(id);
    newRows.push(t);
  });

  // Build HTML for all visible trades (most recent first, max 40)
  const allToShow = trades.slice(0, 40);
  list.innerHTML = allToShow.map(t => buildRow(t)).join('');

  // Flash new rows
  if (newRows.length && list.children.length) {
    // First N rows are new — flash them
    [...list.children].slice(0, newRows.length).forEach(el => {
      el.classList.add('lo-new');
      setTimeout(() => el.classList.remove('lo-new'), 800);
    });
  }
}

function buildRow(t) {
  // Normalise field names across GMGN response variants
  const side     = (t.event_type ?? t.side ?? t.type ?? 'buy').toLowerCase();
  const isBuy    = side.includes('buy');

  const amtToken = t.token_amount      ?? t.in_amount       ?? t.amount          ?? null;
  const amtUsd   = t.amount_usd        ?? t.volume_usd      ?? t.usd_amount       ?? null;
  const amtNative = t.volume_sol       ?? t.sol_amount       ?? t.native_amount   ?? null;   // SOL / ETH / BNB
  const priceUsd = t.price_usd         ?? t.quote_price_usd ?? t.price            ?? null;
  const wallet   = t.maker             ?? t.from_address    ?? t.wallet           ?? '—';
  const ts       = t.timestamp         ?? t.block_timestamp ?? t.created_at       ?? null;

  // Primary amount shown: prefer native (SOL/ETH) then USD then token count
  let amtDisplay = '—';
  if (amtNative)      amtDisplay = (+amtNative).toFixed(3);
  else if (amtUsd)    amtDisplay = '$' + (+amtUsd).toFixed(2);
  else if (amtToken)  amtDisplay = fmtLargeNum(+amtToken);

  const usdSub = amtUsd && amtNative
    ? `<div class="lo-sub">$${(+amtUsd).toFixed(2)}</div>` : '';

  const priceStr = priceUsd
    ? '$' + Number(priceUsd).toLocaleString('en-US', { maximumSignificantDigits: 5 })
    : '—';

  const walletStr = typeof wallet === 'string' && wallet.length > 8
    ? wallet.slice(0, 4) + '…' + wallet.slice(-4) : wallet;

  const timeStr = ts ? fmtAgo(ts) : '—';

  return `<div class="lo-row ${isBuy ? 'lo-buy-row' : 'lo-sell-row'}">
    <span class="lo-badge ${isBuy ? 'lo-badge-b' : 'lo-badge-s'}">${isBuy ? 'BUY' : 'SELL'}</span>
    <span class="lo-amt">${amtDisplay}${usdSub}</span>
    <span class="lo-price">${priceStr}</span>
    <span class="lo-wallet">${walletStr}</span>
    <span class="lo-ts">${timeStr}</span>
  </div>`;
}

function fmtAgo(ts) {
  const ms  = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : +new Date(ts);
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 5)   return 'now';
  if (sec < 60)  return sec + 's';
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  return Math.floor(sec / 3600) + 'h';
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

function fmtLargeNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}
