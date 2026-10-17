// Small shared session/view state, persisted across reloads via localStorage.
export const state = {
  user: null,
  currentView: 'dashboard',
  currentTab: {},
};

export function saveSession(token, user) {
  localStorage.setItem('quadrangle_token', token);
  localStorage.setItem('quadrangle_user', JSON.stringify(user));
  state.user = user;
}

export function loadSession() {
  const token = localStorage.getItem('quadrangle_token');
  const userRaw = localStorage.getItem('quadrangle_user');
  if (token && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      if (!user || typeof user !== 'object' || typeof user.name !== 'string' ||
          typeof user.role !== 'string' || !(user.id || user._id)) {
        clearSession();
        return false;
      }
      state.user = user;
      return true;
    } catch (_) {
      clearSession();
      return false;
    }
  }
  clearSession();
  return false;
}

export function clearSession() {
  localStorage.removeItem('quadrangle_token');
  localStorage.removeItem('quadrangle_user');
  state.user = null;
}

export const CATEGORIES = [
  'Auditorium', 'Seminar Hall', 'Sports Ground', 'Lab',
  'Classroom', 'Outdoor Lawn', 'Conference Room', 'Amphitheatre',
];

export const NAV = {
  external: [['dashboard', 'Dashboard'], ['venues', 'Browse Venues'], ['bookings', 'My Bookings'], ['notifications', 'Notifications']],
  club: [['dashboard', 'Dashboard'], ['venues', 'Browse Venues'], ['bookings', 'My Bookings'], ['notifications', 'Notifications']],
  manager: [['dashboard', 'Dashboard'], ['venues', 'Venues'], ['bookings', 'Bookings'], ['revenue', 'Revenue & Analytics'], ['notifications', 'Notifications']],
  admin: [['dashboard', 'Dashboard'], ['venues', 'Venues'], ['bookings', 'Bookings'], ['users', 'Users'], ['revenue', 'Revenue & Analytics'], ['pricing', 'Pricing Rules'], ['notifications', 'Notifications']],
};

export function roleLabel(r) {
  return { admin: 'Campus Admin', manager: 'Facility & Finance', club: 'Student Club', external: 'External Client' }[r] || r;
}
