import { capRepeatedLetters } from './nlp/spellingEdits.js'
import { formatSentence } from './nlp/sentences.js'
export const initialWordState = { pending: '', accepted: [], sentenceWords: [], sentences: [], revision: 0, full: false }

// Automatic boundaries use a revision to reject results for superseded letters.
export function wordComposer(state, action) {
 switch (action.type) {
  case 'sign': {
   const word = { text: action.label, detected: action.label, wholeSign: true }
   const words = state.pending ? [{ text: state.pending, detected: state.pending }, word] : [word]
   return {
    ...state, pending: '', full: false, revision: state.revision + 1,
    accepted: [...state.accepted, ...words].slice(-200),
    sentenceWords: [...state.sentenceWords, ...words].slice(-200),
   }
  }
  case 'letters': {
   const text = action.letters.map(item => item.label).join('')
   if (!text) return state
   const pending = state.pending + text
   return { ...state, pending: pending.slice(0, 200), revision: state.revision + 1, full: pending.length >= 200 }
  }
  case 'finish': {
   if (!state.pending || action.revision !== state.revision) return state
   const text = action.text ?? state.pending
   if (text.length > 399 || !/^[A-Z]+(?:[' ][A-Z]+)*$/.test(text)) return state
   const count = action.joinPrevious
   if (Number.isInteger(count) && count > 0 && count <= state.sentenceWords.length) {
    const fragments = state.sentenceWords.slice(-count)
    const detected = fragments.map(group => group.detected).join('') + state.pending
    if (fragments.every(fragment => !fragment.wholeSign) && text === capRepeatedLetters(detected)) {
     const word = { text, detected }
     return {
      ...state, pending: '', full: false, revision: state.revision + 1,
      accepted: [...state.accepted.slice(0, -count), word],
      sentenceWords: [...state.sentenceWords.slice(0, -count), word],
     }
    }
   }
   const word = { text, detected: state.pending }
   return { ...state, pending: '', accepted: [...state.accepted, word].slice(-200), sentenceWords: [...state.sentenceWords, word].slice(-200), revision: state.revision + 1, full: false }
  }
  case 'sentence': {
   if (state.pending || !state.sentenceWords.length || action.revision !== state.revision) return state
   if (action.text !== undefined && (typeof action.text !== 'string' || action.text.length > 4000 || !/^[A-Z]+(?:[' ][A-Z]+)*$/.test(action.text))) return state
   const sentence = { text: formatSentence(action.text ? [{ text: action.text }] : state.sentenceWords), detected: state.sentenceWords.map(item => item.detected).join(' ') }
   return { ...state, sentenceWords: [], sentences: [...state.sentences, sentence].slice(-50), revision: state.revision + 1 }
  }
  case 'clear': return { ...initialWordState, revision: state.revision + 1 }
  default: return state
 }
}
