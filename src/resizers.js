// ═══════════════════════════════════════════
// Panel resizers — drag to resize columns + dev wallet
// ═══════════════════════════════════════════

export function initResizers() {
  // Horizontal column resizers
  let hDrag = null, hStartX = 0, hStartW = 0;

  document.querySelectorAll('.h-res').forEach((r) => {
    r.addEventListener('mousedown', (e) => {
      hDrag = r;
      r.classList.add('dragging');
      hStartX = e.clientX;
      const col = document.getElementById(r.dataset.col);
      hStartW = col.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!hDrag) return;
    const side = hDrag.dataset.side;
    const col = document.getElementById(hDrag.dataset.col);
    const delta = side === 'right' ? e.clientX - hStartX : hStartX - e.clientX;
    col.style.width = Math.max(160, Math.min(640, hStartW + delta)) + 'px';
    col.style.flex = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (hDrag) {
      hDrag.classList.remove('dragging');
      hDrag = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // Vertical chart resizer
  const cr = document.getElementById('chartRes');
  const chartArea = document.getElementById('chartArea');
  if (cr && chartArea) {
    let cDrag = false, cStartY = 0, cStartH = 0;

    cr.addEventListener('mousedown', (e) => {
      if (!chartArea.classList.contains('open')) return;
      cDrag = true;
      cr.classList.add('dragging');
      cStartY = e.clientY;
      cStartH = chartArea.getBoundingClientRect().height;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!cDrag) return;
      const newH = Math.max(120, Math.min(700, cStartH + (e.clientY - cStartY)));
      chartArea.style.height = newH + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (cDrag) {
        cDrag = false;
        cr.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // Vertical dev wallet resizer
  const vr = document.getElementById('vRes');
  const panel = document.getElementById('dwPanel');
  if (!vr || !panel) return;

  let vDrag = false, vStartY = 0, vStartH = 0;

  vr.addEventListener('mousedown', (e) => {
    vDrag = true;
    vr.classList.add('dragging');
    vStartY = e.clientY;
    vStartH = panel.getBoundingClientRect().height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!vDrag) return;
    panel.style.height = Math.max(60, Math.min(580, vStartH + (vStartY - e.clientY))) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (vDrag) {
      vDrag = false;
      vr.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}
