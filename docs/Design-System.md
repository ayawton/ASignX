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

Use white panels, restrained pale blue fills, quiet 1px borders, and 8–10px corners
on controls and catalog cards. Existing larger panels can keep their 12px radius.
Do not introduce gradients, glass, glows, ornamental KPI tiles, or heavy shadows.
The interface chrome stays blue and neutral; semantic badges may use their own
documented category palette.

## Layout and controls

- Reuse `DashboardLayout`, `studio-section`, `page-heading`, `btn`, and existing
  authoring forms. Keep page headings, toolbars, and results on the same edges.
- Use 20px catalog gaps and 24px panel gaps. Maintain equal outer gutters.
- Admin navigation ends with My profile, followed by Log out. The top-right
  account link remains available. Keep the learner and guest navigation order.
- Achievement toolbar order is Search, Status, then Gallery/List. The search icon
  sits inside the input on the left, with reserved text padding.
- Never rely on an unscoped `sr-only` class: use an available helper or an explicit
  accessible name. Decorative icons use `aria-hidden`.
- Gallery uses four columns above 1100px, two from 641–1100px, and one at 640px or
  less. Collection shelves use three desktop columns, two on tablets, one on phones.
- Gallery and List share 12 results per page, a result range, page position, and
  Previous/Next controls. Search/status changes reset the page; view changes keep it.
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
- Finish: classic, soft, deep (within the category palette).

The 192 recipes per category/tier give 4,608 category/tier/recipe combinations.
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
