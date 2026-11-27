# ASignX achievement badges — manuscript reference

Last verified: 27 November 2026, Philippine time.

This reference describes the implemented achievement module and its database
rules. It separates current functionality from future ideas so manuscript claims
can be checked against the application. For visual conventions used across the
website, also read [Design-System.md](../Design-System.md).

## 1. Purpose and scope

The achievement module recognizes verified learner activity in ASignLearn. It
defines badges, evaluates progress against requirements, records earned awards,
and displays a collection of achievements. Administrators manage the catalog and
design badge artwork. Learners receive eligible published achievements
automatically; they do not manually claim them.

The current implementation supports six numeric requirement metrics. SVG artwork,
milestone grouping, difficulty tier, and secret visibility describe the badge;
they do not independently grant eligibility.

## 2. Roles and access

| Role | Achievement access | Progress storage |
| --- | --- | --- |
| Administrator | Create drafts, edit definitions and artwork, preview learner states, publish, retire, search, and browse the catalog | Shared catalog in Supabase; admins are not recipients of automatic learner awards |
| Registered learner | View available badges, progress, secret hints, earned badges, and unlock notifications | Persistent learner records and awards in Supabase |
| Guest learner | Use the learner collection and automatic award rules within an independent guest session | Temporary backend PostgreSQL-compatible store, isolated by guest ID; no permanent guest progress in Supabase |

Admin API access requires a verified identity and a current administrator profile.
Database row-level security restricts browser access to public catalog definitions
and the signed-in learner's own award records.

## 3. Badge requirements

| Metric key | What is measured | Important behavior |
| --- | --- | --- |
| `completed_lessons` | Completed lesson-progress records belonging to the learner's enrollments | Completing or replaying an already completed lesson does not create an additional lesson completion |
| `successful_practices` | Completed Practice rounds with three correctly answered assigned questions | A round counts once; success is independent of whether it restores a heart |
| `total_xp` | Sum of verified amounts in the learner's XP award ledger | The client cannot award XP merely by reporting a total |
| `streak_days` | Consecutive local dates containing a lesson completion or successful Practice round | Uses the profile time zone; a date counts once, and the latest activity must be today or yesterday |
| `perfect_lessons` | Distinct lesson IDs with at least one completed perfect lesson run | A perfect replay qualifies; repeated perfect runs of the same lesson count once |
| `completed_courses` | Enrolled, published courses with at least one published lesson and completion records for all published lessons | Draft lessons are excluded; empty courses do not qualify |

A target must be a positive integer. Eligibility is reached when the relevant
verified metric is greater than or equal to that target.

Practice exists for learning reinforcement. Completing a successful round can also
restore one heart when the learner has fewer than three hearts. Heart restoration
is a secondary reward, not a requirement for a Practice badge. Automatic heart
regeneration uses a 30-minute interval and is separate from badge evaluation.

## 4. Automatic awarding and integrity

1. The backend grades activity and stores trusted results.
2. Database activity triggers evaluate published badges after lesson completion,
   positive XP awards, successful Practice completion, and completed perfect runs.
3. The database verifies the learner role, publication status, and target.
4. Eligible awards are inserted into `profile_achievements`.
5. The composite primary key prevents a learner receiving the same badge twice.

Publishing a badge also evaluates existing learner progress. A learner who already
meets a newly published requirement can therefore receive the badge immediately.
Existing awards remain recorded if a streak later resets or course content changes.

After any learner earns a badge, its metric and target become immutable. Admins may
still change cosmetic details, artwork, grouping, and tier, or retire the badge.
An explicit tier edit is an administrator decision; the system never changes stored
tiers automatically when milestones are added.

## 5. Milestone and standalone achievements

**Milestone achievements** have an optional `milestone_group` label and appear as
a related series. Within a collection shelf, their targets are ordered from lower
to higher values. Admins can select an existing group for the same metric.

**Standalone achievements** have `milestone_group = NULL`. They represent an
individual challenge and can have any supported difficulty tier. They still use
one of the six existing metrics and one numeric target. For example, a secret
challenge requiring three different perfect lessons is supported today.

Milestone grouping is organizational metadata. It is not a prerequisite chain:
earning a higher milestone does not require a separate award for every earlier
milestone, and standalone challenges do not require a milestone group.

## 6. Tiers and measured rarity

| Stored tier | Display label | SVG frame shape |
| --- | --- | --- |
| `starter` | Starter | Circle |
| `growing` | Growing | Shield |
| `advanced` | Advanced | Hexagon |
| `mastery` | Mastery | Ornate seal |

Tier communicates intended difficulty. It is not a statistically measured rarity
or a percentage of learners who earned the badge.

For a grouped milestone, the designer can suggest a tier from the distinct sorted
targets within that group and metric. The first target suggests Starter, the
second Growing, the third Advanced, and the fourth and later targets Mastery. The
admin must choose **Use suggestion** to apply it and may override it based on the
actual effort required. This is a design aid, not an automatic difficulty model.

Secret visibility is independent: a badge can be easy and secret, difficult and
visible, or difficult and secret.

## 7. Secret badges

A published secret badge appears to an eligible learner as a generic **Secret
badge** with an optional hint. Until earned, the learner response omits its real
name, metric, target, center icon, tier, milestone group, design recipe, and numeric
progress. A neutral question-mark placeholder conceals its artwork.

After earning it, the learner receives the real badge information and SVG design.
Administrators can inspect the full definition and preview both learner states.
Direct public database catalog reads exclude secret definitions entirely; the
authenticated application API supplies the masked discovery entry.

## 8. SVG badge designer

The badge editor contains **Details** and **Designer** tabs with one save action.
Details include the name, description, requirement, target, structure, visibility,
and optional secret hint. The Designer tab controls artwork and tier.

| Element | Meaning | Admin control |
| --- | --- | --- |
| Center icon | Requirement type | Automatically assigned from the metric |
| Color family | Achievement category | Automatically assigned from the metric |
| Frame shape | Difficulty tier | Chosen through the tier selector |
| Border | Decorative treatment | Single, double, dotted, or laurel |
| Background pattern | Decorative treatment | Solid, rays, stars, or diamonds |
| Decoration | Decorative treatment | None, ribbon, wings, or stars |
| Color depth | Variation within the category palette | Classic, soft, or deep |

| Category | Metric | Center icon | Primary color |
| --- | --- | --- | --- |
| Learning | `completed_lessons` | Book | `#2962f5` |
| Practice | `successful_practices` | Checklist | `#14716c` |
| Experience | `total_xp` | Lightning | `#8b6513` |
| Consistency | `streak_days` | Flame | `#ab4c19` |
| Precision | `perfect_lessons` | Target | `#254168` |
| Courses | `completed_courses` | Graduation cap | `#307044` |

Artwork is rendered as SVG using a shared `128 × 144` viewBox and consistent
line styles. It scales without a separate raster asset for each display size.
SVG clipping identifiers are unique when multiple badges appear together.

The studio provides a live learner preview, locked/earned preview states, and
small, medium, and large artwork samples. **Shuffle design** searches for an
unused recipe in the current category and tier. **Reset** restores the default
recipe. **Undo/Redo** applies to design and tier changes within the editor session.

Duplicate combinations show a warning and do not prevent saving or awarding. The
comparison uses category, tier, and normalized recipe rather than JSON key order.
The available options yield 192 recipes per category/tier, or 4,608 combinations
across six categories and four tiers. This is a configuration count; subtle
variants are not guaranteed to look completely different at every size.

## 9. Catalog lifecycle

| Status | Behavior |
| --- | --- |
| Draft | Editable by admins and unavailable for learner awarding; new records start here |
| Published | Available for eligibility evaluation and learner display, subject to secret masking |
| Retired | Stops new awards; remains visible to learners who already earned it |

Admins use Gallery or List view with search and status filters. Both views display
12 badges per page with a result range and Previous/Next controls. Search and
status changes return to page 1; switching views preserves the page. The desktop
gallery uses four columns, tablets two, and phones one. Board view was removed.

Selecting a badge opens the Inspector. Editing opens Preview Studio. Existing
badges without a saved recipe retain temporary artwork until an admin chooses
**Start designing**. Existing awards are not deleted when artwork changes.

## 10. Learner-facing displays

- The Progress page displays milestone shelves and standalone/category collections.
- A profile displays up to three recent earned achievements with a collection link.
- Earned cards include the award date; visible locked cards show numeric progress.
- The shared renderer supplies artwork to galleries, inspectors, previews,
  collections, profiles, and unlock notifications.
- During a mounted dashboard session, activity refreshes can announce newly earned
  achievements. Initial page loading establishes the known award set without
  replaying every historical unlock. Notifications can be dismissed and otherwise
  disappear after eight seconds.

## 11. Guest-session behavior

Each guest sign-in creates an independent temporary identity. Two guests do not
share progress or continue each other's achievements. Guest lesson activity and
awards use the same rules against an isolated backend PGlite database.

The shared published catalog is copied into the temporary store. It includes
secret definitions for trusted server-side evaluation; learner responses still
mask locked secrets. A store takes its catalog snapshot when initialized, so active
stores do not necessarily reflect every later catalog edit immediately.

Guest progress is removed on logout or session expiration. The current backend
idle timeout is one hour, extended by valid session activity. Guest progress is
temporary backend session data, not browser-only storage and not a shared permanent
guest account in production Supabase.

## 12. Database structure

### `achievements`

Stores the shared badge definition and artwork recipe.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | UUID primary key | Achievement identity |
| `code` | varchar(50), unique | Stable internal badge code |
| `name` | varchar(100) | Display name |
| `description` | text | Meaning or earning requirement |
| `metric` | varchar(25) | One of the six supported requirement metrics |
| `threshold` | integer | Positive eligibility target |
| `status` | varchar(10) | Draft, published, or retired |
| `icon` | varchar(10) | Legacy icon key; a compatible value is derived for designed badges |
| `is_secret` | boolean | Whether the identity is concealed until earned |
| `hint` | varchar(250) | Optional discovery teaser |
| `tier` | varchar(10), default starter | Difficulty tier and SVG shape |
| `milestone_group` | nullable varchar(80) | Optional series label; NULL means standalone |
| `badge_design` | nullable JSONB | Versioned SVG recipe; NULL retains legacy artwork |

Example recipe:

```json
{"version":1,"border":"double","pattern":"solid","decoration":"none","finish":"classic"}
```

The API and database independently reject unsupported recipe versions, invalid
options, extra fields, and malformed recipes. Arbitrary SVG markup is not stored
or injected. Requests from an older client that omit the three designer fields
preserve those existing fields on an edit.

### `profile_achievements`

| Column | Type | Meaning |
| --- | --- | --- |
| `user_id` | UUID, primary/foreign key | References the learner profile |
| `achievement_id` | UUID, primary/foreign key | References the achievement |
| `unlocked_at` | timestamptz | Time the database awarded it |

The composite primary key is `(user_id, achievement_id)`. Deleting a profile
cascades its private award association. Achievement deletion is restricted while
referenced. The designer does not require a new award table or change these fields.

## 13. Seed catalog after the badge migrations

These are catalog definitions, not a claim that every learner has earned them.
Administrators can edit the live catalog later.

| Code | Badge name | Requirement | Initial status | Secret |
| --- | --- | --- | --- | --- |
| `FIRST_LESSON` | First Lesson | 1 completed lesson | Published | No |
| `PRACTICE_REGULAR` | Practice Regular | 5 successful Practice rounds | Published | No |
| `XP_MILESTONE` | XP Milestone | 100 XP | Published | No |
| `THREE_DAY_STREAK` | Three-Day Streak | 3-day streak | Published | No |
| `LESSONS_10` | Lesson Explorer | 10 completed lessons | Published | No |
| `LESSONS_25` | Lesson Scholar | 25 completed lessons | Published | No |
| `PRACTICE_15` | Practice Pro | 15 successful Practice rounds | Published | No |
| `PRACTICE_50` | Practice Master | 50 successful Practice rounds | Published | No |
| `XP_500` | Building Momentum | 500 XP | Published | No |
| `STREAK_7` | A Week of Learning | 7-day streak | Published | No |
| `COURSE_1` | Course Finisher | 1 completed course | Published | No |
| `CLEAN_SWEEP` | Clean Sweep | Perfect runs in 3 different lessons | Published | Yes |
| `PERFECT_10` | Steady Hands | Perfect runs in 10 different lessons | Draft | Yes |

All seed records initially have Starter tier, no milestone group, and no saved
design recipe. Their targets do not silently assign advanced tiers. Admins can
curate the artwork and grouping through the designer.

## 14. API and implementation references

| Interface | Purpose |
| --- | --- |
| `GET /api/admin/achievements` | Read the admin catalog and requirement-lock state |
| `POST /api/admin/achievements` | Create a validated draft |
| `PATCH /api/admin/achievements/:id` | Edit details, design, and publication state |
| `GET /api/me/progress` | Read the learner's collection, progress, awards, XP, and streak |
| `GET /api/me/dashboard` | Aggregate personal dashboard resources, including progress |
| `GET /health/ready` | Verify required tables and achievement columns exist |

Sources for manuscript review:

- `server/src/achievementAdmin.ts`: catalog API validation and writes.
- `server/src/personal.ts`: progress responses and secret masking.
- `server/src/badgeDesign.ts`: allowed recipe values and legacy icon mapping.
- `server/src/db/schema/app.ts`: table definitions and constraints.
- `server/src/db/guestDatabase.ts` and `server/src/guests.ts`: temporary guest store.
- `client/src/data/badge-design.js`: palettes, tiers, recipes, suggestions, and shuffle.
- `client/src/components/BadgeSvg.jsx`: vector renderer.
- `client/src/components/BadgeDesigner.jsx`: admin design controls.
- `client/src/components/Achievements.jsx`: collection cards and legacy fallback.
- `client/src/components/AchievementNotice.jsx`: unlock notifications.
- `client/src/pages/AdminAchievements.jsx`: catalog, Inspector, and Preview Studio.
- `client/src/pages/Progress.jsx` and `client/src/pages/Profile.jsx`: learner displays.

## 15. Rollout and verification record

The following migrations were applied to the existing Supabase database on
27 November 2026 and recorded in `drizzle.__drizzle_migrations` using the local
migration names and SHA-256 hashes:

| Migration | Purpose |
| --- | --- |
| `20261127160000_badge_collections` | Secret hints, expanded metrics, perfect-run trigger, and additional catalog definitions |
| `20261127180000_badge_designer` | Tier, milestone grouping, validated JSONB design recipe |

The normal terminal migration command encountered connection error `EACCES`.
The SQL Editor was used to apply both migrations atomically. A transaction-local,
RLS-enabled verification snapshot checked that every original award row remained
unchanged before the transaction committed. The snapshot was dropped at commit.

Verified results immediately after migration:

- Five required badge columns present; both migration entries recorded.
- Seven original award rows preserved; four additional eligible awards created by
  publication backfill, for eleven awards at the time of verification.
- Thirteen catalog definitions, including twelve published badges and one draft.
- Local API readiness returned HTTP 200 with `{"ready":true}`.
- A fresh test guest loaded twelve available/discovery badges and zero earned
  badges. The temporary test guest was logged out and cleared afterward.

These are dated verification observations, not permanent system totals. Registered
learner activity and later catalog edits can change the counts. Applying database
migrations does not itself deploy the frontend or Railway application release.

Client tests and 42 backend tests previously passed, including recipe persistence,
database validation, secret masking, SVG scaling/identifiers, unused shuffle,
guest isolation, and preservation of earned awards. Those automated checks do not
substitute for a full visual acceptance review of every screen.

## 16. Suggested manuscript description

ASignX includes an achievement management module that recognizes verified learning
activity through automatically awarded badges. Administrators define earning
requirements, organize optional milestone series, assign difficulty tiers, and
create scalable SVG badge designs. Learners view available and earned badges in
their progress collection, while secret achievements reveal their full details
only after completion. Persistent awards are associated with registered learner
profiles, and guests use independent temporary sessions whose progress is cleared
when the session ends.

## 17. Future scope — do not describe as implemented

- Measured rarity or earned-by percentages.
- Multi-condition challenge rules, timed challenges, or arbitrary gameplay events.
- Manual award assignment, transferable badges, or learner-created badge designs.
- A freehand SVG editor, arbitrary SVG uploads, or unrestricted custom color families.
- A strict guarantee that no two saved badges can use the same design combination.
- Automatic retroactive tier changes or AI-generated difficulty classification.

Standalone and secret badges are supported now through the existing threshold
metrics. More specialized challenge conditions require additional backend rules.
