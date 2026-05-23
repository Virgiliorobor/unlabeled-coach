import { useState, useEffect } from 'react'
import ProgressMap from '../components/ProgressMap'

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

interface ActionStep {
  step_id: string
  text: string
  assigned_at: string
  due_date: string
  status: 'pending' | 'done' | 'skipped'
  coach_reason: string
  completion_note: string
  phase_assigned: string
  exercise_level: number
}

interface PublishingEntry {
  log_id: string
  url: string
  platform: string
  published_at: string
  commitment_id: string
  description: string
}

interface PhaseProgress {
  current_phase: string
  phase_started_at: string
  days_elapsed: number
  minimum_days: number
  time_gate_clear: boolean
  completed_action_steps: number
}

interface DashboardData {
  profile: {
    slug: string
    build_name: string
    build_description: string
    build_state: string
    current_phase: string
    sessions_completed: number
    last_session_date: string
    re_interview_due: string
    re_interview_overdue: boolean
    dominant_lens: string
    resistance_pattern: string
  }
  phase_progress: PhaseProgress
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
  action_steps: {
    pending: ActionStep[]
    recent_done: ActionStep[]
  }
  publishing_log: PublishingEntry[]
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


function platformLabel(p: string): string {
  const labels: Record<string, string> = {
    linkedin: 'LinkedIn', twitter: 'X/Twitter', substack: 'Substack',
    community: 'Community', email: 'Email', blog: 'Blog', other: 'Published'
  }
  return labels[p] || p
}

export default function Dashboard({ slug, onStartSession, onPhaseChange }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // Action step completion state
  const [completingStep, setCompletingStep] = useState<string | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [skippingStep, setSkippingStep] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState('')

  // Publishing proof state
  const [showProofForm, setShowProofForm] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [proofPlatform, setProofPlatform] = useState('community')
  const [proofDescription, setProofDescription] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)

  async function load() {
    const r = await fetch('/api/dashboard', { credentials: 'include' })
    if (r.ok) {
      const d = await r.json()
      setData(d)
      if (d?.profile?.current_phase) onPhaseChange?.(d.profile.current_phase)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  async function resolveCommitment(id: string, status: 'done' | 'missed' | 'partial') {
    await fetch(`/api/dashboard/commitment/${id}/resolve`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    load()
  }

  async function completeStep(id: string) {
    await fetch(`/api/dashboard/action-step/${id}/complete`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_note: completionNote })
    })
    setCompletingStep(null)
    setCompletionNote('')
    load()
  }

  async function skipStep(id: string) {
    await fetch(`/api/dashboard/action-step/${id}/skip`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: skipReason })
    })
    setSkippingStep(null)
    setSkipReason('')
    load()
  }

  async function submitProof(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (!proofUrl || !proofDescription) return
    setSubmittingProof(true)
    await fetch('/api/dashboard/publishing-log', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: proofUrl,
        platform: proofPlatform,
        description: proofDescription,
        commitment_id: data?.active_commitment?.commitment_id || ''
      })
    })
    setProofUrl('')
    setProofPlatform('community')
    setProofDescription('')
    setShowProofForm(false)
    setSubmittingProof(false)
    load()
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-xl)' }}>
        <span className="label">Loading…</span>
      </div>
    )
  }

  if (!data) return null

  const { profile, phase_progress, goals, active_commitment, commitment_history, action_steps, publishing_log } = data
  const reInterviewDays = daysUntil(profile.re_interview_due)
  const isOverdue = active_commitment ? daysUntil(active_commitment.due_date) <= 0 : false
  const hasPendingSteps = action_steps.pending.length > 0

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

      {/* Mission Map */}
      <ProgressMap
        currentPhase={profile.current_phase}
        daysElapsed={phase_progress.days_elapsed}
        goals={goals}
        activeCommitment={active_commitment}
        publishingCount={publishing_log.length}
        pendingStepCount={action_steps.pending.length}
        completedStepCount={phase_progress.completed_action_steps}
        currentExerciseLevel={
          action_steps.pending[0]?.exercise_level ??
          (action_steps.recent_done[0]?.exercise_level ?? 0)
        }
        commitmentHistory={commitment_history}
      />

      {/* Re-interview banner */}
      {profile.re_interview_overdue && (
        <div className="deadline-tape" style={{ marginBottom: 'var(--space-md)' }}>
          Weekly check-in due — start a session to update your profile.
        </div>
      )}

      {/* Start session button */}
      <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onStartSession}>
          Start session
        </button>
      </div>

      {/* ── CURRENT EXERCISE ──────────────────────────────── */}
      {hasPendingSteps && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.75rem' }}>
            Current exercise
          </h2>
          {action_steps.pending.map(step => (
            <div key={step.step_id} className="tape-border" style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-sm)' }}>
              <div className="flex justify-between items-baseline" style={{ marginBottom: 'var(--space-xs)' }}>
                <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--grey-mid)' }}>
                  Level {step.exercise_level} · {step.phase_assigned}
                </span>
                <span className="label" style={{ fontSize: '0.65rem', color: daysUntil(step.due_date) <= 0 ? 'var(--accent)' : 'var(--grey-mid)' }}>
                  due {formatDate(step.due_date)}
                  {daysUntil(step.due_date) <= 0 && ' · overdue'}
                </span>
              </div>

              <p style={{ marginBottom: 'var(--space-sm)', lineHeight: 1.5 }}>{step.text}</p>

              {step.coach_reason && (
                <p style={{ fontSize: '0.8rem', color: 'var(--grey-mid)', marginBottom: 'var(--space-sm)', fontStyle: 'italic' }}>
                  {step.coach_reason}
                </p>
              )}

              {completingStep === step.step_id ? (
                <div>
                  <textarea
                    value={completionNote}
                    onChange={e => setCompletionNote(e.target.value)}
                    placeholder="What did you do? What came up? (optional)"
                    rows={3}
                    style={{ width: '100%', marginBottom: 'var(--space-xs)', fontFamily: 'inherit', fontSize: '0.9rem', padding: 8, border: '1px solid var(--black)', resize: 'vertical' }}
                  />
                  <div className="flex gap-sm">
                    <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => completeStep(step.step_id)}>
                      Done — save note
                    </button>
                    <button className="btn-ghost" onClick={() => setCompletingStep(null)}>Cancel</button>
                  </div>
                </div>
              ) : skippingStep === step.step_id ? (
                <div>
                  <textarea
                    value={skipReason}
                    onChange={e => setSkipReason(e.target.value)}
                    placeholder="What got in the way? (the coach will see this)"
                    rows={2}
                    style={{ width: '100%', marginBottom: 'var(--space-xs)', fontFamily: 'inherit', fontSize: '0.9rem', padding: 8, border: '1px solid var(--black)', resize: 'vertical' }}
                  />
                  <div className="flex gap-sm">
                    <button className="btn-ghost" onClick={() => skipStep(step.step_id)}>Skip with reason</button>
                    <button className="btn-ghost" onClick={() => setSkippingStep(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-sm">
                  <button className="btn-ghost" onClick={() => { setCompletingStep(step.step_id); setSkippingStep(null) }}>
                    Mark done
                  </button>
                  <button className="btn-ghost" style={{ color: 'var(--grey-mid)' }} onClick={() => { setSkippingStep(step.step_id); setCompletingStep(null) }}>
                    Skip
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ACTIVE COMMITMENT ─────────────────────────────── */}
      {active_commitment ? (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.75rem' }}>Active commitment</h2>
          <div className={`commitment-block tape-border${isOverdue ? ' overdue' : ''}`}>
            <div className="flex justify-between items-baseline" style={{ marginBottom: 'var(--space-xs)' }}>
              <span className="label" style={{ fontSize: '0.65rem' }}>
                Rung {active_commitment.ladder_rung}
              </span>
              <span className="label" style={{ color: isOverdue ? 'var(--accent)' : 'inherit' }}>
                due {formatDate(active_commitment.due_date)}
                {isOverdue && <span className="overdue-marker label"> · overdue</span>}
              </span>
            </div>

            <p style={{ marginBottom: 'var(--space-sm)' }}>{active_commitment.text}</p>

            {active_commitment.share_post && (
              <div style={{ marginBottom: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--grey-light)', borderLeft: '3px solid var(--black)' }}>
                <span className="label" style={{ display: 'block', marginBottom: 4, fontSize: '0.65rem' }}>Ready to post</span>
                <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>{active_commitment.share_post}</p>
              </div>
            )}

            <div className="flex gap-sm" style={{ marginBottom: 'var(--space-sm)' }}>
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

            {/* Add proof of publication */}
            {!showProofForm ? (
              <button
                className="label"
                style={{ color: 'var(--grey-mid)', fontSize: '0.75rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                onClick={() => setShowProofForm(true)}
              >
                + Add proof of publication
              </button>
            ) : (
              <form onSubmit={submitProof} style={{ marginTop: 'var(--space-xs)' }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input
                    type="url"
                    value={proofUrl}
                    onChange={e => setProofUrl(e.target.value)}
                    placeholder="URL to what you published"
                    required
                    style={{ fontFamily: 'inherit', fontSize: '0.9rem', padding: 8, border: '1px solid var(--black)', width: '100%' }}
                  />
                  <select
                    value={proofPlatform}
                    onChange={e => setProofPlatform(e.target.value)}
                    style={{ fontFamily: 'inherit', fontSize: '0.9rem', padding: 8, border: '1px solid var(--black)' }}
                  >
                    <option value="community">Unlabeled Community</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">X / Twitter</option>
                    <option value="substack">Substack</option>
                    <option value="blog">Blog</option>
                    <option value="email">Email (no URL)</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea
                    value={proofDescription}
                    onChange={e => setProofDescription(e.target.value)}
                    placeholder="What did you publish? One or two sentences."
                    rows={2}
                    required
                    style={{ fontFamily: 'inherit', fontSize: '0.9rem', padding: 8, border: '1px solid var(--black)', resize: 'vertical' }}
                  />
                  <div className="flex gap-sm">
                    <button type="submit" className="btn-primary" disabled={submittingProof} style={{ fontSize: '0.8rem' }}>
                      {submittingProof ? 'Saving…' : 'Save proof'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setShowProofForm(false)}>Cancel</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <span className="label">No active commitment</span>
          <p className="text-muted text-small" style={{ marginTop: 4 }}>
            Declare one in your next session.
          </p>
        </div>
      )}

      <hr />

      {/* ── THREE HORIZONS ────────────────────────────────── */}
      <div style={{ margin: 'var(--space-md) 0' }}>
        <h2 className="dymo-label" style={{ marginBottom: 'var(--space-md)', fontSize: '0.75rem' }}>Three horizons</h2>
        <div className="horizon-grid">
          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>12 months</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.twelve_months.text || <span className="text-muted">Not set yet</span>}
            </p>
          </div>
          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>90 days</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.ninety_days.text || <span className="text-muted">Not set yet</span>}
            </p>
          </div>
          <div className="horizon-cell">
            <span className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>30 days</span>
            <p style={{ fontSize: '0.95rem' }}>
              {goals.thirty_days.text || <span className="text-muted">Not set yet</span>}
            </p>
            {active_commitment && (
              <div style={{ marginTop: 'var(--space-xs)', paddingTop: 'var(--space-xs)', borderTop: '1px solid var(--grey-light)' }}>
                <span className="label" style={{ fontSize: '0.65rem', color: 'var(--grey-mid)', display: 'block', marginBottom: 2 }}>Current commitment</span>
                <p style={{ fontSize: '0.8rem' }}>{active_commitment.text}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <hr />

      {/* ── PUBLISHING LOG ────────────────────────────────── */}
      <div style={{ margin: 'var(--space-md) 0' }}>
        <div className="flex justify-between items-baseline" style={{ marginBottom: 'var(--space-sm)' }}>
          <h2 className="dymo-label" style={{ fontSize: '0.75rem' }}>
            Published {publishing_log.length > 0 && `(${publishing_log.length})`}
          </h2>
          {!showProofForm && (
            <button
              className="label"
              style={{ fontSize: '0.7rem', color: 'var(--grey-mid)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              onClick={() => setShowProofForm(true)}
            >
              + Add
            </button>
          )}
        </div>

        {publishing_log.length === 0 ? (
          <p className="text-muted text-small">Nothing published yet — your first public act goes here.</p>
        ) : (
          <div className="flex flex-col">
            {publishing_log.map((entry) => (
              <div key={entry.log_id} className="log-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-light)' }}>
                <div className="flex justify-between items-baseline" style={{ marginBottom: 2 }}>
                  <span className="mono" style={{ fontSize: '0.7rem' }}>{platformLabel(entry.platform)}</span>
                  <span className="label" style={{ fontSize: '0.65rem', color: 'var(--grey-mid)' }}>{formatDate(entry.published_at)}</span>
                </div>
                <p className="text-small" style={{ marginBottom: 2 }}>{entry.description}</p>
                {entry.url && entry.url !== 'direct message — no url' && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                    style={{ fontSize: '0.7rem', color: 'var(--grey-mid)', wordBreak: 'break-all' }}
                  >
                    {entry.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <hr />

      {/* ── COMPLETED EXERCISES ───────────────────────────── */}
      {action_steps.recent_done.length > 0 && (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.75rem' }}>
            Completed exercises
          </h2>
          <div className="flex flex-col">
            {action_steps.recent_done.map(step => (
              <div key={step.step_id} className="log-row flex justify-between items-start" style={{ padding: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <p className="text-small commitment-done">{step.text}</p>
                  {step.completion_note && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--grey-mid)', marginTop: 2, fontStyle: 'italic' }}>
                      "{step.completion_note}"
                    </p>
                  )}
                </div>
                <span className="mono" style={{ marginLeft: 'var(--space-sm)', fontSize: '0.65rem', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                  Lv {step.exercise_level} · {formatDate(step.assigned_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COMMITMENT HISTORY ────────────────────────────── */}
      {commitment_history.length > 0 && (
        <div style={{ margin: 'var(--space-md) 0' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.75rem' }}>Commitment log</h2>
          <div className="flex flex-col">
            {commitment_history.slice().reverse().map((c, i) => (
              <div key={i} className="log-row flex justify-between items-center">
                <p className={`text-small flex-1${c.status === 'done' ? ' commitment-done' : ''}`}>{c.text}</p>
                <span className="mono" style={{
                  marginLeft: 'var(--space-sm)',
                  color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? 'var(--accent)' : 'var(--grey-mid)'
                }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <span className="label text-muted" style={{ fontSize: '0.7rem' }}>
          Next check-in in {reInterviewDays > 0 ? `${reInterviewDays} days` : 'now'}
          {profile.resistance_pattern && ` · ${profile.resistance_pattern.replace(/_/g, ' ')}`}
          {profile.dominant_lens && profile.dominant_lens !== 'split' && ` · ${profile.dominant_lens}-dominant`}
        </span>
      </div>

    </div>
  )
}
