import { useState, useEffect } from 'react'

interface Goal {
  text: string
  status: string
  set_at: string
  last_referenced: string
}

interface ActiveCommitment {
  commitment_id: string
  text: string
  declared_at: string
  due_date: string
  status: string
  ladder_rung: number
  share_post: string
  print_card: string
  daily_reminders: Record<string, string | number>
}

interface DashboardData {
  profile: {
    slug: string
    build_name: string
    build_state: string
    current_phase: string
    sessions_completed: number
    last_session_date: string
    re_interview_due: string
    re_interview_overdue: boolean
    dominant_lens: string
    resistance_pattern: string
  }
  goals: {
    thirty_days: Goal
    ninety_days: Goal
    twelve_months: Goal
  }
  active_commitment: ActiveCommitment | null
  commitment_history: Array<{
    text: string
    status: string
    due_date: string
    outcome_notes: string
  }>
}

interface Props {
  slug: string
  onStartSession: () => void
  onPhaseChange?: (phase: string) => void
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): number {
  if (!iso) return 0
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function Dashboard({ slug, onStartSession, onPhaseChange }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        if (d?.profile?.current_phase) onPhaseChange?.(d.profile.current_phase)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  async function resolveCommitment(id: string, status: 'done' | 'missed' | 'partial') {
    await fetch(`/api/dashboard/commitment/${id}/resolve`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    const r = await fetch('/api/dashboard', { credentials: 'include' })
    setData(await r.json())
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-xl)' }}>
        <span className="label">Loading…</span>
      </div>
    )
  }

  if (!data) return null

  const { profile, goals, active_commitment, commitment_history } = data
  const reInterviewDays = daysUntil(profile.re_interview_due)
  const isOverdue = active_commitment ? daysUntil(active_commitment.due_date) <= 0 : false

  return (
    <div className="container" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-xl)' }}>

      {/* Header */}
      <div className="workbench-header flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
        <span className="dymo-label">Unlabeled</span>
        <div className="flex gap-sm items-center">
          <span className="label">{slug}</span>
          <button className="label" onClick={handleLogout} style={{ color: 'var(--grey-mid)' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Re-interview banner */}
      {profile.re_interview_overdue && (
        <div className="deadline-tape" style={{ marginBottom: 'var(--space-md)' }}>
          Weekly check-in due — start a session to update your profile.
        </div>
      )}

      {/* Start session */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button className="btn-primary" onClick={onStartSession}>
          Start session
        </button>
        <span className="label" style={{ marginLeft: 'var(--space-sm)' }}>
          Phase: {profile.current_phase} · Session {profile.sessions_completed + 1}
        </span>
      </div>

      <hr />

      {/* Active commitment */}
      {active_commitment ? (
        <div className={`commitment-block tape-border${isOverdue ? ' overdue' : ''}`}
             style={{ margin: 'var(--space-md) 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
            <span className="dymo-label" style={{ fontSize: '0.65rem' }}>Active commitment</span>
            <span className="label">due {formatDate(active_commitment.due_date)}</span>
            {isOverdue && (
              <span className="overdue-marker label">overdue</span>
            )}
          </div>
          <p style={{ marginBottom: 'var(--space-sm)' }}>{active_commitment.text}</p>
          <div className="flex gap-sm">
            <button className="btn-ghost" onClick={() => resolveCommitment(active_commitment.commitment_id, 'done')}>
              Mark done
            </button>
            <button className="btn-ghost" onClick={() => resolveCommitment(active_commitment.commitment_id, 'partial')}>
              Partial
            </button>
            <button className="btn-ghost" onClick={() => resolveCommitment(active_commitment.commitment_id, 'missed')}>
              Missed
            </button>
          </div>
          {active_commitment.share_post && (
            <div style={{ marginTop: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--grey-light)', borderLeft: '3px solid var(--black)' }}>
              <span className="label" style={{ display: 'block', marginBottom: 4 }}>Share post — ready to use</span>
              <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>{active_commitment.share_post}</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <span className="label">No active commitment</span>
          <p className="text-muted text-small" style={{ marginTop: 4 }}>
            Declare one in your next session.
          </p>
        </div>
      )}

      <hr />

      {/* Three horizons */}
      <div style={{ margin: 'var(--space-md) 0' }}>
        <h2 className="dymo-label" style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}>Three horizons</h2>
        <div className="horizon-grid">

          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>30 days</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.thirty_days.text || <span className="text-muted">Not set yet</span>}
            </p>
          </div>

          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>90 days</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.ninety_days.text || <span className="text-muted">Not set yet</span>}
            </p>
          </div>

          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>12 months</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.twelve_months.text || <span className="text-muted">Not set yet</span>}
            </p>
          </div>

        </div>
      </div>

      <hr />

      {/* Commitment history */}
      {commitment_history.length > 0 && (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}>Commitment log</h2>
          <div className="flex flex-col">
            {commitment_history.slice().reverse().map((c, i) => (
              <div key={i} className="log-row flex justify-between items-center">
                <p className={`text-small flex-1${c.status === 'done' ? ' commitment-done' : ''}`}>
                  {c.text}
                </p>
                <span className="mono" style={{
                  marginLeft: 'var(--space-sm)',
                  color: c.status === 'done'
                    ? '#2d6a2d'
                    : c.status === 'missed'
                    ? 'var(--accent)'
                    : 'var(--grey-mid)'
                }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <span className="label text-muted">
          Next check-in in {reInterviewDays > 0 ? `${reInterviewDays} days` : 'now'}
          {profile.dominant_lens && profile.dominant_lens !== 'split' && ` · ${profile.dominant_lens}-dominant`}
          {profile.resistance_pattern && ` · ${profile.resistance_pattern.replace(/_/g, ' ')}`}
        </span>
      </div>

    </div>
  )
}
