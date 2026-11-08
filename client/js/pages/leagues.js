/*
 * leagues.js — עמוד הליגות: פתיחת ליגה, הצטרפות בקוד או בקישור, ורשימת הליגות שלי.
 */

const els = {
  createForm: document.getElementById('create-form'),
  nameInput: document.getElementById('league-name'),
  nameCount: document.getElementById('league-name-count'),
  invitePanel: document.getElementById('invite-panel'),
  inviteName: document.getElementById('invite-league-name'),
  inviteCode: document.getElementById('invite-code-text'),
  whatsapp: document.getElementById('whatsapp-link'),
  copyBtn: document.getElementById('copy-link-btn'),
  createAnother: document.getElementById('create-another-btn'),
  joinForm: document.getElementById('join-form'),
  codeInput: document.getElementById('invite-code'),
  list: document.getElementById('league-list'),
};

let myLeagues = [];
let inviteLink = '';

// ---------- רשימת הליגות ----------

function membersText(count) {
  return count === 1 ? 'חבר אחד' : `${count} חברים`;
}

function leagueCard(league, isNew = false) {
  return UI.el('li', {},
    UI.el('a', { className: `league-card${isNew ? ' league-card--new' : ''}`, href: `leaderboard.html?league=${league.id}` },
      UI.el('span', { className: 'league-avatar', 'aria-hidden': 'true' }, UI.initials(league.name)),
      UI.el('span', { className: 'league-info' },
        UI.el('strong', {}, league.name),
        UI.el('span', { className: 'muted' }, `${membersText(league.memberCount)} · אתה במקום ${league.myRank}`)),
      UI.el('span', { className: 'chevron', 'aria-hidden': 'true' }, '‹')));
}

/** בונה את הרשימה. newId — ליגה שנוספה עכשיו, מודגשת לרגע. */
function renderLeagues(newId = null) {
  if (myLeagues.length === 0) {
    els.list.replaceChildren(UI.el('li', { className: 'empty-state' },
      UI.el('p', { className: 'empty-emoji', 'aria-hidden': 'true' }, '👥'),
      UI.el('p', {}, 'עוד אין לך ליגות. פתח אחת או הצטרף עם קוד מחבר.')));
    return;
  }
  els.list.replaceChildren(...myLeagues.map((league) => leagueCard(league, league.id === newId)));
}

// ---------- פתיחת ליגה ----------

function updateNameCount() {
  els.nameCount.textContent = `${els.nameInput.value.trim().length}/${LEAGUE_NAME_MAX} תווים`;
  UI.clearFieldError(els.nameInput);
}

async function handleCreate(event) {
  event.preventDefault();
  UI.clearFieldError(els.nameInput);
  const check = Validation.leagueName(els.nameInput.value, myLeagues.map((league) => league.name));
  if (!check.valid) {
    UI.setFieldError(els.nameInput, check.error);
    els.nameInput.focus();
    return;
  }

  const button = els.createForm.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'יוצר…');
  try {
    const league = await Api.createLeague(check.value);
    myLeagues.push(league);
    renderLeagues(league.id);
    showInvite(league);
  } catch (error) {
    UI.setFieldError(els.nameInput, UI.errorMessage(error));
  } finally {
    UI.setBusy(button, false);
  }
}

/** מסך ההזמנה: הקוד שהשרת יצר, שיתוף לווטסאפ והעתקת קישור. */
function showInvite(league) {
  inviteLink = new URL(`leagues.html?code=${league.code}`, location.href).href;
  els.inviteName.textContent = league.name;
  els.inviteCode.textContent = league.code;
  const message = `הצטרפו לליגה "${league.name}" בגולים! קוד: ${league.code}\n${inviteLink}`;
  els.whatsapp.href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  els.createForm.hidden = true;
  els.invitePanel.hidden = false;
  els.copyBtn.focus();
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink);
    UI.toast('הקישור הועתק 📋', 'success');
  } catch {
    // אין הרשאה ללוח (למשל בקובץ מקומי בחלק מהדפדפנים) — מציגים את הקישור להעתקה ידנית
    window.prompt('העתיקו את הקישור:', inviteLink);
  }
}

function resetCreate() {
  els.createForm.reset();
  updateNameCount();
  els.invitePanel.hidden = true;
  els.createForm.hidden = false;
  els.nameInput.focus();
}

// ---------- הצטרפות ----------

async function handleJoin(event) {
  event.preventDefault();
  UI.clearFieldError(els.codeInput);
  const check = Validation.inviteCode(els.codeInput.value);
  if (!check.valid) {
    UI.setFieldError(els.codeInput, check.error);
    els.codeInput.focus();
    return;
  }

  const button = els.joinForm.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'מצטרף…');
  try {
    const league = await Api.joinLeague(check.value);
    myLeagues.push(league);
    renderLeagues(league.id);
    els.joinForm.reset();
    UI.toast(`הצטרפת לליגה "${league.name}" 🎉`, 'success');
  } catch (error) {
    UI.setFieldError(els.codeInput, UI.errorMessage(error));
  } finally {
    UI.setBusy(button, false);
  }
}

// ---------- אתחול ----------

async function init() {
  if (!UI.requireUser()) return;

  els.createForm.addEventListener('submit', handleCreate);
  els.nameInput.addEventListener('input', updateNameCount);
  els.copyBtn.addEventListener('click', copyInviteLink);
  els.createAnother.addEventListener('click', resetCreate);
  els.joinForm.addEventListener('submit', handleJoin);
  els.codeInput.addEventListener('input', () => UI.clearFieldError(els.codeInput));

  // הגעה מקישור הזמנה: ממלאים את הקוד מראש
  const invitedCode = UI.param('code');
  if (invitedCode) {
    els.codeInput.value = invitedCode;
    els.codeInput.focus();
    UI.toast('הוזמנת לליגה. לחץ "הצטרף" כדי להיכנס.');
  }

  try {
    myLeagues = await Api.getMyLeagues();
    renderLeagues();
  } catch (error) {
    els.list.replaceChildren(UI.el('li', { className: 'empty-state' }, UI.errorMessage(error)));
  }
}

init();
