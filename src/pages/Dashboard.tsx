import { useState, useEffect } from 'react'
import ProgressMap from '../components/ProgressMap'
import { AGENTS, AgentId } from './AgentChat'

// ── Tactile OS palette ─────────────────────────────────────────
const T = {
  ivory:     '#F4F4F0',
  white:     '#FFFFFF',
  black:     '#111111',
  red:       '#E03C31',
  yellow:    '#FFF000',
  grey:      '#888880',
  greyLight: '#D8D8D4',
  greyBg:    '#ECEAE5',
}

const MONO: React.CSSProperties = {
  fontFamily: "'Space Mono', 'Courier New', monospace",
}
const SERIF: React.CSSProperties = {
  fontFamily: "'EB Garamond', Georgia, serif",
}

// ── Nav phases — from all Stitch screens ──────────────────────
const NAV_ITEMS = [
  { id: 'intake',         label: 'Intake',         icon: '○' },
  { id: 'reflection',     label: 'Reflection',      icon: '◎' },
  { id: 'clarity',        label: 'Clarity',         icon: '◈' },
  { id: 'resistance',     label: 'Resistance',      icon: '!' },
  { id: 'commitment',     label: 'Commitment',      icon: '◆' },
  { id: 'accountability', label: 'Accountability',  icon: '✓' },
]

// ── Interfaces ─────────────────────────────────────────────────
interface ActionStep {
  step_id: string; text: string; assigned_at: string; due_date: string
  status: 'pending' | 'done' | 'skipped'; coach_reason: string
  completion_note: string; phase_assigned: string; exercise_level: number; goal_id: string
}
interface ActiveCommitment {
  commitment_id: string; text: string; declared_at: string; due_date: string
  status: string; ladder_rung: number; share_post: string; print_card: string
}
interface PhaseProgress {
  days_elapsed: number; minimum_days: number
  time_gate_clear: boolean; completed_action_steps: number
}
interface GoalData {
  goal_id: string; title: string; description: string; horizon: string; phase: string
  phase_started_at: string; added_at: string; last_touched: string; status: string
  phase_progress: PhaseProgress
  action_steps: { pending: ActionStep[]; recent_done: ActionStep[] }
  active_commitment: ActiveCommitment | null
  commitment_history: Array<{ text: string; status: string; due_date: string; outcome_notes: string }>
}
interface PublishingEntry {
  log_id: string; url: string; platform: string; published_at: string
  goal_id: string; commitment_id: string; description: string
}
interface DashboardData {
  profile: {
    slug: string; build_name: string; build_description: string; build_state: string
    initial_interview_done: boolean; sessions_completed: number; last_session_date: string
    re_interview_due: string; re_interview_overdue: boolean
    dominant_lens: string; resistance_pattern: string
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

// ── Helpers ────────────────────────────────────────────────────
function fmt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function daysUntil(iso: string) {
  if (!iso) return 0
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}
const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn', twitter: 'X/Twitter', substack: 'Substack',
  community: 'Community', email: 'Email', blog: 'Blog', other: 'Published',
}
const PHASE_LABELS: Record<string, string> = {
  intake: 'Intake', reflection: 'Reflection', clarity: 'Clarity',
  resistance: 'Resistance', commitment: 'Commitment', accountability: 'Accountability',
}
const HORIZON_LABELS: Record<string, string> = {
  thirty_days: '30 days', ninety_days: '90 days', twelve_months: '12 months', ongoing: 'Ongoing',
}

// ── Main component ─────────────────────────────────────────────
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
      const active = (d?.goals || []).filter((g: GoalData) => g.status === 'active')
      if (active.length > 0) {
        const primary = [...active].sort((a: GoalData, b: GoalData) =>
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
      body: JSON.stringify({ status }),
    })
    load()
  }
  async function completeStep(id: string) {
    await fetch(`/api/dashboard/action-step/${id}/complete`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_note: completionNote }),
    })
    setCompletingStep(null); setCompletionNote(''); load()
  }
  async function skipStep(id: string) {
    await fetch(`/api/dashboard/action-step/${id}/skip`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: skipReason }),
    })
    setSkippingStep(null); setSkipReason(''); load()
  }
  async function submitProof(e: { preventDefault: () => void }, goalId: string, commitmentId: string) {
    e.preventDefault()
    if (!proofUrl || !proofDescription) return
    setSubmittingProof(true)
    await fetch('/api/dashboard/publishing-log', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: proofUrl, platform: proofPlatform, description: proofDescription, commitment_id: commitmentId, goal_id: goalId }),
    })
    setProofUrl(''); setProofPlatform('community'); setProofDescription('')
    setShowProofForm(null); setSubmittingProof(false); load()
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: T.ivory }}>
      <span style={{ ...MONO, fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.grey }}>Loading…</span>
    </div>
  )
  if (!data) return null

  const { profile, goals, publishing_log } = data
  const activeGoals = goals.filter(g => g.status === 'active')
  const primaryPhase = activeGoals.length > 0
    ? [...activeGoals].sort((a, b) => new Date(b.last_touched).getTime() - new Date(a.last_touched).getTime())[0].phase
    : 'intake'

  const goalRows = goals.map(g => ({
    goal_id: g.goal_id, title: g.title, horizon: g.horizon, phase: g.phase, status: g.status,
    has_pending_step: g.action_steps.pending.length > 0,
    has_active_commitment: g.active_commitment !== null,
    days_in_phase: g.phase_progress.days_elapsed,
    time_gate_clear: g.phase_progress.time_gate_clear,
  }))

  const tools = [
    { label: 'Clearness Committee', sub: 'Quaker practice', desc: 'Nine questions, no advice. Clarity arrives on its own.', onClick: onEnterClearness },
    { label: 'Task Simplifier', sub: 'Making Ideas Happen', desc: 'Find the first move buried inside the task.', onClick: onEnterSimplify },
  ]

  return (
    // ── ROOT: full-viewport flex row — matches all Stitch screens ──
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.ivory }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        height: '100%', display: 'flex', flexDirection: 'column',
        borderRight: `2px solid ${T.black}`,
        background: T.ivory,
      }}>
        {/* Brand header */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${T.greyLight}` }}>
          <div style={{
            ...MONO, fontSize: '0.55rem', fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            background: T.red, color: T.white,
            padding: '5px 10px', display: 'inline-block',
            boxShadow: `2px 2px 0px ${T.black}`,
          }}>
            Unlabeled
          </div>
          <p style={{ ...MONO, fontSize: '0.42rem', color: T.grey, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Phase: {PHASE_LABELS[primaryPhase] || 'Intake'}
          </p>
        </div>

        {/* Phase navigation — yellow active state from all Stitch screens */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.id === primaryPhase
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px',
                  background: isActive ? T.yellow : 'transparent',
                  border: isActive ? `1px solid ${T.black}` : '1px solid transparent',
                  transform: isActive ? 'translateX(3px)' : 'none',
                  cursor: 'default',
                  marginBottom: 1,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{
                  ...MONO, fontSize: '0.5rem', color: isActive ? T.black : T.grey,
                  letterSpacing: '0.06em',
                }}>
                  {item.icon}
                </span>
                <span style={{
                  ...MONO, fontSize: '0.52rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', fontWeight: isActive ? 700 : 400,
                  color: isActive ? T.black : T.grey,
                }}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </nav>

        {/* Sidebar footer — session button + sign out */}
        <div style={{ borderTop: `1px solid ${T.greyLight}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Start Session — DYMO black label button */}
          <DymoBtn onClick={onStartSession} fullWidth>Start session</DymoBtn>
          <p style={{ ...MONO, fontSize: '0.4rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
            {profile.sessions_completed} sessions completed
          </p>
          <button
            onClick={handleLogout}
            style={{
              ...MONO, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.42rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: T.grey, padding: '4px 0', textAlign: 'left',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA: top bar + scrollable content ──────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 52, flexShrink: 0,
          borderBottom: `2px solid ${T.black}`,
          background: T.ivory,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px',
        }}>
          <span style={{ ...MONO, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {PHASE_LABELS[primaryPhase] || 'Dashboard'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {profile.resistance_pattern && (
              <span style={{ ...MONO, fontSize: '0.42rem', color: T.grey, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {profile.resistance_pattern.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{ ...MONO, fontSize: '0.45rem', color: T.grey }}>{slug}</span>
            {profile.re_interview_overdue && (
              <span style={{ ...MONO, fontSize: '0.42rem', background: T.red, color: T.white, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Check-in due
              </span>
            )}
          </div>
        </header>

        {/* Scrollable main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 80px' }}>

          {/* Progress map */}
          <div style={{ marginBottom: 28 }}>
            <ProgressMap
              goals={goalRows}
              publishingCount={publishing_log.length}
              sessionsCompleted={profile.sessions_completed}
              resistancePattern={profile.resistance_pattern}
              initialInterviewDone={profile.initial_interview_done}
            />
          </div>

          {/* Two-column grid: goals + right sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

            {/* ── GOALS column ────────────────────────────── */}
            <div>
              <SectionLabel>Goals</SectionLabel>

              {activeGoals.length === 0 ? (
                <p style={{ ...MONO, fontSize: '0.55rem', color: T.grey, lineHeight: 1.7 }}>
                  {profile.initial_interview_done
                    ? 'No active goals — start a session to add your first goal.'
                    : 'Start a session to begin your intake interview.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activeGoals.map(goal => {
                    const isExpanded = expandedGoal === goal.goal_id
                    const isOverdue = goal.active_commitment ? daysUntil(goal.active_commitment.due_date) <= 0 : false
                    const hasPending = goal.action_steps.pending.length > 0

                    return (
                      <div key={goal.goal_id} style={{
                        background: T.white,
                        border: `1px solid ${T.black}`,
                        borderBottom: 'none',
                        position: 'relative',
                      }}>
                        {/* Last goal gets bottom border */}
                        {/* NASA red corner flag for overdue */}
                        {isOverdue && (
                          <div style={{
                            position: 'absolute', top: 0, right: 0, zIndex: 1,
                            width: 0, height: 0,
                            borderTop: `24px solid ${T.red}`,
                            borderLeft: '24px solid transparent',
                          }} />
                        )}

                        {/* Goal header row */}
                        <button
                          onClick={() => setExpandedGoal(isExpanded ? null : goal.goal_id)}
                          style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'flex-start', background: 'none', border: 'none',
                            cursor: 'pointer', padding: '14px 16px', textAlign: 'left',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                              {/* Horizon tag */}
                              <span style={{
                                ...MONO, fontSize: '0.42rem', letterSpacing: '0.1em',
                                textTransform: 'uppercase', padding: '2px 6px',
                                background: T.black, color: T.ivory,
                                border: `1px solid ${T.black}`,
                              }}>
                                {HORIZON_LABELS[goal.horizon] || goal.horizon}
                              </span>
                              {/* Phase tag */}
                              <span style={{
                                ...MONO, fontSize: '0.42rem', letterSpacing: '0.08em',
                                textTransform: 'uppercase', padding: '2px 6px',
                                background: 'transparent', color: T.grey,
                                border: `1px solid ${T.greyLight}`,
                              }}>
                                {PHASE_LABELS[goal.phase] || goal.phase}
                                {!goal.phase_progress.time_gate_clear && ` · d${goal.phase_progress.days_elapsed}`}
                              </span>
                              {goal.active_commitment && (
                                <span style={{
                                  ...MONO, fontSize: '0.4rem', letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color: isOverdue ? T.red : T.black,
                                }}>
                                  {isOverdue ? '⚠ overdue' : '⚡ committed'}
                                </span>
                              )}
                              {hasPending && !goal.active_commitment && (
                                <span style={{ ...MONO, fontSize: '0.4rem', color: T.grey, textTransform: 'uppercase' }}>
                                  ■ step pending
                                </span>
                              )}
                            </div>
                            <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.35 }}>
                              {goal.title}
                            </p>
                            {goal.description && !isExpanded && (
                              <p style={{ ...SERIF, fontSize: '0.83rem', color: T.grey, lineHeight: 1.4, marginTop: 3 }}>
                                {goal.description.length > 120 ? goal.description.slice(0, 120) + '…' : goal.description}
                              </p>
                            )}
                          </div>
                          <span style={{ ...MONO, marginLeft: 10, fontSize: '0.5rem', color: T.grey, flexShrink: 0, paddingTop: 2 }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${T.greyLight}`, padding: '16px 16px' }}>
                            {goal.description && (
                              <p style={{ ...SERIF, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 18, color: T.grey }}>
                                {goal.description}
                              </p>
                            )}

                            {/* Pending action steps */}
                            {hasPending && (
                              <div style={{ marginBottom: 18 }}>
                                <SectionLabel small>Current exercise</SectionLabel>
                                {goal.action_steps.pending.map(step => (
                                  <div key={step.step_id} style={{
                                    padding: 12, background: T.greyBg,
                                    border: `1px solid ${T.greyLight}`, marginBottom: 8,
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                      <span style={{ ...MONO, fontSize: '0.42rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Level {step.exercise_level}
                                      </span>
                                      <span style={{
                                        ...MONO, fontSize: '0.42rem',
                                        color: daysUntil(step.due_date) <= 0 ? T.red : T.grey,
                                        textTransform: 'uppercase', letterSpacing: '0.08em',
                                      }}>
                                        due {fmt(step.due_date)}{daysUntil(step.due_date) <= 0 && ' · overdue'}
                                      </span>
                                    </div>
                                    <p style={{ ...SERIF, fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 5 }}>{step.text}</p>
                                    {step.coach_reason && (
                                      <p style={{ ...SERIF, fontSize: '0.78rem', color: T.grey, fontStyle: 'italic', marginBottom: 8 }}>{step.coach_reason}</p>
                                    )}
                                    {completingStep === step.step_id ? (
                                      <div>
                                        <textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)}
                                          placeholder="What did you do? What came up? (optional)" rows={3}
                                          style={{ ...SERIF, width: '100%', marginBottom: 8, fontSize: '0.88rem', padding: 9, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                          <Btn onClick={() => completeStep(step.step_id)}>Done — save note</Btn>
                                          <Btn ghost onClick={() => setCompletingStep(null)}>Cancel</Btn>
                                        </div>
                                      </div>
                                    ) : skippingStep === step.step_id ? (
                                      <div>
                                        <textarea value={skipReason} onChange={e => setSkipReason(e.target.value)}
                                          placeholder="What got in the way? (the coach will see this)" rows={2}
                                          style={{ ...SERIF, width: '100%', marginBottom: 8, fontSize: '0.88rem', padding: 9, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                          <Btn ghost onClick={() => skipStep(step.step_id)}>Skip with reason</Btn>
                                          <Btn ghost onClick={() => setSkippingStep(null)}>Cancel</Btn>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <Btn ghost onClick={() => { setCompletingStep(step.step_id); setSkippingStep(null) }}>Mark done</Btn>
                                        <Btn ghost dim onClick={() => { setSkippingStep(step.step_id); setCompletingStep(null) }}>Skip</Btn>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Active commitment */}
                            {goal.active_commitment && (
                              <div style={{ marginBottom: 18 }}>
                                <SectionLabel small>Active commitment</SectionLabel>
                                <div style={{
                                  padding: 14, background: T.white,
                                  border: `2px solid ${isOverdue ? T.red : T.black}`,
                                  boxShadow: `3px 3px 0px ${isOverdue ? T.red : T.black}`,
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, paddingBottom: 7, borderBottom: `1px solid ${T.greyLight}` }}>
                                    <span style={{ ...MONO, fontSize: '0.42rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.grey }}>Rung {goal.active_commitment.ladder_rung}</span>
                                    <span style={{ ...MONO, fontSize: '0.42rem', color: isOverdue ? T.red : T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                      due {fmt(goal.active_commitment.due_date)}{isOverdue && ' · overdue'}
                                    </span>
                                  </div>
                                  <p style={{ ...SERIF, fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 10 }}>{goal.active_commitment.text}</p>
                                  {goal.active_commitment.share_post && (
                                    <div style={{ marginBottom: 10, padding: '8px 12px', background: T.greyBg, borderLeft: `3px solid ${T.black}` }}>
                                      <span style={{ ...MONO, fontSize: '0.42rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.grey, display: 'block', marginBottom: 3 }}>Ready to post</span>
                                      <p style={{ ...SERIF, fontSize: '0.85rem', fontStyle: 'italic' }}>{goal.active_commitment.share_post}</p>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <Btn onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'done')}>Mark done</Btn>
                                    <Btn ghost onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'partial')}>Partial</Btn>
                                    <Btn ghost dim onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'missed')}>Missed</Btn>
                                  </div>
                                  {showProofForm !== goal.goal_id ? (
                                    <button onClick={() => setShowProofForm(goal.goal_id)}
                                      style={{ ...MONO, fontSize: '0.42rem', letterSpacing: '0.08em', color: T.grey, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textTransform: 'uppercase' }}>
                                      + Add proof of publication
                                    </button>
                                  ) : (
                                    <form onSubmit={e => submitProof(e, goal.goal_id, goal.active_commitment!.commitment_id)} style={{ marginTop: 8 }}>
                                      <ProofFields url={proofUrl} setUrl={setProofUrl} platform={proofPlatform} setPlatform={setProofPlatform}
                                        description={proofDescription} setDescription={setProofDescription}
                                        submitting={submittingProof} onCancel={() => setShowProofForm(null)} />
                                    </form>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Completed exercises */}
                            {goal.action_steps.recent_done.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <SectionLabel small>Completed ({goal.phase_progress.completed_action_steps})</SectionLabel>
                                {goal.action_steps.recent_done.map(step => (
                                  <div key={step.step_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: `1px solid ${T.greyLight}` }}>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ ...SERIF, fontSize: '0.83rem', textDecoration: 'line-through', color: T.grey }}>{step.text}</p>
                                      {step.completion_note && (
                                        <p style={{ ...SERIF, fontSize: '0.72rem', color: T.grey, fontStyle: 'italic', marginTop: 1 }}>"{step.completion_note}"</p>
                                      )}
                                    </div>
                                    <span style={{ ...MONO, marginLeft: 8, fontSize: '0.4rem', color: T.grey, whiteSpace: 'nowrap' }}>Lv {step.exercise_level}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Commitment history */}
                            {goal.commitment_history.length > 0 && (
                              <div>
                                <SectionLabel small>Commitment log</SectionLabel>
                                {[...goal.commitment_history].reverse().map((c, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${T.greyLight}` }}>
                                    <p style={{ flex: 1, ...SERIF, fontSize: '0.83rem', color: c.status === 'done' ? T.grey : T.black, textDecoration: c.status === 'done' ? 'line-through' : 'none' }}>{c.text}</p>
                                    <span style={{ marginLeft: 8, ...MONO, fontSize: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? T.red : T.grey }}>
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
                  {/* Close the stacked border */}
                  <div style={{ height: 1, background: T.black }} />
                </div>
              )}
            </div>

            {/* ── RIGHT PANEL: tools, agents, publishing log ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Tools */}
              <div>
                <SectionLabel>Tools</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {tools.map(tool => (
                    <ToolCard key={tool.label} label={tool.label} sub={tool.sub} desc={tool.desc} onClick={tool.onClick} cta="Open →" />
                  ))}
                </div>
              </div>

              {/* Thinking Tools (Agents) */}
              <div>
                <SectionLabel>Thinking tools</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {AGENTS.map(agent => (
                    <ToolCard key={agent.id} label={agent.name} sub={agent.author} desc={agent.tagline} onClick={() => onEnterAgent?.(agent.id)} cta="Enter →" />
                  ))}
                </div>
              </div>

              {/* Publishing log */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <SectionLabel inline>Published {publishing_log.length > 0 && `(${publishing_log.length})`}</SectionLabel>
                  {!showProofForm && (
                    <button onClick={() => setShowProofForm('global')}
                      style={{ ...MONO, fontSize: '0.4rem', letterSpacing: '0.1em', color: T.grey, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textTransform: 'uppercase' }}>
                      + Add
                    </button>
                  )}
                </div>
                {showProofForm === 'global' && (
                  <form onSubmit={e => submitProof(e, '', '')} style={{ marginBottom: 12 }}>
                    <ProofFields url={proofUrl} setUrl={setProofUrl} platform={proofPlatform} setPlatform={setProofPlatform}
                      description={proofDescription} setDescription={setProofDescription}
                      submitting={submittingProof} onCancel={() => setShowProofForm(null)} />
                  </form>
                )}
                {publishing_log.length === 0 ? (
                  <p style={{ ...MONO, fontSize: '0.48rem', color: T.grey, lineHeight: 1.6 }}>Nothing published yet.</p>
                ) : (
                  <div>
                    {publishing_log.slice(0, 5).map(entry => (
                      <div key={entry.log_id} style={{ padding: '7px 0 7px 10px', borderBottom: `1px solid ${T.greyLight}`, borderLeft: `2px solid ${T.black}`, marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                          <span style={{ ...MONO, fontSize: '0.4rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{PLATFORM_LABELS[entry.platform] || entry.platform}</span>
                          <span style={{ ...MONO, fontSize: '0.4rem', color: T.grey }}>{fmt(entry.published_at)}</span>
                        </div>
                        <p style={{ ...SERIF, fontSize: '0.82rem', lineHeight: 1.4 }}>{entry.description}</p>
                        {entry.url && entry.url !== 'direct message — no url' && (
                          <a href={entry.url} target="_blank" rel="noopener noreferrer"
                            style={{ ...MONO, fontSize: '0.4rem', color: T.grey, wordBreak: 'break-all' }}>{entry.url}</a>
                        )}
                      </div>
                    ))}
                    {publishing_log.length > 5 && (
                      <p style={{ ...MONO, fontSize: '0.45rem', color: T.grey, paddingTop: 4 }}>+{publishing_log.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ── SHARED SUBCOMPONENTS ────────────────────────────────────────

function SectionLabel({ children, small, inline }: { children: React.ReactNode; small?: boolean; inline?: boolean }) {
  const style: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace",
    fontSize: small ? '0.42rem' : '0.52rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#888880',
    display: inline ? 'inline' : 'block',
    marginBottom: inline ? 0 : 10,
  }
  return <span style={style}>{children}</span>
}

function DymoBtn({ children, onClick, fullWidth }: { children: React.ReactNode; onClick?: () => void; fullWidth?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: "'Space Mono', monospace", fontWeight: 700,
        fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase',
        background: T.black, color: T.white,
        border: `2px solid ${T.black}`, padding: '10px 16px', cursor: 'pointer',
        width: fullWidth ? '100%' : 'auto',
        boxShadow: hov ? `1px 1px 0px ${T.black}` : `4px 4px 0px ${T.black}`,
        transform: hov ? 'translate(3px,3px)' : 'none',
        transition: 'box-shadow 0.1s, transform 0.1s',
      }}>
      {children}
    </button>
  )
}

function Btn({ children, onClick, ghost, dim }: { children: React.ReactNode; onClick?: () => void; ghost?: boolean; dim?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: "'Space Mono', monospace", fontSize: '0.42rem',
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 10px',
        border: `1px solid ${dim ? T.greyLight : T.black}`,
        background: ghost ? 'transparent' : T.black,
        color: ghost ? (dim ? T.grey : T.black) : T.white,
        cursor: 'pointer',
        boxShadow: hov ? 'none' : (ghost ? 'none' : `2px 2px 0px ${T.black}`),
        transform: hov ? 'translate(1px,1px)' : 'none',
        transition: 'box-shadow 0.08s, transform 0.08s',
      }}>
      {children}
    </button>
  )
}

function ToolCard({ label, sub, desc, onClick, cta }: { label: string; sub: string; desc: string; onClick?: () => void; cta: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${T.black}`,
        borderBottom: 'none',
        padding: '10px 12px', cursor: 'pointer',
        background: hov ? T.greyBg : T.white,
        transition: 'background 0.1s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
        <div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.38rem', color: T.grey, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 1 }}>{sub}</span>
          <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: '0.88rem', lineHeight: 1.2 }}>{label}</span>
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.42rem', color: T.grey, letterSpacing: '0.06em', flexShrink: 0, paddingTop: 2 }}>{cta}</span>
      </div>
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.42rem', color: T.grey, lineHeight: 1.5, letterSpacing: '0.03em' }}>{desc}</p>
    </div>
  )
}

function ProofFields({ url, setUrl, platform, setPlatform, description, setDescription, submitting, onCancel }: {
  url: string; setUrl: (v: string) => void; platform: string; setPlatform: (v: string) => void
  description: string; setDescription: (v: string) => void; submitting: boolean; onCancel: () => void
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL to what you published" required
        style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 8, border: `1px solid ${T.black}`, width: '100%', background: T.white }} />
      <select value={platform} onChange={e => setPlatform(e.target.value)}
        style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 8, border: `1px solid ${T.black}`, background: T.white }}>
        <option value="community">Unlabeled Community</option>
        <option value="linkedin">LinkedIn</option>
        <option value="twitter">X / Twitter</option>
        <option value="substack">Substack</option>
        <option value="blog">Blog</option>
        <option value="email">Email (no URL)</option>
        <option value="other">Other</option>
      </select>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you publish? One or two sentences." rows={2} required
        style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', padding: 8, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting}
          style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.42rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 10px', border: `1px solid ${T.black}`, background: T.black, color: T.white, cursor: 'pointer', opacity: submitting ? 0.5 : 1, boxShadow: `2px 2px 0px ${T.black}` }}>
          {submitting ? 'Saving…' : 'Save proof'}
        </button>
        <Btn ghost dim onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  )
}
