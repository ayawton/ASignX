import { useEffect, useRef, useState } from 'react'
import { createFrameStream } from './frameStream'

export default function useRecognition(video, sessionKey, onRecognized) {
 const [state, setState] = useState({ status: 'off', hands: [], readings: [], error: '' })
 const [history, setHistory] = useState([])
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
     setHistory(previous => [...previous, ...data.emissions.map(item => ({ ...item, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))].slice(-200))
    }
   },
  })
  streamRef.current = stream
  void stream.start()
  return () => { stream.stop(); if (streamRef.current === stream) streamRef.current = null }
 }, [video, sessionKey])
 function clear() { setHistory([]); setState(previous => ({ ...previous, readings: [], dynamic: null })); streamRef.current?.clear() }
 return { ...(video ? state : { status: 'off', hands: [], readings: [], error: '' }), history, clear }
}
