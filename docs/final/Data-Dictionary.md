# ASignX Normalized Data Dictionary

Updated 23 October 2026

This dictionary defines the 16 normalized application tables used by ASignX for ASign Learn and ASignLive. It lists all 89 application columns, their PostgreSQL types, required values, defaults, keys, relationships, and validation rules.

Supabase Auth owns auth.users. A separate reference section documents the user attributes relevant to ASignX. It is not a seventeenth application table, and the application migrations do not recreate it.

The tables separate account profiles, reusable learning content, enrollment activity, recognition outcomes, and achievement definitions. Junction tables represent many-to-many relationships. Total XP and streaks are derived from activity instead of being duplicated as profile balances.

## Reading the dictionary

- PK means primary key; FK means foreign key. Multiple PK fields in one table form one composite primary key. A composite FK must be satisfied by the field combination, not by each field independently.
- None means there is no database column default. The caller must provide a required value unless a documented trigger derives it. NULL means the field is optional and has no explicit default. Managed means Supabase controls the external field default.
- VARCHAR sizes are character limits. NUMERIC(6,5) has six total digits and five fractional digits; score checks limit values to 0 through 1. TIMESTAMPTZ represents an instant; profile timezone is used separately for local learning dates.
- CASCADE removes dependent records with their parent. RESTRICT prevents deleting a referenced shared record. All application FK updates use NO ACTION. RLS means row-level security.

## Supabase Auth users reference

Selected Supabase-managed account attributes. These physical fields are reference information, not application-owned DDL. Supabase controls additional columns, indexes, and defaults; application relationships reference only its stable id primary key.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | Managed | Authentication identity referenced by profiles.id. |
| email | VARCHAR | 255 characters | - | - | Yes | Managed | Email used for email-based sign-in. Not duplicated in profiles. |
| encrypted_password | VARCHAR | 255 characters | - | - | Yes | Managed | Secure password hash for password-based accounts; not a readable password. |
| email_confirmed_at | TIMESTAMPTZ | Microseconds | - | - | Yes | Managed | Email verification time. ASignX creates a profile only when this is set. |
| last_sign_in_at | TIMESTAMPTZ | Microseconds | - | - | Yes | Managed | Most recent sign-in time, maintained by Supabase Auth. |
| raw_user_meta_data | JSONB | Variable | - | - | Yes | Managed | User metadata; initial display name can seed profiles. Never trusted for assigning application roles. |
| created_at | TIMESTAMPTZ | Microseconds | - | - | Yes | Managed | Authentication record creation time. |
| updated_at | TIMESTAMPTZ | Microseconds | - | - | Yes | Managed | Authentication record modification time. |

- One Auth identity has at most one application profile by key structure. Confirmation and backfill triggers create profiles with the same UUID only after email_confirmed_at is set. Pending Auth identities have no application profile.
- The encrypted_password field contains a password hash, despite its historical column name. Applications use Supabase Auth for password operations and do not copy it into profiles.
- Nullable email and password fields accommodate account types beyond email/password. ASignX email/password registration still requires those inputs through Auth.

## profiles

Application information for a registered learner or administrator. Authentication stays in Supabase Auth.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | auth.users.id | No | None | Same UUID as auth.users.id; supplied by the Auth profile-creation trigger, with no column default. |
| display_name | VARCHAR | 100 characters | - | - | No | None | Name displayed in the application. |
| role | VARCHAR | 10 characters | - | - | No | 'learner' | ASignX authorization role: learner or admin. Separate from Supabase Auth database roles. |
| timezone | VARCHAR | 64 characters | - | - | No | 'UTC' | Valid IANA time zone used when deriving learning streaks. |
| created_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Profile creation time. |
| updated_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Profile modification time; refreshed by the validation trigger on UPDATE. |

**Keys and constraints**

- Primary key: (id).
- Check: length(btrim(display_name)) > 0.
- Check: role in ('learner', 'admin').
- Foreign key: (id) -> auth.users(id); ON DELETE CASCADE; ON UPDATE NO ACTION.

**Validation and access rules**

- Database trigger validates timezone and refreshes updated_at on profile updates.
- An Auth trigger creates a learner profile only after Supabase sets email_confirmed_at. Already-confirmed identities are supported on insert, and backfill includes only confirmed users. A pending signup has no profile. The browser redirect does not control activation. The display name is taken from display_name or name metadata, falling back to ASL explorer; the application role is never copied from signup metadata.
- A signed-in learner may read their own profile and update only display_name and timezone. Role changes require the trusted backend.

## signs

Shared ASL vocabulary for demonstrations, camera practice, and Live recognition.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique sign identifier. |
| gloss | VARCHAR | 100 characters | - | - | No | None | Unique vocabulary label, such as HELLO or THANK-YOU. |
| meaning | TEXT | Variable | - | - | No | None | Meaning of the sign. |
| category | VARCHAR | 60 characters | - | - | Yes | NULL | Simple browsing label, such as Greetings or Numbers; no separate taxonomy is needed. |
| instructions | TEXT | Variable | - | - | Yes | NULL | Optional guidance for performing the sign. |
| demo_path | TEXT | Variable | - | - | Yes | NULL | Object path for one curated demonstration video in the learning-media Storage bucket. |
| is_published | BOOLEAN | 1 byte | - | - | No | false | Whether learners may access this sign. |
| created_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Sign creation time. |

**Keys and constraints**

- Primary key: (id).
- Unique: (gloss).
- Check: length(btrim(gloss)) > 0.
- Check: length(btrim(meaning)) > 0.

**Validation and access rules**

- Public readers see only published signs. demo_path is a Storage object path for curated learning media.

## courses

Learning courses available for enrollment.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique course identifier. |
| title | VARCHAR | 150 characters | - | - | No | None | Course title. |
| description | TEXT | Variable | - | - | Yes | NULL | Course overview. |
| is_published | BOOLEAN | 1 byte | - | - | No | false | Whether the course is available to learners. |
| created_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Course creation time. |

**Keys and constraints**

- Primary key: (id).
- Check: length(btrim(title)) > 0.

**Validation and access rules**

- Public readers see only published courses. A course can have no lessons or enrollments when first created.

## lessons

Ordered learning units in a course. Learning text and linked sign demonstrations supply the lesson material.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique lesson identifier. |
| course_id | UUID | 128 bits | - | courses.id | No | None | References courses.id. |
| title | VARCHAR | 150 characters | - | - | No | None | Lesson title. |
| content | TEXT | Variable | - | - | Yes | NULL | Instructional text; demonstrations are reached through lesson_signs. |
| sort_order | INTEGER | 32 bits | - | - | No | None | Positive lesson position within its course. |
| xp_reward | INTEGER | 32 bits | - | - | No | 10 | Nonnegative XP awarded once on validated lesson completion. |
| is_published | BOOLEAN | 1 byte | - | - | No | false | Whether this lesson is visible within its published course. |

**Keys and constraints**

- Primary key: (id).
- Unique: (course_id, sort_order).
- Check: length(btrim(title)) > 0.
- Check: sort_order > 0.
- Check: xp_reward >= 0.
- Foreign key: (course_id) -> public.courses(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- Public readers see a lesson only when both the lesson and its parent course are published.
- A deferred publication trigger requires at least two choices and exactly one correct choice for each exercise. A lesson may have no exercises.
- The lesson identity and parent course cannot be changed by UPDATE. The configured XP is captured when the lesson is first completed.

## lesson_signs

Connects signs to lessons so the same sign can appear in several lessons.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| lesson_id | UUID | 128 bits | Yes | lessons.id | No | None | References lessons.id; part of the composite primary key. |
| sign_id | UUID | 128 bits | Yes | signs.id | No | None | References signs.id; part of the composite primary key. |
| sort_order | INTEGER | 32 bits | - | - | No | None | Positive demonstration order within the lesson. |

**Keys and constraints**

- Primary key: (lesson_id, sign_id).
- Unique: (lesson_id, sort_order).
- Check: sort_order > 0.
- Foreign key: (lesson_id) -> public.lessons(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (sign_id) -> public.signs(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- The pair (lesson_id, sign_id) represents a many-to-many link. Public readers require a published lesson, parent course, and linked sign.

## exercises

Each exercise is one multiple-choice question in a lesson. Several exercises together form a quiz; camera practice is recorded separately.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique question/exercise identifier. |
| lesson_id | UUID | 128 bits | - | lessons.id | No | None | References lessons.id. |
| prompt | TEXT | Variable | - | - | No | None | Question displayed to the learner. |
| sign_id | UUID | 128 bits | - | signs.id | Yes | NULL | Optional reference to signs.id for a sign-based question. |
| sort_order | INTEGER | 32 bits | - | - | No | None | Positive exercise position within its lesson. |

**Keys and constraints**

- Primary key: (id).
- Unique: (lesson_id, sort_order).
- Check: length(btrim(prompt)) > 0.
- Check: sort_order > 0.
- Foreign key: (lesson_id) -> public.lessons(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (sign_id) -> public.signs(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- Each row is one multiple-choice question; the collection of questions in a lesson forms its quiz.
- The parent lesson cannot be reassigned. Definition edits are rejected while the lesson is published, after the exercise has attempts, or after its lesson has completed progress. Create a new content version for substantive changes.

## exercise_options

Answer choices for an exercise. Correctness is server-only and must not be included in learner responses.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique option identifier. |
| exercise_id | UUID | 128 bits | - | exercises.id | No | None | References exercises.id. |
| option_text | TEXT | Variable | - | - | No | None | Answer choice text displayed to learners. |
| is_correct | BOOLEAN | 1 byte | - | - | No | false | Marks the correct option; read only by the trusted grading/authoring backend. |
| sort_order | INTEGER | 32 bits | - | - | No | None | Positive option order within the exercise. |

**Keys and constraints**

- Primary key: (id).
- Unique: (exercise_id, sort_order).
- Unique: (exercise_id, id).
- Check: length(btrim(option_text)) > 0.
- Check: sort_order > 0.
- Foreign key: (exercise_id) -> public.exercises(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- The partial unique index on exercise_id WHERE is_correct allows at most one correct option per exercise; lesson publication requires exactly one.
- Direct browser reads are denied. The backend exposes only id, exercise_id, option_text, and sort_order, excluding is_correct.
- Options follow the same published/used definition freeze as their exercise, and cannot be moved to another exercise.

## enrollments

Connects a learner to a course and provides the parent for learning activity in that course.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique enrollment identifier. |
| user_id | UUID | 128 bits | - | profiles.id | No | None | References profiles.id. |
| course_id | UUID | 128 bits | - | courses.id | No | None | References courses.id. |
| enrolled_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Enrollment time. |

**Keys and constraints**

- Primary key: (id).
- Unique: (user_id, course_id).
- Foreign key: (user_id) -> public.profiles(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (course_id) -> public.courses(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- One enrollment per learner and course. Learning activity reaches its owner through this row.
- Enrollment identity, learner, course, and enrollment time are immutable. Browser clients may read their own enrollments; creation is a backend operation.

## lesson_progress

Tracks each lesson in an enrollment and stores its one-time completion reward; a separate XP ledger is unnecessary for this reward policy.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| enrollment_id | UUID | 128 bits | Yes | enrollments.id | No | None | References enrollments.id; part of the composite primary key. |
| lesson_id | UUID | 128 bits | Yes | lessons.id | No | None | References lessons.id; part of the composite primary key. |
| started_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Time the learner started the lesson. |
| completed_at | TIMESTAMPTZ | Microseconds | - | - | Yes | NULL | Validated completion time; NULL means in progress. |
| xp_earned | INTEGER | 32 bits | - | - | No | 0 | Nonnegative first-completion XP actually granted; remains zero until completion. |

**Keys and constraints**

- Primary key: (enrollment_id, lesson_id).
- Check: xp_earned >= 0.
- Check: (completed_at is null and xp_earned = 0) or (completed_at is not null and completed_at >= started_at).
- Foreign key: (enrollment_id) -> public.enrollments(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (lesson_id) -> public.lessons(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- A trigger verifies that the lesson belongs to the enrollment course. Progress identity and started_at are immutable.
- Before completion, xp_earned is forced to zero. Completion requires at least one correct attempt for every exercise and replaces supplied XP with lessons.xp_reward.
- Completed timestamps and XP are immutable. Completed progress cannot be independently deleted while its enrollment remains. Account/enrollment deletion may cascade.
- For a lesson without exercises, the backend must confirm that its material was viewed before requesting completion; the database does not observe viewing.

## exercise_attempts

A learner submission for one multiple-choice exercise. Multiple attempts are permitted.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique attempt identifier; reuse this ID for a retried submission. |
| enrollment_id | UUID | 128 bits | - | enrollments.id | No | None | References enrollments.id; identifies the learner through enrollment. |
| exercise_id | UUID | 128 bits | - | exercises.id; exercise_options.exercise_id (composite) | No | None | References exercises.id. |
| selected_option_id | UUID | 128 bits | - | exercise_options.id (composite) | No | None | References exercise_options.id; must belong to exercise_id using the composite foreign key below. |
| is_correct | BOOLEAN | 1 byte | - | - | No | None | Database-trigger grading result, derived from the selected option on insert. |
| attempted_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Submission time. |

**Keys and constraints**

- Primary key: (id).
- Foreign key: (enrollment_id) -> public.enrollments(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (exercise_id) -> public.exercises(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (exercise_id, selected_option_id) -> public.exercise_options(exercise_id, id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- The composite foreign key (exercise_id, selected_option_id) references exercise_options(exercise_id, id), ensuring the selected option belongs to this exercise.
- A trigger verifies course membership and derives is_correct from the stored answer option. Caller-supplied correctness is overwritten.
- Attempt rows cannot be updated. Reuse the submission UUID with conflict handling for a retried request.

## model_versions

Minimal record of the actual ML model used for a prediction; deployment and evaluation tooling remain outside this application schema.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique model version identifier. |
| version | VARCHAR | 50 characters | - | - | No | None | Unique immutable release name. |
| artifact_path | TEXT | Variable | - | - | No | None | Private object path in the model-artifacts Storage bucket. |
| confidence_threshold | NUMERIC | 6 digits total, 5 decimal | - | - | No | 0.80000 | Acceptance threshold from 0 to 1 for this model version. |
| created_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Model registration time. |

**Keys and constraints**

- Primary key: (id).
- Unique: (version).
- Check: length(btrim(version)) > 0.
- Check: length(btrim(artifact_path)) > 0.
- Check: confidence_threshold between 0 and 1.

**Validation and access rules**

- All model-version updates are rejected. Register a new row when the version, artifact, or confidence threshold changes.
- artifact_path refers to a private model-artifacts Storage object. This table has no direct browser access.

## practice_attempts

Authenticated camera practice results, including standalone practice and optional lesson practice.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique practice attempt identifier; reuse on retry. |
| user_id | UUID | 128 bits | - | profiles.id | No | None | References profiles.id. |
| lesson_id | UUID | 128 bits | - | lessons.id | Yes | NULL | Optional references lessons.id; NULL means standalone practice or review. |
| target_sign_id | UUID | 128 bits | - | signs.id | No | None | References signs.id; the sign the learner was asked to perform. |
| predicted_sign_id | UUID | 128 bits | - | signs.id | Yes | NULL | References signs.id; NULL means no supported sign was recognized. |
| model_version_id | UUID | 128 bits | - | model_versions.id | No | None | References model_versions.id; actual model used by the recognition service. |
| confidence | NUMERIC | 6 digits total, 5 decimal | - | - | No | None | Recognition score between 0 and 1. |
| is_correct | BOOLEAN | 1 byte | - | - | No | None | Database-trigger result based on target match and the recorded model confidence threshold. |
| attempted_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Practice time. |

**Keys and constraints**

- Primary key: (id).
- Check: confidence between 0 and 1.
- Foreign key: (user_id) -> public.profiles(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (lesson_id) -> public.lessons(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (target_sign_id) -> public.signs(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (predicted_sign_id) -> public.signs(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (model_version_id) -> public.model_versions(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- For lesson practice, a trigger requires enrollment in the lesson course and target membership in lesson_signs. Standalone practice has no lesson_id.
- The database derives is_correct as prediction equals target and confidence meets the referenced model threshold; a missing prediction yields false.
- Updates are rejected. The backend supplies a trusted recognition result; storing it does not itself implement model inference.

## recognition_sessions

Optional saved ASignLive history for authenticated users. Guest and unsaved sessions are transient.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique saved session identifier. |
| user_id | UUID | 128 bits | - | profiles.id | No | None | References profiles.id; session owner. |
| started_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Session start time. |
| ended_at | TIMESTAMPTZ | Microseconds | - | - | Yes | NULL | Session end time; NULL while open. |
| final_text | TEXT | Variable | - | - | Yes | NULL | Text assembled by the finalization trigger from accepted sign meanings; NULL while open. |

**Keys and constraints**

- Primary key: (id).
- Check: ended_at is null or ended_at >= started_at.
- Check: final_text is null or ended_at is not null.
- Foreign key: (user_id) -> public.profiles(id); ON DELETE CASCADE; ON UPDATE NO ACTION.

**Validation and access rules**

- The backend creates a saved session only after explicit opt-in. Consent and authentication are application responsibilities; there is no consent column in this schema.
- Guest and unsaved sessions are transient. Only the owner may read saved history.
- When ended, a trigger composes final_text from sign meanings in sequence_no order, accepting only known signs meeting each result model threshold. With no accepted result, final_text is an empty string.
- The session identity, owner, and started_at are immutable; an ended session cannot be updated.

## recognition_results

Ordered stabilized sign predictions within a saved Live session; rows themselves represent the recognized sign sequence.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique prediction-event identifier. |
| session_id | UUID | 128 bits | - | recognition_sessions.id | No | None | References recognition_sessions.id. |
| sign_id | UUID | 128 bits | - | signs.id | Yes | NULL | References signs.id; NULL means no supported label was recognized. |
| model_version_id | UUID | 128 bits | - | model_versions.id | No | None | References model_versions.id; actual model used for this event. |
| sequence_no | INTEGER | 32 bits | - | - | No | None | Positive event position within the session. |
| confidence | NUMERIC | 6 digits total, 5 decimal | - | - | No | None | Recognition score between 0 and 1; only accepted labeled results contribute to final_text. |
| recognized_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Prediction time. |

**Keys and constraints**

- Primary key: (id).
- Unique: (session_id, sequence_no).
- Check: sequence_no > 0.
- Check: confidence between 0 and 1.
- Foreign key: (session_id) -> public.recognition_sessions(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (sign_id) -> public.signs(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.
- Foreign key: (model_version_id) -> public.model_versions(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- The database rejects inserts into ended sessions and prevents UPDATE of stored results.
- sequence_no determines ordering. Unknown or low-confidence results remain recorded but do not contribute to final_text.
- The backend persists stabilized sign events, not camera frames. Only the owner of the parent session may read these rows.

## achievements

Simple badge definitions based on a supported learning metric and threshold.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| id | UUID | 128 bits | Yes | - | No | gen_random_uuid() | Unique achievement identifier. |
| code | VARCHAR | 50 characters | - | - | No | None | Unique stable badge code, such as FIRST_LESSON. |
| name | VARCHAR | 100 characters | - | - | No | None | Badge name displayed to learners. |
| description | TEXT | Variable | - | - | No | None | Description of how to earn the badge. |
| metric | VARCHAR | 25 characters | - | - | No | None | One of completed_lessons, successful_practices, total_xp, or streak_days. |
| threshold | INTEGER | 32 bits | - | - | No | None | Positive target value for the selected metric. |

**Keys and constraints**

- Primary key: (id).
- Unique: (code).
- Check: length(btrim(code)) > 0.
- Check: length(btrim(name)) > 0.
- Check: length(btrim(description)) > 0.
- Check: metric in ('completed_lessons', 'successful_practices', 'total_xp', 'streak_days').
- Check: threshold > 0.

**Validation and access rules**

- Supported metrics are completed_lessons, successful_practices, total_xp, and streak_days.
- Once any user has received the achievement, its definition cannot be updated. Use a new achievement for revised criteria.

## user_achievements

Badges unlocked by learners; prevents duplicate awards.

| Column name | Data type | Size or precision | PK | FK reference | Null allowed | Default value | Description |
|---|---|---|---|---|---|---|---|
| user_id | UUID | 128 bits | Yes | profiles.id | No | None | References profiles.id; part of the composite primary key. |
| achievement_id | UUID | 128 bits | Yes | achievements.id | No | None | References achievements.id; part of the composite primary key. |
| unlocked_at | TIMESTAMPTZ | Microseconds | - | - | No | now() | Time the backend confirmed eligibility and awarded the badge. |

**Keys and constraints**

- Primary key: (user_id, achievement_id).
- Foreign key: (user_id) -> public.profiles(id); ON DELETE CASCADE; ON UPDATE NO ACTION.
- Foreign key: (achievement_id) -> public.achievements(id); ON DELETE RESTRICT; ON UPDATE NO ACTION.

**Validation and access rules**

- A trigger validates the referenced achievement metric and threshold before an award is inserted. The composite primary key prevents duplicate awards.
- Award records cannot be updated. Learners may read only their own awards.

## Relationship reference

Each row describes a child-to-parent foreign key. A parent may have zero or many children unless marked one-to-zero-or-one. Optional means that the child FK may be NULL.

| Parent table | Child table and FK fields | Parent to child | Child reference | On delete |
|---|---|---|---|---|
| auth.users | profiles(id) | One to zero or one | Required | CASCADE |
| public.courses | lessons(course_id) | One to many | Required | RESTRICT |
| public.lessons | lesson_signs(lesson_id) | One to many | Required | CASCADE |
| public.signs | lesson_signs(sign_id) | One to many | Required | RESTRICT |
| public.lessons | exercises(lesson_id) | One to many | Required | RESTRICT |
| public.signs | exercises(sign_id) | One to many | Optional | RESTRICT |
| public.exercises | exercise_options(exercise_id) | One to many | Required | RESTRICT |
| public.profiles | enrollments(user_id) | One to many | Required | CASCADE |
| public.courses | enrollments(course_id) | One to many | Required | RESTRICT |
| public.enrollments | lesson_progress(enrollment_id) | One to many | Required | CASCADE |
| public.lessons | lesson_progress(lesson_id) | One to many | Required | RESTRICT |
| public.enrollments | exercise_attempts(enrollment_id) | One to many | Required | CASCADE |
| public.exercises | exercise_attempts(exercise_id) | One to many | Required | RESTRICT |
| public.exercise_options | exercise_attempts(exercise_id, selected_option_id) | One to many | Required | RESTRICT |
| public.profiles | practice_attempts(user_id) | One to many | Required | CASCADE |
| public.lessons | practice_attempts(lesson_id) | One to many | Optional | RESTRICT |
| public.signs | practice_attempts(target_sign_id) | One to many | Required | RESTRICT |
| public.signs | practice_attempts(predicted_sign_id) | One to many | Optional | RESTRICT |
| public.model_versions | practice_attempts(model_version_id) | One to many | Required | RESTRICT |
| public.profiles | recognition_sessions(user_id) | One to many | Required | CASCADE |
| public.recognition_sessions | recognition_results(session_id) | One to many | Required | CASCADE |
| public.signs | recognition_results(sign_id) | One to many | Optional | RESTRICT |
| public.model_versions | recognition_results(model_version_id) | One to many | Required | RESTRICT |
| public.profiles | user_achievements(user_id) | One to many | Required | CASCADE |
| public.achievements | user_achievements(achievement_id) | One to many | Required | RESTRICT |

## Shared rules

- All 16 application tables enable RLS. Public roles can read published learning content and achievement definitions. A lesson also requires a published parent course, and a lesson-sign link additionally requires a published sign.
- Authenticated browser users can read their own profile, enrollments, progress, attempts, practices, saved sessions and results, and earned achievements. The only browser profile writes are display_name and timezone. The backend validates caller identity, ownership, and administrator authorization for privileged operations.
- exercise_options and model_versions have no direct browser access. Safe answer fields are delivered through the backend; correctness and private model paths remain server-only.
- Guests may browse learning content and use transient practice and Live features without an application profile. Saving personal activity requires a registered account. Guest browser activity is not a trusted source of account XP, grading results, or awards.
- Total XP is SUM(lesson_progress.xp_earned) through the learner enrollments. Current streak uses distinct local dates with a completed lesson or successful practice; the consecutive run must end today or yesterday in profiles.timezone. A timezone change can change the derived date boundaries.
- Deleting an Auth user cascades to the profile and its dependent personal activity. Shared vocabulary, courses, lessons, models, and achievement definitions remain; referenced shared content should be unpublished or archived rather than removed.
- Saving Live history requires explicit user opt-in in the application. The schema stores stabilized events and finalized text, with no camera-frame or raw-video columns. Curated media and model files belong in Storage; database fields contain object paths.
- Backend services must verify viewing for no-quiz completion, validate recognition service output, enforce opt-in, and expose only authorized fields. Database constraints and triggers do not replace these application responsibilities.

## Normalization notes

- Identity and profile: authentication credentials remain in the managed Auth schema; application attributes depend on the profile UUID. Repeating email and password columns in application activity tables are avoided.
- Reusable content: signs, courses, lessons, exercises, and answer options have separate identities. lesson_signs resolves the many-to-many association between lessons and signs.
- Learner activity: enrollments resolves learners and courses; lesson_progress depends on an enrollment and lesson; exercise_attempts records individual submissions rather than repeating course or profile details.
- Prediction provenance: model_versions stores model artifact and threshold definitions once. Practice and recognition rows reference the actual model version used.
- Achievement definitions and awards: achievements defines criteria once; user_achievements resolves the many-to-many association and prevents duplicate awards.
- Historical snapshots: xp_earned and is_correct are intentional recorded outcomes. They preserve the result of an event rather than copying mutable profile totals. Unique order constraints and the option-pair foreign key enforce additional candidate keys and consistency.

## References

- [Application schema](../../server/src/db/schema/app.ts)
- [Generated table and constraint migration](../../server/drizzle/20261021161839_asignx_application/migration.sql)
- [Custom validation triggers and access grants](../../server/drizzle/20261021161905_asignx_rules/migration.sql)
- [Supabase account profile guidance](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase password storage guidance](https://supabase.com/docs/guides/auth/password-security)
- [Supabase Auth user field definitions](https://github.com/supabase/auth/blob/master/migrations/00_init_auth_schema.up.sql)
