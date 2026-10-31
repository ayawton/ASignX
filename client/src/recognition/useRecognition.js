import { useEffect, useReducer, useRef, useState } from 'react'
import { createFrameStream } from './frameStream'
import { initialWordState, wordComposer } from './wordComposer'

export default function useRecognition(video, sessionKey, onRecognized) {
 const [state, setState] = useState({ status: 'off', hands: [], readings: [], error: '' })
 const [history, setHistory] = useState([])
 const [composition, dispatch] = useReducer(wordComposer, initialWordState)
 const streamRef = useRef(null)
 const soundRef = useRef(onRecognized)
 useEffect(() => { soundRef.current = onRecognized }, [onRecognized])
 useEffect(() => {
  if (!video) return
  const stream = createFrameStream(video, {
   onState: (status, error = '') => setState({ status, hands: [], readings: [], error }),
   onResult: data => {
    setState({ ...data, status: 'ready', error: '' })
    if (data.emissions.length) {
     soundRef.current?.()
     const letters = data.emissions.map(item => ({ ...item, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))
     setHistory(previous => [...previous, ...letters].slice(-200))
     dispatch({ type: 'letters', letters })
    }
   },
  })
  streamRef.current = stream
  void stream.start()
  return () => { stream.stop(); if (streamRef.current === stream) streamRef.current = null }
 }, [video, sessionKey])
 function clear() { dispatch({ type: 'clear' }); setHistory([]); setState(previous => ({ ...previous, readings: [], dynamic: null })); streamRef.current?.clear() }
 return { ...(video ? state : { status: 'off', hands: [], readings: [], error: '' }), history, pendingText: composition.pending, accepted: composition.accepted, sentenceWords: composition.sentenceWords, sentences: composition.sentences, revision: composition.revision, wordFull: composition.full, finishSentence: (text, revision = composition.revision) => dispatch({ type: 'sentence', text, revision }), finishWord: (text, revision = composition.revision) => dispatch({ type: 'finish', text, revision }), clear }
}
