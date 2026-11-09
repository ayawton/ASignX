# ASignX UML diagrams

These diagrams describe the source reviewed on 5 November 2026. Each has an editable PlantUML source, an SVG for zooming and a PNG for documents.

## Files

| Diagram | SVG | PNG | Editable source |
|---|---|---|---|
| System architecture overview | [View](System-Architecture.svg) | [Image](System-Architecture.png) | [PlantUML](System-Architecture.puml) |
| Detailed system architecture | [View](System-Architecture-Detailed.svg) | [Image](System-Architecture-Detailed.png) | [PlantUML](System-Architecture-Detailed.puml) |
| Core domain class overview | [View](Class-Diagram.svg) | [Image](Class-Diagram.png) | [PlantUML](Class-Diagram.puml) |
| Complete domain class detail | [View](Class-Diagram-Detailed.svg) | [Image](Class-Diagram-Detailed.png) | [PlantUML](Class-Diagram-Detailed.puml) |
| Use case diagram | [View](Use-Case-Diagram.svg) | [Image](Use-Case-Diagram.png) | [PlantUML](Use-Case-Diagram.puml) |

The overview has 13 core domain classes. The detailed class diagram covers all 23 application record types and the external Supabase Auth identity, with 41 foreign-key associations. The use case diagram contains 23 use cases grouped by public access, learning workspace and administration.

## Class model

Classes represent logical domain records with selected attributes. Their names follow the existing schema and exported data types. ASignX's TypeScript backend implements business behavior primarily in functions and Express routers, so the record classes show attributes and associations. `Profile.role` expresses the learner/admin distinction.

In the overview, the many-to-many Lesson–Sign relationship summarizes the LessonSign association record. The detailed version shows that record explicitly, along with progress, run questions, heart-practice questions/submissions and other linking records. Attributes with a leading slash are derived values, such as run XP from the award ledger and a practice round's correct count. A question can have zero options when its type is recognition. The target sign and model evidence supply that answer's grading inputs.

Gray records in the detailed diagram identify schema support for standalone practice, saved recognition history and achievements. The database has these structures and validation rules. The current UI reads stored achievement awards, while the reviewed lesson flow does not automatically grant those awards. Live session text currently stays in browser memory. Those record types therefore do not establish complete user-facing persistence workflows.

## Use case model

Visitor means the public-access role used by a guest or a signed-in person. Learner and Administrator describe the confirmed account roles within their workspaces. The administrator also accesses personal profile management. The system boundary covers ASignX's web UI, API and private recognition service.

The diagram groups related course-presentation and lifecycle actions to keep the overview readable. Authentication is a precondition for workspace goals. An include dependency makes text validation and preview part of the normal import UI workflow. The save endpoint also validates independently. A camera answer extends graded exercise answering when the question uses recognition.

The learner flow includes shared hearts, graded lesson runs, progress review and practice-based heart restoration. The current balance is three hearts, with one regenerated every five minutes. Three correct familiar practice answers restore a heart. XP is recorded through awards when a run is finalized, with first-time recovery and reduced post-perfect replay rewards.

ASignLive recognizes supported letters and provides word/sentence assistance. Sign Strike is labeled as a demo because its current game input is simulated or keyboard-driven. The imports create editable drafts, followed by the existing publishing workflow.

## Source references

| Coverage | Current source |
|---|---|
| Domain attributes, relationships and roles | [Drizzle schema](../../server/src/db/schema/app.ts), [table inventory](../../server/src/db/tables.ts) |
| Public routes and role-specific workspaces | [App routes](../../client/src/App.jsx), [workspace guard](../../client/src/components/DashboardLayout.jsx) |
| Enrollment, materials, progress and profiles | [Personal API](../../server/src/personal.ts) |
| Hearts, runs, grading and XP | [Gamification](../../server/src/gamification.ts), [lesson recognition](../../server/src/lessonRecognition.ts) |
| Admin authoring, publication and imports | [Admin API](../../server/src/admin.ts), [import API](../../server/src/courseImportRoutes.ts) |
| Live recognition and arcade status | [Live page](../../client/src/pages/Live.jsx), [recognition gateway](../../server/src/recognition.ts), [Arcade page](../../client/src/pages/Arcade.jsx) |

## Rendering and validation

The SVG and PNG previews were rendered locally from the same class/association and use-case definitions and visually reviewed. Their layouts are curated separately from PlantUML's automatic layout. Re-rendering a `.puml` file can therefore change placement while preserving its model. The SVGs can also be edited as vector graphics.

The diagrams were checked against the source inventory and route behavior. This documents the current implementation structure and does not constitute a new browser-flow or recognition-accuracy test. The current architecture diagrams and source mappings are documented in [system architecture notes](System-Architecture-Notes.md).

All three editable sources passed the official PlantUML syntax check. All SVG files passed XML parsing, and their PNG previews were visually reviewed.
