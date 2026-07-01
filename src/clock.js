// ═══════════════════════════════════════════
// Clock — UTC time in topbar + status bar
// ═══════════════════════════════════════════

export function initClock() {
  function tick() {
    const n = new Date();
    const p = (v) => String(v).padStart(2, '0');
    const t = `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())}`;

    const c = document.getElementById('topClock');
    if (c) c.innerHTML = `UTC ${t}<span class="blink">_</span>`;

    const s = document.getElementById('sbClock');
    if (s) s.innerHTML = `RDO ONE &middot; INSIDER &nbsp;&middot;&nbsp; UTC ${t}<span class="blink">|</span>`;
  }

  setInterval(tick, 1000);
  tick();
}
