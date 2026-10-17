import { api } from '../api.js';
import { state } from '../state.js';
import { topbarHtml, imgUrl, money, fmtDate, toast, showModal, closeModal } from '../ui.js';
import { renderView } from '../router.js';

async function unreadCount() {
  try {
    const { notifications } = await api.notifications.list();
    return notifications.filter((n) => !n.read).length;
  } catch (_) { return 0; }
}

function actionButtons(b, u) {
  let btns = '';
  const bookingUserId = b.user && typeof b.user === 'object' ? b.user._id : b.user;
  const isOwner = Boolean(u && bookingUserId && String(bookingUserId) === String(u.id));
  const canManage = u && (u.role === 'manager' || u.role === 'admin');
  if (canManage && b.status === 'pending') {
    btns += `<button class="btn small outline" onclick="setStatus('${b._id}','approved')">Approve</button><button class="btn small danger" onclick="setStatus('${b._id}','rejected')">Reject</button>`;
  }
  if (canManage && b.status === 'approved' && b.paymentStatus === 'unpaid') {
    btns += `<button class="btn small outline" onclick="markPaid('${b._id}')">Mark paid</button>`;
  }
  if (isOwner && b.status === 'approved' && b.paymentStatus === 'unpaid') {
    btns += `<button class="btn small brass" onclick="openPayment('${b._id}')">Pay now</button>`;
  }
  if (isOwner && b.status === 'pending') {
    btns += `<button class="btn small ghost" onclick="setStatus('${b._id}','cancelled')">Cancel</button>`;
  }
  if (b.status === 'approved' && b.paymentStatus === 'paid') {
    btns += `<button class="btn small outline" onclick="openPayment('${b._id}')">View receipt</button>`;
  }
  return btns;
}

export function bookingRowHtml(b, u) {
  const canManage = u && (u.role === 'manager' || u.role === 'admin');
  const venue = b.venue && typeof b.venue === 'object' ? b.venue : {};
  const bookingUser = b.user && typeof b.user === 'object' ? b.user : {};
  const venueName = venue.name || 'Venue no longer available';
  const userName = bookingUser.name || 'Former user';
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
    <div style="display:flex;gap:10px;align-items:center;">
      <img class="venue-thumb-sm" src="${imgUrl(venue.imageSeed || 'venue')}" alt="">
      <div>
        <div style="font-weight:600;">${venueName}</div>
        <div class="small-muted">${fmtDate(b.date)} · ${b.start}–${b.end} ${canManage ? `· ${userName} (${b.userRole})` : ''}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="badge ${b.status}">${b.status}</span>
      <span class="badge ${b.paymentStatus}">${b.paymentStatus}</span>
      <span style="font-weight:600;">${money(b.price)}</span>
      ${actionButtons(b, u)}
    </div>
  </div>`;
}

export async function renderBookings(main) {
  const u = state.user;
  if (!u) {
    main.innerHTML = '<div class="notice bad">Your session has expired. Please log in again.</div>';
    return;
  }
  const canManage = u.role === 'manager' || u.role === 'admin';
  const unread = await unreadCount();
  const tab = state.currentTab.bookings || 'all';
  const { bookings: scope } = await api.bookings.list('all');
  const tabs = ['all', 'pending', 'approved', 'rejected', 'cancelled'];
  const list = tab === 'all' ? scope : scope.filter((b) => b.status === tab);
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));

  main.innerHTML = topbarHtml(canManage ? 'All bookings' : 'My bookings', canManage ? 'Approve, reject and track payments' : 'Track the status of your reservations', unread) + `
  <div class="tabs">${tabs.map((t) => `<button class="tab-btn ${tab === t ? 'active' : ''}" onclick="setBookingTab('${t}')">${t[0].toUpperCase() + t.slice(1)} ${t !== 'all' ? `(${scope.filter((b) => b.status === t).length})` : ''}</button>`).join('')}</div>
  <div class="card panel-pad">${sorted.length ? sorted.map((b) => bookingRowHtml(b, u)).join('<hr class="div">') : '<div class="empty-state">No bookings in this filter.</div>'}</div>`;
}

window.setBookingTab = function setBookingTab(t) {
  state.currentTab.bookings = t;
  renderView();
};

window.setStatus = async function setStatus(bookingId, status) {
  try {
    await api.bookings.setStatus(bookingId, status);
    toast(`Booking ${status}.`);
    renderView();
  } catch (err) {
    toast(err.message);
  }
};

window.markPaid = async function markPaid(bookingId) {
  try {
    await api.bookings.pay(bookingId);
    toast('Marked as paid.');
    renderView();
  } catch (err) {
    toast(err.message);
  }
};

window.openPayment = async function openPayment(bookingId) {
  try {
    const { bookings } = await api.bookings.list('all');
    const b = bookings.find((x) => x._id === bookingId);
    if (!b) {
      toast('This booking could not be found.');
      return;
    }
    const qr = await api.bookings.paymentQr(bookingId);
    const venueName = b.venue?.name || 'Venue no longer available';
    showModal(`
    <div class="modal-head"><h3>${b.paymentStatus === 'paid' ? 'Payment receipt' : 'Complete payment'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="small-muted">${venueName} · ${fmtDate(b.date)} · ${b.start}–${b.end}</div>
    <div class="price-live" style="margin-top:10px;">${money(b.price)}</div>
    <div class="qr-wrap"><img src="${qr.dataUrl}" alt="Payment QR code" width="180" height="180"></div>
    <div class="small-muted" style="text-align:center;">Scan with any UPI app to pay booking charges to Quadrangle Campus Facilities.</div>
    <hr class="div">
    ${b.paymentStatus === 'paid'
      ? `<div class="notice good">Payment received. Booking ID: ${b._id}</div>`
      : `<button class="btn brass block" id="confirm-pay-btn">I've paid — mark as complete</button>`}
    `);
    const btn = document.getElementById('confirm-pay-btn');
    if (btn) btn.addEventListener('click', async () => {
      await api.bookings.pay(bookingId);
      toast('Payment confirmed.');
      openPayment(bookingId);
      renderView();
    });
  } catch (err) {
    toast(err.message);
  }
};
