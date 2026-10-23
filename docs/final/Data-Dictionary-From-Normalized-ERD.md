# ASignX Normalized Data Dictionary

Source: [Normalized-ERD.uml.txt](Normalized-ERD.uml.txt)

Updated 22 October 2026

This dictionary follows Normalized-ERD.uml.txt. It covers 16 application tables containing 87 attributes, plus the Supabase-managed auth_users reference containing its id attribute. The source declares 25 relationships.

The table names, attributes, PostgreSQL types, explicit key markings, and relationship endpoints follow the supplied ERD. Additional fields from the application implementation are not included.

## Reading the dictionary

- PK means primary key, FK means foreign key, and UK means explicitly declared unique key. Multiple PK fields in one table form a single composite primary key.
- NS means not specified in the ERD. All column defaults are NS because the source declares no default expressions. No UUID generator, timestamp default, role default, or XP default is assumed.
- Null? is No for a primary key, a starred mandatory attribute, or a foreign key with a mandatory parent relationship. It is Yes for an explicit nullable attribute or optional parent relationship. For other attributes, the SQL nullability is NS.
- VARCHAR(n) limits the value to n characters. NUMERIC(6,5) declares six total digits and five fractional digits. TIMESTAMPTZ is a timestamp with time zone. These types do not by themselves define domain checks or default values.
- The source does not specify ON DELETE or ON UPDATE actions, domain checks, indexes, triggers, or access policies. They are not presented as declared constraints in this dictionary.

## auth_users

Supabase-managed authentication entity. The ERD declares only its unique user identifier; additional Auth attributes are outside this dictionary.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier supplied by Supabase Auth. |

**Declared keys and references**

- Primary key: (id).

**Notes**

- Managed authentication is external to the application tables. The ERD does not enumerate email, password, metadata, or other Supabase columns.

## profiles

Application profile associated with an authentication identity. Stores display name, application role, time zone, and profile timestamps.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK FK | No | NS | Profile identifier shared with the linked authentication identity. References auth_users.id. |
| display_name | VARCHAR(100) | - | NS | NS | Name displayed for the user in the application. |
| role | VARCHAR(10) | - | NS | NS | Application role associated with the profile; permitted values are not specified in the ERD. |
| timezone | VARCHAR(64) | - | NS | NS | Time-zone identifier associated with the user profile. |
| created_at | TIMESTAMPTZ | - | NS | NS | Record creation timestamp. |
| updated_at | TIMESTAMPTZ | - | NS | NS | Record modification timestamp. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: id -> auth_users.id.

**Notes**

- The ERD specifies a mandatory one-to-one relationship between auth_users and profiles. The application must ensure each Auth identity receives its profile; the shared PK/FK prevents multiple profiles for one identity.

## courses

Learning course definitions and their publication status.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the course record. |
| title | VARCHAR(150) | - | NS | NS | Title displayed for the course or lesson. |
| description | TEXT | - | NS | NS | Description of the course or achievement. |
| is_published | BOOLEAN | - | NS | NS | Publication-status flag for the content. |
| created_at | TIMESTAMPTZ | - | NS | NS | Record creation timestamp. |

**Declared keys and references**

- Primary key: (id).

## enrollments

Associates a learner profile with a course and records when the learner enrolled.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the enrollment record. |
| user_id | UUID | FK | No | NS | Identifies the learner or session owner. References profiles.id. |
| course_id | UUID | FK | No | NS | Identifies the associated course. References courses.id. |
| enrolled_at | TIMESTAMPTZ | - | NS | NS | Timestamp of enrollment in the course. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: user_id -> profiles.id.
- Foreign key: course_id -> courses.id.

## lessons

Ordered lesson material within a course, with a configured XP reward and publication status.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the lesson record. |
| course_id | UUID | FK | No | NS | Identifies the associated course. References courses.id. |
| title | VARCHAR(150) | - | NS | NS | Title displayed for the course or lesson. |
| content | TEXT | - | NS | NS | Instructional content of the lesson. |
| sort_order | INTEGER | - | NS | NS | Relative display position within the parent record. |
| xp_reward | INTEGER | - | NS | NS | XP reward configured for the lesson. |
| is_published | BOOLEAN | - | NS | NS | Publication-status flag for the content. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: course_id -> courses.id.

## lesson_progress

Records a lesson within an enrollment, including its start, completion time, and earned XP.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| enrollment_id | UUID | PK FK | No | NS | Identifies the learner course enrollment. References enrollments.id. |
| lesson_id | UUID | PK FK | No | NS | Identifies the associated lesson. References lessons.id. |
| started_at | TIMESTAMPTZ | - | NS | NS | Timestamp when the lesson activity or recognition session started. |
| completed_at | TIMESTAMPTZ | - | NS | NS | Timestamp associated with lesson completion. |
| xp_earned | INTEGER | - | NS | NS | XP recorded for this enrollment and lesson. |

**Declared keys and references**

- Primary key: (enrollment_id, lesson_id).
- Foreign key: enrollment_id -> enrollments.id.
- Foreign key: lesson_id -> lessons.id.

**Notes**

- The pair (enrollment_id, lesson_id) is one composite primary key; neither component alone is the primary key.

## signs

Shared ASL vocabulary, meanings, instructions, categories, and demonstration paths.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the sign record. |
| gloss | VARCHAR(100) | UK | NS | NS | Unique vocabulary label identifying the sign. |
| meaning | TEXT | - | NS | NS | Meaning associated with the ASL sign. |
| category | VARCHAR(60) | - | NS | NS | Category label used to organize signs. |
| instructions | TEXT | - | NS | NS | Instructions for performing the sign. |
| demo_path | TEXT | - | NS | NS | Path to a sign demonstration resource. |
| is_published | BOOLEAN | - | NS | NS | Publication-status flag for the content. |
| created_at | TIMESTAMPTZ | - | NS | NS | Record creation timestamp. |

**Declared keys and references**

- Primary key: (id).
- Unique key: (gloss).

## lesson_signs

Junction table connecting lessons and signs, with a display order for each linked sign.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| lesson_id | UUID | PK FK | No | NS | Identifies the associated lesson. References lessons.id. |
| sign_id | UUID | PK FK | No | NS | Identifies the associated sign. References signs.id. |
| sort_order | INTEGER | - | NS | NS | Relative display position within the parent record. |

**Declared keys and references**

- Primary key: (lesson_id, sign_id).
- Foreign key: lesson_id -> lessons.id.
- Foreign key: sign_id -> signs.id.

**Notes**

- The pair (lesson_id, sign_id) is one composite primary key. This junction resolves the many-to-many association between lessons and signs.

## exercises

Questions or practice prompts associated with lessons and, optionally, a sign.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the exercise record. |
| lesson_id | UUID | FK | No | NS | Identifies the associated lesson. References lessons.id. |
| prompt | TEXT | - | NS | NS | Prompt displayed for the exercise. |
| sign_id | UUID | FK | Yes | NS | Identifies the associated sign. References signs.id. |
| sort_order | INTEGER | - | NS | NS | Relative display position within the parent record. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: lesson_id -> lessons.id.
- Foreign key: sign_id -> signs.id.

**Notes**

- sign_id is explicitly nullable and its parent relationship is optional.

## exercise_options

Answer options belonging to an exercise, including the option correctness flag.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the exercise option record. |
| exercise_id | UUID | FK | No | NS | Identifies the exercise. References exercises.id. |
| option_text | TEXT | - | NS | NS | Text displayed for an answer option. |
| is_correct | BOOLEAN | - | NS | NS | Indicates whether this answer option is correct. |
| sort_order | INTEGER | - | NS | NS | Relative display position within the parent record. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: exercise_id -> exercises.id.

## exercise_attempts

Learner submissions linking an enrollment, an exercise, and the selected answer option.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the exercise attempt record. |
| enrollment_id | UUID | FK | No | NS | Identifies the learner course enrollment. References enrollments.id. |
| exercise_id | UUID | FK | No | NS | Identifies the exercise. References exercises.id. |
| selected_option_id | UUID | FK | No | NS | Identifies the selected exercise option. References exercise_options.id. |
| attempted_at | TIMESTAMPTZ | - | NS | NS | Timestamp of the exercise or camera-practice attempt. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: enrollment_id -> enrollments.id.
- Foreign key: exercise_id -> exercises.id.
- Foreign key: selected_option_id -> exercise_options.id.

**Notes**

- This table has no is_correct attribute in the supplied ERD. The selected option is recorded; its correctness flag belongs to exercise_options.
- The ERD shows separate references to exercises and exercise_options. It does not specify a composite foreign key enforcing that the selected option belongs to the recorded exercise.

## achievements

Achievement definitions, identified by a unique code, with a metric and target threshold.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the achievement record. |
| code | VARCHAR(50) | UK | NS | NS | Unique stable code identifying the achievement. |
| name | VARCHAR(100) | - | NS | NS | Display name of the achievement. |
| description | TEXT | - | NS | NS | Description of the course or achievement. |
| metric | VARCHAR(25) | - | NS | NS | Metric used to assess achievement eligibility; allowed values are not specified in the ERD. |
| threshold | INTEGER | - | NS | NS | Target value associated with the achievement metric. |

**Declared keys and references**

- Primary key: (id).
- Unique key: (code).

## user_achievements

Junction table recording which achievement a learner has unlocked and when it was unlocked.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| user_id | UUID | PK FK | No | NS | Identifies the learner or session owner. References profiles.id. |
| achievement_id | UUID | PK FK | No | NS | Identifies the awarded achievement. References achievements.id. |
| unlocked_at | TIMESTAMPTZ | - | NS | NS | Timestamp when the user unlocked the achievement. |

**Declared keys and references**

- Primary key: (user_id, achievement_id).
- Foreign key: user_id -> profiles.id.
- Foreign key: achievement_id -> achievements.id.

**Notes**

- The pair (user_id, achievement_id) is one composite primary key. This junction resolves the many-to-many association between profiles and achievements.

## model_versions

Model release definitions, artifact paths, and recognition confidence thresholds.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the model version record. |
| version | VARCHAR(50) | UK | NS | NS | Unique label identifying the model version. |
| artifact_path | TEXT | - | NS | NS | Path to the model artifact. |
| confidence_threshold | NUMERIC(6,5) | - | NS | NS | Confidence threshold associated with the model version. |
| created_at | TIMESTAMPTZ | - | NS | NS | Record creation timestamp. |

**Declared keys and references**

- Primary key: (id).
- Unique key: (version).

## practice_attempts

Camera-practice outcomes linking a learner, target sign, optional prediction, and model version. Lesson context is optional.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the practice attempt record. |
| user_id | UUID | FK | No | NS | Identifies the learner or session owner. References profiles.id. |
| lesson_id | UUID | FK | Yes | NS | Identifies the associated lesson. References lessons.id. |
| target_sign_id | UUID | FK | No | NS | Identifies the sign the learner was asked to perform. References signs.id. |
| predicted_sign_id | UUID | FK | Yes | NS | Identifies the predicted sign, when one is available. References signs.id. |
| model_version_id | UUID | FK | No | NS | Identifies the model version used for the prediction. References model_versions.id. |
| confidence | NUMERIC(6,5) | - | NS | NS | Confidence value recorded for a practice attempt or recognition result. |
| attempted_at | TIMESTAMPTZ | - | NS | NS | Timestamp of the exercise or camera-practice attempt. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: user_id -> profiles.id.
- Foreign key: lesson_id -> lessons.id.
- Foreign key: target_sign_id -> signs.id.
- Foreign key: predicted_sign_id -> signs.id.
- Foreign key: model_version_id -> model_versions.id.

**Notes**

- This table has no is_correct attribute in the supplied ERD. Correctness can be evaluated from the target, prediction, confidence, and referenced model threshold.
- The optional lesson reference allows a practice attempt without a lesson context. The predicted sign may also be NULL.

## recognition_sessions

Saved recognition sessions associated with a user profile, including session times and final text.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the recognition session record. |
| user_id | UUID | FK | No | NS | Identifies the learner or session owner. References profiles.id. |
| started_at | TIMESTAMPTZ | - | NS | NS | Timestamp when the lesson activity or recognition session started. |
| ended_at | TIMESTAMPTZ | - | NS | NS | Timestamp associated with the end of the recognition session. |
| final_text | TEXT | - | NS | NS | Final text associated with the recognition session. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: user_id -> profiles.id.

## recognition_results

Ordered recognition results within a session, with an optional recognized sign, model version, confidence, and recognition time.

| Column name | Data type and size | Key | Null allowed | Default | Description |
|---|---|---|---|---|---|
| id | UUID | PK | No | NS | Unique identifier of the recognition result record. |
| session_id | UUID | FK | No | NS | Identifies the parent recognition session. References recognition_sessions.id. |
| sign_id | UUID | FK | Yes | NS | Identifies the associated sign. References signs.id. |
| model_version_id | UUID | FK | No | NS | Identifies the model version used for the prediction. References model_versions.id. |
| sequence_no | INTEGER | - | NS | NS | Position of the result within the recognition session. |
| confidence | NUMERIC(6,5) | - | NS | NS | Confidence value recorded for a practice attempt or recognition result. |
| recognized_at | TIMESTAMPTZ | - | NS | NS | Timestamp of the recognition result. |

**Declared keys and references**

- Primary key: (id).
- Foreign key: session_id -> recognition_sessions.id.
- Foreign key: sign_id -> signs.id.
- Foreign key: model_version_id -> model_versions.id.

**Notes**

- sign_id is explicitly nullable and its parent relationship is optional. The ERD does not mark (session_id, sequence_no) as unique.

## Relationship reference

| Parent | Child foreign key | Parent to child | Parent reference | Relationship label |
|---|---|---|---|---|
| auth_users | profiles.id | 1 to 1 | Required | has profile |
| profiles | enrollments.user_id | 1 to 0..many | Required | enrolls |
| courses | enrollments.course_id | 1 to 0..many | Required | receives |
| courses | lessons.course_id | 1 to 0..many | Required | contains |
| enrollments | lesson_progress.enrollment_id | 1 to 0..many | Required | tracks |
| lessons | lesson_progress.lesson_id | 1 to 0..many | Required | progress for |
| lessons | lesson_signs.lesson_id | 1 to 0..many | Required | includes |
| signs | lesson_signs.sign_id | 1 to 0..many | Required | appears in |
| lessons | exercises.lesson_id | 1 to 0..many | Required | contains |
| signs | exercises.sign_id | 0..1 to 0..many | Optional | reference sign |
| exercises | exercise_options.exercise_id | 1 to 0..many | Required | offers |
| enrollments | exercise_attempts.enrollment_id | 1 to 0..many | Required | makes |
| exercises | exercise_attempts.exercise_id | 1 to 0..many | Required | attempted in |
| exercise_options | exercise_attempts.selected_option_id | 1 to 0..many | Required | selected option |
| profiles | user_achievements.user_id | 1 to 0..many | Required | earns |
| achievements | user_achievements.achievement_id | 1 to 0..many | Required | awarded as |
| profiles | practice_attempts.user_id | 1 to 0..many | Required | performs |
| lessons | practice_attempts.lesson_id | 0..1 to 0..many | Optional | practiced in |
| signs | practice_attempts.target_sign_id | 1 to 0..many | Required | target sign |
| signs | practice_attempts.predicted_sign_id | 0..1 to 0..many | Optional | predicted sign |
| model_versions | practice_attempts.model_version_id | 1 to 0..many | Required | evaluates with |
| profiles | recognition_sessions.user_id | 1 to 0..many | Required | starts |
| recognition_sessions | recognition_results.session_id | 1 to 0..many | Required | contains |
| signs | recognition_results.sign_id | 0..1 to 0..many | Optional | recognized sign |
| model_versions | recognition_results.model_version_id | 1 to 0..many | Required | generated by |

## Details requiring implementation decisions

- auth_users is the name used in the supplied ERD for Supabase-managed authentication. Only its id is shown; no additional authentication fields are added here.
- The relation auth_users ||--|| profiles requires one profile per Auth identity and one Auth identity per profile in the conceptual design.
- The explicit unique attributes are signs.gloss, achievements.code, and model_versions.version. No additional composite uniqueness is declared.
- completed_at, ended_at, final_text, and descriptive fields have no explicit nullable annotation in the source. Their SQL nullability remains NS here; lifecycle-based optionality should be decided when implementing the schema.
- Business checks such as option/exercise consistency, lesson/enrollment course consistency, score ranges, quiz publication rules, XP award rules, and consent for saved history require separate implementation decisions.

## Source

Normalized-ERD.uml.txt, supplied by the project owner. The file title identifies the design as Normalized ASL Learning and Recognition Database (3NF).
