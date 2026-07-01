// ═══════════════════════════════════════════
// GMGN Chart — iframe embed
// ═══════════════════════════════════════════

import { CHAIN_CFG } from './state.js';

export function loadChart(ca, chain) {
  const gmgnChain = CHAIN_CFG[chain]?.gmgnChain || chain;
  const url = `https://www.gmgn.cc/kline/${gmgnChain}/${ca}?theme=dark&interval=1S`;

  const frame = document.getElementById('chartFrame');
  if (frame) frame.src = url;

  const area = document.getElementById('chartArea');
  if (area) area.classList.add('open');
}

export function toggleChart() {
  const area = document.getElementById('chartArea');
  if (!area) return;

  const btn = area.querySelector('.chart-toggle');
  if (area.classList.contains('open')) {
    area.classList.remove('open');
    if (btn) btn.textContent = 'SHOW CHART';
  } else {
    area.classList.add('open');
    if (btn) btn.textContent = 'HIDE CHART';
  }
}
