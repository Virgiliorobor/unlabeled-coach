// Mission Map — visual status board for the coaching program.
// Three layers: phase rail (Bauhaus) + horizon zones (Sachs) + evidence strip (Kleon).

interface ActiveCommitment {
  text: string
  due_date: string
  ladder_rung: number
}

interface Goals {
  thirty_days: { text: string; status: string }
  ninety_days: { text: string; status: string }
  twelve_months: { text: string; status: string }
}

interface CommitmentHistoryItem {
  status: string
}

interface Props {
  currentPhase: string
  daysElapsed: number
  goals: Goals
  activeCommitment: ActiveCommitment | null
  publishingCount: number
  pendingStepCount: number
  completedStepCount: number
  currentExerciseLevel: number
  commitmentHistory: CommitmentHistoryItem[]
}

const PHASES = [
  { key: 'interview',       label: 'INTAKE',   short: '0' },
  { key: 'reflection',      label: 'REFLECT',  short: '1' },
  { key: 'clarity',         label: 'CLARITY',  short: '2' },
  { key: 'resistance',      label: 'RESIST',   short: '3' },
  { key: 'commitment',      label: 'COMMIT',   short: '4' },
  { key: 'accountability',  label: 'ACCOUNT',  short: '5' },
]

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function ProgressMap({
  currentPhase,
  daysElapsed,
  goals,
  activeCommitment,
  publishingCount,
  pendingStepCount,
  completedStepCount,
  currentExerciseLevel,
  commitmentHistory,
}: Props) {
  const currentIdx = PHASES.findIndex(p => p.key === currentPhase)
  const progressPct = currentIdx < 0 ? 0 : (currentIdx / (PHASES.length - 1)) * 100

  const daysLeft = activeCommitment ? daysUntil(activeCommitment.due_date) : null
  const commitmentOverdue = daysLeft !== null && daysLeft <= 0

  // Exercise level dots — up to 5
  const totalExerciseLevels = 5
  const exerciseDots = Array.from({ length: totalExerciseLevels }, (_, i) => i < currentExerciseLevel)

  return (
    <div className="mission-map" style={{
      border: '2px solid var(--black)',
      boxShadow: '4px 4px 0px var(--black)',
      marginBottom: 'var(--space-lg)',
      background: 'var(--bg)',
    }}>

      {/* ── MAP HEADER ──────────────────────────────────────── */}
      <div style={{
        borderBottom: '2px solid var(--black)',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--black)',
        color: 'var(--bg)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Mission Map
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'rgba(244,244,240,0.6)' }}>
          Day {daysElapsed} · Phase {currentIdx} of {PHASES.length - 1}
        </span>
      </div>

      {/* ── PHASE RAIL ──────────────────────────────────────── */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '2px solid var(--black)' }}>

        {/* "HERE" label above current station */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
          paddingLeft: 8,
          paddingRight: 8,
        }}>
          {PHASES.map((phase, i) => (
            <div key={phase.key} style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.55rem',
              fontFamily: 'var(--font-mono)',
              color: i === currentIdx ? 'var(--black)' : 'transparent',
              letterSpacing: '0.1em',
              fontWeight: 700,
            }}>
              ▶ HERE
            </div>
          ))}
        </div>

        {/* The rail itself */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 8px' }}>

          {/* Background track line */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 8,
            right: 8,
            height: 2,
            background: 'var(--grey-light)',
            transform: 'translateY(-50%)',
          }} />

          {/* Progress line (filled) */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 8,
            width: `calc(${progressPct}% - 8px)`,
            height: 2,
            background: 'var(--black)',
            transform: 'translateY(-50%)',
            transition: 'width 0.6s ease',
          }} />

          {/* Station nodes */}
          {PHASES.map((phase, i) => {
            const done    = i < currentIdx
            const current = i === currentIdx
            const future  = i > currentIdx
            const size    = current ? 20 : 12

            return (
              <div key={phase.key} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1,
              }}>
                {/* The dot */}
                <div style={{
                  width:  size,
                  height: size,
                  background:  done || current ? 'var(--black)' : 'var(--bg)',
                  border:      future ? '2px solid var(--grey-mid)' : '2px solid var(--black)',
                  boxShadow:   current ? '2px 2px 0 var(--black)' : 'none',
                  flexShrink:  0,
                }} />
              </div>
            )
          })}
        </div>

        {/* Station labels */}
        <div style={{ display: 'flex', padding: '6px 8px 0', justifyContent: 'space-between' }}>
          {PHASES.map((phase, i) => {
            const current = i === currentIdx
            const future  = i > currentIdx
            return (
              <div key={phase.key} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '0.55rem',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                fontWeight: current ? 700 : 400,
                color: future ? 'var(--grey-mid)' : 'var(--black)',
              }}>
                {phase.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── HORIZON ZONES ───────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '2px solid var(--black)',
      }}>

        {/* 30 DAYS */}
        <div style={{ padding: '12px 14px', borderRight: '1px solid var(--black)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'inline-block',
            background: 'var(--black)',
            color: 'var(--bg)',
            padding: '2px 6px',
          }}>
            30 days
          </div>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.4, marginBottom: 10, color: goals.thirty_days.text ? 'inherit' : 'var(--grey-mid)' }}>
            {goals.thirty_days.text || 'Not set'}
          </p>

          {activeCommitment && (
            <div style={{
              border: `2px solid ${commitmentOverdue ? 'var(--red)' : 'var(--black)'}`,
              padding: '8px 10px',
              background: commitmentOverdue ? 'rgba(224,60,49,0.06)' : 'transparent',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: commitmentOverdue ? 'var(--red)' : 'var(--grey-mid)',
                marginBottom: 4,
              }}>
                {commitmentOverdue ? `⚠ overdue ${Math.abs(daysLeft!)}d` : `${daysLeft}d left`} · rung {activeCommitment.ladder_rung}
              </div>
              <p style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>{activeCommitment.text}</p>
            </div>
          )}
        </div>

        {/* 90 DAYS */}
        <div style={{ padding: '12px 14px', borderRight: '1px solid var(--black)' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'inline-block',
            background: 'var(--grey-light)',
            color: 'var(--black)',
            padding: '2px 6px',
          }}>
            90 days
          </div>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.4, color: goals.ninety_days.text ? 'inherit' : 'var(--grey-mid)' }}>
            {goals.ninety_days.text || 'Not set'}
          </p>
        </div>

        {/* 12 MONTHS */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'inline-block',
            background: 'transparent',
            color: 'var(--grey-mid)',
            border: '1px solid var(--grey-mid)',
            padding: '2px 6px',
          }}>
            12 months
          </div>
          <p style={{ fontSize: '0.8rem', lineHeight: 1.4, color: goals.twelve_months.text ? 'inherit' : 'var(--grey-mid)' }}>
            {goals.twelve_months.text || 'Not set'}
          </p>
        </div>
      </div>

      {/* ── EVIDENCE STRIP ──────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '10px 16px',
        gap: 12,
        alignItems: 'center',
      }}>

        {/* Exercise level dots */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 4, textTransform: 'uppercase' }}>
            Exercises
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {exerciseDots.map((done, i) => (
              <div key={i} style={{
                width: 10,
                height: 10,
                background: done ? 'var(--black)' : 'transparent',
                border: '1.5px solid var(--black)',
                borderColor: done ? 'var(--black)' : 'var(--grey-mid)',
              }} />
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)', marginLeft: 4 }}>
              {completedStepCount} done{pendingStepCount > 0 ? ` · ${pendingStepCount} pending` : ''}
            </span>
          </div>
        </div>

        {/* Published stamps */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 4, textTransform: 'uppercase' }}>
            Published
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {publishingCount === 0 ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>—</span>
            ) : (
              <>
                {Array.from({ length: Math.min(publishingCount, 8) }).map((_, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', lineHeight: 1 }}>★</span>
                ))}
                {publishingCount > 8 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)' }}>+{publishingCount - 8}</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Commitment history marks */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--grey-mid)', marginBottom: 4, textTransform: 'uppercase' }}>
            Commitments
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {commitmentHistory.length === 0 ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)' }}>—</span>
            ) : (
              commitmentHistory.slice(-8).map((c, i) => (
                <span key={i} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: c.status === 'done' ? '#2d6a2d' : c.status === 'missed' ? 'var(--red)' : 'var(--grey-mid)',
                  lineHeight: 1,
                }}>
                  {c.status === 'done' ? '✓' : c.status === 'missed' ? '✗' : '◐'}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
