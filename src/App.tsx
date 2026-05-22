import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import Onboarding from './pages/Onboarding'

type AppView = 'loading' | 'onboarding' | 'dashboard' | 'session'

interface AppUser {
  slug: string
  user_id: string
}

export default function App() {
  const [view, setView] = useState<AppView>('loading')
  const [user, setUser] = useState<AppUser | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [openingMessage, setOpeningMessage] = useState<string | null>(null)

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
          setView('dashboard')
        } else {
          setView('onboarding')
        }
      })
      .catch(() => setView('onboarding'))
  }, [])

  const handleOnboardingComplete = (slug: string) => {
    setUser({ slug, user_id: slug })
    setView('dashboard')
  }

  const handleStartSession = async () => {
    const res = await fetch('/api/session/active', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setActiveSessionId(data.session_id)
      setOpeningMessage(data.opening_message || null)
      setView('session')
    }
  }

  const handleSessionEnd = () => {
    setActiveSessionId(null)
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
    />
  )
}
