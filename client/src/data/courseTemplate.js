export const lessonsTemplate = `Lesson: Your first lesson
XP: 10
Content: |
  Write the reviewed lesson material here.
  Indent every line of a multiline block with two spaces.

Question: choice | Which answer matches the lesson?
* The correct answer
- A different answer
- Another answer

Question: boolean | This statement matches the lesson.
Answer: true

Lesson: Camera practice
XP: 20
Signs: A
Content: |
  Review the sign A in the lesson video, then practise it.

Question: recognition | Show the sign A.
Target: A
`
export const courseTemplate = `Course: Your course title
Description: |
  Describe what learners will practise in this course.

${lessonsTemplate}`
