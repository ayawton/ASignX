# ASignX Current Data Dictionary

This dictionary documents the current ASignX application schema: 23 tables, 138 fields and 41 foreign keys. It covers account profiles, learning content, enrollment, lesson activity, hearts, XP, recognition and achievements. Supabase manages auth.users separately.

- Prepared 8 November 2026 from server/src/db/schema/app.ts and the checked-in migration and service rules. This is a source-based snapshot; the live Supabase deployment was not inspected.
- PK means primary key, FK means foreign key and UK means single-column unique. Multiple PK fields form one composite key. Composite foreign keys apply to the combination of fields.
- Nullable means the database permits NULL. A dash in Default means no explicit column default. Required values without defaults must be supplied by the caller or a documented trigger. String defaults appear in quotes.
- PostgreSQL varchar lengths are character limits. numeric(6,5) means six total digits and five fractional digits. timestamp with time zone represents an instant, displayed using a chosen timezone.
- All 23 application tables enable row-level security. Public content reads require publication. Owner-scoped reads apply where defined. Tables without a client policy are accessed through the trusted backend; authorization remains necessary there.
- Supabase auth.users is external. Only id (uuid, primary key) is shown in the ERD because it is the application FK target. Auth owns email, verification and credentials; those are not copied into profiles.
- PK, FK, unique indexes and checks below come from Drizzle metadata. Trigger and service rules are described separately. FK updates use NO ACTION. CASCADE deletes dependent rows; RESTRICT prevents deleting a referenced parent.
- Current persisted lesson recognition uses exercise_attempts and model_versions. Standalone practice storage, saved Live history and automatic achievement awarding are schema capabilities, not verified end-to-end UI workflows. Current Live text history stays in browser memory.

## Table index

- profiles — Application profile and authorization role linked to a Supabase identity.
- signs — Reusable sign vocabulary and demonstration media references.
- courses — Course metadata, publication state and configurable cover graphics.
- lessons — Ordered learning material and configured maximum first-time XP.
- lesson_signs — Ordered association between lessons and reusable signs.
- exercises — Ordered choice, true or false, and camera recognition questions.
- exercise_options — Options and server-only correctness for choice and true or false questions.
- enrollments — A learner membership in a course.
- lesson_progress — Lesson milestones within an enrollment, without a duplicated XP balance.
- exercise_attempts — Immutable graded exercise responses, including optional recognition evidence.
- learner_hearts — One shared heart balance per learner and regeneration baseline.
- lesson_runs — Individual lesson attempts, including reduced-XP replays.
- lesson_run_questions — Question order, allocated XP and submitted attempt for a particular run.
- xp_awards — Append-only XP ledger used to derive learner and course totals.
- heart_practice_rounds — Practice rounds for restoring a heart without awarding XP.
- heart_practice_questions — Three ordered questions assigned to a heart restoration round.
- heart_practice_submissions — Graded answer submissions for the questions in a heart restoration round.
- model_versions — Model identity, fingerprint and confidence threshold for traceability.
- practice_attempts — Schema support for standalone sign practice results.
- recognition_sessions — Schema support for saved recognition sessions.
- recognition_results — Schema support for ordered predictions within a recognition session.
- achievements — Achievement definitions and threshold metrics.
- user_achievements — Association recording an achievement unlocked by a learner.

## profiles

Application profile and authorization role linked to a Supabase identity.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK, FK | No | — | Same UUID as auth.users.id; supplied by the Auth profile-creation trigger, with no column default. |
| display_name | varchar(100) | — | No | — | Name displayed in the application. |
| role | varchar(10) | — | No | 'learner' | ASignX authorization role: learner or admin. Separate from Supabase Auth database roles. |
| timezone | varchar(64) | — | No | 'UTC' | Valid IANA time zone used when deriving learning streaks. |
| created_at | timestamp with time zone | — | No | now() | Profile creation time. |
| updated_at | timestamp with time zone | — | No | now() | Profile modification time; refreshed by the validation trigger on UPDATE. |

### Keys and database constraints

- Primary key: (id).
- FK (id) → auth.users (id); delete CASCADE.
- Check: length(btrim(display_name)) > 0.
- Check: role in ('learner', 'admin').

### Trigger and application rules

Confirmed Auth identities receive learner profiles through database triggers. Profile updates validate timezone and refresh updated_at. Users cannot assign their own admin role.

## signs

Reusable sign vocabulary and demonstration media references.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique sign identifier. |
| gloss | varchar(100) | UK | No | — | Unique vocabulary label, such as HELLO or THANK-YOU. |
| meaning | text | — | No | — | Meaning of the sign. |
| category | varchar(60) | — | Yes | — | Simple browsing label, such as Greetings or Numbers; no separate taxonomy is needed. |
| instructions | text | — | Yes | — | Optional guidance for performing the sign. |
| demo_path | text | — | Yes | — | Object path for one curated demonstration video in the learning-media Storage bucket. |
| is_published | boolean | — | No | false | Whether learners may access this sign. |
| created_at | timestamp with time zone | — | No | now() | Sign creation time. |

### Keys and database constraints

- Primary key: (id).
- Unique: (gloss). NULL remains allowed where the field is nullable.
- Check: length(btrim(gloss)) > 0.
- Check: length(btrim(meaning)) > 0.

### Trigger and application rules

Publication and ownership are checked through application services and database rules.

## courses

Course metadata, publication state and configurable cover graphics.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique course identifier. |
| title | varchar(150) | — | No | — | Course title. |
| description | text | — | Yes | — | Course overview. |
| cover_size | integer | — | No | 100 | Main cover text size setting. |
| cover_angle | integer | — | No | -18 | Pattern angle in degrees. |
| cover_density | integer | — | No | 5 | Pattern scale and density setting. |
| cover_weight | varchar(3) | — | No | '600' | Cover text font weight. |
| cover_font | varchar(12) | — | No | 'outfit' | Cover font identifier. |
| cover_text | varchar(32) | — | No | '' | Custom text displayed on the cover. |
| cover_style | varchar(12) | — | No | 'plain' | Cover layout identifier. |
| cover_tone | varchar(12) | — | No | 'sky' | Cover palette identifier. |
| is_published | boolean | — | No | false | Whether the course is available to learners. |
| created_at | timestamp with time zone | — | No | now() | Course creation time. |

### Keys and database constraints

- Primary key: (id).
- Check: length(btrim(title)) > 0.

### Trigger and application rules

Cover options are validated by the admin API. Draft and archived collections are application workflows; there is no separate archived status column.

## lessons

Ordered learning material and configured maximum first-time XP.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique lesson identifier. |
| course_id | uuid | FK | No | — | References courses.id. |
| title | varchar(150) | — | No | — | Lesson title. |
| content | text | — | Yes | — | Instructional text; demonstrations are reached through lesson_signs. |
| sort_order | integer | — | No | — | Positive lesson position within its course. |
| xp_reward | integer | — | No | 10 | Configured maximum first-time lesson XP; allocated among questions by the service. |
| is_published | boolean | — | No | false | Whether this lesson is visible within its published course. |

### Keys and database constraints

- Primary key: (id).
- Unique: (course_id, sort_order).
- FK (course_id) → courses (id); delete RESTRICT.
- Check: length(btrim(title)) > 0.
- Check: sort_order > 0.
- Check: xp_reward >= 0.

### Trigger and application rules

Publication and ownership are checked through application services and database rules.

## lesson_signs

Ordered association between lessons and reusable signs.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| lesson_id | uuid | PK, FK | No | — | References lessons.id; part of the composite primary key. |
| sign_id | uuid | PK, FK | No | — | References signs.id; part of the composite primary key. |
| sort_order | integer | — | No | — | Positive demonstration order within the lesson. |

### Keys and database constraints

- Primary key: (lesson_id, sign_id).
- Unique: (lesson_id, sort_order).
- FK (lesson_id) → lessons (id); delete CASCADE.
- FK (sign_id) → signs (id); delete RESTRICT.
- Check: sort_order > 0.

### Trigger and application rules

Publication and ownership are checked through application services and database rules.

Supporting indexes: (sign_id).

## exercises

Ordered choice, true or false, and camera recognition questions.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique question/exercise identifier. |
| lesson_id | uuid | FK | No | — | References lessons.id. |
| answer_type | varchar(16) | — | No | 'choice' | choice, boolean or recognition; enforced by a check constraint. |
| prompt | text | — | No | — | Question displayed to the learner. |
| sign_id | uuid | FK | Yes | — | Optional reference to signs.id for a sign-based question. |
| sort_order | integer | — | No | — | Positive exercise position within its lesson. |

### Keys and database constraints

- Primary key: (id).
- Unique: (lesson_id, sort_order).
- FK (lesson_id) → lessons (id); delete RESTRICT.
- FK (sign_id) → signs (id); delete RESTRICT.
- Check: answer_type in ('choice','boolean','recognition').
- Check: length(btrim(prompt)) > 0.
- Check: sort_order > 0.

### Trigger and application rules

Answer types are choice, boolean and recognition. Recognition requires a target sign; published choice questions require valid options. Correctness is withheld from learner question responses.

Supporting indexes: (sign_id).

## exercise_options

Options and server-only correctness for choice and true or false questions.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique option identifier. |
| exercise_id | uuid | FK | No | — | References exercises.id. |
| option_text | text | — | No | — | Answer choice text displayed to learners. |
| is_correct | boolean | — | No | false | Marks the correct option; read only by the trusted grading/authoring backend. |
| sort_order | integer | — | No | — | Positive option order within the exercise. |

### Keys and database constraints

- Primary key: (id).
- Unique: (exercise_id, sort_order).
- Unique: (exercise_id, id).
- Unique index: (exercise_id) WHERE is_correct.
- FK (exercise_id) → exercises (id); delete RESTRICT.
- Check: length(btrim(option_text)) > 0.
- Check: sort_order > 0.

### Trigger and application rules

The partial unique index permits at most one correct option per exercise. Publication validation supplies the additional completeness rules.

## enrollments

A learner membership in a course.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique enrollment identifier. |
| user_id | uuid | FK | No | — | References profiles.id. |
| course_id | uuid | FK | No | — | References courses.id. |
| enrolled_at | timestamp with time zone | — | No | now() | Enrollment time. |

### Keys and database constraints

- Primary key: (id).
- Unique: (user_id, course_id).
- FK (user_id) → profiles (id); delete CASCADE.
- FK (course_id) → courses (id); delete RESTRICT.

### Trigger and application rules

The database prevents changing an existing enrollment owner or course.

Supporting indexes: (course_id).

## lesson_progress

Lesson milestones within an enrollment, without a duplicated XP balance.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| enrollment_id | uuid | PK, FK | No | — | Enrollment identifying the learner and course. |
| lesson_id | uuid | PK, FK | No | — | References lessons.id; part of the composite primary key. |
| perfected_at | timestamp with time zone | — | Yes | — | First time all lesson questions have been answered correctly. |
| started_at | timestamp with time zone | — | No | now() | Time the learner started the lesson. |
| completed_at | timestamp with time zone | — | Yes | — | Validated completion time; NULL means in progress. |

### Keys and database constraints

- Primary key: (enrollment_id, lesson_id).
- FK (enrollment_id) → enrollments (id); delete CASCADE.
- FK (lesson_id) → lessons (id); delete RESTRICT.
- Check: completed_at is null or completed_at >= started_at.

### Trigger and application rules

Progress validation keeps lessons within the enrolled course. started_at and completion milestones are persisted; XP is summed from xp_awards.

Supporting indexes: (lesson_id).

## exercise_attempts

Immutable graded exercise responses, including optional recognition evidence.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique attempt identifier; reuse this ID for a retried submission. |
| enrollment_id | uuid | FK | No | — | Enrollment identifying the learner and course. |
| exercise_id | uuid | FK | No | — | References exercises.id. |
| response_text | text | — | Yes | — | Recognized response label or other stored response evidence. |
| recognition_confidence | numeric(6, 5) | — | Yes | — | Optional camera recognition score. |
| model_version_id | uuid | FK | Yes | — | Model version that produced this prediction or response. |
| selected_option_id | uuid | FK | Yes | — | Required for choice/boolean, NULL for recognition; option must belong to exercise. |
| is_correct | boolean | — | No | — | Database-trigger grading result, derived from the stored option or trusted model evidence on insert. |
| attempted_at | timestamp with time zone | — | No | now() | Submission time. |

### Keys and database constraints

- Primary key: (id).
- FK (enrollment_id) → enrollments (id); delete CASCADE.
- FK (exercise_id) → exercises (id); delete RESTRICT.
- FK (model_version_id) → model_versions (id); delete RESTRICT.
- FK (exercise_id, selected_option_id) → exercise_options (exercise_id, id); delete RESTRICT.

### Trigger and application rules

The composite option FK ensures an option belongs to its exercise. Database grading and trusted recognition submission validate responses. Attempts cannot be updated.

Supporting indexes: (enrollment_id); (exercise_id, selected_option_id).

## learner_hearts

One shared heart balance per learner and regeneration baseline.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| user_id | uuid | PK, FK | No | — | Profile owning this record. |
| hearts | integer | — | No | 3 | Shared available hearts from zero through three. |
| regenerated_at | timestamp with time zone | — | No | now() | Baseline used to calculate timed heart regeneration. |

### Keys and database constraints

- Primary key: (user_id).
- FK (user_id) → profiles (id); delete CASCADE.
- Check: hearts between 0 and 3.

### Trigger and application rules

The service restores one heart every five minutes, capped at three. Camera mismatches do not spend hearts. These timing and grading policies are service rules.

## lesson_runs

Individual lesson attempts, including reduced-XP replays.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique record identifier. |
| enrollment_id | uuid | FK | No | — | Enrollment identifying the learner and course. |
| lesson_id | uuid | FK | No | — | Lesson associated with this record. |
| replay | boolean | — | No | false | Whether this run began as a replay of a perfected lesson. |
| started_at | timestamp with time zone | — | No | now() | Time this activity started. |
| completed_at | timestamp with time zone | — | Yes | — | Completion time; NULL while incomplete. |
| perfect | boolean | — | No | false | Whether all questions in this run were correct. |

### Keys and database constraints

- Primary key: (id).
- Unique index: (enrollment_id, lesson_id) WHERE completed_at is null.
- FK (enrollment_id) → enrollments (id); delete CASCADE.
- FK (lesson_id) → lessons (id); delete RESTRICT.

### Trigger and application rules

A partial unique index permits one incomplete run per enrollment and lesson. Database validation checks course membership.

## lesson_run_questions

Question order, allocated XP and submitted attempt for a particular run.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| run_id | uuid | PK, FK | No | — | Lesson run associated with this record. |
| exercise_id | uuid | PK, FK | No | — | Exercise associated with this record. |
| xp_value | integer | — | No | — | Question XP allocation snapshotted for this run. |
| sort_order | integer | — | No | — | Snapshotted question position within this run. |
| attempt_id | uuid | FK | Yes | — | Graded attempt attached after this run question is answered. |

### Keys and database constraints

- Primary key: (run_id, exercise_id).
- Unique: (run_id, sort_order).
- FK (run_id) → lesson_runs (id); delete CASCADE.
- FK (exercise_id) → exercises (id); delete RESTRICT.
- FK (attempt_id) → exercise_attempts (id); delete CASCADE.
- Check: xp_value>=0.

### Trigger and application rules

The composite key identifies a question within a run. Database validation checks that the exercise and attached attempt match the run enrollment and lesson.

## xp_awards

Append-only XP ledger used to derive learner and course totals.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique record identifier. |
| enrollment_id | uuid | FK | No | — | Enrollment identifying the learner and course. |
| lesson_id | uuid | FK | No | — | Lesson associated with this record. |
| run_id | uuid | FK | Yes | — | Lesson run associated with this record. |
| exercise_id | uuid | FK | Yes | — | Exercise associated with this record. |
| source | varchar(20) | — | No | — | XP origin such as first_question, replay, material or migrated history. |
| amount | integer | — | No | — | Nonnegative XP amount granted by this ledger entry. |
| awarded_at | timestamp with time zone | — | No | now() | Time the XP ledger entry was recorded. |

### Keys and database constraints

- Primary key: (id).
- Unique index: (enrollment_id, exercise_id) WHERE source in ('claim','first_question').
- Unique index: (run_id) WHERE source in ('run_import','replay','material').
- FK (enrollment_id) → enrollments (id); delete CASCADE.
- FK (lesson_id) → lessons (id); delete RESTRICT.
- FK (run_id) → lesson_runs (id); delete CASCADE.
- FK (exercise_id) → exercises (id); delete RESTRICT.
- Check: amount>=0.
- Check: source in ('legacy','claim','run_import','first_question','replay','material').

### Trigger and application rules

Database validation checks enrollment, lesson, run and exercise consistency. Updates are rejected. First-time question claims are unique; replay and material totals are unique per run.

Supporting indexes: (enrollment_id); (run_id).

## heart_practice_rounds

Practice rounds for restoring a heart without awarding XP.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique record identifier. |
| user_id | uuid | FK | No | — | Profile owning this record. |
| completed_at | timestamp with time zone | — | Yes | — | Completion time; NULL while incomplete. |
| created_at | timestamp with time zone | — | No | now() | Record creation time. |

### Keys and database constraints

- Primary key: (id).
- Unique index: (user_id) WHERE completed_at is null.
- FK (user_id) → profiles (id); delete CASCADE.

### Trigger and application rules

Only one incomplete round is allowed per learner. Three correct answers restore one heart and award no XP.

## heart_practice_questions

Three ordered questions assigned to a heart restoration round.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| round_id | uuid | PK, FK | No | — | Heart restoration round containing this record. |
| question_index | integer | PK | No | — | Zero-based position in a three-question heart round. |
| exercise_id | uuid | FK | No | — | Exercise associated with this record. |

### Keys and database constraints

- Primary key: (round_id, question_index).
- FK (round_id) → heart_practice_rounds (id); delete CASCADE.
- FK (exercise_id) → exercises (id); delete RESTRICT.
- Check: question_index between 0 and 2.

### Trigger and application rules

Positions are 0, 1 and 2. The application chooses previously encountered choice or boolean questions.

## heart_practice_submissions

Graded answer submissions for the questions in a heart restoration round.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | — | Unique record identifier. |
| round_id | uuid | FK | No | — | Heart restoration round containing this record. |
| question_index | integer | FK | No | — | Zero-based position in a three-question heart round. |
| selected_option_id | uuid | FK | No | — | Selected answer option. |
| is_correct | boolean | — | No | — | Graded correctness of the submitted response. |
| submitted_at | timestamp with time zone | — | No | now() | Time this practice answer was recorded. |

### Keys and database constraints

- Primary key: (id).
- Unique index: (round_id, question_index) WHERE is_correct.
- FK (selected_option_id) → exercise_options (id); delete RESTRICT.
- FK (round_id, question_index) → heart_practice_questions (round_id, question_index); delete CASCADE.

### Trigger and application rules

Database grading verifies the selected option against the assigned question. The composite FK identifies that question. At most one correct submission is stored per round question; updates are rejected.

## model_versions

Model identity, fingerprint and confidence threshold for traceability.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique model version identifier. |
| version | varchar(50) | UK | No | — | Unique immutable release name. |
| fingerprint | varchar(128) | UK | Yes | — | Optional unique model artifact fingerprint. |
| artifact_path | text | — | Yes | — | Optional model artifact location; not required to be a Supabase Storage path. |
| confidence_threshold | numeric(6, 5) | — | No | 0.80000 | Acceptance threshold from 0 to 1 for this model version. |
| created_at | timestamp with time zone | — | No | now() | Model registration time. |

### Keys and database constraints

- Primary key: (id).
- Unique: (version). NULL remains allowed where the field is nullable.
- Unique: (fingerprint). NULL remains allowed where the field is nullable.
- Check: length(btrim(version)) > 0.
- Check: artifact_path is null or length(btrim(artifact_path)) > 0.
- Check: confidence_threshold between 0 and 1.

### Trigger and application rules

Versions and non-null fingerprints are unique. Model records are immutable. Artifact paths are optional; model binaries belong to the recognition deployment, not necessarily Supabase Storage.

## practice_attempts

Schema support for standalone sign practice results.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique practice attempt identifier; reuse on retry. |
| user_id | uuid | FK | No | — | References profiles.id. |
| lesson_id | uuid | FK | Yes | — | Optional references lessons.id; NULL means standalone practice or review. |
| target_sign_id | uuid | FK | No | — | References signs.id; the sign the learner was asked to perform. |
| predicted_sign_id | uuid | FK | Yes | — | References signs.id; NULL means no supported sign was recognized. |
| model_version_id | uuid | FK | No | — | Model version that produced this prediction or response. |
| confidence | numeric(6, 5) | — | No | — | Recognition score between 0 and 1. |
| is_correct | boolean | — | No | — | Database-trigger result based on target match and the recorded model confidence threshold. |
| attempted_at | timestamp with time zone | — | No | now() | Practice time. |

### Keys and database constraints

- Primary key: (id).
- FK (user_id) → profiles (id); delete CASCADE.
- FK (lesson_id) → lessons (id); delete RESTRICT.
- FK (target_sign_id) → signs (id); delete RESTRICT.
- FK (predicted_sign_id) → signs (id); delete RESTRICT.
- FK (model_version_id) → model_versions (id); delete RESTRICT.
- Check: confidence between 0 and 1.

### Trigger and application rules

Database grading validates model confidence and target prediction. Records are immutable. Standalone practice persistence is schema support rather than a verified end-to-end UI workflow.

Supporting indexes: (user_id, attempted_at); (lesson_id); (target_sign_id); (predicted_sign_id); (model_version_id).

## recognition_sessions

Schema support for saved recognition sessions.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique saved session identifier. |
| user_id | uuid | FK | No | — | References profiles.id; session owner. |
| started_at | timestamp with time zone | — | No | now() | Session start time. |
| ended_at | timestamp with time zone | — | Yes | — | Session end time; NULL while open. |
| final_text | text | — | Yes | — | Text assembled by the finalization trigger from accepted sign meanings; NULL while open. |

### Keys and database constraints

- Primary key: (id).
- FK (user_id) → profiles (id); delete CASCADE.
- Check: ended_at is null or ended_at >= started_at.
- Check: final_text is null or ended_at is not null.

### Trigger and application rules

Database finalization checks session times and text. Current Live history remains in browser memory; the saved-session workflow is not implemented end to end.

Supporting indexes: (user_id, started_at).

## recognition_results

Schema support for ordered predictions within a recognition session.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique prediction-event identifier. |
| session_id | uuid | FK | No | — | References recognition_sessions.id. |
| sign_id | uuid | FK | Yes | — | References signs.id; NULL means no supported label was recognized. |
| model_version_id | uuid | FK | No | — | Model version that produced this prediction or response. |
| sequence_no | integer | — | No | — | Positive event position within the session. |
| confidence | numeric(6, 5) | — | No | — | Recognition score between 0 and 1; only accepted labeled results contribute to final_text. |
| recognized_at | timestamp with time zone | — | No | now() | Prediction time. |

### Keys and database constraints

- Primary key: (id).
- Unique: (session_id, sequence_no).
- FK (session_id) → recognition_sessions (id); delete CASCADE.
- FK (sign_id) → signs (id); delete RESTRICT.
- FK (model_version_id) → model_versions (id); delete RESTRICT.
- Check: sequence_no > 0.
- Check: confidence between 0 and 1.

### Trigger and application rules

Database validation checks session ordering and model confidence. Results are immutable. This storage model does not prove a current saved-history UI exists.

Supporting indexes: (sign_id); (model_version_id).

## achievements

Achievement definitions and threshold metrics.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| id | uuid | PK | No | gen_random_uuid() | Unique achievement identifier. |
| code | varchar(50) | UK | No | — | Unique stable badge code, such as FIRST_LESSON. |
| name | varchar(100) | — | No | — | Badge name displayed to learners. |
| description | text | — | No | — | Description of how to earn the badge. |
| metric | varchar(25) | — | No | — | One of completed_lessons, successful_practices, total_xp, or streak_days. |
| threshold | integer | — | No | — | Positive target value for the selected metric. |

### Keys and database constraints

- Primary key: (id).
- Unique: (code). NULL remains allowed where the field is nullable.
- Check: length(btrim(code)) > 0.
- Check: length(btrim(name)) > 0.
- Check: length(btrim(description)) > 0.
- Check: metric in ('completed_lessons', 'successful_practices', 'total_xp', 'streak_days').
- Check: threshold > 0.

### Trigger and application rules

Metrics are limited to completed_lessons, successful_practices, total_xp and streak_days. Automatic awarding is not implemented end to end.

## user_achievements

Association recording an achievement unlocked by a learner.

| Field | PostgreSQL type | Key | Nullable | Default | Description |
|---|---|---|---|---|---|
| user_id | uuid | PK, FK | No | — | References profiles.id; part of the composite primary key. |
| achievement_id | uuid | PK, FK | No | — | References achievements.id; part of the composite primary key. |
| unlocked_at | timestamp with time zone | — | No | now() | Time the backend confirmed eligibility and awarded the badge. |

### Keys and database constraints

- Primary key: (user_id, achievement_id).
- FK (user_id) → profiles (id); delete CASCADE.
- FK (achievement_id) → achievements (id); delete RESTRICT.

### Trigger and application rules

Database eligibility validation checks achievement thresholds. Awards are immutable; automatic awarding is not implemented end to end.

Supporting indexes: (achievement_id).

## Normalization and XP notes

XP is derived from xp_awards, not stored as a profile balance or duplicated in lesson_progress and lesson_runs. lesson_question_rewards was merged into the ledger. Heart round questions and submissions are relational children; the successful-answer count is calculated. Recognition attempts reference model_versions rather than storing duplicate model names.

The service currently allocates lesson XP by answer type with weights of choice 30%, boolean 20% and recognition 50%, renormalized when a type is absent. Unclaimed first-time question XP can be recovered on a retry. Replays after perfection award reduced XP based on correct answers. Hearts are shared across lessons and regenerate one every five minutes, up to three. These are service policies, not column defaults.

Related artifacts: [ERD PNG](ER-Schema.png), [ERD SVG](ER-Schema.svg), [editable ERD](Normalized-ERD.uml.txt).
