export default function PageHeader({ eyebrow, title, description, children, centered = false }) {
  return <section className={`page-header ${centered ? 'page-header--centered' : ''}`}>
    <div className="shell">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  </section>
}
