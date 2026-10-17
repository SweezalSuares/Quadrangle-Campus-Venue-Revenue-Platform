import { api } from '../api.js';
import { topbarHtml } from '../ui.js';
import { roleLabel } from '../state.js';

async function unreadCount() {
  try {
    const { notifications } = await api.notifications.list();
    return notifications.filter((n) => !n.read).length;
  } catch (_) { return 0; }
}

export async function renderUsers(main) {
  const unread = await unreadCount();
  const { users } = await api.users.list();
  main.innerHTML = topbarHtml('Users', 'Everyone with access to Quadrangle', unread) + `
  <div class="card panel-pad"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Bookings made</th></tr></thead><tbody>
  ${users.map((x) => `<tr><td>${x.name}</td><td>${x.email}</td><td><span class="badge medium">${roleLabel(x.role)}</span></td><td>${x.bookingCount}</td></tr>`).join('')}
  </tbody></table></div>`;
}
