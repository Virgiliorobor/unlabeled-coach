import { useState, useEffect } from 'react'
import ProgressMap from '../components/ProgressMap'
import { AGENTS, AgentId } from './AgentChat'

// ── Tactile OS palette (mirrors Stitch DESIGN.md) ──────────────
const T = {
  ivory:      '#F4F4F0',   // main surface
  white:      '#FFFFFF',   // card face (elevated)
  black:      '#111111',   // structure, borders, type
  red:        '#E03C31',   // NASA red — deadlines, overdue
  yellow:     '#FFF000',   // highlighter — active, selected
  grey:       '#888880',   // secondary text
  greyLight:  '#D8D8D4',   // subtle dividers
  greyBg:     '#F1EDEC',   // surface-container (inputs, recessed areas)
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

// ── Layout constants ───────────────────────────────────────────
const dash: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 32px',
}

// Space Mono uppercase section label — System quadrant style
const secLabel: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: '0.6rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: T.grey,
  display: 'block',
  marginBottom: 12,
}

// Phase/status pill — black tag from Clarity screen
function PhaseTag({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: '0.48rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '2px 7px',
      background: dim ? 'transparent' : T.black,
      color: dim ? T.grey : T.ivory,
      border: `1px solid ${dim ? T.greyLight : T.black}`,
      display: 'inline-block',
    }}>
      {children}
    </span>
  )
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
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: T.grey }}>
          Loading…
        </span>
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
    <div style={{ background: T.ivory, minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <div style={{
        borderBottom: `2px solid ${T.black}`,
        background: T.ivory,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ ...dash, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px' }}>
          {/* NASA-red DYMO brand label — from Transition State screen */}
          <div style={{
            background: T.red,
            color: '#FFFFFF',
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: '6px 14px',
            boxShadow: `3px 3px 0px ${T.black}`,
          }}>
            Unlabeled
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {profile.resistance_pattern && (
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.48rem',
                letterSpacing: '0.1em',
                color: T.grey,
                textTransform: 'uppercase',
              }}>
                {profile.resistance_pattern.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.52rem', color: T.grey }}>{slug}</span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
                letterSpacing: '0.1em', textTransform: 'uppercase', color: T.grey,
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO BOARD ──────────────────────────────────── */}
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
          <span style={secLabel}>Goals</span>

          {activeGoals.length === 0 ? (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.6rem', color: T.grey, lineHeight: 1.6 }}>
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
                  <div key={goal.goal_id} style={{
                    background: T.white,
                    border: `2px solid ${T.black}`,
                    boxShadow: `4px 4px 0px ${T.black}`,
                    position: 'relative',
                  }}>
                    {/* NASA red corner flag for overdue goals — from Workbench screen */}
                    {isOverdue && (
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 0, height: 0,
                        borderTop: `28px solid ${T.red}`,
                        borderLeft: '28px solid transparent',
                      }} />
                    )}

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          <PhaseTag>{horizonLabel(goal.horizon)}</PhaseTag>
                          <PhaseTag dim>{phaseLabel(goal.phase)}
                            {!goal.phase_progress.time_gate_clear && ` · d${goal.phase_progress.days_elapsed}`}
                          </PhaseTag>
                          {goal.active_commitment && (
                            <span style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: '0.45rem', letterSpacing: '0.08em',
                              color: isOverdue ? T.red : T.black,
                              textTransform: 'uppercase',
                            }}>
                              {isOverdue ? '⚠ overdue' : '⚡ committed'}
                            </span>
                          )}
                          {hasPending && !goal.active_commitment && (
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', color: T.grey, textTransform: 'uppercase' }}>
                              ■ step pending
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: '1rem', fontFamily: "'EB Garamond', Georgia, serif",
                          lineHeight: 1.35, marginBottom: goal.description && !isExpanded ? 4 : 0,
                        }}>
                          {goal.title}
                        </p>
                        {goal.description && !isExpanded && (
                          <p style={{
                            fontSize: '0.85rem', color: T.grey, lineHeight: 1.4,
                            fontFamily: "'EB Garamond', Georgia, serif", marginTop: 4,
                          }}>
                            {goal.description.length > 120 ? goal.description.slice(0, 120) + '…' : goal.description}
                          </p>
                        )}
                      </div>
                      <span style={{
                        marginLeft: 12, fontFamily: "'Space Mono', monospace",
                        fontSize: '0.55rem', color: T.grey, flexShrink: 0, paddingTop: 2,
                      }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${T.greyLight}`, padding: '20px 20px' }}>

                        {goal.description && (
                          <p style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 20, color: T.grey,
                          }}>
                            {goal.description}
                          </p>
                        )}

                        {/* Pending action steps */}
                        {hasPending && (
                          <div style={{ marginBottom: 20 }}>
                            <span style={{ ...secLabel, marginBottom: 8 }}>Current exercise</span>
                            {goal.action_steps.pending.map(step => (
                              <div key={step.step_id} style={{
                                padding: 14,
                                background: T.greyBg,
                                border: `1px solid ${T.greyLight}`,
                                marginBottom: 8,
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.48rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Level {step.exercise_level}
                                  </span>
                                  <span style={{
                                    fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
                                    color: daysUntil(step.due_date) <= 0 ? T.red : T.grey,
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                  }}>
                                    due {formatDate(step.due_date)}{daysUntil(step.due_date) <= 0 && ' · overdue'}
                                  </span>
                                </div>
                                <p style={{
                                  fontFamily: "'EB Garamond', Georgia, serif",
                                  fontSize: '0.95rem', lineHeight: 1.55, marginBottom: 6,
                                }}>
                                  {step.text}
                                </p>
                                {step.coach_reason && (
                                  <p style={{ fontSize: '0.8rem', color: T.grey, fontStyle: 'italic', marginBottom: 8 }}>
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
                                      style={{
                                        width: '100%', marginBottom: 8,
                                        fontFamily: "'EB Garamond', Georgia, serif",
                                        fontSize: '0.9rem', padding: 10,
                                        border: `1px solid ${T.black}`, resize: 'vertical',
                                        background: T.white,
                                      }}
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <SystemBtn onClick={() => completeStep(step.step_id)}>Done — save note</SystemBtn>
                                      <SystemBtn ghost onClick={() => setCompletingStep(null)}>Cancel</SystemBtn>
                                    </div>
                                  </div>
                                ) : skippingStep === step.step_id ? (
                                  <div>
                                    <textarea
                                      value={skipReason}
                                      onChange={e => setSkipReason(e.target.value)}
                                      placeholder="What got in the way? (the coach will see this)"
                                      rows={2}
                                      style={{
                                        width: '100%', marginBottom: 8,
                                        fontFamily: "'EB Garamond', Georgia, serif",
                                        fontSize: '0.9rem', padding: 10,
                                        border: `1px solid ${T.black}`, resize: 'vertical',
                                        background: T.white,
                                      }}
                                    />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <SystemBtn ghost onClick={() => skipStep(step.step_id)}>Skip with reason</SystemBtn>
                                      <SystemBtn ghost onClick={() => setSkippingStep(null)}>Cancel</SystemBtn>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <SystemBtn ghost onClick={() => { setCompletingStep(step.step_id); setSkippingStep(null) }}>Mark done</SystemBtn>
                                    <SystemBtn ghost onClick={() => { setSkippingStep(step.step_id); setCompletingStep(null) }} dim>Skip</SystemBtn>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Active commitment */}
                        {goal.active_commitment && (
                          <div style={{ marginBottom: 20 }}>
                            <span style={{ ...secLabel, marginBottom: 8 }}>Active commitment</span>
                            <div style={{
                              padding: 16,
                              background: T.white,
                              border: `2px solid ${isOverdue ? T.red : T.black}`,
                              boxShadow: `3px 3px 0px ${isOverdue ? T.red : T.black}`,
                              position: 'relative',
                            }}>
                              {/* Top status strip */}
                              <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                marginBottom: 8, paddingBottom: 8,
                                borderBottom: `1px solid ${T.greyLight}`,
                              }}>
                                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.grey }}>
                                  Rung {goal.active_commitment.ladder_rung}
                                </span>
                                <span style={{
                                  fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
                                  color: isOverdue ? T.red : T.grey,
                                  textTransform: 'uppercase', letterSpacing: '0.08em',
                                }}>
                                  due {formatDate(goal.active_commitment.due_date)}{isOverdue && ' · overdue'}
                                </span>
                              </div>
                              <p style={{
                                fontFamily: "'EB Garamond', Georgia, serif",
                                fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 12,
                              }}>
                                {goal.active_commitment.text}
                              </p>
                              {goal.active_commitment.share_post && (
                                <div style={{
                                  marginBottom: 12, padding: '10px 14px',
                                  background: T.greyBg,
                                  borderLeft: `3px solid ${T.black}`,
                                }}>
                                  <span style={{ ...secLabel, marginBottom: 4, fontSize: '0.48rem' }}>Ready to post</span>
                                  <p style={{
                                    fontFamily: "'EB Garamond', Georgia, serif",
                                    fontSize: '0.88rem', fontStyle: 'italic',
                                  }}>
                                    {goal.active_commitment.share_post}
                                  </p>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <SystemBtn onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'done')}>Mark done</SystemBtn>
                                <SystemBtn ghost onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'partial')}>Partial</SystemBtn>
                                <SystemBtn ghost onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'missed')} dim>Missed</SystemBtn>
                              </div>
                              {showProofForm !== goal.goal_id ? (
                                <button
                                  style={{
                                    fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
                                    letterSpacing: '0.08em', color: T.grey,
                                    cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                                    textTransform: 'uppercase',
                                  }}
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
                            <span style={{ ...secLabel, marginBottom: 8 }}>
                              Completed exercises ({goal.phase_progress.completed_action_steps})
                            </span>
                            {goal.action_steps.recent_done.map(step => (
                              <div key={step.step_id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                padding: '6px 0', borderBottom: `1px solid ${T.greyLight}`,
                              }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{
                                    fontFamily: "'EB Garamond', Georgia, serif",
                                    fontSize: '0.85rem', textDecoration: 'line-through', color: T.grey,
                                  }}>
                                    {step.text}
                                  </p>
                                  {step.completion_note && (
                                    <p style={{
                                      fontSize: '0.75rem', color: T.grey, marginTop: 1, fontStyle: 'italic',
                                      fontFamily: "'EB Garamond', Georgia, serif",
                                    }}>
                                      "{step.completion_note}"
                                    </p>
                                  )}
                                </div>
                                <span style={{
                                  marginLeft: 8, fontFamily: "'Space Mono', monospace",
                                  fontSize: '0.48rem', color: T.grey, whiteSpace: 'nowrap',
                                }}>
                                  Lv {step.exercise_level}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Commitment history */}
                        {goal.commitment_history.length > 0 && (
                          <div>
                            <span style={{ ...secLabel, marginBottom: 8 }}>Commitment log</span>
                            {[...goal.commitment_history].reverse().map((c, i) => (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '5px 0', borderBottom: `1px solid ${T.greyLight}`,
                              }}>
                                <p style={{
                                  flex: 1,
                                  fontFamily: "'EB Garamond', Georgia, serif",
                                  fontSize: '0.85rem',
                                  color: c.status === 'done' ? T.grey : T.black,
                                  textDecoration: c.status === 'done' ? 'line-through' : 'none',
                                }}>
                                  {c.text}
                                </p>
                                <span style={{
                                  marginLeft: 8, fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
                                  color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? T.red : T.grey,
                                  textTransform: 'uppercase', letterSpacing: '0.06em',
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

          {/* Start session — DYMO black button from Workbench screen */}
          <div>
            <DymoBtn onClick={onStartSession} fullWidth>
              Start session
            </DymoBtn>
            <p style={{
              fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', color: T.grey,
              textAlign: 'center', marginTop: 8, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {profile.sessions_completed} sessions completed
              {profile.resistance_pattern && ` · ${reInterviewDays > 0 ? reInterviewDays + 'd until check-in' : 'check-in due'}`}
            </p>
          </div>

          {/* Tools */}
          <div>
            <span style={secLabel}>Tools</span>
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
            <span style={secLabel}>Thinking tools</span>
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

          {/* Publishing log — System style with left-border entries */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={secLabel}>Published {publishing_log.length > 0 && `(${publishing_log.length})`}</span>
              {!showProofForm && (
                <button
                  style={{
                    fontFamily: "'Space Mono', monospace", fontSize: '0.45rem',
                    letterSpacing: '0.1em', color: T.grey, cursor: 'pointer',
                    background: 'none', border: 'none', padding: 0, textTransform: 'uppercase',
                  }}
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
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.52rem', color: T.grey, lineHeight: 1.6 }}>
                Nothing published yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {publishing_log.slice(0, 5).map(entry => (
                  <div key={entry.log_id} style={{
                    padding: '8px 0 8px 10px',
                    borderBottom: `1px solid ${T.greyLight}`,
                    borderLeft: `2px solid ${T.black}`,
                    marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {platformLabel(entry.platform)}
                      </span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', color: T.grey }}>
                        {formatDate(entry.published_at)}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.85rem', lineHeight: 1.4 }}>
                      {entry.description}
                    </p>
                    {entry.url && entry.url !== 'direct message — no url' && (
                      <a href={entry.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.45rem', color: T.grey, wordBreak: 'break-all' }}>
                        {entry.url}
                      </a>
                    )}
                  </div>
                ))}
                {publishing_log.length > 5 && (
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.48rem', color: T.grey, paddingTop: 6 }}>
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

// DymoBtn — black DYMO label button, 4px hard shadow (Workbench)
function DymoBtn({ children, onClick, fullWidth }: {
  children: React.ReactNode
  onClick?: () => void
  fullWidth?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.black,
        color: '#FFFFFF',
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        border: `2px solid ${T.black}`,
        padding: '12px 20px',
        cursor: 'pointer',
        width: fullWidth ? '100%' : 'auto',
        boxShadow: hovered ? `1px 1px 0px ${T.black}` : `4px 4px 0px ${T.black}`,
        transform: hovered ? 'translate(3px,3px)' : 'none',
        transition: 'box-shadow 0.1s, transform 0.1s',
      }}
    >
      {children}
    </button>
  )
}

// SystemBtn — rectangular bordered button (System/Clarity quadrant)
function SystemBtn({ children, onClick, ghost, dim }: {
  children: React.ReactNode
  onClick?: () => void
  ghost?: boolean
  dim?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '0.48rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '6px 12px',
        border: `1px solid ${dim ? T.greyLight : T.black}`,
        background: ghost ? 'transparent' : T.black,
        color: ghost ? (dim ? T.grey : T.black) : '#FFFFFF',
        cursor: 'pointer',
        boxShadow: hovered ? 'none' : (ghost ? 'none' : `2px 2px 0px ${T.black}`),
        transform: hovered ? 'translate(1px,1px)' : 'none',
        transition: 'box-shadow 0.08s, transform 0.08s',
      }}
    >
      {children}
    </button>
  )
}

// SideCard — white card with 4px hard shadow (Workbench tool card)
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
        border: `2px solid ${T.black}`,
        padding: '12px 14px',
        cursor: 'pointer',
        background: T.white,
        boxShadow: hovered ? `1px 1px 0px ${T.black}` : `3px 3px 0px ${T.black}`,
        transform: hovered ? 'translate(2px,2px)' : 'none',
        transition: 'box-shadow 0.1s, transform 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <span style={{
            fontFamily: "'Space Mono', monospace", fontSize: '0.42rem',
            color: T.grey, letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'block', marginBottom: 2,
          }}>
            {sub}
          </span>
          <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.2 }}>
            {label}
          </span>
        </div>
        <span style={{
          fontFamily: "'Space Mono', monospace", fontSize: '0.45rem',
          letterSpacing: '0.08em', color: T.grey, flexShrink: 0, paddingTop: 2,
        }}>
          {cta}
        </span>
      </div>
      <p style={{
        fontFamily: "'Space Mono', monospace", fontSize: '0.48rem',
        color: T.grey, lineHeight: 1.5, letterSpacing: '0.03em',
      }}>
        {desc}
      </p>
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
        style={{
          fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 9,
          border: `1px solid ${T.black}`, width: '100%', background: T.white,
        }} />
      <select value={platform} onChange={e => setPlatform(e.target.value)}
        style={{
          fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 9,
          border: `1px solid ${T.black}`, background: T.white,
        }}>
        <option value="community">Unlabeled Community</option>
        <option value="linkedin">LinkedIn</option>
        <option value="twitter">X / Twitter</option>
        <option value="substack">Substack</option>
        <option value="blog">Blog</option>
        <option value="email">Email (no URL)</option>
        <option value="other">Other</option>
      </select>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you publish? One or two sentences." rows={2} required
        style={{
          fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 9,
          border: `1px solid ${T.black}`, resize: 'vertical', background: T.white,
        }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting} style={{
          fontFamily: "'Space Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '6px 12px',
          border: `1px solid ${T.black}`, background: T.black, color: '#FFFFFF', cursor: 'pointer',
          boxShadow: `2px 2px 0px ${T.black}`, opacity: submitting ? 0.5 : 1,
        }}>
          {submitting ? 'Saving…' : 'Save proof'}
        </button>
        <SystemBtn ghost dim onClick={onCancel}>Cancel</SystemBtn>
      </div>
    </div>
  )
}
