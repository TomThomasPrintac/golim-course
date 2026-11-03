/*
 * leaderboard.js — עמוד הטבלה: בחירת ליגה ותקופה, פודיום, חיפוש ושורת "אתה".
 */

const state = {
  leagueId: UI.param('league') || 'official',
  period: 'total', // 'total' | 'round'
  query: '',
  rows: [],
};

const els = {
  chips: document.getElementById('league-chips'),
  periods: document.querySelectorAll('[data-period]'),
  roundLabel: document.getElementById('round-label'),
  podium: document.getElementById('podium'),
  search: document.getElementById('player-search'),
  body: document.getElementById('rank-body'),
  meBar: document.getElementById('me-bar'),
};

let requestId = 0; // מזהה הבקשה האחרונה — מונע מתשובה ישנה לדרוס חדשה

// ---------- טעינה ----------

/**
 * טוען את הדירוג של הליגה והתקופה שנבחרו.
 * אם המשתמש החליף ליגה שוב לפני שהתשובה הגיעה — מתעלמים מהתשובה הישנה.
 */
async function loadBoard() {
  const thisRequest = ++requestId;
  showSkeleton();
  try {
    const data = await Api.getLeaderboard(state.leagueId, state.period);
    if (thisRequest !== requestId) return;
    state.rows = data.rows;
    els.roundLabel.textContent = `(${data.roundLabel})`;
    render();
  } catch (error) {
    if (thisRequest !== requestId) return;
    els.body.replaceChildren(UI.el('tr', {}, UI.el('td', { colspan: 4, className: 'empty-cell' }, UI.errorMessage(error))));
  }
}

function showSkeleton() {
  els.podium.replaceChildren();
  els.body.replaceChildren(...Array.from({ length: 6 }, () =>
    UI.el('tr', { className: 'skeleton-row', 'aria-hidden': 'true' }, UI.el('td', { colspan: 4 }, UI.el('span')))));
}

// ---------- בניית הממשק ----------

function render() {
  renderPodium();
  renderTable();
  renderMeBar();
}

/** שלושת הראשונים. סדר ב-DOM: 2, 1, 3 — כך המקום הראשון באמצע. */
function renderPodium() {
  const top = state.rows.slice(0, 3);
  const place = (row, medal) => row && UI.el('div', { className: `podium-place podium-place--${medal}` },
    UI.el('span', { className: 'avatar avatar--lg' }, UI.initials(row.name)),
    UI.el('strong', { className: 'podium-name' }, row.isMe ? `${row.name} (אתה)` : row.name),
    UI.el('span', { className: 'podium-points' }, `${row.points} נק׳`),
    UI.el('span', { className: 'podium-step' }, row.rank));

  els.podium.hidden = state.query !== '' || top.length === 0;
  els.podium.replaceChildren(...[place(top[1], 'silver'), place(top[0], 'gold'), place(top[2], 'bronze')].filter(Boolean));
}

function renderTable() {
  const query = state.query.trim();
  const rows = query
    ? state.rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()))
    : state.rows;

  if (rows.length === 0) {
    els.body.replaceChildren(UI.el('tr', {}, UI.el('td', { colspan: 4, className: 'empty-cell' }, `לא נמצא שחקן בשם "${query}"`)));
    return;
  }

  els.body.replaceChildren(...rows.map((row) => UI.el('tr', { className: row.isMe ? 'is-me' : null },
    UI.el('td', { className: 'rank-cell' }, row.rank),
    UI.el('td', {},
      UI.el('span', { className: 'name-cell' },
        UI.el('span', { className: 'avatar', 'aria-hidden': 'true' }, UI.initials(row.name)),
        row.name,
        row.isMe ? UI.el('span', { className: 'me-tag' }, 'אתה') : null)),
    UI.el('td', {}, `🎯 ${row.exact}`),
    UI.el('td', { className: 'points-cell' }, row.points))));
}

/** "אתה" — המקום שלי, תמיד גלוי בתחתית. */
function renderMeBar() {
  const me = state.rows.find((row) => row.isMe);
  els.meBar.hidden = !me;
  if (!me) return;
  const tied = state.rows.filter((row) => row.rank === me.rank).length > 1;
  els.meBar.replaceChildren(
    UI.el('span', { className: 'me-rank' }, `#${me.rank}`),
    UI.el('span', {}, `אתה${tied ? ' (בשוויון)' : ''} · מתוך ${state.rows.length}`),
    UI.el('strong', {}, `${me.points} נק׳`),
  );
}

async function renderChips() {
  const leagues = [{ id: 'official', name: 'הליגה הרשמית' }, ...await Api.getMyLeagues()];
  if (!leagues.some((league) => league.id === state.leagueId)) state.leagueId = 'official'; // ליגה שאינני חבר בה

  els.chips.replaceChildren(...leagues.map((league) => UI.el('button', {
    type: 'button',
    className: 'chip',
    'aria-pressed': String(league.id === state.leagueId),
    dataset: { league: league.id },
  }, league.name)));
}

// ---------- אירועים ----------

function handleChipClick(event) {
  const chip = event.target.closest('[data-league]');
  if (!chip || chip.dataset.league === state.leagueId) return;
  state.leagueId = chip.dataset.league;
  els.chips.querySelectorAll('.chip').forEach((item) => item.setAttribute('aria-pressed', String(item === chip)));
  // שומרים את הליגה בכתובת, כדי שרענון העמוד או שיתוף הקישור יציגו אותה
  history.replaceState(null, '', `?league=${state.leagueId}`);
  loadBoard();
}

function handlePeriodClick(event) {
  state.period = event.currentTarget.dataset.period;
  els.periods.forEach((button) => button.setAttribute('aria-pressed', String(button === event.currentTarget)));
  loadBoard();
}

function handleSearch() {
  state.query = els.search.value;
  renderPodium();
  renderTable();
}

async function init() {
  if (!UI.requireUser()) return;

  els.chips.addEventListener('click', handleChipClick);
  els.periods.forEach((button) => button.addEventListener('click', handlePeriodClick));
  els.search.addEventListener('input', handleSearch);

  try {
    await renderChips();
  } catch (error) {
    UI.toast(UI.errorMessage(error), 'error');
  }
  loadBoard();
}

init();
