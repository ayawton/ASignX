import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Sparkles } from 'lucide-react'

export default function CameraPanel({ active, onStart, onStop, compact = false }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream
    async function connect() {
      if (!active || !navigator.mediaDevices?.getUserMedia) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (videoRef.current) videoRef.current.srcObject = stream
        setError('')
      } catch {
        setError('Camera access unavailable — the visual demo still works.')
      }
    }
    connect()
    return () => stream?.getTracks().forEach(track => track.stop())
  }, [active])

  return <div className={`camera-panel ${compact ? 'camera-panel--compact' : ''} ${active ? 'is-active' : ''}`}>
    <video ref={videoRef} autoPlay muted playsInline className="camera-panel__video" aria-label="Camera preview" />
    {!active && <div className="camera-panel__empty"><span><Camera size={compact ? 32 : 48} /></span><h3>Camera ready</h3><p>Your video stays in this browser session.</p></div>}
    {active && error && <div className="camera-panel__empty"><span><CameraOff size={compact ? 32 : 48} /></span><h3>Preview unavailable</h3><p>{error}</p></div>}
    <div className="camera-panel__status"><span className={active ? 'status-dot is-live' : 'status-dot'} />{active ? 'Camera active' : 'Camera off'}</div>
    <div className="camera-panel__badge"><Sparkles size={14} /> UI demo</div>
    <div className="camera-panel__actions">
      <button className="button button--primary" onClick={onStart} disabled={active}><Camera size={17} /> Start camera</button>
      <button className="button button--soft" onClick={onStop} disabled={!active}><CameraOff size={17} /> Stop</button>
    </div>
  </div>
}
