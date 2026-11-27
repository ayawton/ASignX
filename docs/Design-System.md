# ASignX design system

This is the implementation reference for future ASignX interface work. Keep these
decisions consistent across new screens. Extend shared components before creating
a competing visual style. The user approved the blue-and-white achievement gallery
direction on 27 November 2026.

## Foundations

Tokens live in `client/src/studio.css`. Use their variables instead of introducing
slightly different colors for each screen.

| Role | Token | Value |
| --- | --- | --- |
| Main text | `--ink` | `#18294c` |
| Supporting text | `--text` | `#5d6b82` |
| Muted text | `--muted` | `#67768e` |
| Borders | `--line` | `#e0e7f0` |
| Main surface | `--paper` | `#ffffff` |
| Pale blue surface | `--cream` | `#f4f8ff` |
| Primary action | `--accent` | `#2962f5` |
| Primary hover | `--accent-dark` | `#1647cb` |
| Reward highlight | `--amber` | `#ffe66d` |

Use Outfit for headings and DM Sans for body text, labels, and controls. Keep the
existing logo assets. App titles are about 28–32px; body copy is 14–16px; metadata
is 12–13px. Check actual contrast on the surface used.

Use white panels, restrained pale blue fills, and quiet 1px borders.
Squircle corners are the system-wide default for new and existing buttons, inputs,
dropdowns, cards, panels, and dialogs. Reuse `client/src/shape-tokens.css`:
`--radius-control` (12px) for controls, `--radius-panel` (20px) for larger containers,
and `--radius-detail` (8px) for small nested details. Use `corner-shape: squircle`
with these radii; browsers without support retain the rounded-square fallback.
Preserve intentional circles (avatars, status dots, badge artwork), thin progress
tracks, and structural flush edges. Do not turn everyday controls into pills.
Do not introduce gradients, glass, glows, ornamental KPI tiles, or heavy shadows.
The interface chrome stays blue and neutral; semantic badges may use their own
documented category palette.

## Layout and controls

- Reuse `DashboardLayout`, `studio-section`, `page-heading`, `btn`, and existing
  authoring forms. Keep page headings, toolbars, and results on the same edges.
- Use 20px catalog gaps and 24px panel gaps. Maintain equal outer gutters.
- Admin navigation ends with My profile, followed by Log out. The top-right
  account link remains available. Keep the learner and guest navigation order.
- Achievement controls include Search, Type, Sort, Status, then Gallery/List/By type. The search icon
  sits inside the input on the left, with reserved text padding.
- Never rely on an unscoped `sr-only` class: use an available helper or an explicit
  accessible name. Decorative icons use `aria-hidden`.
- Gallery uses four columns above 1100px, two from 641–1100px, and one at 640px or
  less. Collection shelves use three desktop columns, two on tablets, one on phones.
- Gallery and List share 12 results per page, a result range, page position, and
  Previous/Next controls. Search/status changes reset the page; view changes keep it.
- Achievement pagination uses 44px square squircle buttons with only left/right
  arrows. Keep accessible Previous page/Next page names, tooltips, disabled states,
  keyboard focus, page position, and result counts across Gallery, List, and By type.
- Board view was intentionally removed. Do not reintroduce it without a new need.
- Keep keyboard focus visible, touch controls at least 44px tall, and disabled text
  readable. Tabs support arrow keys. Provide loading, empty, retry, and error states.
- Motion is brief feedback. Respect reduced-motion preferences. Never hide content
  behind an entrance animation.

## Achievement visual language

Center icon and color family come from the existing `metric`. Tier determines
shape. Admins customize borders, patterns, decorations, and color depth, while
those meanings stay consistent. The entire saved artwork is rendered as SVG, with
one viewBox, rounded line joins, and a consistent icon stroke style.

| Metric | Category | Center icon | Main color |
| --- | --- | --- | --- |
| `completed_lessons` | Learning | Book | `#2962f5` |
| `successful_practices` | Practice | Checklist | `#14716c` |
| `total_xp` | Experience | Lightning | `#8b6513` |
| `streak_days` | Consistency | Flame | `#ab4c19` |
| `perfect_lessons` | Precision | Target | `#254168` |
| `completed_courses` | Courses | Graduation cap | `#307044` |

| Tier | Shape |
| --- | --- |
| Starter | Circle |
| Growing | Shield |
| Advanced | Hexagon |
| Mastery | Ornate seal |

Tier means challenge difficulty, not measured population rarity. Standalone badges
can use any tier. A milestone group is optional, and milestone order only produces
an explicit admin suggestion. Adding a milestone or viewing a badge never changes
stored tiers. Admins may deliberately edit tier as a design decision.

Secret visibility is independent from tier and grouping. Until earned, the learner
API returns only the secret teaser and ID; it omits metric, target, tier, group,
icon, and design. The shared renderer always uses a neutral question mark for a
hidden badge. An admin's artwork preview may show its full design.

### Designer options and persistence

The Details and Designer tabs share one Save action. The learner preview shows
locked/earned states and artwork at small, medium, and large sizes. Undo/redo covers
design and tier changes; Reset restores the default recipe; Shuffle finds an
unused recipe within the current category/tier. Duplicate combinations produce a
warning, not an award restriction.

`achievements.badge_design` stores a versioned recipe, never arbitrary SVG markup:

```json
{"version":1,"border":"double","pattern":"solid","decoration":"none","finish":"classic"}
```

- Border: single, double, dotted, laurel.
- Pattern: solid, rays, stars, diamonds.
- Decoration: none, ribbon, wings, stars.
- Finish: classic, deep (within the category palette).

The 128 recipes per category/tier give 3,072 category/tier/recipe combinations.
Some choices are visually subtle, so this is a combination count, not a claim that
every pair is perceptually distinct. Duplication compares canonical recipes,
category, and tier. Validation rejects unknown versions, options, and extra keys.

`tier` defaults to starter. `milestone_group` is an optional display label, not a
foreign key or a new achievement requirement. `badge_design = null` preserves the
legacy temporary artwork until an admin chooses Start designing. New badges start
with the default SVG recipe. `profile_achievements` remains the award association.
Designer choices do not change eligibility, XP, hearts, or earned progress.

Guest learners receive the same shared SVG rendering through their temporary
catalog and isolated progress. No designer action writes guest data to production.
New conditional/composite challenge rules and earned-by percentages remain future
work; this release uses the existing six threshold metrics.

## Implementation references

- `client/src/data/badge-design.js`: categories, tiers, recipes, shuffle, suggestions.
- `client/src/components/BadgeSvg.jsx`: shared vector artwork.
- `client/src/components/BadgeDesigner.jsx`: admin controls and design history.
- `client/src/components/Achievements.jsx`: legacy fallback and collection rendering.
- `client/src/components/Achievements.css`: achievement layouts and studio styling.
- `server/src/badgeDesign.ts`: API validation and compatible legacy icon mapping.
- `server/src/db/schema/app.ts`: database fields and constraints.

Before shipping a new visual pattern, check desktop, tablet, and phone layouts,
keyboard use, long names, empty data, errors, and secret previews. Run client build
and lint, relevant tests, and browser inspection when available. Report any visual
check that could not run instead of treating a successful build as visual proof.

## Catalog and visual editor refinements — 27 November 2026

The By type view groups badges under Learning, Practice, Experience, Consistency,
Precision, and Courses. Each nonempty group has its own count and 12-badge
pagination. Search, type/status/visibility filters, and name/target/tier sorting
apply before grouping. Filter or sort changes reset grouped pages. Gallery/List
keep their shared page when switching between those two views.

Details and Designer share a top-aligned preview beside the form above 768px; the
preview remains sticky on desktop and stacks below the form on smaller screens.
Tier shapes, borders, patterns, decorations, and color depth are chosen using
clickable SVG samples with text labels, keyboard focus, and a selected state. Each
sample uses the current category and the other current design choices.

Only Classic and Deep are offered. Legacy Soft recipes display as Classic and are
normalized to Classic when saved through the updated API. Existing database
constraints continue accepting Soft for backward compatibility; no destructive
backfill or schema migration is needed for this refinement.

Required field labels use a red asterisk beside the label, with an accessible
Required name and native required attributes where applicable. Do not add a
required-field explanation note. Optional labels stay as text.
Hints are optional and milestone group is
required only for a milestone series. Validation shows a red border and a specific
message below each invalid field, preserves entered values, opens the appropriate
editor tab, and focuses the first invalid field after Save. Correcting a field
clears its error. API validation returns a field-error map for the same treatment.
Connection failures remain general alerts. Earned requirement locks, secret
masking, tier semantics, and isolated guest-session behavior remain in force.
