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
import { closeModal, toast, imgUrl } from './ui.js';

registerViewRenderers({
  dashboard: renderDashboard,
  venues: renderVenues,
  bookings: renderBookings,
  revenue: renderRevenue,
  notifications: renderNotifications,
  users: renderUsers,
  pricing: renderPricing,
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function showPublicSharedVenue(venueId) {
  const screen = document.getElementById('shared-venue-screen');
  document.getElementById('landing-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').classList.remove('active');
  screen.style.display = 'block';
  screen.innerHTML = '<div class="shared-venue-state">Loading venue details…</div>';

  try {
    const { venue } = await api.venues.shared(venueId);
    const image = venue.imageUrl && (/^(https?:|data:image\/)/i.test(venue.imageUrl) || (venue.imageUrl.startsWith('/') && !venue.imageUrl.startsWith('//')))
      ? venue.imageUrl
      : imgUrl(venue.imageSeed || 'venue');
    const details = [
      ['Category', venue.category],
      ['Capacity', `${venue.capacity} people`],
      ['Location', venue.location],
      ['In-charge', venue.incharge],
      ['Base price', `${Number(venue.basePrice).toLocaleString('en-IN')} per slot`],
      ['Equipment', venue.equipment?.length ? venue.equipment.join(', ') : 'No additional equipment listed'],
    ];
    screen.innerHTML = `
      <header class="shared-venue-header">
        <a class="landing-brand" href="/" aria-label="Quadrangle home">Quad<span>rangle</span></a>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode" title="Switch to dark mode"><span aria-hidden="true">☾</span><span class="theme-label">Dark mode</span></button>
      </header>
      <article class="shared-venue-content">
        <img class="shared-venue-image" src="${escapeHtml(image)}" alt="${escapeHtml(venue.name)}" onerror="this.src='/main1.jpg'">
        <div class="shared-venue-body">
          <p class="eyebrow">Campus venue</p>
          <div class="venue-cat">${escapeHtml(venue.category)}</div>
          <h1>${escapeHtml(venue.name)}</h1>
          <p class="shared-venue-location">${escapeHtml(venue.location)}</p>
          <div class="venue-detail-list">${details.map(([label, value]) => `<div class="venue-detail-item"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join('')}</div>
          <div class="shared-venue-actions">
            <button class="btn brass" type="button" id="share-public-venue">Share venue</button>
            <button class="btn outline" type="button" id="login-to-book">Log in to book</button>
          </div>
        </div>
      </article>`;

    screen.querySelector('[data-theme-toggle]').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('share-public-venue').addEventListener('click', async () => {
      const url = window.location.href;
      try {
        if (navigator.share) await navigator.share({ title: `${venue.name} | Quadrangle`, text: `View ${venue.name} on Quadrangle.`, url });
        else if (navigator.clipboard) await navigator.clipboard.writeText(url);
        else throw new Error('Sharing is unavailable in this browser.');
        toast(navigator.share ? 'Venue link shared.' : 'Venue link copied.');
      } catch (err) {
        if (err.name !== 'AbortError') toast(err.message || 'Unable to share venue details.');
      }
    });
    document.getElementById('login-to-book').addEventListener('click', () => {
      screen.style.display = 'none';
      document.getElementById('landing-screen').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'grid';
      setAuthTab('login');
    });
  } catch (err) {
    screen.innerHTML = `
      <header class="shared-venue-header"><a class="landing-brand" href="/">Quad<span>rangle</span></a></header>
      <div class="shared-venue-state"><h1>Shared venue unavailable</h1><p>${escapeHtml(err.message)}</p><a class="btn outline" href="/">Back to Quadrangle</a></div>`;
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
  state.currentView = 'dashboard';
  state.currentTab = {};
  renderSidebarNav();
  renderView();
}

function backToLanding() {
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('landing-screen').style.display = 'block';
  window.scrollTo(0, 0);
}

const setAuthTab = mountAuth(() => enterApp());

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
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
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
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

const heroVideo = document.getElementById('landing-hero-video');
const videoToggle = document.getElementById('hero-video-toggle');
videoToggle.addEventListener('click', () => {
  if (heroVideo.paused) {
    heroVideo.play().then(() => {
      videoToggle.textContent = 'Ⅱ';
      videoToggle.setAttribute('aria-label', 'Pause campus video');
      videoToggle.setAttribute('aria-pressed', 'true');
    }).catch(() => toast('The campus video could not be played.'));
  } else {
    heroVideo.pause();
    videoToggle.textContent = '▶';
    videoToggle.setAttribute('aria-label', 'Play campus video');
    videoToggle.setAttribute('aria-pressed', 'false');
  }
});

const heroMedia = document.querySelector('.landing-hero-media');
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  heroMedia.addEventListener('pointermove', (event) => {
    const bounds = heroMedia.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroMedia.style.setProperty('--tilt-x', `${x * 2}deg`);
    heroMedia.style.setProperty('--tilt-y', `${-y * 2}deg`);
  });
  heroMedia.addEventListener('pointerleave', () => {
    heroMedia.style.setProperty('--tilt-x', '0deg');
    heroMedia.style.setProperty('--tilt-y', '0deg');
  });
}
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  heroVideo.pause();
  videoToggle.textContent = '▶';
  videoToggle.setAttribute('aria-label', 'Play campus video');
  videoToggle.setAttribute('aria-pressed', 'false');
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
  const venuePathMatch = window.location.pathname.match(/^\/venue\/([^/]+)\/?$/);
  const sharedVenueId = new URLSearchParams(window.location.search).get('venue')
    || (venuePathMatch && venuePathMatch[1]);
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
