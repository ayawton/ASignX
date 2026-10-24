import { useState } from 'react'
import { Hand, MessageCircle, RotateCcw, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import CameraPanel from '../components/CameraPanel'
import useRecognition from '../recognition/useRecognition'
import useRecognitionSound from '../recognition/useRecognitionSound'
export default function Live() {
 const [active, setActive] = useState(false)
 const [video, setVideo] = useState(null)
 const [sessionKey, setSessionKey] = useState(0)
 const sound = useRecognitionSound()
 const result = useRecognition(video, sessionKey, sound.play)
 const latest = result.history.at(-1)
 const readings = result.dynamic?.stable ? [result.dynamic] : result.readings.filter(reading => reading.stable)
 const status = result.status === 'loading' ? 'Connecting to recognition…' : result.status === 'waiting' ? 'Recognition is busy. Waiting for the server…' : result.status === 'error' ? 'Recognition unavailable' : result.status === 'off' ? 'Start your camera to recognize letters.' : result.moving ? 'Following your movement for J or Z…' : result.hands.length ? `${result.hands.length} ${result.hands.length === 1 ? 'hand' : 'hands'} detected. Hold your sign steady.` : 'Show your hand inside the camera frame.'
 return <section className="container studio-section studio-page">
  <div className="page-heading"><div><span className="text-label">ASignLive</span><h1>Room for a conversation.</h1><p>Practice fingerspelling with live alphabet recognition.</p></div></div>
  <div className="studio-demo-banner"><Hand size={20} /><p><strong>Alphabet recognition preview.</strong> Recognizes static letters and moving J/Z. Results may be incorrect; this preview does not translate words or sentences. Starting the camera sends frames to the server. To repeat a letter, lower your hand briefly, then sign again.</p></div>
  <div className="studio-live-layout"><div>
   <CameraPanel active={active} onStart={() => { sound.unlock(); setActive(true) }} onStop={() => { setVideo(null); setActive(false) }} onVideoReady={setVideo} />
   <div className="studio-camera-privacy"><ShieldCheck size={16} /> Camera frames are sent to our server for recognition, then discarded.</div>
  </div><aside className="studio-translation">
   <div className="studio-panel-top"><h2>Recognized letters</h2><span className="studio-demo-tag">Server recognition</span></div>
   <p className="recognition-status" role="status">{status}</p>
   <button type="button" className="recognition-sound-toggle" aria-pressed={sound.enabled} aria-label={sound.enabled ? 'Mute recognition sound' : 'Enable recognition sound'} onClick={sound.toggle}>{sound.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{sound.enabled ? 'Sound on' : 'Sound off'}</button>
   {result.error && <div className="recognition-error" role="alert"><p>{result.error}</p><button type="button" className="text-link" onClick={() => setSessionKey(key => key + 1)}>Retry recognition</button></div>}
   <div className="studio-translation-output" aria-live="polite" aria-atomic="true">{readings.length ? <><small>Current sign</small><strong>{readings.map(reading => reading.stable).join(' / ')}</strong><p>{readings.map(reading => `${reading.hand}: ${Math.round(reading.confidence * 100)}% confidence`).join(' · ')}</p></> : <><MessageCircle size={35} /><h3>{result.status === 'loading' ? 'Getting ready.' : 'Your next letter.'}</h3><p>{result.status === 'ready' ? 'Hold a static sign, or make the full motion for J or Z.' : 'Start the camera and show a clear alphabet sign.'}</p></>}</div>
   <div className="studio-sentence"><span>Fingerspelling this session</span><p className="recognized-text">{result.history.length ? result.history.map(item => item.label).join('') : 'Recognized letters will appear here.'}</p>{latest && <p className="recognition-last">Last recognized: {latest.label} · {latest.time}</p>}</div>
   <button type="button" className="text-link studio-clear" disabled={!result.history.length} onClick={result.clear}><RotateCcw size={14} /> Clear letters</button>
  </aside></div>
  <p className="studio-storage-note">Camera frames are processed in memory and are not saved. This session keeps up to 200 recent letters in your browser and is not saved to your account. Stopping the camera stops recognition; clearing letters starts a fresh recognition window.</p>
  <div className="studio-session"><div className="section-title compact"><h2>This session</h2><span>{result.history.length} recognized {result.history.length === 1 ? 'letter' : 'letters'}</span></div>{result.history.length ? <div className="studio-history">{result.history.map((item, i) => <div key={i}><span className="history-sign"><Hand size={17} /></span><strong>{item.label}</strong><span>{item.hand} · {Math.round(item.confidence * 100)}%</span><time>{item.time}</time></div>)}</div> : <p className="studio-empty-inline">No recognized letters yet. Start your camera to begin.</p>}</div>
 </section>
}
