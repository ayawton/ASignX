export default function LessonJourney({ stage }) {
 const steps=['Study','Check','Complete']
 return <ol className="lesson-journey" aria-label="Lesson stages">{steps.map((label,index)=><li key={label} aria-current={stage===index?'step':undefined} className={index<stage?'is-done':''}><span aria-hidden="true">{index<stage?'✓':index+1}</span>{label}</li>)}</ol>
}
