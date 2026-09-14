import { BookOpen, Compass, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { CourseCard } from '../components/Cards'
import { courses } from '../data/mockData'

export default function Courses() {
  return <>
    <PageHeader eyebrow="Course library" title="Find your learning path" description="Start with the essentials, build everyday confidence, and unlock more challenging ASL practice as you progress." />
    <section className="section section--compact"><div className="shell">
      <div className="learning-path"><div><Compass /><span><small>Your active path</small><strong>ASL Foundations</strong></span></div><p><b>4 of 8</b> beginner courses started</p></div>
      {Object.entries(courses).map(([level, items], index) => <section className="course-section" key={level}>
        <div className="course-section__heading"><span>{index === 0 ? <BookOpen /> : <Sparkles />}</span><div><h2>{level}</h2><p>{index === 0 ? 'Start here and build a strong foundation.' : index === 1 ? 'Unlock after completing three beginner courses.' : 'Advanced fluency and real-world practice.'}</p></div></div>
        <div className="course-grid">{items.map(course => <CourseCard key={course.title} course={course} level={level} />)}</div>
      </section>)}
    </div></section>
  </>
}
