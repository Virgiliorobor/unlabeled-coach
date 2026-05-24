import { useState } from 'react'

interface ActionStep {
  step: string
  estimated_time: string
}

interface SimplifyResult {
  simplified_task: string
  action_steps: ActionStep[]
  first_move: string
  potential_blockers: string[]
}

interface Props {
  onBack: () => void
}

export default function TaskSimplifier({ onBack }: Props) {
  const [task, setTask] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimplifyResult | null>(null)
  const [error, setError] = useState('')

  async function handleSimplify() {
    if (!task.trim()) return
    setLoading(true)
    setResult(null)
    setError('')

    const res = await fetch('/api/tools/simplify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task.trim(), context: context.trim() }),
    })

    if (res.ok) {
      const data = await res.json()
      setResult(data)
    } else {
      setError('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  function handleReset() {
    setTask('')
    setContext('')
    setResult(null)
    setError('')
  }

  return (
    <div className="session-layout">
      <div className="session-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
              letterSpacing: '0.1em', color: 'rgba(244,244,240,0.6)',
              padding: 0, textTransform: 'uppercase',
            }}
          >
            ← Back
          </button>
          <span className="label">Task Simplifier</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'rgba(244,244,240,0.4)', fontStyle: 'italic' }}>
          big task → concrete steps
        </span>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>

        {/* Input form */}
        {!result && (
          <>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--grey-mid)', lineHeight: 1.7, marginBottom: 24 }}>
              Describe the task that feels too big, too vague, or too overwhelming to start. The simplifier will break it into concrete steps with a clear first move.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>The task</label>
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                placeholder="e.g. Launch a consulting landing page, or write the product announcement, or figure out my pricing model…"
                rows={4}
                style={textareaStyle}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Context (optional)</label>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="What have you already tried? What's blocking you? What does done look like?"
                rows={3}
                style={textareaStyle}
              />
            </div>

            {error && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'red', marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ textAlign: 'right' }}>
              <button
                className="btn btn-primary"
                onClick={handleSimplify}
                disabled={loading || !task.trim()}
              >
                {loading ? 'Simplifying…' : 'Simplify →'}
              </button>
            </div>
          </>
        )}

        {/* Result */}
        {result && (
          <div>
            {/* Simplified task */}
            <div style={{ marginBottom: 24 }}>
              <div style={sectionLabelStyle}>What this actually is</div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.5, fontWeight: 600 }}>{result.simplified_task}</p>
            </div>

            {/* First move — most prominent */}
            <div style={{
              border: '2px solid var(--black)',
              boxShadow: '3px 3px 0 var(--black)',
              padding: '14px 16px',
              marginBottom: 24,
              background: 'var(--black)',
              color: 'var(--bg)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, color: 'rgba(244,244,240,0.6)' }}>
                Do this first — next 30 minutes
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>{result.first_move}</p>
            </div>

            {/* Action steps */}
            <div style={{ marginBottom: 24 }}>
              <div style={sectionLabelStyle}>All steps, in order</div>
              {result.action_steps.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--grey-light)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--grey-mid)', width: 16, flexShrink: 0, paddingTop: 2 }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: '0.75rem', lineHeight: 1.5, flex: 1 }}>{s.step}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--grey-mid)', flexShrink: 0, paddingTop: 2 }}>
                    {s.estimated_time}
                  </span>
                </div>
              ))}
            </div>

            {/* Potential blockers */}
            {result.potential_blockers?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={sectionLabelStyle}>Watch for these</div>
                {result.potential_blockers.map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '6px 0',
                    borderBottom: '1px solid var(--grey-light)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--grey-mid)', flexShrink: 0 }}>▲</span>
                    <span style={{ fontSize: '0.72rem', lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn" onClick={handleReset}>New task</button>
              <button className="btn" onClick={onBack}>Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--grey-mid)', marginBottom: 6,
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'var(--grey-mid)', marginBottom: 8,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
  lineHeight: 1.6, padding: '10px 12px',
  border: '1.5px solid var(--grey-mid)',
  background: 'var(--bg)', color: 'var(--black)',
  resize: 'vertical', outline: 'none',
}
