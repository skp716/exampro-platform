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

## Super Admin activation

The new `super-admin.html` portal is separate from the existing Institute Exam
Admin panel. This separation keeps platform operations away from student and
result management.

To authorize the platform owner, add these fields to the owner's existing
`admins/{uid}` document in Firestore:

```text
active: true
role: "super_admin"
name: "Platform Owner"
```

Only an explicitly assigned `super_admin` can list, create, activate, suspend
or archive institutes. Existing active admin accounts without this role retain
their current Admin Panel access and cannot enter the Super Admin portal.

The first multi-institute foundation uses these collections:

```text
institutes/{instituteId}
institutes/{instituteId}/configuration_versions/{versionId}
institute_codes/{normalizedInstituteCode}
audit_logs/{logId}
```

Institute codes are reserved transactionally to prevent duplicates. Archiving
or suspending an institute preserves its data. Do not delete institute records
directly from the Firebase Console during normal operations.

## Institute Admin onboarding

1. Create the administrator in **Firebase Authentication > Users** using
   Email/Password. Copy the exact Firebase UID; never share or store the
   password in Firestore or GitHub.
2. Open `super-admin.html`, choose **Institute Admins**, and select
   **Add Institute Admin**.
3. Paste the Firebase UID, enter the same email, select exactly one institute,
   and save access.
4. The administrator signs in at `institute-admin.html`. The portal verifies
   `active: true`, `role: "institute_admin"`, the assigned `instituteId`, and an
   active institute before showing the workspace.

Disabling an administrator in Super Admin preserves the Authentication user
and institute data but immediately blocks the next Institute Admin access
check. Suspending the institute also blocks its administrator portal.

## Configuration and student gateway

- Use **Configure** beside an institute in `super-admin.html` to manage its
  branding, login/instruction template IDs, dynamic student fields, custom
  instruction sections, exam mode, security preset and feature permissions.
- Every save creates an immutable configuration version under
  `institutes/{instituteId}/configuration_versions` and an audit record.
- Students start at `student-gateway.html`, enter an exact Institute Code, and
  receive only that active institute's configuration. The gateway cannot list
  institute codes or inactive institutes.
- The gateway passes the validated institute and candidate profile into the
  existing `index.html` exam flow. Existing center-code and attempt-lock checks
  remain enabled.

After this update, publish `firestore.rules` again. The new exact-document read
allows an authenticated candidate to load only an active institute. Listing
the `institutes` collection remains restricted to Super Admin.

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
- A session can become `final_submitted` only after its matching completed
  result exists. If the network fails on the result screen, the student resumes
  at result submission instead of losing the attempt.
- Only admins may list results, change exam configuration, or delete records.

## Important production boundary

Browser-only scoring cannot protect an answer key or prove a score against a
student who deliberately modifies the client. For a high-stakes public exam,
move question delivery and scoring to a trusted backend (for example, Firebase
Cloud Functions with App Check) and keep answer keys outside this public
repository. Fullscreen/focus monitoring is a deterrent; mobile operating-system
overlays cannot be detected reliably by a normal website.

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
