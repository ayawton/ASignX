import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import About from './pages/About'
import { Login, Register } from './pages/Auth'
import Courses from './pages/Courses'
import Home from './pages/Home'
import Learn from './pages/Learn'
import Lesson from './pages/Lesson'
import Live from './pages/Live'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import Progress from './pages/Progress'

export default function App() {
  return <Routes><Route element={<Layout />}><Route path="/" element={<Home />} /><Route path="/live" element={<Live />} /><Route path="/learn" element={<Learn />} /><Route path="/learn/courses" element={<Courses />} /><Route path="/learn/lesson/:id" element={<Lesson />} /><Route path="/progress" element={<Progress />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/profile" element={<Profile />} /><Route path="/about" element={<About />} /><Route path="*" element={<NotFound />} /></Route></Routes>
}
