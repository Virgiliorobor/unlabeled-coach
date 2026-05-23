import { useState } from 'react'

interface Props {
  onComplete: (slug: string) => void
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<'welcome' | 'register' | 'login'>('welcome')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function slugify(str: string): string {
    return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  }

  async function handleRegister(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (!email || !name) return
    setLoading(true)
    setError('')

    const slug = slugify(name)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, slug, display_name: name })
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    onComplete(data.slug)
  }

  async function handleLogin(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok || !data.slug) {
      setError('No account found for that email address.')
      return
    }

    onComplete(data.slug)
  }

  if (step === 'welcome') {
    return (
      <div className="sanctuary-page">
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <span className="sanctuary-wordmark">Unlabeled</span>
        </div>

        <h1 className="sanctuary-headline">
          You're already doing the work.<br />
          You just haven't claimed it yet.
        </h1>

        <p className="sanctuary-body">
          A structured self-reflection coach for solo builders in identity transition.
          Not a productivity tool. Not therapy. The thing you use when you already know
          what you should be doing and you're still not doing it.
        </p>

        <button className="sanctuary-cta" onClick={() => setStep('register')}>
          Begin
        </button>

        <p style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem' }}>
          <button
            onClick={() => { setStep('login'); setError('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
          >
            Already have an account? Sign in
          </button>
        </p>
      </div>
    )
  }

  if (step === 'login') {
    return (
      <div className="sanctuary-page">
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button className="sanctuary-back" onClick={() => { setStep('welcome'); setError('') }}>
            ← Back
          </button>
        </div>

        <h2 className="sanctuary-subhead">Welcome back.</h2>
        <p className="sanctuary-body" style={{ marginBottom: 'var(--space-lg)' }}>
          Enter the email you registered with.
        </p>

        <form onSubmit={handleLogin} className="sanctuary-form">
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoFocus
            />
          </div>

          {error && (
            <p style={{ color: 'var(--accent)', marginBottom: 'var(--space-sm)', fontSize: '0.85rem' }}>
              {error}
            </p>
          )}

          <button
            className="sanctuary-cta"
            type="submit"
            disabled={loading || !email}
            style={{ opacity: loading || !email ? 0.5 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="sanctuary-page">
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button
          className="sanctuary-back"
          onClick={() => { setStep('welcome'); setError('') }}
        >
          ← Back
        </button>
      </div>

      <h2 className="sanctuary-subhead">Let's start with the basics.</h2>
      <p className="sanctuary-body" style={{ marginBottom: 'var(--space-lg)' }}>
        Your first session will begin after this. The coach will ask the real questions there.
      </p>

      <form onSubmit={handleRegister} className="sanctuary-form">
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="First name or whatever you go by"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="For daily signals and reminders"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--accent)', marginBottom: 'var(--space-sm)', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}

        <button
          className="sanctuary-cta"
          type="submit"
          disabled={loading || !email || !name}
          style={{ opacity: loading || !email || !name ? 0.5 : 1 }}
        >
          {loading ? 'Starting…' : 'Start the program'}
        </button>
      </form>
    </div>
  )
}
