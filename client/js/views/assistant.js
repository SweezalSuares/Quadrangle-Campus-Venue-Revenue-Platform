import { api } from '../api.js';
import { topbarHtml, money, todayStr } from '../ui.js';

const CATEGORY_TERMS = [
  ['Auditorium', ['auditorium', 'performance']],
  ['Seminar Hall', ['seminar', 'hall', 'lecture']],
  ['Sports Ground', ['sports ground', 'sports', 'court', 'field']],
  ['Lab', ['lab', 'laboratory']],
  ['Classroom', ['classroom']],
  ['Outdoor Lawn', ['lawn', 'outdoor']],
  ['Conference Room', ['conference', 'meeting room']],
  ['Amphitheatre', ['amphitheatre', 'amphitheater']],
];

const FACILITY_TERMS = [
  ['projector', ['projector', 'projection'], ['projector']],
  ['microphone', ['microphone', 'mic'], ['microphone', 'mic']],
  ['sound system', ['sound system', 'speakers', 'audio'], ['sound system', 'speaker', 'audio', 'pa']],
  ['stage', ['stage'], ['stage']],
  ['lighting', ['lighting', 'lights'], ['lighting', 'light']],
  ['air conditioning', ['air conditioning', 'air-conditioned', 'ac'], ['air conditioning', 'air-conditioned', 'ac']],
  ['wifi', ['wifi', 'wi-fi', 'internet'], ['wifi', 'wi-fi', 'internet']],
  ['screen', ['screen'], ['screen']],
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function findRequirements(query) {
  const text = ` ${query.toLowerCase()} `;
  const matchesTerm = (term) => term.includes(' ')
    ? text.includes(term)
    : new RegExp(`\\b${term}\\b`).test(text);
  const category = CATEGORY_TERMS.find(([, terms]) => terms.some(matchesTerm))?.[0] || '';
  const capacityMatch = query.match(/\b(?:for|capacity(?:\s+of)?|accommodat(?:e|ing)|seating)\s+(\d{1,5})\b|\b(\d{1,5})\s*(?:people|persons|guests|students|seats|attendees|pax)\b/i);
  const capacity = Number(capacityMatch?.[1] || capacityMatch?.[2] || 0);
  const facilities = FACILITY_TERMS
    .filter(([, terms]) => terms.some(matchesTerm))
    .map(([name]) => name);
  return { category, capacity, facilities };
}

function isAvailable(booking, date, start, end) {
  if (booking.date !== date || !['pending', 'approved'].includes(booking.status)) return true;
  return start >= booking.end || booking.start >= end;
}

function renderResults(container, venues, bookings, requirements, date, start, end) {
  const candidates = venues
    .map((venue) => {
      const equipment = (venue.equipment || []).map((item) => item.toLowerCase());
      const missingFacilities = requirements.facilities.filter((facility) => {
        const equipmentTerms = FACILITY_TERMS.find(([name]) => name === facility)?.[2] || [facility];
        return !equipmentTerms.some((term) => equipment.some((item) =>
          term === 'pa' ? /\bpa\b/i.test(item) : item.includes(term)
        ));
      });
      const available = bookings
        .filter((booking) => String(booking.venue?._id || booking.venue) === String(venue._id))
        .every((booking) => isAvailable(booking, date, start, end));
      const enoughCapacity = !requirements.capacity || venue.capacity >= requirements.capacity;
      const correctCategory = !requirements.category || venue.category === requirements.category;
      const score = Number(correctCategory) * 4 + Number(enoughCapacity) * 3 +
        (requirements.facilities.length - missingFacilities.length) * 2 -
        venue.basePrice / 100000;
      return { venue, missingFacilities, available, enoughCapacity, correctCategory, score };
    })
    .filter((match) => match.available && match.enoughCapacity)
    .sort((a, b) => b.score - a.score || a.venue.basePrice - b.venue.basePrice)
    .slice(0, 6);
  const exactMatches = candidates.filter((match) =>
    match.correctCategory && !match.missingFacilities.length
  );
  const matches = exactMatches.length ? exactMatches : candidates;

  if (!matches.length) {
    container.innerHTML = '<div class="assistant-empty"><strong>No venue is available for that time and capacity.</strong><span>Try another time or a smaller guest count.</span><button class="btn outline small" type="button" onclick="goTo(\'calendar\')">View booking calendar</button></div>';
    return;
  }

  container.innerHTML = `<div class="assistant-result-heading"><strong>${exactMatches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : 'Closest available options'}</strong><span>Available ${escapeHtml(date)} · ${escapeHtml(start)}–${escapeHtml(end)}${exactMatches.length ? '' : ' · Some requested details may differ'}</span></div>
  <div class="assistant-results">${matches.map(({ venue, missingFacilities, correctCategory }) => `<article class="assistant-result card">
    <div class="assistant-result-top"><div><span class="venue-cat">${escapeHtml(venue.category)}</span><h3>${escapeHtml(venue.name)}</h3></div><span class="badge approved">${exactMatches.length ? 'Available' : 'Closest fit'}</span></div>
    <p>${escapeHtml(venue.location)} · Up to ${escapeHtml(venue.capacity)} people</p>
    ${missingFacilities.length || !correctCategory ? `<p class="small-muted">${!correctCategory ? `Different category than requested${missingFacilities.length ? '; ' : ''}` : ''}${missingFacilities.length ? `Missing facilities: ${missingFacilities.map(escapeHtml).join(', ')}` : ''}</p>` : ''}
    <div class="assistant-result-foot"><strong>${money(venue.basePrice)} <small>base / slot</small></strong><button class="btn brass small" type="button" onclick="openBooking('${escapeHtml(venue._id)}',{date:'${escapeHtml(date)}',start:'${escapeHtml(start)}',end:'${escapeHtml(end)}'})">Book this venue</button></div>
  </article>`).join('')}</div>`;
}

export async function renderVenueAssistant(main) {
  main.innerHTML = topbarHtml('Find a venue', 'Tell us what you need and get availability-aware suggestions.') + `
    <section class="assistant-panel card">
      <div class="assistant-intro"><span class="assistant-mark" aria-hidden="true">Q</span><div><h2>What are you planning?</h2><p>Describe your event, guest count and any facilities you need. We’ll match it to campus spaces and check the schedule.</p></div></div>
      <form id="assistant-form">
        <div class="field"><label for="assistant-query">Your request</label><textarea id="assistant-query" rows="3" placeholder="For example: A seminar room for 80 people with a projector" required></textarea></div>
        <div class="assistant-controls">
          <div class="field"><label for="assistant-date">Date</label><input id="assistant-date" type="date" value="${todayStr()}" min="${todayStr()}" required></div>
          <div class="field"><label for="assistant-start">From</label><input id="assistant-start" type="time" value="10:00" required></div>
          <div class="field"><label for="assistant-end">Until</label><input id="assistant-end" type="time" value="12:00" required></div>
          <button class="btn brass assistant-submit" type="submit">Find venues</button>
        </div>
      </form>
    </section>
    <section id="assistant-response" class="assistant-response" aria-live="polite"><div class="assistant-empty"><span>Suggestions will appear here, matched to your request and selected time.</span></div></section>`;
  document.getElementById('assistant-form').addEventListener('submit', searchVenues);
}

export function setAssistantWidgetVisible(visible) {
  const root = document.getElementById('assistant-widget-root');
  if (!root) return;
  root.hidden = !visible;
  if (!visible) {
    const panel = document.getElementById('assistant-widget-panel');
    const toggle = document.getElementById('assistant-widget-toggle');
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
}

export function mountAssistantWidget() {
  const toggle = document.getElementById('assistant-widget-toggle');
  const panel = document.getElementById('assistant-widget-panel');
  const form = document.getElementById('assistant-widget-form');
  const close = document.getElementById('assistant-widget-close');
  const response = document.getElementById('assistant-widget-response');
  const dateInput = document.getElementById('assistant-widget-date');
  if (!toggle || !panel || !form || !close || !response || !dateInput) return;

  dateInput.value = todayStr();
  dateInput.min = todayStr();
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('assistant-widget-query').focus();
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = document.getElementById('assistant-widget-query').value.trim();
    const date = dateInput.value;
    const start = document.getElementById('assistant-widget-start').value;
    const end = document.getElementById('assistant-widget-end').value;
    if (end <= start) {
      response.innerHTML = '<div class="notice bad">Choose an end time after the start time.</div>';
      return;
    }

    response.innerHTML = '<div class="loading-state">Checking campus spaces…</div>';
    try {
      const [venueData, bookingData] = await Promise.all([
        api.venues.list(),
        api.bookings.calendar(date, date),
      ]);
      renderResults(response, venueData.venues, bookingData.bookings, findRequirements(query), date, start, end);
    } catch (err) {
      response.innerHTML = `<div class="notice bad">${escapeHtml(err.message || 'Unable to find venues right now.')}</div>`;
    }
  });
}

async function searchVenues(event) {
  event.preventDefault();
  const query = document.getElementById('assistant-query').value.trim();
  const date = document.getElementById('assistant-date').value;
  const start = document.getElementById('assistant-start').value;
  const end = document.getElementById('assistant-end').value;
  const response = document.getElementById('assistant-response');
  if (end <= start) {
    response.innerHTML = '<div class="notice bad">Choose an end time after the start time.</div>';
    return;
  }
  response.innerHTML = '<div class="loading-state">Checking venues and booking availability…</div>';
  try {
    const [venueData, bookingData] = await Promise.all([
      api.venues.list(),
      api.bookings.calendar(date, date),
    ]);
    renderResults(response, venueData.venues, bookingData.bookings, findRequirements(query), date, start, end);
  } catch (err) {
    response.innerHTML = `<div class="notice bad">${escapeHtml(err.message || 'Unable to find venues right now.')}</div>`;
  }
}
