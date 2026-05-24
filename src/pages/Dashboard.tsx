import { useState, useEffect } from 'react'
import ProgressMap from '../components/ProgressMap'
import { AGENTS, AgentId } from './AgentChat'

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
  goal_id: string
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
}

interface PhaseProgress {
  days_elapsed: number
  minimum_days: number
  time_gate_clear: boolean
  completed_action_steps: number
}

interface GoalData {
  goal_id: string
  title: string
  description: string
  horizon: string
  phase: string
  phase_started_at: string
  added_at: string
  last_touched: string
  status: string
  phase_progress: PhaseProgress
  action_steps: {
    pending: ActionStep[]
    recent_done: ActionStep[]
  }
  active_commitment: ActiveCommitment | null
  commitment_history: Array<{
    text: string
    status: string
    due_date: string
    outcome_notes: string
  }>
}

interface PublishingEntry {
  log_id: string
  url: string
  platform: string
  published_at: string
  goal_id: string
  commitment_id: string
  description: string
}

interface DashboardData {
  profile: {
    slug: string
    build_name: string
    build_description: string
    build_state: string
    initial_interview_done: boolean
    sessions_completed: number
    last_session_date: string
    re_interview_due: string
    re_interview_overdue: boolean
    dominant_lens: string
    resistance_pattern: string
  }
  goals: GoalData[]
  publishing_log: PublishingEntry[]
}

interface Props {
  slug: string
  onStartSession: () => void
  onPhaseChange?: (phase: string) => void
  onEnterAgent?: (id: AgentId) => void
  onEnterClearness?: () => void
  onEnterSimplify?: () => void
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

function phaseLabel(p: string): string {
  const labels: Record<string, string> = {
    intake: 'Intake', reflection: 'Reflection', clarity: 'Clarity',
    resistance: 'Resistance', commitment: 'Commitment', accountability: 'Accountability'
  }
  return labels[p] || p
}

function horizonLabel(h: string): string {
  const labels: Record<string, string> = {
    thirty_days: '30 days', ninety_days: '90 days',
    twelve_months: '12 months', ongoing: 'Ongoing'
  }
  return labels[h] || h
}

export default function Dashboard({ slug, onStartSession, onPhaseChange, onEnterAgent, onEnterClearness, onEnterSimplify }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const [completingStep, setCompletingStep] = useState<string | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [skippingStep, setSkippingStep] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState('')

  const [showProofForm, setShowProofForm] = useState<string | null>(null)
  const [proofUrl, setProofUrl] = useState('')
  const [proofPlatform, setProofPlatform] = useState('community')
  const [proofDescription, setProofDescription] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)

  async function load() {
    const r = await fetch('/api/dashboard', { credentials: 'include' })
    if (r.ok) {
      const d = await r.json()
      setData(d)
      const activeGoals: GoalData[] = (d?.goals || []).filter((g: GoalData) => g.status === 'active')
      if (activeGoals.length > 0) {
        const primary = [...activeGoals].sort((a, b) =>
          new Date(b.last_touched).getTime() - new Date(a.last_touched).getTime()
        )[0]
        onPhaseChange?.(primary.phase)
        if (!expandedGoal) setExpandedGoal(primary.goal_id)
      } else {
        onPhaseChange?.('interview')
      }
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

  async function submitProof(e: { preventDefault: () => void }, goalId: string, commitmentId: string) {
    e.preventDefault()
    if (!proofUrl || !proofDescription) return
    setSubmittingProof(true)
    await fetch('/api/dashboard/publishing-log', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: proofUrl, platform: proofPlatform, description: proofDescription,
        commitment_id: commitmentId, goal_id: goalId
      })
    })
    setProofUrl('')
    setProofPlatform('community')
    setProofDescription('')
    setShowProofForm(null)
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

  const { profile, goals, publishing_log } = data
  const reInterviewDays = daysUntil(profile.re_interview_due)
  const activeGoals = goals.filter(g => g.status === 'active')

  const goalRows = goals.map(g => ({
    goal_id: g.goal_id,
    title: g.title,
    horizon: g.horizon,
    phase: g.phase,
    status: g.status,
    has_pending_step: g.action_steps.pending.length > 0,
    has_active_commitment: g.active_commitment !== null,
    days_in_phase: g.phase_progress.days_elapsed,
    time_gate_clear: g.phase_progress.time_gate_clear,
  }))

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

      {/* Portfolio Board */}
      <ProgressMap
        goals={goalRows}
        publishingCount={publishing_log.length}
        sessionsCompleted={profile.sessions_completed}
        resistancePattern={profile.resistance_pattern}
        initialInterviewDone={profile.initial_interview_done}
      />

      {/* Re-interview banner */}
      {profile.re_interview_overdue && (
        <div className="deadline-tape" style={{ marginBottom: 'var(--space-md)' }}>
          Weekly check-in due — start a session to update your profile.
        </div>
      )}

      {/* Start session */}
      <div style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onStartSession}>
          Start session
        </button>
      </div>

      {/* ── GOALS ─────────────────────────────────────────── */}
      {activeGoals.length === 0 ? (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <p className="text-muted text-small">
            {profile.initial_interview_done
              ? 'No active goals — start a session to add your first goal.'
              : 'Start a session to begin your intake interview.'}
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h2 className="dymo-label" style={{ marginBottom: 'var(--space-sm)', fontSize: '0.75rem' }}>
            Goals
          </h2>
          {activeGoals.map(goal => {
            const isExpanded = expandedGoal === goal.goal_id
            const isOverdue = goal.active_commitment
              ? daysUntil(goal.active_commitment.due_date) <= 0
              : false
            const hasPending = goal.action_steps.pending.length > 0

            return (
              <div key={goal.goal_id} className="tape-border" style={{ marginBottom: 'var(--space-md)' }}>

                {/* Goal header */}
                <button
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 'var(--space-sm)', textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-sm" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="mono" style={{
                        fontSize: '0.5rem', letterSpacing: '0.08em', padding: '2px 5px',
                        background: goal.horizon === 'thirty_days' ? 'var(--black)' : 'transparent',
                        color: goal.horizon === 'thirty_days' ? 'var(--bg)' : 'var(--grey-mid)',
                        border: '1px solid currentColor',
                      }}>
                        {horizonLabel(goal.horizon).toUpperCase()}
                      </span>
                      <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--grey-mid)', letterSpacing: '0.08em' }}>
                        {phaseLabel(goal.phase).toUpperCase()}
                        {!goal.phase_progress.time_gate_clear && ` · day ${goal.phase_progress.days_elapsed}/${goal.phase_progress.minimum_days}`}
                      </span>
                      {goal.active_commitment && (
                        <span style={{ fontSize: '0.6rem', color: isOverdue ? 'var(--accent)' : 'var(--black)' }}>
                          {isOverdue ? '⚠ overdue' : '⚡ committed'}
                        </span>
                      )}
                      {hasPending && !goal.active_commitment && (
                        <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)' }}>■ step pending</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.3, marginBottom: goal.description && !isExpanded ? 4 : 0 }}>
                      {goal.title}
                    </p>
                    {goal.description && !isExpanded && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--grey-mid)', lineHeight: 1.4 }}>
                        {goal.description.length > 100 ? goal.description.slice(0, 100) + '…' : goal.description}
                      </p>
                    )}
                  </div>
                  <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--grey-mid)', flexShrink: 0 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--grey-light)', padding: 'var(--space-sm)' }}>

                    {goal.description && (
                      <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-sm)', color: 'var(--grey-mid)' }}>
                        {goal.description}
                      </p>
                    )}

                    {/* Pending action steps */}
                    {hasPending && (
                      <div style={{ marginBottom: 'var(--space-sm)' }}>
                        <span className="dymo-label" style={{ fontSize: '0.6rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                          Current exercise
                        </span>
                        {goal.action_steps.pending.map(step => (
                          <div key={step.step_id} style={{ marginBottom: 'var(--space-xs)', padding: 'var(--space-xs)', background: 'var(--grey-light)' }}>
                            <div className="flex justify-between items-baseline" style={{ marginBottom: 4 }}>
                              <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--grey-mid)' }}>
                                Level {step.exercise_level}
                              </span>
                              <span className="label" style={{ fontSize: '0.6rem', color: daysUntil(step.due_date) <= 0 ? 'var(--accent)' : 'var(--grey-mid)' }}>
                                due {formatDate(step.due_date)}{daysUntil(step.due_date) <= 0 && ' · overdue'}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 'var(--space-xs)' }}>{step.text}</p>
                            {step.coach_reason && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--grey-mid)', fontStyle: 'italic', marginBottom: 'var(--space-xs)' }}>
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
                                  style={{ width: '100%', marginBottom: 6, fontFamily: 'inherit', fontSize: '0.85rem', padding: 8, border: '1px solid var(--black)', resize: 'vertical' }}
                                />
                                <div className="flex gap-sm">
                                  <button className="btn-primary" style={{ fontSize: '0.75rem' }} onClick={() => completeStep(step.step_id)}>
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
                                  style={{ width: '100%', marginBottom: 6, fontFamily: 'inherit', fontSize: '0.85rem', padding: 8, border: '1px solid var(--black)', resize: 'vertical' }}
                                />
                                <div className="flex gap-sm">
                                  <button className="btn-ghost" onClick={() => skipStep(step.step_id)}>Skip with reason</button>
                                  <button className="btn-ghost" onClick={() => setSkippingStep(null)}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-sm">
                                <button className="btn-ghost" onClick={() => { setCompletingStep(step.step_id); setSkippingStep(null) }}>Mark done</button>
                                <button className="btn-ghost" style={{ color: 'var(--grey-mid)' }} onClick={() => { setSkippingStep(step.step_id); setCompletingStep(null) }}>Skip</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active commitment */}
                    {goal.active_commitment && (
                      <div style={{ marginBottom: 'var(--space-sm)' }}>
                        <span className="dymo-label" style={{ fontSize: '0.6rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                          Active commitment
                        </span>
                        <div className={`commitment-block tape-border${isOverdue ? ' overdue' : ''}`} style={{ padding: 'var(--space-xs)' }}>
                          <div className="flex justify-between items-baseline" style={{ marginBottom: 4 }}>
                            <span className="label" style={{ fontSize: '0.6rem' }}>Rung {goal.active_commitment.ladder_rung}</span>
                            <span className="label" style={{ color: isOverdue ? 'var(--accent)' : 'inherit', fontSize: '0.6rem' }}>
                              due {formatDate(goal.active_commitment.due_date)}{isOverdue && ' · overdue'}
                            </span>
                          </div>
                          <p style={{ marginBottom: 'var(--space-xs)', fontSize: '0.9rem' }}>{goal.active_commitment.text}</p>
                          {goal.active_commitment.share_post && (
                            <div style={{ marginBottom: 'var(--space-xs)', padding: '6px 8px', background: 'var(--grey-light)', borderLeft: '3px solid var(--black)' }}>
                              <span className="label" style={{ display: 'block', marginBottom: 2, fontSize: '0.6rem' }}>Ready to post</span>
                              <p style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{goal.active_commitment.share_post}</p>
                            </div>
                          )}
                          <div className="flex gap-sm" style={{ marginBottom: 'var(--space-xs)' }}>
                            <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'done')}>Mark done</button>
                            <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'partial')}>Partial</button>
                            <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'missed')}>Missed</button>
                          </div>
                          {showProofForm !== goal.goal_id ? (
                            <button
                              className="label"
                              style={{ color: 'var(--grey-mid)', fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                              onClick={() => setShowProofForm(goal.goal_id)}
                            >
                              + Add proof of publication
                            </button>
                          ) : (
                            <form onSubmit={e => submitProof(e, goal.goal_id, goal.active_commitment!.commitment_id)} style={{ marginTop: 8 }}>
                              <div style={{ display: 'grid', gap: 6 }}>
                                <input
                                  type="url"
                                  value={proofUrl}
                                  onChange={e => setProofUrl(e.target.value)}
                                  placeholder="URL to what you published"
                                  required
                                  style={{ fontFamily: 'inherit', fontSize: '0.85rem', padding: 7, border: '1px solid var(--black)', width: '100%' }}
                                />
                                <select
                                  value={proofPlatform}
                                  onChange={e => setProofPlatform(e.target.value)}
                                  style={{ fontFamily: 'inherit', fontSize: '0.85rem', padding: 7, border: '1px solid var(--black)' }}
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
                                  style={{ fontFamily: 'inherit', fontSize: '0.85rem', padding: 7, border: '1px solid var(--black)', resize: 'vertical' }}
                                />
                                <div className="flex gap-sm">
                                  <button type="submit" className="btn-primary" disabled={submittingProof} style={{ fontSize: '0.75rem' }}>
                                    {submittingProof ? 'Saving…' : 'Save proof'}
                                  </button>
                                  <button type="button" className="btn-ghost" onClick={() => setShowProofForm(null)}>Cancel</button>
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Completed exercises */}
                    {goal.action_steps.recent_done.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-xs)' }}>
                        <span className="dymo-label" style={{ fontSize: '0.6rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                          Completed exercises ({goal.phase_progress.completed_action_steps})
                        </span>
                        {goal.action_steps.recent_done.map(step => (
                          <div key={step.step_id} className="flex justify-between items-start" style={{ padding: '4px 0', borderBottom: '1px solid var(--grey-light)' }}>
                            <div style={{ flex: 1 }}>
                              <p className="text-small commitment-done">{step.text}</p>
                              {step.completion_note && (
                                <p style={{ fontSize: '0.7rem', color: 'var(--grey-mid)', marginTop: 1, fontStyle: 'italic' }}>
                                  "{step.completion_note}"
                                </p>
                              )}
                            </div>
                            <span className="mono" style={{ marginLeft: 8, fontSize: '0.6rem', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                              Lv {step.exercise_level}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Commitment history */}
                    {goal.commitment_history.length > 0 && (
                      <div>
                        <span className="dymo-label" style={{ fontSize: '0.6rem', display: 'block', marginBottom: 'var(--space-xs)' }}>
                          Commitment log
                        </span>
                        {[...goal.commitment_history].reverse().map((c, i) => (
                          <div key={i} className="flex justify-between items-center" style={{ padding: '3px 0', borderBottom: '1px solid var(--grey-light)' }}>
                            <p className={`text-small flex-1${c.status === 'done' ? ' commitment-done' : ''}`}>{c.text}</p>
                            <span className="mono" style={{
                              marginLeft: 8, fontSize: '0.6rem',
                              color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? 'var(--accent)' : 'var(--grey-mid)'
                            }}>
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
              onClick={() => setShowProofForm('global')}
            >
              + Add
            </button>
          )}
        </div>

        {showProofForm === 'global' && (
          <form onSubmit={e => submitProof(e, '', '')} style={{ marginBottom: 'var(--space-sm)' }}>
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
                <button type="button" className="btn-ghost" onClick={() => setShowProofForm(null)}>Cancel</button>
              </div>
            </div>
          </form>
        )}

        {publishing_log.length === 0 ? (
          <p className="text-muted text-small">Nothing published yet — your first public act goes here.</p>
        ) : (
          <div>
            {publishing_log.map(entry => (
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

      {/* Tools */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <div style={{
          borderBottom: '2px solid var(--black)', paddingBottom: 6, marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span className="label" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>TOOLS</span>
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--grey-mid)' }}>standalone utilities</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            {
              label: 'Clearness Committee',
              sub: 'Quaker process',
              desc: 'Bring a dilemma. Nine questions, no advice. Two observations at the end. Clarity arrives on its own.',
              onClick: onEnterClearness,
            },
            {
              label: 'Task Simplifier',
              sub: 'Making Ideas Happen',
              desc: 'Paste the task that feels too big. Get concrete action steps, a first move, and the blockers to watch for.',
              onClick: onEnterSimplify,
            },
          ].map(tool => (
            <div
              key={tool.label}
              style={{
                border: '2px solid var(--black)',
                boxShadow: '3px 3px 0px var(--black)',
                padding: '12px 14px',
                background: 'var(--bg)',
                cursor: 'pointer',
                transition: 'box-shadow 0.1s, transform 0.1s',
              }}
              onClick={tool.onClick}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '1px 1px 0px var(--black)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translate(2px,2px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '3px 3px 0px var(--black)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translate(0,0)'
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--grey-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {tool.sub}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: 6, lineHeight: 1.2 }}>
                {tool.label}
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.4, margin: 0 }}>
                {tool.desc}
              </p>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <span className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}>OPEN →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Library */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <div style={{
          borderBottom: '2px solid var(--black)', paddingBottom: 6, marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <span className="label" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>SPECIALIST AGENTS</span>
          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--grey-mid)' }}>each one ends with an action</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {AGENTS.map(agent => (
            <div
              key={agent.id}
              style={{
                border: '2px solid var(--black)',
                boxShadow: '3px 3px 0px var(--black)',
                padding: '12px 14px',
                background: 'var(--bg)',
                cursor: 'pointer',
                transition: 'box-shadow 0.1s, transform 0.1s',
              }}
              onClick={() => onEnterAgent?.(agent.id)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '1px 1px 0px var(--black)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translate(2px,2px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '3px 3px 0px var(--black)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translate(0,0)'
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--grey-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {agent.author}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: 6, lineHeight: 1.2 }}>
                {agent.name}
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.4, margin: 0 }}>
                {agent.description}
              </p>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <span className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}>ENTER →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
