import { api } from '../api.js';
import { state, CATEGORIES } from '../state.js';
import { topbarHtml, imgUrl, money, toast, showModal, closeModal, todayStr } from '../ui.js';
import { renderView } from '../router.js';

async function unreadCount() {
  try {
    const { notifications } = await api.notifications.list();
    return notifications.filter((n) => !n.read).length;
  } catch (_) { return 0; }
}

function venueImageSource(v) {
  if (v.imageUrl && /^(https?:|data:image\/)/i.test(v.imageUrl)) return v.imageUrl;
  return imgUrl(v.imageSeed || v.imageUrl || 'venue');
}

function buildVenueShareUrl(venueId) {
  const url = new URL(window.location.href);
  url.searchParams.set('venue', venueId);
  url.hash = '';
  return url.toString();
}

function buildVenueShareText(v) {
  const equipment = (v.equipment || []).length ? (v.equipment || []).join(', ') : 'No extra equipment listed';
  return [
    `Venue: ${v.name}`,
    `Category: ${v.category}`,
    `Location: ${v.location}`,
    `Capacity: ${v.capacity}`,
    `In-charge: ${v.incharge}`,
    `Equipment: ${equipment}`,
    `Base price: ${money(v.basePrice)} per slot`,
    `Link: ${buildVenueShareUrl(v._id)}`,
  ].join('\n');
}

export function venueCardHtml(v, u) {
  const canManage = u.role === 'manager' || u.role === 'admin';
  const canEditVenue = u.role === 'admin';
  const imageSrc = venueImageSource(v);
  return `<div class="card venue-card" onclick="openVenueDetails('${v._id}')">
    <img class="venue-img" src="${imageSrc}" alt="${v.name}" onerror="this.src='https://picsum.photos/seed/fallback/640/400'">
    <div class="venue-body">
      <div class="venue-cat">${v.category}</div>
      <div class="venue-name">${v.name}</div>
      <div class="venue-meta">
        <span>📍 ${v.location}</span>
        <span>👥 Capacity: ${v.capacity}</span>
        <span>🧑‍💼 In-charge: ${v.incharge}</span>
      </div>
      <div class="venue-foot">
        <div class="venue-price">${money(v.basePrice)} <small>/ base slot</small></div>
        <div class="venue-actions">
          <button class="btn outline small" onclick="event.stopPropagation();openVenueDetails('${v._id}')">View</button>
          <button class="btn outline small" onclick="event.stopPropagation();shareVenue('${v._id}')">Share</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
        ${canEditVenue
          ? `<button class="btn outline small" onclick="event.stopPropagation();openVenueEdit('${v._id}')">Edit</button>`
          : ''}
        ${canManage
          ? `<button class="btn danger small" onclick="event.stopPropagation();deleteVenue('${v._id}')">Remove</button>`
          : `<button class="btn brass small block" onclick="event.stopPropagation();openBooking('${v._id}')">Check availability & book</button>`}
      </div>
    </div>
  </div>`;
}

export async function renderVenues(main) {
  const u = state.user;
  const canManage = u.role === 'manager' || u.role === 'admin';
  const unread = await unreadCount();
  const { venues } = await api.venues.list();

  main.innerHTML = topbarHtml('Campus venues', canManage ? 'Manage listings, capacity and images' : 'Search, compare and reserve a space', unread) + `
  <div class="filter-bar">
    <div class="field"><label>Search</label><input id="f-search" placeholder="Name or location"></div>
    <div class="field"><label>Category</label><select id="f-cat"><option value="">All categories</option>${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="field"><label>Min. capacity</label><input id="f-cap" type="number" placeholder="e.g. 50"></div>
    <button class="btn outline" id="f-apply">Apply filters</button>
    ${canManage ? `<button class="btn brass" onclick="openVenueEdit(null)">+ Add venue</button>` : ''}
  </div>
  <div class="venue-grid" id="venue-grid">${venues.length ? venues.map((v) => venueCardHtml(v, u)).join('') : '<div class="empty-state">No venues yet.</div>'}</div>`;

  document.getElementById('f-apply').addEventListener('click', () => applyVenueFilters());
  ['f-search', 'f-cap'].forEach((id) => document.getElementById(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') applyVenueFilters(); }));
}

async function applyVenueFilters() {
  const search = document.getElementById('f-search').value.trim();
  const category = document.getElementById('f-cat').value;
  const minCapacity = document.getElementById('f-cap').value;
  const grid = document.getElementById('venue-grid');
  grid.innerHTML = '<div class="loading-state">Searching…</div>';
  try {
    const { venues } = await api.venues.list({ search, category, minCapacity });
    grid.innerHTML = venues.length ? venues.map((v) => venueCardHtml(v, state.user)).join('') : '<div class="empty-state">No venues match those filters.</div>';
  } catch (err) {
    grid.innerHTML = `<div class="notice bad">${err.message}</div>`;
  }
}
window.applyVenueFilters = applyVenueFilters;

/* ---------------- Venue CRUD (manager/admin) ---------------- */
async function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Image upload failed.'));
    reader.readAsDataURL(file);
  });
}

window.openVenueEdit = async function openVenueEdit(venueId) {
  let v = { name: '', category: CATEGORIES[0], capacity: 50, location: '', incharge: '', equipment: [], basePrice: 3000, imageSeed: `venue${Date.now()}`, imageUrl: '' };
  if (venueId) {
    const { venues } = await api.venues.list();
    v = venues.find((x) => x._id === venueId) || v;
  }
  showModal(`
  <div class="modal-head"><h3>${venueId ? 'Edit venue' : 'Add new venue'}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
  <div class="field"><label>Venue name</label><input id="mv-name" value="${v.name}"></div>
  <div class="grid2">
    <div class="field"><label>Category</label><select id="mv-cat">${CATEGORIES.map((c) => `<option ${c === v.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Capacity</label><input id="mv-cap" type="number" value="${v.capacity}"></div>
  </div>
  <div class="field"><label>Location</label><input id="mv-loc" value="${v.location}"></div>
  <div class="grid2">
    <div class="field"><label>Incharge person</label><input id="mv-incharge" value="${v.incharge}"></div>
    <div class="field"><label>Base price (₹, per slot)</label><input id="mv-price" type="number" value="${v.basePrice}"></div>
  </div>
  <div class="field"><label>Equipment / facilities (comma separated)</label><input id="mv-equip" value="${(v.equipment || []).join(', ')}"></div>
  <div class="field"><label>Image keyword (used to generate a preview photo)</label><input id="mv-img" value="${v.imageSeed || 'venue'}"></div>
  <div class="field"><label>Image URL (optional)</label><input id="mv-image-url" type="url" value="${v.imageUrl || ''}" placeholder="https://example.com/venue.jpg"></div>
  <div class="field"><label>Or upload an image (optional)</label><input id="mv-image-file" type="file" accept="image/*"></div>
  <button class="btn brass block" id="mv-save">${venueId ? 'Save changes' : 'Add venue'}</button>`);
  document.getElementById('mv-save').addEventListener('click', () => saveVenue(venueId));
};

async function saveVenue(venueId) {
  const fileInput = document.getElementById('mv-image-file');
  const urlInput = document.getElementById('mv-image-url');
  const imageSeed = document.getElementById('mv-img').value.trim() || `venue${Date.now()}`;
  let imageUrl = urlInput ? urlInput.value.trim() : '';

  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      imageUrl = await readImageFile(fileInput.files[0]);
    } catch (err) {
      toast(err.message);
      return;
    }
  }

  const payload = {
    name: document.getElementById('mv-name').value.trim(),
    category: document.getElementById('mv-cat').value,
    capacity: parseInt(document.getElementById('mv-cap').value, 10) || 0,
    location: document.getElementById('mv-loc').value.trim(),
    incharge: document.getElementById('mv-incharge').value.trim(),
    basePrice: parseInt(document.getElementById('mv-price').value, 10) || 0,
    equipment: document.getElementById('mv-equip').value.split(',').map((s) => s.trim()).filter(Boolean),
    imageUrl,
    imageSeed,
  };
  if (!payload.name) { toast('Give the venue a name first.'); return; }
  try {
    if (venueId) { await api.venues.update(venueId, payload); toast('Venue updated.'); }
    else { await api.venues.create(payload); toast('Venue added.'); }
    closeModal();
    renderView();
  } catch (err) {
    toast(err.message);
  }
}

window.shareVenue = async function shareVenue(venueId) {
  const { venues } = await api.venues.list();
  const v = venues.find((x) => x._id === venueId);
  if (!v) return;

  const shareUrl = buildVenueShareUrl(v._id);
  const shareText = buildVenueShareText(v);
  const shareData = {
    title: `${v.name} | Quadrangle Venue`,
    text: shareText,
    url: shareUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      toast('Venue link shared.');
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    toast('Venue link copied to your clipboard.');
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      toast('Unable to share venue details right now.');
    }
  }
};

window.openVenueDetails = async function openVenueDetails(venueId) {
  const { venues } = await api.venues.list();
  const v = venues.find((x) => x._id === venueId);
  if (!v) return;

  const details = [
    { label: 'Category', value: v.category },
    { label: 'Capacity', value: `${v.capacity} people` },
    { label: 'Location', value: v.location },
    { label: 'In-charge', value: v.incharge },
    { label: 'Base price', value: `${money(v.basePrice)} per slot` },
    { label: 'Equipment', value: (v.equipment || []).length ? (v.equipment || []).join(', ') : 'No additional equipment listed' },
  ];

  showModal(`
    <div class="modal-head"><h3>${v.name}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="venue-detail-hero">
      <img src="${venueImageSource(v)}" alt="${v.name}" onerror="this.src='https://picsum.photos/seed/fallback/640/400'">
      <div>
        <div class="venue-cat">${v.category}</div>
        <div class="small-muted" style="margin-top:6px;">Capacity ${v.capacity} · Base ${money(v.basePrice)} / slot</div>
        <div class="small-muted" style="margin-top:10px;">${v.location}</div>
      </div>
    </div>
    <div class="venue-detail-list">
      ${details.map((item) => `<div class="venue-detail-item"><b>${item.label}</b><span>${item.value}</span></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px; margin-top:18px; flex-wrap:wrap;">
      <button class="btn brass" onclick="shareVenue('${v._id}')">Share venue</button>
      <button class="btn outline" onclick="openBooking('${v._id}')">Book this venue</button>
      ${state.user.role === 'admin' ? `<button class="btn outline" onclick="openVenueEdit('${v._id}')">Edit</button>` : ''}
    </div>`);
};

window.deleteVenue = async function deleteVenue(venueId) {
  if (!confirm('Remove this venue? Existing bookings for it will stay on record.')) return;
  try {
    await api.venues.remove(venueId);
    toast('Venue removed.');
    renderView();
  } catch (err) {
    toast(err.message);
  }
};

/* ---------------- Booking flow ---------------- */
let draft = {};

window.openBooking = async function openBooking(venueId) {
  const { venues } = await api.venues.list();
  const v = venues.find((x) => x._id === venueId);
  draft = { venueId, date: todayStr(), start: '18:00', end: '20:00' };
  await renderBookingModal(v);
};

function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }

async function renderBookingModal(v) {
  const d = draft;
  let quote;
  try {
    quote = await api.bookings.quote({ venueId: v._id, date: d.date, start: d.start, end: d.end });
  } catch (err) {
    showModal(`<div class="modal-head"><h3>${v.name}</h3><button class="modal-close" onclick="closeModal()">×</button></div><div class="notice bad">${err.message}</div>`);
    return;
  }

  let conflictHtml = '';
  if (quote.conflict && quote.suggestions) {
    const { conflictWith, openSlots, alternateVenues } = quote.suggestions;
    conflictHtml = `<div class="notice bad"><b>Conflict detected:</b> this venue is already booked ${conflictWith.start}–${conflictWith.end} that day.</div>
    ${openSlots.length ? `<div class="small-muted" style="margin-bottom:6px;">Suggested open slots at this venue:</div><div style="margin-bottom:10px;">${openSlots.map((s) => `<span class="slot-chip" onclick="pickSlot('${s.start}','${s.end}')">${s.start} – ${s.end}</span>`).join('')}</div>` : ''}
    ${alternateVenues.length ? `<div class="small-muted" style="margin-bottom:6px;">Or consider a similar venue:</div>${alternateVenues.map((a) => `<div class="small-muted">• ${a.name} (cap. ${a.capacity}) — <a href="#" onclick="event.preventDefault();openBooking('${a.id}')">view</a></div>`).join('')}` : ''}`;
  }

  showModal(`
  <div class="modal-head"><h3>${v.name}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
  <div class="small-muted" style="margin-bottom:14px;">${v.category} · Capacity ${v.capacity} · In-charge: ${v.incharge}</div>
  <div><span class="step-num">1</span><b>Choose date & time</b></div>
  <div class="grid2" style="margin-top:10px;">
    <div class="field"><label>Date</label><input id="bk-date" type="date" value="${d.date}" min="${todayStr()}"></div>
    <div class="field"><label>Purpose</label><input id="bk-purpose" placeholder="e.g. Workshop, product launch"></div>
    <div class="field"><label>Start time</label><input id="bk-start" type="time" value="${d.start}"></div>
    <div class="field"><label>End time</label><input id="bk-end" type="time" value="${d.end}"></div>
  </div>
  ${conflictHtml}
  <hr class="div">
  <div><span class="step-num">2</span><b>AI dynamic price</b> <span class="badge ${quote.demand}" style="margin-left:6px;">${quote.demand} demand</span></div>
  <div class="price-live">${money(quote.price)}</div>
  <div class="small-muted">Base ${money(v.basePrice)} · adjusted for day, time slot and current demand at this venue.</div>
  <hr class="div">
  <button class="btn brass block" id="bk-submit" ${quote.conflict ? 'disabled' : ''}>Submit booking request</button>
  <div class="small-muted" style="margin-top:8px;">Facility management reviews requests and confirms availability before payment.</div>`);

  ['bk-date', 'bk-start', 'bk-end'].forEach((id) => {
    document.getElementById(id).addEventListener('change', async () => {
      draft.date = document.getElementById('bk-date').value;
      draft.start = document.getElementById('bk-start').value;
      draft.end = document.getElementById('bk-end').value;
      await renderBookingModal(v);
    });
  });
  const submitBtn = document.getElementById('bk-submit');
  if (submitBtn) submitBtn.addEventListener('click', () => submitBooking(v));
}

window.pickSlot = async function pickSlot(s, e) {
  draft.start = s; draft.end = e;
  const { venues } = await api.venues.list();
  const v = venues.find((x) => x._id === draft.venueId);
  await renderBookingModal(v);
};

async function submitBooking(v) {
  const purpose = document.getElementById('bk-purpose').value.trim() || 'Not specified';
  if (toMin(draft.end) <= toMin(draft.start)) { toast('End time must be after start time.'); return; }
  try {
    await api.bookings.create({ venueId: v._id, date: draft.date, start: draft.start, end: draft.end, purpose });
    closeModal();
    toast('Booking request submitted.');
    window.goTo('bookings');
  } catch (err) {
    toast(err.message);
  }
}
