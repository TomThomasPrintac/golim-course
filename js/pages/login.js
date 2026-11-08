/*
 * login.js — עמוד הכניסה.
 * זרימה: אימייל ← קוד בן 6 ספרות ← (רק בפעם הראשונה) בחירת שם ← עמוד המשחקים.
 */

const RESEND_COOLDOWN_SEC = 30;

const steps = {
  email: document.getElementById('step-email'),
  code: document.getElementById('step-code'),
  name: document.getElementById('step-name'),
};
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email');
const suggestionBtn = document.getElementById('email-suggestion');
const codeForm = document.getElementById('code-form');
const codeInput = document.getElementById('code');
const resendBtn = document.getElementById('resend-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('display-name');
const nameCount = document.getElementById('display-name-count');

let pendingEmail = null; // האימייל שאליו נשלח הקוד האחרון
let resendTimer = null;

/** מציג שלב אחד ומסתיר את השאר. */
function showStep(stepName) {
  for (const [key, section] of Object.entries(steps)) {
    section.hidden = key !== stepName;
  }
  steps[stepName].querySelector('input').focus();
}

function goToApp() {
  location.replace('matches.html');
}

/** אחרי כניסה מוצלחת: משתמש בלי שם עובר לבחירת שם, השאר — לאפליקציה. */
function afterSignIn(user) {
  if (user.name) goToApp();
  else showStep('name');
}

// ---------- שלב 1: אימייל ----------

async function handleEmailSubmit(event) {
  event.preventDefault();
  UI.clearFieldError(emailInput);
  suggestionBtn.hidden = true;

  const check = Validation.email(emailInput.value);
  if (!check.valid) {
    UI.setFieldError(emailInput, check.error);
    if (check.suggestion) {
      suggestionBtn.textContent = `כן, תקן ל-${ltr(check.suggestion)}`;
      suggestionBtn.dataset.value = check.suggestion;
      suggestionBtn.hidden = false;
    }
    emailInput.focus();
    return;
  }
  await sendCode(check.value, emailForm.querySelector('[type="submit"]'));
}

/** תיקון טעות הקלדה בלחיצה אחת. */
function applySuggestion() {
  emailInput.value = suggestionBtn.dataset.value;
  suggestionBtn.hidden = true;
  UI.clearFieldError(emailInput);
  emailInput.focus();
}

async function sendCode(email, button) {
  UI.setBusy(button, true, 'שולח…');
  let sent = false;
  try {
    const { demoCode } = await Api.requestOtp(email);
    pendingEmail = email;
    document.getElementById('code-email').textContent = email;
    document.getElementById('demo-code').textContent = demoCode;
    codeInput.value = '';
    UI.clearFieldError(codeInput);
    showStep('code');
    sent = true;
  } catch (error) {
    const target = steps.code.hidden ? emailInput : codeInput;
    UI.setFieldError(target, UI.errorMessage(error));
  } finally {
    UI.setBusy(button, false);
  }
  // אחרי setBusy, כדי שהשחרור של הכפתור לא ידרוס את הספירה לאחור
  if (sent) startResendCooldown();
}

async function handleGoogle(event) {
  const button = event.currentTarget;
  UI.setBusy(button, true, 'מתחבר…');
  try {
    afterSignIn(await Api.signInWithGoogle());
  } catch (error) {
    UI.toast(UI.errorMessage(error), 'error');
  } finally {
    UI.setBusy(button, false);
  }
}

// ---------- שלב 2: קוד ----------

async function handleCodeSubmit(event) {
  event.preventDefault();
  UI.clearFieldError(codeInput);

  const check = Validation.otp(codeInput.value);
  if (!check.valid) {
    UI.setFieldError(codeInput, check.error);
    codeInput.focus();
    return;
  }

  const button = codeForm.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'בודק…');
  try {
    afterSignIn(await Api.verifyOtp(pendingEmail, check.value));
  } catch (error) {
    UI.setFieldError(codeInput, UI.errorMessage(error));
    codeInput.select();
  } finally {
    UI.setBusy(button, false);
  }
}

/** אחרי שליחת קוד אפשר לבקש קוד חדש רק אחרי 30 שניות. */
function startResendCooldown() {
  clearInterval(resendTimer);
  let secondsLeft = RESEND_COOLDOWN_SEC;
  resendBtn.disabled = true;

  const update = () => {
    resendBtn.textContent = `שלח קוד חדש (0:${String(secondsLeft).padStart(2, '0')})`;
    if (secondsLeft === 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = 'שלח קוד חדש';
    }
    secondsLeft -= 1;
  };
  update();
  resendTimer = setInterval(update, 1000);
}

function changeEmail() {
  clearInterval(resendTimer);
  showStep('email');
}

// ---------- שלב 3: שם ----------

function updateNameCount() {
  nameCount.textContent = `${nameInput.value.trim().length}/${NAME_MAX} תווים`;
  UI.clearFieldError(nameInput);
}

async function handleNameSubmit(event) {
  event.preventDefault();
  const check = Validation.displayName(nameInput.value);
  if (!check.valid) {
    UI.setFieldError(nameInput, check.error);
    nameInput.focus();
    return;
  }

  const button = nameForm.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'שומר…');
  try {
    await Api.updateName(check.value);
    goToApp();
  } catch (error) {
    UI.setFieldError(nameInput, UI.errorMessage(error));
    UI.setBusy(button, false);
  }
}

// ---------- אתחול ----------

function init() {
  const user = Api.currentUser();
  if (user && user.name) {
    goToApp(); // כבר מחובר
    return;
  }
  showStep(user ? 'name' : 'email');

  emailForm.addEventListener('submit', handleEmailSubmit);
  emailInput.addEventListener('input', () => UI.clearFieldError(emailInput));
  suggestionBtn.addEventListener('click', applySuggestion);
  document.getElementById('google-btn').addEventListener('click', handleGoogle);

  codeForm.addEventListener('submit', handleCodeSubmit);
  codeInput.addEventListener('input', () => UI.clearFieldError(codeInput));
  resendBtn.addEventListener('click', () => sendCode(pendingEmail, resendBtn));
  document.getElementById('change-email-btn').addEventListener('click', changeEmail);

  nameForm.addEventListener('submit', handleNameSubmit);
  nameInput.addEventListener('input', updateNameCount);
}

init();
