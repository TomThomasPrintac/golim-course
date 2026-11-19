# גולים — פרויקט הקורס "בניית מערכות מבוססות WEB"

אוניברסיטת בן-גוריון בנגב · מרצה: איציק גורביץ · 2026
צוות: תום-תומס פרינטק, זיו עמיר, ויקטוריה קוזמין

גולים היא אפליקציית Web בעברית לניחוש תוצאות משחקי כדורגל בליגות פרטיות בין חברים: מנחשים עד שריקת הפתיחה, מקבלים נקודות לפי הדיוק ומתחרים בטבלה.

## הגשת חלק ב׳ — צד לקוח

| מה | איפה |
|---|---|
| קובצי צד הלקוח | התיקייה [`client/`](client/) · להורדה כקובץ ZIP: [golim-course-main.zip](https://github.com/TomThomasPrintac/golim-course/archive/refs/heads/main.zip) |
| דוח PDF | [`docs/part-b/golim-part-b-report.pdf`](docs/part-b/golim-part-b-report.pdf) — הוראות הפעלה, 3 בדיקות, הסבר רכיב JavaScript, שימוש ב-AI ושינויים לעומת חלק א׳ |
| איך מנסים | הוראות קצרות בהמשך, והסבר מלא ב-[`client/README.md`](client/README.md) |

## מבנה הריפו לפי חלקי הפרויקט

| חלק | תיקייה | תוכן |
|---|---|---|
| א׳ — אפיון | [`docs/part-a/`](docs/part-a/) | מסמך האפיון (PDF) |
| ב׳ — צד לקוח | [`client/`](client/) · [`docs/part-b/`](docs/part-b/) | האתר: HTML, CSS ו-JavaScript · דוח חלק ב׳ (PDF) |
| ג׳ — צד שרת | `server/` | יתווסף בחלק ג׳ |

## הפעלה

```bash
cd client
python3 -m http.server 8000
```

ואז לפתוח את http://localhost:8000. אפשר גם לפתוח את `client/index.html` ישירות בכרום, בלי שרת.

לכניסה: חשבון הדמו `demo@golim.app` עם הסיסמה `Golim2026`, או הרשמה עם חשבון חדש. אפשרויות נוספות והסבר מלא: [`client/README.md`](client/README.md).

## הערה

גולים קיימת גם כאפליקציה אמיתית, שנבנתה ב-React Native. הקוד בריפו הזה נכתב מחדש לקורס ב-HTML, CSS ו-JavaScript בלבד, לפי האפיון בחלק א׳.
