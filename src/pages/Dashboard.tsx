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

const dash: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 32px',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.48rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: 'var(--grey-mid)',
  display: 'block',
  marginBottom: 12,
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
      <div style={{ ...dash, paddingTop: 64, textAlign: 'center' }}>
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

  const tools = [
    {
      label: 'Clearness Committee',
      sub: 'Quaker practice',
      desc: 'Nine questions, no advice. Clarity arrives on its own.',
      onClick: onEnterClearness,
    },
    {
      label: 'Task Simplifier',
      sub: 'Making Ideas Happen',
      desc: 'Find the first move buried inside the task.',
      onClick: onEnterSimplify,
    },
  ]

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <div style={{
        borderBottom: '2px solid var(--black)',
        background: 'var(--canvas)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ ...dash, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px' }}>
          <span className="label-machine" style={{ fontSize: '0.72rem' }}>Unlabeled</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {profile.resistance_pattern && (
              <span className="mono" style={{ fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--grey-mid)', textTransform: 'uppercase' }}>
                {profile.resistance_pattern.replace(/_/g, ' ')}
              </span>
            )}
            <span className="label" style={{ fontSize: '0.6rem', color: 'var(--grey-mid)' }}>{slug}</span>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--grey-mid)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO BOARD (full width) ──────────────────────── */}
      <div style={{ ...dash, paddingTop: 32, paddingBottom: 0 }}>
        {profile.re_interview_overdue && (
          <div className="deadline-tape" style={{ marginBottom: 16 }}>
            Weekly check-in due — start a session to update your profile.
          </div>
        )}
        <ProgressMap
          goals={goalRows}
          publishingCount={publishing_log.length}
          sessionsCompleted={profile.sessions_completed}
          resistancePattern={profile.resistance_pattern}
          initialInterviewDone={profile.initial_interview_done}
        />
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────── */}
      <div style={{
        ...dash,
        paddingTop: 40,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 40,
        alignItems: 'start',
      }}>

        {/* ── LEFT: GOALS ─────────────────────────────────────── */}
        <div>
          <span style={sectionLabel}>Goals</span>

          {activeGoals.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.6 }}>
              {profile.initial_interview_done
                ? 'No active goals — start a session to add your first goal.'
                : 'Start a session to begin your intake interview.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeGoals.map(goal => {
                const isExpanded = expandedGoal === goal.goal_id
                const isOverdue = goal.active_commitment ? daysUntil(goal.active_commitment.due_date) <= 0 : false
                const hasPending = goal.action_steps.pending.length > 0

                return (
                  <div key={goal.goal_id} className="tape-border" style={{ background: 'var(--bg)' }}>

                    {/* Goal header */}
                    <button
                      onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', background: 'none', border: 'none',
                        cursor: 'pointer', padding: '16px 20px', textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span className="mono" style={{
                            fontSize: '0.48rem', letterSpacing: '0.08em', padding: '2px 6px',
                            background: goal.horizon === 'thirty_days' ? 'var(--black)' : 'transparent',
                            color: goal.horizon === 'thirty_days' ? 'var(--bg)' : 'var(--grey-mid)',
                            border: '1px solid currentColor',
                          }}>
                            {horizonLabel(goal.horizon).toUpperCase()}
                          </span>
                          <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)', letterSpacing: '0.08em' }}>
                            {phaseLabel(goal.phase).toUpperCase()}
                            {!goal.phase_progress.time_gate_clear && ` · day ${goal.phase_progress.days_elapsed}/${goal.phase_progress.minimum_days}`}
                          </span>
                          {goal.active_commitment && (
                            <span style={{ fontSize: '0.58rem', color: isOverdue ? 'var(--accent)' : 'var(--black)', fontFamily: 'var(--font-mono)' }}>
                              {isOverdue ? '⚠ overdue' : '⚡ committed'}
                            </span>
                          )}
                          {hasPending && !goal.active_commitment && (
                            <span className="mono" style={{ fontSize: '0.48rem', color: 'var(--grey-mid)' }}>■ step pending</span>
                          )}
                        </div>
                        <p style={{ fontSize: '1rem', fontFamily: 'var(--font-serif)', lineHeight: 1.35, marginBottom: goal.description && !isExpanded ? 4 : 0 }}>
                          {goal.title}
                        </p>
                        {goal.description && !isExpanded && (
                          <p style={{ fontSize: '0.82rem', color: 'var(--grey-mid)', lineHeight: 1.4, fontFamily: 'var(--font-serif)', marginTop: 4 }}>
                            {goal.description.length > 120 ? goal.description.slice(0, 120) + '…' : goal.description}
                          </p>
                        )}
                      </div>
                      <span style={{ marginLeft: 12, fontSize: '0.65rem', color: 'var(--grey-mid)', flexShrink: 0, paddingTop: 2 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--grey-light)', padding: '20px 20px' }}>

                        {goal.description && (
                          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20, color: 'var(--grey-mid)' }}>
                            {goal.description}
                          </p>
                        )}

                        {/* Pending action steps */}
                        {hasPending && (
                          <div style={{ marginBottom: 20 }}>
                            <span style={{ ...sectionLabel, marginBottom: 8 }}>Current exercise</span>
                            {goal.action_steps.pending.map(step => (
                              <div key={step.step_id} style={{ padding: 14, background: 'rgba(0,0,0,0.025)', border: '1px solid var(--grey-light)', marginBottom: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)' }}>Level {step.exercise_level}</span>
                                  <span className="mono" style={{ fontSize: '0.5rem', color: daysUntil(step.due_date) <= 0 ? 'var(--accent)' : 'var(--grey-mid)' }}>
                                    due {formatDate(step.due_date)}{daysUntil(step.due_date) <= 0 && ' · overdue'}
                                  </span>
                                </div>
                                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', lineHeight: 1.55, marginBottom: 6 }}>{step.text}</p>
                                {step.coach_reason && (
                                  <p style={{ fontSize: '0.8rem', color: 'var(--grey-mid)', fontStyle: 'italic', marginBottom: 8 }}>{step.coach_reason}</p>
                                )}
                                {completingStep === step.step_id ? (
                                  <div>
                                    <textarea
                                      value={completionNote}
                                      onChange={e => setCompletionNote(e.target.value)}
                                      placeholder="What did you do? What came up? (optional)"
                                      rows={3}
                                      style={{ width: '100%', marginBottom: 8, fontFamily: 'var(--font-serif)', fontSize: '0.9rem', padding: 10, border: '1px solid var(--black)', resize: 'vertical', background: 'var(--bg)' }}
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
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
                                      style={{ width: '100%', marginBottom: 8, fontFamily: 'var(--font-serif)', fontSize: '0.9rem', padding: 10, border: '1px solid var(--black)', resize: 'vertical', background: 'var(--bg)' }}
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button className="btn-ghost" onClick={() => skipStep(step.step_id)}>Skip with reason</button>
                                      <button className="btn-ghost" onClick={() => setSkippingStep(null)}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 8 }}>
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
                          <div style={{ marginBottom: 20 }}>
                            <span style={{ ...sectionLabel, marginBottom: 8 }}>Active commitment</span>
                            <div className={`commitment-block tape-border${isOverdue ? ' overdue' : ''}`} style={{ padding: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span className="label" style={{ fontSize: '0.55rem' }}>Rung {goal.active_commitment.ladder_rung}</span>
                                <span className="label" style={{ color: isOverdue ? 'var(--accent)' : 'inherit', fontSize: '0.55rem' }}>
                                  due {formatDate(goal.active_commitment.due_date)}{isOverdue && ' · overdue'}
                                </span>
                              </div>
                              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 10 }}>{goal.active_commitment.text}</p>
                              {goal.active_commitment.share_post && (
                                <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--grey-light)', borderLeft: '3px solid var(--black)' }}>
                                  <span className="label" style={{ display: 'block', marginBottom: 3, fontSize: '0.55rem' }}>Ready to post</span>
                                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.88rem', fontStyle: 'italic' }}>{goal.active_commitment.share_post}</p>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'done')}>Mark done</button>
                                <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'partial')}>Partial</button>
                                <button className="btn-ghost" onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'missed')}>Missed</button>
                              </div>
                              {showProofForm !== goal.goal_id ? (
                                <button
                                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.08em', color: 'var(--grey-mid)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                                  onClick={() => setShowProofForm(goal.goal_id)}
                                >
                                  + Add proof of publication
                                </button>
                              ) : (
                                <form onSubmit={e => submitProof(e, goal.goal_id, goal.active_commitment!.commitment_id)} style={{ marginTop: 8 }}>
                                  <ProofFields
                                    url={proofUrl} setUrl={setProofUrl}
                                    platform={proofPlatform} setPlatform={setProofPlatform}
                                    description={proofDescription} setDescription={setProofDescription}
                                    submitting={submittingProof}
                                    onCancel={() => setShowProofForm(null)}
                                  />
                                </form>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Completed exercises */}
                        {goal.action_steps.recent_done.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <span style={{ ...sectionLabel, marginBottom: 8 }}>
                              Completed exercises ({goal.phase_progress.completed_action_steps})
                            </span>
                            {goal.action_steps.recent_done.map(step => (
                              <div key={step.step_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--grey-light)' }}>
                                <div style={{ flex: 1 }}>
                                  <p className="text-small commitment-done">{step.text}</p>
                                  {step.completion_note && (
                                    <p style={{ fontSize: '0.72rem', color: 'var(--grey-mid)', marginTop: 1, fontStyle: 'italic' }}>"{step.completion_note}"</p>
                                  )}
                                </div>
                                <span className="mono" style={{ marginLeft: 8, fontSize: '0.52rem', color: 'var(--grey-mid)', whiteSpace: 'nowrap' }}>
                                  Lv {step.exercise_level}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Commitment history */}
                        {goal.commitment_history.length > 0 && (
                          <div>
                            <span style={{ ...sectionLabel, marginBottom: 8 }}>Commitment log</span>
                            {[...goal.commitment_history].reverse().map((c, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--grey-light)' }}>
                                <p className={`text-small flex-1${c.status === 'done' ? ' commitment-done' : ''}`}>{c.text}</p>
                                <span className="mono" style={{
                                  marginLeft: 8, fontSize: '0.52rem',
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
        </div>

        {/* ── RIGHT SIDEBAR ──────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 72, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Start session */}
          <div>
            <button
              className="btn-primary"
              onClick={onStartSession}
              style={{ width: '100%', padding: '14px 20px', fontSize: '0.7rem', letterSpacing: '0.12em' }}
            >
              Start session
            </button>
            <p className="mono" style={{ fontSize: '0.48rem', color: 'var(--grey-mid)', textAlign: 'center', marginTop: 8, letterSpacing: '0.08em' }}>
              {profile.sessions_completed} sessions completed
              {profile.resistance_pattern && ` · ${reInterviewDays > 0 ? reInterviewDays + 'd until check-in' : 'check-in due'}`}
            </p>
          </div>

          {/* Tools */}
          <div>
            <span style={sectionLabel}>Tools</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tools.map(tool => (
                <SideCard
                  key={tool.label}
                  label={tool.label}
                  sub={tool.sub}
                  desc={tool.desc}
                  onClick={tool.onClick}
                  cta="Open →"
                />
              ))}
            </div>
          </div>

          {/* Thinking Tools (Agents) */}
          <div>
            <span style={sectionLabel}>Thinking tools</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AGENTS.map(agent => (
                <SideCard
                  key={agent.id}
                  label={agent.name}
                  sub={agent.author}
                  desc={agent.tagline}
                  onClick={() => onEnterAgent?.(agent.id)}
                  cta="Enter →"
                />
              ))}
            </div>
          </div>

          {/* Publishing log */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={sectionLabel}>Published {publishing_log.length > 0 && `(${publishing_log.length})`}</span>
              {!showProofForm && (
                <button
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', letterSpacing: '0.1em', color: 'var(--grey-mid)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  onClick={() => setShowProofForm('global')}
                >
                  + Add
                </button>
              )}
            </div>

            {showProofForm === 'global' && (
              <form onSubmit={e => submitProof(e, '', '')} style={{ marginBottom: 12 }}>
                <ProofFields
                  url={proofUrl} setUrl={setProofUrl}
                  platform={proofPlatform} setPlatform={setProofPlatform}
                  description={proofDescription} setDescription={setProofDescription}
                  submitting={submittingProof}
                  onCancel={() => setShowProofForm(null)}
                />
              </form>
            )}

            {publishing_log.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--grey-mid)', lineHeight: 1.6 }}>
                Nothing published yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {publishing_log.slice(0, 5).map(entry => (
                  <div key={entry.log_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--grey-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)' }}>{platformLabel(entry.platform)}</span>
                      <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)' }}>{formatDate(entry.published_at)}</span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', lineHeight: 1.4 }}>{entry.description}</p>
                    {entry.url && entry.url !== 'direct message — no url' && (
                      <a href={entry.url} target="_blank" rel="noopener noreferrer"
                        className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)', wordBreak: 'break-all' }}>
                        {entry.url}
                      </a>
                    )}
                  </div>
                ))}
                {publishing_log.length > 5 && (
                  <p className="mono" style={{ fontSize: '0.5rem', color: 'var(--grey-mid)', paddingTop: 6 }}>
                    +{publishing_log.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── SHARED SUBCOMPONENTS ────────────────────────────────────────

function SideCard({ label, sub, desc, onClick, cta }: {
  label: string
  sub: string
  desc: string
  onClick?: () => void
  cta: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '2px solid var(--black)',
        padding: '12px 14px',
        cursor: 'pointer',
        background: 'var(--bg)',
        boxShadow: hovered ? '1px 1px 0px var(--black)' : '3px 3px 0px var(--black)',
        transform: hovered ? 'translate(2px,2px)' : 'none',
        transition: 'box-shadow 0.1s, transform 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <span className="mono" style={{ fontSize: '0.45rem', color: 'var(--grey-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
            {sub}
          </span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.88rem', lineHeight: 1.2 }}>{label}</span>
        </div>
        <span className="mono" style={{ fontSize: '0.5rem', letterSpacing: '0.08em', color: 'var(--grey-mid)', flexShrink: 0, paddingTop: 2 }}>{cta}</span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--grey-mid)', lineHeight: 1.5, letterSpacing: '0.04em' }}>{desc}</p>
    </div>
  )
}

function ProofFields({ url, setUrl, platform, setPlatform, description, setDescription, submitting, onCancel }: {
  url: string; setUrl: (v: string) => void
  platform: string; setPlatform: (v: string) => void
  description: string; setDescription: (v: string) => void
  submitting: boolean; onCancel: () => void
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL to what you published" required
        style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', padding: 9, border: '1px solid var(--black)', width: '100%', background: 'var(--bg)' }} />
      <select value={platform} onChange={e => setPlatform(e.target.value)}
        style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', padding: 9, border: '1px solid var(--black)', background: 'var(--bg)' }}>
        <option value="community">Unlabeled Community</option>
        <option value="linkedin">LinkedIn</option>
        <option value="twitter">X / Twitter</option>
        <option value="substack">Substack</option>
        <option value="blog">Blog</option>
        <option value="email">Email (no URL)</option>
        <option value="other">Other</option>
      </select>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you publish? One or two sentences." rows={2} required
        style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', padding: 9, border: '1px solid var(--black)', resize: 'vertical', background: 'var(--bg)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={submitting} style={{ fontSize: '0.75rem' }}>
          {submitting ? 'Saving…' : 'Save proof'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
