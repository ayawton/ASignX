import { Compass } from 'lucide-react'
import Button from '../components/Button'

export default function NotFound() {
  return <section className="not-found"><div><div className="not-found__icon"><Compass size={44} /></div><h1>404</h1><h2>This path has no sign yet</h2><p>The page you’re looking for may have moved or does not exist.</p><Button to="/">Back to home</Button></div></section>
}
