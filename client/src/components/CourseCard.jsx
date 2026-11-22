import CourseCover from './CourseCover'
export default function CourseCard({ course, children, heading = 'h3', titleAction }) {
 const Heading = heading
 return <article className="studio-course published-course-card"><CourseCover course={course}/><div className="course-card-heading"><Heading className="course-card-title">{course.title}</Heading>{titleAction}</div>{course.description && <p className="course-card-description">{course.description}</p>}<div className="course-card-actions">{children}</div></article>
}
