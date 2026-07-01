// ═══════════════════════════════════════════
// Quick Trade — quote → confirm → execute → poll
// ═══════════════════════════════════════════

import { state, API_BASE, CHAIN_CFG } from './state.js';

// ── Native token price cache (refreshed every 60s) ──
const _nativePrice = { sol: 0, eth: 0, base: 0, bsc: 0 };
async function refreshNativePrice() {
  try {
    const r = await fetch('/api/data/native-price');
    if (!r.ok) return;
    const d = await r.json();
    Object.assign(_nativePrice, d);
  } catch {}
}
refreshNativePrice();
setInterval(refreshNativePrice, 60_000);

export function getNativePrice(chain) {
  return _nativePrice[chain] || 0;
}

export function updateTradePanel() {
  const cfg = CHAIN_CFG[state.activeChain] || CHAIN_CFG.sol;

  const qtToken = document.getElementById('qtToken');
  if (qtToken) qtToken.textContent = state.activeSymbol;

  const qtCA = document.getElementById('qtCA');
  if (qtCA) qtCA.value = state.activeCA;

  const qtNative = document.getElementById('qtNative');
  if (qtNative) qtNative.textContent = cfg.native;

  state.qtRouteId = null;
  state.qtState = 'idle';

  const btn = document.getElementById('qtSubmit');
  if (btn) {
    btn.textContent = 'GET QUOTE';
    btn.className = 'qt-submit ' + (state.qtSide === 'buy' ? 'buy-btn' : 'sell-btn');
    btn.disabled = false;
  }

  const info = document.getElementById('qtQuoteInfo');
  if (info) info.style.display = 'none';

  const status = document.getElementById('qtStatus');
  if (status) { status.classList.remove('show'); status.innerHTML = ''; }

  // Wire up live USD preview on amount input (once — guard with dataset flag)
  const amtInp = document.getElementById('qtAmount');
  if (amtInp && !amtInp.dataset.usdWired) {
    amtInp.dataset.usdWired = '1';
    amtInp.addEventListener('input', updateUsdPreview);
  }
  updateUsdPreview();
}

function updateUsdPreview() {
  if (state.qtSide !== 'buy') return;     // only for buys
  const inp  = document.getElementById('qtAmount');
  const prev = document.getElementById('qtUsdPreview');
  if (!inp || !prev) return;
  const amt   = parseFloat(inp.value) || 0;
  const price = getNativePrice(state.activeChain);
  if (!price || !amt) { prev.textContent = ''; return; }
  prev.textContent = '≈ $' + (amt * price).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const BUY_PRESETS  = [0.05, 0.1, 0.25, 0.5, 1.0];
const SELL_PRESETS = [10, 25, 50, 100];        // percent of holdings

export function setQtSide(side) {
  state.qtSide = side;
  document.querySelectorAll('.qt-tab').forEach((t) => t.classList.remove('on'));
  document.querySelector('.qt-tab.' + side)?.classList.add('on');

  const btn  = document.getElementById('qtSubmit');
  const inp  = document.getElementById('qtAmount');
  const lbl  = document.getElementById('qtNative');
  const row  = document.querySelector('.qt-row');

  if (btn) btn.className = 'qt-submit ' + (side === 'buy' ? 'buy-btn' : 'sell-btn');

  state.qtRouteId = null;
  state.qtState   = 'idle';
  if (btn) btn.textContent = 'GET QUOTE';

  // Swap presets
  if (row) {
    if (side === 'sell') {
      const defaultPct = 50;
      row.innerHTML = SELL_PRESETS.map(p =>
        `<div class="qt-preset${p === defaultPct ? ' on' : ''}" onclick="setQtAmt(${p})">${p}%</div>`
      ).join('');
      if (inp) { inp.value = defaultPct; inp.step = '1'; inp.placeholder = '50'; }
      if (lbl) lbl.textContent = '%';
    } else {
      const defaultAmt = 0.1;
      const cfg = CHAIN_CFG[state.activeChain] || CHAIN_CFG.sol;
      row.innerHTML = BUY_PRESETS.map(p =>
        `<div class="qt-preset${p === defaultAmt ? ' on' : ''}" onclick="setQtAmt(${p})">${p}</div>`
      ).join('');
      if (inp) { inp.value = defaultAmt; inp.step = '0.01'; inp.placeholder = '0.1'; }
      if (lbl) lbl.textContent = cfg.native || 'SOL';
    }
  }
}

export function setQtAmt(val) {
  const inp = document.getElementById('qtAmount');
  if (inp) inp.value = val;

  document.querySelectorAll('.qt-preset').forEach((p) => p.classList.remove('on'));
  if (event?.target) event.target.classList.add('on');

  if (state.qtState === 'quoted') {
    state.qtState = 'idle';
    state.qtRouteId = null;
    const btn = document.getElementById('qtSubmit');
    if (btn) btn.textContent = 'GET QUOTE';
    const info = document.getElementById('qtQuoteInfo');
    if (info) info.style.display = 'none';
  }
}

export async function executeQuickTrade() {
  if (!state.activeCA) { alert('Select a token first'); return; }

  const btn = document.getElementById('qtSubmit');
  const statusEl = document.getElementById('qtStatus');
  const infoEl = document.getElementById('qtQuoteInfo');
  const cfg = CHAIN_CFG[state.activeChain] || CHAIN_CFG.sol;

  // ── GET QUOTE ──
  if (state.qtState === 'idle') {
    btn.textContent = 'QUOTING...';
    btn.disabled = true;
    state.qtState = 'quoting';

    try {
      const amount = parseFloat(document.getElementById('qtAmount')?.value) || 0.1;
      const slippage = parseFloat(document.getElementById('qtSlippage')?.value) || 10;
      const rawAmount = Math.floor(amount * Math.pow(10, cfg.decimals));

      const solNative = 'So11111111111111111111111111111111111111112';
      const evmNative = '0x0000000000000000000000000000000000000000';

      let url;
      const isSell = state.qtSide === 'sell';
      if (cfg.apiPath === 'sol') {
        const tokenIn  = isSell ? state.activeCA : solNative;
        const tokenOut = isSell ? solNative       : state.activeCA;
        if (isSell) {
          // Sell by percentage of holdings
          const percent = parseFloat(document.getElementById('qtAmount')?.value) || 50;
          url = `${API_BASE}/sol/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&percent=${percent}&slippage=${slippage}`;
        } else {
          url = `${API_BASE}/sol/quote?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amount=${rawAmount}&slippage=${slippage}`;
        }
      } else {
        const tokenIn  = isSell ? state.activeCA : evmNative;
        const tokenOut = isSell ? evmNative       : state.activeCA;
        if (isSell) {
          const percent = parseFloat(document.getElementById('qtAmount')?.value) || 50;
          url = `${API_BASE}/evm/quote?chain=${state.activeChain}&tokenIn=${tokenIn}&tokenOut=${tokenOut}&percent=${percent}&slippage=${slippage}`;
        } else {
          url = `${API_BASE}/evm/quote?chain=${state.activeChain}&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amount=${rawAmount}&slippage=${slippage}`;
        }
      }

      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      state.qtRouteId = data._routeId;
      state.qtState = 'quoted';

      if (infoEl) {
        const outAmt = data.outAmount
          ? (Number(data.outAmount) / Math.pow(10, cfg.decimals)).toFixed(6)
          : '?';
        const impact = data.priceImpact || '0';
        infoEl.innerHTML =
          `Est. output: <span style="color:var(--w);">${outAmt}</span>` +
          (data.outUsd ? ` (~$${Number(data.outUsd).toFixed(2)})` : '') +
          `<br>Price impact: <span style="color:${Number(impact) > 5 ? 'var(--r)' : 'var(--g)'};">${impact}%</span>`;
        infoEl.style.display = 'block';
      }

      btn.textContent = `CONFIRM ${state.qtSide.toUpperCase()}`;
      btn.disabled = false;
    } catch (e) {
      state.qtState = 'idle';
      btn.textContent = 'GET QUOTE';
      btn.disabled = false;
      statusEl.innerHTML = `<span style="color:var(--r);">Error: ${e.message}</span>`;
      statusEl.classList.add('show');
    }
    return;
  }

  // ── EXECUTE ──
  if (state.qtState === 'quoted' && state.qtRouteId) {
    btn.textContent = 'EXECUTING...';
    btn.disabled = true;
    state.qtState = 'executing';

    try {
      const execUrl = `${API_BASE}/${cfg.apiPath}/execute`;
      const body = { routeId: state.qtRouteId };
      if (cfg.apiPath === 'evm') body.routeIndex = 0;

      const resp = await fetch(execUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      statusEl.innerHTML =
        `<span style="color:var(--o);">TX Submitted</span> ` +
        `<a href="${data.explorer}" target="_blank">${data.hash.slice(0, 12)}...</a>` +
        `<br><span id="qtPollStatus">Confirming...</span>`;
      statusEl.classList.add('show');
      btn.textContent = 'SUBMITTED';
      state.qtState = 'polling';

      pollTxStatus(data.hash, data.lastValidHeight, cfg);
    } catch (e) {
      state.qtState = 'quoted';
      btn.textContent = `CONFIRM ${state.qtSide.toUpperCase()}`;
      btn.disabled = false;
      statusEl.innerHTML = `<span style="color:var(--r);">Exec error: ${e.message}</span>`;
      statusEl.classList.add('show');
    }
  }
}

function pollTxStatus(hash, lastValidHeight, cfg) {
  const pollEl = document.getElementById('qtPollStatus');
  const btn = document.getElementById('qtSubmit');
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;
    try {
      let url;
      if (cfg.apiPath === 'sol') {
        url = `${API_BASE}/sol/status?hash=${hash}&lastValidHeight=${lastValidHeight || 0}`;
      } else {
        url = `${API_BASE}/evm/status?chain=${state.activeChain}&hash=${hash}`;
      }

      const resp = await fetch(url);
      const data = await resp.json();

      if (data.success) {
        clearInterval(interval);
        if (pollEl) pollEl.innerHTML = '<span style="color:var(--g);">Confirmed!</span>';
        resetTradeBtn(btn);
        return;
      }
      if (data.failed) {
        clearInterval(interval);
        if (pollEl) pollEl.innerHTML = '<span style="color:var(--r);">Failed on-chain</span>';
        resetTradeBtn(btn);
        return;
      }
      if (data.expired) {
        clearInterval(interval);
        if (pollEl) pollEl.innerHTML = '<span style="color:var(--r);">Expired — try again</span>';
        resetTradeBtn(btn);
        return;
      }
      if (pollEl) pollEl.textContent = `Confirming... (${attempts}s)`;
    } catch {
      if (pollEl) pollEl.textContent = `Polling... (${attempts}s)`;
    }

    if (attempts >= 60) {
      clearInterval(interval);
      if (pollEl) pollEl.innerHTML = '<span style="color:var(--o);">Timed out — check explorer</span>';
      resetTradeBtn(btn);
    }
  }, 1000);
}

function resetTradeBtn(btn) {
  if (btn) { btn.textContent = 'GET QUOTE'; btn.disabled = false; }
  state.qtState = 'idle';
  state.qtRouteId = null;
}
