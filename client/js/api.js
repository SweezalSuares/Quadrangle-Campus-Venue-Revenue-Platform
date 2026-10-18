// Thin fetch wrapper: attaches the JWT, parses JSON, and normalizes errors.
const BASE = '/api';

function getToken() {
  return localStorage.getItem('quadrangle_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
    me: () => request('/auth/me'),
  },
  venues: {
    shared: (id) => request(`/venues/share/${encodeURIComponent(id)}`, { auth: false }),
    list: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
      const q = qs.toString();
      return request(`/venues${q ? `?${q}` : ''}`);
    },
    create: (payload) => request('/venues', { method: 'POST', body: payload }),
    update: (id, payload) => request(`/venues/${id}`, { method: 'PUT', body: payload }),
    remove: (id) => request(`/venues/${id}`, { method: 'DELETE' }),
  },
  bookings: {
    quote: (params) => {
      const qs = new URLSearchParams(params);
      return request(`/bookings/quote?${qs.toString()}`);
    },
    list: (status) => request(`/bookings${status && status !== 'all' ? `?status=${status}` : ''}`),
    create: (payload) => request('/bookings', { method: 'POST', body: payload }),
    setStatus: (id, status) => request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }),
    pay: (id) => request(`/bookings/${id}/pay`, { method: 'PATCH' }),
    paymentQr: (id) => request(`/bookings/${id}/payment-qr`),
  },
  notifications: {
    list: () => request('/notifications'),
    markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  },
  users: {
    list: () => request('/users'),
  },
  analytics: {
    summary: () => request('/analytics/summary'),
    revenueByVenue: () => request('/analytics/revenue-by-venue'),
    categorySplit: () => request('/analytics/category-split'),
    weeklyVolume: () => request('/analytics/weekly-volume'),
    roleSplit: () => request('/analytics/role-split'),
    utilization: () => request('/analytics/utilization'),
  },
  pricingRules: {
    get: () => request('/pricing-rules'),
    update: (payload) => request('/pricing-rules', { method: 'PUT', body: payload }),
  },
  health: () => request('/health', { auth: false }),
};
