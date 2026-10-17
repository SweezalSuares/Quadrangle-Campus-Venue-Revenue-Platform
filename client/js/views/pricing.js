import { api } from '../api.js';
import { topbarHtml, toast } from '../ui.js';

async function unreadCount() {
  try {
    const { notifications } = await api.notifications.list();
    return notifications.filter((n) => !n.read).length;
  } catch (_) { return 0; }
}

export async function renderPricing(main) {
  const unread = await unreadCount();
  const { rules: r } = await api.pricingRules.get();

  main.innerHTML = topbarHtml('Dynamic pricing rules', 'These weights drive the AI price shown at booking time', unread) + `
  <div class="card panel-pad">
  <div class="grid2">
    <div class="field"><label>Weekend uplift</label><input id="pr-weekend" type="number" step="0.01" value="${r.weekend}"></div>
    <div class="field"><label>Weekday uplift</label><input id="pr-weekday" type="number" step="0.01" value="${r.weekday}"></div>
    <div class="field"><label>Morning slot uplift</label><input id="pr-morning" type="number" step="0.01" value="${r.morning}"></div>
    <div class="field"><label>Afternoon slot uplift</label><input id="pr-afternoon" type="number" step="0.01" value="${r.afternoon}"></div>
    <div class="field"><label>Evening (peak) uplift</label><input id="pr-evening" type="number" step="0.01" value="${r.evening}"></div>
    <div class="field"><label>Demand step (per recent booking)</label><input id="pr-demandStep" type="number" step="0.01" value="${r.demandStep}"></div>
    <div class="field"><label>Demand cap</label><input id="pr-demandCap" type="number" step="0.01" value="${r.demandCap}"></div>
    <div class="field"><label>Popular category boost</label><input id="pr-popularBoost" type="number" step="0.01" value="${r.popularBoost}"></div>
  </div>
  <div class="notice info">Popular categories currently: ${(r.popularCategories || []).join(', ')}.</div>
  <button class="btn brass" id="pr-save">Save pricing rules</button>
  </div>`;

  document.getElementById('pr-save').addEventListener('click', async () => {
    const ids = ['weekend', 'weekday', 'morning', 'afternoon', 'evening', 'demandStep', 'demandCap', 'popularBoost'];
    const payload = {};
    ids.forEach((k) => { payload[k] = parseFloat(document.getElementById(`pr-${k}`).value) || 0; });
    try {
      await api.pricingRules.update(payload);
      toast('Pricing rules updated — new bookings will use the revised formula.');
    } catch (err) {
      toast(err.message);
    }
  });
}
