# ASignX system architecture

These diagrams reflect the implementation reviewed on 5 November 2026. The overview presents the main components and connections. The detailed version expands browser behavior, API responsibilities, recognition processing and Supabase services.

| Version | SVG | PNG | Editable source |
|---|---|---|---|
| Overview | [View](System-Architecture.svg) | [Image](System-Architecture.png) | [PlantUML](System-Architecture.puml) |
| Detailed | [View](System-Architecture-Detailed.svg) | [Image](System-Architecture-Detailed.png) | [PlantUML](System-Architecture-Detailed.puml) |

## Main components

- The React/Vite browser application provides public pages, ASignLive, course learning, profiles/progress and administrator authoring. The camera stream produces resized JPEG frames and keeps one active request plus the newest waiting frame. Live text composition runs in the browser with backend word/sentence assistance. Sign Strike currently uses simulated or keyboard game input.
- The Node.js/Express/TypeScript API validates requests, verifies Supabase identity on protected routes and enforces current database roles and ownership. Its modules handle enrollments, lesson runs, automatic grading, shared hearts, XP awards, progress, course/sign authoring and structured text imports.
- The private Python/FastAPI process receives session/frame and NLP requests from Express using an internal service key. MediaPipe extracts hand landmarks. Static and sequence ONNX models produce predictions, with confidence and temporal stabilization. SymSpell supplies word matching and sentence segmentation.
- Supabase Auth manages accounts, email confirmation, recovery and access tokens. PostgreSQL stores 23 application tables with RLS, constraints and grading/validation triggers. The confirmed-identity trigger creates the application profile.
- Supabase Storage holds curated sign MP4 demonstrations in the private learning-media bucket. The browser performs policy-checked admin uploads and obtains signed playback URLs. The API validates stored object metadata and attaches the object path to a sign.
- Recognition models are loaded from local files under `server/private/models`. They include ONNX classifiers, metadata JSON and the MediaPipe hand-landmarker task.

## Important flows

1. Account operations connect the browser's Supabase client to Auth. Protected API requests carry an access token, which Express verifies with Supabase before applying application permissions.
2. Content and learning requests pass through Express to PostgreSQL using the Postgres.js connection pool and the Drizzle-defined schema. Learning outcomes and imported course structures use transactions. Shared learner-row locks coordinate hearts and rewards across requests.
3. Camera sessions send JPEG frames through Express to the private Python process. Recognition responses travel back through Express. Lesson camera sessions bind the learner, run, exercise and expected sign before saving trusted evidence and grades.
4. Live letter groups and provisional sentence text go through Express to the private SymSpell endpoints. Returned assistance feeds browser text composition.
5. Sign videos use the direct browser-to-Storage path. Upload attachment still requires backend validation and sign metadata persistence.

## Persistence and current scope

Lesson runs, exercise attempts, milestones, XP awards and heart-practice records persist in PostgreSQL. XP totals are derived from the award ledger. Camera frames and inference sessions use memory. ASignLive's current text history stays in browser memory. Sign Strike's local best scores use browser storage.

The schema also supports standalone practice, saved recognition history and achievement records. These structures are included in the class/data diagrams. Their current application coverage is described in [UML diagram notes](UML-Diagram-Notes.md). The architecture represents implemented browser and API paths.

This is a logical component/process architecture with the verified local development connections. Vite uses port 5173 and proxies `/api` and `/health` to Express on port 3000. The recognition launcher binds to `127.0.0.1:8001`, with Express using the configured private recognition URL. Production hosting and scaling depend on deployment configuration.

## Source references

- [Browser routes](../../client/src/App.jsx), [authentication](../../client/src/auth.jsx), [Vite configuration](../../client/vite.config.js)
- [Frame transport](../../client/src/recognition/frameStream.js), [Live screen](../../client/src/pages/Live.jsx), [Arcade screen](../../client/src/pages/Arcade.jsx)
- [Signed video playback](../../client/src/components/SignVideo.jsx), [video upload](../../client/src/components/SignVideoUpload.jsx)
- [Personal API](../../server/src/personal.ts), [gamification](../../server/src/gamification.ts), [admin API](../../server/src/admin.ts), [text import](../../server/src/courseImportRoutes.ts)
- [Public recognition gateway](../../server/src/recognition.ts), [lesson recognition](../../server/src/lessonRecognition.ts), [private transport](../../server/src/recognitionTransport.ts)
- [Python service](../../server/recognition/service.py), [recognition engine](../../server/recognition/engine.py), [launcher](../../server/recognition/run.py)
- [Database connection](../../server/src/db/index.ts), [schema](../../server/src/db/schema/app.ts), [table inventory](../../server/src/db/tables.ts)

## Rendering and verification

Editable PlantUML sources and SVG/PNG previews share the same component and communication model. The previews use a curated portrait layout, so rendering the PlantUML may place elements differently. SVGs remain editable vector graphics. Both PlantUML sources passed syntax checks. The SVGs passed XML parsing and their PNG previews were visually reviewed. Verification covers component placement, boundaries, flow direction and source alignment.
