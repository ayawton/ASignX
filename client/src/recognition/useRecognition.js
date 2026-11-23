import { useEffect, useReducer, useRef, useState } from 'react'
import { createBrowserFrameStream } from './browserFrameStream'
import { initialWordState, shouldAcceptWholeSign, wordComposer } from './wordComposer'

export default function useRecognition(video, sessionKey, onRecognized) {
 const [state, setState] = useState({ status: 'off', hands: [], readings: [], error: '' })
 const [history, setHistory] = useState([])
 const [composition, dispatch] = useReducer(wordComposer, initialWordState)
 const streamRef = useRef(null)
 const soundRef = useRef(onRecognized)
 const gateRef = useRef({ pending: '', lastLetterAt: null })
 useEffect(() => { soundRef.current = onRecognized }, [onRecognized])
 useEffect(() => {
  gateRef.current = { pending: composition.pending, lastLetterAt: composition.lastLetterAt }
 }, [composition.pending, composition.lastLetterAt])
 useEffect(() => {
  if (!video) return
  const stream = createBrowserFrameStream(video, {
   onState: (status, error = '') => setState({ status, hands: [], readings: [], error }),
   onResult: data => {
    setState({ ...data, status: 'ready', error: '' })
    if (data.emissions.length) {
     const now = performance.now()
     const signs = data.emissions.map(item => ({ ...item, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))
     const acceptedSigns = []
     let { pending, lastLetterAt } = gateRef.current
     for (const sign of signs) {
      if (sign.label.length > 1) {
       if (!shouldAcceptWholeSign({ pending, lastLetterAt, confidence: sign.confidence, at: now })) {
        continue
       }
       pending = ''
       acceptedSigns.push(sign)
       dispatch({ type: 'sign', label: sign.label, confidence: sign.confidence, at: now })
      } else {
       pending = (pending + sign.label).slice(0, 200)
       lastLetterAt = now
       acceptedSigns.push(sign)
       dispatch({ type: 'letters', letters: [sign], at: now })
      }
     }
     gateRef.current = { pending, lastLetterAt }
     if (acceptedSigns.length) {
      soundRef.current?.()
      setHistory(previous => [...previous, ...acceptedSigns].slice(-200))
     }
    }
   },
  })
  streamRef.current = stream
  void stream.start()
  return () => { stream.stop(); if (streamRef.current === stream) streamRef.current = null }
 }, [video, sessionKey])
 function clear() {
  gateRef.current = { pending: '', lastLetterAt: null }
  dispatch({ type: 'clear' })
  setHistory([])
  setState(previous => ({ ...previous, readings: [], dynamic: null }))
  streamRef.current?.clear()
 }
 return { ...(video ? state : { status: 'off', hands: [], readings: [], error: '' }), history, pendingText: composition.pending, pendingLetters: composition.pendingLetters, accepted: composition.accepted, sentenceWords: composition.sentenceWords, sentences: composition.sentences, revision: composition.revision, wordFull: composition.full, finishSentence: (text, revision = composition.revision) => dispatch({ type: 'sentence', text, revision }), finishWord: (text, revision = composition.revision, joinPrevious = 0) => dispatch({ type: 'finish', text, revision, joinPrevious }), clear }
}
