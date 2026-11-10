/*
 * profile.js — עמוד הפרופיל: עריכת שם, סטטיסטיקה, היסטוריית ניחושים, חוקי הניקוד וכלי בדיקה.
 */

const els = {
  avatar: document.getElementById('profile-avatar'),
  name: document.getElementById('profile-name'),
  email: document.getElementById('profile-email'),
  editBtn: document.getElementById('edit-name-btn'),
  nameForm: document.getElementById('name-form'),
  nameInput: document.getElementById('new-name'),
  cancelName: document.getElementById('cancel-name-btn'),
  stats: document.getElementById('stats'),
  history: document.getElementById('history'),
  rulesBody: document.getElementById('rules-body'),
  kickoffSoon: document.getElementById('kickoff-soon-btn'),
  reset: document.getElementById('reset-btn'),
  demoResult: document.getElementById('demo-result'),
  logout: document.getElementById('logout-btn'),
};

// ---------- פרטים אישיים ----------

function renderIdentity(user) {
  els.avatar.textContent = UI.initials(user.name);
  els.name.textContent = user.name;
  els.email.textContent = user.email;
}

/** פותח וסוגר את טופס עריכת השם (הצגה/הסתרה של תוכן). */
function toggleNameForm(open) {
  els.nameForm.hidden = !open;
  els.editBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    els.nameInput.value = els.name.textContent;
    UI.clearFieldError(els.nameInput);
    els.nameInput.select();
  } else {
    els.editBtn.focus();
  }
}

async function handleNameSubmit(event) {
  event.preventDefault();
  const check = Validation.displayName(els.nameInput.value);
  if (!check.valid) {
    UI.setFieldError(els.nameInput, check.error);
    els.nameInput.focus();
    return;
  }

  const button = els.nameForm.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'שומר…');
  try {
    const user = await Api.updateName(check.value);
    renderIdentity(user);
    UI.mountUserChip(user); // השם מתעדכן מיד גם בכותרת העליונה
    toggleNameForm(false);
    UI.toast('השם עודכן ✓', 'success');
  } catch (error) {
    UI.setFieldError(els.nameInput, UI.errorMessage(error));
  } finally {
    UI.setBusy(button, false);
  }
}

// ---------- סטטיסטיקה והיסטוריה ----------

function renderStats(summary, rank) {
  const hits = summary.exact + summary.diff + summary.direction;
  const hitRate = summary.count ? Math.round((hits / summary.count) * 100) : 0;
  const stat = (label, value) => UI.el('div', { className: 'stat' }, UI.el('dt', {}, label), UI.el('dd', {}, value));

  els.stats.replaceChildren(
    stat('נקודות', summary.points),
    stat('מקום בליגה הרשמית', rank ? `#${rank}` : '—'),
    stat('ניחושים מדויקים', summary.exact),
    stat('אחוז פגיעה', `${hitRate}%`),
  );
}

/** כל המשחקים שהתחילו ושניחשתי, מהחדש לישן. */
function renderHistory(matches) {
  const played = matches
    .filter((match) => match.myPrediction && getMatchStatus(match) !== 'open')
    .reverse();

  if (played.length === 0) {
    els.history.replaceChildren(UI.el('li', { className: 'muted' }, 'עוד אין משחקים שהסתיימו עם ניחוש שלך.'));
    return;
  }

  els.history.replaceChildren(...played.map((match) => {
    const prediction = match.myPrediction;
    const status = getMatchStatus(match);
    const calc = calcPoints(prediction, match.result, match.stage);
    let outcome;
    if (calc) outcome = UI.pointsBadge(calc, prediction.double);
    else if (status === 'pending') outcome = UI.el('span', { className: 'pill pill--pending' }, 'ממתין');
    else outcome = UI.el('span', { className: 'live-tag' }, '● חי');

    return UI.el('li', { className: 'history-item' },
      UI.el('div', {},
        UI.el('strong', {}, `${match.home.name}–${match.away.name}`),
        UI.el('p', { className: 'muted' },
          'ניחשת ', UI.score(prediction.home, prediction.away),
          match.result ? [' · תוצאה ', UI.score(match.result.home, match.result.away)] : null)),
      UI.el('a', { href: `predict.html?match=${match.id}`, className: 'history-link', 'aria-label': `פרטי המשחק ${match.home.name}–${match.away.name}` }, outcome));
  }));
}

/** טבלת הניקוד לכל שלבי הטורניר — נבנית מ-STAGES, כך שיש מקור אחד לחוקים. */
function renderRules() {
  els.rulesBody.replaceChildren(...Object.values(STAGES).map((stage) => UI.el('tr', {},
    UI.el('th', { scope: 'row' }, stage.label),
    UI.el('td', {}, stage.points.exact),
    UI.el('td', {}, stage.points.diff),
    UI.el('td', {}, stage.points.direction),
    UI.el('td', {}, stage.doubleAllowed ? '✓' : '—'))));
}

// ---------- כלי בדיקה ----------

function handleKickoffSoon() {
  const match = Api.demo.kickoffSoon();
  if (!match) {
    els.demoResult.textContent = 'אין משחקים פתוחים.';
    return;
  }
  els.demoResult.replaceChildren(
    `${match.home.name}–${match.away.name} ייפתח בעוד דקה. `,
    UI.el('a', { href: `predict.html?match=${match.id}` }, 'פתח את עמוד הניחוש שלו'));
}

function handleReset() {
  if (!window.confirm('למחוק את כל נתוני הדמו מהדפדפן (חשבונות, ניחושים וליגות)?')) return;
  Api.demo.reset();
  location.replace('index.html');
}

function handleLogout() {
  Api.logout();
  location.replace('index.html');
}

// ---------- אתחול ----------

async function init() {
  const user = UI.requireUser();
  if (!user) return;

  renderIdentity(user);
  renderRules();

  els.editBtn.addEventListener('click', () => toggleNameForm(els.nameForm.hidden));
  els.cancelName.addEventListener('click', () => toggleNameForm(false));
  els.nameForm.addEventListener('submit', handleNameSubmit);
  els.nameInput.addEventListener('input', () => UI.clearFieldError(els.nameInput));
  els.kickoffSoon.addEventListener('click', handleKickoffSoon);
  els.reset.addEventListener('click', handleReset);
  els.logout.addEventListener('click', handleLogout);

  try {
    const [matches, board] = await Promise.all([
      Api.getMatches(),
      Api.getLeaderboard('official', 'total'),
    ]);
    const me = board.rows.find((row) => row.isMe);
    const scored = matches
      .filter((match) => match.result && match.myPrediction)
      .map((match) => calcPoints(match.myPrediction, match.result, match.stage));
    renderStats(summarizeScores(scored), me ? me.rank : null);
    renderHistory(matches);
  } catch (error) {
    UI.toast(UI.errorMessage(error), 'error');
  }
}

init();
