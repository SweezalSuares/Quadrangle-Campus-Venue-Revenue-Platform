// Small shared render helpers used across every view module.
export function imgUrl(seed) { return `https://picsum.photos/seed/${encodeURIComponent(seed || 'venue')}/640/400`; }

export function fmtDate(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function money(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function toast(msg) {
  const host = document.getElementById('toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function showModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('active');
}
export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal-box').innerHTML = '';
}

export function topbarHtml(title, sub, unread) {
  return `<div class="topbar"><div><div class="page-title">${title}</div><div class="page-sub">${sub || ''}</div></div>
  <button class="bell-btn" onclick="goTo('notifications')">🔔 ${unread > 0 ? `<span class="bell-dot">${unread}</span>` : ''}</button></div>`;
}

export function errorNotice(err) {
  return `<div class="notice bad">${err && err.message ? err.message : 'Something went wrong.'}</div>`;
}
