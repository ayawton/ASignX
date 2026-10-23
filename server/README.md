# ASignX database

The active Drizzle schema implements the finalized **16-table** design in
[`Data-Dictionary.md`](../docs/final/Data-Dictionary.md) and
[`ER-Schema.md`](../docs/final/ER-Schema.md).

Application tables: `profiles`, `signs`, `courses`, `lessons`, `lesson_signs`,
`exercises`, `exercise_options`, `enrollments`, `lesson_progress`,
`exercise_attempts`, `model_versions`, `practice_attempts`,
`recognition_sessions`, `recognition_results`, `achievements`, `user_achievements`.
Supabase owns `auth.users`; authentication credentials are never duplicated.

## Setup and migration

Run commands from `server/`:

1. Set `DATABASE_URL` in `.env` to a current Supabase PostgreSQL connection string
   (see `.env.example`). Use a direct connection or session pooler for migrations.
   URL-encode special characters in the database password.
2. Run `npm install` if dependencies are missing.
3. Run `npm run db:migrate` to apply pending migrations.
4. Run `npm run db:check`. A healthy result has `connected: true` and empty
   `missing`, `unprotected`, and `legacy` arrays.
5. Run `npm run build` and `npm start` (or `npm run dev` during development).
   `GET /health/ready` returns 200 only when the database can be reached and all
   application tables exist; otherwise it returns 503.

The original departments/subjects migration is retained as migration history.
The next migration removes those tables and creates the application schema.
It refuses to discard legacy rows: export and clear any practice data first.
Use the migration runner on both fresh Supabase projects and projects with the
original migration already applied. Do not delete migration history or use
`drizzle-kit push` as a substitute: custom rules and grants are versioned SQL.
For an existing database created manually, reconcile its migration journal
before running migrations; the runner must not recreate existing tables.

On 2026-10-22 the saved database connection succeeded, both application migrations
were applied, and `db:check` reported no missing tables, unprotected application
tables, or legacy practice tables. `/health/ready` returned ready. The replacement
migration now tolerates already-absent practice tables while still refusing to
discard populated ones. Never put database credentials in frontend configuration.

## Access and integrity

- Every application table enables RLS. Guests see published learning content;
  learners read only their own activity. Private history has no admin-wide
  browser policy. Backend connections are privileged and must still verify
  caller identity, role, ownership, and publication before acting.
- Browser writes are limited to the owner's `display_name` and `timezone`.
  Roles, enrollments, outcomes, rewards, and achievements are backend writes.
  Email-confirmed Auth identities receive a learner profile automatically; only
  confirmed identities are backfilled, without trusting role metadata.
- `exercise_options` and `model_versions` have no browser access. The future
  quiz API must select only option `id`, `exercise_id`, `option_text`, and
  `sort_order`, omitting the answer key. Private model artifacts stay private.
- Database triggers verify course membership, compute quiz/practice correctness,
  require correct answers to each exercise before completion, award configured
  XP, and prevent completed rewards from changing. Empty-quiz completion must
  be requested by the backend only after material has been viewed.
- Published/used question definitions and model records are frozen. Author quiz
  content in a draft lesson, then publish it; publication requires at least two
  options and exactly one correct choice for each exercise. Create a new lesson
  version for changes to a used quiz.
- Recognition sessions accept ordered stabilized predictions only while open.
  Ending a session composes text from known predictions meeting the recorded
  model threshold. The backend must obtain explicit opt-in **before creating a
  saved session**; guests and unsaved sessions stay transient. Store no frames
  or raw video. The schema deliberately has no camera payload columns.
- Achievement inserts validate their metric. Streaks use distinct learner-local
  dates of completion or successful practice, ending today or yesterday.
- Retry outcome inserts with the same UUID; use `ON CONFLICT DO NOTHING` for
  idempotent submissions. Complete lessons atomically using the existing
  `(enrollment_id, lesson_id)` row and preserve its first completion timestamp.

Supabase Storage buckets (`learning-media` and private `model-artifacts`), their
policies, content seeding, and full account lesson integration
are separate setup work. The frontend uses sample learning content and isolated guest
browser practice storage. No production lesson content or trained ML model is claimed by this schema.

## Verification

`npm test` runs migrations and behavioral checks against disposable local
PostgreSQL (PGlite), with minimal Supabase Auth/role prerequisites. It never reads
`.env` or connects to Supabase. Checks cover all 16 tables, RLS/column grants,
answer-key protection, signup roles, grading, one-time XP, publication,
recognition ordering, achievement eligibility, and account-deletion cascades.

`npm run build` checks the TypeScript implementation. `npm run db:generate`
generates future schema migrations; triggers and table/column grants must be
maintained in custom SQL migrations alongside the generated schema changes.

## Accounts and public access

The client now uses Supabase Auth for display-name/email/password signup,
confirmation, login, reset email/password update, persistent sessions, and logout.
Implementation follows the Supabase password authentication guide:
https://supabase.com/docs/guides/auth/passwords

1. Copy `client/.env.example` to `client/.env.local` and supply the project URL
   and public publishable key (legacy anon key also works). Never supply a secret
   or service-role key to Vite. Supply matching `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` in `server/.env`, plus the corrected DATABASE_URL.
2. Enable email confirmations in Supabase Auth. Configure the site URL and allow
   the exact frontend `/auth/callback` and `/reset-password` redirect URLs,
   including callback query strings used for internal return paths. For local
   development the frontend origin is normally `http://localhost:5173`.
   Configure production email delivery/SMTP as required by your project.
3. Apply the existing migrations and verify readiness. No schema rewrite is
   required for this authentication implementation.
4. Run `npm run dev` in both client and server. Vite proxies `/api` to port 3000.
   In production serve `/api` from the backend under the frontend origin and
   configure SPA fallback for confirmation/reset and other internal routes.

Home/About, Live, Learn, sample lessons/practice and published course browsing
remain public. Profile and account Progress redirect guests to login with an
internal return path. Auth screens keep guest learning accessible. Published
courses support authenticated enrollment. Sample introductions stay separate
from account records; they do not grant XP, grades, streaks or achievements.
Existing local prototype profiles and progress are never promoted to accounts.
Guest practice uses a separate browser key. Practice answer checking now runs
on the server; answer keys are absent from the frontend lesson data.

`/api/me/profile` (GET/PATCH), `/api/me/progress` (GET), and
`/api/me/enrollments` (POST) verify the bearer token through Supabase Auth on
every request and require a confirmed email. Queries use only the verified
identity, never a caller-supplied user ID. Profile updates whitelist name and
zone; roles and emails are not editable there. Progress/rewards/streaks come
from database records. Invalid/missing sessions fail closed. Data failures return
sanitized errors. There are no public content/user management endpoints;
management remains unavailable rather than permitting learners to mutate it.

Live remains local preview plus scripted results. Every demo session is transient
for guests and accounts. No save-history endpoint is enabled; recognition and
explicit opt-in must be implemented before persistent Live sessions are exposed.
Published course enrollment is supported, but the existing sample lesson UI is
not a production account grading/completion flow. Account XP/achievements/streaks
can be read from valid database records; sample practice never writes them.

Run `npm test` in server (build, authentication boundary checks and the existing
20 database behavioral checks), and `npm test`, `npm run lint`, `npm run build`
in client. Local checks do not verify hosted Auth, email delivery, deployed RLS,
or remote migrations. Test signup → email confirmation → login → refresh →
profile save → logout → protected return, password recovery, and two-account
isolation against a configured project before release.



### Registration implementation

`client/src/registration.js` now submits the validated display name, email and
password through `supabase.auth.signUp`; confirmation password is checked only
in the form. The application never sends role/XP/prototype profile data at signup.
The Auth confirmation trigger creates the learner profile only once email_confirmed_at is set. A signup requiring email
confirmation shows a check-email step instead of pretending a user is logged in.
After confirmation the callback returns only to a permitted internal route.
The confirmation message does not disclose whether an address already exists.

`npm test` in client includes registration tests using the real Supabase SDK
with a mocked network response. They cover the signup payload, confirmation URL,
invalid details, missing configuration, unsafe redirects and provider errors.
These tests do not send emails or create hosted accounts.

The PostgreSQL DATABASE_URL is used by the backend database driver; Supabase Auth
uses the project's HTTPS URL and public publishable/anon key. The working database
connection cannot substitute for those Auth settings. See the frontend and server
`.env.example` files for the exact variable names. After adding them, restart both
development servers. Enable Email signup and Confirm email in the Supabase dashboard,
then allow the frontend origin's `/auth/callback` (including its `next` query) and
`/reset-password` URLs. Use the actual Vite port shown in the terminal.

### Verified local Auth configuration (2026-10-23)

The existing project URL and a verified public publishable key are now configured
in `client/.env.local` and `server/.env`. No secret/service-role key was used.
The live Auth settings endpoint confirms Email signup enabled, signup permitted,
and email auto-confirm disabled. Database readiness passes with all 16 tables
and RLS present. Site URL is now `http://localhost:5173`; callback query paths and
password-reset routes are allowlisted for local frontend ports 5173–5175.

Custom SMTP is currently OFF in this Supabase project. The default sender only
sends to project-team email addresses, with restrictive rate limits. Test using
your Supabase team email. Before allowing general users to register, configure
an SMTP provider and verified sender in Authentication → Emails → SMTP Settings.
Do not turn off email confirmation to bypass this requirement. Reference:
https://supabase.com/docs/guides/auth/auth-smtp

Local registration tests mock email delivery; an inbox-confirmation round trip
has not been performed. Use a password of your choice when testing the UI; no
permanent test account or password has been created by this implementation.

### Email confirmation flow

The check-email step now supports resending confirmation with a 60-second
cooldown. An expired/missing confirmation link offers an email-only resend form.
The login page still shows resend only after an email-not-confirmed response.
Resend responses do not expose whether an address exists.

`/auth/callback` now explicitly verifies the incoming link using Supabase,
including implicit token pairs, PKCE codes, or supported email token hashes.
The SDK's automatic URL processing is disabled on that route to prevent racing
the explicit verification. Credentials are removed from the address bar before
rendering the result. A previously persisted browser session cannot cause an
expired link to appear successful. Success requires `getUser` to confirm the
email through Supabase; no backend bypass or local confirmation flag is used.
Reset-password URL handling continues to use the SDK's existing recovery flow.

Client tests cover verification success, missing/expired/recovery links,
provider failures, unconfirmed users, existing-session isolation, safe redirects,
and the real SDK resend payload with mocked delivery. These do not prove inbox
delivery. SMTP remains a separate prerequisite for non-team recipients; setting
a From address alone does not authenticate a sender. Supply sending credentials
only through the provider/Supabase settings, never frontend environment variables.

### Gmail sender saved (2026-10-23)

The user saved custom SMTP in the Supabase dashboard. A fresh settings view
confirmed SMTP enabled, sender name ASignX, host smtp.gmail.com, port 465, and
a stored hidden password. The selected sender is xianreel2006@gmail.com. The
app password was entered by the user in Supabase, not read or stored in source.
This supersedes the earlier note that custom SMTP was OFF.

The account for the selected address exists, is not email-confirmed, and has an
application learner profile. An actual confirmation-resend request was attempted
with the configured public SDK client. Supabase returned HTTP 429,
`over_email_send_rate_limit` / `email rate limit exceeded`; Gmail authentication
and inbox delivery therefore remain unverified. The dashboard shows 30 emails
per hour and a 60-second per-user interval. The last confirmation email was over
60 seconds earlier. No rate limits were changed and no account was manually
confirmed. Retry after the project quota resets, then complete the inbox link.


### Profiles require email confirmation (2026-10-23)

Migration 20261022172738_confirmed_profiles is applied to the connected project.
Signup retains a pending Supabase auth.users record but creates no public.profiles
row. The Auth email_confirmed_at transition creates the learner profile, and
already-confirmed inserts also work. Role metadata is ignored; the default is
always learner. Repeated confirmation updates preserve existing profile details.
Profile inserts also require a verified Auth identity at the database boundary.
Activation depends on Supabase verification, not loading the browser success page.

The upgrade removes only old unconfirmed profiles with no personal activity. It
refuses to proceed if an unconfirmed profile has enrollments, practice, saved Live
sessions, or achievements, preventing cascade data loss. Auth records are preserved
so their confirmation links remain usable. Confirmed profiles are preserved.

Live verification after migration: one pending Auth identity, zero profiles, and
zero unconfirmed profiles. No email confirmation flag was manually changed.
All 25 backend tests pass, including delayed creation, repeated confirmation,
direct-insert protection, pending-account deletion, and upgrade data protection.

### Login implementation (2026-10-23)

The dedicated login page uses `loginAccount` to trim the email (never the password),
validate inputs, sign in through Supabase, and verify the returned identity using
`getUser`. Only email-confirmed accounts are accepted. Invalid credentials use a
generic message; confirmation resend is offered only after email-not-confirmed
errors. Resending uses the existing confirmation controls and cooldown.

Persistent sessions and auto refresh are explicit SDK settings. Session restoration
and incoming auth events are checked with Supabase outside the synchronous Auth
callback. Revisions prevent a slow restore/verification from reviving a session
after logout or replacing a newer login. A rejected restored session clears the
UI account state and asks the user to log in again. Backend personal endpoints
continue to verify each bearer token independently and enforce ownership.
Logout signs out the current session and clears the current UI state.

`client/scripts/login.test.mjs` covers the real SDK password-grant request with
mocked Auth responses, verified user retrieval, persistent storage and logout,
invalid/unconfirmed/rate-limited logins, revoked sessions, restore/logout races,
and exclusion of passwords from session storage. Client registration/confirmation
and route smoke tests, lint, production build, and 25 backend tests pass. A real
password login requires the user to enter their own credentials; no password was
requested in chat or saved by the implementation.

Browser verification also reached the live configured Supabase service: a dummy
invalid login was rejected with the generic credentials message, and guest access
to Progress redirected to `/login?next=%2Fprogress`. The login screen was visually
reviewed. A successful real-account login has not been performed without the
user's own confirmed account credentials; successful login/session behavior is
covered by the SDK tests described above.
