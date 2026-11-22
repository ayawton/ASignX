import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

export default function SpeakButton({ text }) {
 const utterance = useRef(null)
 const [speaking, setSpeaking] = useState(false)
 const [error, setError] = useState('')
 const supported = typeof window !== 'undefined' &&
  Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)

 useEffect(() => () => {
  if (!utterance.current) return
  utterance.current = null
  window.speechSynthesis.cancel()
 }, [])

 function toggle() {
  const synth = window.speechSynthesis
  setError('')
  if (utterance.current) {
   utterance.current = null
   synth.cancel()
   setSpeaking(false)
   return
  }
  const next = new window.SpeechSynthesisUtterance(text)
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
