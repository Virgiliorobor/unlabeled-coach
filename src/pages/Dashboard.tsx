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

// Font scale at html { font-size: 18px }:
// 0.611rem = 11px   ← DYMO labels
// 0.667rem = 12px   ← tags, captions
// 0.778rem = 14px   ← secondary body
// 0.889rem = 16px   ← body-small
// 1rem     = 18px   ← body
// 1.333rem = 24px   ← subheads
// 1.778rem = 32px   ← page headers
// 2.667rem = 48px   ← display

const NAV_ITEMS = [
  { id: 'intake',         label: 'Intake',         icon: '○' },
  { id: 'reflection',     label: 'Reflection',      icon: '◎' },
  { id: 'clarity',        label: 'Clarity',         icon: '◈' },
  { id: 'resistance',     label: 'Resistance',      icon: '!' },
  { id: 'commitment',     label: 'Commitment',      icon: '◆' },
  { id: 'accountability', label: 'Accountability',  icon: '✓' },
]

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

type InnerView = 'overview' | 'goal' | 'tools'

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

function quadrantFromPhase(phase: string): 'sanctuary' | 'sandbox' | 'system' | 'workbench' {
  switch (phase) {
    case 'interview': case 'intake': return 'sanctuary'
    case 'reflection': case 'clarity': return 'sandbox'
    case 'resistance': return 'system'
    case 'commitment': case 'accountability': return 'workbench'
    default: return 'sanctuary'
  }
}

// ── Main component ─────────────────────────────────────────────
export default function Dashboard({ slug, onStartSession, onPhaseChange, onEnterAgent, onEnterClearness, onEnterSimplify }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [innerView, setInnerView] = useState<InnerView>('overview')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
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
        if (!selectedGoalId) setSelectedGoalId(primary.goal_id)
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
      <span style={{ ...MONO, fontSize: '0.778rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.grey }}>Loading…</span>
    </div>
  )
  if (!data) return null

  const { profile, goals, publishing_log } = data
  const activeGoals = goals.filter(g => g.status === 'active')
  const primaryGoal = activeGoals.length > 0
    ? [...activeGoals].sort((a, b) => new Date(b.last_touched).getTime() - new Date(a.last_touched).getTime())[0]
    : null
  const primaryPhase = primaryGoal?.phase || 'intake'
  const quadrant = quadrantFromPhase(primaryPhase)
  const layoutMode: 'sanctuary' | 'reflection' | 'grid' =
    quadrant === 'sanctuary' ? 'sanctuary' :
    primaryPhase === 'reflection' ? 'reflection' :
    'grid'

  const selectedGoal = selectedGoalId
    ? activeGoals.find(g => g.goal_id === selectedGoalId) || null
    : null

  const goalRows = goals.map(g => ({
    goal_id: g.goal_id, title: g.title, horizon: g.horizon, phase: g.phase, status: g.status,
    has_pending_step: g.action_steps.pending.length > 0,
    has_active_commitment: g.active_commitment !== null,
    days_in_phase: g.phase_progress.days_elapsed,
    time_gate_clear: g.phase_progress.time_gate_clear,
  }))

  const practiceTools = [
    { label: 'Clearness Committee', sub: 'Quaker practice', desc: 'Nine questions, no advice.', onClick: onEnterClearness },
    { label: 'Task Simplifier', sub: 'Making Ideas Happen', desc: 'Find the first move buried inside the task.', onClick: onEnterSimplify },
    { label: 'Oblique Card', sub: 'Brian Eno & Peter Schmidt', desc: 'A random oblique strategy to break the block.', href: 'https://unlabeledbuild.netlify.app/tools/card.html' },
    { label: 'Blackout', sub: 'Austin Kleon', desc: 'Find a poem hiding inside a page of prose.', href: 'https://unlabeledbuild.netlify.app/tools/blackout.html' },
    { label: 'Drawing to Discover', sub: 'GROW', desc: 'Use drawing to access what you already know.', href: 'https://unlabeledbuild.netlify.app/tools/grow.html' },
  ]

  const phaseHeader = primaryPhase === 'commitment' ? 'Workbench · Commitment'
    : primaryPhase === 'accountability' ? 'Workbench · Accountability'
    : primaryPhase === 'resistance' ? 'System · Resistance'
    : primaryPhase === 'clarity' ? 'Sandbox · Clarity'
    : PHASE_LABELS[primaryPhase] || 'Dashboard'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.ivory }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <aside style={{
        width: 220, flexShrink: 0,
        height: '100%', display: 'flex', flexDirection: 'column',
        borderRight: `2px solid ${T.black}`,
        background: T.ivory,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${T.greyLight}` }}>
          <div style={{
            ...MONO, fontSize: '0.611rem', fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            background: T.red, color: T.white,
            padding: '6px 10px', display: 'inline-block',
            boxShadow: `2px 2px 0px ${T.black}`,
          }}>
            Unlabeled
          </div>
          <p style={{ ...MONO, fontSize: '0.611rem', color: T.grey, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {PHASE_LABELS[primaryPhase] || 'Intake'}
          </p>
        </div>

        {/* Phase nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = item.id === primaryPhase
            return (
              <div
                key={item.id}
                onClick={() => { if (isActive) setInnerView('overview') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px',
                  background: isActive ? T.yellow : 'transparent',
                  border: isActive ? `1px solid ${T.black}` : '1px solid transparent',
                  boxShadow: isActive ? `4px 4px 0px ${T.black}` : 'none',
                  transform: isActive ? 'translateX(3px)' : 'none',
                  cursor: isActive ? 'pointer' : 'default',
                  marginBottom: 2,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ ...MONO, fontSize: '0.667rem', color: isActive ? T.black : T.grey }}>
                  {item.icon}
                </span>
                <span style={{
                  ...MONO, fontSize: '0.667rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', fontWeight: isActive ? 700 : 400,
                  color: isActive ? T.black : T.grey,
                }}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.greyLight}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DymoBtn onClick={onStartSession} fullWidth>Start session</DymoBtn>
          <p style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
            {profile.sessions_completed} sessions
          </p>
          <button
            onClick={handleLogout}
            style={{
              ...MONO, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.611rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: T.grey, padding: '4px 0', textAlign: 'left',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 52, flexShrink: 0,
          borderBottom: `2px solid ${T.black}`,
          background: T.ivory,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {innerView !== 'overview' && (
              <button
                onClick={() => setInnerView('overview')}
                style={{ ...MONO, fontSize: '0.667rem', background: 'none', border: 'none', cursor: 'pointer', color: T.grey, padding: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                ← Overview
              </button>
            )}
            <span style={{ ...MONO, fontSize: '0.889rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {innerView === 'goal' && selectedGoal ? selectedGoal.title
               : innerView === 'tools' ? 'Tools'
               : phaseHeader}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {profile.resistance_pattern && (
              <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {profile.resistance_pattern.replace(/_/g, ' ')}
              </span>
            )}
            <span style={{ ...MONO, fontSize: '0.667rem', color: T.grey }}>{slug}</span>
            {profile.re_interview_overdue && (
              <span style={{ ...MONO, fontSize: '0.611rem', background: T.red, color: T.white, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Check-in due
              </span>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main style={{
          flex: 1, overflowY: 'auto',
          ...(quadrant === 'system' ? {
            backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          } : quadrant === 'workbench' ? {
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          } : {}),
        }}>

          {/* ── SANCTUARY ──────────────────────────────────────── */}
          {layoutMode === 'sanctuary' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '80px 48px', cursor: 'crosshair' }}>
              <p style={{ ...SERIF, fontSize: '2.2rem', fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center', maxWidth: 520, marginBottom: 20 }}>
                {profile.initial_interview_done ? 'What are you working on?' : 'Who are you becoming?'}
              </p>
              <p style={{ ...SERIF, fontSize: '1rem', color: T.grey, fontStyle: 'italic', textAlign: 'center', marginBottom: 56 }}>
                {profile.initial_interview_done
                  ? 'Your goals will appear after your first session.'
                  : 'Start a session to begin your intake interview.'}
              </p>
              <DymoBtn onClick={onStartSession}>
                {profile.initial_interview_done ? 'Start session' : 'Begin intake'}
              </DymoBtn>
            </div>
          )}

          {/* ── REFLECTION ─────────────────────────────────────── */}
          {layoutMode === 'reflection' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 48px', animation: 'fadeIn 0.8s ease' }}>
              <p style={{ ...SERIF, fontSize: '2rem', fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center', maxWidth: 520, marginBottom: 40, animation: 'fadeIn 0.9s 0.15s ease both' }}>
                What are you noticing right now?
              </p>
              <textarea
                placeholder="type into the void"
                style={{
                  ...SERIF, fontStyle: 'italic', fontSize: '1.1rem', lineHeight: 1.8,
                  width: '100%', maxWidth: 520, minHeight: 160,
                  background: 'transparent', border: 'none', outline: 'none',
                  borderBottom: `1px solid ${T.greyLight}`,
                  resize: 'none', padding: '8px 0', color: T.black, textAlign: 'center',
                  animation: 'fadeIn 1s 0.3s ease both',
                }}
              />
              <p style={{ ...MONO, fontSize: '0.611rem', color: T.greyLight, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 16 }}>
                nothing is saved
              </p>
              {activeGoals.length > 0 && (
                <div style={{ marginTop: 64, width: '100%', maxWidth: 640 }}>
                  <GoalOverviewCards
                    goals={activeGoals}
                    publishingLog={publishing_log}
                    onSelectGoal={(id) => { setSelectedGoalId(id); setInnerView('goal') }}
                    onOpenTools={() => setInnerView('tools')}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── GRID / OVERVIEW ────────────────────────────────── */}
          {layoutMode === 'grid' && innerView === 'overview' && (
            <div style={{ padding: '32px 32px 80px' }}>
              {/* Progress map */}
              <div style={{ marginBottom: 32 }}>
                <ProgressMap
                  goals={goalRows}
                  publishingCount={publishing_log.length}
                  sessionsCompleted={profile.sessions_completed}
                  resistancePattern={profile.resistance_pattern}
                  initialInterviewDone={profile.initial_interview_done}
                />
              </div>

              {/* Page header */}
              <div style={{ marginBottom: 32, borderBottom: `2px solid ${T.black}`, paddingBottom: 20 }}>
                <h1 style={{ ...MONO, fontSize: '1.778rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  {phaseHeader}
                </h1>
                {profile.build_name && (
                  <p style={{ ...SERIF, fontSize: '1rem', color: T.grey, marginTop: 6, fontStyle: 'italic' }}>
                    {profile.build_name}
                    {profile.build_description ? ` — ${profile.build_description}` : ''}
                  </p>
                )}
              </div>

              {activeGoals.length === 0 ? (
                <div style={{ padding: '40px 0' }}>
                  <p style={{ ...MONO, fontSize: '0.889rem', color: T.grey }}>
                    {profile.initial_interview_done
                      ? 'No active goals — start a session to add your first goal.'
                      : 'Start a session to begin your intake interview.'}
                  </p>
                </div>
              ) : (
                <GoalOverviewCards
                  goals={activeGoals}
                  publishingLog={publishing_log}
                  onSelectGoal={(id) => { setSelectedGoalId(id); setInnerView('goal') }}
                  onOpenTools={() => setInnerView('tools')}
                />
              )}

              {/* Tools row */}
              <div style={{ marginTop: 36 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey }}>
                    Tools & Agents
                  </span>
                  <button
                    onClick={() => setInnerView('tools')}
                    style={{ ...MONO, fontSize: '0.667rem', background: 'none', border: 'none', cursor: 'pointer', color: T.grey, padding: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  >
                    View all →
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {[...practiceTools, ...AGENTS.map(a => ({ label: a.name, sub: a.author, desc: a.tagline, onClick: () => onEnterAgent?.(a.id), href: undefined }))].map(t => (
                    <ToolCardLg key={t.label} label={t.label} sub={t.sub} desc={t.desc} onClick={t.onClick} href={t.href} />
                  ))}
                </div>
              </div>

              {/* Publishing log strip */}
              {publishing_log.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
                    Publication log ({publishing_log.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `2px solid ${T.black}`, boxShadow: `4px 4px 0px ${T.black}` }}>
                    {publishing_log.slice(0, 5).map((entry, i) => (
                      <div key={entry.log_id} style={{
                        padding: '14px 18px',
                        borderBottom: i < Math.min(publishing_log.length, 5) - 1 ? `1px solid ${T.greyLight}` : 'none',
                        background: T.white,
                        display: 'flex', gap: 16, alignItems: 'flex-start',
                      }}>
                        <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', paddingTop: 3 }}>
                          {fmt(entry.published_at)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.4 }}>{entry.description}</p>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                            <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase' }}>
                              {PLATFORM_LABELS[entry.platform] || entry.platform}
                            </span>
                            {entry.url && entry.url !== 'direct message — no url' && (
                              <a href={entry.url} target="_blank" rel="noopener noreferrer"
                                style={{ ...MONO, fontSize: '0.611rem', color: T.grey }}>
                                {entry.url.length > 60 ? entry.url.slice(0, 60) + '…' : entry.url}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {publishing_log.length > 5 && (
                    <p style={{ ...MONO, fontSize: '0.611rem', color: T.grey, paddingTop: 8 }}>+{publishing_log.length - 5} more entries</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── GOAL DETAIL ────────────────────────────────────── */}
          {innerView === 'goal' && selectedGoal && (
            <GoalDetail
              goal={selectedGoal}
              completingStep={completingStep}
              setCompletingStep={setCompletingStep}
              completionNote={completionNote}
              setCompletionNote={setCompletionNote}
              skippingStep={skippingStep}
              setSkippingStep={setSkippingStep}
              skipReason={skipReason}
              setSkipReason={setSkipReason}
              showProofForm={showProofForm}
              setShowProofForm={setShowProofForm}
              proofUrl={proofUrl}
              setProofUrl={setProofUrl}
              proofPlatform={proofPlatform}
              setProofPlatform={setProofPlatform}
              proofDescription={proofDescription}
              setProofDescription={setProofDescription}
              submittingProof={submittingProof}
              resolveCommitment={resolveCommitment}
              completeStep={completeStep}
              skipStep={skipStep}
              submitProof={submitProof}
              otherGoals={activeGoals.filter(g => g.goal_id !== selectedGoal.goal_id)}
              onSelectGoal={(id) => setSelectedGoalId(id)}
            />
          )}

          {/* ── TOOLS VIEW ─────────────────────────────────────── */}
          {innerView === 'tools' && (
            <ToolsView
              tools={practiceTools}
              agents={AGENTS}
              onEnterAgent={onEnterAgent}
              showProofForm={showProofForm}
              setShowProofForm={setShowProofForm}
              proofUrl={proofUrl}
              setProofUrl={setProofUrl}
              proofPlatform={proofPlatform}
              setProofPlatform={setProofPlatform}
              proofDescription={proofDescription}
              setProofDescription={setProofDescription}
              submittingProof={submittingProof}
              submitProof={submitProof}
              publishingLog={publishing_log}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ── GOAL OVERVIEW CARDS ────────────────────────────────────────
function GoalOverviewCards({
  goals, publishingLog, onSelectGoal, onOpenTools
}: {
  goals: GoalData[]
  publishingLog: PublishingEntry[]
  onSelectGoal: (id: string) => void
  onOpenTools: () => void
}) {
  const primary = goals[0]
  const secondary = goals.slice(1)
  const isOverdue = primary.active_commitment ? daysUntil(primary.active_commitment.due_date) <= 0 : false

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 0, border: `2px solid ${T.black}`, boxShadow: `4px 4px 0px ${T.black}` }}>

      {/* Primary goal — 8 cols */}
      <div
        onClick={() => onSelectGoal(primary.goal_id)}
        style={{
          gridColumn: secondary.length > 0 ? '1 / 9' : '1 / 13',
          borderRight: secondary.length > 0 ? `1px solid ${T.black}` : 'none',
          padding: '28px 28px', background: T.white, cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = T.greyBg)}
        onMouseLeave={e => (e.currentTarget.style.background = T.white)}
      >
        {/* NASA red corner if overdue */}
        {isOverdue && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 0, height: 0,
            borderTop: `32px solid ${T.red}`,
            borderLeft: '32px solid transparent',
          }} />
        )}

        {/* DYMO label */}
        <div style={{ marginBottom: 16 }}>
          <span style={{
            ...MONO, fontSize: '0.611rem', fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase', background: T.black, color: T.white,
            padding: '5px 10px', display: 'inline-block',
          }}>
            Obligation Manifest
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', background: T.black, color: T.ivory }}>
            {HORIZON_LABELS[primary.horizon] || primary.horizon}
          </span>
          <span style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', color: T.grey, border: `1px solid ${T.greyLight}` }}>
            {PHASE_LABELS[primary.phase] || primary.phase}
            {!primary.phase_progress.time_gate_clear && ` · d${primary.phase_progress.days_elapsed}`}
          </span>
          {primary.active_commitment && (
            <span style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: isOverdue ? T.red : T.black, padding: '3px 8px', border: `1px solid ${isOverdue ? T.red : T.greyLight}` }}>
              {isOverdue ? '⚠ overdue' : '⚡ committed'}
            </span>
          )}
          {primary.action_steps.pending.length > 0 && !primary.active_commitment && (
            <span style={{ ...MONO, fontSize: '0.667rem', color: T.grey, textTransform: 'uppercase', padding: '3px 8px' }}>
              ■ step pending
            </span>
          )}
        </div>

        <h2 style={{ ...SERIF, fontSize: '1.333rem', lineHeight: 1.3, marginBottom: primary.description ? 10 : 0, fontWeight: 400 }}>
          {primary.title}
        </h2>
        {primary.description && (
          <p style={{ ...SERIF, fontSize: '0.889rem', color: T.grey, lineHeight: 1.5, marginBottom: 16 }}>
            {primary.description}
          </p>
        )}

        {primary.action_steps.pending.length > 0 && (
          <div style={{ paddingTop: 14, borderTop: `1px solid ${T.greyLight}` }}>
            <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
              Current exercise
            </span>
            <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.5 }}>
              {primary.action_steps.pending[0].text}
            </p>
            {primary.action_steps.pending[0].coach_reason && (
              <p style={{ ...SERIF, fontSize: '0.778rem', color: T.grey, fontStyle: 'italic', marginTop: 6 }}>
                {primary.action_steps.pending[0].coach_reason}
              </p>
            )}
          </div>
        )}

        {primary.active_commitment && (
          <div style={{ paddingTop: 14, borderTop: `1px solid ${T.greyLight}`, marginTop: primary.action_steps.pending.length > 0 ? 14 : 0 }}>
            <span style={{ ...MONO, fontSize: '0.611rem', color: isOverdue ? T.red : T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
              {isOverdue ? '⚠ Commitment overdue' : 'Active commitment'} — due {fmt(primary.active_commitment.due_date)}
            </span>
            <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.5 }}>
              {primary.active_commitment.text}
            </p>
          </div>
        )}

        <p style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 20 }}>
          Click to open →
        </p>
      </div>

      {/* Secondary goals — 4 cols, stacked */}
      {secondary.length > 0 && (
        <div style={{ gridColumn: '9 / 13', display: 'flex', flexDirection: 'column' }}>
          {secondary.map((g, i) => {
            const gOverdue = g.active_commitment ? daysUntil(g.active_commitment.due_date) <= 0 : false
            return (
              <div
                key={g.goal_id}
                onClick={() => onSelectGoal(g.goal_id)}
                style={{
                  flex: 1, padding: '18px 16px', background: T.white, cursor: 'pointer',
                  borderTop: i === 0 ? 'none' : `1px solid ${T.greyLight}`,
                  transition: 'background 0.1s', position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.greyBg)}
                onMouseLeave={e => (e.currentTarget.style.background = T.white)}
              >
                {gOverdue && (
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTop: `20px solid ${T.red}`, borderLeft: '20px solid transparent' }} />
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span style={{ ...MONO, fontSize: '0.611rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px', background: T.black, color: T.ivory }}>
                    {HORIZON_LABELS[g.horizon] || g.horizon}
                  </span>
                  <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', padding: '2px 6px', border: `1px solid ${T.greyLight}` }}>
                    {PHASE_LABELS[g.phase] || g.phase}
                  </span>
                </div>
                <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.3 }}>{g.title}</p>
                {(g.active_commitment || g.action_steps.pending.length > 0) && (
                  <p style={{ ...MONO, fontSize: '0.611rem', color: gOverdue ? T.red : T.grey, marginTop: 6, textTransform: 'uppercase' }}>
                    {gOverdue ? '⚠ overdue' : g.active_commitment ? '⚡ committed' : '■ step pending'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── GOAL DETAIL VIEW ───────────────────────────────────────────
function GoalDetail({
  goal, completingStep, setCompletingStep, completionNote, setCompletionNote,
  skippingStep, setSkippingStep, skipReason, setSkipReason,
  showProofForm, setShowProofForm, proofUrl, setProofUrl, proofPlatform, setProofPlatform,
  proofDescription, setProofDescription, submittingProof,
  resolveCommitment, completeStep, skipStep, submitProof,
  otherGoals, onSelectGoal,
}: {
  goal: GoalData
  completingStep: string | null; setCompletingStep: (v: string | null) => void
  completionNote: string; setCompletionNote: (v: string) => void
  skippingStep: string | null; setSkippingStep: (v: string | null) => void
  skipReason: string; setSkipReason: (v: string) => void
  showProofForm: string | null; setShowProofForm: (v: string | null) => void
  proofUrl: string; setProofUrl: (v: string) => void
  proofPlatform: string; setProofPlatform: (v: string) => void
  proofDescription: string; setProofDescription: (v: string) => void
  submittingProof: boolean
  resolveCommitment: (id: string, status: 'done' | 'missed' | 'partial') => void
  completeStep: (id: string) => void
  skipStep: (id: string) => void
  submitProof: (e: { preventDefault: () => void }, goalId: string, commitmentId: string) => void
  otherGoals: GoalData[]; onSelectGoal: (id: string) => void
}) {
  const isOverdue = goal.active_commitment ? daysUntil(goal.active_commitment.due_date) <= 0 : false
  const hasPending = goal.action_steps.pending.length > 0

  return (
    <div style={{ padding: '32px 32px 80px', maxWidth: 800 }}>
      {/* Goal header */}
      <div style={{ marginBottom: 32, border: `2px solid ${T.black}`, boxShadow: `4px 4px 0px ${T.black}`, background: T.white, padding: '28px 28px', position: 'relative' }}>
        {isOverdue && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTop: `32px solid ${T.red}`, borderLeft: '32px solid transparent' }} />
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', background: T.black, color: T.ivory }}>
            {HORIZON_LABELS[goal.horizon] || goal.horizon}
          </span>
          <span style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', color: T.grey, border: `1px solid ${T.greyLight}` }}>
            {PHASE_LABELS[goal.phase] || goal.phase}
          </span>
          {!goal.phase_progress.time_gate_clear && (
            <span style={{ ...MONO, fontSize: '0.667rem', color: T.grey, padding: '3px 8px', textTransform: 'uppercase' }}>
              Day {goal.phase_progress.days_elapsed} of {goal.phase_progress.minimum_days} min
            </span>
          )}
        </div>
        <h2 style={{ ...SERIF, fontSize: '1.778rem', lineHeight: 1.2, fontWeight: 400, marginBottom: goal.description ? 12 : 0 }}>
          {goal.title}
        </h2>
        {goal.description && (
          <p style={{ ...SERIF, fontSize: '1rem', color: T.grey, lineHeight: 1.6, marginTop: 8 }}>
            {goal.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 24, marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.greyLight}` }}>
          <div>
            <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Phase started</span>
            <span style={{ ...MONO, fontSize: '0.778rem' }}>{fmt(goal.phase_started_at)}</span>
          </div>
          <div>
            <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Steps done</span>
            <span style={{ ...MONO, fontSize: '0.778rem' }}>{goal.phase_progress.completed_action_steps}</span>
          </div>
          <div>
            <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 3 }}>Commitments</span>
            <span style={{ ...MONO, fontSize: '0.778rem' }}>{goal.commitment_history.length}</span>
          </div>
        </div>
      </div>

      {/* Pending action steps */}
      {hasPending && (
        <div style={{ marginBottom: 28 }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
            Current exercises ({goal.action_steps.pending.length})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goal.action_steps.pending.map(step => (
              <div key={step.step_id} style={{
                padding: '20px 22px', background: T.white,
                border: `2px solid ${T.black}`, boxShadow: `3px 3px 0px ${T.black}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ ...MONO, fontSize: '0.667rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Level {step.exercise_level}
                  </span>
                  <span style={{ ...MONO, fontSize: '0.667rem', color: daysUntil(step.due_date) <= 0 ? T.red : T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    due {fmt(step.due_date)}{daysUntil(step.due_date) <= 0 && ' · overdue'}
                  </span>
                </div>
                <p style={{ ...SERIF, fontSize: '1.111rem', lineHeight: 1.5, marginBottom: step.coach_reason ? 10 : 16 }}>{step.text}</p>
                {step.coach_reason && (
                  <p style={{ ...SERIF, fontSize: '0.889rem', color: T.grey, fontStyle: 'italic', marginBottom: 16 }}>{step.coach_reason}</p>
                )}
                {completingStep === step.step_id ? (
                  <div>
                    <textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)}
                      placeholder="What did you do? What came up? (optional)" rows={3}
                      style={{ ...SERIF, width: '100%', marginBottom: 10, fontSize: '0.889rem', padding: 10, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Btn onClick={() => completeStep(step.step_id)}>Done — save note</Btn>
                      <Btn ghost onClick={() => setCompletingStep(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : skippingStep === step.step_id ? (
                  <div>
                    <textarea value={skipReason} onChange={e => setSkipReason(e.target.value)}
                      placeholder="What got in the way? (the coach will see this)" rows={2}
                      style={{ ...SERIF, width: '100%', marginBottom: 10, fontSize: '0.889rem', padding: 10, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Btn ghost onClick={() => skipStep(step.step_id)}>Skip with reason</Btn>
                      <Btn ghost onClick={() => setSkippingStep(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn ghost onClick={() => { setCompletingStep(step.step_id); setSkippingStep(null) }}>Mark done</Btn>
                    <Btn ghost dim onClick={() => { setSkippingStep(step.step_id); setCompletingStep(null) }}>Skip</Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active commitment */}
      {goal.active_commitment && (
        <div style={{ marginBottom: 28 }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: isOverdue ? T.red : T.grey, display: 'block', marginBottom: 16 }}>
            {isOverdue ? '⚠ Active commitment — overdue' : 'Active commitment'}
          </span>
          <div style={{
            padding: '22px 24px', background: T.white,
            border: `2px solid ${isOverdue ? T.red : T.black}`,
            boxShadow: `4px 4px 0px ${isOverdue ? T.red : T.black}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${T.greyLight}` }}>
              <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.grey }}>
                Commitment ladder rung {goal.active_commitment.ladder_rung}
              </span>
              <span style={{ ...MONO, fontSize: '0.667rem', color: isOverdue ? T.red : T.grey, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                due {fmt(goal.active_commitment.due_date)}{isOverdue && ' · overdue'}
              </span>
            </div>
            <p style={{ ...SERIF, fontSize: '1.111rem', lineHeight: 1.5, marginBottom: 16 }}>{goal.active_commitment.text}</p>
            {goal.active_commitment.share_post && (
              <div style={{ marginBottom: 18, padding: '12px 14px', background: T.greyBg, borderLeft: `3px solid ${T.black}` }}>
                <span style={{ ...MONO, fontSize: '0.611rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.grey, display: 'block', marginBottom: 6 }}>Ready to post</span>
                <p style={{ ...SERIF, fontSize: '0.889rem', fontStyle: 'italic' }}>{goal.active_commitment.share_post}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <DymoBtn onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'done')}>
                Mark done
              </DymoBtn>
              <Btn ghost onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'partial')}>Partial</Btn>
              <Btn ghost dim onClick={() => resolveCommitment(goal.active_commitment!.commitment_id, 'missed')}>Missed</Btn>
            </div>
            {showProofForm !== goal.goal_id ? (
              <button onClick={() => setShowProofForm(goal.goal_id)}
                style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.08em', color: T.grey, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textTransform: 'uppercase' }}>
                + Add proof of publication
              </button>
            ) : (
              <form onSubmit={e => submitProof(e, goal.goal_id, goal.active_commitment!.commitment_id)} style={{ marginTop: 12 }}>
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
        <div style={{ marginBottom: 24 }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
            Completed exercises ({goal.phase_progress.completed_action_steps})
          </span>
          <div style={{ border: `1px solid ${T.greyLight}`, background: T.white }}>
            {goal.action_steps.recent_done.map((step, i) => (
              <div key={step.step_id} style={{
                padding: '12px 16px',
                borderBottom: i < goal.action_steps.recent_done.length - 1 ? `1px solid ${T.greyLight}` : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...SERIF, fontSize: '0.889rem', textDecoration: 'line-through', color: T.grey }}>{step.text}</p>
                  {step.completion_note && (
                    <p style={{ ...SERIF, fontSize: '0.778rem', color: T.grey, fontStyle: 'italic', marginTop: 3 }}>"{step.completion_note}"</p>
                  )}
                </div>
                <span style={{ ...MONO, marginLeft: 12, fontSize: '0.611rem', color: T.grey, whiteSpace: 'nowrap', paddingTop: 3 }}>
                  Lv {step.exercise_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commitment history */}
      {goal.commitment_history.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
            Commitment log
          </span>
          <div style={{ border: `1px solid ${T.greyLight}`, background: T.white }}>
            {[...goal.commitment_history].reverse().map((c, i) => (
              <div key={i} style={{
                padding: '12px 16px',
                borderBottom: i < goal.commitment_history.length - 1 ? `1px solid ${T.greyLight}` : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <p style={{ flex: 1, ...SERIF, fontSize: '0.889rem', color: c.status === 'done' ? T.grey : T.black, textDecoration: c.status === 'done' ? 'line-through' : 'none' }}>{c.text}</p>
                <span style={{ marginLeft: 12, ...MONO, fontSize: '0.611rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? T.red : T.grey }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other goals nav */}
      {otherGoals.length > 0 && (
        <div style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${T.greyLight}` }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
            Other active goals
          </span>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {otherGoals.map(g => (
              <button key={g.goal_id} onClick={() => onSelectGoal(g.goal_id)}
                style={{
                  ...SERIF, fontSize: '0.889rem', fontStyle: 'italic', padding: '10px 16px',
                  border: `1px solid ${T.black}`, background: T.white, cursor: 'pointer',
                  boxShadow: `2px 2px 0px ${T.black}`, transition: 'all 0.1s',
                }}>
                {g.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TOOLS VIEW ─────────────────────────────────────────────────
function ToolsView({
  tools, agents, onEnterAgent,
  showProofForm, setShowProofForm, proofUrl, setProofUrl, proofPlatform, setProofPlatform,
  proofDescription, setProofDescription, submittingProof, submitProof, publishingLog,
}: {
  tools: Array<{ label: string; sub: string; desc: string; onClick?: () => void; href?: string }>
  agents: typeof AGENTS
  onEnterAgent?: (id: AgentId) => void
  showProofForm: string | null; setShowProofForm: (v: string | null) => void
  proofUrl: string; setProofUrl: (v: string) => void
  proofPlatform: string; setProofPlatform: (v: string) => void
  proofDescription: string; setProofDescription: (v: string) => void
  submittingProof: boolean
  submitProof: (e: { preventDefault: () => void }, goalId: string, commitmentId: string) => void
  publishingLog: PublishingEntry[]
}) {
  return (
    <div style={{ padding: '32px 32px 80px' }}>
      <h1 style={{ ...MONO, fontSize: '1.778rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 32px', borderBottom: `2px solid ${T.black}`, paddingBottom: 20 }}>
        Tools
      </h1>

      {/* Practice tools */}
      <div style={{ marginBottom: 40 }}>
        <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
          Practice
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tools.map(tool => (
            <ToolCardLg key={tool.label} label={tool.label} sub={tool.sub} desc={tool.desc} onClick={tool.onClick} href={tool.href} />
          ))}
        </div>
      </div>

      {/* Thinking agents */}
      <div style={{ marginBottom: 40 }}>
        <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey, display: 'block', marginBottom: 16 }}>
          Thinking agents
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {agents.map(agent => (
            <ToolCardLg key={agent.id} label={agent.name} sub={agent.author} desc={agent.tagline} onClick={() => onEnterAgent?.(agent.id)} />
          ))}
        </div>
      </div>

      {/* Publishing log */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <span style={{ ...MONO, fontSize: '0.667rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: T.grey }}>
            Publication log {publishingLog.length > 0 && `(${publishingLog.length})`}
          </span>
          {!showProofForm && (
            <button onClick={() => setShowProofForm('global')}
              style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.1em', color: T.grey, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textTransform: 'uppercase' }}>
              + Add
            </button>
          )}
        </div>
        {showProofForm === 'global' && (
          <form onSubmit={e => submitProof(e, '', '')} style={{ marginBottom: 16, maxWidth: 480 }}>
            <ProofFields url={proofUrl} setUrl={setProofUrl} platform={proofPlatform} setPlatform={setProofPlatform}
              description={proofDescription} setDescription={setProofDescription}
              submitting={submittingProof} onCancel={() => setShowProofForm(null)} />
          </form>
        )}
        {publishingLog.length === 0 ? (
          <p style={{ ...MONO, fontSize: '0.778rem', color: T.grey }}>Nothing published yet.</p>
        ) : (
          <div style={{ border: `2px solid ${T.black}`, boxShadow: `4px 4px 0px ${T.black}` }}>
            {publishingLog.map((entry, i) => (
              <div key={entry.log_id} style={{
                padding: '16px 20px', background: T.white,
                borderBottom: i < publishingLog.length - 1 ? `1px solid ${T.greyLight}` : 'none',
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase' }}>{fmt(entry.published_at)}</span>
                  <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', display: 'block', marginTop: 3 }}>{PLATFORM_LABELS[entry.platform] || entry.platform}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ ...SERIF, fontSize: '1rem', lineHeight: 1.4, marginBottom: entry.url ? 6 : 0 }}>{entry.description}</p>
                  {entry.url && entry.url !== 'direct message — no url' && (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer"
                      style={{ ...MONO, fontSize: '0.611rem', color: T.grey, wordBreak: 'break-all' }}>
                      {entry.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SHARED SUBCOMPONENTS ────────────────────────────────────────

function SectionLabel({ children, small, inline }: { children: React.ReactNode; small?: boolean; inline?: boolean }) {
  return (
    <span style={{
      ...MONO, fontSize: small ? '0.611rem' : '0.667rem',
      letterSpacing: '0.18em', textTransform: 'uppercase', color: T.grey,
      display: inline ? 'inline' : 'block', marginBottom: inline ? 0 : 12,
    }}>
      {children}
    </span>
  )
}

function DymoBtn({ children, onClick, fullWidth }: { children: React.ReactNode; onClick?: () => void; fullWidth?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        ...MONO, fontWeight: 700,
        fontSize: '0.667rem', letterSpacing: '0.18em', textTransform: 'uppercase',
        background: T.black, color: T.white,
        border: `2px solid ${T.black}`, padding: '11px 18px', cursor: 'pointer',
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
        ...MONO, fontSize: '0.667rem',
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '7px 14px',
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

function ToolCardLg({ label, sub, desc, onClick, href }: { label: string; sub: string; desc: string; onClick?: () => void; href?: string }) {
  const [hov, setHov] = useState(false)
  const cardStyle: React.CSSProperties = {
    border: `2px solid ${T.black}`,
    boxShadow: hov ? `1px 1px 0px ${T.black}` : `4px 4px 0px ${T.black}`,
    transform: hov ? 'translate(3px,3px)' : 'none',
    padding: '20px 20px', cursor: 'pointer',
    background: hov ? T.greyBg : T.white,
    transition: 'all 0.1s',
    display: 'block', textDecoration: 'none', color: 'inherit',
  }
  const inner = (
    <>
      <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{sub}</span>
      <span style={{ ...SERIF, fontStyle: 'italic', fontSize: '1.111rem', lineHeight: 1.2, display: 'block', marginBottom: 10 }}>{label}</span>
      <p style={{ ...MONO, fontSize: '0.667rem', color: T.grey, lineHeight: 1.6, letterSpacing: '0.03em' }}>{desc}</p>
      {href && <span style={{ ...MONO, fontSize: '0.611rem', color: T.grey, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8, display: 'block' }}>Open ↗</span>}
    </>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={cardStyle}>
        {inner}
      </a>
    )
  }
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={cardStyle}>
      {inner}
    </div>
  )
}

function ProofFields({ url, setUrl, platform, setPlatform, description, setDescription, submitting, onCancel }: {
  url: string; setUrl: (v: string) => void; platform: string; setPlatform: (v: string) => void
  description: string; setDescription: (v: string) => void; submitting: boolean; onCancel: () => void
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="URL to what you published" required
        style={{ ...SERIF, fontSize: '1rem', padding: 10, border: `1px solid ${T.black}`, width: '100%', background: T.white }} />
      <select value={platform} onChange={e => setPlatform(e.target.value)}
        style={{ ...SERIF, fontSize: '1rem', padding: 10, border: `1px solid ${T.black}`, background: T.white }}>
        <option value="community">Unlabeled Community</option>
        <option value="linkedin">LinkedIn</option>
        <option value="twitter">X / Twitter</option>
        <option value="substack">Substack</option>
        <option value="blog">Blog</option>
        <option value="email">Email (no URL)</option>
        <option value="other">Other</option>
      </select>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What did you publish? One or two sentences." rows={2} required
        style={{ ...SERIF, fontSize: '1rem', padding: 10, border: `1px solid ${T.black}`, resize: 'vertical', background: T.white }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={submitting}
          style={{ ...MONO, fontSize: '0.667rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px', border: `1px solid ${T.black}`, background: T.black, color: T.white, cursor: 'pointer', opacity: submitting ? 0.5 : 1, boxShadow: `2px 2px 0px ${T.black}` }}>
          {submitting ? 'Saving…' : 'Save proof'}
        </button>
        <Btn ghost dim onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  )
}
