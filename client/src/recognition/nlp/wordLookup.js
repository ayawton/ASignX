import { capRepeatedLetters, weightedDistance } from './spellingEdits.js'

export function createWordLookup(dictionary) {
 const counts = new Map()
 for (const line of dictionary.split(/\r?\n/)) {
  const [word, count] = line.split(' ')
  if (/^[a-z]+(?:'[a-z]+)*$/.test(word) && Number(count) > 0) counts.set(word, Number(count))
 }
 if (!counts.size) throw new Error('English dictionary is empty')
 return (original, previous = []) => {
  const word = capRepeatedLetters(original.toLowerCase())
  const suggestions = []
  // Test suffixes of the open sentence, including pauses after single letters.
  let joined = word
  const looksLikeFragment = part => (counts.get(part) ?? 0) < 1_000_000 || /^[b-hj-z]$/.test(part)
  let hasFragment = looksLikeFragment(word)
  let repair
  if (/^[a-z]+$/.test(word)) {
   for (let i = previous.length - 1; i >= 0; i--) {
    const group = previous[i]
    const part = capRepeatedLetters(group.detected.toLowerCase())
    if (!/^[a-z]+$/.test(part)) break
    joined = capRepeatedLetters(part + joined)
    if (joined.length > 32) break
    hasFragment ||= looksLikeFragment(part)
    const joinedCount = counts.get(joined) ?? 0
    if (hasFragment && joinedCount >= 1_000_000 &&
        (!repair || joinedCount > repair.count)) {
     repair = { text: joined.toUpperCase(), count: joinedCount, joinPrevious: previous.length - i }
    }
   }
  }
  if (repair) {
   suggestions.push({ text: repair.text, edits: 0, uncertain: false, joinPrevious: repair.joinPrevious })
  } else if (counts.has(word)) {
   suggestions.push({ text: word.toUpperCase(), edits: 0, uncertain: false })
  } else if (/^[a-z]{4,32}$/.test(word)) {
   const matches = new Set()
   const check = candidate => { if (counts.has(candidate)) matches.add(candidate) }
   // Probe the dictionary only for strings one edit away.
   for (let i = 0; i <= word.length; i++) {
    const left = word.slice(0, i), right = word.slice(i + 1)
    if (i < word.length) check(left + right)
    if (i + 1 < word.length) check(left + word[i + 1] + word[i] + word.slice(i + 2))
    for (const letter of "abcdefghijklmnopqrstuvwxyz'") {
     if (i < word.length) check(left + letter + right)
     check(left + letter + word.slice(i))
    }
   }
   const ranked = [...matches].map(candidate => ({ candidate, cost: weightedDistance(word, candidate) }))
    .sort((a, b) => a.cost - b.cost || counts.get(b.candidate) - counts.get(a.candidate))
   const [best, runnerUp] = ranked
   const uncertain = !best || counts.get(best.candidate) < 1_000_000 ||
    (runnerUp && runnerUp.cost - best.cost < .5)
   for (const { candidate } of ranked.slice(0, 10)) {
    suggestions.push({ text: candidate.toUpperCase(), edits: 1, uncertain: Boolean(uncertain) })
   }
  }
  return { original, suggestions, engine: 'browser-dictionary' }
 }
}
