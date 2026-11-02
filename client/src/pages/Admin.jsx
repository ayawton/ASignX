import { useEffect, useState } from 'react'
import { api } from '../auth'
import { Link } from 'react-router-dom'
import { Pencil, FilePenLine, CheckCircle2, Archive, BookOpen } from 'lucide-react'
import CourseCard from '../components/CourseCard'
import './Admin.css'

function CourseCollection({ title, courses, archived = false }) {
 return <section className="admin-course-collection" aria-label={title}>
  <div className="admin-collection-heading"><h2>{title}</h2><span>{courses.length} {courses.length===1?'course':'courses'}</span></div>
  {!archived && <div className="course-status-legend" aria-label="Course status legend"><span><FilePenLine size={14} aria-hidden="true"/>Draft</span><span><CheckCircle2 size={14} aria-hidden="true"/>Published</span><span><Archive size={14} aria-hidden="true"/>Archived</span></div>}
  {archived && <p className="admin-collection-description">Hidden from learners. Open a course to restore it or create a draft copy.</p>}
  {courses.length ? <div className="studio-course-grid">{courses.map(course => <CourseCard course={course} key={course.id} titleAction={<Link className="course-card-edit" to={`/dashboard/admin/courses/${course.id}/edit`} aria-label={`Edit details and graphic for ${course.title}`} title="Edit details and graphic"><Pencil size={18} aria-hidden="true"/></Link>}>
   <div className="admin-course-footer"><div className="admin-actions"><Link className="btn btn-secondary" to={`/dashboard/admin/courses/${course.id}`}><BookOpen size={15} aria-hidden="true"/>{course.is_published||course.is_archived?'View content':'Manage content'}</Link></div><span role="img" title={course.is_published?'Published':course.is_archived?'Archived':'Draft'} aria-label={course.is_published?'Published':course.is_archived?'Archived':'Draft'} className={`course-status-badge status-${course.is_published?'published':course.is_archived?'archived':'draft'}`}>{course.is_published?<CheckCircle2 size={14} aria-hidden="true"/>:course.is_archived?<Archive size={14} aria-hidden="true"/>:<FilePenLine size={14} aria-hidden="true"/>}</span></div>
  </CourseCard>)}</div> : <p>No current courses. Create a draft course to get started.</p>}
 </section>
}
export default function Admin() {
 const [courses,setCourses]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;api('/admin/courses').then(rows=>{if(active){setCourses(rows);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[retry])
 const current = courses?.filter(course=>!course.is_archived) || []
 const archived = courses?.filter(course=>course.is_archived) || []
 return <section className="admin-course-list studio-section studio-page">
  <header className="admin-courses-heading"><div><span className="text-label">Administration</span><h1>Manage courses</h1><p>Organize lessons and publish courses for your learners.</p></div><div className="admin-actions import-entry-actions"><Link className="btn btn-secondary" to="/dashboard/admin/courses/import">Import from text</Link><Link className="btn" to="/dashboard/admin/courses/new">Create a draft course</Link></div></header>
  {error?<div role="alert"><p>{error}</p><button className="btn" onClick={()=>setRetry(v=>v+1)}>Try again</button></div>:!courses?<p role="status">Loading courses…</p>:courses.length?<>
   <CourseCollection title="Current courses" courses={current}/>
   {archived.length>0 && <CourseCollection title="Archived courses" courses={archived} archived/>}
  </>:<div className="studio-empty"><h2>No courses yet.</h2><p>Create a draft course to get started.</p></div>}
 </section>
}
