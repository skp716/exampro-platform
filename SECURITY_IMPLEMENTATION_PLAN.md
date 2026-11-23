# Security Hardening Plan

Repository: `skp716/exampro-platform`
Target implementation branch: `security/hardening-existing-login-20261123`
Baseline: `main` commit `fad2648482babe5a37695160f7d893b8dc75a586`

## Guardrails

- Keep the existing student login flow. Do not add Email OTP or Mobile OTP.
- Preserve all current student, institute-admin, and super-admin screens and workflows.
- Do not modify the `main` branch, merge a pull request, or deploy Firebase resources without explicit user approval.
- Make changes only in this repository and on the implementation branch.
- Do not publish rules that block existing clients until their replacement backend path has been implemented and tested.
- Do not delete or migrate existing student results, attempts, exam sessions, question banks, or institute configuration as part of a security change.
- Keep a tested rollback path for every production configuration change.

## Baseline findings (verified from the current main branch)

1. Student portal uses Firebase Anonymous Authentication (`index.html`).
2. The student browser calculates correct/wrong counts and score locally.
3. The student browser writes draft and completed result data to Firestore.
4. Firestore rules validate result ownership and basic field shape, but cannot prove that the submitted score matches the answer key.
5. Attempt locks are keyed from exam ID + entered email while ownership is tied to an anonymous Firebase UID. This does not prove control of the entered email.
6. Exam timer, tab/focus events, penalties, and auto-submission are primarily browser-controlled.
7. `firebase.json` currently configures Firestore rules only; no Cloud Functions source/package was found on `main`.
8. Question source files are in the public GitHub repository. Client-side answer-key data must be treated as public.
9. Existing `firestore.rules` allow a student to update a draft result to a completed result; rules do not independently calculate the score.
10. The current student UI and login flow are to remain unchanged during the backend migration.

## Implementation sequence

### Phase 0 — Safety and regression baseline
- Preserve a backup ref and use the dedicated implementation branch.
- Capture current login, center validation, exam start/resume, answer save, feedback, result review, admin leaderboard, force-submit/retake and export behavior.
- Add automated tests before changing security-sensitive flows.
- Record existing Firestore document shapes and query patterns before changing rules.

### Phase 1 — Trusted result evaluation
- Add Firebase Cloud Functions (2nd gen) using a supported Node.js runtime.
- Move answer-key evaluation, marks, negative marking, penalty caps, duration checks and final result creation to trusted server code.
- Do not accept score/correct/wrong values from the browser as authoritative.
- Store or publish answer keys only in a server-readable location that student clients cannot read.
- Keep the existing result document fields compatible with the admin reports wherever possible.
- Keep the client-side review UI, but source authoritative result values from the backend.

### Phase 2 — Existing-login attempt protection
- Retain Anonymous Authentication and the current name/email form.
- Enforce one active/completed attempt using a server transaction and authenticated UID.
- Treat entered email as a claimed contact field, not a verified identity. Without OTP or another identity proof, email impersonation cannot be completely prevented.
- Ensure resume, duplicate-tab, retake and force-submit behavior remains compatible.

### Phase 3 — Admin and institute authorization
- Audit admin membership documents and institute/center ownership mapping.
- Enforce institute scope in Firestore rules and trusted functions, not only in UI filters.
- Restrict super-admin-only operations separately from institute-admin operations.
- Test cross-institute read/write denial using the Firebase Emulator.

### Phase 4 — Exam session integrity and question confidentiality
- Establish server-issued start/deadline timestamps and server-side finalization.
- Treat browser tab/focus events as telemetry, not cryptographic proof of cheating.
- Move answer keys out of public static assets. Deliver only question content needed by the client; keep evaluation keys server-only.
- Keep question IDs/order stable so existing question banks and reports continue to work.

### Phase 5 — Firebase and dependency hardening
- Add App Check after verifying supported web clients and rollout behavior.
- Review API key application restrictions and authorized domains.
- Add Storage rules if Storage is used; do not invent or deploy unused resources.
- Pin and audit dependencies; address critical/high vulnerabilities without blind major-version upgrades.

### Phase 6 — Verification and release gate
- Run Firestore Rules unit tests and Cloud Functions unit tests in Emulator Suite.
- Run browser regression tests for student and both admin roles.
- Verify existing records remain readable and exports/leaderboards are unchanged.
- Review the exact diff and test report with the user.
- Deploy only after explicit approval; merge to `main` only after explicit approval.

## Release blockers

- Any test regression in existing login, exam flow, result review, reports, admin access, retake or force-submit.
- Any change that makes old results unreadable.
- Any rules change that locks out existing clients before a compatible backend is ready.
- Any migration that deletes, rewrites, or exposes answer keys without a verified rollback.
- Any Firebase production deployment without explicit user approval.
