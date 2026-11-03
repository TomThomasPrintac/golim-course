/*
 * data.js — נתוני דמה של האפליקציה.
 * בחלק ב׳ אין שרת, ולכן כל הנתונים כאן קבועים. בחלק ג׳ הם יגיעו מבסיס הנתונים.
 * הקובץ מכיל נתונים בלבד, ללא לוגיקה.
 */

// נבחרות. flag = קוד מדינה לתמונת הדגל (flagcdn.com)
const TEAMS = {
  ESP: { name: 'ספרד', flag: 'es' },
  BRA: { name: 'ברזיל', flag: 'br' },
  JPN: { name: 'יפן', flag: 'jp' },
  RSA: { name: 'דרום אפריקה', flag: 'za' },
  ARG: { name: 'ארגנטינה', flag: 'ar' },
  FRA: { name: 'צרפת', flag: 'fr' },
  MAR: { name: 'מרוקו', flag: 'ma' },
  USA: { name: 'ארצות הברית', flag: 'us' },
  ENG: { name: 'אנגליה', flag: 'gb-eng' },
  GER: { name: 'גרמניה', flag: 'de' },
  POR: { name: 'פורטוגל', flag: 'pt' },
  NED: { name: 'הולנד', flag: 'nl' },
};

// מחזורים. ★×2 מותר פעם אחת בכל מחזור.
const ROUNDS = {
  md1: 'מחזור 1',
  md2: 'מחזור 2',
  md3: 'מחזור 3',
};

/*
 * משחקים.
 * offsetHours — שעת הפתיחה ביחס לתחילת השעה הנוכחית (שלילי = כבר התחיל).
 * כך הדמו תמיד "חי": תמיד יש משחקים שהסתיימו, משחק חי ומשחקים פתוחים לניחוש.
 * result         — תוצאת סיום (רק למשחקים שהסתיימו)
 * live           — תוצאה נוכחית של משחק חי
 * awaitingResult — המשחק הסתיים אבל התוצאה עוד לא הגיעה (מוצג "ממתין")
 * distribution   — התפלגות ניחושי הליגה באחוזים: [בית, תיקו, חוץ]. null = אין מספיק ניחושים
 */
const MATCHES = [
  // מחזור 1 — הסתיים
  { id: 1, round: 'md1', stage: 'group', group: 'א׳', home: 'ESP', away: 'BRA', offsetHours: -74, result: { home: 1, away: 1 } },
  { id: 2, round: 'md1', stage: 'group', group: 'א׳', home: 'JPN', away: 'RSA', offsetHours: -71, result: { home: 2, away: 0 } },
  { id: 3, round: 'md1', stage: 'group', group: 'ב׳', home: 'ARG', away: 'FRA', offsetHours: -50, result: { home: 2, away: 1 } },
  { id: 4, round: 'md1', stage: 'group', group: 'ב׳', home: 'MAR', away: 'USA', offsetHours: -47, result: { home: 0, away: 0 } },
  { id: 5, round: 'md1', stage: 'group', group: 'ג׳', home: 'ENG', away: 'GER', offsetHours: -26, result: { home: 3, away: 1 } },
  { id: 6, round: 'md1', stage: 'group', group: 'ג׳', home: 'POR', away: 'NED', offsetHours: -23, result: { home: 1, away: 2 } },

  // מחזור 2 — באמצע
  { id: 7, round: 'md2', stage: 'group', group: 'א׳', home: 'ESP', away: 'JPN', offsetHours: -8, result: { home: 2, away: 2 } },
  { id: 8, round: 'md2', stage: 'group', group: 'א׳', home: 'BRA', away: 'RSA', offsetHours: -5, result: { home: 0, away: 1 } },
  { id: 9, round: 'md2', stage: 'group', group: 'ב׳', home: 'ARG', away: 'MAR', offsetHours: -3, awaitingResult: true },
  { id: 10, round: 'md2', stage: 'group', group: 'ב׳', home: 'FRA', away: 'USA', offsetHours: -0.75, live: { home: 1, away: 0 } },
  { id: 11, round: 'md2', stage: 'group', group: 'ג׳', home: 'ENG', away: 'POR', offsetHours: 2, distribution: [41, 27, 32] },
  { id: 12, round: 'md2', stage: 'group', group: 'ג׳', home: 'GER', away: 'NED', offsetHours: 5, distribution: [38, 30, 32] },

  // מחזור 3 — פתוח לניחוש
  { id: 13, round: 'md3', stage: 'group', group: 'א׳', home: 'ESP', away: 'RSA', offsetHours: 22, distribution: [78, 14, 8] },
  { id: 14, round: 'md3', stage: 'group', group: 'א׳', home: 'BRA', away: 'JPN', offsetHours: 25, distribution: [61, 22, 17] },
  { id: 15, round: 'md3', stage: 'group', group: 'ב׳', home: 'ARG', away: 'USA', offsetHours: 46, distribution: [66, 20, 14] },
  { id: 16, round: 'md3', stage: 'group', group: 'ב׳', home: 'FRA', away: 'MAR', offsetHours: 49, distribution: [52, 27, 21] },
  { id: 17, round: 'md3', stage: 'group', group: 'ג׳', home: 'ENG', away: 'NED', offsetHours: 70, distribution: [45, 28, 27] },
  { id: 18, round: 'md3', stage: 'group', group: 'ג׳', home: 'GER', away: 'POR', offsetHours: 73, distribution: null },
];

/*
 * משתמשים אחרים בטבלה. הסטטיסטיקה שלהם קבועה (בחלק ג׳ תחושב בשרת).
 * total — כל הטורניר, round — המחזור הנוכחי בלבד.
 * exact / diff / direction — מספר הפגיעות מכל סוג (לשובר שוויון).
 */
const DEMO_USERS = [
  { id: 'u1', name: 'נועה לוי', total: { points: 34, exact: 5, diff: 2, direction: 3 }, round: { points: 6, exact: 1, diff: 0, direction: 1 } },
  { id: 'u2', name: 'יואב ברק', total: { points: 37, exact: 4, diff: 3, direction: 3 }, round: { points: 4, exact: 0, diff: 1, direction: 1 } },
  { id: 'u3', name: 'עומר שגיא', total: { points: 30, exact: 4, diff: 2, direction: 4 }, round: { points: 8, exact: 1, diff: 1, direction: 0 } },
  { id: 'u4', name: 'מיכל אורן', total: { points: 28, exact: 3, diff: 3, direction: 4 }, round: { points: 2, exact: 0, diff: 0, direction: 2 } },
  { id: 'u5', name: 'אבי רוזן', total: { points: 28, exact: 3, diff: 3, direction: 4 }, round: { points: 3, exact: 0, diff: 1, direction: 0 } },
  { id: 'u6', name: 'שירן גל', total: { points: 26, exact: 3, diff: 2, direction: 5 }, round: { points: 5, exact: 1, diff: 0, direction: 0 } },
  { id: 'u7', name: 'דניאל כהן', total: { points: 25, exact: 2, diff: 4, direction: 3 }, round: { points: 4, exact: 0, diff: 1, direction: 1 } },
  { id: 'u8', name: 'מאיה פרץ', total: { points: 23, exact: 3, diff: 1, direction: 5 }, round: { points: 1, exact: 0, diff: 0, direction: 1 } },
  { id: 'u9', name: 'איתי מזרחי', total: { points: 23, exact: 2, diff: 3, direction: 4 }, round: { points: 6, exact: 1, diff: 0, direction: 1 } },
  { id: 'u10', name: 'רוני אדלר', total: { points: 20, exact: 2, diff: 2, direction: 4 }, round: { points: 0, exact: 0, diff: 0, direction: 0 } },
  { id: 'u11', name: 'תמר בן-דוד', total: { points: 19, exact: 1, diff: 3, direction: 5 }, round: { points: 4, exact: 0, diff: 1, direction: 1 } },
  { id: 'u12', name: 'גיא שלום', total: { points: 16, exact: 1, diff: 2, direction: 5 }, round: { points: 2, exact: 0, diff: 0, direction: 2 } },
  { id: 'u13', name: 'ליה אבירם', total: { points: 12, exact: 1, diff: 1, direction: 4 }, round: { points: 1, exact: 0, diff: 0, direction: 1 } },
  { id: 'u14', name: 'אלון קרמר', total: { points: 11, exact: 0, diff: 2, direction: 5 }, round: { points: 3, exact: 0, diff: 1, direction: 0 } },
  { id: 'u15', name: 'הדר נחום', total: { points: 6, exact: 0, diff: 1, direction: 3 }, round: { points: 0, exact: 0, diff: 0, direction: 0 } },
];

/*
 * ליגות פרטיות קיימות. הליגה הרשמית (כל המשתמשים) לא מופיעה כאן — היא נבנית אוטומטית.
 * members — מזהי משתמשי הדמו מהרשימה למעלה. חשבונות שנוצרים בדפדפן מצטרפים בקוד ההזמנה.
 */
const DEMO_LEAGUES = [
  { id: 'army', name: 'חבר׳ה מהצבא', code: 'K7P2QX', members: ['u1', 'u3', 'u5', 'u7', 'u9', 'u12'] },
  { id: 'family', name: 'משפחה', code: 'F4M1LY', members: ['u13', 'u15'] },
  { id: 'office', name: 'המשרד', code: 'M4RK8T', members: ['u2', 'u4', 'u6', 'u8', 'u10', 'u11', 'u14'] },
  { id: 'bgu', name: 'סטודנטים ב-BGU', code: 'BGUWEB', members: ['u3', 'u6', 'u9', 'u12', 'u15'] },
];

// ליגות שחשבון חדש מצורף אליהן מראש, כדי שיהיה מה להציג בדמו
const SEEDED_LEAGUE_IDS = ['army', 'family'];

// ניחושי עבר שחשבון חדש מקבל, כדי שיהיו נקודות, תגים וטבלה להציג (matchId → ניחוש)
const SEEDED_PREDICTIONS = {
  1: { home: 2, away: 1, double: false },
  2: { home: 2, away: 0, double: false },
  3: { home: 1, away: 0, double: true },
  4: { home: 1, away: 1, double: false },
  5: { home: 2, away: 0, double: false },
  6: { home: 2, away: 1, double: false },
  7: { home: 1, away: 1, double: false },
  8: { home: 0, away: 2, double: false },
  9: { home: 2, away: 0, double: false },
  10: { home: 2, away: 1, double: false },
};
