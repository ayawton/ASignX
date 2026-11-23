export const capRepeatedLetters = text => text.replace(/([a-z])\1{2,}/gi, '$1$1')

const handshapeGroups = ['aemnst', 'kruv', 'dgxz']

export function weightedDistance(source, target) {
 const rows = Array.from({ length: source.length + 1 }, (_, i) => [i])
 rows[0] = Array.from({ length: target.length + 1 }, (_, i) => i)
 for (let i = 1; i <= source.length; i++) {
  for (let j = 1; j <= target.length; j++) {
   const a = source[i - 1], b = target[j - 1]
   const substitution = a === b ? 0 : handshapeGroups.some(group => group.includes(a) && group.includes(b)) ? .2 : 1
   rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + substitution)
   if (i > 1 && j > 1 && a === target[j - 2] && b === source[i - 2]) {
    rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
   }
  }
 }
 return rows[source.length][target.length]
}
