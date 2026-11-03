/*
 * scoring.js — חוקי המשחק של גולים (כמו בסעיף 4 באפיון): ניקוד, ★×2 ונעילה.
 * פונקציות טהורות: מקבלות נתונים ומחזירות תוצאה, בלי לגעת ב-DOM.
 */

// ★×2 עטוף בתווי כיווניות (LRI…PDI). בלעדיהם, בתוך משפט בעברית, הדפדפן מציג אותו הפוך: 2×★
const DOUBLE_LABEL = '⁦★×2⁩';

// ניקוד לפי שלב: מדויק / הפרש / כיוון. ★×2 מותר רק עד שמינית הגמר.
const STAGES = {
  group: { label: 'שלב הבתים', points: { exact: 5, diff: 3, direction: 1 }, doubleAllowed: true },
  r32: { label: 'שלב 32 האחרונות', points: { exact: 7, diff: 4, direction: 2 }, doubleAllowed: true },
  r16: { label: 'שמינית הגמר', points: { exact: 7, diff: 4, direction: 2 }, doubleAllowed: true },
  qf: { label: 'רבע הגמר', points: { exact: 9, diff: 5, direction: 3 }, doubleAllowed: false },
  sf: { label: 'חצי הגמר', points: { exact: 12, diff: 7, direction: 4 }, doubleAllowed: false },
  third: { label: 'המקום השלישי', points: { exact: 12, diff: 7, direction: 4 }, doubleAllowed: false },
  final: { label: 'הגמר', points: { exact: 15, diff: 9, direction: 5 }, doubleAllowed: false },
};

const HIT_LABELS = {
  exact: 'מדויק',
  diff: 'הפרש',
  direction: 'כיוון',
  miss: 'החטאה',
};

/**
 * מחשב כמה נקודות שווה ניחוש מול תוצאת הסיום.
 * @param {{home:number, away:number, double:boolean}} prediction
 * @param {{home:number, away:number}} result
 * @param {string} stageKey — מפתח מתוך STAGES
 * @returns {{kind:string, points:number}|null} null אם חסר ניחוש או תוצאה
 */
function calcPoints(prediction, result, stageKey) {
  if (!prediction || !result) return null;

  const tier = (STAGES[stageKey] || STAGES.group).points;
  const predictedDiff = prediction.home - prediction.away;
  const actualDiff = result.home - result.away;

  let kind = 'miss';
  if (prediction.home === result.home && prediction.away === result.away) {
    kind = 'exact';
  } else if (predictedDiff === actualDiff) {
    // כולל תיקו בתוצאה אחרת (1–1 מול 2–2): ההפרש זהה — 0
    kind = 'diff';
  } else if (Math.sign(predictedDiff) === Math.sign(actualDiff)) {
    kind = 'direction';
  }

  const base = kind === 'miss' ? 0 : tier[kind];
  const multiplier = prediction.double ? 2 : 1;
  return { kind, points: base * multiplier };
}

/**
 * מצב המשחק ברגע נתון. הניחושים ננעלים בדיוק בשריקת הפתיחה.
 * @returns {'open'|'live'|'pending'|'finished'}
 *   open — אפשר לנחש · live — משחק חי · pending — הסתיים, התוצאה בדרך · finished — יש תוצאה
 */
function getMatchStatus(match, now = Date.now()) {
  if (match.result) return 'finished';
  if (now < match.kickoff) return 'open';
  if (match.awaitingResult) return 'pending';
  return 'live';
}

/**
 * מסכם רשימת ניחושים לסטטיסטיקה אחת (משמש לטבלה ולפרופיל).
 * @param {Array<{kind:string, points:number}>} scored — תוצאות של calcPoints
 */
function summarizeScores(scored) {
  const summary = { points: 0, exact: 0, diff: 0, direction: 0, miss: 0, count: scored.length };
  for (const item of scored) {
    summary.points += item.points;
    summary[item.kind] += 1;
  }
  return summary;
}
