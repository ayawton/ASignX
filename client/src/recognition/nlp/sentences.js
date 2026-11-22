// Tier two: format recognized words without inventing grammar or missing meaning.
export function canFinishSentence({ active, status, hands, pendingText }) {
 // Holding or changing a sign is not the end of a sentence. A failed/busy
 // request is not evidence that hands have left the frame, either.
 return !pendingText && (!active || (status === 'ready' && hands.length === 0))
}

export function formatSentence(words) {
 const text = words.map(item => item.text).join(' ').toLowerCase().replace(/\bi\b/g, 'I')
 return text ? text[0].toUpperCase() + text.slice(1) + '.' : ''
}
