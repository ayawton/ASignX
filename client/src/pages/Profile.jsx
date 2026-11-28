import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bird, Cat, Check, Compass, Flame, Gamepad2, Hand, Heart, Lock, Pencil, Rocket, Sprout, Star, Trophy, X } from 'lucide-react'
import Link from '../components/WorkspaceLink'
import { api, useAuth } from '../auth'
import { BadgeArt } from '../components/Achievements'
import BadgeTypeGroups from '../components/BadgeTypeGroups'
import PlayerShipSvg from '../components/PlayerShipSvg'
import { readFeaturedShipSkins, saveFeaturedShipSkins, SHIP_SKINS, unlockedShipSkins } from '../data/arcade'
import { badgeTiers } from '../data/badge-design'
import { DEFAULT_AVATAR, PRESET_AVATARS, levelFromXp, normalizeAvatar, readMinigameHighscores, resolveFeaturedBadges } from '../data/profile'
import './Profile.css'

const AVATAR_ICONS = {
  wave: Hand,
  love: Heart,
  owl: Bird,
  fox: Cat,
  star: Star,
  rocket: Rocket,
  sprout: Sprout,
  compass: Compass,
}

function AvatarGlyph({ avatarId, size = 40 }) {
  const Icon = AVATAR_ICONS[normalizeAvatar(avatarId)] || Hand
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
}

function avatarTone(avatarId) {
  const preset = PRESET_AVATARS.find(item => item.id === normalizeAvatar(avatarId))
  return preset?.tone || 'blue'
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ display_name: '', timezone: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const [customizingHall, setCustomizingHall] = useState(false)
  const [draftFeatured, setDraftFeatured] = useState([])
  const [customizingShips, setCustomizingShips] = useState(false)
  const [draftShips, setDraftShips] = useState([])
  const [progress, setProgress] = useState(null)
  const [progressError, setProgressError] = useState('')
  const [progressRetry, setProgressRetry] = useState(0)
  const [highscores] = useState(() => readMinigameHighscores())
  const [unlockedSkins] = useState(() => unlockedShipSkins())
  const [featuredShipIds, setFeaturedShipIds] = useState(() => readFeaturedShipSkins())
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    api('/me/profile')
      .then(data => {
        if (!active) return
        setProfile(data)
        setForm({ display_name: data.display_name || '', timezone: data.timezone || 'UTC' })
      })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])

  const profileId = profile?.id
  const profileRole = profile?.role

  useEffect(() => {
    if (!profileId || profileRole === 'admin') return
    let active = true
    api('/me/progress')
      .then(data => { if (active) setProgress(data) })
      .catch(() => { if (active) setProgressError('Unable to load your level and badges.') })
    return () => { active = false }
  }, [profileId, profileRole, progressRetry])

  async function patchProfile(payload, successText) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await api('/me/profile', { method: 'PATCH', body: JSON.stringify(payload) })
      setProfile(updated)
      setForm({ display_name: updated.display_name || '', timezone: updated.timezone || 'UTC' })
      setMessage(successText)
      return updated
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails(e) {
    e.preventDefault()
    const saved = await patchProfile(
      { display_name: form.display_name, timezone: form.timezone },
      'Your profile details are saved.',
    )
    if (saved) setEditingDetails(false)
  }

  async function chooseAvatar(avatarId) {
    const saved = await patchProfile({ avatar: avatarId }, 'Your avatar is updated.')
    if (saved) setPickingAvatar(false)
  }

  function openHallCustomizer() {
    const earned = progress?.achievements ?? []
    const current = resolveFeaturedBadges(earned, profile?.featured_achievements).map(b => b.id)
    setDraftFeatured(current)
    setCustomizingHall(true)
  }

  useEffect(() => {
    if (!customizingHall && !customizingShips) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !busy) {
        setCustomizingHall(false)
        setCustomizingShips(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [customizingHall, customizingShips, busy])

  function toggleDraftBadge(id) {
    setDraftFeatured(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  async function saveHall() {
    const saved = await patchProfile(
      { featured_achievements: draftFeatured },
      'Your Achievement Hall is updated.',
    )
    if (saved) setCustomizingHall(false)
  }

  function openShipCustomizer() {
    setDraftShips(featuredShipIds)
    setCustomizingShips(true)
  }

  function toggleDraftShip(id) {
    setDraftShips(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id)
      if (prev.length >= 5) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  function saveShipHall() {
    const saved = saveFeaturedShipSkins(draftShips, unlockedSkins)
    setFeaturedShipIds(saved)
    setCustomizingShips(false)
    setMessage('Your Ship Hangar is updated.')
  }

  async function leave() {
    setBusy(true)
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const isAdmin = profileRole === 'admin'
  const allBadges = progress?.badges ?? progress?.achievements ?? []
  const hiddenBadges = allBadges.filter(badge => badge.hidden && !badge.metric)
  const earnedBadges = progress?.achievements ?? []
  const featuredBadges = resolveFeaturedBadges(earnedBadges, profile?.featured_achievements)
  const featuredShips = featuredShipIds
    .map(id => SHIP_SKINS.find(item => item.id === id))
    .filter(Boolean)
  const completedLessons = progress?.lessons?.filter(lesson => lesson.completed_at).length ?? 0
  const levelInfo = levelFromXp(progress?.xp ?? 0)
  const currentAvatar = normalizeAvatar(profile?.avatar ?? DEFAULT_AVATAR)
  const roleLabel = isAdmin ? 'Admin' : profileRole === 'guest' ? 'Guest' : 'Learner'
  const joinedLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '—'

  function renderHallPickerCard(badge) {
    const unlocked = Boolean(badge.unlocked_at)
    const slotIndex = draftFeatured.indexOf(badge.id)
    const selected = unlocked && slotIndex >= 0
    return (
      <li key={badge.id}>
        <button
          type="button"
          className={`hall-picker-card${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}`}
          disabled={!unlocked || busy}
          aria-pressed={unlocked ? selected : undefined}
          onClick={() => { if (unlocked) toggleDraftBadge(badge.id) }}
        >
          {selected && (
            <span className="hall-picker-selected">
              <Check size={12} aria-hidden="true" />
              {slotIndex + 1}
            </span>
          )}
          {!unlocked && (
            <span className="hall-picker-lock">
              <Lock size={12} aria-hidden="true" />
              {badge.hidden ? 'Secret' : 'Locked'}
            </span>
          )}
          <BadgeArt badge={badge} />
          <span className="hall-picker-name">{badge.name}</span>
          {!badge.hidden && (
            <span className="hall-picker-tier">{badgeTiers[badge.tier || 'starter']}</span>
          )}
        </button>
      </li>
    )
  }

  return (
    <section className="container studio-section studio-page achievement-page profile-page">
      {message && <p className="badge-feedback" role="status">{message}</p>}
      {error && <p className="badge-feedback is-error" role="alert">{error}</p>}

      {!profile ? (
        !error && <p role="status">Loading your profile…</p>
      ) : (
        <>
          {/* Top Row: Profile Picture & Core Summary (Left) + Achievement Hall (Right) */}
          <div className={`profile-top-row${isAdmin ? ' is-single' : ''}`}>
            <section className="profile-panel profile-identity-card" aria-label="Profile summary">
              <div className="profile-avatar-wrap">
                <div
                  className={`profile-avatar profile-avatar-${avatarTone(currentAvatar)}`}
                  aria-label={`Avatar: ${PRESET_AVATARS.find(a => a.id === currentAvatar)?.label || 'Waving hand'}`}
                >
                  <AvatarGlyph avatarId={currentAvatar} size={42} />
                </div>
                <button
                  type="button"
                  className="profile-avatar-edit"
                  aria-label="Choose preset avatar"
                  aria-expanded={pickingAvatar}
                  disabled={busy}
                  onClick={() => setPickingAvatar(open => !open)}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              </div>

              {pickingAvatar && (
                <div className="profile-avatar-picker" role="region" aria-label="Preset avatars">
                  <p>Choose a preset avatar</p>
                  <div className="profile-avatar-grid">
                    {PRESET_AVATARS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`profile-avatar-option profile-avatar-${preset.tone}`}
                        aria-label={preset.label}
                        aria-pressed={currentAvatar === preset.id}
                        disabled={busy}
                        onClick={() => chooseAvatar(preset.id)}
                      >
                        <AvatarGlyph avatarId={preset.id} size={20} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="profile-identity">
                <h1>{profile.display_name}</h1>
                <span className="profile-role-tag">{roleLabel}</span>
                {profileRole === 'guest' && (
                  <p className="profile-meta">Temporary guest session</p>
                )}
              </div>

              {!isAdmin && (
                <div className="profile-level-compact" aria-label="Level and experience">
                  {progressError ? (
                    <p role="alert">
                      {progressError}{' '}
                      <button type="button" className="text-link" onClick={() => { setProgressError(''); setProgressRetry(v => v + 1) }}>
                        Retry
                      </button>
                    </p>
                  ) : !progress ? (
                    <p role="status">Loading level…</p>
                  ) : (
                    <>
                      <div className="profile-level-top">
                        <span className="profile-level-title">
                          <span className="profile-level-badge">Lvl {levelInfo.level}</span>
                          <span>{levelInfo.title}</span>
                        </span>
                        <span className="profile-xp-numbers">{levelInfo.currentXp} / {levelInfo.nextLevelXp} XP</span>
                      </div>
                      <div
                        className="profile-xp-track"
                        role="progressbar"
                        aria-label="Level experience progress"
                        aria-valuenow={levelInfo.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="profile-xp-fill" style={{ width: `${levelInfo.percent}%` }} />
                      </div>
                      <div className="profile-level-bottom">
                        <span>{levelInfo.remainingXp} XP to Lvl {levelInfo.level + 1}</span>
                        <span><Flame size={12} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: '3px' }} />{progress.streak}d streak</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {!isAdmin && (
              <section className="profile-panel profile-hall-section" aria-labelledby="achievement-hall-heading">
                <div className="profile-section-head">
                  <div>
                    <h2 id="achievement-hall-heading">Achievement Hall</h2>
                    <p>Showcase up to 3 earned badges.</p>
                  </div>
                  <div className="profile-section-actions">
                    {allBadges.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        aria-haspopup="dialog"
                        disabled={busy}
                        onClick={openHallCustomizer}
                      >
                        Customize Hall
                      </button>
                    )}
                    <Link className="text-link" to="/progress#achievements">
                      View collection
                    </Link>
                  </div>
                </div>

                {progressError ? (
                  <p className="badge-feedback is-error" role="alert">
                    {progressError}{' '}
                    <button type="button" className="text-link" onClick={() => { setProgressError(''); setProgressRetry(v => v + 1) }}>
                      Retry
                    </button>
                  </p>
                ) : !progress ? (
                  <p role="status">Loading your Achievement Hall…</p>
                ) : (
                  <div className="achievement-hall-frame">
                    {featuredBadges.length ? (
                      <ul className="achievement-hall-grid">
                        {featuredBadges.map(badge => (
                          <li key={badge.id} className="hall-slot">
                            <BadgeArt badge={badge} />
                            <span className="hall-slot-name">{badge.name}</span>
                            <span className="hall-slot-tier">{badgeTiers[badge.tier || 'starter']}</span>
                          </li>
                        ))}
                        {Array.from({ length: Math.max(0, 3 - featuredBadges.length) }).map((_, index) => (
                          <li key={`empty-${index}`} className="hall-slot hall-slot-empty">
                            <Trophy size={22} aria-hidden="true" />
                            <span>Open slot</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="hall-empty-state">
                        <Trophy size={28} aria-hidden="true" />
                        <p>Complete lessons and practice rounds to earn badges and showcase them here.</p>
                      </div>
                    )}
                  </div>
                )}

                {customizingHall && (
                  <div
                    className="hall-modal-backdrop"
                    onClick={e => { if (e.target === e.currentTarget && !busy) setCustomizingHall(false) }}
                  >
                    <div
                      className="hall-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="hall-modal-title"
                    >
                      <div className="hall-modal-head">
                        <div>
                          <h2 id="hall-modal-title">Customize Achievement Hall</h2>
                          <p>Choose up to 3 unlocked badges to showcase on your profile.</p>
                        </div>
                        <button
                          type="button"
                          className="hall-modal-close"
                          aria-label="Close"
                          disabled={busy}
                          onClick={() => setCustomizingHall(false)}
                        >
                          <X size={20} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="hall-modal-body">
                        <BadgeTypeGroups badges={allBadges} renderCard={renderHallPickerCard} />
                        {hiddenBadges.length > 0 && (
                          <section className="badge-type-group hall-discoveries-group">
                            <header>
                              <h2>Discoveries</h2>
                              <span>{hiddenBadges.length} {hiddenBadges.length === 1 ? 'badge' : 'badges'}</span>
                            </header>
                            <ul className="catalog-grid">
                              {hiddenBadges.map(renderHallPickerCard)}
                            </ul>
                          </section>
                        )}
                      </div>

                      <div className="hall-modal-foot">
                        <span className="hall-modal-count">{draftFeatured.length} of 3 selected</span>
                        <div className="profile-form-actions">
                          <button type="button" className="hall-modal-cancel" disabled={busy} onClick={() => setCustomizingHall(false)}>
                            Cancel
                          </button>
                          <button type="button" className="btn" disabled={busy || earnedBadges.length === 0} onClick={saveHall}>
                            Save Hall
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          {!isAdmin && (
            <section className="profile-panel profile-hall-section" aria-labelledby="ship-hangar-heading">
              <div className="profile-section-head">
                <div>
                  <h2 id="ship-hangar-heading">Ship Hangar</h2>
                  <p>Showcase up to 5 unlocked Sign Strike ships.</p>
                </div>
                <div className="profile-section-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-haspopup="dialog"
                    disabled={busy}
                    onClick={openShipCustomizer}
                  >
                    Customize Ships
                  </button>
                  <Link className="text-link" to="/learn/arcade">
                    Play Sign Strike
                  </Link>
                </div>
              </div>

              <div className="achievement-hall-frame">
                <ul className="achievement-hall-grid ship-hangar-grid">
                  {featuredShips.map(ship => (
                    <li key={ship.id} className="hall-slot">
                      <span className="hall-ship-art">
                        <PlayerShipSvg skin={ship.id} />
                      </span>
                      <span className="hall-slot-name">{ship.name}</span>
                      <span className="hall-slot-tier">{ship.minScore === 0 ? 'Starter' : ship.requirement}</span>
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - featuredShips.length) }).map((_, index) => (
                    <li key={`empty-ship-${index}`} className="hall-slot hall-slot-empty">
                      <Rocket size={22} aria-hidden="true" />
                      <span>Open slot</span>
                    </li>
                  ))}
                </ul>
              </div>

              {customizingShips && (
                <div
                  className="hall-modal-backdrop"
                  onClick={e => { if (e.target === e.currentTarget && !busy) setCustomizingShips(false) }}
                >
                  <div
                    className="hall-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ship-modal-title"
                  >
                    <div className="hall-modal-head">
                      <div>
                        <h2 id="ship-modal-title">Customize Ship Hangar</h2>
                        <p>Choose up to 5 unlocked ships to showcase on your profile.</p>
                      </div>
                      <button
                        type="button"
                        className="hall-modal-close"
                        aria-label="Close"
                        disabled={busy}
                        onClick={() => setCustomizingShips(false)}
                      >
                        <X size={20} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="hall-modal-body">
                      <ul className="catalog-grid">
                        {SHIP_SKINS.map(ship => {
                          const unlocked = unlockedSkins.includes(ship.id)
                          const slotIndex = draftShips.indexOf(ship.id)
                          const selected = unlocked && slotIndex >= 0
                          return (
                            <li key={ship.id}>
                              <button
                                type="button"
                                className={`hall-picker-card${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}`}
                                disabled={!unlocked || busy}
                                aria-pressed={unlocked ? selected : undefined}
                                onClick={() => { if (unlocked) toggleDraftShip(ship.id) }}
                              >
                                {selected && (
                                  <span className="hall-picker-selected">
                                    <Check size={12} aria-hidden="true" />
                                    {slotIndex + 1}
                                  </span>
                                )}
                                {!unlocked && (
                                  <span className="hall-picker-lock">
                                    <Lock size={12} aria-hidden="true" />
                                    Locked
                                  </span>
                                )}
                                <span className="profile-hangar-bay">
                                  <PlayerShipSvg skin={ship.id} />
                                </span>
                                <span className="hall-picker-name">{ship.name}</span>
                                <span className="hall-picker-tier">{ship.minScore === 0 ? 'Unlocked' : ship.requirement}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    <div className="hall-modal-foot">
                      <span className="hall-modal-count">{draftShips.length} of 5 selected</span>
                      <div className="profile-form-actions">
                        <button type="button" className="hall-modal-cancel" disabled={busy} onClick={() => setCustomizingShips(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn" disabled={busy} onClick={saveShipHall}>
                          Save Ships
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <hr className="profile-divider" />

          {/* Lower Area: User Information & Stats (Left) + Minigame Highscores (Right) */}
          <div className={`profile-lower-grid${isAdmin ? ' is-single' : ''}`}>
            <div className="profile-info-stack">
              <section className="profile-panel" aria-labelledby="account-details-heading">
                <div className="profile-section-head" style={{ marginBottom: '18px' }}>
                  <div>
                    <h2 id="account-details-heading">Basic Details</h2>
                    <p>{profileRole === 'guest' ? 'Saved for this guest session only.' : 'Saved to your ASignX account.'}</p>
                  </div>
                  <div className="profile-section-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      aria-expanded={editingDetails}
                      onClick={() => {
                        setForm({ display_name: profile.display_name || '', timezone: profile.timezone || 'UTC' })
                        setEditingDetails(open => !open)
                      }}
                    >
                      {editingDetails ? 'Cancel' : 'Edit details'}
                    </button>
                  </div>
                </div>

                {editingDetails ? (
                  <form className="profile-details-form" onSubmit={saveDetails}>
                    <label>
                      <span>Display name<span className="profile-required" aria-label="Required">*</span></span>
                      <input
                        required
                        maxLength={100}
                        value={form.display_name}
                        onChange={e => setForm(prev => ({ ...prev, display_name: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Email address</span>
                      <input disabled value={profile.email || ''} />
                    </label>
                    <label>
                      <span>Time zone<span className="profile-required" aria-label="Required">*</span></span>
                      <input
                        required
                        maxLength={64}
                        placeholder="Asia/Manila"
                        value={form.timezone}
                        onChange={e => setForm(prev => ({ ...prev, timezone: e.target.value }))}
                      />
                    </label>
                    <div className="profile-form-actions">
                      <button type="submit" className="btn" disabled={busy}>
                        Save changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="profile-details-list">
                    <div className="profile-details-row">
                      <dt>Display name</dt>
                      <dd>{profile.display_name}</dd>
                    </div>
                    <div className="profile-details-row">
                      <dt>Email</dt>
                      <dd>{profile.email || 'Guest account'}</dd>
                    </div>
                    <div className="profile-details-row">
                      <dt>Time zone</dt>
                      <dd>{profile.timezone}</dd>
                    </div>
                    <div className="profile-details-row">
                      <dt>Member since</dt>
                      <dd>{joinedLabel}</dd>
                    </div>
                  </dl>
                )}
              </section>

              {!isAdmin && progress && (
                <section className="profile-panel" aria-labelledby="learning-summary-heading">
                  <div className="profile-section-head" style={{ marginBottom: '16px' }}>
                    <div>
                      <h2 id="learning-summary-heading">Learning Summary</h2>
                      <p>Your overall progress across ASignX.</p>
                    </div>
                  </div>
                  <div className="profile-stats-grid">
                    <div className="profile-stat-tile">
                      <strong>{levelInfo.totalXp.toLocaleString()}</strong>
                      <span>Total XP</span>
                    </div>
                    <div className="profile-stat-tile">
                      <strong>{completedLessons}</strong>
                      <span>Lessons completed</span>
                    </div>
                    <div className="profile-stat-tile">
                      <strong>{earnedBadges.length}</strong>
                      <span>Badges earned</span>
                    </div>
                    <div className="profile-stat-tile">
                      <strong>{progress.streak}</strong>
                      <span>Day streak</span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {!isAdmin && (
              <section className="profile-panel" aria-labelledby="highscores-heading">
                <div className="profile-section-head">
                  <div>
                    <h2 id="highscores-heading">Minigame Highscores</h2>
                    <p>Best ASignStrike scores saved in this browser.</p>
                  </div>
                  <div className="profile-section-actions">
                    <Link className="btn" to="/learn/arcade">
                      <Gamepad2 size={16} aria-hidden="true" />
                      Play Sign Strike
                    </Link>
                  </div>
                </div>

                <div className="highscore-stack">
                  {highscores.map(mode => (
                    <article key={mode.key} className="highscore-card">
                      <div className="highscore-card-head">
                        <h3>{mode.title}</h3>
                        <span className="highscore-game-label">ASignStrike</span>
                      </div>
                      <dl className="highscore-list">
                        <div className="highscore-row">
                          <dt>
                            Camera
                            {mode.camera.pace && <small>{mode.camera.pace}</small>}
                          </dt>
                          <dd className={mode.camera.score ? '' : 'is-empty'}>
                            {mode.camera.score ? `${mode.camera.score.toLocaleString()} pts` : '—'}
                          </dd>
                        </div>
                        <div className="highscore-row">
                          <dt>
                            Keyboard
                            {mode.keyboard.pace && <small>{mode.keyboard.pace}</small>}
                          </dt>
                          <dd className={mode.keyboard.score ? '' : 'is-empty'}>
                            {mode.keyboard.score ? `${mode.keyboard.score.toLocaleString()} pts` : '—'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="profile-footer-actions">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={leave}>
              Log out
            </button>
          </div>
        </>
      )}
    </section>
  )
}
