/*
 * ui.js — פונקציות עזר לממשק, משותפות לכל העמודים:
 * יצירת אלמנטים, הודעות קופצות, שגיאות בשדות, דגלים, תאריכים ושעות, קונפטי.
 */

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_MS = 24 * 60 * 60 * 1000;

const UI = {
  /**
   * יוצר אלמנט עם מאפיינים וילדים. טקסט נכנס כ-textNode, כך שאין סכנת הזרקת HTML.
   * דוגמה: UI.el('a', { href: 'x.html', className: 'btn', onClick: handler }, 'טקסט')
   */
  el(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'className') element.className = value;
      else if (key === 'dataset') Object.assign(element.dataset, value);
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child !== null && child !== undefined && child !== false) element.append(child);
    }
    return element;
  },

  /** עמודים שדורשים התחברות. מחזיר את המשתמש, או מעביר למסך הכניסה ומחזיר null. */
  requireUser() {
    const user = Api.currentUser();
    if (!user || !user.name) {
      location.replace('index.html');
      return null;
    }
    UI.mountUserChip(user);
    return user;
  },

  /** מציג את שם המשתמש בכותרת העליונה (רכיב משותף לכל העמודים). */
  mountUserChip(user) {
    const slot = document.querySelector('.user-slot');
    if (!slot) return;
    slot.replaceChildren(
      UI.el('a', { className: 'user-chip', href: 'profile.html', title: 'לפרופיל שלי' },
        UI.el('span', { className: 'avatar', 'aria-hidden': 'true' }, UI.initials(user.name)),
        UI.el('span', { className: 'user-chip-name' }, user.name)),
    );
  },

  /** הודעה קופצת קצרה בתחתית המסך. type: info / success / warn / error */
  toast(message, type = 'info') {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = UI.el('div', { id: 'toast-region', className: 'toast-region', role: 'status', 'aria-live': 'polite' });
      document.body.append(region);
    }
    const toast = UI.el('div', { className: `toast toast--${type}` }, message);
    region.append(toast);
    setTimeout(() => toast.classList.add('toast--leaving'), 3200);
    setTimeout(() => toast.remove(), 3600);
  },

  /** הודעת שגיאה מתחת לשדה. אלמנט השגיאה הוא תמיד ‎#<id של השדה>-error */
  setFieldError(input, message) {
    document.getElementById(`${input.id}-error`).textContent = message;
    input.setAttribute('aria-invalid', 'true');
  },

  clearFieldError(input) {
    document.getElementById(`${input.id}-error`).textContent = '';
    input.removeAttribute('aria-invalid');
  },

  /** מצב טעינה לכפתור: נועל אותו ומחליף את הטקסט, ואחר כך מחזיר את התוכן המקורי. */
  setBusy(button, busy, busyText = 'רגע…') {
    if (busy) {
      button.savedContent = [...button.childNodes];
      button.replaceChildren(UI.el('span', { className: 'spinner', 'aria-hidden': 'true' }), busyText);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      if (button.savedContent) button.replaceChildren(...button.savedContent);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  },

  /** הופך שגיאה לטקסט להצגה. אם פג החיבור — חוזרים למסך הכניסה. */
  errorMessage(error) {
    if (error.code === 'unauthorized') location.replace('index.html');
    if (error instanceof ApiError) return error.message;
    console.error(error); // תקלה לא צפויה בקוד — נשאר תיעוד בקונסול
    return 'משהו השתבש. נסה שוב.';
  },

  param(name) {
    return new URLSearchParams(location.search).get(name);
  },

  initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('');
  },

  /** דגל עגול. alt ריק כי שם הנבחרת תמיד מופיע לידו. */
  flag(team, size = 'md') {
    return UI.el('img', {
      className: `flag flag--${size}`,
      src: `https://flagcdn.com/w80/${team.flag}.png`,
      alt: '',
      width: 40,
      height: 40,
      loading: 'lazy',
    });
  },

  /** תוצאה כמו 2–1. מבודדת בכיוון LTR, אחרת בתוך טקסט עברי היא מתהפכת ל-1–2. */
  score(home, away) {
    return UI.el('bdi', { dir: 'ltr', className: 'score' }, `${home}–${away}`);
  },

  /** תג נקודות צבעוני: ירוק = מדויק, כתום = הפרש/כיוון, אדום = החטאה. */
  pointsBadge(calc, double = false) {
    const text = calc.points > 0 ? `+${calc.points}` : '0';
    return UI.el('span', { className: `badge badge--${calc.kind}`, title: HIT_LABELS[calc.kind] },
      UI.el('bdi', { dir: 'ltr' }, double ? `${text} ★` : text));
  },

  // ---------- תאריכים ושעות ----------

  /** מפתח יום (לסינון לפי יום), לפי השעון המקומי. */
  dayKey(ms) {
    const date = new Date(ms);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  },

  dayLabel(ms) {
    const key = UI.dayKey(ms);
    if (key === UI.dayKey(Date.now())) return 'היום';
    if (key === UI.dayKey(Date.now() + DAY_MS)) return 'מחר';
    if (key === UI.dayKey(Date.now() - DAY_MS)) return 'אתמול';
    const date = new Date(ms);
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}`;
  },

  time(ms) {
    const date = new Date(ms);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  kickoffLabel(ms) {
    return `${UI.dayLabel(ms)} · ${UI.time(ms)}`;
  },

  /** זמן שנותר בפורמט 02:14:33 (ומעל יום: "יומיים ו-03:00:00"). */
  countdown(msLeft) {
    const total = Math.max(0, Math.floor(msLeft / 1000));
    const days = Math.floor(total / 86400);
    const clock = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
    if (days === 0) return clock;
    const dayText = days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`;
    return `${dayText} ו-${clock}`;
  },

  /** הדקה במשחק חי לפי הזמן מאז שריקת הפתיחה (כולל 15 דקות מחצית). */
  liveMinute(kickoff) {
    const elapsed = Math.floor((Date.now() - kickoff) / 60000);
    if (elapsed <= 45) return `${Math.max(1, elapsed)}′`;
    if (elapsed <= 60) return 'מחצית';
    return `${Math.min(elapsed - 15, 90)}′`;
  },

  /** קונפטי קצר בשמירת ניחוש. מדלגים עליו אם המשתמש ביקש פחות אנימציות במערכת. */
  confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#FF5A1F', '#FFB020', '#16A34A', '#2F80ED', '#D9A82A'];
    const layer = UI.el('div', { className: 'confetti', 'aria-hidden': 'true' });
    for (let i = 0; i < 48; i++) {
      const piece = UI.el('span');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 200)}px`);
      piece.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
      layer.append(piece);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 2400);
  },
};
