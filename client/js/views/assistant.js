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
  const capacity = Number(query.match(/\b(\d{1,5})\s*(?:people|persons|guests|students|seats|attendees)?\b/i)?.[1] || 0);
  const facilities = FACILITY_TERMS
    .filter(([, terms]) => terms.some(matchesTerm))
    .map(([name]) => name);
  return { category, capacity, facilities };
}

function isAvailable(booking, date, start, end) {
  if (booking.date !== date || booking.status === 'rejected' || booking.status === 'cancelled') return true;
  return start >= booking.end || booking.start >= end;
}

function renderResults(container, venues, bookings, requirements, date, start, end) {
  const matches = venues
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
    .filter((match) => match.available && match.enoughCapacity && match.correctCategory && !match.missingFacilities.length)
    .sort((a, b) => b.score - a.score || a.venue.basePrice - b.venue.basePrice)
    .slice(0, 6);

  if (!matches.length) {
    container.innerHTML = '<div class="assistant-empty"><strong>No available match for that time.</strong><span>Try another time, date or a less specific request.</span><button class="btn outline small" type="button" onclick="goTo(\'calendar\')">View booking calendar</button></div>';
    return;
  }

  container.innerHTML = `<div class="assistant-result-heading"><strong>${matches.length} ${matches.length === 1 ? 'match' : 'matches'}</strong><span>Available ${escapeHtml(date)} · ${escapeHtml(start)}–${escapeHtml(end)}</span></div>
  <div class="assistant-results">${matches.map(({ venue }) => `<article class="assistant-result card">
    <div class="assistant-result-top"><div><span class="venue-cat">${escapeHtml(venue.category)}</span><h3>${escapeHtml(venue.name)}</h3></div><span class="badge approved">Available</span></div>
    <p>${escapeHtml(venue.location)} · Up to ${escapeHtml(venue.capacity)} people</p>
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
