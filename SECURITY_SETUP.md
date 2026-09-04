# Firebase security setup

The application uses Firebase Authentication for identity and Firestore Rules
for authorization. The old browser-only admin password and public database
rules must not be used.

## One-time Firebase Console setup

1. Open **Build > Authentication > Sign-in method** and enable:
   - **Email/Password** for administrators.
   - **Anonymous** for the existing student name/Gmail form.
2. Create the administrator under **Authentication > Users** with the intended
   admin email and a new private password. Never put this password in GitHub.
3. Copy that user's Firebase **UID**. In Firestore, create:

   ```text
   Collection: admins
   Document ID: <ADMIN_FIREBASE_UID>
   Field: active (boolean) = true
   ```

4. Deploy the repository rules:

   ```bash
   firebase deploy --only firestore:rules --project test-d6ee6
   ```

## Authentication model

- Admins sign in with Firebase Email/Password. The dashboard opens only when
  `/admins/{uid}` exists and has `active: true`.
- Students keep the current name/Gmail form and receive a silent anonymous
  Firebase session. This protects each result by its Firebase UID, but it does
  not verify ownership of the typed Gmail address.
- `attempt_locks/{sha256(examId|email)}` is create-only for students. Deleting a
  result from the admin panel also deletes its lock and grants that attempt a
  retake.
- `centers/{sha256(centerCode)}` stores only the one-way code hash plus the
  institute, location, address and batch. Create/replace it from the Admin
  Panel's **Examination Center Access** card before admitting students.
- `exam_sessions/{sha256(examId|email)}` is the live admin row. It moves through
  `logged_in`, `in_progress`, `result_pending_feedback` and `final_submitted`,
  while retaining the question order, answers, timer deadline and security log
  needed for interrupted-exam resume.
- Only admins may list results, change exam configuration, or delete records.

## Required before a live examination

1. Deploy the current `firestore.rules`; the new center/session collections are
   denied by older rules and will otherwise show as a connection error.
2. Open Admin Panel and save one active center code. Give that exact code to the
   supervised students.
3. Confirm RRB displays 90 minutes and SSC GD displays 60 minutes in Admin.
4. Run one disposable student attempt, interrupt it, resume it, submit it and
   confirm the same live row changes to **Final Submitted**. Delete that test row
   from Admin afterward to release its email lock.

For verified Gmail ownership, replace anonymous student sign-in with Google
Sign-In in a future migration.
