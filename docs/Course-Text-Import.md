# Course and lesson text imports

Admins can paste structured text or choose a UTF-8 `.txt` file. Use **Manage courses → Import from text** to create a course, or **Import lessons from text** inside a draft course to append lessons. Preview is required in the UI before saving; changing text clears that preview. All saved content remains unpublished and editable through the existing course editor. Edit the course graphic there after importing.

## Format

```text
Course: Alphabet foundations
Description: |
  An introduction to the ASL alphabet.

Lesson: Getting started
XP: 10
Signs: A
Content: |
  Add your reviewed written material here.
  Continue with two-space indentation.

Question: choice | Which answer matches the material?
* The correct answer
- A different answer

Question: boolean | This statement matches the material.
Answer: true

Question: recognition | Show the sign A.
Target: A
```

For imports into an existing course, omit `Course:` and `Description:` and begin with `Lesson:`. Lessons append after the greatest existing lesson position; existing content is not replaced. Published or archived courses must first be copied into a draft.

- Field names and question types are case-insensitive. Titles, prompts and content retain their text.
- `Course:` is required for a new course. `Description:` is optional and may use a multiline block.
- Repeat `Lesson:` in the desired course order. Lesson titles and `Content:` are required. `XP:` defaults to 10; it must be a whole number from 0 to 2147483647.
- Put `XP:`, `Signs:` and `Content:` before that lesson's first `Question:`.
- `Content: Plain text` supplies one line. For multiple lines use `Content: |` and indent each nonempty following line with two spaces or a tab. Blank lines are preserved within the block. Description blocks work the same way. Template fields outside the block must not be indented.
- `Question: choice | prompt` has 2–6 options. Begin exactly one correct option with `* ` and other options with `- `.
- `Question: boolean | prompt` needs `Answer: true` or `Answer: false`; the importer creates the True and False options.
- `Question: recognition | prompt` needs `Target: label`. No choices are created. The published target sign is automatically linked to its lesson.
- `Signs:` optionally links existing published signs using comma-separated labels. Exact matches take priority; otherwise one case-insensitive match is accepted. Ambiguous or missing labels fail validation. Labels containing commas cannot be listed through `Signs:`; use the manual editor for those links.
- The recognition service must be running for imports containing camera questions. It must support each target's canonical sign label. Capabilities and publication are checked during preview and again during saving.
- A lesson can omit questions and contain material only. The importer does not invent learning content, signs or demonstration videos.
- Empty lines and lines beginning with `#` outside multiline blocks are ignored. Unknown fields, unsupported types, duplicate singleton fields and invalid answer sets produce line-numbered errors.
- Windows CRLF line endings and an initial UTF-8 BOM are accepted. Text is rendered as plain text, never executed or interpreted as HTML.

## Limits and storage

At most 100,000 UTF-8 bytes per text import, 25 lessons per import, 10 questions per lesson and 50 distinct linked signs per lesson (including camera targets). Existing authoring limits also apply: titles 150 characters, course description 5,000, lesson content 6,000, prompts 1,000 and option text 500. The admin JSON request limit is 256 KB to accommodate text escaping.

The importer uses existing courses, lessons, lesson_signs, exercises and exercise_options tables. There is no migration and no original-file storage. Child rows are inserted in batches rather than one network call per option. Manual authoring shares the same lesson validator and child-row writer.

## Validation, retries and transactions

Preview validates text and references without creating records. Save reparses and revalidates server-side, independently of the preview. The entire course or appended lesson collection is saved in one transaction. A failure rolls back all imported records.

The UI retains a UUID import request ID while retrying unchanged text. The new course ID and deterministic lesson IDs prevent duplicate inserts for that request. Retrying an already-saved request returns 409 with guidance to check the existing course. It does not silently import a second copy or claim an old request contains newly edited text. Changing text creates a new request on the next save; check the course first if an earlier save's response was interrupted.

All import endpoints run behind authenticated admin-role middleware and return private, uncached responses:

- `POST /api/admin/courses/import/preview`: `{text}` → parsed course preview.
- `POST /api/admin/courses/import`: `{text, import_id}` → `{id, lesson_count}`.
- `POST /api/admin/courses/:id/import/preview`: `{text}` → preview of appended lessons.
- `POST /api/admin/courses/:id/import`: `{text, import_id}` → `{id, lesson_count}`.

Parse/reference errors return 400, unavailable recognition returns 503, and locked courses or duplicate imports return 409. The existing publishing workflow remains the final step to expose content to learners.

## Verification

Parser and disposable-database tests cover all answer types, template compatibility, line errors, size/count limits, admin isolation, preview without writes, draft creation, ordered appends, locked/archived courses, missing signs, changed recognition capabilities, duplicate requests and rollback after an insert failure.

From `server/`, run `npm run build` and `node scripts/check-course-import.mjs` with DATABASE_URL configured to exercise the actual PostgreSQL driver using transaction fixtures that always roll back. This verifies handler persistence and publication constraints, not browser interaction or live-camera accuracy.
