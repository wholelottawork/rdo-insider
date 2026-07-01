// ═══════════════════════════════════════════
// Sniper page — wallet list, settings, toggle
// ═══════════════════════════════════════════

import { state } from './state.js';
import { closeModal } from './modals.js';

export function openSniperPg() {
  document.getElementById('sniperPg')?.classList.add('open');
}

export function closeSniperPg() {
  document.getElementById('sniperPg')?.classList.remove('open');
}

export function selFee(el) {
  document.querySelectorAll('.fee-m').forEach((f) => f.classList.remove('on'));
  el.classList.add('on');
}

export function updateCnt() {
  const l = document.getElementById('snipeList');
  const c = document.getElementById('snipeCnt');
  if (l && c) c.textContent = '(' + l.children.length + ')';
}

export function toggleSniper() {
  state.sniperLive = !state.sniperLive;
  const btn = document.getElementById('sniperLaunch');
  const top = document.getElementById('sniperTopBtn');
  const badge = document.getElementById('spBadge');

  if (state.sniperLive) {
    if (btn) { btn.textContent = 'DEACTIVATE SNIPER'; btn.classList.add('on'); }
    top?.classList.add('live');
    if (badge) {
      badge.className = 'sp-status live';
      badge.innerHTML = '<div style="width:5px;height:5px;border-radius:50%;background:var(--o);animation:pulse-dot 0.8s ease-in-out infinite;"></div>LIVE';
    }
  } else {
    if (btn) { btn.textContent = 'ACTIVATE SNIPER'; btn.classList.remove('on'); }
    top?.classList.remove('live');
    if (badge) {
      badge.className = 'sp-status offline';
      badge.innerHTML = '<div style="width:5px;height:5px;border-radius:50%;background:var(--g);"></div>OFFLINE';
    }
  }
}

export function addSnipe() {
  const name = document.getElementById('snName')?.value.trim();
  const addr = document.getElementById('snAddr')?.value.trim();
  if (!name || !addr) return;

  const cols = ['var(--o)', 'var(--g)', 'var(--r)', '#888'];
  const col = cols[document.querySelectorAll('#snipeList .sw-item').length % cols.length];
  const init = name.slice(0, 2).toUpperCase();

  const item = document.createElement('div');
  item.className = 'sw-item';
  item.innerHTML = `<div class="sw-av" style="background:${col}22;color:${col};">${init}</div><div class="sw-info"><div class="sw-name">${name}<span class="sw-tag">1x</span></div><div class="sw-addr">${addr.slice(0, 6)}...${addr.slice(-4)}</div></div><div class="sw-stats"><div class="sw-stat"><div class="sw-sl">PnL 30D</div><div class="sw-sv pos">+$0</div></div><div class="sw-stat"><div class="sw-sl">Win</div><div class="sw-sv" style="color:var(--mid);">—</div></div></div><div class="tgl on" onclick="this.classList.toggle('on')"></div><button class="sw-del" onclick="this.closest('.sw-item').remove();window.updateCnt()">&#x2715;</button>`;

  document.getElementById('snipeList')?.appendChild(item);
  document.getElementById('snName').value = '';
  document.getElementById('snAddr').value = '';
  closeModal('addSnipeModal');
  updateCnt();
}
