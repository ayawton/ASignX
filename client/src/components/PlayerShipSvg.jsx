export default function PlayerShipSvg({ skin = 'classic', className = '' }) {
  const classes = `strike-player-art strike-skin-${skin}${className ? ` ${className}` : ''}`
  if (skin === 'crimson') {
    return (
      <svg className={classes} viewBox="0 0 100 68" fill="none" aria-hidden="true">
        <path d="M50 2 62 24 96 20 82 54 60 48 56 58H44L40 48 18 54 4 20 38 24Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M50 6 59 40 55 54H45L41 40Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.2" />
        <path d="m45 28 5-10 5 10v12H45Z" fill="var(--light)" />
        <path d="M46 58h8l-4 10Z" fill="var(--light)" />
      </svg>
    )
  }
  if (skin === 'nova') {
    return (
      <svg className={classes} viewBox="0 0 100 68" fill="none" aria-hidden="true">
        <path d="M50 1 66 20 94 36 86 58 64 52 58 60H42L36 52 14 58 6 36 34 20Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M22 36 38 28 36 48 18 50Z M78 36 62 28 64 48 82 50Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.2" />
        <polygon points="50,16 58,34 50,48 42,34" fill="var(--light)" />
        <path d="M44 60h12l-6 8Z" fill="var(--light)" />
      </svg>
    )
  }
  return (
    <svg className={classes} viewBox="0 0 100 68" fill="none" aria-hidden="true">
      <path d="M50 3 64 23 93 49 94 59 63 50 57 57H43L37 50 6 59 7 49 36 23Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M50 3 62 41 57 55H43L38 41Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.2" />
      <path d="m13 51 24-13m26 0 24 13" stroke="var(--edge)" strokeWidth="2" />
      <path d="m45 30 5-9 5 9v11H45Z" fill="var(--light)" />
      <path d="M46 58h8l-4 10Z" fill="var(--light)" />
    </svg>
  )
}
