import { api } from '../api.js';
import { topbarHtml, money } from '../ui.js';

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

export async function renderRevenue(main) {
  const unread = await unreadCount();
  const [summary, { data: util }, { data: revByVenue }, { data: catSplit }, weekly, { club, external }] = await Promise.all([
    api.analytics.summary(),
    api.analytics.utilization(),
    api.analytics.revenueByVenue(),
    api.analytics.categorySplit(),
    api.analytics.weeklyVolume(),
    api.analytics.roleSplit(),
  ]);
  const sortedUtil = [...util].sort((a, b) => b.utilizationPct - a.utilizationPct);
  const most = sortedUtil[0];
  const least = sortedUtil[sortedUtil.length - 1];

  main.innerHTML = topbarHtml('Revenue & analytics', 'AI-assisted utilisation and demand insights across all venues', unread) + `
  <div class="stat-row">
    <div class="stat-card alt"><b>${money(summary.totalRevenue)}</b><span>Collected revenue</span></div>
    <div class="stat-card warn"><b>${money(summary.pendingRevenue)}</b><span>Approved, awaiting payment</span></div>
    <div class="stat-card"><b>${most ? most.name.split(' ')[0] : '—'}…</b><span>Highest utilisation ${most ? `(${most.utilizationPct}%)` : ''}</span></div>
    <div class="stat-card"><b>${least ? least.name.split(' ')[0] : '—'}…</b><span>Lowest utilisation ${least ? `(${least.utilizationPct}%)` : ''}</span></div>
  </div>
  <div class="chart-row">
    <div class="card panel-pad"><h3 style="margin-bottom:10px;">Revenue by venue</h3><canvas id="chart-rev-venue" height="200"></canvas></div>
    <div class="card panel-pad"><h3 style="margin-bottom:10px;">Bookings by category</h3><canvas id="chart-cat-split" height="200"></canvas></div>
  </div>
  <div class="chart-row">
    <div class="card panel-pad"><h3 style="margin-bottom:10px;">Weekly booking volume (last 6 weeks)</h3><canvas id="chart-weekly" height="200"></canvas></div>
    <div class="card panel-pad"><h3 style="margin-bottom:10px;">Club vs external bookings</h3><canvas id="chart-split2" height="200"></canvas></div>
  </div>
  <div class="section">
    <div class="section-head"><h3>Venue utilisation</h3><span class="small-muted">% of assumed monthly bookable slots filled</span></div>
    <div class="card panel-pad"><table><thead><tr><th>Venue</th><th>Bookings on record</th><th>Utilisation</th><th>AI demand outlook</th></tr></thead><tbody>
    ${sortedUtil.map((x) => `<tr><td>${x.name}</td><td>${x.bookingCount}</td><td>${x.utilizationPct}%</td><td><span class="badge ${x.demand}">${x.demand}</span></td></tr>`).join('')}
    </tbody></table></div>
  </div>`;

  renderSafeChart('chart-rev-venue', {
    type: 'bar',
    data: { labels: revByVenue.map((v) => (v.name.length > 14 ? `${v.name.slice(0, 14)}…` : v.name)), datasets: [{ label: 'Revenue (₹)', data: revByVenue.map((v) => v.revenue), backgroundColor: '#B8860B' }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true } } },
  }, 'Revenue chart is unavailable right now.');
  renderSafeChart('chart-cat-split', {
    type: 'doughnut',
    data: { labels: Object.keys(catSplit), datasets: [{ data: Object.values(catSplit), backgroundColor: ['#12213B', '#B8860B', '#2F6F4E', '#A6402A', '#5B6472', '#7C9CC7', '#C9A227', '#8E5B4F'] }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } },
  }, 'Category split chart is unavailable right now.');
  renderSafeChart('chart-weekly', {
    type: 'line',
    data: { labels: weekly.labels, datasets: [{ label: 'Bookings', data: weekly.counts, borderColor: '#12213B', backgroundColor: 'rgba(18,33,59,0.08)', fill: true, tension: 0.3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  }, 'Weekly booking chart is unavailable right now.');
  renderSafeChart('chart-split2', {
    type: 'pie',
    data: { labels: ['Student club', 'External client'], datasets: [{ data: [club, external], backgroundColor: ['#2F6F4E', '#A6402A'] }] },
    options: { plugins: { legend: { position: 'bottom' } } },
  }, 'Booking split chart is unavailable right now.');
}
