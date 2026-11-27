# ASignX project guidance

For interface work, read [docs/Design-System.md](docs/Design-System.md) before editing.
It records the approved website and badge design choices. Reuse the existing tokens,
dashboard shell, shared components, and SVG badge renderer. Update that guide when
the user approves a new shared design rule.

Keep database migrations additive where possible and maintain the schema sources,
data dictionary, and relevant tests alongside database changes. Existing learner
awards and isolated guest-session behavior must be preserved.
