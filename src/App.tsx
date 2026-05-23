import { useState, useEffect, useRef } from 'react'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import Onboarding from './pages/Onboarding'

type AppView = 'loading' | 'onboarding' | 'dashboard' | 'session'
type Quadrant = 'sanctuary' | 'sandbox' | 'system' | 'workbench'

interface AppUser {
  slug: string
  user_id: string
}

function phaseToQuadrant(phase: string): Quadrant {
  switch (phase) {
    case 'interview':       return 'sanctuary'
    case 'reflection':
    case 'clarity':         return 'sandbox'
    case 'resistance':      return 'system'
    case 'commitment':
    case 'accountability':  return 'workbench'
    default:                return 'sanctuary'
  }
}

export default function App() {
  const [view, setView] = useState<AppView>('loading')
  const [user, setUser] = useState<AppUser | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [openingMessage, setOpeningMessage] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<string>('phase_0')
  const prevQuadrantRef = useRef<Quadrant>('sanctuary')

  // Apply quadrant to <html> data attribute; trigger snap animation on sandbox→system
  useEffect(() => {
    const q = phaseToQuadrant(currentPhase)
    const prev = prevQuadrantRef.current
    const root = document.documentElement

    if (prev === 'sandbox' && q === 'system') {
      root.classList.add('is-snapping')
      setTimeout(() => root.classList.remove('is-snapping'), 700)
    }

    root.dataset.quadrant = q
    prevQuadrantRef.current = q
  }, [currentPhase])

  // Check auth on mount
  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json()
        return null
      })
      .then(data => {
        if (data?.profile) {
          setUser({ slug: data.profile.slug, user_id: data.profile.slug })
          setCurrentPhase(data.profile.current_phase || 'phase_0')
          setView('dashboard')
        } else {
          setView('onboarding')
        }
      })
      .catch(() => setView('onboarding'))
  }, [])

  const handleOnboardingComplete = (slug: string) => {
    setUser({ slug, user_id: slug })
    setCurrentPhase('interview')
    setView('dashboard')
  }

  const handleStartSession = async () => {
    const res = await fetch('/api/session/active', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setActiveSessionId(data.session_id)
      setOpeningMessage(data.opening_message || null)
      if (data.phase) setCurrentPhase(data.phase)
      setView('session')
    }
  }

  const handleSessionEnd = () => {
    setActiveSessionId(null)
    // Re-fetch dashboard to get updated phase after session
    fetch('/api/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.profile?.current_phase) setCurrentPhase(data.profile.current_phase)
      })
      .catch(() => {})
    setView('dashboard')
  }

  if (view === 'loading') {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center' }}>
        <span className="label">Loading…</span>
      </div>
    )
  }

  if (view === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (view === 'session' && activeSessionId) {
    return (
      <Session
        sessionId={activeSessionId}
        openingMessage={openingMessage}
        onEnd={handleSessionEnd}
      />
    )
  }

  return (
    <Dashboard
      slug={user?.slug || ''}
      onStartSession={handleStartSession}
      onPhaseChange={setCurrentPhase}
    />
  )
}
