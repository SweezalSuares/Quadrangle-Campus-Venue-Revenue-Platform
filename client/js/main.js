import { api } from './api.js';
import { state, loadSession, clearSession } from './state.js';
import { registerViewRenderers, renderSidebarNav, renderView } from './router.js';
import { mountAuth } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderVenues } from './views/venues.js';
import { renderBookings } from './views/bookings.js';
import { renderRevenue } from './views/revenue.js';
import { renderNotifications } from './views/notifications.js';
import { renderUsers } from './views/users.js';
import { renderPricing } from './views/pricing.js';

registerViewRenderers({
  dashboard: renderDashboard,
  venues: renderVenues,
  bookings: renderBookings,
  revenue: renderRevenue,
  notifications: renderNotifications,
  users: renderUsers,
  pricing: renderPricing,
});

function maybeOpenSharedVenue() {
  const venueId = new URLSearchParams(window.location.search).get('venue');
  if (!venueId || !state.user || !window.openVenueDetails) return;
  state.currentView = 'venues';
  renderSidebarNav();
  renderView().then(() => {
    setTimeout(() => window.openVenueDetails(venueId), 0);
  });
}

function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('active');
  state.currentView = 'dashboard';
  state.currentTab = {};
  renderSidebarNav();
  renderView().then(maybeOpenSharedVenue);
}

function backToAuth() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'grid';
}

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  backToAuth();
});

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') window.closeModal ? window.closeModal() : document.getElementById('modal-overlay').classList.remove('active');
});
window.closeModal = function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal-box').innerHTML = '';
};

mountAuth(() => enterApp());

// If a token is already stored (page refresh), verify it and jump straight in.
(async function bootstrap() {
  if (loadSession()) {
    try {
      const { user } = await api.auth.me();
      state.user = user;
      enterApp();
    } catch (_) {
      clearSession();
      backToAuth();
    }
  }
})();
