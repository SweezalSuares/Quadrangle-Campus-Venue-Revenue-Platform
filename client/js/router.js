// Tiny hash-free router: swaps the #main content based on state.currentView.
import { state, NAV, roleLabel } from './state.js';

let viewRenderers = {};

export function registerViewRenderers(map) {
  viewRenderers = map;
}

export function renderSidebarNav() {
  const nav = NAV[state.user.role] || [];
  document.getElementById('role-badge-label').textContent = roleLabel(state.user.role).toUpperCase();
  document.getElementById('side-user-name').textContent = state.user.name;
  document.getElementById('side-user-role').textContent = roleLabel(state.user.role);
  document.getElementById('avatar-init').textContent = state.user.name.charAt(0).toUpperCase();
  document.getElementById('nav-group').innerHTML = nav.map(([key, label]) => (
    `<div class="nav-item ${state.currentView === key ? 'active' : ''}" onclick="goTo('${key}')"><span class="nav-dot"></span>${label}</div>`
  )).join('');
}

export async function renderView() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="loading-state">Loading…</div>';
  const fn = viewRenderers[state.currentView];
  if (!fn) {
    main.innerHTML = '<div class="empty-state">Unknown view.</div>';
    return;
  }
  try {
    await fn(main);
  } catch (err) {
    main.innerHTML = `<div class="notice bad">${err.message || 'Failed to load this page.'}</div>`;
  }
}

export function goTo(view) {
  state.currentView = view;
  renderSidebarNav();
  renderView();
}

window.goTo = goTo;
