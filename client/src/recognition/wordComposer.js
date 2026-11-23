import { capRepeatedLetters } from './nlp/spellingEdits.js'
import { formatSentence } from './nlp/sentences.js'
export const initialWordState = { pending: '', pendingLetters: [], accepted: [], sentenceWords: [], sentences: [], revision: 0, full: false, lastLetterAt: null }
export const WHOLE_SIGN_MID_WORD_MIN_CONFIDENCE = 0.97
export const WHOLE_SIGN_LETTER_COOLDOWN_MS = 1800

function toLetterSignal(item) {
 const signal = { label: item.label }
 if (Number.isFinite(item.confidence)) signal.confidence = Number(item.confidence.toFixed(4))
 if (Array.isArray(item.alternatives) && item.alternatives.length) {
  const alts = item.alternatives
   .filter(alt => alt?.label && Number.isFinite(alt.confidence))
   .slice(0, 2)
   .map(alt => ({ label: alt.label, confidence: Number(alt.confidence.toFixed(4)) }))
  if (alts.length) signal.alternatives = alts
 }
 if (item.hand === 'Motion') signal.fromMotion = true
 return signal
}

function hasSignalData(letters) {
 return letters.some(item => Number.isFinite(item.confidence) || item.alternatives?.length || item.fromMotion)
}

export function shouldAcceptWholeSign({ pending, lastLetterAt, confidence, at }) {
 if (!pending) return true
 if (Number.isFinite(confidence) && confidence < WHOLE_SIGN_MID_WORD_MIN_CONFIDENCE) return false
 if (Number.isFinite(at) && Number.isFinite(lastLetterAt) && at - lastLetterAt < WHOLE_SIGN_LETTER_COOLDOWN_MS) {
  return false
 }
 return true
}

// Automatic boundaries use a revision to reject results for superseded letters.
export function wordComposer(state, action) {
 switch (action.type) {
  case 'sign': {
   if (!shouldAcceptWholeSign({
    pending: state.pending,
    lastLetterAt: state.lastLetterAt,
    confidence: action.confidence,
    at: action.at,
   })) {
    return state
   }
   const word = {
    text: action.label,
    detected: action.label,
    wholeSign: true,
    ...(Number.isFinite(action.confidence) ? { confidence: action.confidence } : {}),
   }
   const pendingWord = state.pending
    ? {
       text: state.pending,
       detected: state.pending,
       ...(hasSignalData(state.pendingLetters) ? { letters: state.pendingLetters } : {}),
      }
    : null
   const words = pendingWord ? [pendingWord, word] : [word]
   return {
    ...state, pending: '', pendingLetters: [], full: false, lastLetterAt: null, revision: state.revision + 1,
    accepted: [...state.accepted, ...words].slice(-200),
    sentenceWords: [...state.sentenceWords, ...words].slice(-200),
   }
  }
  case 'letters': {
   const text = action.letters.map(item => item.label).join('')
   if (!text) return state
   const pending = state.pending + text
   const pendingLetters = [...state.pendingLetters, ...action.letters.map(toLetterSignal)].slice(0, 200)
   return {
    ...state,
    pending: pending.slice(0, 200),
    pendingLetters,
    revision: state.revision + 1,
    full: pending.length >= 200,
    lastLetterAt: Number.isFinite(action.at) ? action.at : state.lastLetterAt,
   }
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
     const hasSignals = fragments.some(fragment => fragment.letters?.length) || hasSignalData(state.pendingLetters)
     const letters = hasSignals
      ? [
         ...fragments.flatMap(fragment => fragment.letters ?? [...fragment.detected].map(label => ({ label }))),
         ...state.pendingLetters,
        ].slice(0, 200)
      : null
     const word = { text, detected, ...(letters ? { letters } : {}) }
     return {
      ...state, pending: '', pendingLetters: [], full: false, lastLetterAt: null, revision: state.revision + 1,
      accepted: [...state.accepted.slice(0, -count), word],
      sentenceWords: [...state.sentenceWords.slice(0, -count), word],
     }
    }
   }
   const word = {
    text,
    detected: state.pending,
    ...(hasSignalData(state.pendingLetters) ? { letters: state.pendingLetters } : {}),
   }
   return { ...state, pending: '', pendingLetters: [], lastLetterAt: null, accepted: [...state.accepted, word].slice(-200), sentenceWords: [...state.sentenceWords, word].slice(-200), revision: state.revision + 1, full: false }
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
