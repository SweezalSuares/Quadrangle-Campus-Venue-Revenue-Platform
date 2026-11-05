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
import { mountAssistantWidget, renderVenueAssistant, setAssistantWidgetVisible } from './views/assistant.js';
import { renderCalendar } from './views/calendar.js';
import { closeModal, toast } from './ui.js';

registerViewRenderers({
  dashboard: renderDashboard,
  venues: renderVenues,
  bookings: renderBookings,
  revenue: renderRevenue,
  notifications: renderNotifications,
  users: renderUsers,
  pricing: renderPricing,
  assistant: renderVenueAssistant,
  calendar: renderCalendar,
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function showPublicSharedVenue(venueId) {
  document.getElementById('landing-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').classList.remove('active');
  const screen = document.getElementById('shared-venue-screen');
  screen.style.display = 'block';
  screen.innerHTML = '<div class="shared-venue-loading">Loading venue details…</div>';
  try {
    const { venue } = await api.venues.shared(venueId);
    const details = [
      ['Category', venue.category],
      ['Capacity', `${venue.capacity} people`],
      ['Location', venue.location],
      ['In-charge', venue.incharge],
      ['Base price', `${Number(venue.basePrice).toLocaleString('en-IN')} per slot`],
      ['Equipment', venue.equipment?.length ? venue.equipment.join(', ') : 'No additional equipment listed'],
    ];
    const image = venue.imageUrl && /^(https?:|data:image\/)/i.test(venue.imageUrl)
      ? venue.imageUrl
      : `/main1.jpg`;
    screen.innerHTML = `
      <header class="shared-venue-header"><a class="landing-brand" href="/">Quad<span>rangle</span></a><span>Venue details</span></header>
      <main class="shared-venue-content">
        <article class="shared-venue-card card">
          <img class="shared-venue-image" src="${escapeHtml(image)}" alt="${escapeHtml(venue.name)}" onerror="this.src='/main1.jpg'">
          <div class="shared-venue-body">
            <div class="venue-cat">${escapeHtml(venue.category)}</div>
            <h1>${escapeHtml(venue.name)}</h1>
            ${venue.description ? `<p class="shared-venue-description">${escapeHtml(venue.description)}</p>` : ''}
            <div class="venue-detail-list">${details.map(([label, value]) => `<div class="venue-detail-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join('')}</div>
          </div>
        </article>
      </main>`;
  } catch (err) {
    screen.innerHTML = `<header class="shared-venue-header"><a class="landing-brand" href="/">Quad<span>rangle</span></a><span>Venue details</span></header><main class="shared-venue-content"><div class="notice bad">${escapeHtml(err.message || 'This shared venue is unavailable.')}</div></main>`;
  }
}

function enterApp() {
  if (!state.user) {
    backToLanding();
    return;
  }
  document.getElementById('landing-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').classList.add('active');
  setAssistantWidgetVisible(true);
  state.currentView = 'dashboard';
  state.currentTab = {};
  renderSidebarNav();
  renderView();
}

function backToLanding() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('landing-screen').style.display = 'block';
  setAssistantWidgetVisible(false);
  window.scrollTo(0, 0);
}

const setAuthTab = mountAuth(() => enterApp());
mountAssistantWidget();

let themeTransitionTimer;

function setTheme(theme, animate = false) {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  window.clearTimeout(themeTransitionTimer);
  root.classList.toggle('theme-transition', animate);
  root.dataset.theme = isDark ? 'dark' : 'light';
  if (animate) {
    themeTransitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transition');
      themeTransitionTimer = undefined;
    }, 350);
  }
  try {
    localStorage.setItem('quadrangle_theme', isDark ? 'dark' : 'light');
  } catch (_) {
    // The selected appearance still applies for the current page.
  }
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const nextTheme = isDark ? 'light' : 'dark';
    const label = `Switch to ${nextTheme} mode`;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(isDark));
    const icon = button.querySelector('[aria-hidden="true"]');
    if (icon) icon.textContent = isDark ? '☼' : '☾';
    const text = button.querySelector('.theme-label');
    if (text) text.textContent = `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} mode`;
  });
}

let savedTheme = 'light';
try {
  savedTheme = localStorage.getItem('quadrangle_theme') || 'light';
} catch (_) {
  savedTheme = 'light';
}
setTheme(savedTheme);
document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
});

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById('landing-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'grid';
    setAuthTab(button.dataset.authTab);
    window.scrollTo(0, 0);
  });
});
document.getElementById('auth-back').addEventListener('click', backToLanding);
document.addEventListener('keydown', (event) => {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay.classList.contains('active')) return;
  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'Tab') {
    const focusable = [...overlay.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) {
      event.preventDefault();
      document.getElementById('modal-box').focus();
    } else if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      event.preventDefault();
      focusable[0].focus();
    }
  }
});

const landingHeader = document.querySelector('.landing-header');
function updateLandingHeader() {
  landingHeader.classList.toggle('is-scrolled', window.scrollY > 12);
}
window.addEventListener('scroll', updateLandingHeader, { passive: true });
updateLandingHeader();

const revealTargets = document.querySelectorAll(
  '.section-intro,.opportunity-card,.solution-card,.benefits-grid article,.gallery-photo,.process-steps article'
);
revealTargets.forEach((element) => element.classList.add('landing-reveal'));
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach((element) => revealObserver.observe(element));
} else {
  revealTargets.forEach((element) => element.classList.add('is-visible'));
}

const heroMedia = document.querySelector('.landing-hero-media');
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  heroMedia.addEventListener('pointermove', (event) => {
    const bounds = heroMedia.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroMedia.style.setProperty('--tilt-x', `${x * 1.5}deg`);
    heroMedia.style.setProperty('--tilt-y', `${-y * 1.5}deg`);
  });
  heroMedia.addEventListener('pointerleave', () => {
    heroMedia.style.setProperty('--tilt-x', '0deg');
    heroMedia.style.setProperty('--tilt-y', '0deg');
  });
}

window.setTimeout(() => document.getElementById('landing-loader').classList.add('is-hidden'), 650);

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  backToLanding();
});

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});
window.closeModal = closeModal;

// If a token is already stored (page refresh), verify it and jump straight in.
(async function bootstrap() {
  const sharedVenueId = new URLSearchParams(window.location.search).get('venue');
  if (sharedVenueId) {
    await showPublicSharedVenue(sharedVenueId);
    return;
  }
  if (loadSession()) {
    try {
      const { user } = await api.auth.me();
      state.user = user;
      enterApp();
    } catch (_) {
      clearSession();
      backToLanding();
    }
  }
})();
