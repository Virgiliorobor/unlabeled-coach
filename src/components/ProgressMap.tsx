// Portfolio Board — visual overview of all goals at their current phases.
// Each goal is a row with a mini phase rail. Evidence strip at the bottom.

interface GoalRow {
  goal_id: string
  title: string
  horizon: string
  phase: string
  status: string
  has_pending_step: boolean
  has_active_commitment: boolean
  days_in_phase: number
  time_gate_clear: boolean
}

interface Props {
  goals: GoalRow[]
  publishingCount: number
  sessionsCompleted: number
  resistancePattern: string
  initialInterviewDone: boolean
}

const PHASES = [
  { key: 'intake',          label: 'INTAKE'  },
  { key: 'reflection',      label: 'REFLECT' },
  { key: 'clarity',         label: 'CLARITY' },
  { key: 'resistance',      label: 'RESIST'  },
  { key: 'commitment',      label: 'COMMIT'  },
  { key: 'accountability',  label: 'ACCOUNT' },
]

const HORIZON_LABELS: Record<string, string> = {
  thirty_days:   '30D',
  ninety_days:   '90D',
  twelve_months: '12M',
  ongoing:       '∞',
}

function GoalPhaseRail({ phase, timeGateClear }: { phase: string; timeGateClear: boolean }) {
  const currentIdx = PHASES.findIndex(p => p.key === phase)
  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0,
        height: 1, background: 'var(--grey-light)', transform: 'translateY(-50%)', zIndex: 0,
      }} />
      {PHASES.map((p, i) => {
        const done    = i < currentIdx
        const current = i === currentIdx
        const size    = current ? 10 : 6
        return (
          <div key={p.key} style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: size, height: size,
              background: done || current ? 'var(--black)' : 'var(--bg)',
              border: done || current ? '1.5px solid var(--black)' : '1.5px solid var(--grey-mid)',
              flexShrink: 0,
            }} />
          </div>
        )
      })}
    </div>
  )
}

export default function ProgressMap({
  goals,
  publishingCount,
  sessionsCompleted,
  resistancePattern,
  initialInterviewDone,
}: Props) {
  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div style={{
      border: '2px solid var(--black)',
      boxShadow: '4px 4px 0px var(--black)',
      marginBottom: 'var(--space-lg)',
      background: 'var(--bg)',
    }}>

      {/* Header */}
      <div style={{
        borderBottom: '2px solid var(--black)', padding: '8px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--black)', color: 'var(--bg)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Portfolio Board
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(244,244,240,0.6)' }}>
          {activeGoals.length} active · {sessionsCompleted} sessions
        </span>
      </div>

      {/* Phase column headers */}
      <div style={{ padding: '4px 16px 0', borderBottom: '1px solid var(--grey-light)' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: 136, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {PHASES.map(p => (
              <div key={p.key} style={{
                flex: 1, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '0.45rem',
                letterSpacing: '0.08em', color: 'var(--grey-mid)', paddingBottom: 3,
              }}>
                {p.label}
              </div>
            ))}
          </div>
          <div style={{ width: 20, flexShrink: 0 }} />
        </div>
      </div>

      {/* Goal rows */}
      {goals.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>
            {initialInterviewDone
              ? 'No goals yet — start a session to add your first goal.'
              : 'Start a session to begin your intake interview.'}
          </span>
        </div>
      ) : (
        activeGoals.map(goal => (
          <div key={goal.goal_id} style={{
            padding: '10px 16px', borderBottom: '1px solid var(--grey-light)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Horizon badge */}
            <div style={{
              width: 28, flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.05em',
              textAlign: 'center', padding: '2px 0',
              background: goal.horizon === 'thirty_days' ? 'var(--black)' : 'transparent',
              color: goal.horizon === 'thirty_days' ? 'var(--bg)' : 'var(--grey-mid)',
              border: '1px solid var(--black)',
            }}>
              {HORIZON_LABELS[goal.horizon] || '?'}
            </div>

            {/* Title */}
            <div style={{
              width: 100, flexShrink: 0,
              fontSize: '0.7rem', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {goal.title}
            </div>

            {/* Mini phase rail */}
            <div style={{ flex: 1 }}>
              <GoalPhaseRail phase={goal.phase} timeGateClear={goal.time_gate_clear} />
            </div>

            {/* Status indicator */}
            <div style={{ width: 20, flexShrink: 0, textAlign: 'right' }}>
              {goal.has_active_commitment && (
                <span title="Active commitment" style={{ fontSize: '0.6rem' }}>⚡</span>
              )}
              {goal.has_pending_step && !goal.has_active_commitment && (
                <span title="Pending exercise" style={{ fontSize: '0.6rem', color: 'var(--grey-mid)' }}>■</span>
              )}
            </div>
          </div>
        ))
      )}

      {/* Completed goals */}
      {completedGoals.map(goal => (
        <div key={goal.goal_id} style={{
          padding: '6px 16px', borderBottom: '1px solid var(--grey-light)',
          display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>✓</span>
          <span style={{ fontSize: '0.65rem', textDecoration: 'line-through', color: 'var(--grey-mid)' }}>{goal.title}</span>
        </div>
      ))}

      {/* Evidence strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 16px', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.45rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 2, textTransform: 'uppercase' }}>
            Pattern
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
            {resistancePattern ? resistancePattern.replace(/_/g, ' ') : '—'}
          </span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.45rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 2, textTransform: 'uppercase' }}>
            Published
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {publishingCount === 0 ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>—</span>
            ) : (
              <>
                {Array.from({ length: Math.min(publishingCount, 8) }).map((_, i) => (
                  <span key={i} style={{ fontSize: '0.65rem', lineHeight: 1 }}>★</span>
                ))}
                {publishingCount > 8 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--grey-mid)' }}>+{publishingCount - 8}</span>
                )}
              </>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.45rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 2, textTransform: 'uppercase' }}>
            Sessions
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
            {sessionsCompleted}
          </span>
        </div>
      </div>
    </div>
  )
}
