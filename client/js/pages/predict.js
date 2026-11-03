/*
 * predict.js — עמוד הניחוש: השירות המרכזי של גולים.
 *
 * המשתמש בוחר תוצאה (כפתורי +/− או הקלדה), יכול להפעיל ★×2, ושומר.
 * לפני השמירה: ולידציה לכל שדה ובדיקה שהמשחק עוד לא התחיל.
 * בשריקת הפתיחה הטופס ננעל — גם אם העמוד פתוח באותו רגע.
 */

const AUTO_ADVANCE_MS = 2500;

const els = {
  loadMessage: document.getElementById('load-message'),
  content: document.getElementById('predict-content'),
  notFound: document.getElementById('not-found'),
  countdown: document.getElementById('lock-countdown'),
  hero: document.getElementById('match-hero'),
  unsaved: document.getElementById('unsaved-banner'),
  locked: document.getElementById('locked-banner'),
  form: document.getElementById('prediction-form'),
  home: document.getElementById('home-goals'),
  away: document.getElementById('away-goals'),
  double: document.getElementById('double'),
  doubleRow: document.getElementById('double-row'),
  doubleHint: document.getElementById('double-hint'),
  formError: document.getElementById('form-error'),
  saveRow: document.getElementById('save-row'),
  save: document.getElementById('save-btn'),
  success: document.getElementById('save-success'),
  successNext: document.getElementById('success-next'),
  stay: document.getElementById('stay-btn'),
  distribution: document.getElementById('distribution'),
  rules: document.getElementById('rules'),
  nextLink: document.getElementById('next-link'),
};

let match = null; // המשחק בעמוד
let allMatches = []; // כל המשחקים — למשחק הבא ולבדיקת ★×2
let saved = null; // הניחוש השמור האחרון, להשוואה מול הטופס
let isLocked = false;
let isSaving = false;
let countdownTimer = null;
let advanceTimer = null;

// ---------- קריאת הטופס ----------

/** הניחוש שבטופס כרגע. ערך לא תקין נשאר כטקסט (הוולידציה תתפוס אותו בשמירה). */
function formValues() {
  return { home: els.home.value.trim(), away: els.away.value.trim(), double: els.double.checked };
}

/** האם יש בטופס שינוי שעוד לא נשמר. בלי ניחוש שמור משווים ל-0–0. */
function isDirty() {
  const current = formValues();
  const base = saved || { home: 0, away: 0, double: false };
  return current.home !== String(base.home) || current.away !== String(base.away) || current.double !== base.double;
}

// ---------- עדכון הממשק בזמן עריכה ----------

/** נקרא אחרי כל שינוי בטופס. */
function onFormChange() {
  const { home, away } = formValues();
  // הכפתור מציג את התוצאה שתישמר (או ? כשהשדה לא תקין)
  const show = (value) => (/^\d{1,2}$/.test(value) ? value : '?');
  els.save.replaceChildren('שמור ניחוש ', UI.score(show(home), show(away)));

  for (const button of els.form.querySelectorAll('.step-btn')) {
    const value = Number((button.dataset.side === 'home' ? els.home : els.away).value);
    const step = Number(button.dataset.step);
    button.disabled = isLocked || (step > 0 && value >= MAX_GOALS) || (step < 0 && value <= 0);
  }

  els.unsaved.hidden = isLocked || !isDirty();
  els.formError.textContent = '';
  hideSuccess();
}

/** לחיצה על + או −. האזנה אחת לכל הכפתורים (event delegation). */
function handleStep(event) {
  const button = event.target.closest('.step-btn');
  if (!button) return;
  const input = button.dataset.side === 'home' ? els.home : els.away;
  const current = /^\d+$/.test(input.value) ? Number(input.value) : 0;
  const next = Math.min(MAX_GOALS, Math.max(0, current + Number(button.dataset.step)));
  input.value = next;
  UI.clearFieldError(input);
  onFormChange();
}

function handleGoalsInput(event) {
  UI.clearFieldError(event.target);
  onFormChange();
}

/** הסבר מתחת למתג ★×2: האם הוא יעבור ממשחק אחר, או שכבר נוצל. */
function updateDoubleHint() {
  const other = allMatches.find((item) =>
    item.id !== match.id && item.round === match.round && item.myPrediction && item.myPrediction.double);
  els.doubleHint.classList.remove('hint--warn');

  if (!other) {
    els.doubleHint.textContent = `מכפיל את הניקוד. פעם אחת ב${match.roundLabel}.`;
  } else if (getMatchStatus(other) !== 'open') {
    els.doubleHint.textContent = `כבר השתמשת ב-${DOUBLE_LABEL} ב${match.roundLabel}, על ${other.home.name}–${other.away.name} שכבר התחיל.`;
    els.doubleHint.classList.add('hint--warn');
  } else if (els.double.checked) {
    els.doubleHint.textContent = `ה-${DOUBLE_LABEL} יעבור מ${other.home.name}–${other.away.name} למשחק הזה.`;
    els.doubleHint.classList.add('hint--warn');
  } else {
    els.doubleHint.textContent = `ה-${DOUBLE_LABEL} של ${match.roundLabel} כרגע על ${other.home.name}–${other.away.name}.`;
  }
}

// ---------- שמירה ----------

async function handleSubmit(event) {
  event.preventDefault();
  if (isSaving || isLocked) return;
  els.formError.textContent = '';

  // 1. המשחק התחיל בזמן שהעמוד היה פתוח? נועלים בלי לשלוח.
  if (getMatchStatus(match) !== 'open') {
    lock(true);
    return;
  }

  // 2. ולידציה של שני השדות (מנקים קודם שגיאות מניסיון קודם)
  UI.clearFieldError(els.home);
  UI.clearFieldError(els.away);
  const home = Validation.goals(els.home.value, match.home.name);
  const away = Validation.goals(els.away.value, match.away.name);
  if (!home.valid) UI.setFieldError(els.home, home.error);
  if (!away.valid) UI.setFieldError(els.away, away.error);
  if (!home.valid || !away.valid) {
    (home.valid ? els.away : els.home).focus();
    return;
  }

  // 3. שליחה ל"שרת"
  const input = { home: home.value, away: away.value, double: els.double.checked };
  isSaving = true;
  UI.setBusy(els.save, true, 'שומר…');
  try {
    const { movedFrom } = await Api.savePrediction(match.id, input);
    onSaved(input, movedFrom);
  } catch (error) {
    handleSaveError(error);
  } finally {
    isSaving = false;
    UI.setBusy(els.save, false);
    els.unsaved.hidden = isLocked || !isDirty();
  }
}

function onSaved(input, movedFrom) {
  saved = { ...input };
  match.myPrediction = saved;
  if (movedFrom) {
    allMatches.find((item) => item.id === movedFrom.id).myPrediction.double = false;
    UI.toast(`ה-${DOUBLE_LABEL} הועבר מ${movedFrom.home.name}–${movedFrom.away.name} למשחק הזה`);
  }
  updateDoubleHint();
  UI.confetti();
  showSuccess();
}

function handleSaveError(error) {
  const code = String(error.code || '');
  if (code === 'locked') {
    lock(true);
  } else if (code.startsWith('double')) {
    els.formError.textContent = error.message;
  } else if (code === 'network') {
    // הטיוטה נשארת בטופס — אפשר לנסות שוב בלי להזין מחדש
    els.formError.textContent = `השמירה נכשלה. ${error.message}`;
  } else {
    els.formError.textContent = UI.errorMessage(error);
  }
}

/** הודעת הצלחה, ואחרי 2.5 שניות מעבר למשחק הפתוח הבא שעוד לא ניחשת. */
function showSuccess() {
  els.success.hidden = false;
  const next = allMatches.find((item) => item.id !== match.id && getMatchStatus(item) === 'open' && !item.myPrediction);

  if (next) {
    els.successNext.textContent = `עוברים ל${next.home.name}–${next.away.name}…`;
    els.stay.hidden = false;
    advanceTimer = setTimeout(() => { location.href = `predict.html?match=${next.id}`; }, AUTO_ADVANCE_MS);
  } else {
    els.successNext.textContent = 'ניחשת את כל המשחקים הפתוחים 🎉';
    els.stay.hidden = true;
  }
}

function hideSuccess() {
  clearTimeout(advanceTimer);
  els.success.hidden = true;
}

function stayHere() {
  clearTimeout(advanceTimer);
  els.successNext.textContent = 'נשארים כאן. אפשר לשנות עד שריקת הפתיחה.';
  els.stay.hidden = true;
}

// ---------- נעילה בשריקת הפתיחה ----------

function startCountdown() {
  const update = () => {
    const msLeft = match.kickoff - Date.now();
    if (msLeft <= 0) {
      lock(true);
      return;
    }
    els.countdown.textContent = `נסגר בעוד ${UI.countdown(msLeft)}`;
    els.countdown.classList.toggle('countdown-pill--urgent', msLeft < 60 * 60 * 1000);
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

/**
 * נועל את הטופס. announce = true כשהנעילה קרתה בזמן שהמשתמש בעמוד.
 * טיוטה שלא נשמרה לא נשמרת — מוצג הניחוש השמור האחרון.
 */
function lock(announce) {
  if (isLocked) return;
  isLocked = true;
  clearInterval(countdownTimer);
  hideSuccess();

  els.form.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
  els.home.value = saved ? saved.home : '–';
  els.away.value = saved ? saved.away : '–';
  els.double.checked = Boolean(saved && saved.double);
  els.saveRow.hidden = true;
  els.doubleRow.hidden = true;
  els.unsaved.hidden = true;
  els.formError.textContent = '';
  els.form.querySelectorAll('.goals-input').forEach((input) => UI.clearFieldError(input));

  els.countdown.textContent = '🔒 נעול';
  els.countdown.classList.remove('countdown-pill--urgent');
  els.locked.replaceChildren(...lockedSummary());
  els.locked.hidden = false;

  if (announce) {
    UI.toast('שריקת הפתיחה! הניחושים למשחק הזה ננעלו.', 'warn');
    els.locked.focus();
  }
}

function lockedSummary() {
  const status = getMatchStatus(match);
  const mine = saved
    ? UI.el('p', {}, 'הניחוש שלך: ', UI.score(saved.home, saved.away), saved.double ? ` ${DOUBLE_LABEL}` : '')
    : UI.el('p', {}, 'לא הספקת לנחש את המשחק הזה.');

  let state;
  if (status === 'finished') {
    const calc = calcPoints(saved, match.result, match.stage);
    state = UI.el('p', {}, 'תוצאת הסיום: ', UI.score(match.result.home, match.result.away), ' ', calc ? UI.pointsBadge(calc, saved.double) : '');
  } else if (status === 'pending') {
    state = UI.el('p', {}, 'המשחק הסתיים. ', UI.el('span', { className: 'pill pill--pending' }, 'ממתין'), ' לתוצאה הרשמית.');
  } else {
    const live = match.live || { home: 0, away: 0 };
    state = UI.el('p', {}, UI.el('span', { className: 'live-tag' }, `● חי ${UI.liveMinute(match.kickoff)}`), ' ', UI.score(live.home, live.away));
  }

  return [UI.el('p', { className: 'banner-title' }, '🔒 הניחושים נעולים'), mine, state];
}

// ---------- בניית התוכן ----------

function renderHero() {
  const side = (team) => UI.el('div', { className: 'hero-team' }, UI.flag(team, 'lg'), UI.el('strong', {}, team.name));
  els.hero.replaceChildren(
    UI.el('div', { className: 'hero-teams' }, side(match.home), UI.el('span', { className: 'hero-vs' }, 'נגד'), side(match.away)),
    UI.el('p', { className: 'hero-meta' }, `${match.stageLabel} · בית ${match.group} · ${UI.kickoffLabel(match.kickoff)}`),
  );

  for (const [key, team] of [['home', match.home], ['away', match.away]]) {
    document.getElementById(`${key}-label`).replaceChildren(UI.flag(team, 'sm'), team.name);
    els.form.querySelector(`[data-side="${key}"][data-step="1"]`).setAttribute('aria-label', `שער נוסף ל${team.name}`);
    els.form.querySelector(`[data-side="${key}"][data-step="-1"]`).setAttribute('aria-label', `שער אחד פחות ל${team.name}`);
  }
}

/** פס התפלגות הניחושים בליגה: בית / תיקו / חוץ. */
function renderDistribution() {
  if (!match.distribution) {
    els.distribution.replaceChildren(UI.el('p', { className: 'muted' }, 'עוד אין מספיק ניחושים כדי להציג התפלגות.'));
    return;
  }
  const [home, draw, away] = match.distribution;
  const parts = [[match.home.name, home, 'home'], ['תיקו', draw, 'draw'], [match.away.name, away, 'away']];
  const leader = parts.reduce((best, part) => (part[1] > best[1] ? part : best));
  const headline = leader[2] === 'draw' ? `${draw}% מהליגה ניחשו תיקו` : `${leader[1]}% מהליגה ניחשו ${leader[0]}`;

  els.distribution.replaceChildren(
    UI.el('p', { className: 'dist-headline' }, headline),
    UI.el('div', { className: 'dist-bar', role: 'img', 'aria-label': parts.map(([name, pct]) => `${name} ${pct}%`).join(', ') },
      ...parts.map(([, pct, key]) => {
        const segment = UI.el('span', { className: `dist-seg dist-seg--${key}` });
        segment.style.width = `${pct}%`;
        return segment;
      })),
    UI.el('div', { className: 'dist-legend' },
      ...parts.map(([name, pct, key]) => UI.el('span', { className: `dist-key dist-key--${key}` }, `${name} ${pct}%`))),
  );
}

/** כמה שווה כל סוג פגיעה בשלב של המשחק. */
function renderRules() {
  const stage = STAGES[match.stage];
  const tile = (label, points) => UI.el('div', { className: 'rule-tile' },
    UI.el('span', { className: 'rule-points' }, points), UI.el('span', { className: 'rule-label' }, label));

  els.rules.replaceChildren(
    UI.el('p', { className: 'muted' }, stage.label),
    UI.el('div', { className: 'rule-tiles' },
      tile(HIT_LABELS.exact, stage.points.exact),
      tile(HIT_LABELS.diff, stage.points.diff),
      tile(HIT_LABELS.direction, stage.points.direction),
      tile(HIT_LABELS.miss, 0)),
    UI.el('p', { className: 'hint' }, stage.doubleAllowed
      ? `${DOUBLE_LABEL} מכפיל את הניקוד של משחק אחד בכל מחזור.`
      : `${DOUBLE_LABEL} לא זמין משלב רבע הגמר.`),
  );
  els.doubleRow.hidden = !stage.doubleAllowed;
}

function renderNextLink() {
  const next = allMatches.find((item) => item.kickoff > match.kickoff && getMatchStatus(item) === 'open');
  if (!next) return;
  els.nextLink.href = `predict.html?match=${next.id}`;
  els.nextLink.textContent = `למשחק הבא: ${next.home.name}–${next.away.name} ←`;
  els.nextLink.hidden = false;
}

function fillForm() {
  els.home.value = saved ? saved.home : 0;
  els.away.value = saved ? saved.away : 0;
  els.double.checked = Boolean(saved && saved.double);
  updateDoubleHint();
  onFormChange();
}

function showNotFound() {
  els.loadMessage.hidden = true;
  els.notFound.hidden = false;
  els.countdown.hidden = true;
}

// ---------- אתחול ----------

async function init() {
  if (!UI.requireUser()) return;

  const id = Number(UI.param('match'));
  if (!Number.isInteger(id) || id <= 0) {
    showNotFound();
    return;
  }

  try {
    allMatches = await Api.getMatches();
  } catch (error) {
    els.loadMessage.textContent = UI.errorMessage(error);
    return;
  }
  match = allMatches.find((item) => item.id === id);
  if (!match) {
    showNotFound();
    return;
  }

  saved = match.myPrediction;
  document.title = `${match.home.name}–${match.away.name} · גולים`;
  els.loadMessage.hidden = true;
  els.content.hidden = false;

  renderHero();
  renderRules();
  renderDistribution();
  renderNextLink();
  fillForm();

  if (getMatchStatus(match) === 'open') startCountdown();
  else lock(false);

  els.form.addEventListener('submit', handleSubmit);
  els.form.addEventListener('click', handleStep);
  els.home.addEventListener('input', handleGoalsInput);
  els.away.addEventListener('input', handleGoalsInput);
  els.double.addEventListener('change', () => { updateDoubleHint(); onFormChange(); });
  els.stay.addEventListener('click', stayHere);

  // אזהרה לפני יציאה מהעמוד עם שינוי שלא נשמר
  window.addEventListener('beforeunload', (event) => {
    if (!isLocked && isDirty()) {
      event.preventDefault();
      event.returnValue = ''; // דפדפנים ישנים יותר
    }
  });
}

init();
