# ASignX — ER Schema

A simplified proposed database for ASignLive and ASign Learn: **16 application tables**, with Supabase Auth managing authentication. This replaces the earlier expanded proposal.

![ASignX ER diagram](ER-Schema.svg)

## Editable ER diagram

```mermaid
erDiagram
    auth_users {
        uuid id PK "Supabase managed"
    }
    profiles {
        uuid id PK,FK "required"
        varchar(100) display_name "required"
        varchar(10) role "required"
        varchar(64) timezone "required"
        timestamptz created_at "required"
        timestamptz updated_at "required"
    }
    signs {
        uuid id PK "required"
        varchar(100) gloss UK "required"
        text meaning "required"
        varchar(60) category "optional"
        text instructions "optional"
        text demo_path "optional"
        boolean is_published "required"
        timestamptz created_at "required"
    }
    courses {
        uuid id PK "required"
        varchar(150) title "required"
        text description "optional"
        boolean is_published "required"
        timestamptz created_at "required"
    }
    lessons {
        uuid id PK "required"
        uuid course_id FK "required"
        varchar(150) title "required"
        text content "optional"
        integer sort_order "required"
        integer xp_reward "required"
        boolean is_published "required"
    }
    lesson_signs {
        uuid lesson_id PK,FK "required"
        uuid sign_id PK,FK "required"
        integer sort_order "required"
    }
    exercises {
        uuid id PK "required"
        uuid lesson_id FK "required"
        text prompt "required"
        uuid sign_id FK "optional"
        integer sort_order "required"
    }
    exercise_options {
        uuid id PK "required"
        uuid exercise_id FK "required"
        text option_text "required"
        boolean is_correct "required"
        integer sort_order "required"
    }
    enrollments {
        uuid id PK "required"
        uuid user_id FK "required"
        uuid course_id FK "required"
        timestamptz enrolled_at "required"
    }
    lesson_progress {
        uuid enrollment_id PK,FK "required"
        uuid lesson_id PK,FK "required"
        timestamptz started_at "required"
        timestamptz completed_at "optional"
        integer xp_earned "required"
    }
    exercise_attempts {
        uuid id PK "required"
        uuid enrollment_id FK "required"
        uuid exercise_id FK "required"
        uuid selected_option_id FK "required"
        boolean is_correct "required"
        timestamptz attempted_at "required"
    }
    model_versions {
        uuid id PK "required"
        varchar(50) version UK "required"
        text artifact_path "required"
        numeric(6_5) confidence_threshold "required"
        timestamptz created_at "required"
    }
    practice_attempts {
        uuid id PK "required"
        uuid user_id FK "required"
        uuid lesson_id FK "optional"
        uuid target_sign_id FK "required"
        uuid predicted_sign_id FK "optional"
        uuid model_version_id FK "required"
        numeric(6_5) confidence "required"
        boolean is_correct "required"
        timestamptz attempted_at "required"
    }
    recognition_sessions {
        uuid id PK "required"
        uuid user_id FK "required"
        timestamptz started_at "required"
        timestamptz ended_at "optional"
        text final_text "optional"
    }
    recognition_results {
        uuid id PK "required"
        uuid session_id FK "required"
        uuid sign_id FK "optional"
        uuid model_version_id FK "required"
        integer sequence_no "required"
        numeric(6_5) confidence "required"
        timestamptz recognized_at "required"
    }
    achievements {
        uuid id PK "required"
        varchar(50) code UK "required"
        varchar(100) name "required"
        text description "required"
        varchar(25) metric "required"
        integer threshold "required"
    }
    user_achievements {
        uuid user_id PK,FK "required"
        uuid achievement_id PK,FK "required"
        timestamptz unlocked_at "required"
    }
    auth_users ||--o| profiles : "id"
    courses ||--o{ lessons : "course_id"
    lessons ||--o{ lesson_signs : "lesson_id"
    signs ||--o{ lesson_signs : "sign_id"
    lessons ||--o{ exercises : "lesson_id"
    signs |o--o{ exercises : "sign_id"
    exercises ||--o{ exercise_options : "exercise_id"
    profiles ||--o{ enrollments : "user_id"
    courses ||--o{ enrollments : "course_id"
    enrollments ||--o{ lesson_progress : "enrollment_id"
    lessons ||--o{ lesson_progress : "lesson_id"
    enrollments ||--o{ exercise_attempts : "enrollment_id"
    exercises ||--o{ exercise_attempts : "exercise_id"
    exercise_options ||--o{ exercise_attempts : "exercise_id_selected_option_id"
    profiles ||--o{ practice_attempts : "user_id"
    lessons |o--o{ practice_attempts : "lesson_id"
    signs ||--o{ practice_attempts : "target_sign_id"
    signs |o--o{ practice_attempts : "predicted_sign_id"
    model_versions ||--o{ practice_attempts : "model_version_id"
    profiles ||--o{ recognition_sessions : "user_id"
    recognition_sessions ||--o{ recognition_results : "session_id"
    signs |o--o{ recognition_results : "sign_id"
    model_versions ||--o{ recognition_results : "model_version_id"
    profiles ||--o{ user_achievements : "user_id"
    achievements ||--o{ user_achievements : "achievement_id"
```

## Relationships

| Relationship | Cardinality |
|---|---|
| Supabase identity → profile | One identity has at most one profile; each profile requires one email-confirmed identity. Pending signups have no profile. |
| Course → lessons | One course has zero or more lessons; each lesson belongs to one course. |
| Lessons ↔ signs | Many-to-many through lesson_signs. |
| Lesson → exercises → options | Each exercise is one multiple-choice question with several answer options. |
| Learners ↔ courses | Many-to-many through enrollments. |
| Enrollment → progress and exercise attempts | Learning activity belongs to one learner/course enrollment. |
| Learner → practice attempts | Each attempt has a target sign and model; a predicted sign and lesson context are optional. |
| Learner → recognition sessions → results | Saved Live history contains ordered predictions; a recognized sign may be unknown. |
| Learners ↔ achievements | Many-to-many through user_achievements. |

## Scope decisions

- A profile has the learner or admin role. Guests have no stored profile, and ML developers operate the model service without requiring another application role.
- Each exercise is a single multiple-choice question. Several exercises form the lesson quiz; camera-based practice uses practice_attempts. A separate quiz/question hierarchy is unnecessary.
- Signs hold a simple category label and one optional demonstration-video path. Lesson text plus linked sign demonstrations supply the learning content.
- Lesson completion stores its one-time xp_earned. Total XP is calculated from completed lessons; no XP balance or transaction table is needed for this policy.
- Streaks are calculated from distinct local dates of lesson completion and successful practice, using profiles.timezone. No streak table or cache is needed.
- Model versions identify which model produced each practice/Live result. Separate deployment, evaluation, audit, role-assignment, and per-model vocabulary tables are outside this baseline.
- Save authenticated Live history only with user opt-in. Guest and unsaved sessions stay transient. Store curated media/model files in Supabase Storage, and only object paths in PostgreSQL. Do not store camera frames or raw video.

PK = primary key; FK = foreign key; UK = single-column unique key. Composite uniqueness, checks, and backend validation rules are specified in [Data Dictionary](Data-Dictionary.md). `auth_users` represents external `auth.users`; it is not an additional application table. Numeric diagram notation uses an underscore for scale; the dictionary supplies exact PostgreSQL types.
