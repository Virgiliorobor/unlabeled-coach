import { useState, useEffect } from 'react'
import { getDailyCard } from '../data/oblique-cards'

interface GoalMilestone {
  week: number
  text: string
  status: 'pending' | 'done' | 'missed'
}

interface Goal {
  text: string
  status: string
  set_at: string
  last_referenced: string
  milestones?: GoalMilestone[]
}

interface Portfolio {
  url: string
  platform: string
  status: 'none' | 'in_progress' | 'active'
  entries_count: number
  last_updated: string
}

interface FirstMove {
  text: string
  due_date: string
  platform: string
  pattern_note: string
  status: 'pending' | 'done' | 'missed'
  created_at: string
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
  portfolio: Portfolio
  first_move: FirstMove | null
  today_prompt: string
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

const PHASES = [
  { key: 'interview',       label: 'Interview',       num: 0 },
  { key: 'reflection',      label: 'Reflection',      num: 1 },
  { key: 'clarity',         label: 'Clarity',         num: 2 },
  { key: 'resistance',      label: 'Resistance',      num: 3 },
  { key: 'commitment',      label: 'Commitment',      num: 4 },
  { key: 'accountability',  label: 'Accountability',  num: 5 },
]

const PHASE_PROMPTS: Record<string, string> = {
  interview:      "What's the thing you haven't admitted to yourself yet about the project?",
  reflection:     "The thing you keep meaning to do — what's the real reason it's still on the list?",
  clarity:        "If you had to describe what you're making to a stranger in one sentence, what would you say?",
  resistance:     "What's the work you keep circling without landing on?",
  commitment:     "Did you do it? What happened?",
  accountability: "What would doing it prove — to you?",
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): number {
  if (!iso) return 0
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function currentPhaseNum(phase: string): number {
  return PHASES.find(p => p.key === phase)?.num ?? 0
}

export default function Dashboard({ slug, onStartSession, onPhaseChange }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstMoveUrl, setFirstMoveUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)

  const dailyCard = getDailyCard()

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

  async function resolveFirstMove(status: 'done' | 'missed') {
    await fetch('/api/dashboard/first-move/resolve', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, url: firstMoveUrl })
    })
    const r = await fetch('/api/dashboard', { credentials: 'include' })
    setData(await r.json())
    setShowUrlInput(false)
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-xl)' }}>
        <span className="label">Loading…</span>
      </div>
    )
  }

  if (!data) return null

  const { profile, portfolio, first_move, today_prompt, goals, active_commitment, commitment_history } = data
  const phaseNum = currentPhaseNum(profile.current_phase)
  const phaseLabel = PHASES[phaseNum]?.label ?? profile.current_phase
  const reInterviewDays = daysUntil(profile.re_interview_due)
  const commitmentOverdue = active_commitment ? daysUntil(active_commitment.due_date) <= 0 : false
  const firstMoveOverdue = first_move && first_move.status === 'pending' ? daysUntil(first_move.due_date) <= 0 : false
  const displayPrompt = today_prompt || PHASE_PROMPTS[profile.current_phase] || ''

  return (
    <div className="container" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-xl)' }}>

      {/* Header */}
      <div className="workbench-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="dymo-label">Unlabeled</span>
        <div className="flex gap-sm items-center">
          <span className="label">{slug}</span>
          <button className="label" onClick={handleLogout} style={{ color: 'var(--grey)' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Re-interview banner */}
      {profile.re_interview_overdue && (
        <div className="deadline-tape" style={{ marginBottom: 'var(--space-md)', display: 'block' }}>
          Weekly check-in overdue — start a session to update your profile
        </div>
      )}

      {/* Phase progress + session button */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 8 }}>
          <div className="phase-progress">
            {PHASES.map(p => (
              <div
                key={p.key}
                className={`phase-pip ${p.num < phaseNum ? 'done' : p.num === phaseNum ? 'current' : 'pending'}`}
                title={p.label}
              />
            ))}
          </div>
          <span className="label">Phase {phaseNum} — {phaseLabel} · Session {profile.sessions_completed + 1}</span>
        </div>
        <button className="btn-primary" onClick={onStartSession}>
          Start session
        </button>
      </div>

      <hr />

      {/* Signal row: oblique card + today's prompt */}
      <div className="signal-row" style={{ marginBottom: 'var(--space-md)' }}>

        <div className="oblique-card">
          <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
            Card {dailyCard.index} of 40
          </span>
          <p className="oblique-text">{dailyCard.text}</p>
        </div>

        {displayPrompt && (
          <div className="today-prompt-card">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              Between sessions
            </span>
            <p className="today-prompt-text">{displayPrompt}</p>
          </div>
        )}

      </div>

      <hr />

      {/* Portfolio */}
      <div className="portfolio-block" style={{ margin: 'var(--space-md) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span className="dymo-label" style={{ fontSize: '0.6rem' }}>Portfolio</span>
          {portfolio.status !== 'none' && (
            <span className="label">{portfolio.platform}</span>
          )}
        </div>

        {portfolio.status === 'active' && portfolio.url && (
          <p style={{ fontSize: '0.9rem', marginBottom: 4 }}>
            <a href={portfolio.url} target="_blank" rel="noopener noreferrer"
               style={{ color: 'var(--black)', textUnderlineOffset: '3px' }}>
              {portfolio.url}
            </a>
            {portfolio.entries_count > 0 && (
              <span className="label" style={{ marginLeft: 8 }}>{portfolio.entries_count} entries</span>
            )}
          </p>
        )}

        {portfolio.status === 'in_progress' && (
          <p className="text-muted text-small">In progress — {portfolio.platform || 'platform not set'}</p>
        )}

        {portfolio.status === 'none' && (
          <p className="text-muted text-small">Not started — complete your first session to set this up</p>
        )}
      </div>

      <hr />

      {/* First move (if no active commitment) or active commitment */}
      {active_commitment ? (
        <div className={`commitment-block tape-border${commitmentOverdue ? ' overdue' : ''}`}
             style={{ margin: 'var(--space-md) 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
            <span className="dymo-label" style={{ fontSize: '0.65rem' }}>Active commitment</span>
            <span className="label">due {formatDate(active_commitment.due_date)}</span>
            {commitmentOverdue && <span className="overdue-marker label">overdue</span>}
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

      ) : first_move && first_move.status === 'pending' ? (
        <div className={`first-move-block tape-border${firstMoveOverdue ? ' overdue' : ''}`}
             style={{ margin: 'var(--space-md) 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
            <span className="dymo-label" style={{ fontSize: '0.65rem' }}>First move</span>
            <span className="label">due {formatDate(first_move.due_date)}</span>
            {firstMoveOverdue && <span className="overdue-marker label">overdue</span>}
          </div>
          <p style={{ marginBottom: 'var(--space-xs)' }}>{first_move.text}</p>
          {first_move.pattern_note && (
            <p className="text-small text-muted" style={{ marginBottom: 'var(--space-sm)', fontStyle: 'italic' }}>
              {first_move.pattern_note}
            </p>
          )}

          {showUrlInput ? (
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <input
                type="url"
                placeholder="Portfolio URL (optional)"
                value={firstMoveUrl}
                onChange={e => setFirstMoveUrl(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="flex gap-sm">
                <button className="btn-ghost" onClick={() => resolveFirstMove('done')}>Confirm done</button>
                <button className="btn-ghost" onClick={() => setShowUrlInput(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-sm">
              <button className="btn-ghost" onClick={() => setShowUrlInput(true)}>Mark done</button>
              <button className="btn-ghost" onClick={() => resolveFirstMove('missed')}>Missed</button>
            </div>
          )}
        </div>

      ) : first_move && first_move.status === 'done' ? (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <span className="label">First move complete</span>
          <p className="text-muted text-small" style={{ marginTop: 4 }}>
            Portfolio exists. Next commitment comes in Phase 4 — Commitment.
          </p>
        </div>
      ) : (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <span className="label">No active commitment</span>
          <p className="text-muted text-small" style={{ marginTop: 4 }}>
            Your first commitment is set at the end of your intake interview.
          </p>
        </div>
      )}

      <hr />

      {/* 30-day goal + milestones */}
      <div style={{ margin: 'var(--space-md) 0' }}>
        <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>30 days</span>
        {goals.thirty_days.text ? (
          <>
            <p style={{ fontSize: '0.95rem', marginBottom: 'var(--space-xs)' }}>{goals.thirty_days.text}</p>
            {goals.thirty_days.milestones && goals.thirty_days.milestones.length > 0 && (
              <div className="milestone-track">
                {goals.thirty_days.milestones.map(m => (
                  <div key={m.week} className={`milestone-item milestone-${m.status}`} title={`Week ${m.week}: ${m.text}`}>
                    <div className="milestone-pip" />
                    <span className="label" style={{ fontSize: '0.55rem' }}>W{m.week}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted text-small">Set during your intake interview</p>
        )}
      </div>

      <hr />

      {/* 90-day + 12-month condensed */}
      <div className="horizon-grid-small" style={{ margin: 'var(--space-md) 0' }}>
        <div>
          <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>90 days</span>
          <p style={{ fontSize: '0.9rem' }}>
            {goals.ninety_days.text || <span className="text-muted">Not set yet</span>}
          </p>
        </div>
        <div>
          <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>12 months</span>
          <p style={{ fontSize: '0.9rem' }}>
            {goals.twelve_months.text || <span className="text-muted">Not set yet</span>}
          </p>
        </div>
      </div>

      {/* Commitment history */}
      {commitment_history.length > 0 && (
        <>
          <hr />
          <div style={{ margin: 'var(--space-md) 0' }}>
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>Commitment log</span>
            <div className="flex flex-col">
              {commitment_history.slice().reverse().map((c, i) => (
                <div key={i} className="log-row flex justify-between items-center">
                  <p className={`text-small flex-1${c.status === 'done' ? ' commitment-done' : ''}`}>
                    {c.text}
                  </p>
                  <span className="mono" style={{
                    marginLeft: 'var(--space-sm)',
                    color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? 'var(--red)' : 'var(--grey)'
                  }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <hr />
      <div style={{ marginTop: 'var(--space-md)' }}>
        <span className="label text-muted">
          Next check-in {reInterviewDays > 0 ? `in ${reInterviewDays} days` : 'now'}
          {profile.dominant_lens && profile.dominant_lens !== 'split' && ` · ${profile.dominant_lens}-dominant`}
          {profile.resistance_pattern && ` · ${profile.resistance_pattern.replace(/_/g, ' ')}`}
        </span>
      </div>

    </div>
  )
}
