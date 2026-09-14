import { useState } from 'react'
import { Activity, AlertCircle, BarChart3, Clock3, RotateCcw, ScanLine, Sparkles, Trash2 } from 'lucide-react'
import CameraPanel from '../components/CameraPanel'
import PageHeader from '../components/PageHeader'

const predictions = [
  { word: 'HELLO', confidence: 96 }, { word: 'THANK YOU', confidence: 93 }, { word: 'YES', confidence: 91 },
  { word: 'NO', confidence: 89 }, { word: 'HELP', confidence: 94 }, { word: 'WATER', confidence: 87 },
]

export default function Live() {
  const [active, setActive] = useState(false)
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)

  const predict = () => {
    const result = predictions[Math.floor(Math.random() * predictions.length)]
    const stamped = { ...result, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setCurrent(stamped); setHistory(prev => [stamped, ...prev].slice(0, 6))
  }
  const clear = () => { setCurrent(null); setHistory([]) }

  return <>
    <PageHeader eyebrow="ASignLive" title="Sign. Understand. Connect." description="Explore how real-time ASL interpretation will work. Camera preview is local; every recognition result below is a clearly labeled simulation." />
    <section className="section section--compact"><div className="shell">
      <div className="demo-notice"><Sparkles /><div><strong>Frontend demonstration</strong><span>The ASL machine-learning model is not connected. Use “Run demo prediction” to preview the experience.</span></div></div>
      <div className="live-grid">
        <div><CameraPanel active={active} onStart={() => setActive(true)} onStop={() => setActive(false)} /><button className="button button--accent full demo-predict" onClick={predict} disabled={!active}><ScanLine size={19} /> Run demo prediction</button><p className="microcopy">Start the camera to enable simulated predictions.</p></div>
        <aside className="recognition-panel">
          <div className="panel-heading"><div><span className="mini-label">Demo prediction</span><h2>Recognition result</h2></div><span className={`connection ${active ? 'is-on' : ''}`}><i />{active ? 'Ready' : 'Offline'}</span></div>
          <div className={`recognized-sign ${current ? 'has-result' : ''}`}>
            {current ? <><span>Recognized sign</span><strong>{current.word}</strong><div className="confidence"><span><BarChart3 /> Confidence</span><strong>{current.confidence}%</strong></div><div className="confidence-bar"><i style={{ width: `${current.confidence}%` }} /></div></> : <div className="empty-result"><Activity /><h3>No sign detected yet</h3><p>Start the camera, then run a demo prediction.</p></div>}
          </div>
          <div className="sentence-box"><div><span className="mini-label">Sentence preview</span><button onClick={clear} disabled={!history.length}><RotateCcw size={14} /> Clear</button></div><p>{history.length ? [...history].reverse().map(x => x.word.toLowerCase()).join(' ') : 'Recognized words will appear here…'}</p></div>
        </aside>
      </div>
      <div className="history-card">
        <div className="panel-heading"><div><span className="mini-label">Session activity</span><h2>Detected sign history</h2></div><button className="icon-button" onClick={clear} disabled={!history.length} aria-label="Clear history"><Trash2 /></button></div>
        {history.length ? <div className="history-list">{history.map((item, i) => <div className="history-item" key={`${item.time}-${i}`}><span className="history-item__index">{String(history.length - i).padStart(2, '0')}</span><strong>{item.word}</strong><span>{item.confidence}% confidence</span><time><Clock3 /> {item.time}</time><em>Demo</em></div>)}</div> : <div className="empty-row"><AlertCircle /> Your simulated detections will be listed here.</div>}
      </div>
    </div></section>
  </>
}
