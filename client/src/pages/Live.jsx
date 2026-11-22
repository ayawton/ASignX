import { useState } from 'react'
import { Hand, MessageCircle, RotateCcw, ShieldCheck, Volume2, VolumeX } from 'lucide-react'
import CameraPanel from '../components/CameraPanel'
import SpeakButton from '../components/SpeakButton'
import useRecognition from '../recognition/useRecognition'
import useRecognitionSound from '../recognition/useRecognitionSound'
import useWordSuggestions from '../recognition/nlp/useWordSuggestions'
import { canFinishSentence } from '../recognition/nlp/sentences'
export default function Live() {
 const [active, setActive] = useState(false)
 const [video, setVideo] = useState(null)
 const [sessionKey, setSessionKey] = useState(0)
 const sound = useRecognitionSound()
 const result = useRecognition(video, sessionKey, sound.play)
 const words = useWordSuggestions(result.pendingText, result.revision, result.finishWord, { previous: result.sentenceWords })
 const sentenceFallback = result.sentenceWords.map(item => item.text).join(' ')
 const sentence = useWordSuggestions(result.sentenceWords.map(item => item.detected).join(' '), result.revision, result.finishSentence, { mode: 'sentence', pauseMs: 4000, fallback: sentenceFallback, preserveSigns: result.sentenceWords.some(item => item.wholeSign), enabled: !result.pendingText, canFinish: canFinishSentence({ active, status: result.status, hands: result.hands, pendingText: result.pendingText }) })
 const sentencePreview = sentence.response?.result?.suggestions?.[0]?.text || sentenceFallback
 const suggestions = words.response?.result?.suggestions || []
 const finalText = result.sentences.map(item => item.text).join(' ')
 const latest = result.history.at(-1)
 const readings = result.dynamic?.stable ? [result.dynamic] : result.readings.filter(reading => reading.stable)
 const status = result.status === 'loading' ? 'Loading recognition models…' : result.status === 'error' ? 'Recognition unavailable' : result.status === 'off' ? 'Start your camera to recognize signs.' : result.moving ? 'Following your movement for J or Z…' : result.hands.length ? `${result.hands.length} ${result.hands.length === 1 ? 'hand' : 'hands'} detected. Hold your sign steady.` : 'Show your hand inside the camera frame.'
 return <section className="container studio-section studio-page">
  <div className="page-heading"><div><span className="text-label">ASignLive</span><h1>Room for a conversation.</h1><p>Practice fingerspelling and whole signs.</p></div></div>
  <div className="studio-demo-banner"><Hand size={20} /><p><strong>Sign recognition preview.</strong> Try the alphabet, HELLO, HELP, PLEASE, and THANK YOU. Keep your face, shoulders, elbows, and hands in view for whole signs. Suggestions may change or add letters and can be incorrect; check them against what you intended to spell. To repeat a letter, lower your hand out of the frame for at least half a second, then sign it again. Holding a sign records it only once.</p></div>
  <div className="studio-live-layout"><div>
   <CameraPanel active={active} onStart={() => { sound.unlock(); setActive(true) }} onStop={() => { setVideo(null); setActive(false) }} onVideoReady={setVideo} />
   <div className="studio-camera-privacy"><ShieldCheck size={16} /> Sign recognition runs in your browser. Camera frames stay on this device.</div>
  </div><aside className="studio-translation">
   <div className="studio-panel-top"><h2>Recognized signs</h2><span className="studio-demo-tag">{result.status === 'ready' ? (result.allSigns ? 'Whole signs enabled' : 'Alphabet only') : 'Browser recognition'}</span></div>
   <p className="recognition-status" role="status">{status}</p>
   <button type="button" className="recognition-sound-toggle" aria-pressed={sound.enabled} aria-label={sound.enabled ? 'Mute recognition sound' : 'Enable recognition sound'} onClick={sound.toggle}>{sound.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{sound.enabled ? 'Sound on' : 'Sound off'}</button>
   {result.error && <div className="recognition-error" role="alert"><p>{result.error}</p><button type="button" className="text-link" onClick={() => setSessionKey(key => key + 1)}>Retry recognition</button></div>}
   <div className="studio-translation-output" aria-live="polite" aria-atomic="true">{readings.length ? <><small>Current sign</small><strong>{readings.map(reading => reading.stable).join(' / ')}</strong><p>{readings.map(reading => `${reading.hand}: ${Math.round(reading.confidence * 100)}% confidence`).join(' · ')}</p></> : <><MessageCircle size={35} /><h3>{result.status === 'loading' ? 'Getting ready.' : 'Your next sign.'}</h3><p>{result.status === 'ready' ? 'Hold a static letter or perform a complete moving sign.' : 'Start the camera and show a clear sign.'}</p></>}</div>
   <div className="studio-sentence"><span>Raw recognition</span><p className="recognized-text">{result.history.length ? result.history.map(item => item.label).join(' ') : 'Recognized signs will appear here.'}</p>{latest && <p className="recognition-last">Last recognized: {latest.label} · {latest.time}</p>}</div>
   <button type="button" className="text-link studio-clear" disabled={!result.history.length && !result.accepted.length && !result.pendingText} onClick={result.clear}><RotateCcw size={14} /> Clear all text</button>
   <div className="studio-sentence"><span>Current letters</span><p className="recognized-text" aria-live="polite">{result.pendingText || 'Sign the next word, one letter at a time.'}</p><p className="recognition-last">Pause for 2 seconds between words. Words are formed automatically.</p>{result.wordFull && <p role="alert">The current letter group is full. Pause to let it finish before continuing.</p>}</div>
   <div className="studio-sentence"><span>1 · Automatic word recognition</span><div aria-live="polite">{!result.pendingText ? <p>Ready for your next word.</p> : words.failed || words.response?.error ? <p>Word suggestions unavailable. Detected spelling will be kept automatically.</p> : !words.response ? <p>Checking spelling…</p> : <p className="recognized-text"><strong>{suggestions[0]?.uncertain ? result.pendingText : suggestions[0]?.text || result.pendingText}</strong>{suggestions[0]?.uncertain && <small> Possible matches: {suggestions.slice(0, 3).map(item => item.text).join(", ")}</small>}</p>}</div><p className="recognition-last">After your pause, a clear match is applied automatically. If the match is uncertain, your detected spelling is kept.</p></div>
   <div className="studio-sentence"><span>2 · Sentence assembly</span><p className="recognized-text" aria-live="polite">{sentencePreview || 'Provisional words collect here before the sentence finishes.'}</p><p className="recognition-last">SymSpell rechecks raw letters to join fragments split by short pauses. To finish the sentence, lower your hands out of frame for 4 seconds after the last word finishes. Holding a sign keeps the sentence open. Grammar is not rewritten.</p>{result.sentenceWords.length > 0 && (sentence.failed || sentence.response?.error) && <p className="recognition-last">Sentence correction unavailable; provisional words will be preserved.</p>}</div>
   <div className="studio-sentence"><span>Final sentences</span><p className="recognized-text" aria-live="polite">{finalText || 'Your sentences will appear here automatically.'}</p><SpeakButton key={Boolean(finalText)} text={finalText} />{result.sentences.length > 0 && <details className="word-audit"><summary>Compare sentences with detected letters</summary><ol>{result.sentences.map((item, index) => <li key={index}><strong>{item.text}</strong> · Detected: {item.detected}</li>)}</ol></details>}{result.accepted.length > 0 && <details className="word-audit"><summary>Word-stage groups (before sentence repair)</summary><ol>{result.accepted.map((item, index) => <li key={index}><strong>{item.text}</strong> · Detected: {item.detected}</li>)}</ol></details>}</div>
  </aside></div>
  <p className="studio-storage-note">Your browser checks up to 15 camera frames per second. Word suggestions use a dictionary loaded once in your browser. Sentence assembly sends detected letter groups and provisional words to the backend. A 2-second pause records a provisional word. After the last word finishes, 4 seconds with your hands out of frame completes the sentence; holding a sign keeps it open. Processing continues while the camera runs. This session retains up to 200 recent signs, 200 letters per group, 200 recent words, and 50 sentences in browser memory. Clear all text removes the session text. This does not translate ASL grammar.</p>
  <div className="studio-session"><div className="section-title compact"><h2>This session</h2><span>{result.history.length} recognized {result.history.length === 1 ? 'sign' : 'signs'}</span></div>{result.history.length ? <div className="studio-history">{result.history.map((item, i) => <div key={i}><span className="history-sign"><Hand size={17} /></span><strong>{item.label}</strong><span>{item.hand} · {Math.round(item.confidence * 100)}%</span><time>{item.time}</time></div>)}</div> : <p className="studio-empty-inline">No recognized signs yet. Start your camera to begin.</p>}</div>
 </section>
}
