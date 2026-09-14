import { BriefcaseBusiness, Code2, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function Footer() {
  return <footer className="footer">
    <div className="shell footer__grid">
      <div className="footer__brand">
        <Logo light />
        <p>Bringing communication and learning together through accessible ASL technology.</p>
      </div>
      <div>
        <h3>Explore</h3>
        <Link to="/">Home</Link><Link to="/live">ASignLive</Link><Link to="/learn">Learn</Link><Link to="/about">About</Link>
      </div>
      <div>
        <h3>Learning</h3>
        <Link to="/learn/courses">Courses</Link><Link to="/progress">Progress</Link><Link to="/profile">Profile</Link>
      </div>
      <div>
        <h3>Stay connected</h3>
        <div className="socials" aria-label="Information links">
          <a href="mailto:hello@asign.demo" aria-label="Email ASign"><Mail /></a>
          <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"><Code2 /></a>
          <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><BriefcaseBusiness /></a>
        </div>
      </div>
    </div>
    <div className="shell footer__bottom"><span>© {new Date().getFullYear()} ASign. Academic project demo.</span><span>Built with accessibility in mind.</span></div>
  </footer>
}
