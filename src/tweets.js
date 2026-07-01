// ═══════════════════════════════════════════
// X Tracker — tweet injection + ping sound
// ═══════════════════════════════════════════

import { state } from './state.js';

let audioCtx;

function playPing() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.26);
    o.start(audioCtx.currentTime);
    o.stop(audioCtx.currentTime + 0.26);
  } catch { /* silent fail */ }
}

const INJECT_POOL = [
  { init: 'KW', col: 'var(--o)', handle: '@KingWhale', meta: 'Whale Tracker', text: '<span class="tok">FWOG</span> just got a $62K whale buy at 2M mcap. Watch closely.', type: 'KOL' },
  { init: 'DM', col: 'var(--g)', handle: '@DeFiMaster', meta: 'KOL &middot; 55K followers', text: '<span class="tok">BONK</span> massive accumulation on 15m. This is the setup for 2x.', type: 'KOL' },
  { init: 'PP', col: 'var(--g)', handle: '@PEPEOfficial', meta: 'Official &middot; 210K', text: '<span class="tok">PEPE</span> partnership with major CEX dropping this week. &#x1F438;', type: 'PROJECT' },
  { init: 'SC', col: 'var(--o)', handle: '@SolCalls', meta: 'KOL &middot; 38K followers', text: 'New low cap gem: <span class="tok">SLOTH</span>. 480K mcap. LP burned. Renounced. Early.', type: 'KOL' },
];

function injectTweet() {
  const feed = document.getElementById('twFeed');
  if (!feed) return;

  const d = INJECT_POOL[Math.floor(Math.random() * INJECT_POOL.length)];
  const div = document.createElement('div');
  div.className = 'tweet new-tw';
  div.dataset.type = d.type;
  if (state.twFilter !== 'ALL' && d.type !== state.twFilter) div.style.display = 'none';

  div.innerHTML = `<div class="tw-top">
    <div class="tw-av" style="background:${d.col}22;color:${d.col};">${d.init}</div>
    <div class="tw-info">
      <div class="tw-handle">${d.handle}<span class="${d.type === 'KOL' ? 'kol-badge' : 'proj-badge'}">${d.type === 'KOL' ? '&#10003; KOL' : '&#x2605; PROJECT'}</span></div>
      <div class="tw-meta">${d.meta}</div>
    </div>
    <div class="tw-time">1m</div>
  </div>
  <div class="tw-text">${d.text}</div>`;

  feed.insertBefore(div, feed.firstChild);

  const hdr = document.querySelector('#colL .ph');
  if (hdr) {
    hdr.style.borderColor = 'rgba(255,92,0,0.45)';
    setTimeout(() => (hdr.style.borderColor = ''), 700);
  }

  playPing();
  while (feed.children.length > 14) feed.removeChild(feed.lastChild);
}

function scheduleTweet() {
  setTimeout(() => { injectTweet(); scheduleTweet(); }, 9000 + Math.random() * 11000);
}

export function setTwTab(el, filter) {
  document.querySelectorAll('.tw-tab').forEach((t) => t.classList.remove('on'));
  el.classList.add('on');
  state.twFilter = filter;
  document.querySelectorAll('.tweet').forEach((tw) => {
    tw.style.display = (filter === 'ALL' || tw.dataset.type === filter) ? '' : 'none';
  });
}

export function initTweets() {
  setTimeout(scheduleTweet, 7000);
}
