# ASignX System Workflow

[PNG image](System-Workflow.png) · [Editable SVG](System-Workflow.svg)

1. **Login:** Register, verify email and sign in. The application applies learner or administrator permissions. Public preview and Live access can bypass login.
2. **Input:** Learners select lessons, submit choice or true/false answers, or perform signs for camera recognition. Administrators author course content.
3. **Process:** The API validates identity, ownership and input. Responses are graded; the recognition service processes camera input. Learning activity, heart changes and XP awards persist where applicable.
4. **Output:** The interface presents answer feedback, recognized text, hearts, XP and progress. Learners return to lessons for continued practice.

This is a high-level presentation workflow, following the supplied four-stage visual reference. It summarizes the implementation documented in System-Architecture-Notes.md; it is not a detailed decision flowchart or a claim of new runtime verification. Current Live text history remains in browser memory.
