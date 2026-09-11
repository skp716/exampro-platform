# Exampro update — pehle ye padhein

Latest checked main: `7304850d9b5b32803d9868ed51b8a563227079a0`. Aapke pehle se kiye changes preserve kiye gaye hain. Ye ZIP **update package** hai; ise poora repository samajhkar existing files delete na karein.

## Kaun si files badalni hain

| File | Kaam |
|---|---|
| `index.html` | Exam start/resume, timer, answer sync, result retry/auto-submit |
| `student-gateway.html` | Code-link submission, candidate email validation |
| `institute-admin.html` | Exam setting validation aur save handling |
| `platform-governance.html` | Save hone ka visible confirmation |
| `firestore.rules` | Institute membership, entry window, results/session permissions |
| `functions/index.js` | Join, admin assignment, force-submit aur atomic retake reset |
| `functions/scoring.js` | **Nayi file**: saved-answer scoring |
| `functions/package.json` | Backend dependencies aur Node 22 runtime |
| `firebase.json` | Matching Node 22 Firebase runtime |

`super-admin.html`, `create-institute-admin.html`, `institute-config.html`, `storage.rules` aur question-bank files mein is latest main ke comparison mein koi aur replacement zaroori nahi mila. Un files ko phir se overwrite karne ki zaroorat nahi.

ZIP ke `scripts/`, `tests/`, `.github/workflows/` aur Markdown files verification/instructions ke liye add/update karein. `UPDATE-MANIFEST.json` mein har included file ka SHA-256 hai.

## Apply karne ka order

1. Apne current repository ka backup lein. Sirf package mein di hui corresponding files add/replace karein; question files aur images preserve karein.
2. `DEPLOYMENT.md` ke mutabik Functions aur rules deploy karein. Sirf GitHub par HTML paste karne se Firebase backend update nahi hota.
3. Missing admin profile ho to Super Admin se existing Email/Password UID assign karein ya Create Admin Login use karein. Code user ko khud administrator nahi bana sakta.
4. Institute Admin se active center aur exam settings save karein.
5. Automated workflow/browser/rules tests aur do disposable institutes par live exam acceptance complete karein.

## Verification ka sachcha status

- Repository validation + 22 regression + 13 lifecycle checks: **PASS**.
- Browser: **BLOCKED** — Chromium absent, download timed out.
- Firestore emulator: **NOT RUN** — test supplied.
- Live Firebase deployment / live student exam / production load: **NOT VERIFIED**.
- Question upload/replacement: pehle ke instruction ke mutabik excluded.
- Browser-provided grading/answer keys ka inherited trust model abhi bhi hai; secure server-owned paper delivery implement nahi hui.

Isliye ise abhi “100% live complete” nahi kaha ja sakta. Pending acceptance details `DEPLOYMENT.md` mein hain.

## Portal URLs

- Student: https://skp716.github.io/exampro-platform/student-gateway.html
- Institute Admin: https://skp716.github.io/exampro-platform/institute-admin.html
- Super Admin: https://skp716.github.io/exampro-platform/super-admin.html

Ye repository ke portal routes hain; is session mein live login verify nahi hua.
