import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from './components/StudioKit'
import PublishedCourses from './PublishedCourses'

export default function LearnPreview() {
 return <section className="container studio-section studio-page learn-preview">
  <div className="page-heading"><div><h1>Try your first ASL lesson.</h1><p>Get to know a sign, try the handshape, and check your understanding. No account needed for the sample.</p></div></div>
  <article className="preview-sample">
   <div className="preview-letter" aria-hidden="true"><BookOpen size={36} /><strong>A</strong><span>The ASL alphabet</span></div>
   <div className="preview-sample-copy"><span className="text-label">Sample lesson</span><h2>Meet the letter A</h2><p>Learn where your thumb rests and try a short knowledge check. You can finish the whole sample before deciding to join.</p><p className="preview-detail">Written signing guide · One question</p><Button to="/learn/lesson/1">Try the sample lesson <ArrowRight size={18} /></Button><p className="preview-detail">Sample progress isn’t saved to an account. No account XP is awarded.</p></div>
  </article>
  <section className="preview-membership" aria-labelledby="preview-membership-title"><div><h2 id="preview-membership-title">Ready to keep learning?</h2><p>Create an account to enroll in full courses, save your answers and lesson progress, and earn XP as you complete lessons.</p></div><div><Button to="/register?next=/dashboard/learn/courses">Create an account</Button><a className="text-link" href="/login?next=/dashboard/learn/courses">Already have an account? Log in</a></div></section>
  <PublishedCourses />
 </section>
}
