export function loadProgress() {
  try { const value = JSON.parse(localStorage.getItem('asignx-guest-practice') || '[]'); return Array.isArray(value) ? [...new Set(value.filter(id => [1, 2, 3].includes(id)))] : [] } catch { return [] }
}
export function completeLesson(id) {
  const done = loadProgress()
  try { localStorage.setItem('asignx-guest-practice', JSON.stringify([...new Set([...done, id])])) } catch { /* Storage may be disabled. The current lesson still completes. */ }
}
export const lessons = {
  1: { title: 'Meet the letter A', course: 'The ASL alphabet', focus: 'Letter A', tip: 'Make a closed fist. Keep your thumb resting along the side of your hand, rather than across your fingers.', question: 'Where should your thumb rest for the letter A?', options: ['Across the front of your fingers', 'Along the side of your closed fist', 'Pointing straight up'] },
  2: { title: 'A friendly hello', course: 'Hello, nice to meet you', focus: 'Hello', tip: 'Begin with a flat hand near your forehead, palm facing outward. Move your hand away in a small salute.', question: 'Where does the sign for hello begin?', options: ['Near your forehead', 'At your chest', 'At your shoulder'] },
  3: { title: 'A little thank you', course: 'Everyday essentials', focus: 'Thank you', tip: 'With an open, flat hand, touch your fingertips to your chin, then move your hand forward.', question: 'Where does the sign for thank you begin?', options: ['At your shoulder', 'At your forehead', 'At your chin'] },
}

