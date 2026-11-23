import { useCallback, useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export default function SpeakButton({ text, autoSpeakText = '', autoSpeakKey = null }) {
 const utterance = useRef(null)
 const [speaking, setSpeaking] = useState(false)
 const [error, setError] = useState('')
 const supported = typeof window !== 'undefined' &&
  Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)

 const stop = useCallback(() => {
  if (!utterance.current) return
  utterance.current = null
  window.speechSynthesis.cancel()
  setSpeaking(false)
 }, [])

 const speak = useCallback(value => {
  if (!supported || !value) return
  const synth = window.speechSynthesis
  setError('')
  if (utterance.current) {
   utterance.current = null
   synth.cancel()
  }
  const next = new window.SpeechSynthesisUtterance(value)
  next.lang = 'en'
  const finish = message => {
   if (utterance.current !== next) return
   utterance.current = null
   setSpeaking(false)
   setError(message)
  }
  next.onend = () => finish('')
  next.onerror = () => finish('Could not read the sentence aloud.')
  utterance.current = next
  setSpeaking(true)
  try { synth.speak(next) } catch { finish('Could not read the sentence aloud.') }
 }, [supported])

 useEffect(() => stop, [stop])

 useEffect(() => {
  if (!supported || !autoSpeakText || !autoSpeakKey) return
  const timer = setTimeout(() => {
   speak(autoSpeakText)
  }, 0)
  return () => clearTimeout(timer)
 }, [autoSpeakKey, autoSpeakText, speak, supported])

 function toggle() {
  setError('')
  if (utterance.current) {
   stop()
   return
  }
  speak(text)
 }

 return <>
  <button type="button" className="recognition-sound-toggle" disabled={!supported || !text} onClick={toggle}>
   {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
   {speaking ? 'Stop speaking' : 'Speak'}
  </button>
  {!supported && <p className="recognition-last">Text-to-speech is unavailable in this browser.</p>}
  {error && <p className="recognition-last" role="status">{error}</p>}
 </>
}
