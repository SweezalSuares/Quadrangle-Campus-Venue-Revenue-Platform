import { api } from '../api.js';
import { topbarHtml, todayStr, fmtDate } from '../ui.js';

let currentMonth = todayStr().slice(0, 7);
let selectedDate = todayStr();
let monthBookings = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
    year,
    monthNumber,
    lastDay,
  };
}

function formatMonth(month) {
  const { year, monthNumber } = monthBounds(month);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

function dateCellHtml(date, isCurrentMonth) {
  const entries = monthBookings.filter((booking) => booking.date === date);
  const selected = date === selectedDate ? ' selected' : '';
  return `<button class="calendar-day${selected}${isCurrentMonth ? '' : ' outside-month'}" type="button" data-calendar-date="${date}" aria-label="${date}, ${entries.length} bookings">
    <span class="calendar-day-number">${Number(date.slice(-2))}</span>
    ${entries.slice(0, 2).map((booking) => `<span class="calendar-event ${booking.status}" title="${escapeHtml(booking.venue?.name || 'Venue')} · ${escapeHtml(booking.start)}–${escapeHtml(booking.end)}">${escapeHtml(booking.venue?.name || 'Venue')} · ${escapeHtml(booking.start)}</span>`).join('')}
    ${entries.length > 2 ? `<span class="calendar-more">+${entries.length - 2} more</span>` : ''}
  </button>`;
}

function renderSelectedDay() {
  const events = monthBookings.filter((booking) => booking.date === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start));
  const detail = document.getElementById('calendar-day-detail');
  if (!events.length) {
    detail.innerHTML = `<div class="calendar-detail-head"><div><h3>${escapeHtml(fmtDate(selectedDate))}</h3><span class="small-muted">No reservations for this day</span></div><button class="btn outline small" type="button" onclick="goTo('assistant')">Find a venue</button></div>`;
    return;
  }
  detail.innerHTML = `<div class="calendar-detail-head"><div><h3>${escapeHtml(fmtDate(selectedDate))}</h3><span class="small-muted">${events.length} ${events.length === 1 ? 'reservation' : 'reservations'}</span></div></div>
  <div class="calendar-bookings">${events.map((booking) => `<article class="calendar-booking">
    <div class="calendar-booking-time">${escapeHtml(booking.start)}<span>${escapeHtml(booking.end)}</span></div>
    <div class="calendar-booking-info"><strong>${escapeHtml(booking.venue?.name || 'Venue unavailable')}</strong>
      <span>${escapeHtml(booking.venue?.category || '')}${booking.venue?.location ? ` · ${escapeHtml(booking.venue.location)}` : ''}${booking.venue?.capacity ? ` · Capacity ${escapeHtml(booking.venue.capacity)}` : ''}</span>
      ${booking.userName ? `<span>Booked by ${escapeHtml(booking.userName)}</span>` : ''}
      ${booking.purpose ? `<span>Purpose: ${escapeHtml(booking.purpose)}</span>` : ''}
    </div><span class="badge ${booking.status}">${escapeHtml(booking.status)}</span>
  </article>`).join('')}</div>`;
}

export async function renderCalendar(main) {
  const { from, to, year, monthNumber, lastDay } = monthBounds(currentMonth);
  const { bookings } = await api.bookings.calendar(from, to);
  monthBookings = bookings;
  const firstOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const cells = [];
  for (let index = 0; index < firstOffset; index += 1) {
    const day = new Date(year, monthNumber - 1, 1 - (firstOffset - index));
    cells.push(dateCellHtml(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, false));
  }
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(dateCellHtml(`${currentMonth}-${String(day).padStart(2, '0')}`, true));
  }
  while (cells.length % 7) {
    const day = cells.length - firstOffset + 1;
    const date = new Date(year, monthNumber - 1, day);
    cells.push(dateCellHtml(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, false));
  }

  main.innerHTML = topbarHtml('Booking calendar', 'See venue reservations and time slots across campus.') + `
    <section class="calendar-layout">
      <div class="calendar-panel card">
        <div class="calendar-toolbar"><button class="btn outline small" id="calendar-prev" type="button" aria-label="Previous month">←</button><h2>${escapeHtml(formatMonth(currentMonth))}</h2><button class="btn outline small" id="calendar-next" type="button" aria-label="Next month">→</button></div>
        <div class="calendar-grid calendar-weekdays">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `<div>${day}</div>`).join('')}</div>
        <div class="calendar-grid">${cells.join('')}</div>
        <div class="calendar-legend"><span><i class="legend-dot approved"></i>Approved</span><span><i class="legend-dot pending"></i>Pending review</span></div>
      </div>
      <aside class="calendar-detail card" id="calendar-day-detail"></aside>
    </section>`;

  if (!selectedDate.startsWith(currentMonth)) selectedDate = `${currentMonth}-${String(todayStr().startsWith(currentMonth) ? Number(todayStr().slice(-2)) : 1).padStart(2, '0')}`;
  document.getElementById('calendar-prev').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('calendar-next').addEventListener('click', () => shiftMonth(1));
  main.querySelectorAll('[data-calendar-date]').forEach((cell) => cell.addEventListener('click', () => {
    const clickedDate = cell.dataset.calendarDate;
    if (!clickedDate.startsWith(currentMonth)) {
      currentMonth = clickedDate.slice(0, 7);
      selectedDate = clickedDate;
      document.getElementById('main').innerHTML = '<div class="loading-state">Loading calendar…</div>';
      renderCalendar(document.getElementById('main')).catch((err) => {
        document.getElementById('main').innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
      });
      return;
    }
    selectedDate = clickedDate;
    main.querySelectorAll('[data-calendar-date]').forEach((dayCell) => dayCell.classList.toggle('selected', dayCell.dataset.calendarDate === selectedDate));
    renderSelectedDay();
  }));
  renderSelectedDay();
}

function shiftMonth(amount) {
  const [year, month] = currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  selectedDate = `${currentMonth}-01`;
  document.getElementById('main').innerHTML = '<div class="loading-state">Loading calendar…</div>';
  renderCalendar(document.getElementById('main')).catch((err) => {
    document.getElementById('main').innerHTML = `<div class="notice bad">${escapeHtml(err.message)}</div>`;
  });
}
