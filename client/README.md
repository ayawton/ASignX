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

## Public learning preview

Public /learn and /learn/courses feature one complete sample introduction, followed by published course descriptions. Visitors can finish its knowledge check without registering. Completion invites account creation to continue into full courses; enrollment, saved answers, progress and XP require an account. Sample completion remains browser-local and does not transfer into an account record. The current sample uses written guidance, not instructor video. Signed-in learning pages retain their existing workspace.

Signed-in ASign Learn and its course browser use published courses from the API, not placeholder courses or browser-local sample progress. Saved enrollments determine Open course versus Enroll in course actions. Empty catalogs explain that courses will appear when published. Public sample lessons remain available separately.

## Course graphics and creation

Manage courses opens a dedicated new-course form from its header action. Draft details and graphics share the new/edit form, with a live course-card preview. Graphics support centered text or a repeating text pattern, four fixed accessible palettes, and up to 32 characters; empty text falls back to the course title. The shared CourseCover component renders both admin previews and published catalog covers. Course details and graphics can be edited in every status; published or used lesson content remains protected. Draft copies preserve cover settings.

CourseCard shares cover, title, description and action spacing between published courses, the admin list and the editor preview. Layout thumbnails and labeled palette swatches use native radio groups with visible focus. SVG pattern tiles repeat without per-cell clipping; cover typography scales with its container. The preview stacks below the form on compact screens.

Cover patterns use large, tightly spaced text at one consistent size and angle, with staggered row offsets and seamless edge wrapping. Center text has no background panel or letter outline. All cover layouts use text without outlines. Previews and course cards share the same arrangement.


Course graphics offer Outfit, DM Sans, Georgia, system monospace and Cabin Sketch (chalk-like), plus regular (400), semibold (600) and bold (700). Native radio choices preview the selected family/weight; title and pattern share them. Existing courses default to Outfit semibold.

Pattern density uses a native keyboard-accessible range control (1–5) to zoom the whole pattern: fewer words enlarges it, more words zooms out. Word spacing stays tightly packed in proportion to the text, and the selected angle stays fixed. The slider appears for pattern layouts only; its value is saved with the course.

Pattern angle uses a native range control from -45 to 45 degrees (default -18); all words rotate together. The angle and density controls appear only for patterned covers.

Course graphics also offer Corner title (faint oversized text backdrop), Framed text and Split panel. Soft mint, lavender, peach, aqua and sand join the original palettes. Shared coverOptions defines layout names and background/foreground pairs for both visual controls and rendered cards; pattern controls remain specific to the pattern layout.

Randomize graphic selects from supported layouts, palettes, fonts, weights and pattern settings without changing course or graphic text. It updates local form state and the preview; Save draft/Save changes persists the result. It is available for course presentation edits in every status.


Graphic font size is saved as a relative 60–180% scale (default 100%). Its keyboard-accessible slider changes the main graphic title, not pattern zoom. Relative sizing follows card width in previews and catalog cards. Randomization includes title size.

Overview My courses uses the shared course graphic as a 56px square thumbnail beside the title. A 360px square cover canvas is uniformly scaled to fill the thumbnail edge to edge, using saved type, layout, color and pattern settings.

Enrolled course pages show a responsive wide banner from the shared CourseCover above the title and lesson list, using saved graphic settings.

Manage courses groups drafts and published courses under Current courses and places archived courses in a separate collection below, with counts and existing editing/lifecycle actions preserved.


Admin status indicators use quiet backgrounds and a visible icon legend. The graphic editor orders layout, palette, typography and contextual pattern controls; Randomize graphic supports one-step Undo without overwriting course text. A sticky form footer keeps Cancel and Save available, with Save on the right. Learner preview explicitly identifies inactive controls and uses a disabled sample action.

## Retrieval performance

Learner overview loads resources and per-section errors from one authenticated GET /api/me/dashboard instead of four separate requests. The workspace shell retains its profile/role check. Enrollment writes still update the displayed list after the server confirms success. No private response cache is introduced.

Overview My courses includes a compact progress bar and completed/total published lesson count for each enrollment. Courses without published lessons show an explicit empty state rather than a percentage. Enrollment refreshes the list after successful creation.

Overview course rows prioritize saved progress instead of enrollment dates. Actions read Start, Continue (any started/completed lesson), or Review (all published lessons complete), linking to the course path. Completed courses show Completed text and a muted green bar; zero-lesson courses do not count as complete. Archived entries retain the Unavailable state.

## Lesson answer types

Admin lesson questions support Single choice, True / false, and Sign with camera. The type selector configures the relevant controls; Answers are locked within a run; completed lessons can start a separate run. Typed answers are no longer supported. Existing questions default to Single choice.

Camera targets must be published signs linked to the lesson and supported by the running recognition service. Start that service before authoring camera questions; refresh the editor after starting it. Learners explicitly start camera practice. The shared frame stream bounds inference to one active request plus the latest pending frame, and camera tracks stop on navigation, stop, or success. Only a server-saved correct model result finishes a camera question. Camera access needs HTTPS or localhost. Service/permission failures do not pass the question. Saved detected labels and confidence appear in review. This is practice feedback for supported isolated signs, not a general proficiency assessment.

Signed-in ASign Learn and the course browser separate published courses into My courses and Available courses using saved enrollment IDs. Search filters both collections; successful enrollment moves the course into My courses. Guest visitors retain a single published-course catalog.
Camera answers reserve a 4:3 preview panel in camera-off, connecting, active and saved states. A target heading, icon-and-text status, inline detection/error feedback, primary Start and secondary Stop controls guide practice. Saved success appears only after the backend result. Frame privacy stays visible; longer model limitations live in expandable help. Camera tracks stop on navigation, success and explicit stop, including when a device ends access.

## Hearts and lesson runs

Learners share three hearts across graded lessons. The workspace header displays the server balance and a regeneration countdown; one heart regenerates every five minutes, including offline, up to three. Choice/true-false selection is checked immediately, then advances after 1.4 seconds of feedback. One wrong graded choice costs one heart. Zero hearts pauses before the next question and blocks new/replay runs; material, saved review and heart practice remain accessible. Camera mismatches and technical failures are heart-free; camera progression still needs a heart available.

Each run answers every question once (camera practice retries until recognized). Reaching the end completes the lesson even with wrong choices; one fully correct run perfects it. XP weights are choice 30%, true/false 20%, recognition 50%, redistributed across present types and divided evenly within a type. Whole-XP rounding preserves the lesson total. Before perfection only previously unearned correct-question XP is awarded, on run completion. A perfect run unlocks later replays at floor(25% of that replay's correctly answered weighted XP). Existing completed lessons retain their XP and are treated as perfected. Material-only lessons award their initial XP once without repeat XP.

Heart practice uses previously encountered published choice questions. Three correct answers restore one heart, capped at three; wrong answers have no penalty and the round grants no XP or lesson progress. Completed rounds cannot award twice. The paused lesson can be resumed after practice or timed regeneration.

XP and heart-practice API shapes remain stable after normalization: run XP and practice correct counts are derived from related rows. Admin camera questions save an empty options array; the target sign defines the expected answer.

Lesson choice submissions immediately show Checking your answer while awaiting the saved server result. Correct/incorrect feedback appears when that response arrives; the existing 1.4-second reading pause applies afterward. Database work for verification is consolidated without optimistic correctness or XP updates.

Workspace access: verified learners are redirected from every /dashboard/admin route to their overview before the admin outlet renders, including retained login destinations. Role resolution is scoped to the authenticated profile ID, and protected page state remounts when the account ID changes. Sidebar visibility alone does not grant access; backend admin endpoints independently verify the current database role.
