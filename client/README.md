# ASignX

An ASL learning and communication prototype built with React and Vite.

## Run locally

From `client`:

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173.

```sh
npm run build   # Production output in dist/
npm run lint   # Static checks
npm test       # Route rendering and browser-storage logic checks
```

## What works

- Responsive home, story, learning dashboard, course browser, lessons, progress, profile, and account screens.
- Course search and availability filters.
- Three written sign introductions, each with a knowledge check.
- Completed introductions and XP saved in localStorage; repeated completions do not award duplicate XP.
- Editable local profile and daily learning intention.
- Local camera preview with permission-error handling and stream cleanup.
- Scripted conversation samples and session clearing.
- Login and registration field validation, including password visibility controls.

## Prototype boundaries

Recognition is a scripted demonstration, not a machine-learning model. Account forms do not authenticate, create accounts, or send passwords. Profile and progress are local to the current browser. Planned course counts describe the intended curriculum; each available course currently contains one written introduction. Instructor video and signing feedback are not connected.

## Main files

- `src/App.jsx`: navigation, footer, routes.
- `src/Studio.jsx`: home, dashboard, course browser, story, and missing-page views.
- `src/components/StudioKit.jsx`: shared buttons, brand, and vector artwork.
- `src/pages/`: lesson, live camera, progress, profile, and account views.
- `src/data/learning.js`: introduction content and progress persistence.
- `src/studio.css`: visual system and responsive layouts.
- `scripts/smoke.mjs`: route rendering and storage checks.

The interface uses Outfit headings, DM Sans body text, cobalt (#2962F5), ink (#18294C), pale sky (#EDF3FF), white (#FFFFFF), and yellow (#FFE66D). Google Fonts are optional network resources with sans-serif fallbacks.

For production hosting, configure an SPA fallback to index.html so deep links resolve.

## Shared layout

Public pages retain centered containers capped at 1,180px, with comfortable
responsive gutters. Dashboard workspaces use the available width with 32px
desktop gutters, 12px up to 1,200px, and 8px up to 650px. Compact dashboard
headers follow those smaller gutters. Authentication forms and reading areas
retain their own maximum widths; narrow gutters are not a site-wide rule.

Shared refinements in `src/design.css` keep headings and actions aligned, body
copy readable, panel spacing consistent, and text buttons free of browser-default
decoration. Controls retain visible focus and comfortable touch targets; compact
toolbars wrap, and reduced-motion preferences suppress decorative transitions.
Public content, forms, and dashboard workspaces intentionally use different widths.

Lesson presentation is scoped in `src/lesson.css`: sample and account lessons
share a bounded study canvas and Study/Check/Complete stage indicator. Wide
layouts pair demonstrations with readable instructions; compact screens stack
them. Sample and account lesson routes use a focused workspace without the
dashboard sidebar; the header and Back to course navigation remain available.
Other dashboard screens retain their sidebar. This presentation does not merge
guest sample progress with account grades, change grading, or change video playback.
Account knowledge checks use prominent prompts, lettered radio-answer rows,
selected-state indicators, inline saved-answer feedback, and a separated footer
with Review guidance and one primary check/next/complete action. Native radio
keyboard behavior and visible focus remain available. Success feedback reflects
the server's saved correct result, not selection alone.
Course lesson lists use full-row links with Start/Continue/Review actions,
hover/focus feedback, and icon-plus-text Not started/In progress/Completed states.
Status comes from existing started/completed records, without invented percentages.
Lesson rows use a thin bottom progress bar based on saved correct-question
counts. Rows stay white; status text/icons and the bar convey progress.
No-question lessons remain unfilled until complete; repeated attempts count once.
