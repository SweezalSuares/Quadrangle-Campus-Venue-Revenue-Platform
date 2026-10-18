import { api } from '../api.js';
import { state } from '../state.js';
import { topbarHtml, money, fmtDate, imgUrl, todayStr } from '../ui.js';
import { bookingRowHtml } from './bookings.js';
import { venueCardHtml } from './venues.js';

async function unreadCount() {
  try {
    const { notifications } = await api.notifications.list();
    return notifications.filter((n) => !n.read).length;
  } catch (_) { return 0; }
}

function renderSafeChart(canvasId, config, fallbackText) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    canvas.replaceWith(Object.assign(document.createElement('div'), {
      className: 'notice info',
      textContent: fallbackText,
    }));
    return;
  }
  new Chart(canvas, config);
}

export async function renderDashboard(main) {
  const u = state.user;
  if (!u) {
    main.innerHTML = '<div class="notice bad">Your session has expired. Please log in again.</div>';
    return;
  }
  const unread = await unreadCount();

  if (u.role === 'external' || u.role === 'club') {
    const { bookings } = await api.bookings.list('all');
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const approved = bookings.filter((b) => b.status === 'approved').length;
    const spend = bookings.filter((b) => b.paymentStatus === 'paid').reduce((s, b) => s + b.price, 0);
    const { venues } = await api.venues.list({ minCapacity: u.role === 'club' ? 40 : 80 });

    main.innerHTML = topbarHtml(`Welcome back, ${u.name.split(' ')[0]}`, 'Your workspace', unread) + `
    <div class="stat-row">
      <div class="stat-card"><b>${bookings.length}</b><span>Total bookings made</span></div>
      <div class="stat-card alt"><b>${approved}</b><span>Confirmed reservations</span></div>
      <div class="stat-card warn"><b>${pending}</b><span>Awaiting approval</span></div>
      <div class="stat-card"><b>${money(spend)}</b><span>Paid to date</span></div>
    </div>
    <div class="section">
      <div class="section-head"><h3>Recommended for you</h3><span class="small-muted">Matched on capacity fit</span></div>
      <div class="venue-grid">${venues.length ? venues.slice(0, 3).map((v) => venueCardHtml(v, u)).join('') : '<div class="empty-state">No venues are currently available.</div>'}</div>
    </div>`;
    return;
  }

  if (u.role === 'manager') {
    const [{ bookings: pendingList }, summary, { data: util }] = await Promise.all([
      api.bookings.list('pending'),
      api.analytics.summary(),
      api.analytics.utilization(),
    ]);
    const { bookings: approvedUpcoming } = await api.bookings.list('approved');
    const upcoming = approvedUpcoming.filter((b) => b.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    const under = [...util].sort((a, b) => a.utilizationPct - b.utilizationPct)[0];

    main.innerHTML = topbarHtml('Facility & Finance overview', 'All campus venues, revenue and pending approvals', unread) + `
    <div class="stat-row">
      <div class="stat-card"><b>${summary.totalVenues}</b><span>Managed venues</span></div>
      <div class="stat-card warn"><b>${summary.pendingCount}</b><span>Requests to review</span></div>
      <div class="stat-card alt"><b>${money(summary.totalRevenue)}</b><span>Revenue collected</span></div>
      <div class="stat-card"><b>${money(summary.pendingRevenue)}</b><span>Expected (approved, unpaid)</span></div>
    </div>
    ${under ? `<div class="notice info"><b>AI insight:</b> ${under.name} is running at just ${under.utilizationPct}% utilisation — consider a promotional rate or outreach to clubs.</div>` : ''}
    <div class="section">
      <div class="section-head"><h3>Pending booking requests</h3><button class="link-btn" onclick="goTo('bookings')">Review all →</button></div>
      <div class="card panel-pad">${pendingList.length ? pendingList.slice(0, 5).map((b) => bookingRowHtml(b, u)).join('<hr class="div">') : '<div class="empty-state">No pending requests — all caught up.</div>'}</div>
    </div>
    <div class="section">
      <div class="section-head"><h3>Today & upcoming</h3></div>
      <div class="card panel-pad">${upcoming.length ? `<table><thead><tr><th>Venue</th><th>Date</th><th>Time</th><th>Booked by</th><th>Payment</th></tr></thead><tbody>
      ${upcoming.map((b) => `<tr><td>${b.venue?.name || 'Venue no longer available'}</td><td>${fmtDate(b.date)}</td><td>${b.start}–${b.end}</td><td>${b.user?.name || 'Former user'}</td><td><span class="badge ${b.paymentStatus}">${b.paymentStatus}</span></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty-state">No confirmed bookings on the calendar yet.</div>'}</div>
    </div>`;
    return;
  }

  if (u.role === 'admin') {
    const [summary, { data: revByVenue }, { club, external }] = await Promise.all([
      api.analytics.summary(),
      api.analytics.revenueByVenue(),
      api.analytics.roleSplit(),
    ]);
    main.innerHTML = topbarHtml('System overview', 'Users, venues, bookings and platform health', unread) + `
    <div class="stat-row">
      <div class="stat-card"><b>${summary.totalUsers}</b><span>Registered users</span></div>
      <div class="stat-card"><b>${summary.totalVenues}</b><span>Venues on platform</span></div>
      <div class="stat-card alt"><b>${summary.totalBookings}</b><span>Total booking records</span></div>
      <div class="stat-card"><b>${money(summary.totalRevenue)}</b><span>Lifetime revenue collected</span></div>
    </div>
    <div class="chart-row">
      <div class="card panel-pad"><h3 style="margin-bottom:10px;">Revenue by venue</h3><canvas id="chart-admin-rev" height="180"></canvas></div>
      <div class="card panel-pad"><h3 style="margin-bottom:10px;">Club vs external bookings</h3><canvas id="chart-admin-split" height="180"></canvas></div>
    </div>
    `;

    renderSafeChart('chart-admin-rev', {
      type: 'bar',
      data: { labels: revByVenue.map((v) => (v.name.length > 14 ? `${v.name.slice(0, 14)}…` : v.name)), datasets: [{ label: 'Revenue (₹)', data: revByVenue.map((v) => v.revenue), backgroundColor: '#B8860B' }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true } } },
    }, 'Revenue chart is unavailable right now.');
    renderSafeChart('chart-admin-split', {
      type: 'pie',
      data: { labels: ['Student club', 'External client'], datasets: [{ data: [club, external], backgroundColor: ['#2F6F4E', '#A6402A'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    }, 'Split chart is unavailable right now.');
    return;
  }

  main.innerHTML = '<div class="notice bad">This account does not have a dashboard role.</div>';
}
