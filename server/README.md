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

Private `model-artifacts` Storage setup and learning content seeding
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
learning-content management requires the admin API described below.

Live remains local preview plus scripted results. Every demo session is transient
for guests and accounts. No save-history endpoint is enabled; recognition and
explicit opt-in must be implemented before persistent Live sessions are exposed.
Published course enrollment and the separate account lesson player support saved
grading and completion. The numbered sample lesson UI remains guest practice.
Account XP/achievements/streaks
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

### Server-side ASignLive recognition

Run `npm run recognition` alongside `npm run dev` to start the private Python
ONNX/MediaPipe service and the Express gateway. The client uploads bounded JPEG
frames; it downloads no trained models and performs no model inference. Model
files live under ignored `server/private/models`, outside client public assets.
Both services read a shared backend-only token from `server/.env`; the Python
service binds only to localhost. No frames or recognition history are persisted.
Setup, architecture, limits and checks are in `docs/ASignLive-Recognition.md` at
the repository root. Run `npm run test:recognition` for the Python/ONNX checks.

### Learner dashboard

### Admin course management

### Admin sign library

`/dashboard/admin/signs` lists, searches, creates, edits, and publishes vocabulary.
GET/POST `/api/admin/signs` and PATCH `/api/admin/signs/:id` use the existing
confirmed-admin middleware. Labels are trimmed and uppercased (up to 100
characters), meanings are required (up to 2,000), categories are optional (60),
and plain-text instructions are optional (6,000). Duplicate labels return 409.
Published sign text is read only through this API; create a new draft for changes.
These entries do not train or expand recognition models.

The draft lesson editor selects up to 50 distinct published signs and orders
them through `sign_ids`. Lesson saves validate publication and replace ordered
`lesson_signs` links in the same transaction as the lesson/questions. Invalid
sign selections leave the draft unchanged. Existing published/used lesson locks
also protect its sign links through this API. Learners receive only published
linked signs through the existing lesson endpoint. Demonstrations remain optional.

### Sign demonstration MP4s

Sign library entries now offer an optional MP4 upload after the sign is saved.
Both drafts and published signs may receive or replace a demonstration, separately
from the frozen sign text. Replacement affects all lessons using that sign.
The browser checks size (1 byte–20 MiB), MIME type, extension, and MP4 `ftyp`
header. It does not transcode; use browser-compatible MP4 such as H.264.
Uploads go directly to Supabase using the current user's token, never a secret key.
New files use `signs/<sign UUID>/<upload UUID>.mp4` with overwrite disabled.
POST `/api/admin/signs/:id/video` verifies the admin, sign-specific object path,
and existing Storage metadata/type/size before assigning `signs.demo_path`.
The backend does not independently decode or inspect video contents.

Provision `server/storage/learning-media.sql` through a trusted SQL connection
on each environment (separate from application Drizzle migrations, because
Supabase owns the Storage schema). It creates a private bucket with MP4-only
20 MiB uploads and policies for admin insertion, admin draft reads, published
sign reads, and admin deletion of unreferenced objects. No overwrite policy is
provided. This setup was applied and the bucket/policies inspected on the
connected project on 2026-11-01. Local policy regressions use disposable tables;
they do not replace live Storage HTTP verification.

Learner lesson responses include published sign object paths. The shared video
component obtains one-hour signed URLs, uses native pause/replay controls and
`preload="none"`, and offers Retry when a link expires or playback fails.
Learner lesson demonstrations request muted inline autoplay and loop, with native
pause controls retained. Browser/device settings may still require pressing Play.
Autoplay players use metadata preload; admin previews retain no preload and do
not autoplay or loop by default.
Published vocabulary media is readable under Storage policies without requiring
course enrollment, consistent with published learning content. Draft media is
admin-only; signed links remain valid until expiry. Old replaced files and failed
unattached uploads are cleaned up best-effort through Storage, never SQL row deletes.
Failed cleanup can leave unreferenced objects for an admin to remove later.
Uploading actual curated content and physical/browser playback remain live checks.

### Course management workflow

`/dashboard/admin` shows the admin system overview. Course management lives at
`/dashboard/admin/courses` and supports creating and editing drafts. The
workspace shows Manage courses only for a profile whose database role is admin.
Admins have a dedicated navigation containing overview, course management, profile, and
logout. After the profile role loads, `/dashboard` and learner workspace routes
redirect admins to `/dashboard/admin`. Learners retain their existing navigation.
Workspace role-loading failures offer retry and logout instead of showing the
wrong navigation. These UI redirects do not replace server authorization.
GET `/api/admin/overview` uses the same verified admin boundary and returns
aggregate learner, course/publication, lesson, enrollment, and completion counts,
plus the five most recently created courses. It exposes no learner identities
or private histories. Counts reflect saved database activity, not guest practice,
live camera usage, or service health.
The page loads management data through the protected API; learners receive an
access-denied message rather than the editor.

Every `/api/admin` request verifies a confirmed Supabase identity and then reads
the current `profiles.role` from the database. Missing/non-admin profiles return
403; roles from signup metadata or request bodies are never trusted.
GET `/api/admin/courses` lists draft and published courses. POST creates a draft;
PATCH `/api/admin/courses/:id` edits only a currently unpublished course, atomically.
Only title (trimmed, 1–150 characters) and description (up to 5,000 characters)
are accepted as editable course values. Deletion and role assignment are not
exposed. New users remain learners;
initial admin assignment is a trusted Supabase setup action.

Course titles in the admin list open `/dashboard/admin/courses/:id`.
GET `/api/admin/courses/:id` includes ordered lessons and their answer keys for
verified admins only. Learner lesson endpoints continue to omit answer keys.
POST `/api/admin/courses/:id/lessons` creates a draft lesson or updates the
`lesson_id` supplied in the body within that course. It accepts title, plain-text
content (up to 6,000 characters), positive lesson order, nonnegative integer XP,
and up to ten ordered questions. Questions have prompts up to 1,000 characters
and 2–6 nonblank choices up to 500 characters each, exactly one marked correct.
Unused draft question sets are replaced atomically when saved; temporary choice
and question IDs are not stable until publication. Duplicate lesson positions
return 409. Published courses and published/used lessons cannot be edited here;
create a new draft version for changes. The API also checks existing attempts
and completed progress, alongside the database's quiz-definition guards.

POST `/api/admin/courses/:id/publish` validates at least one lesson, nonblank
written material for every lesson, and valid answer choices for each question.
Questions are optional, consistent with the schema. It publishes every lesson
and the parent course together in a transaction. Course and lesson locks serialize
authoring with publication; failed validation leaves the course unpublished.
The UI asks for confirmation and explains that published content becomes read only.
Course archiving and copying are described below; no delete action is included.
Admin JSON requests allow up to 128 KiB;
other application JSON requests retain their existing limit.

The editor reuses the dashboard palette, typography, panels, buttons, and layout,
with a responsive course outline and labeled form controls. Local tests cover
validation, draft replacement, used/published guards, and atomic publication.
Live admin authoring and publishing still require a configured-project browser check.

### Dashboard behavior

### Course lifecycle

The course editor offers confirmed Archive course and Create draft copy actions.
POST `/api/admin/courses/:id/archive` hides a published course by clearing its
publication flag, retaining published lesson flags and every learner record.
An unpublished course with published lessons is displayed as Archived, including
in the overview counts. Archived courses/lessons are read only in admin authoring.
Existing enrollment listings retain the unavailable course; course and lesson APIs
deny opening it while hidden. Historical progress and XP remain visible.
The existing Publish course action validates content and restores learner access.

POST `/api/admin/courses/:id/copy` atomically copies the course, ordered lessons,
questions, answer choices, and ordered sign links into new unpublished identities.
It appends “(draft copy)” to the title. It does not copy enrollments, submissions,
progress, rewards, or standalone practice. Shared sign records and demonstration
media are reused, not duplicated. Edit/rename and publish the draft independently;
existing learners are not automatically migrated and must enroll in the new course.
There is no version-family column; these copies are independent course records.
Course/lesson locks serialize copies against authoring. Existing database guards
remain enabled. Local regressions cover copied IDs/content/sign links, archive
edit denial, preserving attempts, and republishing. A hosted lifecycle and mobile
browser check remain outstanding.

The signed-in workspace has its own header and sidebar under `/dashboard/*`,
without the public Home, Our Story, or marketing footer. Its protected child
routes include Live, learning, courses, sample lessons, arcade, progress, and
profile. Shared learning links retain the workspace path; public preview routes
remain available separately. Route smoke tests cover this separation.

Normal login and safe fallback redirects now open `/dashboard`. Explicit internal
return destinations are preserved. The protected dashboard reads the existing
profile, progress, and published course services. `GET /api/me/enrollments` returns
only the verified user's saved enrollments, including courses no longer published.
Enrollment uses the existing idempotent POST endpoint; the dashboard updates its
course list after a successful save. Profile editing and logout remain available.
Independent loading/error states allow available sections to remain usable.

The dashboard does not create sample published courses or award practice XP.
If no courses are published, it displays an empty state and links to guest practice.
Published enrolled courses now offer Open course at
`/dashboard/learn/courses/:id`. `GET /api/me/courses/:id` requires a confirmed
identity and the caller's enrollment in a published course; invalid UUIDs return
400, and missing, unpublished, or unenrolled courses return the same 404.
It lists only published lessons in course order, with the caller's saved
start/completion status and configured XP reward. This read-only page creates
no progress or rewards. Empty courses show an explicit empty state.
Lessons open at `/dashboard/learn/lessons/:id`, separate from numbered guest
sample routes. `GET /api/me/lessons/:id` requires a confirmed identity, enrollment,
and both lesson and course publication. Invalid UUIDs return 400; unavailable
lessons return a generic 404. The response contains plain-text material,
published linked sign instructions, ordered exercise prompts, and explicitly
selected safe option fields, never answer keys. Published sign media paths are
included for signed video playback. The player renders text without interpreting HTML.
Loading the lesson returns the caller's saved progress and which questions they
have already answered correctly, while leaving answer keys private. GET creates
no activity. After reviewing the displayed material, the learner selects Continue:
POST `/api/me/lessons/:id/start` creates the enrollment/lesson progress row once.
This is an explicit learner acknowledgment, not proof of attention or comprehension.
It is also the prerequisite for completing a lesson without questions.

POST `/api/me/lessons/:id/attempt` accepts a UUID `attempt_id`, `exercise_id`,
and `selected_option_id`. It validates the published lesson, enrollment, question,
and option membership. The database grades the choice; caller correctness is ignored.
Retries reuse the submission UUID and return its original result. Reusing an ID
with a different account/question/choice returns 409 without revealing its result.
Incorrect answers can be retried with a new submission ID.

POST `/api/me/lessons/:id/complete` requires existing progress and a correct
saved attempt for every question. The database supplies XP and freezes the first
completion timestamp. Progress-row locks serialize attempts and completion;
repeated completion returns the existing record without granting more XP.
All three actions verify the confirmed identity, publication, and caller enrollment.
The player restores solved/completed state and checked selections after refresh.
Each question returns only the caller's saved correct choice, or their latest
checked choice if unsolved; unsent choices are not persisted. Completed questions
remain locked with their saved selection visible. Course, progress, and
dashboard pages read the saved records when opened. No guest activity is promoted.
New regressions exercise the real API handler and SQL against disposable migrated
PostgreSQL, including account isolation, retry IDs, grading, and repeated completion.
The complete hosted admin-to-learner journey still needs browser verification.
Automated checks cover redirects and guest
route protection; a real-account dashboard session and enrollment round trip
have not been verified against the live service.
