// ═══════════════════════════════════════════
// GMGN API — data fetching
// ═══════════════════════════════════════════

import { API_BASE } from './state.js';

export async function fetchTokenData(ca, chain) {
  try {
    const resp = await fetch(`${API_BASE}/data/token/${chain}/${ca}`);
    if (!resp.ok) return null;
    const data = await resp.json();

    if (data?.data) {
      const t = data.data;
      // Symbol / name in header
      const sym = t.symbol || t.name;
      if (sym) {
        const symEl = document.getElementById('cpSym');
        if (symEl && !symEl.textContent.includes(sym)) {
          symEl.textContent = sym + ' / ' + (chain || '').toUpperCase();
        }
      }
      if (t.price) {
        const el = document.getElementById('cpPrice');
        if (el) el.textContent = '$' + Number(t.price).toFixed(8);
      }
      if (t.price_change_24h !== undefined) {
        const el = document.getElementById('cpChg');
        if (el) {
          const pct = Number(t.price_change_24h).toFixed(2);
          el.textContent = (pct > 0 ? '+' : '') + pct + '%';
          el.className = 'cp-chg ' + (pct >= 0 ? 'pos' : 'neg');
        }
      }
      if (t.market_cap) {
        const el = document.getElementById('cpMcap');
        if (el) el.textContent = formatUsd(t.market_cap);
      }
    }
    return data;
  } catch (e) {
    console.log('Token fetch skipped (backend offline):', e.message);
    return null;
  }
}

export function formatUsd(n) {
  n = Number(n);
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}
