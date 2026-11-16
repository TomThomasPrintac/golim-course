/*
 * validation.js — בדיקות תקינות לקלט של המשתמש.
 * כל פונקציה מחזירה אובייקט אחיד:
 *   { valid: true, value }  — הערך אחרי ניקוי (רווחים, אותיות גדולות וכו')
 *   { valid: false, error } — הודעת שגיאה בעברית להצגה ליד השדה
 */

/**
 * עוטף טקסט באנגלית (למשל אימייל) בתווי כיווניות LRI…PDI.
 * בלי זה, בתוך משפט בעברית הדפדפן מסדר את הסימנים מסביב לא נכון (למשל ?tom@gmail.com).
 */
function ltr(text) {
  return `⁦${text}⁩`;
}

const MAX_GOALS = 15;
const NAME_MAX = 30; // כמו באפיון: שם תצוגה 2–30 תווים
const LEAGUE_NAME_MAX = 50; // כמו באפיון: שם ליגה עד 50 תווים
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
const RESERVED_NAMES = ['שחקן', 'player', 'admin', 'גולים', 'golim'];

// טעויות הקלדה נפוצות בדומיין של כתובת המייל
const EMAIL_TYPOS = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gamil.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'walla.co': 'walla.co.il',
};

const Validation = {
  email(raw) {
    const value = raw.trim().toLowerCase();
    if (value === '') return { valid: false, error: 'נא להזין כתובת אימייל' };
    if (value.length > 254) return { valid: false, error: 'כתובת האימייל ארוכה מדי' };
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value)) {
      return { valid: false, error: 'כתובת האימייל לא תקינה (לדוגמה: name@example.com)' };
    }
    const [user, domain] = value.split('@');
    if (EMAIL_TYPOS[domain]) {
      const suggestion = `${user}@${EMAIL_TYPOS[domain]}`;
      return { valid: false, error: `האם התכוונת ל-${ltr(suggestion)}?`, suggestion };
    }
    return { valid: true, value };
  },

  /**
   * אילו מדרישות הסיסמה מתקיימות. משמש גם לבדיקה עצמה וגם לרשימה
   * שמתעדכנת בזמן ההקלדה בטופס ההרשמה, כך שהחוקים כתובים במקום אחד.
   */
  passwordRules(raw) {
    return {
      length: raw.length >= PASSWORD_MIN,
      letter: /[a-zA-Z]/.test(raw),
      digit: /\d/.test(raw),
    };
  },

  /** סיסמה חדשה (בהרשמה). לא מקצצים רווחים — הם חלק מהסיסמה, ולכן פשוט לא מאפשרים אותם. */
  password(raw) {
    if (raw === '') return { valid: false, error: 'נא לבחור סיסמה' };
    if (/\s/.test(raw)) return { valid: false, error: 'בלי רווחים בסיסמה' };
    if (raw.length > PASSWORD_MAX) return { valid: false, error: `הסיסמה ארוכה מדי — עד ${PASSWORD_MAX} תווים` };
    const rules = Validation.passwordRules(raw);
    if (!rules.length) return { valid: false, error: `הסיסמה קצרה מדי — לפחות ${PASSWORD_MIN} תווים` };
    if (!rules.letter || !rules.digit) {
      return { valid: false, error: 'הסיסמה צריכה לכלול לפחות אות אחת באנגלית וספרה אחת' };
    }
    return { valid: true, value: raw };
  },

  /** אימות סיסמה: אותה סיסמה בדיוק, כדי לתפוס טעות הקלדה. */
  passwordConfirm(password, confirm) {
    if (confirm === '') return { valid: false, error: 'נא להקליד את הסיסמה שוב' };
    if (confirm !== password) return { valid: false, error: 'הסיסמאות לא זהות' };
    return { valid: true, value: confirm };
  },

  displayName(raw) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value === '') return { valid: false, error: 'נא לבחור שם' };
    if (value.length < 2) return { valid: false, error: 'השם קצר מדי — לפחות 2 תווים' };
    if (value.length > NAME_MAX) return { valid: false, error: `השם ארוך מדי — עד ${NAME_MAX} תווים` };
    // אותיות בעברית או באנגלית, רווח, גרש, מקף ונקודה בלבד
    if (!/^[א-תa-zA-Z '׳״"\-.]+$/.test(value)) {
      return { valid: false, error: 'אפשר להשתמש רק באותיות, רווח, מקף וגרש' };
    }
    if (RESERVED_NAMES.includes(value.toLowerCase())) {
      return { valid: false, error: 'בחר את השם שלך — כך החברים יזהו אותך בטבלה' };
    }
    return { valid: true, value };
  },

  /**
   * מספר שערים: מספר שלם בין 0 ל-15.
   * @param {string} raw — הערך מהשדה (טקסט)
   * @param {string} teamName — לשילוב בהודעת השגיאה
   */
  goals(raw, teamName) {
    const value = raw.trim();
    if (value === '') return { valid: false, error: `חסר מספר שערים ל${teamName}` };
    if (!/^\d+$/.test(value)) return { valid: false, error: 'מספר שלם בלבד, בלי סימנים' };
    const goals = Number(value);
    if (goals > MAX_GOALS) return { valid: false, error: `עד ${MAX_GOALS} שערים לקבוצה` };
    return { valid: true, value: goals };
  },

  /**
   * שם ליגה חדשה.
   * @param {string[]} existingNames — שמות הליגות שכבר יש למשתמש (למניעת כפילות)
   */
  leagueName(raw, existingNames) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value === '') return { valid: false, error: 'נא לתת שם לליגה' };
    if (value.length > LEAGUE_NAME_MAX) return { valid: false, error: `שם הליגה ארוך מדי — עד ${LEAGUE_NAME_MAX} תווים` };
    if (!/[א-תa-zA-Z]/.test(value)) return { valid: false, error: 'שם הליגה צריך לכלול לפחות אות אחת' };
    const taken = existingNames.some((name) => name.toLowerCase() === value.toLowerCase());
    if (taken) return { valid: false, error: 'כבר יש לך ליגה בשם הזה' };
    return { valid: true, value };
  },

  /**
   * קוד הזמנה: 6 תווים (אותיות באנגלית וספרות).
   * מקבל גם קישור הזמנה מלא (…/join/K7P2QX או ‎?code=K7P2QX) ושולף ממנו את הקוד.
   */
  inviteCode(raw) {
    let value = raw.trim();
    if (value === '') return { valid: false, error: 'נא להזין קוד או קישור הזמנה' };

    if (value.includes('/') || value.includes('?')) {
      const match = value.match(/(?:\/join\/|[?&]code=)([A-Za-z0-9]+)/);
      if (!match) return { valid: false, error: 'לא מצאנו קוד בקישור. הדבק את הקישור המלא או רק את הקוד' };
      value = match[1];
    }

    value = value.toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(value)) {
      return { valid: false, error: `קוד הזמנה הוא 6 תווים — אותיות באנגלית וספרות (לדוגמה ${ltr('K7P2QX')})` };
    }
    return { valid: true, value };
  },
};
