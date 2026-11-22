import { formatSentence } from './nlp/sentences.js'
export const initialWordState = { pending: '', accepted: [], sentenceWords: [], sentences: [], revision: 0, full: false }

// Automatic boundaries use a revision to reject results for superseded letters.
export function wordComposer(state, action) {
 switch (action.type) {
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
