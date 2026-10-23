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
