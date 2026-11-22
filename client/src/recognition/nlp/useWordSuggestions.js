import { useEffect, useRef, useState } from 'react'
import { createLatestSuggestions } from './latestSuggestions'
import { createAutomaticWords } from './automaticWords'

export default function useWordSuggestions(text, revision, onFinish, { mode = 'automatic-word', pauseMs = 2000, fallback = text, enabled = true, canFinish = true, previous, preserveSigns = false } = {}) {
 const [response, setResponse] = useState(null)
 const [failed, setFailed] = useState(false)
 const requests = useRef(null)
 const boundary = useRef(null)
 const finish = useRef(onFinish)
 useEffect(() => { finish.current = onFinish }, [onFinish])
 useEffect(() => {
  let disposed = false
  let current
  const automatic = createAutomaticWords({ onFinish: (word, id, joinPrevious) => finish.current(word, id, joinPrevious), pauseMs })
  boundary.current = automatic
  try {
   const worker = new Worker(new URL('./wordSuggestions.worker.js', import.meta.url), { type: 'module' })
   current = createLatestSuggestions(worker, data => { setResponse(data); automatic.receive(data) }, mode)
   requests.current = current
   if (mode !== 'sentence') worker.postMessage({ mode: 'preload' })
   worker.onerror = () => { setFailed(true); automatic.fail(); current.stop() }
  } catch { queueMicrotask(() => { if (!disposed) { setFailed(true); automatic.fail() } }) }
  return () => { disposed = true; current?.stop(); automatic.stop(); boundary.current = null; requests.current = null }
 }, [mode, pauseMs])
 useEffect(() => {
  const input = enabled ? text : ''
  boundary.current?.update(canFinish ? input : '', revision, fallback)
  if (!failed) requests.current?.update(input, revision, mode === 'sentence' ? { fallback, preserveSigns } : { previous })
 }, [text, revision, failed, enabled, fallback, mode, pauseMs, canFinish, previous, preserveSigns])
 return { response: enabled && text && response?.id === revision ? response : null, failed }
}
