import { api } from '../api.js';
import { topbarHtml } from '../ui.js';
import { renderSidebarNav } from '../router.js';

export async function renderNotifications(main) {
  const { notifications } = await api.notifications.list();
  const unread = notifications.filter((n) => !n.read).length;

  main.innerHTML = topbarHtml('Notifications', 'Booking approvals, payments and reminders', unread) + `
  <div class="card panel-pad">${notifications.length ? notifications.map((n) => `
    <div class="notif-item"><div class="notif-dot ${n.read ? 'read' : ''}"></div>
      <div><div class="notif-text">${n.text}</div><div class="notif-time">${new Date(n.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div></div>
    </div>`).join('') : '<div class="empty-state">No notifications yet.</div>'}</div>`;

  if (unread > 0) {
    setTimeout(async () => {
      await api.notifications.markAllRead();
      renderSidebarNav();
    }, 500);
  }
}
