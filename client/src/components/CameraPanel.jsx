import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Hand } from 'lucide-react'
export default function CameraPanel({ active, onStart, onStop, onVideoReady, compact = false }) {
 const video = useRef(null)
 const [status, setStatus] = useState('off')
 const [attempt, retry] = useState(0)
 useEffect(() => {
  let stream; let cancelled = false
  async function connect() {
   if (!active) return
   if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return }
   setStatus('connecting')
   try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
    if (video.current) { video.current.srcObject = stream; await video.current.play() }
    if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (!cancelled) { setStatus('denied'); onVideoReady?.(null) } }))
    setStatus('ready')
    onVideoReady?.(video.current)
   } catch { stream?.getTracks().forEach(t => t.stop()); if (!cancelled) { setStatus('denied'); onVideoReady?.(null) } }
  }
  connect()
  return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); onVideoReady?.(null) }
 }, [active, onVideoReady, attempt])
 const failed = active && ['denied', 'unavailable'].includes(status)
 const retryable = compact && failed && status !== 'unavailable'
 const buttonText = retryable ? 'Retry camera' : active ? 'Stop camera' : 'Start camera'
 function toggleCamera() {
  if (retryable) retry(value => value + 1)
  else if (active) onStop()
  else onStart()
 }
 return <div className={`studio-camera${active && status === 'ready' ? ' is-previewing' : ''}`}><div className="studio-camera-status"><span role="status"><i className={active && status === 'ready' ? 'on' : ''} />{!active ? 'Camera off' : status === 'ready' ? 'Camera active' : failed ? (compact ? (status === 'unavailable' ? 'Camera requires HTTPS or localhost' : 'Camera unavailable. Check permissions or reconnect.') : 'Preview unavailable') : 'Connecting'}</span><span>Local preview</span></div><video ref={video} hidden={!active || status !== 'ready'} autoPlay playsInline muted aria-label="Your camera preview" />{(!active || status !== 'ready') && <div className="studio-camera-empty"><span>{failed ? <CameraOff size={33} /> : <Hand size={42} strokeWidth={1.4} />}</span><h2>{failed ? 'Let’s get you set up.' : active ? 'Waiting for your camera.' : 'Your hands. Your space.'}</h2><p>{failed ? 'Allow camera access in your browser and try again, or explore the simulation below.' : active ? 'Allow access in the browser prompt to see your preview.' : 'Turn on your camera when you’re ready. Position your hands comfortably in the frame.'}</p></div>}<div className="studio-camera-controls"><button className="btn btn-secondary" onClick={toggleCamera}>{active && !retryable ? <CameraOff size={18} /> : <Camera size={18} />}{buttonText}</button></div></div>
}
