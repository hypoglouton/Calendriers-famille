const STORAGE_KEY = 'calendar_multi_tabs_v3';
const LEGACY_KEYS = ['calendar_multi_tabs_v1'];
const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const weekdayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const personPalette = ['tone-1','tone-2','tone-3','tone-4','tone-5','tone-6'];

const defaultState = {
  currentDate: new Date().toISOString().slice(0, 10),
  activeTab: 'all',
  people: [
    { id: safeId(), name: 'Richard', color: 'tone-1' },
    { id: safeId(), name: 'Margot', color: 'tone-2' }
  ],
  events: [],
  theme: 'serious'
};

let state = loadState();
const tabsBar = document.getElementById('tabsBar');
const viewRoot = document.getElementById('viewRoot');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const searchInput = document.getElementById('searchInput');
const appointmentDialog = document.getElementById('appointmentDialog');
const appointmentForm = document.getElementById('appointmentForm');
const personDialog = document.getElementById('personDialog');
const personForm = document.getElementById('personForm');
const deleteEventBtn = document.getElementById('deleteEventBtn');
const themeSelect = document.getElementById('themeSelect');

init();

function init() {
  normalizeState();
  seedDemoIfEmpty();
  render();
  bindGlobalActions();
}

function safeId() {
  return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Math.random().toString(36).slice(2, 10)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    const saved = raw ? JSON.parse(raw) : null;
    return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState() {
  if (!Array.isArray(state.people)) state.people = [];
  if (!Array.isArray(state.events)) state.events = [];

  state.people = state.people
    .filter(p => p && p.id && p.name)
    .map((p, index) => ({
      id: p.id,
      name: String(p.name).trim() || `Personne ${index + 1}`,
      color: p.color || personPalette[index % personPalette.length]
    }));

  if (state.people.length === 0) {
    state.people = structuredClone(defaultState.people);
  }

  const validIds = new Set(state.people.map(p => p.id));
  state.events = state.events
    .filter(e => e && e.date && e.time && e.label)
    .map(e => ({
      id: e.id || safeId(),
      ownerId: validIds.has(e.ownerId) ? e.ownerId : state.people[0].id,
      date: e.date,
      time: e.time,
      label: e.label,
      location: e.location || '',
      notes: e.notes || '',
      duration: Number(e.duration) || 30
    }));

  if (!['serious','ocean','sunset','forest','lavender','contrast'].includes(state.theme)) {
    state.theme = 'serious';
  }

  if (state.activeTab !== 'all' && !validIds.has(state.activeTab)) {
    state.activeTab = 'all';
  }

  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedDemoIfEmpty() {
  if (state.events.length > 0) return;
  const [p1, p2] = state.people;
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  state.events = [
    mkEvent(p1.id, `${y}-${m}-08`, '09:30', 'Dentiste', 'Cabinet médical', 'Contrôle annuel', 30),
    mkEvent(p1.id, `${y}-${m}-12`, '14:00', 'Réunion client', 'Teams', '', 60),
    mkEvent(p2.id, `${y}-${m}-12`, '16:30', 'Cours de guitare', 'Studio', '', 45),
    mkEvent(p2.id, `${y}-${m}-20`, '11:00', 'Orthodontiste', '', '', 30)
  ];
  saveState();
}

function mkEvent(ownerId, date, time, label, location = '', notes = '', duration = 30) {
  return { id: safeId(), ownerId, date, time, label, location, notes, duration };
}

function bindGlobalActions() {
  document.getElementById('prevMonthBtn').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonthBtn').addEventListener('click', () => shiftMonth(1));
  document.getElementById('todayBtn').addEventListener('click', () => {
    state.currentDate = new Date().toISOString().slice(0, 10);
    render();
  });
  themeSelect.value = state.theme || 'serious';
  applyTheme(state.theme || 'serious');
  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
    saveState();
    applyTheme(state.theme);
  });

  document.getElementById('addPersonBtn').addEventListener('click', () => {
    document.getElementById('personName').value = '';
    personDialog.showModal();
  });
  searchInput.addEventListener('input', render);

  personForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('personName').value.trim();
    if (!name) return;
    const person = { id: safeId(), name, color: nextColor() };
    state.people.push(person);
    state.activeTab = person.id;
    saveState();
    personDialog.close();
    render();
  });

  appointmentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEventFromForm();
  });

  deleteEventBtn.addEventListener('click', () => {
    const id = document.getElementById('eventId').value;
    if (!id) return;
    state.events = state.events.filter(e => e.id !== id);
    saveState();
    appointmentDialog.close();
    render();
  });
}

function nextColor() {
  return personPalette[state.people.length % personPalette.length];
}


function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName || 'serious');
}

function shiftMonth(delta) {
  const d = getCurrentMonthDate();
  d.setMonth(d.getMonth() + delta);
  state.currentDate = toDateInputValue(d);
  render();
}

function getCurrentMonthDate() {
  return new Date(`${state.currentDate}T12:00:00`);
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function render() {
  renderTabs();
  renderMonthLabel();
  renderView();
}

function renderTabs() {
  const buttons = [`<button class="tab-btn ${state.activeTab === 'all' ? 'active' : ''}" data-tab="all">Vue finale - Tous les RDV</button>`]
    .concat(state.people.map(p => `
      <button class="tab-btn ${state.activeTab === p.id ? 'active' : ''}" data-tab="${p.id}">${escapeHtml(p.name)}</button>
    `))
    .join('');
  tabsBar.innerHTML = buttons;
  [...tabsBar.querySelectorAll('[data-tab]')].forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      saveState();
      render();
    });
  });
}

function renderMonthLabel() {
  const d = getCurrentMonthDate();
  currentMonthLabel.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function renderView() {
  if (state.activeTab === 'all') {
    viewRoot.innerHTML = renderCombinedCalendar();
    bindCalendarActions();
  } else {
    viewRoot.innerHTML = renderPersonCalendar(state.activeTab);
    bindCalendarActions();
  }
}

function renderPersonCalendar(personId) {
  const d = getCurrentMonthDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  const monthMatrix = buildMonthMatrix(year, month);
  const today = toDateInputValue(new Date());
  const person = state.people.find(p => p.id === personId);

  return `
    <section class="calendar-shell">
      <div class="view-title-row">
        <div>
          <h2>${escapeHtml(person?.name || 'Calendrier')}</h2>
          <p>Vue mensuelle de cette personne.</p>
        </div>
      </div>
      <div class="weekdays">${weekdayNames.map(w => `<div class="weekday">${w}</div>`).join('')}</div>
      <div class="grid">
        ${monthMatrix.map(day => renderDayCell(day, today, getFilteredEvents().filter(e => e.ownerId === personId && e.date === toDateInputValue(day.date)).sort(compareEvents), false, personId)).join('')}
      </div>
    </section>
  `;
}

function renderCombinedCalendar() {
  const monthEvents = getFilteredEvents()
    .map(e => ({ ...e, ownerName: getPerson(e.ownerId)?.name || 'Sans nom', color: getPerson(e.ownerId)?.color || 'tone-1' }))
    .sort(compareEvents);

  const groups = groupBy(monthEvents, e => e.date);
  const total = monthEvents.length;
  const peopleCount = new Set(monthEvents.map(e => e.ownerId)).size;
  const nextEvent = monthEvents.find(e => `${e.date}T${e.time}` >= new Date().toISOString().slice(0,16));

  const d = getCurrentMonthDate();
  const monthMatrix = buildMonthMatrix(d.getFullYear(), d.getMonth());
  const today = toDateInputValue(new Date());

  return `
    <section class="agenda-shell compact-shell">
      <div class="agenda-head">
        <div>
          <h2>Vue finale consolidée</h2>
          <p>Le calendrier complet de toutes les personnes, avec une lecture visuelle des journées et une liste détaillée en dessous.</p>
        </div>
        <div class="kpis">
          <div class="kpi"><span>Total RDV</span><strong>${total}</strong></div>
          <div class="kpi"><span>Personnes concernées</span><strong>${peopleCount}</strong></div>
          <div class="kpi"><span>Prochain RDV</span><strong>${nextEvent ? `${formatDateFr(nextEvent.date, true)} · ${nextEvent.time}` : '—'}</strong></div>
        </div>
      </div>
      <div class="legend-row">
        ${state.people.map(p => `<span class="legend-pill ${p.color}">${escapeHtml(p.name)}</span>`).join('')}
      </div>
    </section>

    <section class="calendar-shell combined-shell">
      <div class="weekdays">${weekdayNames.map(w => `<div class="weekday">${w}</div>`).join('')}</div>
      <div class="grid combined-grid">
        ${monthMatrix.map(day => renderDayCell(day, today, monthEvents.filter(e => e.date === toDateInputValue(day.date)), true)).join('')}
      </div>
    </section>

    <section class="agenda-shell details-shell">
      <div class="agenda-list">
        ${Object.keys(groups).length ? Object.entries(groups).map(([date, items]) => `
          <section class="agenda-day">
            <div class="agenda-day-header">
              <div>${formatDateFr(date)}</div>
              <div>${items.length} rendez-vous</div>
            </div>
            <table class="agenda-table">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Personne</th>
                  <th>Rendez-vous</th>
                  <th>Lieu / notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(e => `
                  <tr>
                    <td>${e.time}</td>
                    <td><span class="person-pill ${e.color}">${escapeHtml(e.ownerName)}</span></td>
                    <td>${escapeHtml(e.label)}</td>
                    <td>${escapeHtml([e.location, e.notes].filter(Boolean).join(' — ') || '—')}</td>
                    <td><button class="ghost-btn" data-edit-id="${e.id}">Modifier</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        `).join('') : '<div class="empty-day">Aucun rendez-vous pour les filtres actuels.</div>'}
      </div>
    </section>
  `;
}

function renderDayCell(day, today, events, isCombined = false, ownerId = '') {
  const iso = toDateInputValue(day.date);
  const capped = events.slice(0, isCombined ? 4 : 3);
  const remaining = events.length - capped.length;

  return `
    <article class="day-cell ${day.currentMonth ? '' : 'outside'} ${iso === today ? 'today' : ''}">
      <div class="day-head">
        <span class="day-number">${day.date.getDate()}</span>
        ${day.currentMonth ? `<button class="add-mini-btn" data-add-date="${iso}" data-owner="${ownerId || state.people[0]?.id || ''}" title="Ajouter">+</button>` : ''}
      </div>
      <div class="events-stack">
        ${capped.length ? capped.map(e => renderEventChip(e, isCombined)).join('') : '<div class="empty-day">Aucun rendez-vous</div>'}
        ${remaining > 0 ? `<div class="more-chip">+ ${remaining} autre(s)</div>` : ''}
      </div>
    </article>
  `;
}

function renderEventChip(e, showOwner = false) {
  const owner = getPerson(e.ownerId);
  const tone = owner?.color || 'tone-1';
  return `
    <button class="event-chip ${tone}" data-edit-id="${e.id}">
      <time>${e.time}</time>
      <span>${escapeHtml(e.label)}</span>
      ${showOwner ? `<small>${escapeHtml(owner?.name || 'Sans nom')}</small>` : (e.location ? `<small>${escapeHtml(e.location)}</small>` : '')}
    </button>
  `;
}

function bindCalendarActions() {
  viewRoot.querySelectorAll('[data-add-date]').forEach(btn => {
    btn.addEventListener('click', () => openEventDialog({
      ownerId: btn.dataset.owner || state.people[0]?.id || '',
      date: btn.dataset.addDate
    }));
  });
  viewRoot.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const event = state.events.find(e => e.id === btn.dataset.editId);
      if (event) openEventDialog(event);
    });
  });
}

function openEventDialog(event) {
  const isEdit = !!event.id;
  document.getElementById('dialogTitle').textContent = isEdit ? 'Modifier le rendez-vous' : 'Ajouter un rendez-vous';
  document.getElementById('eventId').value = event.id || '';
  document.getElementById('eventOwnerId').value = event.ownerId;
  document.getElementById('eventDate').value = event.date;
  document.getElementById('eventLabel').value = event.label || '';
  document.getElementById('eventTime').value = event.time || '09:00';
  document.getElementById('eventDuration').value = String(event.duration || 30);
  document.getElementById('eventLocation').value = event.location || '';
  document.getElementById('eventNotes').value = event.notes || '';
  deleteEventBtn.classList.toggle('hidden', !isEdit);
  appointmentDialog.showModal();
}

function saveEventFromForm() {
  const payload = {
    id: document.getElementById('eventId').value || safeId(),
    ownerId: document.getElementById('eventOwnerId').value || state.people[0].id,
    date: document.getElementById('eventDate').value,
    label: document.getElementById('eventLabel').value.trim(),
    time: document.getElementById('eventTime').value,
    duration: Number(document.getElementById('eventDuration').value),
    location: document.getElementById('eventLocation').value.trim(),
    notes: document.getElementById('eventNotes').value.trim()
  };
  const idx = state.events.findIndex(e => e.id === payload.id);
  if (idx >= 0) state.events[idx] = payload;
  else state.events.push(payload);
  state.events.sort(compareEvents);
  saveState();
  appointmentDialog.close();
  render();
}

function getFilteredEvents() {
  const query = searchInput.value.trim().toLowerCase();
  const events = state.activeTab === 'all'
    ? state.events
    : state.events.filter(e => e.ownerId === state.activeTab);

  const current = getCurrentMonthDate();
  const y = current.getFullYear();
  const m = current.getMonth();

  return events.filter(e => {
    const eventDate = new Date(`${e.date}T12:00:00`);
    const sameMonth = eventDate.getFullYear() === y && eventDate.getMonth() === m;
    if (!sameMonth) return false;
    if (!query) return true;
    const ownerName = state.people.find(p => p.id === e.ownerId)?.name?.toLowerCase() || '';
    return [e.label, e.location, e.notes, ownerName, e.time].join(' ').toLowerCase().includes(query);
  });
}

function buildMonthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const firstDay = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDay);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({ date, currentMonth: date.getMonth() === month });
  }
  return days;
}

function compareEvents(a, b) {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function formatDateFr(dateStr, short = false) {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: short ? undefined : 'long',
    day: 'numeric',
    month: 'long',
    year: short ? undefined : 'numeric'
  }).format(d);
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function getPerson(id) {
  return state.people.find(p => p.id === id);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
