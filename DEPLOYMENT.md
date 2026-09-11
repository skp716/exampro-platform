# Multi-institute portal fixes

This change repairs the three-portal flow without implementing question upload or changing `replaceViolatedQuestion`. Question-bank files are unchanged.

## Status and release order

Base reviewed: `7304850d9b5b32803d9868ed51b8a563227079a0` (main, 2026-09-11). This is a code update, not evidence that the production Firebase deployment has changed.

Use Node.js 22 for the Functions runtime; both `functions/package.json` and `firebase.json` now agree. [Firebase runtime documentation](https://firebase.google.com/docs/functions/manage-functions#set_nodejs_version).

These frontend changes depend on the callable functions and Firestore rules in this branch. Do not publish the HTML alone. Release during a window with no running exams.

1. Check out this branch and install backend dependencies:

   ```sh
   npm --prefix functions install
   ```

2. In an environment already signed into the correct Firebase account, deploy the backend:

   ```sh
   firebase deploy --only functions --project test-d6ee6
   ```

   This includes `createInstituteAdmin`, `assignInstituteAdmin`, `joinInstitute`, `forceSubmitInstituteAttempt`, and `resetInstituteAttempt`.

3. Publish this branch's frontend through the repository's normal GitHub Pages release and deploy these rules in the same maintenance window:

   ```sh
   firebase deploy --only firestore:rules,storage --project test-d6ee6
   ```

4. Students with an older open tab should reopen `student-gateway.html` and enter their institute code. This grants their existing Firebase UID institute membership. Do not clear student browser storage during an unfinished attempt.

Admin pages now use the named `bookesh-admin` Firebase app. Administrators must sign in again once; student anonymous authentication keeps its existing default app and UID.

## Fix an existing missing admin profile

The website cannot infer or grant administrator privileges from an email address. The owner must already have `admins/<owner UID>` with Boolean `active: true` and `role: super_admin`.

- For a new account, use **Super Admin → Create Admin Login**.
- For an existing Email/Password account, use **Super Admin → Institute Admins → Add Institute Admin** with its exact Firebase Authentication UID and matching email. The server now verifies that UID, email, account provider and institute before assigning access.
- The assigned institute must be active. Institute Admin must save an active center and active exam settings before students can enter. Missing setup is now reported before gateway handoff.

## Validation performed

```sh
node scripts/validate-repository.mjs
node tests/regression.cjs
node tests/lifecycle.cjs
```

The repository validator, 22 regression checks and 13 lifecycle checks passed locally. Newly written backend and test files also passed JavaScript syntax checks. Tests execute real frontend functions and callable handlers with an in-memory Firebase substitute. They cover timer independence, numeric ranking, count/order, immutable question snapshots, safe failure on incomplete snapshots, server force scoring, completed-result idempotency, unauthorized/suspended admin rejection, retake cleanup, institute membership and incomplete onboarding.

Browser smoke tests are supplied in `tests/portal-smoke.cjs`, with Firebase mocked. They could not be executed in the implementation environment because a Chromium executable was unavailable and its download repeatedly timed out. Live portal fetching was also unavailable; no browser interaction is claimed. With Playwright and Chromium installed, run:

```sh
npm --prefix tests install
cd tests
npx playwright install chromium
npm run browser
npm run rules
```

The `Verify exam portals` workflow runs local suites, the mocked browser journey and Firestore Emulator checks on pull requests or manual dispatch. These browser and emulator suites are supplied but **not yet verified as passing**.

Live Firebase Authentication, deployed Functions, Firestore rule enforcement and production load have **not** been verified. No load capacity or concurrent student limit is claimed. Before release acceptance, test the rules with Firebase Emulator Suite or a staging project and complete the following two-institute check:

1. Create active institutes A and B and an assigned Email/Password admin for each.
2. Configure different timers, sources, fields and entry windows. Save an active center for each.
3. Verify A's admin cannot read/write B's results, sessions, configuration or question bank. Verify an anonymous user without membership cannot read either question bank or list codes.
4. Join A with its code; confirm questions remain inaccessible in B. Suspend A and confirm direct reads/writes as A's admin and student are rejected.
5. Start a disposable exam in each institute concurrently. Answer questions, reload and resume A; verify order, answers and timer deadline remain unchanged.
6. With A's student offline, force-submit using A's admin. Only answers already synced to the server can be included. Verify the completed result and that B is unaffected.
7. Repeat force-submit; the completed result must remain unchanged. Also finalize an attempt already on the feedback screen.
8. Let a disposable attempt expire: it must calculate and finalize without a dialog click or star rating. Rating `0` means no rating was provided. Simulate a draft-save failure, retry, and verify only one completed result.
9. Reset A's test attempt and verify its snapshots, result, session and global lock are removed and a retake can start. Keep B's attempt intact.

## Operational limits

- Force-submit scores the latest saved answer state; it cannot recover answers never synced from an offline device. Logged-in but unstarted attempts are not converted into fabricated zero-score results.
- Older attempts without grading data can be finalized from their saved pending-result score. Otherwise the student must resume and sync first. Older source files must still contain their original question IDs for the first snapshot migration; missing questions cause an explicit error instead of silently moving answers.
- New attempts persist immutable question snapshots before starting. Snapshot writes are atomic and bounded: a question may not exceed 700 KB; a paper may occupy at most ten such chunks. Oversized papers fail before starting rather than creating an unrecoverable attempt.
- Scoring still uses the browser-provided answer key/grade map, matching the existing assessment model. This release does not claim tamper-proof server-authored question delivery or scoring. Existing public repository question files remain public.
- DND, screenshot and overlay settings provide reminders and supported browser signals, not operating-system controls.

## Additional fixes in this revision

- New tenant attempts are rejected by Firestore rules outside the configured entry window; already admitted in-progress and pending-feedback attempts can resume through the UI after entry closes.
- Gateway query-code submission works even when the submit event has no submitter. Valid non-Gmail email addresses are accepted.
- The loader rejects insufficient questions, duplicate keys and invalid answer options rather than silently changing the paper size. A configured All Questions section respects the total count across subjects. Unconfigured subjects are not appended.
- Progress writes are serialized, freeze answer maps and reject stale writes after result calculation/finalization. A session-scoped local backup can restore newer unsynced answers after reload when the attempt start time and owner still match. This is not a guarantee against cleared storage or an offline device being lost.
- Draft result and pending-feedback session commit together; final submission retries an unsaved draft. Timeout and violation-limit paths also invoke final submission.
- Final time taken is frozen at finish/deadline, so time spent giving feedback is not added on resume.
- Retake snapshot deletion, result/session deletion and lock deletion occur in one server transaction, avoiding concurrent-reset deletion of a newly started attempt.
- Invalid timer/count/duplicate-subject configuration is rejected. Failed exam startup returns to a retryable instruction screen. Governance saving now shows visible confirmation.

## Acceptance blockers

1. Run the supplied browser and rules suites successfully, then deploy and execute the two-institute staging test. Mocked local results are not substitutes for these gates.
2. If this will be used for adversarial/high-stakes exams, server-owned papers and answer keys plus server-authoritative grading are still needed: the current inherited model permits browser-supplied scores/keys. This update does not implement that redesign or make public question files confidential.
3. Question upload and question replacement functionality remain outside scope under the earlier explicit request. The existing replacement function is unchanged; persisting existing reserve questions supports snapshot consistency but is not a new replacement implementation.
