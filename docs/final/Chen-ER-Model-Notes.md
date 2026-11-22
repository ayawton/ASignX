# ASignX Chen Entity Relationship Model

The model maps the current relational schema into Chen shapes. All 23 application tables are entities, including junction and activity records; auth.users is shown only as an external identity with its referenced key. This physical-schema-oriented Chen view retains foreign-key attributes for traceability rather than collapsing junction tables into conceptual many-to-many diamonds.

Rectangles are entities, ovals are attributes and diamonds are named FK relationships. Underlined attributes form the primary key, jointly when more than one is underlined. Endpoint labels express minimum and maximum participation permitted by FK nullability and unconditional uniqueness. Conditional uniqueness and trigger checks remain in Data-Dictionary.md. Diamond names identify the child FK role; two attributes in one composite FK remain one relationship.

Generated from ER-Schema.mmd, the current source-based schema snapshot. This is not live Supabase introspection. The full diagram is intentionally large; use the SVG for readable zoom.

- [PNG image](Chen-ER-Model.png)
- [Zoomable SVG](Chen-ER-Model.svg)
- [Editable Graphviz source](Chen-ER-Model.dot)

The current PNG and SVG use the reference-inspired green entities, pink attributes, blue diamonds and red cardinalities. Chen-ER-Model-Layout.mjs is the authoritative image layout generator, run from the repository root. The DOT file preserves an alternative automatic layout.

The enlarged layout uses staggered entity positions, varied attribute spacing, darker connectors, obstacle-aware right-angle routes and white separation at crossings. PNG export is 8800 by 10000 pixels. Routing discourages overlapping connector segments.
