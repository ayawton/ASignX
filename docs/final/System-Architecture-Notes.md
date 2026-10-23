# ASignX system architecture

Editable PlantUML: [System-Architecture.puml](System-Architecture.puml).

The main diagram now uses a simplified portrait layout for paper and manual redrawing. Draw five boxes in one vertical column: Users, Presentation, Application, Recognition, and Data/Platform. Vertical order groups the architecture; it does not mean all requests pass through recognition. Follow the labeled arrows. Training workflows, individual tables, and long notes are omitted for readability. The expanded original is preserved as [System-Architecture-Detailed.puml](System-Architecture-Detailed.puml).

This diagram synthesizes the accessible ASignX-related chats and the current project files. Some ChatGPT responses were exposed only as content-reference placeholders, so their full contents could not be reviewed. It does not claim to include inaccessible or undiscovered chat history.

References reviewed: ASignX; Create AI Model; ASL Dataset Search; Set up the backend; Create ER schema and data dictionary; Set up PERN project; Rebuild website from scratch; Modernize ASignX frontend; Transfer old UI to ASignX; Migrate UI Rename Labels; Check whether to start the system. Current local references include docs/final/ER-Schema.md, docs/final/Data-Dictionary.md, docs/Sign-Strike-UI.md, frontend components, and backend source/package definitions.

The latest simplified 16-table proposal takes precedence over the earlier expanded database proposal. The temporary departments/subjects schema is setup practice, not the intended application data model.

Browser-side landmark extraction and a separate inference service are proposed design choices, not confirmed implementation decisions. The recognition framework, model architecture, inference transport, hosting provider for the web/API/model services, and supported sign vocabulary remain unselected. Movement recognition requires sequence-aware processing; no particular trained model or accuracy is claimed.

Supabase Auth and Storage follow the proposed database documentation. Application data flows through Express and Drizzle. The backend must enforce roles, ownership, quiz grading, and reward validation; the diagram does not imply these controls already exist. Offline model publication and metadata registration require controlled operational access.

The PlantUML uses standard standalone elements and no remote includes. A local PlantUML renderer was unavailable, so image rendering has not been verified.
