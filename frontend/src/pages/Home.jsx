import { ArrowRight, BrainCircuit, Camera, Check, Eye, GraduationCap, Hand, MessageSquareText, Play, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react'
import Button from '../components/Button'
import { FeatureCard } from '../components/Cards'
import ProgressBar from '../components/ProgressBar'

export default function Home() {
  return <>
    <section className="hero">
      <div className="hero__orb hero__orb--one" /><div className="hero__orb hero__orb--two" />
      <div className="shell hero__grid">
        <div className="hero__copy">
          <span className="eyebrow"><Sparkles size={15} /> Communication meets learning</span>
          <h1>Break Communication Barriers with <em>ASign</em></h1>
          <p>An AI-powered American Sign Language platform designed to help people communicate in the moment and learn for a lifetime.</p>
          <div className="button-row"><Button to="/live">Start interpreting <ArrowRight size={18} /></Button><Button to="/learn" variant="secondary">Start learning</Button></div>
          <div className="hero__trust"><span><Check /> Frontend demo</span><span><Check /> Accessible by design</span><span><Check /> No account needed</span></div>
        </div>
        <div className="hero-visual" aria-label="ASign application preview">
          <div className="hero-visual__glow" />
          <div className="mock-window">
            <div className="mock-window__bar"><i /><i /><i /><span>ASignLive</span></div>
            <div className="mock-camera">
              <span className="live-pill"><i /> Live demo</span>
              <div className="hand-ripple"><span><Hand size={72} strokeWidth={1.5} /></span></div>
              <div className="scan-line" />
            </div>
            <div className="mock-result"><div><small>Recognized sign</small><strong>HELLO</strong></div><span>96% match</span></div>
          </div>
          <div className="float-card float-card--xp"><Zap size={18} /><span><strong>+20 XP</strong> lesson complete</span></div>
          <div className="float-card float-card--access"><ShieldCheck size={18} /><span><strong>Privacy first</strong> browser based</span></div>
        </div>
      </div>
    </section>

    <section className="section section--intro"><div className="shell narrow center">
      <span className="eyebrow">One connected platform</span><h2>What is ASign?</h2>
      <p className="lead">ASign brings computer vision, future machine learning, and thoughtfully designed lessons into one accessible space—making ASL communication and education easier to explore.</p>
    </div></section>

    <section className="section section--no-top"><div className="shell feature-grid">
      <FeatureCard icon={Camera} eyebrow="Communicate" title="ASignLive" tone="blue" description="Use your camera to recognize ASL signs and build interpreted text. Explore the frontend simulation while our recognition model is in development." to="/live" action="Try ASignLive" />
      <FeatureCard icon={GraduationCap} eyebrow="Grow" title="ASign Learn" tone="coral" description="Build real skills with structured lessons, quizzes, camera practice, XP, streaks, achievements, and visible progress." to="/learn" action="Start learning" />
    </div></section>

    <section className="section section--tint"><div className="shell">
      <div className="section-heading center"><span className="eyebrow">Simple by design</span><h2>How ASignLive works</h2><p>Three steps turn signing into understandable text.</p></div>
      <div className="steps">
        {[{ icon: Camera, n: '01', title: 'Enable camera', text: 'Allow camera access when you are ready to begin.' }, { icon: Hand, n: '02', title: 'Perform an ASL sign', text: 'Position your hand clearly inside the camera frame.' }, { icon: MessageSquareText, n: '03', title: 'View the meaning', text: 'See the predicted sign and build a readable sentence.' }].map(({ icon: Icon, n, title, text }, i) => <article className="step" key={title}><span className="step__number">{n}</span><div className="step__icon"><Icon /></div><h3>{title}</h3><p>{text}</p>{i < 2 && <ArrowRight className="step__arrow" />}</article>)}
      </div>
    </div></section>

    <section className="section"><div className="shell split-section">
      <div><span className="eyebrow">Learn at your pace</span><h2>A little progress, every day</h2><p className="lead">Short, focused lessons help you build practical signing skills without feeling overwhelmed.</p>
        <ul className="check-list"><li><Check /> Structured learning paths</li><li><Check /> Interactive practice and feedback</li><li><Check /> Progress you can actually see</li></ul>
        <Button to="/learn">Explore ASign Learn <ArrowRight size={18} /></Button>
      </div>
      <article className="learn-preview">
        <div className="learn-preview__top"><div><span className="mini-label">Continue learning</span><h3>Friendly Greetings</h3></div><span className="streak">🔥 7 day streak</span></div>
        <div className="lesson-art"><div className="lesson-art__rings"><Hand size={64} /></div><span>Lesson 3 of 7</span></div>
        <ProgressBar value={42} label="Course progress" />
        <div className="preview-stats"><span><strong>860</strong> Total XP</span><span><strong>18</strong> Signs learned</span></div>
        <Button to="/learn/lesson/1" className="full">Continue lesson <Play size={16} fill="currentColor" /></Button>
      </article>
    </div></section>

    <section className="section section--tint"><div className="shell">
      <div className="section-heading center"><span className="eyebrow">Built with purpose</span><h2>Why use ASign?</h2></div>
      <div className="benefit-grid">
        {[{ icon: BrainCircuit, title: 'AI-powered recognition', text: 'Designed for future real-time sign recognition through computer vision.' }, { icon: Target, title: 'Interactive learning', text: 'Practice with purposeful exercises and helpful, immediate feedback.' }, { icon: Eye, title: 'Accessible communication', text: 'A clear interface that supports more inclusive everyday interactions.' }, { icon: Zap, title: 'Progress tracking', text: 'Stay motivated with XP, streaks, mastery scores, and achievements.' }].map(({ icon: Icon, title, text }) => <article className="benefit-card" key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </div></section>

    <section className="section"><div className="shell cta"><div><span className="eyebrow eyebrow--light">Your next sign starts here</span><h2>Ready to communicate and learn with ASign?</h2><p>Explore the interpreter demo or begin your first ASL lesson today.</p></div><div className="button-row"><Button to="/live" variant="white">Try ASignLive</Button><Button to="/learn" variant="outline-light">Learn ASL</Button></div></div></section>
  </>
}
