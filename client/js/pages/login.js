/*
 * login.js — עמוד הכניסה: כניסה לחשבון קיים או הרשמה לחשבון חדש.
 * שני טפסים בעמוד אחד, והלשוניות למעלה מחליפות ביניהם.
 * אחרי כניסה או הרשמה מוצלחת עוברים לעמוד המשחקים.
 */

const tabs = document.querySelectorAll('[data-mode]');
const forms = {
  login: document.getElementById('login-form'),
  register: document.getElementById('register-form'),
};

const loginEls = {
  email: document.getElementById('login-email'),
  password: document.getElementById('login-password'),
  error: document.getElementById('login-error'),
};

const registerEls = {
  name: document.getElementById('reg-name'),
  nameCount: document.getElementById('reg-name-count'),
  email: document.getElementById('reg-email'),
  suggestion: document.getElementById('reg-email-suggestion'),
  password: document.getElementById('reg-password'),
  rules: document.getElementById('reg-password-rules'),
  confirm: document.getElementById('reg-confirm'),
  error: document.getElementById('register-error'),
};

function goToApp() {
  location.replace('matches.html');
}

// ---------- מעבר בין כניסה להרשמה ----------

function showMode(mode) {
  for (const tab of tabs) {
    tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  }
  for (const [key, form] of Object.entries(forms)) {
    form.hidden = key !== mode;
  }
  forms[mode].querySelector('input').focus();
}

/** כפתור "הצג" ליד שדה סיסמה: מחליף בין טקסט גלוי לנקודות. */
function togglePassword(event) {
  const button = event.currentTarget;
  const input = document.getElementById(button.getAttribute('aria-controls'));
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(show));
  button.textContent = show ? 'הסתר' : 'הצג';
}

// ---------- כניסה ----------

async function handleLogin(event) {
  event.preventDefault();
  loginEls.error.textContent = '';
  UI.clearFieldError(loginEls.email);
  UI.clearFieldError(loginEls.password);

  // בכניסה בודקים רק שהשדות מלאים ותקינים. את חוקי הסיסמה בודקים בהרשמה.
  const email = Validation.email(loginEls.email.value);
  const hasPassword = loginEls.password.value !== '';
  if (!email.valid) UI.setFieldError(loginEls.email, email.error);
  if (!hasPassword) UI.setFieldError(loginEls.password, 'נא להזין סיסמה');
  if (!email.valid || !hasPassword) {
    (email.valid ? loginEls.password : loginEls.email).focus();
    return;
  }

  const button = forms.login.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'מתחבר…');
  try {
    await Api.login({ email: email.value, password: loginEls.password.value });
    goToApp();
  } catch (error) {
    loginEls.error.textContent = UI.errorMessage(error);
    loginEls.password.select();
  } finally {
    UI.setBusy(button, false);
  }
}

// ---------- הרשמה ----------

function updateNameCount() {
  registerEls.nameCount.textContent =
    `${registerEls.name.value.trim().length}/${NAME_MAX} תווים · כך החברים יזהו אותך בטבלה`;
  UI.clearFieldError(registerEls.name);
}

/** רשימת דרישות הסיסמה מתעדכנת בזמן ההקלדה: דרישה שמתקיימת מקבלת ✓. */
function updatePasswordRules() {
  const rules = Validation.passwordRules(registerEls.password.value);
  for (const item of registerEls.rules.children) {
    item.classList.toggle('is-met', rules[item.dataset.rule]);
  }
  UI.clearFieldError(registerEls.password);
}

/** הצעה לתיקון טעות הקלדה בכתובת (למשל gmial.com), בלחיצה אחת. */
function showSuggestion(suggestion) {
  registerEls.suggestion.textContent = `כן, תקן ל-${ltr(suggestion)}`;
  registerEls.suggestion.dataset.value = suggestion;
  registerEls.suggestion.hidden = false;
}

function applySuggestion() {
  registerEls.email.value = registerEls.suggestion.dataset.value;
  registerEls.suggestion.hidden = true;
  UI.clearFieldError(registerEls.email);
  registerEls.email.focus();
}

async function handleRegister(event) {
  event.preventDefault();
  registerEls.error.textContent = '';
  registerEls.suggestion.hidden = true;

  // 1. בודקים את כל השדות, ומציגים שגיאה ליד כל שדה שנכשל
  const fields = [
    [registerEls.name, Validation.displayName(registerEls.name.value)],
    [registerEls.email, Validation.email(registerEls.email.value)],
    [registerEls.password, Validation.password(registerEls.password.value)],
    [registerEls.confirm, Validation.passwordConfirm(registerEls.password.value, registerEls.confirm.value)],
  ];
  for (const [input, check] of fields) {
    if (check.valid) UI.clearFieldError(input);
    else UI.setFieldError(input, check.error);
  }
  const emailCheck = fields[1][1];
  if (emailCheck.suggestion) showSuggestion(emailCheck.suggestion);

  const firstInvalid = fields.find(([, check]) => !check.valid);
  if (firstInvalid) {
    firstInvalid[0].focus();
    return;
  }

  // 2. שליחה ל"שרת"
  const [name, email, password] = fields.map(([, check]) => check.value);
  const button = forms.register.querySelector('[type="submit"]');
  UI.setBusy(button, true, 'יוצר חשבון…');
  try {
    await Api.register({ name, email, password });
    goToApp();
  } catch (error) {
    // אימייל שכבר רשום — השגיאה שייכת לשדה האימייל. שאר השגיאות מוצגות מעל הכפתור.
    if (error.code === 'email-taken') {
      UI.setFieldError(registerEls.email, UI.errorMessage(error));
      registerEls.email.focus();
    } else {
      registerEls.error.textContent = UI.errorMessage(error);
    }
  } finally {
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

  for (const tab of tabs) {
    tab.addEventListener('click', () => showMode(tab.dataset.mode));
  }
  for (const button of document.querySelectorAll('.password-toggle')) {
    button.addEventListener('click', togglePassword);
  }

  forms.login.addEventListener('submit', handleLogin);
  loginEls.email.addEventListener('input', () => UI.clearFieldError(loginEls.email));
  loginEls.password.addEventListener('input', () => UI.clearFieldError(loginEls.password));

  forms.register.addEventListener('submit', handleRegister);
  registerEls.name.addEventListener('input', updateNameCount);
  registerEls.email.addEventListener('input', () => UI.clearFieldError(registerEls.email));
  registerEls.suggestion.addEventListener('click', applySuggestion);
  registerEls.password.addEventListener('input', updatePasswordRules);
  registerEls.confirm.addEventListener('input', () => UI.clearFieldError(registerEls.confirm));

  loginEls.email.focus();
}

init();
