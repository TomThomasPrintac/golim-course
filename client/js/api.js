/*
 * api.js — הדמיה של צד השרת.
 *
 * בחלק ב׳ אין שרת, ולכן הקובץ הזה ממלא את תפקידו:
 *   - הנתונים נשמרים ב-localStorage של הדפדפן במקום בבסיס נתונים.
 *   - כל פונקציה מחזירה Promise עם השהיה קצרה, כמו בקשת רשת אמיתית.
 *   - כשהדפדפן לא מחובר לרשת (navigator.onLine = false) הבקשה נכשלת, כמו בשרת אמיתי.
 *   - הכללים נבדקים כאן שוב (נעילה, טווח, ★×2), כי לא סומכים על הלקוח.
 *
 * העמודים לא ניגשים ל-localStorage בעצמם — רק דרך Api.
 * כך בחלק ג׳ נחליף רק את הקובץ הזה בקריאות fetch לשרת, ושאר הקוד לא ישתנה.
 */

class ApiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code; // מזהה קבוע לטיפול בקוד, למשל 'locked' או 'network'
    this.details = details;
  }
}

const Api = (() => {
  const KEYS = {
    accounts: 'golim.accounts',
    session: 'golim.session',
    otp: 'golim.otp',
    customLeagues: 'golim.customLeagues',
    kickoffOverrides: 'golim.kickoffOverrides',
  };
  const LATENCY_MS = 450;
  const HOUR_MS = 60 * 60 * 1000;
  const OTP_TTL_MS = 5 * 60 * 1000;
  const OTP_MAX_ATTEMPTS = 5;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // בלי O/0 ו-I/1 שקל להתבלבל ביניהם
  const DEFAULT_SETTINGS = { kickoffReminder: true, results: true, overtaken: false };

  // ---------- אחסון ----------

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback; // נתון פגום או אחסון חסום — מתחילים מחדש
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** מדמה בקשת רשת: מחכה, נכשל אם אין חיבור, ואחרת מריץ את הפעולה בצד ה"שרת". */
  function respond(action) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!navigator.onLine) {
          reject(new ApiError('network', 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.'));
          return;
        }
        try {
          resolve(action());
        } catch (error) {
          reject(error);
        }
      }, LATENCY_MS);
    });
  }

  // ---------- משתמשים ----------

  function getAccounts() {
    return read(KEYS.accounts, {});
  }

  function sessionEmail() {
    const session = read(KEYS.session, null);
    return session ? session.email : null;
  }

  function requireAccount() {
    const email = sessionEmail();
    const account = email ? getAccounts()[email] : null;
    if (!account) throw new ApiError('unauthorized', 'צריך להתחבר מחדש');
    return { email, account };
  }

  /** משנה את החשבון המחובר ושומר. */
  function updateAccount(change) {
    const { email } = requireAccount();
    const accounts = getAccounts();
    change(accounts[email]);
    write(KEYS.accounts, accounts);
    return accounts[email];
  }

  /** חשבון חדש מקבל ניחושי עבר ושתי ליגות, כדי שיהיה מה להציג בדמו. */
  function createAccount(email) {
    const predictions = {};
    for (const [matchId, prediction] of Object.entries(SEEDED_PREDICTIONS)) {
      predictions[matchId] = { ...prediction, savedAt: Date.now() };
    }
    return {
      name: null,
      leagues: [...SEEDED_LEAGUE_IDS],
      predictions,
      settings: { ...DEFAULT_SETTINGS },
      createdAt: Date.now(),
    };
  }

  function signIn(email) {
    const accounts = getAccounts();
    if (!accounts[email]) {
      accounts[email] = createAccount(email);
      write(KEYS.accounts, accounts);
    }
    write(KEYS.session, { email });
    return currentUser();
  }

  function currentUser() {
    const email = sessionEmail();
    const account = email ? getAccounts()[email] : null;
    return account ? { email, name: account.name } : null;
  }

  // ---------- משחקים ----------

  /** תחילת השעה הנוכחית — כל זמני המשחקים מחושבים ממנה (ראו offsetHours ב-data.js). */
  function baseTime() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.getTime();
  }

  function team(code) {
    return { code, ...TEAMS[code] };
  }

  /** כל המשחקים, עם זמן פתיחה מחושב והניחוש של המשתמש המחובר. */
  function allMatches() {
    const base = baseTime();
    const overrides = read(KEYS.kickoffOverrides, {});
    const email = sessionEmail();
    const account = email ? getAccounts()[email] : null;
    const predictions = account ? account.predictions : {};

    return MATCHES.map((raw) => ({
      id: raw.id,
      round: raw.round,
      roundLabel: ROUNDS[raw.round],
      stage: raw.stage,
      stageLabel: STAGES[raw.stage].label,
      group: raw.group,
      home: team(raw.home),
      away: team(raw.away),
      kickoff: overrides[raw.id] ?? base + raw.offsetHours * HOUR_MS,
      result: raw.result ?? null,
      live: raw.live ?? null,
      awaitingResult: Boolean(raw.awaitingResult),
      distribution: raw.distribution ?? null,
      myPrediction: predictions[raw.id] ?? null,
    })).sort((a, b) => a.kickoff - b.kickoff);
  }

  /** המחזור הנוכחי = המחזור של המשחק האחרון שכבר התחיל. */
  function currentRound(matches) {
    const started = matches.filter((match) => match.kickoff <= Date.now());
    return started.length ? started[started.length - 1].round : matches[0].round;
  }

  // ---------- טבלאות ----------

  /** סטטיסטיקה של חשבון מקומי, מחושבת מהניחושים שלו מול התוצאות. */
  function accountStats(account, period, matches, round) {
    const scored = matches
      .filter((match) => match.result && account.predictions[match.id])
      .filter((match) => period === 'total' || match.round === round)
      .map((match) => calcPoints(account.predictions[match.id], match.result, match.stage));
    return summarizeScores(scored);
  }

  function allLeagues() {
    return [...DEMO_LEAGUES, ...read(KEYS.customLeagues, [])];
  }

  /**
   * שורות הדירוג של ליגה: משתמשי הדמו (נתונים קבועים) + חשבונות מקומיים שחברים בה.
   * 'official' = הליגה הרשמית, שכל המשתמשים חברים בה.
   */
  function leaderboardRows(leagueId, period) {
    const matches = allMatches();
    const round = currentRound(matches);
    const league = allLeagues().find((item) => item.id === leagueId);
    const inLeague = (accountLeagueIds) => leagueId === 'official' || accountLeagueIds.includes(leagueId);

    const rows = DEMO_USERS
      .filter((user) => leagueId === 'official' || (league && league.members.includes(user.id)))
      .map((user) => ({ id: user.id, name: user.name, isMe: false, ...user[period] }));

    const me = sessionEmail();
    for (const [email, account] of Object.entries(getAccounts())) {
      if (!account.name || !inLeague(account.leagues)) continue;
      rows.push({ id: email, name: account.name, isMe: email === me, ...accountStats(account, period, matches, round) });
    }
    return rankRows(rows);
  }

  /**
   * מיון לפי סדר שוברי השוויון מהאפיון: נקודות ← מדויקים ← הפרש ← כיוון.
   * שוויון מלא — אותו מקום לשני המשתמשים (ובתצוגה לפי שם).
   */
  function rankRows(rows) {
    const sameStats = (a, b) =>
      a.points === b.points && a.exact === b.exact && a.diff === b.diff && a.direction === b.direction;

    rows.sort((a, b) =>
      b.points - a.points ||
      b.exact - a.exact ||
      b.diff - a.diff ||
      b.direction - a.direction ||
      a.name.localeCompare(b.name, 'he'));

    rows.forEach((row, index) => {
      const previous = rows[index - 1];
      row.rank = previous && sameStats(previous, row) ? previous.rank : index + 1;
    });
    return rows;
  }

  function generateInviteCode() {
    const taken = new Set(allLeagues().map((league) => league.code));
    let code;
    do {
      code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (taken.has(code));
    return code;
  }

  function leagueSummary(league) {
    const rows = leaderboardRows(league.id, 'total');
    const me = rows.find((row) => row.isMe);
    return {
      id: league.id,
      name: league.name,
      code: league.code,
      memberCount: rows.length,
      myRank: me ? me.rank : null,
    };
  }

  // ---------- הפונקציות שהעמודים משתמשים בהן ----------

  return {
    /** המשתמש המחובר, או null. סינכרוני — כמו session ששמור בדפדפן. */
    currentUser,

    requestOtp(rawEmail) {
      return respond(() => {
        const check = Validation.email(rawEmail);
        if (!check.valid) throw new ApiError('invalid', check.error);
        const code = String(Math.floor(100000 + Math.random() * 900000));
        write(KEYS.otp, { email: check.value, code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
        // בשרת אמיתי הקוד נשלח במייל. בדמו מחזירים אותו כדי להציג על המסך.
        return { email: check.value, demoCode: code };
      });
    },

    verifyOtp(email, code) {
      return respond(() => {
        const otp = read(KEYS.otp, null);
        if (!otp || otp.email !== email) {
          throw new ApiError('otp-invalid', 'קוד לא תקין או פג תוקף. בקש קוד חדש.');
        }
        if (Date.now() > otp.expiresAt) {
          localStorage.removeItem(KEYS.otp);
          throw new ApiError('otp-expired', 'פג תוקף הקוד (5 דקות). בקש קוד חדש.');
        }
        if (otp.code !== code) {
          otp.attempts += 1;
          if (otp.attempts >= OTP_MAX_ATTEMPTS) {
            localStorage.removeItem(KEYS.otp);
            throw new ApiError('otp-locked', 'יותר מדי ניסיונות שגויים. בקש קוד חדש.');
          }
          write(KEYS.otp, otp);
          const left = OTP_MAX_ATTEMPTS - otp.attempts;
          throw new ApiError('otp-invalid', `קוד לא תקין. נשארו ${left} ניסיונות.`);
        }
        localStorage.removeItem(KEYS.otp);
        return signIn(email);
      });
    },

    /** כניסה עם Google — בדמו נכנסים לחשבון Google קבוע. */
    signInWithGoogle() {
      return respond(() => signIn('demo.google@gmail.com'));
    },

    updateName(rawName) {
      return respond(() => {
        const check = Validation.displayName(rawName);
        if (!check.valid) throw new ApiError('invalid', check.error);
        updateAccount((account) => { account.name = check.value; });
        return currentUser();
      });
    },

    logout() {
      localStorage.removeItem(KEYS.session);
    },

    getMatches() {
      return respond(() => {
        requireAccount();
        return allMatches();
      });
    },

    getMatch(id) {
      return respond(() => {
        requireAccount();
        const match = allMatches().find((item) => item.id === id);
        if (!match) throw new ApiError('not-found', 'המשחק לא נמצא');
        return match;
      });
    },

    /**
     * שמירת ניחוש. השרת בודק שוב את כל הכללים, גם אם הלקוח כבר בדק.
     * @param {number} matchId
     * @param {{home:number, away:number, double:boolean}} input
     * @returns {Promise<{movedFrom: object|null}>} movedFrom — משחק שה-★×2 הועבר ממנו
     */
    savePrediction(matchId, input) {
      return respond(() => {
        requireAccount();
        const matches = allMatches();
        const match = matches.find((item) => item.id === matchId);
        if (!match) throw new ApiError('not-found', 'המשחק לא נמצא');

        // נעילה לפי שעון השרת: גם אם העמוד היה פתוח, אחרי שריקת הפתיחה אי אפשר לשמור
        if (getMatchStatus(match) !== 'open') {
          throw new ApiError('locked', 'המשחק כבר התחיל — הניחושים ננעלו.');
        }
        for (const goals of [input.home, input.away]) {
          if (!Number.isInteger(goals) || goals < 0 || goals > MAX_GOALS) {
            throw new ApiError('invalid', `תוצאה לא תקינה: מספר שלם בין 0 ל-${MAX_GOALS}.`);
          }
        }

        // ★×2: פעם אחת במחזור. אם הוא על משחק אחר שעוד לא התחיל — מעבירים אותו לכאן.
        let movedFrom = null;
        if (input.double) {
          if (!STAGES[match.stage].doubleAllowed) {
            throw new ApiError('double-not-allowed', `${DOUBLE_LABEL} לא זמין בשלב הזה של הטורניר.`);
          }
          const other = matches.find((item) =>
            item.id !== match.id && item.round === match.round && item.myPrediction && item.myPrediction.double);
          if (other && getMatchStatus(other) !== 'open') {
            throw new ApiError('double-used',
              `כבר השתמשת ב-${DOUBLE_LABEL} ב${match.roundLabel}, על ${other.home.name}–${other.away.name} שכבר התחיל.`);
          }
          movedFrom = other || null;
        }

        updateAccount((account) => {
          if (movedFrom) account.predictions[movedFrom.id].double = false;
          account.predictions[match.id] = {
            home: input.home,
            away: input.away,
            double: Boolean(input.double),
            savedAt: Date.now(),
          };
        });
        return { movedFrom };
      });
    },

    getMyLeagues() {
      return respond(() => {
        const { account } = requireAccount();
        return allLeagues()
          .filter((league) => account.leagues.includes(league.id))
          .map(leagueSummary);
      });
    },

    createLeague(rawName) {
      return respond(() => {
        const { account } = requireAccount();
        const myNames = allLeagues().filter((league) => account.leagues.includes(league.id)).map((league) => league.name);
        const check = Validation.leagueName(rawName, myNames);
        if (!check.valid) throw new ApiError('invalid', check.error);

        const league = { id: `c${Date.now()}`, name: check.value, code: generateInviteCode(), members: [] };
        write(KEYS.customLeagues, [...read(KEYS.customLeagues, []), league]);
        updateAccount((acc) => { acc.leagues.push(league.id); });
        return leagueSummary(league);
      });
    },

    joinLeague(code) {
      return respond(() => {
        const { account } = requireAccount();
        const league = allLeagues().find((item) => item.code === code);
        if (!league) throw new ApiError('invalid-code', 'קוד שגוי או פג תוקף. בקש מהחבר קישור חדש.');
        if (account.leagues.includes(league.id)) {
          throw new ApiError('already-member', `אתה כבר חבר בליגה "${league.name}".`);
        }
        updateAccount((acc) => { acc.leagues.push(league.id); });
        return leagueSummary(league);
      });
    },

    /**
     * @param {string} leagueId — 'official' או מזהה ליגה פרטית
     * @param {'total'|'round'} period
     */
    getLeaderboard(leagueId, period) {
      return respond(() => {
        requireAccount();
        const matches = allMatches();
        return {
          rows: leaderboardRows(leagueId, period),
          roundLabel: ROUNDS[currentRound(matches)],
        };
      });
    },

    getSettings() {
      return respond(() => ({ ...DEFAULT_SETTINGS, ...requireAccount().account.settings }));
    },

    saveSettings(settings) {
      return respond(() => {
        updateAccount((account) => { account.settings = { ...account.settings, ...settings }; });
      });
    },

    /** כלים לבדיקות בלבד (עמוד הפרופיל). */
    demo: {
      /** קובע שהמשחק הפתוח הבא ייפתח בעוד דקה — לבדיקת נעילה בזמן שהעמוד פתוח. */
      kickoffSoon() {
        const next = allMatches().find((match) => getMatchStatus(match) === 'open');
        if (!next) return null;
        const overrides = read(KEYS.kickoffOverrides, {});
        overrides[next.id] = Date.now() + 60 * 1000;
        write(KEYS.kickoffOverrides, overrides);
        return next;
      },

      /** מוחק את כל נתוני הדמו מהדפדפן. */
      reset() {
        Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
      },
    },
  };
})();
