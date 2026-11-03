/*
 * matches.js — עמוד הבית: כרטיס "המשחק הבא", לשוניות, סינון לפי יום ורשימת המשחקים.
 * כל הרשימה נבנית מחדש ב-DOM בכל שינוי של הסינון (render).
 */

const state = {
  matches: [],
  tab: 'upcoming', // 'upcoming' | 'results'
  day: 'all', // 'all' או מפתח יום מ-UI.dayKey
  onlyUnpredicted: false,
};

const els = {
  next: document.getElementById('next-match'),
  tabs: document.querySelectorAll('[data-tab]'),
  chips: document.getElementById('day-chips'),
  onlyUnpredicted: document.getElementById('only-unpredicted'),
  onlyUnpredictedWrap: document.getElementById('only-unpredicted-wrap'),
  summary: document.getElementById('list-summary'),
  list: document.getElementById('match-list'),
};

let lastStatuses = '';
let tickCount = 0;

// ---------- סינון ----------

/** המשחקים של הלשונית הנוכחית: הבאים (פתוחים + חיים) או תוצאות (מהחדש לישן). */
function matchesForTab() {
  if (state.tab === 'upcoming') {
    return state.matches.filter((match) => ['open', 'live'].includes(getMatchStatus(match)));
  }
  return state.matches.filter((match) => ['finished', 'pending'].includes(getMatchStatus(match))).reverse();
}

function visibleMatches() {
  return matchesForTab()
    .filter((match) => state.day === 'all' || UI.dayKey(match.kickoff) === state.day)
    .filter((match) => !state.onlyUnpredicted || (getMatchStatus(match) === 'open' && !match.myPrediction));
}

// ---------- בניית הממשק ----------

function render() {
  lastStatuses = state.matches.map((match) => getMatchStatus(match)).join();
  renderNextMatch();
  renderTabs();
  renderChips();
  renderList();
}

function renderTabs() {
  els.tabs.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tab === state.tab)));
  els.onlyUnpredictedWrap.hidden = state.tab !== 'upcoming';
}

/** שבב לכל יום שיש בו משחקים בלשונית הנוכחית. */
function renderChips() {
  const days = new Map();
  for (const match of matchesForTab()) {
    if (!days.has(UI.dayKey(match.kickoff))) days.set(UI.dayKey(match.kickoff), match.kickoff);
  }
  if (state.day !== 'all' && !days.has(state.day)) state.day = 'all'; // היום שנבחר לא קיים בלשונית הזו

  const chip = (key, label) => UI.el('button', {
    type: 'button',
    className: 'chip',
    'aria-pressed': String(state.day === key),
    dataset: { day: key },
  }, label);

  els.chips.replaceChildren(
    chip('all', 'הכל'),
    ...[...days].map(([key, kickoff]) => chip(key, UI.dayLabel(kickoff))),
  );
}

function renderList() {
  const items = visibleMatches();
  els.list.replaceChildren(...items.map(matchCard));

  if (items.length === 0) {
    const text = state.onlyUnpredicted ? 'ניחשת את כל המשחקים הפתוחים 🎉' : 'אין משחקים להצגה';
    els.list.append(UI.el('li', { className: 'empty-state' },
      UI.el('p', { className: 'empty-emoji', 'aria-hidden': 'true' }, '⚽'),
      UI.el('p', {}, text)));
  }

  const waiting = matchesForTab().filter((match) => getMatchStatus(match) === 'open' && !match.myPrediction).length;
  els.summary.textContent = state.tab === 'upcoming'
    ? `${items.length} משחקים · ${waiting} עוד מחכים לניחוש שלך`
    : `${items.length} משחקים`;
}

function teamRow(team, goals) {
  return UI.el('div', { className: 'mc-team' },
    UI.flag(team),
    UI.el('span', { className: 'mc-name' }, team.name),
    goals === undefined ? null : UI.el('span', { className: 'mc-goals' }, goals));
}

/** כרטיס משחק. כל הכרטיס הוא קישור לעמוד הניחוש של המשחק. */
function matchCard(match) {
  const status = getMatchStatus(match);
  const score = status === 'finished' ? match.result : status === 'live' ? (match.live || { home: 0, away: 0 }) : null;

  return UI.el('li', {},
    UI.el('a', { className: `match-card match-card--${status}`, href: `predict.html?match=${match.id}` },
      UI.el('div', { className: 'mc-teams' },
        teamRow(match.home, score ? score.home : undefined),
        teamRow(match.away, score ? score.away : undefined)),
      UI.el('div', { className: 'mc-side' }, ...cardSide(match, status))));
}

/** הצד של הכרטיס משתנה לפי מצב המשחק. */
function cardSide(match, status) {
  const prediction = match.myPrediction;
  const notGuessed = UI.el('span', { className: 'muted' }, 'לא ניחשת');
  const guessed = prediction
    ? UI.el('span', { className: status === 'open' ? 'mc-guess mc-guess--saved' : 'mc-guess' },
      'ניחשת ', UI.score(prediction.home, prediction.away), prediction.double ? ' ★' : '', status === 'open' ? ' ✓' : '')
    : null;

  switch (status) {
    case 'open':
      return [UI.el('span', { className: 'mc-time' }, UI.kickoffLabel(match.kickoff)),
        guessed || UI.el('span', { className: 'pill pill--cta' }, 'נחש')];
    case 'live':
      return [UI.el('span', { className: 'live-tag' }, `● חי ${UI.liveMinute(match.kickoff)}`), guessed || notGuessed];
    case 'pending':
      return [UI.el('span', { className: 'pill pill--pending', title: 'המשחק הסתיים, התוצאה בעדכון' }, 'ממתין'), guessed || notGuessed];
    default: { // finished
      const calc = calcPoints(prediction, match.result, match.stage);
      return [calc ? UI.pointsBadge(calc, prediction.double) : notGuessed, guessed];
    }
  }
}

/** כרטיס "המשחק הבא" עם ספירה לאחור עד שריקת הפתיחה. */
function renderNextMatch() {
  const next = state.matches.find((match) => getMatchStatus(match) === 'open');
  els.next.hidden = !next;
  if (!next) return;

  const bigTeam = (team) => UI.el('div', { className: 'nm-team' }, UI.flag(team, 'lg'), UI.el('span', {}, team.name));
  const cta = next.myPrediction
    ? ['ערוך ניחוש ', UI.score(next.myPrediction.home, next.myPrediction.away)]
    : ['נחש עכשיו'];

  els.next.replaceChildren(
    UI.el('div', { className: 'nm-head' },
      UI.el('h2', { id: 'next-title', className: 'card-title' }, 'המשחק הבא'),
      UI.el('span', { className: 'countdown-pill', id: 'next-countdown' })),
    UI.el('div', { className: 'nm-teams' },
      bigTeam(next.home),
      UI.el('span', { className: 'nm-time' }, UI.time(next.kickoff)),
      bigTeam(next.away)),
    UI.el('a', { className: 'btn btn--primary btn--block', href: `predict.html?match=${next.id}` }, ...cta),
  );
  updateCountdown();
}

// ---------- עדכון כל שנייה ----------

/** מעדכן את הספירה לאחור, ובונה הכל מחדש אם משחק כלשהו שינה מצב (למשל התחיל). */
function tick() {
  tickCount += 1;
  const statuses = state.matches.map((match) => getMatchStatus(match)).join();
  if (statuses !== lastStatuses) render();
  else if (tickCount % 30 === 0) renderList(); // הדקה של משחק חי
  updateCountdown();
}

function updateCountdown() {
  const pill = document.getElementById('next-countdown');
  const next = state.matches.find((match) => getMatchStatus(match) === 'open');
  if (pill && next) pill.textContent = `בעוד ${UI.countdown(next.kickoff - Date.now())}`;
}

// ---------- אירועים ----------

function handleTabClick(event) {
  state.tab = event.currentTarget.dataset.tab;
  state.day = 'all';
  render();
}

/** האזנה אחת לכל השבבים (event delegation) — השבבים נבנים מחדש בכל render. */
function handleChipClick(event) {
  const chip = event.target.closest('[data-day]');
  if (!chip) return;
  state.day = chip.dataset.day;
  renderChips();
  renderList();
}

function handleOnlyUnpredicted() {
  state.onlyUnpredicted = els.onlyUnpredicted.checked;
  renderList();
}

async function init() {
  if (!UI.requireUser()) return;

  els.tabs.forEach((button) => button.addEventListener('click', handleTabClick));
  els.chips.addEventListener('click', handleChipClick);
  els.onlyUnpredicted.addEventListener('change', handleOnlyUnpredicted);

  try {
    state.matches = await Api.getMatches();
  } catch (error) {
    els.list.replaceChildren(UI.el('li', { className: 'empty-state' },
      UI.el('p', {}, UI.errorMessage(error)),
      UI.el('button', { type: 'button', className: 'btn btn--secondary', onClick: () => location.reload() }, 'נסה שוב')));
    return;
  }
  render();
  setInterval(tick, 1000);
}

init();
