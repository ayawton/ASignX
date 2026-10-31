import { useCallback, useEffect, useRef, useState } from 'react'

export default function useRecognitionSound() {
 const [enabled, setEnabled] = useState(true)
 const allowed = useRef(true)
 const context = useRef(null)
 // Called from the camera/sound button so browser audio permission follows a user gesture.
 const unlock = useCallback(() => {
  if (!allowed.current) return
  try {
   const Audio = globalThis.AudioContext || globalThis.webkitAudioContext
   if (!Audio) return
   context.current ??= new Audio()
   if (context.current.state === 'suspended') void context.current.resume().catch(() => {})
  } catch { /* Audio is optional; recognition must continue without it. */ }
 }, [])
 const play = useCallback(() => {
  const audio = context.current
  if (!allowed.current || audio?.state !== 'running') return
  try {
   const tone = audio.createOscillator(), volume = audio.createGain()
   const now = audio.currentTime
   tone.type = 'triangle'
   tone.frequency.setValueAtTime(1400, now)
   tone.frequency.exponentialRampToValueAtTime(650, now + .025)
   volume.gain.setValueAtTime(0, now)
   volume.gain.linearRampToValueAtTime(.5, now + .002)
   volume.gain.exponentialRampToValueAtTime(.0001, now + .028)
   tone.connect(volume); volume.connect(audio.destination)
   tone.onended = () => { tone.disconnect(); volume.disconnect() }
   tone.start(now); tone.stop(now + .03)
  } catch { /* Ignore unsupported or interrupted audio. */ }
 }, [])
 const toggle = useCallback(() => {
  allowed.current = !allowed.current
  setEnabled(allowed.current)
  if (allowed.current) unlock()
 }, [unlock])
 useEffect(() => () => { const audio = context.current; context.current = null; if (audio) void audio.close().catch(() => {}) }, [])
 return { enabled, unlock, play, toggle }
}
