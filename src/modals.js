// ═══════════════════════════════════════════
// Modal open / close
// ═══════════════════════════════════════════

export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

export function initModals() {
  document.querySelectorAll('.overlay').forEach((o) => {
    o.addEventListener('click', (e) => {
      if (e.target === o) o.classList.remove('open');
    });
  });
}
