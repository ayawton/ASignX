import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Hand } from 'lucide-react'
export default function CameraPanel({ active, onStart, onStop }) {
 const video = useRef(null)
 const [status, setStatus] = useState('off')
 useEffect(() => {
  let stream; let cancelled = false
  async function connect() {
   if (!active) return
   if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return }
   setStatus('connecting')
   try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
    if (video.current) video.current.srcObject = stream
    setStatus('ready')
   } catch { if (!cancelled) setStatus('denied') }
  }
  connect()
  return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()) }
 }, [active])
 const failed = active && ['denied', 'unavailable'].includes(status)
 return <div className={`studio-camera${active && status === 'ready' ? ' is-previewing' : ''}`}><div className="studio-camera-status"><span><i className={active && status === 'ready' ? 'on' : ''} />{!active ? 'Camera off' : status === 'ready' ? 'Camera active' : failed ? 'Preview unavailable' : 'Connecting'}</span><span>Local preview</span></div><video ref={video} hidden={!active || status !== 'ready'} autoPlay playsInline muted aria-label="Your camera preview" />{(!active || status !== 'ready') && <div className="studio-camera-empty"><span>{failed ? <CameraOff size={33} /> : <Hand size={42} strokeWidth={1.4} />}</span><h2>{failed ? 'Let’s get you set up.' : active ? 'Waiting for your camera.' : 'Your hands. Your space.'}</h2><p>{failed ? 'Allow camera access in your browser and try again, or explore the simulation below.' : active ? 'Allow access in the browser prompt to see your preview.' : 'Turn on your camera when you’re ready. Position your hands comfortably in the frame.'}</p></div>}<div className="studio-camera-controls"><button className="btn btn-secondary" onClick={active ? onStop : onStart}>{active ? <CameraOff size={18} /> : <Camera size={18} />}{active ? 'Stop camera' : 'Start camera'}</button></div></div>
}
