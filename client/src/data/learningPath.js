export function coursePath(lessons, currentId) {
 const completed = lessons.filter(lesson => lesson.completed_at).length
 const unfinished = lessons.filter(lesson => !lesson.completed_at)
 const currentIndex = lessons.findIndex(lesson => lesson.id === currentId)
 const next = lessons.slice(currentIndex + 1).find(lesson => !lesson.completed_at && lesson.id !== currentId)
  || unfinished.find(lesson => lesson.id !== currentId)
 return { completed, total: lessons.length, target: unfinished[0] || lessons[0] || null, next: next || null }
}
export function firstUnsolved(exercises) {
 const index = exercises.findIndex(exercise => !exercise.solved)
 return index < 0 ? 0 : index
}
