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
- Only admins may list results, change exam configuration, or delete records.

For verified Gmail ownership, replace anonymous student sign-in with Google
Sign-In in a future migration.
