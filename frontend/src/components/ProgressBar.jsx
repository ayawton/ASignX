export default function ProgressBar({ value, label, showValue = true, tone = 'blue' }) {
  return <div className="progress-wrap">
    {(label || showValue) && <div className="progress-meta">{label && <span>{label}</span>}{showValue && <strong>{value}%</strong>}</div>}
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100" aria-label={label || 'Progress'}>
      <span className={`progress__fill progress__fill--${tone}`} style={{ width: `${value}%` }} />
    </div>
  </div>
}
